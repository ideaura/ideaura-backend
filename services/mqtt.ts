// services/mqtt.ts — Bun-only WebSocket + MQTT over WS
import { LRUCache } from 'lru-cache';
import crypto from 'node:crypto';
import db from '../config/database.ts';
import appState from '../utils/AppState.ts';
import time from '../utils/time.ts';
import { verifyJWT } from '../utils/tokens.ts';
import * as redis from '../utils/redis.ts';

const config = await import('../config/index.ts');
const cfg = config.default;

// Redis cache key prefixes
const CACHE_TOPIC_MEMBERS = 'mqtt:topic:members:';
const CACHE_USER_INBOX = 'mqtt:inbox:';
const CACHE_MSG_PAYLOAD = 'mqtt:msg:';

// WebSocket OPEN state constant
const WS_OPEN = 1;

// Symbols for metadata
const kLastActivity = Symbol('lastActivity');
const kUserId = Symbol('userId');

// Inverted indexes
const userIdToClients = new Map<number, Set<WebSocket>>();
const topicToClients = new Map<string, Set<WebSocket>>();

// Extend WebSocket with metadata via declaration merging
interface WsMeta {
  clientId: string;
  [kLastActivity]: number;
  [kUserId]: number | null;
  subscribedTopics: string[];
  userId?: number;
  isBot?: boolean;
  botTokenId?: number;
  oidcSessionId?: string;
}

type WsWithMeta = WebSocket & WsMeta;

function safeClose(client: WsWithMeta): void {
  try {
    if (typeof (client as unknown as { terminate?: () => void }).terminate === 'function') {
      (client as unknown as { terminate: () => void }).terminate();
    } else if (typeof (client as unknown as { close?: () => void }).close === 'function') {
      (client as unknown as { close: () => void }).close();
    }
  } catch (e) { console.debug('[mqtt] safeClose 失败:', (e as Error).message); }
}

function removeUserAssociation(ws: WsWithMeta): void {
  if (!ws) return;
  const uid = ws[kUserId];
  if (uid) {
    const wsSet = userIdToClients.get(uid);
    if (wsSet) { wsSet.delete(ws); if (wsSet.size === 0) userIdToClients.delete(uid); }
  }
  if (ws.subscribedTopics) {
    for (const topic of ws.subscribedTopics) {
      const wsSet = topicToClients.get(topic);
      if (wsSet) { wsSet.delete(ws); if (wsSet.size === 0) topicToClients.delete(topic); }
    }
  }
}

function associateUser(ws: WsWithMeta, userId: number): void {
  const userIdNum = typeof userId === 'number' ? userId : parseInt(String(userId));
  if (isNaN(userIdNum) || userIdNum <= 0) return;

  if (ws[kUserId] && ws[kUserId] !== userIdNum) removeUserAssociation(ws);

  ws.userId = userIdNum;
  ws[kUserId] = userIdNum;

  let wsSet = userIdToClients.get(userIdNum);
  if (!wsSet) { wsSet = new Set(); userIdToClients.set(userIdNum, wsSet); }
  wsSet.add(ws);
}

// LRU cache for clients (max 50k)
const clients = new LRUCache<string, WsWithMeta>({
  max: 50000,
  ttl: 1000 * 60 * 60,
  dispose: (client: WsWithMeta) => {
    try { removeUserAssociation(client); if (client.readyState === WS_OPEN) safeClose(client); } catch (e) { console.debug('[mqtt] LRU dispose 错误:', (e as Error).message); }
  }
});

const HEARTBEAT_TIMEOUT = cfg.mqtt?.heartbeatTimeout || 90000;
const CHECK_INTERVAL = cfg.mqtt?.checkInterval || 30000;

// ── Cached helpers ──
async function generateUserInboxTopic(userId: number): Promise<string> {
  const cacheKey = `${CACHE_USER_INBOX}${userId}`;
  let topic = await redis.get(cacheKey);
  if (topic) return topic;

  const hash = crypto.createHmac('sha256', cfg.mqtt?.inboxSecret || cfg.jwtSecret || 'fmc-inbox-default')
    .update(`user-inbox-${userId}`).digest('hex');
  topic = `${cfg.mqtt.topic}/inbox/${hash}`;
  await redis.set(cacheKey, topic, 300);
  return topic;
}

async function getTopicMembers(topicId: number): Promise<number[]> {
  const cacheKey = `${CACHE_TOPIC_MEMBERS}${topicId}`;
  let members = await redis.getJson<number[]>(cacheKey);
  if (members) return members;

  const rows = await db.all<{ user_id: number }>("SELECT user_id FROM topic_members WHERE topic_id = ?", [topicId]);
  members = rows.map(r => r.user_id);
  await redis.setJson(cacheKey, members, 60);
  return members;
}

async function invalidateTopicCache(topicId: number): Promise<void> {
  await redis.del(`${CACHE_TOPIC_MEMBERS}${topicId}`);
}

// ── Client lifecycle ──
function createClientConnection(ws: WsWithMeta): string {
  const clientId = time.nowMs() + '-' + Math.random().toString(36).substr(2, 9);
  ws.clientId = clientId;
  ws[kLastActivity] = time.nowMs();
  ws[kUserId] = null;
  ws.subscribedTopics = [];
  clients.set(clientId, ws);
  return clientId;
}

async function handleClientDisconnect(ws: WsWithMeta): Promise<void> {
  console.log('WebSocket客户端断开连接');
  const userId = ws[kUserId];
  const clientId = ws.clientId;
  const hadInbox = userId && ws.subscribedTopics && ws.subscribedTopics.includes(await generateUserInboxTopic(userId));
  clients.delete(clientId);
  if (hadInbox && !(await isUserOnline(userId!))) {
    notifyFriendPresence(userId!, 'offline');
  }
}

// ── Message handling ──
async function handleWebSocketMessage(ws: WsWithMeta, rawMessage: Buffer | string): Promise<void> {
  ws[kLastActivity] = time.nowMs();
  const rawStr = typeof rawMessage === 'string' ? rawMessage : rawMessage.toString();

  try {
    // Simple JSON.parse (no worker_threads in Bun — JSON parsing is fast enough)
    const packet = JSON.parse(rawStr);

    switch (packet.type) {
      case 'connect':
        await handleConnect(ws, packet);
        break;
      case 'subscribe':
        await handleSubscribe(ws, packet);
        break;
      case 'publish':
        await handlePublish(ws, packet);
        break;
      case 'pingreq':
        ws.send(JSON.stringify({ type: 'pingresp' }));
        break;
      default:
        console.warn('未知的消息类型:', packet.type);
        if (packet.type !== 'connect' && !ws.userId && !ws.oidcSessionId) {
          ws.send(JSON.stringify({ type: 'error', message: '未认证的用户无法执行此操作', code: 401 }));
        }
    }
  } catch (e) {
    // JSON parse failed — try raw token auth
    console.debug('[mqtt] JSON解析失败, 尝试原始token认证:', (e as Error).message);
    await handleRawAuth(ws, rawStr);
  }
}

async function handleConnect(ws: WsWithMeta, packet: { token?: string }): Promise<void> {
  let isAuthenticated = false;
  let userId: number | null = null;

  if (packet.token) {
    if (typeof packet.token === 'string' && packet.token.startsWith('bot-token-')) {
      try {
        const botTokenRow = await db.get<{ bot_id: number }>('SELECT bot_id FROM bot_tokens WHERE token = ?', [packet.token]);
        if (botTokenRow) {
          const botUser = await db.get<{ id: number; is_bot: boolean }>('SELECT id, is_bot FROM users WHERE id = ? AND is_bot = true', [botTokenRow.bot_id]);
          if (botUser) {
            userId = botUser.id;
            isAuthenticated = true;
            associateUser(ws, userId);
            ws.isBot = true;
            ws.botTokenId = botTokenRow.bot_id;
            console.log(`🤖 机器人 ${userId} 通过 Bot Token 认证成功`);
          }
        }
      } catch (e) { console.error('Bot token 认证失败:', e); }
    } else {
      try {
        const user = verifyJWT(packet.token);
        userId = user.id;
        isAuthenticated = true;
        associateUser(ws, userId);
        ws.isBot = false;
        console.log(`用户 ${userId} JWT 认证成功`);
      } catch (e) {
        console.debug('[mqtt] JWT验证失败, 尝试OIDC会话:', (e as Error).message);
        if (await appState.hasOidc(packet.token)) {
          ws.oidcSessionId = packet.token;
          isAuthenticated = true;
          console.log(`OIDC预登录会话连接成功: ${packet.token.substring(0, 8)}...`);
        }
      }
    }
  }

  ws.send(JSON.stringify({ type: 'connack', returnCode: isAuthenticated ? 0 : 1 }));
}

async function handleSubscribe(ws: WsWithMeta, packet: { messageId?: number; topics?: string[] }): Promise<void> {
  if (!ws.userId && !ws.oidcSessionId) {
    ws.send(JSON.stringify({ type: 'suback', messageId: packet.messageId, granted: (packet.topics || []).map(() => 0) }));
    return;
  }

  ws.subscribedTopics = ws.subscribedTopics || [];
  const granted: number[] = [];

  if (ws.userId) {
    const userInboxTopic = await generateUserInboxTopic(ws.userId);
    const wasOnline = await isUserOnline(ws.userId);

    (packet.topics || []).forEach(topic => {
      if (topic === userInboxTopic) {
        ws.subscribedTopics.push(topic);
        granted.push(1);
        let wsSet = topicToClients.get(topic);
        if (!wsSet) { wsSet = new Set(); topicToClients.set(topic, wsSet); }
        wsSet.add(ws);
      } else {
        granted.push(0);
      }
    });

    if (!wasOnline && await isUserOnline(ws.userId)) {
      notifyFriendPresence(ws.userId, 'online');
    }
  } else if (ws.oidcSessionId) {
    const oidcTopic = `oidc/login/${ws.oidcSessionId}`;
    (packet.topics || []).forEach(topic => {
      if (topic === oidcTopic) {
        ws.subscribedTopics.push(topic);
        granted.push(1);
        let wsSet = topicToClients.get(topic);
        if (!wsSet) { wsSet = new Set(); topicToClients.set(topic, wsSet); }
        wsSet.add(ws);
      } else {
        granted.push(0);
      }
    });
    console.log(`OIDC预登录会话 ${ws.oidcSessionId} 订阅了频道: ${oidcTopic}`);
  }

  ws.send(JSON.stringify({ type: 'suback', messageId: packet.messageId, granted }));
}

async function handlePublish(ws: WsWithMeta, packet: { topic?: string; payload?: unknown }): Promise<void> {
  if (ws.oidcSessionId && packet.topic === `oidc/verify/${ws.oidcSessionId}`) {
    const sessionData = await appState.getOidc<{ authString?: string; isVerified?: boolean }>(ws.oidcSessionId);
    if (sessionData && sessionData.authString === packet.payload) {
      sessionData.isVerified = true;
      await appState.setOidc(ws.oidcSessionId, sessionData);
      console.log(`OIDC会话 ${ws.oidcSessionId} 已通过WebSocket认证`);
    } else {
      console.warn(`OIDC会话 ${ws.oidcSessionId} 认证失败`);
    }
  } else {
    console.warn('客户端尝试发布消息，但客户端不应直接发布消息');
  }
}

async function handleRawAuth(ws: WsWithMeta, rawStr: string): Promise<void> {
  let isAuthenticated = false;
  try {
    if (rawStr.split('.').length === 3) {
      const user = verifyJWT(rawStr);
      associateUser(ws, user.id);
      ws.isBot = false;
      isAuthenticated = true;
      console.log(`用户 ${user.id} 通过直接token认证成功`);
    }
  } catch (e) {
    console.debug('[mqtt] 直接token验证失败, 尝试OIDC:', (e as Error).message);
    if (await appState.hasOidc(rawStr)) {
      ws.oidcSessionId = rawStr;
      isAuthenticated = true;
      console.log(`OIDC预登录会话连接成功: ${rawStr.substring(0, 8)}...`);
    }
  }
  ws.send(JSON.stringify({ type: 'connack', returnCode: isAuthenticated ? 0 : 1 }));
}

// ── Heartbeat ──
let heartbeatTimerId: ReturnType<typeof setInterval> | null = null;
let heartbeatStarted = false;

function startHeartbeatCheck(): void {
  if (heartbeatStarted) return;
  heartbeatStarted = true;

  heartbeatTimerId = setInterval(async () => {
    const now = time.nowMs();
    const timeoutTime = now - HEARTBEAT_TIMEOUT;

    for (const [id, client] of clients.entries()) {
      if (client[kLastActivity] < timeoutTime) {
        console.log(`客户端 ${id} 心跳超时，强制断开`);
        const uid = client[kUserId];
        const hadInbox = uid && client.subscribedTopics && client.subscribedTopics.includes(await generateUserInboxTopic(uid));
        clients.delete(id);
        safeClose(client);
        if (hadInbox && !(await isUserOnline(uid!))) {
          notifyFriendPresence(uid!, 'offline');
        }
      }
    }
  }, CHECK_INTERVAL);

  console.log('❤️  全局心跳检查已启动');
}

// ── Bun WebSocket config ──
function getBunWebSocketConfig() {
  startHeartbeatCheck();

  return {
    open(ws: WebSocket) {
      console.log('新的WebSocket客户端连接 (Bun)');
      createClientConnection(ws as WsWithMeta);
    },
    async message(ws: WebSocket, message: string | Buffer) {
      const rawMessage = typeof message === 'string' ? Buffer.from(message) : Buffer.from(message);
      await handleWebSocketMessage(ws as WsWithMeta, rawMessage);
    },
    async close(ws: WebSocket) {
      await handleClientDisconnect(ws as WsWithMeta);
    }
  };
}

// ── Broadcasting ──
function broadcastToWebSocketSubscribers(topic: string, message: string): void {
  const wsSet = topicToClients.get(topic);
  if (!wsSet) return;
  for (const client of wsSet) {
    if (client.readyState === WS_OPEN) {
      try { client.send(JSON.stringify({ type: 'publish', topic, payload: message, qos: 1 })); } catch (e) { console.debug('[mqtt] 广播失败:', (e as Error).message); }
    }
  }
}

async function broadcastMessage(messageData: Record<string, unknown>): Promise<void> {
  const adjusted = { ...messageData };

  if (adjusted.content && typeof adjusted.content === 'string') {
    const subtype = adjusted.message_subtype || adjusted.messageSubtype;
    if (subtype !== 'html' && subtype !== 'markdown') {
      adjusted.content = (adjusted.content as string).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }
  }
  if (adjusted.is_deleted !== undefined) adjusted.is_deleted = adjusted.is_deleted === true ? 1 : 0;
  if (adjusted.messageType && !adjusted.message_type) adjusted.message_type = adjusted.messageType;
  if (adjusted.messageSubtype && !adjusted.message_subtype) adjusted.message_subtype = adjusted.messageSubtype;
  if (adjusted.sourceType && !adjusted.source_type) adjusted.source_type = adjusted.sourceType;

  if (adjusted.messageType === 'private' || adjusted.source_type === 'private') {
    adjusted.source_type = 'private';
    const recipients = [adjusted.sender_id, adjusted.receiver_id] as number[];
    setImmediate(async () => { try { await broadcastToRecipients(recipients, adjusted); } catch (e) { console.error('[mqtt] 私聊广播失败:', (e as Error).message); } });
  } else if (adjusted.topic_id) {
    adjusted.source_type = 'topic';
    setImmediate(async () => {
      try {
        const recipients = await getTopicMembers(adjusted.topic_id as number);
        if (!recipients.includes(adjusted.user_id as number)) recipients.push(adjusted.user_id as number);
        await broadcastToRecipients(recipients, adjusted);
      } catch (e) { console.error('[mqtt] 话题广播失败:', (e as Error).message); }
    });
  } else {
    adjusted.source_type = 'chatroom';
    setImmediate(async () => {
      try {
        const recipients = Array.from(userIdToClients.keys());
        if (!recipients.includes(adjusted.user_id as number)) recipients.push(adjusted.user_id as number);
        await broadcastToRecipients(recipients, adjusted);
      } catch (e) { console.error('[mqtt] 公共广播失败:', (e as Error).message); }
    });
  }
}

async function broadcastToRecipients(recipientIds: number[], messageData: Record<string, unknown>): Promise<void> {
  if (!recipientIds || recipientIds.length === 0) return;
  if (userIdToClients.size === 0) return;

  const batches: { client: WsWithMeta; topic: string; payload: string }[] = [];

  for (const userId of recipientIds) {
    const userIdNum = typeof userId === 'number' ? userId : parseInt(String(userId));
    if (isNaN(userIdNum) || userIdNum <= 0) continue;

    const userClients = userIdToClients.get(userIdNum);
    const inboxTopic = await generateUserInboxTopic(userIdNum);
    const payload = JSON.stringify({ ...messageData, receiver_id: userIdNum, timestamp: time.now().toISOString(), createdAt: time.formatDatabaseTime() });

    if (userClients && userClients.size > 0) {
      for (const client of userClients) {
        if (client.readyState === WS_OPEN) batches.push({ client, topic: inboxTopic, payload });
      }
    } else {
      broadcastToWebSocketSubscribers(inboxTopic, payload);
    }
  }

  const BATCH_SIZE = 100;
  for (let i = 0; i < batches.length; i += BATCH_SIZE) {
    const batch = batches.slice(i, i + BATCH_SIZE);
    setImmediate(() => {
      for (const { client, topic, payload } of batch) {
        try {
          if (client.readyState === WS_OPEN) client.send(JSON.stringify({ type: 'publish', topic, payload, qos: 1 }));
        } catch (e) { console.debug('[mqtt] 批量发送失败:', (e as Error).message); }
      }
    });
  }
}

async function broadcastNotificationToUser(userId: number, notificationData: Record<string, unknown>): Promise<void> {
  const userIdNum = typeof userId === 'number' ? userId : parseInt(String(userId));
  if (isNaN(userIdNum) || userIdNum <= 0) return;

  const inboxTopic = await generateUserInboxTopic(userIdNum);
  const payload = JSON.stringify({ ...notificationData, timestamp: time.now().toISOString(), createdAt: time.formatDatabaseTime() });
  broadcastToWebSocketSubscribers(inboxTopic, payload);
}

async function isUserOnline(userId: number): Promise<boolean> {
  const userIdNum = typeof userId === 'number' ? userId : parseInt(String(userId));
  if (isNaN(userIdNum) || userIdNum <= 0) return false;

  const inboxTopic = await generateUserInboxTopic(userIdNum);
  const userClients = userIdToClients.get(userIdNum);
  if (!userClients) return false;

  for (const client of userClients) {
    if (client.readyState === WS_OPEN && client.subscribedTopics && client.subscribedTopics.includes(inboxTopic)) return true;
  }
  return false;
}

async function getOnlineUserIdsSet(): Promise<Set<number>> {
  const onlineSet = new Set<number>();
  for (const [userId, userClients] of userIdToClients.entries()) {
    const inboxTopic = await generateUserInboxTopic(userId);
    for (const client of userClients) {
      if (client.readyState === WS_OPEN && client.subscribedTopics && client.subscribedTopics.includes(inboxTopic)) {
        onlineSet.add(userId); break;
      }
    }
  }
  return onlineSet;
}

async function getOnlineUsersCount(): Promise<number> {
  return (await getOnlineUserIdsSet()).size;
}

async function getAcceptedFriendIds(userId: number): Promise<number[]> {
  const rows = await db.all<{ friend_id: number }>(
    `SELECT CASE WHEN user1_id = ? THEN user2_id ELSE user1_id END AS friend_id
     FROM friends WHERE (user1_id = ? OR user2_id = ?) AND status = 'accepted'`,
    [userId, userId, userId]
  );
  return rows.map(r => r.friend_id);
}

async function notifyFriendPresence(userId: number, status: 'online' | 'offline'): Promise<void> {
  const userIdNum = typeof userId === 'number' ? userId : parseInt(String(userId));
  if (isNaN(userIdNum) || userIdNum <= 0) return;

  setImmediate(async () => {
    try {
      const friendIds = await getAcceptedFriendIds(userIdNum);
      if (!friendIds || friendIds.length === 0) return;

      const user = await db.get<{ id: number; username: string; avatar_url: string | null }>('SELECT id, username, avatar_url FROM users WHERE id = ?', [userIdNum]);
      if (!user) return;

      const onlineSet = await getOnlineUserIdsSet();
      const eventType = status === 'online' ? 'friend_online' : 'friend_offline';

      for (const friendId of friendIds) {
        if (!onlineSet.has(friendId)) continue;
        await broadcastNotificationToUser(friendId, {
          type: 'friend_presence', eventType, friendId: user.id, friendName: user.username, friendAvatar: user.avatar_url || null
        });
      }
    } catch (e) { console.debug('[mqtt] 好友通知失败:', (e as Error).message); }
  });
}

function broadcastToOidcSession(secureString: string, data: unknown): void {
  const topic = `oidc/login/${secureString}`;
  const payload = JSON.stringify(data);
  broadcastToWebSocketSubscribers(topic, payload);
}

async function broadcastMessageEvent(messageData: Record<string, unknown>): Promise<void> {
  return broadcastMessage(messageData);
}

export {
  broadcastMessage,
  broadcastMessageEvent,
  broadcastNotificationToUser,
  broadcastToOidcSession,
  generateUserInboxTopic as generateUserInboxTopic,
  invalidateTopicCache,
  getOnlineUsersCount,
  isUserOnline,
  getOnlineUserIdsSet,
  getBunWebSocketConfig,
};
