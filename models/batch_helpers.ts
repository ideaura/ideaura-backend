import db from '../config/database.ts';
import time from '../utils/time.ts';

interface MessageData {
  id: number;
  content: string;
  created_at: string;
  messageTime: string;
  relativeTime: string;
  message_type: string;
  is_deleted: number;
  isEdited: boolean;
  isRecalled: boolean;
  senderId: number;
  senderName: string;
  senderAvatar: string;
  senderIsBot: boolean;
}

interface MentionData {
  userId: number;
  mentionType: string;
  username: string;
  avatarUrl: string | null;
}

export async function getQuotedMessageInfoBatch(messageIds: number[], isPrivate: boolean = false): Promise<Record<number, MessageData>> {
  if (!messageIds || messageIds.length === 0) return {};

  const table = isPrivate ? 'private_messages' : 'messages';
  const userIdField = isPrivate ? 'm.sender_id' : 'm.user_id';
  const placeholders = messageIds.map(() => '?').join(',');

  const rows = await db.all(
    `SELECT m.*, u.id as "senderId", u.username as "senderName", u.avatar_url as "senderAvatar", u.is_bot as "senderIsBot"
     FROM ${table} m JOIN users u ON ${userIdField} = u.id WHERE m.id IN (${placeholders})`,
    messageIds
  );

  const resultMap: Record<number, MessageData> = {};
  for (const row of rows) {
    resultMap[row.id as number] = {
      id: row.id as number,
      content: row.is_deleted ? '[消息已被撤回]' : (row.content as string),
      created_at: time.formatLocalTime(row.created_at as string),
      messageTime: time.formatMessageTime(row.created_at as string),
      relativeTime: time.getRelativeTime(row.created_at as string),
      message_type: (row.message_type as string) || 'normal',
      is_deleted: row.is_deleted === true ? 1 : 0,
      isEdited: !!row.updated_at,
      isRecalled: row.is_deleted === true,
      senderId: (row.senderId || row.senderid) as number,
      senderName: (row.senderName || row.sendername) as string,
      senderAvatar: (row.senderAvatar || row.senderavatar) as string,
      senderIsBot: row.senderIsBot === true || row.senderIsBot === 1 || row.senderisbot === true || row.senderisbot === 1
    };
  }
  return resultMap;
}

export async function getMessageVersionsBatch(messageIds: number[], isPrivate: boolean = false): Promise<Record<number, Record<string, unknown>[]>> {
  if (!messageIds || messageIds.length === 0) return {};

  const messageType = isPrivate ? 'private' : 'public';
  const placeholders = messageIds.map(() => '?').join(',');

  const rows = await db.all(
    `SELECT * FROM message_versions WHERE message_id IN (${placeholders}) AND message_type = ? ORDER BY message_id, created_at DESC`,
    [...messageIds, messageType]
  );

  const resultMap: Record<number, Record<string, unknown>[]> = {};
  for (const id of messageIds) resultMap[id] = [];
  for (const row of rows) {
    const mid = row.message_id as number;
    if (!resultMap[mid]) resultMap[mid] = [];
    resultMap[mid].push({ ...row, created_at: time.formatLocalTime(row.created_at as string) });
  }
  return resultMap;
}

export async function getMessageMentionsBatch(messageIds: number[]): Promise<Record<number, MentionData[]>> {
  if (!messageIds || messageIds.length === 0) return {};

  const placeholders = messageIds.map(() => '?').join(',');

  const rows = await db.all(
    `SELECT m.message_id, m.user_id, m.mention_type, u.username as "username", u.avatar_url as "avatarUrl"
     FROM message_mentions m LEFT JOIN users u ON m.user_id = u.id WHERE m.message_id IN (${placeholders})`,
    messageIds
  );

  const resultMap: Record<number, MentionData[]> = {};
  for (const id of messageIds) resultMap[id] = [];
  for (const row of rows) {
    const mid = row.message_id as number;
    if (!resultMap[mid]) resultMap[mid] = [];
    resultMap[mid].push({
      userId: row.user_id as number,
      mentionType: row.mention_type as string,
      username: row.username as string,
      avatarUrl: row.avatarUrl as string | null
    });
  }
  return resultMap;
}

export async function getMergedForwardedMessagesBatch(forwardedMessageIds: number[]): Promise<Record<number, MessageData[]>> {
  if (!forwardedMessageIds || forwardedMessageIds.length === 0) return {};

  const placeholders = forwardedMessageIds.map(() => '?').join(',');

  const rows = await db.all(
    `SELECT forwarded_message_id, original_message_id, message_type
     FROM forwarded_messages WHERE forwarded_message_id IN (${placeholders}) ORDER BY forwarded_message_id, id`,
    forwardedMessageIds
  );

  const publicOriginalIds = new Set<number>();
  const privateOriginalIds = new Set<number>();
  const mapping: Record<number, { originalId: number; type: string }[]> = {};

  for (const row of rows) {
    const fwdId = row.forwarded_message_id as number;
    if (!mapping[fwdId]) mapping[fwdId] = [];
    mapping[fwdId].push({ originalId: row.original_message_id as number, type: row.message_type as string });

    if (row.message_type === 'private') {
      privateOriginalIds.add(row.original_message_id as number);
    } else {
      publicOriginalIds.add(row.original_message_id as number);
    }
  }

  const [publicData, privateData] = await Promise.all([
    publicOriginalIds.size > 0 ? getQuotedMessageInfoBatch([...publicOriginalIds], false) : Promise.resolve({}),
    privateOriginalIds.size > 0 ? getQuotedMessageInfoBatch([...privateOriginalIds], true) : Promise.resolve({})
  ]);

  const resultMap: Record<number, MessageData[]> = {};
  for (const fwdId of forwardedMessageIds) {
    const originals = mapping[fwdId] || [];
    resultMap[fwdId] = [];
    for (const orig of originals) {
      const data = orig.type === 'private' ? privateData[orig.originalId] : publicData[orig.originalId];
      if (data) resultMap[fwdId].push(data);
    }
  }
  return resultMap;
}
