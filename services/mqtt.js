const Community = require('../models/Community');
const appState = require('../utils/AppState');
const time = require('../utils/time');
const { verifyJWT } = require('../utils/tokens');
const config = require('../config');
const crypto = require('crypto');

// 缓存模块
const NodeCache = require('node-cache');
const { LRUCache } = require('lru-cache');
const topicMembersCache = new NodeCache({ stdTTL: 60 }); // 缓存60秒
const userInboxCache = new NodeCache({ stdTTL: 300 }); // 用户收件箱主题缓存5分钟

let wss = null; // WebSocket服务器

// 用 LRU 限制最大连接数，最多 5 万连接， TTL 为 1 小时
const clients = new LRUCache({
  max: 50000,
  ttl: 1000 * 60 * 60,
  dispose: (client, id) => {
    try {
      if (client && client.readyState === 1 /* OPEN */) { // 仅仅安全地终止
        client.terminate();
      }
    } catch (e) { }
  }
});
const kLastActivity = Symbol('lastActivity');
const kUserId = Symbol('userId');

// 配置
const HEARTBEAT_TIMEOUT = config.mqtt?.heartbeatTimeout || 90000; // 90秒无活动断开
const CHECK_INTERVAL = config.mqtt?.checkInterval || 30000; // 30秒检查一次

// JSON 解析优化（Worker 线程）
const { Worker } = require('worker_threads');

const parseJSONInWorker = (message) => {
  return new Promise((resolve, reject) => {
    // 简易 worker，在处理大型 JSON 时不会阻塞主线程
    const worker = new Worker(`
      const { parentPort } = require('worker_threads');
      parentPort.on('message', (msg) => {
        try {
          const result = JSON.parse(msg);
          parentPort.postMessage({ success: true, data: result });
        } catch (e) {
          parentPort.postMessage({ success: false, error: e.message });
        }
      });
    `, { eval: true });

    worker.on('message', (result) => {
      worker.terminate();
      if (result.success) {
        resolve(result.data);
      } else {
        reject(new Error(result.error));
      }
    });
    worker.on('error', (err) => {
      worker.terminate();
      reject(err);
    });
    worker.postMessage(message.toString());
  });
};

// 生成用户收件箱主题（带缓存）
function generateUserInboxTopic(userId) {
  const cacheKey = `inbox:${userId}`;
  let topic = userInboxCache.get(cacheKey);

  if (topic) return topic;

  // 使用HMAC生成安全的用户收件箱主题名称
  const hash = crypto
    .createHmac('sha256', config.jwtSecret || 'default-secret')
    .update(`user-inbox-${userId}`)
    .digest('hex');

  topic = `${config.mqtt.topic}/inbox/${hash}`;
  userInboxCache.set(cacheKey, topic);

  return topic;
}

// 获取话题成员（带缓存）
async function getTopicMembers(topicId) {
  const cacheKey = `topic:${topicId}:members`;
  let members = topicMembersCache.get(cacheKey);

  if (members) return members;

  // 缓存未命中，查数据库
  const db = require('../config/database');
  members = await new Promise((resolve, reject) => {
    db.all(
      "SELECT user_id FROM topic_members WHERE topic_id = ?",
      [topicId],
      (err, rows) => {
        if (err) reject(err);
        else resolve(rows.map(row => row.user_id));
      }
    );
  });

  topicMembersCache.set(cacheKey, members);
  return members;
}

// 使话题成员缓存失效
function invalidateTopicCache(topicId) {
  topicMembersCache.del(`topic:${topicId}:members`);
}

// 初始化内部MQTT WebSocket服务器
function initInternalMQTT(server) {
  // 只有在启用SSL或需要WebSocket时才初始化
  return new Promise((resolve) => {
    try {
      const WebSocket = require('ws');

      // 创建WebSocket服务器
      wss = new WebSocket.Server({ server, path: '/mqtt' });

      wss.on('connection', (ws, req) => {
        console.log('新的WebSocket客户端连接');

        // 为每个连接分配唯一ID
        const clientId = time.nowMs() + '-' + Math.random().toString(36).substr(2, 9);
        ws.clientId = clientId;
        ws[kLastActivity] = time.nowMs(); // 记录最后活动时间
        ws[kUserId] = null;
        ws.subscribedTopics = [];
        clients.set(clientId, ws);

        ws.on('message', async (message) => {
          ws[kLastActivity] = time.nowMs(); // 收到消息即表明存活
          console.log('收到WebSocket消息:', message.toString()); // 添加调试日志
          try {
            // 解析MQTT over WebSocket消息
            // 超过 10KB 的消息交给 Worker 线程异步解析，防止阻塞
            let packet;
            if (message.length > 10240) {
              packet = await parseJSONInWorker(message);
            } else {
              packet = JSON.parse(message);
            }

            console.log('解析后的消息类型:', packet.type); // 添加调试日志

            // 处理不同类型的MQTT包
            switch (packet.type) {
              case 'connect':
                // 处理连接请求，需要JWT认证
                let isAuthenticated = false;
                let userId = null;

                try {
                  // 检查是否有JWT token
                  if (packet.token) {
                    try {
                      const user = verifyJWT(packet.token);
                      userId = user.id;
                      isAuthenticated = true;
                      ws.userId = userId; // 保存用户ID
                      ws[kUserId] = userId;
                      console.log(`用户 ${userId} 认证成功`);
                    } catch (jwtError) {
                      // 获取token内容，可能是secureString
                      const tokenStr = packet.token;
                      if (appState.hasOidc(tokenStr)) {
                        // 这是一个有效的OIDC预登录会话
                        ws.oidcSessionId = tokenStr;
                        isAuthenticated = true;
                        console.log(`OIDC预登录会话连接成功(via JSON): ${tokenStr.substring(0, 8)}...`);
                      } else {
                        console.error('JWT验证失败且非有效OIDC会话:', jwtError);
                      }
                    }
                  } else {
                    console.log('连接请求中未提供token');
                  }
                } catch (error) {
                  console.error('认证过程出错:', error);
                }

                ws.send(JSON.stringify({
                  type: 'connack',
                  returnCode: isAuthenticated ? 0 : 1 // 0表示成功，1表示认证失败
                }));
                break;

              case 'subscribe':
                // 处理订阅请求，需要认证
                if (!ws.userId && !ws.oidcSessionId) {
                  // 未认证用户不能订阅
                  ws.send(JSON.stringify({
                    type: 'suback',
                    messageId: packet.messageId,
                    granted: packet.topics ? packet.topics.map(() => 0) : [] // 0表示拒绝
                  }));
                  break;
                }

                ws.subscribedTopics = ws.subscribedTopics || [];
                const granted = [];

                if (ws.userId) {
                  // 常规用户验证：用户只能订阅自己的收件箱
                  const userInboxTopic = generateUserInboxTopic(ws.userId);

                  console.log('Comparing ', topic, ' vs ', userInboxTopic); 
 packet.topics.forEach(topic => {
                    if (topic === userInboxTopic) {
                      ws.subscribedTopics.push(topic);
                      granted.push(1);
                    } else {
                      console.log("Topic mismatch! Expected:", userInboxTopic, "Got:", topic); granted.push(0);
                    }
                  });
                } else if (ws.oidcSessionId) {
                  // OIDC预登录用户验证：只能订阅对应的OIDC频道
                  const oidcTopic = `oidc/login/${ws.oidcSessionId}`;

                  packet.topics.forEach(topic => {
                    if (topic === oidcTopic) {
                      ws.subscribedTopics.push(topic);
                      granted.push(1);
                    } else {
                      console.log("Topic mismatch! Expected:", userInboxTopic, "Got:", topic); granted.push(0);
                    }
                  });
                }

                ws.send(JSON.stringify({
                  type: 'suback',
                  messageId: packet.messageId,
                  granted: granted
                }));
                break;

              case 'publish':
                // 处理发布消息

                // 检查是否是OIDC认证消息
                if (ws.oidcSessionId && packet.topic === `oidc/verify/${ws.oidcSessionId}`) {
                  // 验证authString
                  const sessionData = appState.getOidc(ws.oidcSessionId);
                  if (sessionData && sessionData.authString === packet.payload) {
                    // 认证成功
                    sessionData.isVerified = true;
                    appState.setOidc(ws.oidcSessionId, sessionData);
                    console.log(`OIDC会话 ${ws.oidcSessionId} 已通过WebSocket认证`);

                    // 可选：回复确认
                    // 不需要回复，客户端订阅了login频道，稍后会从那里收到token
                  } else {
                    console.warn(`OIDC会话 ${ws.oidcSessionId} 认证失败`);
                    // 可以发送错误消息
                  }
                  break;
                }

                // 其他情况，客户端不应直接发布消息
                // 所有消息都应通过服务器端的broadcastMessage函数发送
                console.warn('客户端尝试发布消息，但客户端不应直接发布消息');
                break;

              case 'pingreq':
                // 处理心跳
                ws.send(JSON.stringify({
                  type: 'pingresp'
                }));
                break;

              default:
                console.warn('未知的消息类型:', packet.type);
                // 如果是连接请求之外的消息类型，且用户未认证，则发送错误响应
                if (packet.type !== 'connect' && !ws.userId) {
                  ws.send(JSON.stringify({
                    type: 'error',
                    message: '未认证的用户无法执行此操作',
                    code: 401
                  }));
                }
                break;
            }
          } catch (error) {
            console.error('处理WebSocket消息错误:', error);
            // 如果JSON解析失败，可能是客户端直接发送了token而非JSON格式的CONNECT包
            try {
              const rawMessage = message.toString();
              let isAuthenticated = false;
              let userId = null;

              // 尝试将消息视为原始JWT token
              try {
                // 检查是否为JWT格式 (基本检查)
                if (rawMessage.split('.').length === 3) {
                  const user = verifyJWT(rawMessage);
                  userId = user.id;
                  isAuthenticated = true;
                  ws.userId = userId; // 保存用户ID
                  ws[kUserId] = userId;
                  console.log(`用户 ${userId} 通过直接token认证成功`);
                } else {
                  throw new Error('Not a JWT');
                }
              } catch (jwtError) {
                // 如果不是JWT，检查是否为OIDC预登录安全字符串
                if (appState.hasOidc(rawMessage)) {
                  // 这是一个有效的OIDC预登录会话
                  const sessionData = appState.getOidc(rawMessage);
                  ws.oidcSessionId = rawMessage;
                  isAuthenticated = true;
                  console.log(`OIDC预登录会话连接成功: ${rawMessage.substring(0, 8)}...`);
                } else {
                  console.error('直接token验证失败:', jwtError);
                }
              }

              // 发送CONNACK响应而不是错误响应
              ws.send(JSON.stringify({
                type: 'connack',
                returnCode: isAuthenticated ? 0 : 1 // 0表示成功，1表示认证失败
              }));

            } catch (fallbackError) {
              console.error('降级处理也失败:', fallbackError);
              // 最后的保障措施
              try {
                ws.send(JSON.stringify({
                  type: 'error',
                  message: '消息格式错误或处理失败',
                  code: 400
                }));
              } catch (sendError) {
                console.error('发送错误响应失败:', sendError);
              }
            }
          }
        });

        ws.on('close', () => {
          console.log('WebSocket客户端断开连接');
          clients.delete(clientId);
        });

        ws.on('error', (error) => {
          console.error('WebSocket连接错误:', error);
          clients.delete(clientId);
        });

        // 定期检查心跳超时
        const interval = setInterval(() => {
          const now = time.nowMs();
          const timeoutTime = now - HEARTBEAT_TIMEOUT;

          clients.forEach((client, id) => {
            if (client[kLastActivity] < timeoutTime) {
              console.log(`客户端 ${id} 心跳超时，强制断开`);
              clients.delete(id);
              try { client.terminate(); } catch (e) { }
            }
          });
        }, CHECK_INTERVAL);

        ws.on('close', () => {
          clearInterval(interval);
        });
      });

      console.log('MQTT over WebSocket服务器已启动');
      resolve();
    } catch (error) {
      console.error('WebSocket服务器初始化失败:', error);
      resolve(); // 即使WebSocket初始化失败，也继续运行
    }
  });
}

// 处理传入的发布消息
function handleIncomingPublish(packet, ws) {
  // 客户端不应该直接发布消息，所有消息都应通过服务器端的broadcastMessage函数发送
  console.warn('客户端尝试发布消息，但客户端不应直接发布消息');
}

// 广播消息到WebSocket订阅者
function broadcastToWebSocketSubscribers(topic, message) {
  if (!wss) return; // 如果WebSocket服务器未初始化，则直接返回

  clients.forEach((client) => {
    if (client.readyState === client.OPEN &&
      client.subscribedTopics &&
      client.subscribedTopics.includes(topic)) {
      client.send(JSON.stringify({
        type: 'publish',
        topic: topic,
        payload: message,
        qos: 1
      }));
    }
  });
}

// 初始化外部MQTT连接（已移除，因为我们只使用WebSocket）
function initMQTT() {
  // 不再需要外部MQTT连接
  return Promise.resolve();
}

// 处理广播消息（已简化，因为我们只使用WebSocket）
function handleBroadcastMessage(message) {
  // 不再需要处理外部MQTT消息
  console.log('收到广播消息，但外部MQTT已禁用');
}

function broadcastMessage(messageData) {
  let adjustedMessageData = { ...messageData };

  if (messageData.messageType === 'private') {
    adjustedMessageData.messageType = 'normal';
    adjustedMessageData.sourceType = 'private';

    const recipients = [messageData.sender_id, messageData.receiver_id];
    console.log(`私聊消息: sender_id=${messageData.sender_id}, receiver_id=${messageData.receiver_id}`);

    setImmediate(() => {
      broadcastToRecipients(recipients, adjustedMessageData);
    });
  } else if (messageData.topic_id) {
    adjustedMessageData.messageType = 'normal';
    adjustedMessageData.sourceType = 'topic';

    console.log(`话题消息: topic_id=${messageData.topic_id}, user_id=${messageData.user_id}`);

    setImmediate(async () => {
      try {
        const recipients = await getTopicMembers(messageData.topic_id);

        if (!recipients.includes(messageData.user_id)) {
          recipients.push(messageData.user_id);
        }

        broadcastToRecipients(recipients, adjustedMessageData);
      } catch (err) {
        console.error("获取话题成员失败:", err);
        broadcastToRecipients([messageData.user_id], adjustedMessageData);
      }
    });
  } else {
    adjustedMessageData.messageType = 'normal';
    adjustedMessageData.sourceType = 'chatroom';

    console.log(`公共消息: user_id=${messageData.user_id}`);

    setImmediate(() => {
      let recipients = [];
      clients.forEach((client) => {
        if (client.userId) {
          recipients.push(client.userId);
        }
      });

      recipients = [...new Set(recipients)];
      if (!recipients.includes(messageData.user_id)) {
        recipients.push(messageData.user_id);
      }

      broadcastToRecipients(recipients, adjustedMessageData);
    });
  }
}

// 广播消息操作事件（撤回、编辑、转发等）
function broadcastMessageEvent(eventData) {
  console.log(`广播消息事件: ${eventData.eventType}, messageId=${eventData.messageId}`);

  eventData.timestamp = time.now().toISOString();
  let adjustedEventData = { ...eventData };

  setImmediate(() => {
    if (eventData.messageType === 'private') {
      adjustedEventData.messageType = 'normal';
      adjustedEventData.sourceType = 'private';

      const recipients = [eventData.userId, eventData.targetUserId];
      broadcastToRecipients(recipients, {
        type: 'message_event',
        ...adjustedEventData
      });
    } else if (eventData.topicId) {
      adjustedEventData.messageType = 'normal';
      adjustedEventData.sourceType = 'topic';

      getTopicMembers(eventData.topicId).then(recipients => {
        if (!recipients.includes(eventData.userId)) {
          recipients.push(eventData.userId);
        }
        broadcastToRecipients(recipients, {
          type: 'message_event',
          ...adjustedEventData
        });
      }).catch(err => {
        console.error("获取话题成员事件失败:", err);
      });
    } else {
      adjustedEventData.messageType = 'normal';
      adjustedEventData.sourceType = 'chatroom';

      let recipients = [];
      clients.forEach((client) => {
        if (client.userId) {
          recipients.push(client.userId);
        }
      });

      broadcastToRecipients(recipients, {
        type: 'message_event',
        ...adjustedEventData
      });
    }
  });
}

// 零拷贝消息路由缓存
const messagePayloadCache = new NodeCache({ stdTTL: 5 }); // 缓存5秒

// 获取序列化后的消息Payload
function getSerializedMessage(messageData, userId) {
  const isSelf = messageData.user_id === userId || messageData.sender_id === userId;
  const cacheKey = `${messageData.id || JSON.stringify(messageData)}-${isSelf ? 'self' : 'other'}`;
  let cached = messagePayloadCache.get(cacheKey);

  if (!cached) {
    const enriched = {
      ...messageData,
      isSelf: isSelf
    };
    cached = JSON.stringify(enriched);
    messagePayloadCache.set(cacheKey, cached);
  }

  return cached;
}

// 辅助函数：向接收者分批广播消息
function broadcastToRecipients(recipients, messageData) {
  console.log(`消息接收者: ${recipients.join(', ')}`);

  // 先按 WebSocket 连接分组
  const connectionsByUser = new Map();
  clients.forEach((client) => {
    if (client[kUserId]) {
      connectionsByUser.set(client[kUserId], client);
    }
  });

  // 批量打包
  const batches = [];
  for (const userId of recipients) {
    const userIdNum = parseInt(userId);
    if (isNaN(userIdNum) || userIdNum <= 0) {
      console.warn(`跳过无效的用户ID: ${userId}`);
      continue;
    }

    const client = connectionsByUser.get(userIdNum);

    // 生成Payload和收件箱Topic
    const inboxTopic = generateUserInboxTopic(userIdNum);
    const payload = getSerializedMessage(messageData, userIdNum);

    if (client && client.readyState === 1 /* OPEN */) { // client.OPEN
      batches.push({
        client,
        topic: inboxTopic,
        payload
      });
    } else {
      // 客户端不在线或者是被 LRU 驱逐等情况时依然走旧流程来触达订阅（如果依赖 wss 维护的订阅表的话）
      broadcastToWebSocketSubscribers(inboxTopic, payload);
    }
  }

  // 每 100 个一批发送（减少事件循环压力）
  const BATCH_SIZE = 100;
  for (let i = 0; i < batches.length; i += BATCH_SIZE) {
    const batch = batches.slice(i, i + BATCH_SIZE);
    setImmediate(() => {
      batch.forEach(({ client, topic, payload }) => {
        try {
          if (client.readyState === 1) {
            client.send(JSON.stringify({
              type: 'publish',
              topic,
              payload,
              qos: 1
            }));
          }
        } catch (e) {
          console.error(`发送批量消息时报错:`, e);
        }
      });
    });
  }
}

// 专门用于广播通知给特定用户
function broadcastNotificationToUser(userId, notificationData) {
  console.log(`发送通知给用户: ${userId}`);

  // 确保userId是有效的数字
  const userIdNum = parseInt(userId);
  if (isNaN(userIdNum) || userIdNum <= 0) {
    console.warn(`跳过无效的用户ID: ${userId}`);
    return;
  }

  // 添加时间戳
  const enrichedNotificationData = {
    ...notificationData,
    timestamp: time.now().toISOString(),
    createdAt: time.formatDatabaseTime()
  };

  const inboxTopic = generateUserInboxTopic(userIdNum);
  const payload = JSON.stringify(enrichedNotificationData);

  // 广播到WebSocket订阅者
  broadcastToWebSocketSubscribers(inboxTopic, payload);
  console.log(`通知已发送到用户 ${userIdNum} 的收件箱`);
}

// 生成用户收件箱主题（供外部调用）
function generateUserInboxTopicExport(userId) {
  return generateUserInboxTopic(userId);
}

// 获取在线用户数
function getOnlineUsersCount() {
  const uniqueUsers = new Set();
  clients.forEach(client => {
    if (client[kUserId]) uniqueUsers.add(client[kUserId]);
  });
  return uniqueUsers.size;
}

module.exports = {
  initMQTT,
  initInternalMQTT,
  broadcastMessage,
  broadcastMessageEvent,
  broadcastNotificationToUser, // 导出通知广播函数
  generateUserInboxTopic: generateUserInboxTopicExport, // 导出用户收件箱主题生成函数
  broadcastToOidcSession, // 导出OIDC广播函数
  invalidateTopicCache, // 导出缓存失效函数
  getOnlineUsersCount // 导出在线用户数统计函数
};

// 广播到OIDC会话
function broadcastToOidcSession(secureString, data) {
  if (!wss) return;

  const topic = `oidc/login/${secureString}`;
  const payload = JSON.stringify(data);

  broadcastToWebSocketSubscribers(topic, payload);
  console.log(`已向OIDC会话 ${secureString} 发送数据`);
}