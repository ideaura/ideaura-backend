const config = require('../config');
const crypto = require('crypto');
const { verifyJWT } = require('../utils/tokens');

let wss = null; // WebSocket服务器
let clients = new Map(); // 存储WebSocket客户端连接

// 生成用户收件箱主题
function generateUserInboxTopic(userId) {
  // 使用HMAC生成安全的用户收件箱主题名称
  const hash = crypto
    .createHmac('sha256', config.jwtSecret || 'default-secret')
    .update(`user-inbox-${userId}`)
    .digest('hex');
  
  return `${config.mqtt.topic}/inbox/${hash}`;
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
        const clientId = Date.now() + '-' + Math.random().toString(36).substr(2, 9);
        clients.set(clientId, ws);
        
        ws.on('message', (message) => {
          try {
            // 解析MQTT over WebSocket消息
            const packet = JSON.parse(message);
            
            // 处理不同类型的MQTT包
            switch(packet.type) {
              case 'connect':
                // 处理连接请求，需要JWT认证
                let isAuthenticated = false;
                let userId = null;
                
                // 检查是否有JWT token
                if (packet.token) {
                  try {
                    const user = verifyJWT(packet.token);
                    userId = user.id;
                    isAuthenticated = true;
                    ws.userId = userId; // 保存用户ID
                    console.log(`用户 ${userId} 认证成功`);
                  } catch (error) {
                    console.error('JWT验证失败:', error);
                  }
                }
                
                ws.send(JSON.stringify({
                  type: 'connack',
                  returnCode: isAuthenticated ? 0 : 1 // 0表示成功，1表示认证失败
                }));
                break;
                
              case 'subscribe':
                // 处理订阅请求，需要认证
                if (!ws.userId) {
                  // 未认证用户不能订阅
                  ws.send(JSON.stringify({
                    type: 'suback',
                    messageId: packet.messageId,
                    granted: packet.topics ? packet.topics.map(() => 0) : [] // 0表示拒绝
                  }));
                  break;
                }
                
                // 验证用户只能订阅自己的收件箱
                const userInboxTopic = generateUserInboxTopic(ws.userId);
                const validTopics = packet.topics.filter(topic => topic === userInboxTopic);
                
                ws.subscribedTopics = ws.subscribedTopics || [];
                if (validTopics.length > 0) {
                  ws.subscribedTopics.push(...validTopics);
                }
                
                // 对于每个请求的主题，如果有效则返回1，否则返回0
                const granted = packet.topics.map(topic => validTopics.includes(topic) ? 1 : 0);
                
                ws.send(JSON.stringify({
                  type: 'suback',
                  messageId: packet.messageId,
                  granted: granted
                }));
                break;
                
              case 'publish':
                // 处理发布消息 - 这里我们不处理客户端发布的消息
                // 所有消息都应通过服务器端的broadcastMessage函数发送
                console.warn('客户端尝试发布消息，但客户端不应直接发布消息');
                break;
                
              case 'pingreq':
                // 处理心跳
                ws.send(JSON.stringify({
                  type: 'pingresp'
                }));
                break;
            }
          } catch (error) {
            console.error('处理WebSocket消息错误:', error);
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
  // 发送到WebSocket客户端
  // 根据消息类型确定接收者
  if (messageData.messageType === 'private') {
    // 私聊消息发送给发送者和接收者
    const recipients = [messageData.sender_id, messageData.receiver_id];
    console.log(`私聊消息: sender_id=${messageData.sender_id}, receiver_id=${messageData.receiver_id}`);
    broadcastToRecipients(recipients, messageData);
  } else if (messageData.topic_id) {
    // 话题消息发送给话题的所有成员
    console.log(`话题消息: topic_id=${messageData.topic_id}, user_id=${messageData.user_id}`);
    
    // 获取话题成员列表
    const db = require('../config/database');
    db.all(
      "SELECT user_id FROM topic_members WHERE topic_id = ?",
      [messageData.topic_id],
      (err, rows) => {
        let recipients = [];
        if (err) {
          console.error("获取话题成员失败:", err);
          // 出错时至少发送给消息发送者
          recipients = [messageData.user_id];
        } else {
          recipients = rows.map(row => row.user_id);
          console.log(`话题成员: ${recipients.join(', ')}`);
          
          // 确保话题创建者也能收到消息
          if (!recipients.includes(messageData.user_id)) {
            recipients.push(messageData.user_id);
          }
        }
        
        broadcastToRecipients(recipients, messageData);
      }
    );
  } else {
    // 公共消息发送给所有在线用户
    console.log(`公共消息: user_id=${messageData.user_id}`);
    
    // 获取所有在线用户
    let recipients = [];
    clients.forEach((client) => {
      if (client.userId) {
        recipients.push(client.userId);
      }
    });
    
    // 至少发送给消息发送者
    if (!recipients.includes(messageData.user_id)) {
      recipients.push(messageData.user_id);
    }
    
    // 去重
    recipients = [...new Set(recipients)];
    
    broadcastToRecipients(recipients, messageData);
  }
}

// 广播消息操作事件（撤回、编辑、转发等）
function broadcastMessageEvent(eventData) {
  // eventData 应包含 eventType, messageId, userId, 和其他相关信息
  console.log(`广播消息事件: ${eventData.eventType}, messageId=${eventData.messageId}`);
  
  // 为事件添加时间戳
  eventData.timestamp = new Date().toISOString();
  
  // 根据事件类型确定接收者
  if (eventData.messageType === 'private') {
    // 私聊消息事件发送给相关用户
    const recipients = [eventData.userId, eventData.targetUserId];
    broadcastToRecipients(recipients, {
      type: 'message_event',
      ...eventData
    });
  } else if (eventData.topicId) {
    // 话题消息事件发送给话题成员
    const db = require('../config/database');
    db.all(
      "SELECT user_id FROM topic_members WHERE topic_id = ?",
      [eventData.topicId],
      (err, rows) => {
        let recipients = [];
        if (!err) {
          recipients = rows.map(row => row.user_id);
          // 确保操作发起者也能收到事件
          if (!recipients.includes(eventData.userId)) {
            recipients.push(eventData.userId);
          }
        }
        
        broadcastToRecipients(recipients, {
          type: 'message_event',
          ...eventData
        });
      }
    );
  } else {
    // 公共消息事件发送给所有在线用户
    let recipients = [];
    clients.forEach((client) => {
      if (client.userId) {
        recipients.push(client.userId);
      }
    });
    
    broadcastToRecipients(recipients, {
      type: 'message_event',
      ...eventData
    });
  }
}

// 辅助函数：向接收者广播消息
function broadcastToRecipients(recipients, messageData) {
  console.log(`消息接收者: ${recipients.join(', ')}`);
  
  // 为每个接收者生成消息并发送到他们的收件箱
  for (const userId of recipients) {
    // 确保userId是有效的数字
    const userIdNum = parseInt(userId);
    if (isNaN(userIdNum) || userIdNum <= 0) {
      console.warn(`跳过无效的用户ID: ${userId}`);
      continue;
    }
    
    // 添加消息来源标识：是发送给自己还是他人
    const enrichedMessageData = {
      ...messageData,
      isSelf: messageData.user_id === userIdNum || messageData.sender_id === userIdNum
    };
    
    const inboxTopic = generateUserInboxTopic(userIdNum);
    const payload = JSON.stringify(enrichedMessageData);
    
    // 广播到WebSocket订阅者
    broadcastToWebSocketSubscribers(inboxTopic, payload);
    console.log(`消息已发送到用户 ${userIdNum} 的收件箱`);
  }
}

// 生成用户收件箱主题（供外部调用）
function generateUserInboxTopicExport(userId) {
  return generateUserInboxTopic(userId);
}

module.exports = { 
  initMQTT, 
  initInternalMQTT,
  broadcastMessage,
  broadcastMessageEvent,
  generateUserInboxTopic: generateUserInboxTopicExport // 导出用户收件箱主题生成函数
};