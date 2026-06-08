import db from '../config/database.ts';
import time from '../utils/time.ts';
import { getQuotedMessageInfoBatch, getMessageVersionsBatch, getMessageMentionsBatch, getMergedForwardedMessagesBatch } from './batch_helpers.ts';

class Message {
  static basicMessageTypes = ['text', 'image', 'video', 'file', 'markdown', 'html'] as const;

  static async create(messageData: {
    topic_id?: number | null;
    user_id: number;
    content: string;
    message_type?: string;
    message_subtype?: string;
    forward_source_id?: number | null;
    quoted_message_id?: number | null;
    file_url?: string | null;
    file_name?: string | null;
    file_size?: number | null;
    file_type?: string | null;
    source_type?: string;
    mentions?: { userId?: number; id?: number; type?: string; mentionType?: string }[];
    command_id?: string | null;
  }): Promise<number> {
    const { topic_id = null, user_id, content, message_type = 'normal', message_subtype = 'text',
      forward_source_id = null, quoted_message_id = null, file_url = null, file_name = null,
      file_size = null, file_type = null, source_type = 'chatroom', mentions = [], command_id = null } = messageData;

    const currentTime = time.currentDbString();
    const result = await db.run(
      "INSERT INTO messages (topic_id, user_id, content, created_at, message_type, message_subtype, source_type, forward_source_id, quoted_message_id, file_url, file_name, file_size, file_type, command_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id",
      [topic_id, user_id, content, currentTime, message_type, message_subtype, source_type, forward_source_id, quoted_message_id, file_url, file_name, file_size, file_type, command_id]
    );
    const newMsgId = result.lastID ?? 0;

    if (mentions.length > 0) {
      const mentionResults = await Promise.allSettled(
        mentions.map(m => db.run(
          "INSERT INTO message_mentions (message_id, topic_id, user_id, mention_type) VALUES (?, ?, ?, ?)",
          [newMsgId, topic_id, m.userId || m.id || null, m.type || m.mentionType || 'user']
        ))
      );
      const failed = mentionResults.filter(r => r.status === 'rejected');
      if (failed.length > 0) console.error(`Mention insert errors (${failed.length}/${mentionResults.length})`);
    }

    if (topic_id) {
      await db.run("UPDATE topics SET message_count = message_count + 1, last_activity = ? WHERE id = ?", [currentTime, topic_id]);
    }

    return newMsgId;
  }

  static async createPrivate(privateMessageData: {
    sender_id: number;
    receiver_id: number;
    content: string;
    message_type?: string;
    message_subtype?: string;
    forward_source_id?: number | null;
    quoted_message_id?: number | null;
    file_url?: string | null;
    file_name?: string | null;
    file_size?: number | null;
    file_type?: string | null;
    source_type?: string;
    command_id?: string | null;
  }): Promise<Record<string, unknown>> {
    const { sender_id, receiver_id, content, message_type = 'normal', message_subtype = 'text',
      forward_source_id = null, quoted_message_id = null, file_url = null, file_name = null,
      file_size = null, file_type = null, source_type = 'private', command_id = null } = privateMessageData;

    const currentTime = time.currentDbString();
    const result = await db.run(
      "INSERT INTO private_messages (sender_id, receiver_id, content, is_read, created_at, message_type, message_subtype, source_type, forward_source_id, quoted_message_id, file_url, file_name, file_size, file_type, command_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id",
      [sender_id, receiver_id, content, 0, currentTime, message_type, message_subtype, source_type, forward_source_id, quoted_message_id, file_url, file_name, file_size, file_type, command_id]
    );
    const messageId = result.lastID ?? 0;

    const row = await db.get(
      `SELECT pm.*, u1.username as "senderName", u1.avatar_url as "senderAvatar", u2.username as "receiverName", u2.avatar_url as "receiverAvatar"
       FROM private_messages pm JOIN users u1 ON pm.sender_id = u1.id JOIN users u2 ON pm.receiver_id = u2.id WHERE pm.id = ?`,
      [messageId]
    );

    if (row) {
      return { id: messageId, ...formatMessageRow(row) };
    }
    return { id: messageId };
  }

  static async findById(id: number): Promise<Record<string, unknown> | undefined> {
    const row = await db.get(
      `SELECT m.*, u.id as "senderId", u.username as "senderName", u.avatar_url as "senderAvatar", u.is_bot as "senderIsBot", t.name as "topicName"
       FROM messages m JOIN users u ON m.user_id = u.id LEFT JOIN topics t ON m.topic_id = t.id WHERE m.id = ?`,
      [id]
    );
    if (!row) return undefined;
    return formatMessageRow(row);
  }

  static async findByTopicId(topicId: number, limit: number = 50, before?: number): Promise<Record<string, unknown>[]> {
    let sql = `SELECT m.*, u.id as "senderId", u.username as "senderName", u.avatar_url as "senderAvatar", u.is_bot as "senderIsBot"
      FROM messages m JOIN users u ON m.user_id = u.id WHERE m.topic_id = ? AND m.is_deleted = false`;
    const params: unknown[] = [topicId];
    if (before) { sql += " AND m.id < ?"; params.push(before); }
    sql += " ORDER BY m.id DESC LIMIT ?";
    params.push(limit);
    const rows = await db.all(sql, params);
    return rows.map(formatMessageRow);
  }

  static async findByPrivateChat(senderId: number, receiverId: number, limit: number = 50, before?: number): Promise<Record<string, unknown>[]> {
    let sql = `SELECT pm.*, u1.username as "senderName", u1.avatar_url as "senderAvatar", u2.username as "receiverName", u2.avatar_url as "receiverAvatar"
      FROM private_messages pm JOIN users u1 ON pm.sender_id = u1.id JOIN users u2 ON pm.receiver_id = u2.id
      WHERE ((pm.sender_id = ? AND pm.receiver_id = ?) OR (pm.sender_id = ? AND pm.receiver_id = ?)) AND pm.is_deleted = false`;
    const params: unknown[] = [senderId, receiverId, receiverId, senderId];
    if (before) { sql += " AND pm.id < ?"; params.push(before); }
    sql += " ORDER BY pm.id DESC LIMIT ?";
    params.push(limit);
    const rows = await db.all(sql, params);
    return rows.map(formatMessageRow);
  }

  static async getPrivateConversations(userId: number): Promise<Record<string, unknown>[]> {
    const rows = await db.all(
      `SELECT DISTINCT ON (LEAST(pm.sender_id, pm.receiver_id), GREATEST(pm.sender_id, pm.receiver_id))
        pm.*, u1.username as "senderName", u1.avatar_url as "senderAvatar", u2.username as "receiverName", u2.avatar_url as "receiverAvatar"
       FROM private_messages pm JOIN users u1 ON pm.sender_id = u1.id JOIN users u2 ON pm.receiver_id = u2.id
       WHERE (pm.sender_id = ? OR pm.receiver_id = ?) ORDER BY LEAST(pm.sender_id, pm.receiver_id), GREATEST(pm.sender_id, pm.receiver_id), pm.id DESC`,
      [userId, userId]
    );
    return rows.map(formatMessageRow);
  }

  static async markAsRead(messageId: number, userId: number): Promise<void> {
    await db.run("UPDATE private_messages SET is_read = true WHERE id = ? AND receiver_id = ?", [messageId, userId]);
  }

  static async getUnreadCount(userId: number): Promise<number> {
    const row = await db.get<{ count: string }>(
      "SELECT COUNT(*) as count FROM private_messages WHERE receiver_id = ? AND is_read = false",
      [userId]
    );
    return row ? parseInt(row.count) : 0;
  }

  static async updateMessage(messageId: number, userId: number, content: string): Promise<Record<string, unknown> | undefined> {
    await db.run("INSERT INTO message_versions (message_id, content, message_type) VALUES (?, ?, 'public')", [messageId, content]);
    await db.run("UPDATE messages SET content = ?, updated_at = ? WHERE id = ? AND user_id = ?", [content, time.currentDbString(), messageId, userId]);
    return Message.findById(messageId);
  }

  static async deleteMessage(messageId: number, userId: number): Promise<{ changes: number }> {
    const currentTime = time.currentDbString();
    const result = await db.run(
      "UPDATE messages SET is_deleted = true, deleted_at = ? WHERE id = ? AND user_id = ?",
      [currentTime, messageId, userId]
    );
    return { changes: result.changes };
  }

  static async deletePrivateMessage(messageId: number, userId: number): Promise<{ changes: number }> {
    const currentTime = time.currentDbString();
    const result = await db.run(
      "UPDATE private_messages SET is_deleted = true, deleted_at = ? WHERE id = ? AND sender_id = ?",
      [currentTime, messageId, userId]
    );
    return { changes: result.changes };
  }

  static async findPrivateById(id: number): Promise<Record<string, unknown> | undefined> {
    const row = await db.get(
      `SELECT pm.*, u1.username as "senderName", u1.avatar_url as "senderAvatar", u2.username as "receiverName", u2.avatar_url as "receiverAvatar"
       FROM private_messages pm JOIN users u1 ON pm.sender_id = u1.id JOIN users u2 ON pm.receiver_id = u2.id WHERE pm.id = ?`,
      [id]
    );
    return row ? formatMessageRow(row) : undefined;
  }

  static async getLatestMessageByTopic(topicId: number): Promise<Record<string, unknown> | undefined> {
    const row = await db.get(
      `SELECT m.*, u.id as "senderId", u.username as "senderName", u.avatar_url as "senderAvatar"
       FROM messages m JOIN users u ON m.user_id = u.id WHERE m.topic_id = ? AND m.is_deleted = false ORDER BY m.id DESC LIMIT 1`,
      [topicId]
    );
    return row ? formatMessageRow(row) : undefined;
  }

  static async getMessageCount(topicId: number): Promise<number> {
    const row = await db.get<{ count: string }>(
      "SELECT COUNT(*) as count FROM messages WHERE topic_id = ? AND is_deleted = false",
      [topicId]
    );
    return row ? parseInt(row.count) : 0;
  }

  static async updateUserMessageRead(userId: number, sourceType: string, sourceId: number, lastReadMessageId: number): Promise<void> {
    await db.run(
      `INSERT INTO user_message_reads (user_id, source_type, source_id, last_read_message_id)
       VALUES (?, ?, ?, ?) ON CONFLICT (user_id, source_type, source_id)
       DO UPDATE SET last_read_message_id = EXCLUDED.last_read_message_id`,
      [userId, sourceType, sourceId, lastReadMessageId]
    );
  }

  static async getUserMessageRead(userId: number, sourceType: string, sourceId: number): Promise<number> {
    const row = await db.get<{ last_read_message_id: number }>(
      "SELECT last_read_message_id FROM user_message_reads WHERE user_id = ? AND source_type = ? AND source_id = ?",
      [userId, sourceType, sourceId]
    );
    return row?.last_read_message_id ?? 0;
  }

  static async searchMessages(topicId: number, query: string, limit: number = 20): Promise<Record<string, unknown>[]> {
    const rows = await db.all(
      `SELECT m.*, u.id as "senderId", u.username as "senderName", u.avatar_url as "senderAvatar", u.is_bot as "senderIsBot"
       FROM messages m JOIN users u ON m.user_id = u.id
       WHERE m.topic_id = ? AND m.content LIKE ? AND m.is_deleted = false ORDER BY m.id DESC LIMIT ?`,
      [topicId, `%${query}%`, limit]
    );
    return rows.map(formatMessageRow);
  }

  static async forwardMessage(originalMessageId: number, targetTopicId: number, forwarderId: number): Promise<{ id: number }> {
    const original = await Message.findById(originalMessageId);
    if (!original) throw new Error('原始消息不存在');

    const result = await db.run(
      "INSERT INTO messages (topic_id, user_id, content, message_type, message_subtype, source_type, forward_source_id, created_at) VALUES (?, ?, ?, 'forward', 'text', 'chatroom', ?, ?) RETURNING id",
      [targetTopicId, forwarderId, original.content as string, originalMessageId, time.currentDbString()]
    );
    const newMsgId = result.lastID ?? 0;
    await db.run("INSERT INTO forwarded_messages (original_message_id, forwarded_message_id, forwarder_id, message_type) VALUES (?, ?, ?, 'public')", [originalMessageId, newMsgId, forwarderId]);
    return { id: newMsgId };
  }

  static async getBatchByIds(ids: number[]): Promise<Record<number, Record<string, unknown>>> {
    if (!ids || ids.length === 0) return {};
    const placeholders = ids.map(() => '?').join(',');
    const rows = await db.all(
      `SELECT m.*, u.id as "senderId", u.username as "senderName", u.avatar_url as "senderAvatar", u.is_bot as "senderIsBot"
       FROM messages m JOIN users u ON m.user_id = u.id WHERE m.id IN (${placeholders})`,
      ids
    );
    const result: Record<number, Record<string, unknown>> = {};
    for (const row of rows) result[row.id as number] = formatMessageRow(row);
    return result;
  }

  // ── Full-featured query methods ──

  static async findPublicChatroomMessages(limit: number = 50, offset: number = 0): Promise<Record<string, unknown>[]> {
    const rows = await db.all(
      `SELECT m.*, u.id as "senderId", u.username as "senderName", u.avatar_url as "senderAvatar", u.is_bot as "senderIsBot"
       FROM messages m JOIN users u ON m.user_id = u.id
       WHERE m.topic_id IS NULL AND m.is_deleted = false ORDER BY m.id DESC LIMIT ? OFFSET ?`,
      [limit, offset]
    );
    return await enrichMessages(rows, false);
  }

  static async findByTopic(topicId: number, limit: number = 50, offset: number = 0, before?: number | null): Promise<Record<string, unknown>[]> {
    let sql = `SELECT m.*, u.id as "senderId", u.username as "senderName", u.avatar_url as "senderAvatar", u.is_bot as "senderIsBot"
       FROM messages m JOIN users u ON m.user_id = u.id
       WHERE m.topic_id = ? AND m.is_deleted = false`;
    const params: unknown[] = [topicId];
    if (before) { sql += ' AND m.id < ?'; params.push(before); }
    sql += ' ORDER BY m.id DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);
    const rows = await db.all(sql, params);
    const enriched = await enrichMessages(rows, false);
    return enriched.reverse();
  }

  static async findPrivateMessagesBetweenUsers(userId1: number, userId2: number, limit: number = 50, offset: number = 0): Promise<Record<string, unknown>[]> {
    const rows = await db.all(
      `SELECT pm.*, u1.id as "senderId", u1.username as "senderName", u1.avatar_url as "senderAvatar", u1.is_bot as "senderIsBot",
        u2.id as "receiverId", u2.username as "receiverName", u2.avatar_url as "receiverAvatar", u2.is_bot as "receiverIsBot"
       FROM private_messages pm JOIN users u1 ON pm.sender_id = u1.id JOIN users u2 ON pm.receiver_id = u2.id
       WHERE ((pm.sender_id = ? AND pm.receiver_id = ?) OR (pm.sender_id = ? AND pm.receiver_id = ?))
       ORDER BY pm.id DESC LIMIT ? OFFSET ?`,
      [userId1, userId2, userId2, userId1, limit, offset]
    );
    return await enrichMessages(rows, true);
  }

  static async getPrivateChatUsersWithLatestMessage(currentUserId: number): Promise<Record<string, unknown>[]> {
    const contactRows = await db.all<{ contact_id: number }>(
      `SELECT DISTINCT CASE WHEN sender_id = ? THEN receiver_id ELSE sender_id END AS contact_id
       FROM private_messages WHERE (sender_id = ? OR receiver_id = ?)`,
      [currentUserId, currentUserId, currentUserId]
    );
    const contactIds = contactRows.map(r => r.contact_id);
    if (contactIds.length === 0) return [];

    const placeholders = contactIds.map(() => '?').join(',');
    const rows = await db.all(
      `SELECT u.id, u.username, u.avatar_url, u.is_bot, u.registration_order,
        pm.id as lastMsgId, pm.content as lastMsgContent, pm.created_at as lastMsgTime,
        pm.message_type as lastMsgType, pm.is_read as lastMsgRead, pm.sender_id as lastSenderId
       FROM users u
       LEFT JOIN LATERAL (SELECT * FROM private_messages
         WHERE (sender_id = u.id AND receiver_id = ?) OR (sender_id = ? AND receiver_id = u.id)
         ORDER BY id DESC LIMIT 1) pm ON true
       WHERE u.id IN (${placeholders}) AND pm.id IS NOT NULL
       ORDER BY pm.id DESC`,
      [currentUserId, currentUserId, ...contactIds]
    );
    return rows;
  }

  static async findUnreadPrivateMessagesByReceiver(receiverId: number): Promise<Record<string, unknown>[]> {
    const rows = await db.all(
      `SELECT pm.*, u1.id as "senderId", u1.username as "senderName", u1.avatar_url as "senderAvatar", u1.is_bot as "senderIsBot"
       FROM private_messages pm JOIN users u1 ON pm.sender_id = u1.id
       WHERE pm.receiver_id = ? AND pm.is_read = false AND pm.is_deleted = false ORDER BY pm.id DESC`,
      [receiverId]
    );
    return await enrichMessages(rows, true);
  }

  static async getUnreadPrivateMessageCount(userId: number): Promise<number> {
    const row = await db.get<{ count: string }>(
      "SELECT COUNT(*) as count FROM private_messages WHERE receiver_id = ? AND is_read = false AND is_deleted = false",
      [userId]
    );
    return row ? parseInt(row.count) : 0;
  }

  static async markPrivateMessagesAsReadBetweenUsers(userId1: number, userId2: number): Promise<void> {
    await db.run(
      "UPDATE private_messages SET is_read = true WHERE sender_id = ? AND receiver_id = ? AND is_read = false",
      [userId2, userId1]
    );
  }

  static async recallMessage(messageId: number, userId: number, isPrivate: boolean = false, topicId: number | null = null): Promise<{ success: boolean; isRecalled?: boolean }> {
    const table = isPrivate ? 'private_messages' : 'messages';
    const currentTime = time.currentDbString();

    if (topicId) {
      const userField = isPrivate ? 'sender_id' : 'user_id';
      const message = await db.get<{ senderId?: number; senderid?: number }>(
        `SELECT ${userField} as "senderId" FROM ${table} WHERE id = ? AND topic_id = ?`,
        [messageId, topicId]
      );
      if (!message) return { success: false };

      const messageSenderId = message.senderId || message.senderid;
      let hasPermission = false;

      if (messageSenderId == userId) {
        hasPermission = true;
      } else {
        const Topic = (await import('./Topic.ts')).default;
        const isCreator = await Topic.isCreator(topicId, userId);
        if (isCreator) {
          hasPermission = true;
        } else {
          const isAdmin = await Topic.isAdmin(topicId, userId);
          if (isAdmin) {
            const senderIsAdmin = await Topic.isAdmin(topicId, messageSenderId!);
            if (!senderIsAdmin) hasPermission = true;
          }
        }
      }

      if (!hasPermission) return { success: false };

      const result = await db.run(`UPDATE ${table} SET is_deleted = true, deleted_at = ? WHERE id = ?`, [currentTime, messageId]);
      return { success: result.changes > 0, isRecalled: true };
    }

    const userField = isPrivate ? 'sender_id' : 'user_id';
    const result = await db.run(`UPDATE ${table} SET is_deleted = true, deleted_at = ? WHERE id = ? AND ${userField} = ?`, [currentTime, messageId, userId]);
    return { success: result.changes > 0, isRecalled: true };
  }

  static async editMessage(messageId: number, userId: number, newContent: string, isPrivate: boolean = false): Promise<{ success: boolean }> {
    const table = isPrivate ? 'private_messages' : 'messages';
    const currentTime = time.currentDbString();
    const userField = isPrivate ? 'sender_id' : 'user_id';
    const messageType = isPrivate ? 'private' : 'public';

    await db.run(
      `INSERT INTO message_versions (message_id, content, created_at, message_type) SELECT id, content, created_at, '${messageType}' FROM ${table} WHERE id = ?`,
      [messageId]
    ).catch(() => { /* ignore version save error */ });

    const result = await db.run(
      `UPDATE ${table} SET content = ?, updated_at = ? WHERE id = ? AND ${userField} = ?`,
      [newContent, currentTime, messageId, userId]
    );
    return { success: result.changes > 0 };
  }

  static async getMessageVersions(messageId: number, isPrivate: boolean = false): Promise<Record<string, unknown>[]> {
    const messageType = isPrivate ? 'private' : 'public';
    const rows = await db.all(
      "SELECT * FROM message_versions WHERE message_id = ? AND message_type = ? ORDER BY created_at DESC",
      [messageId, messageType]
    );
    return rows.map(row => ({ ...row, created_at: time.formatLocalTime(row.created_at as string) }));
  }

  static async forwardMessages(originalMessageIds: number[], forwarderId: number, targetTopicId: number | null = null, targetReceiverId: number | null = null): Promise<{ success: boolean; forwardedMessages?: { originalMessageId: number; forwardedMessageId: number }[] }> {
    if (!originalMessageIds || originalMessageIds.length === 0) return { success: false };

    const [pubMessages, privMessages] = await Promise.all([
      Message.getBatchByIds(originalMessageIds),
      Promise.all(originalMessageIds.map(id => Message.findPrivateById(id)))
    ]);

    const originalMessages = originalMessageIds.map(id => ({
      id,
      data: pubMessages[id] || privMessages.find(m => m?.id === id) || { id, content: '[消息不存在]', senderName: 'Unknown' }
    })).filter(m => m.data && m.data.id);

    if (originalMessages.length === 0) return { success: false };

    const senderNames = [...new Set(originalMessages.map(m => m.data.senderName as string))];
    const namesStr = senderNames.slice(0, 3).join('、') + (senderNames.length > 3 ? '等' : '');
    const summaryContent = `[合并转发] ${namesStr}的${originalMessages.length}条消息`;

    let forwardedMessageId: number;
    if (targetReceiverId) {
      const pm = await Message.createPrivate({
        sender_id: forwarderId, receiver_id: targetReceiverId,
        content: summaryContent, message_type: 'forwarded', message_subtype: 'text'
      });
      forwardedMessageId = pm.id as number;
    } else {
      forwardedMessageId = await Message.create({
        topic_id: targetTopicId, user_id: forwarderId,
        content: summaryContent, message_type: 'forwarded', message_subtype: 'text'
      });
    }

    const currentTime = time.currentDbString();
    const msgType = targetReceiverId ? 'private' : 'public';
    await Promise.all(originalMessages.map(m =>
      db.run("INSERT INTO forwarded_messages (original_message_id, forwarded_message_id, forwarder_id, created_at, message_type) VALUES (?, ?, ?, ?, ?) RETURNING id",
        [m.id, forwardedMessageId, forwarderId, currentTime, msgType])
    ));

    return {
      success: true,
      forwardedMessages: originalMessages.map(m => ({ originalMessageId: m.id, forwardedMessageId }))
    };
  }

  static async markAsRead(userId: number, sourceType: string, sourceId: number, maxMessageId: number): Promise<void> {
    if (!maxMessageId) return;
    await db.run(
      `INSERT INTO user_message_reads (user_id, source_type, source_id, last_read_message_id)
       VALUES (?, ?, ?, ?) ON CONFLICT(user_id, source_type, source_id)
       DO UPDATE SET last_read_message_id = excluded.last_read_message_id
       WHERE user_message_reads.last_read_message_id < excluded.last_read_message_id`,
      [userId, sourceType, sourceId, maxMessageId]
    );
  }

  static async getQuotedMessageInfo(quotedMessageId: number): Promise<Record<string, unknown> | undefined> {
    const row = await db.get(
      `SELECT m.*, u.id as "senderId", u.username as "senderName", u.avatar_url as "senderAvatar"
       FROM messages m JOIN users u ON m.user_id = u.id WHERE m.id = ?`,
      [quotedMessageId]
    );
    return row ? formatMessageRow(row) : undefined;
  }

  static async getQuotedPrivateMessageInfo(quotedMessageId: number): Promise<Record<string, unknown> | undefined> {
    const row = await db.get(
      `SELECT pm.*, u.id as "senderId", u.username as "senderName", u.avatar_url as "senderAvatar"
       FROM private_messages pm JOIN users u ON pm.sender_id = u.id WHERE pm.id = ?`,
      [quotedMessageId]
    );
    return row ? formatMessageRow(row) : undefined;
  }

  static async isMessageDeleted(messageId: number, isPrivate: boolean = false): Promise<boolean> {
    const table = isPrivate ? 'private_messages' : 'messages';
    const row = await db.get<{ is_deleted: boolean }>(`SELECT is_deleted FROM ${table} WHERE id = ?`, [messageId]);
    return row ? row.is_deleted === true : false;
  }

  static async isMessageInTopic(messageId: number, topicId: number, isPrivate: boolean = false): Promise<boolean> {
    const table = isPrivate ? 'private_messages' : 'messages';
    const row = await db.get<{ 1?: number }>(`SELECT 1 FROM ${table} WHERE id = ? AND topic_id = ?`, [messageId, topicId]);
    return !!row;
  }

  static async findByChatroom(limit = 50, offset = 0): Promise<Record<string, unknown>[]> {
    return Message.findPublicChatroomMessages(limit, offset);
  }

  static async getRecentMessages(limit: number = 10): Promise<Record<string, unknown>[]> {
    const rows = await db.all(
      `SELECT m.*, u.id as "senderId", u.username as "senderName", u.avatar_url as "senderAvatar", u.is_bot as "senderIsBot", t.name as "topicName"
       FROM messages m JOIN users u ON m.user_id = u.id LEFT JOIN topics t ON m.topic_id = t.id
       ORDER BY m.id DESC LIMIT ?`,
      [limit]
    );
    return await enrichMessages(rows, false);
  }
}

// ── helper ──
function formatMessageRow(row: Record<string, unknown>): Record<string, unknown> {
  const created = row.created_at as string;
  if (row.is_deleted === true) {
    return {
      id: row.id,
      isRecalled: true,
      recallTime: time.formatLocalTime((row.deleted_at || created) as string),
      created_at: time.formatLocalTime(created),
      messageTime: time.formatMessageTime(created),
      relativeTime: time.getRelativeTime(created),
      messageType: 'recalled',
      senderId: row.senderId || row.senderid || row.user_id,
      senderName: row.senderName || row.sendername,
      senderAvatar: row.senderAvatar || row.senderavatar,
      senderIsBot: row.senderIsBot === 1 || row.senderisbot === 1,
      topicName: row.topicName || row.topicname,
      isTopicMessage: !!row.topic_id
    };
  }

  return {
    id: row.id,
    topic_id: row.topic_id,
    user_id: row.user_id,
    content: row.content,
    created_at: time.formatLocalTime(created),
    updated_at: row.updated_at ? time.formatLocalTime(row.updated_at as string) : null,
    message_type: row.message_type || 'normal',
    forward_source_id: row.forward_source_id,
    is_deleted: row.is_deleted === true ? 1 : 0,
    quoted_message_id: row.quoted_message_id,
    deleted_at: row.deleted_at,
    message_subtype: row.message_subtype || 'text',
    file_type: row.file_type,
    file_url: row.file_url,
    file_name: row.file_name,
    file_size: row.file_size,
    source_type: row.source_type || 'chatroom',
    senderId: row.senderId || row.senderid || row.user_id,
    senderName: row.senderName || row.sendername,
    senderAvatar: row.senderAvatar || row.senderavatar,
    topicName: row.topicName || row.topicname,
    messageTime: time.formatMessageTime(created),
    relativeTime: time.getRelativeTime(created),
    messageType: row.message_type || 'normal',
    messageSubtype: row.message_subtype || 'text',
    sourceType: row.source_type || 'chatroom',
    isTopicMessage: !!row.topic_id,
    command_id: row.command_id,
    isEdited: !!row.updated_at,
    senderIsBot: row.senderIsBot === 1 || row.senderisbot === 1
  };
}

// ── enrich helper ──
async function enrichMessages(rows: Record<string, unknown>[], isPrivate: boolean): Promise<Record<string, unknown>[]> {
  const quotedIds: number[] = [];
  const forwardedIds: number[] = [];
  const editedIds: number[] = [];
  const mergedForwardIds: number[] = [];
  const allMsgIds: number[] = [];

  for (const row of rows) {
    const id = row.id as number;
    allMsgIds.push(id);
    if (row.is_deleted !== true) {
      if (row.message_type === 'forwarded' && row.forward_source_id) forwardedIds.push(row.forward_source_id as number);
      else if (row.message_type === 'forwarded' && !row.forward_source_id) mergedForwardIds.push(id);
      else if (row.quoted_message_id) quotedIds.push(row.quoted_message_id as number);
      if (row.updated_at) editedIds.push(id);
    }
  }

  const [quotedData, originalData, versionsData, mentionsData, mergedForwardData] = await Promise.all([
    quotedIds.length > 0 ? getQuotedMessageInfoBatch(quotedIds, isPrivate) : Promise.resolve({} as Record<number, unknown>),
    forwardedIds.length > 0 ? getQuotedMessageInfoBatch(forwardedIds, isPrivate) : Promise.resolve({} as Record<number, unknown>),
    editedIds.length > 0 ? getMessageVersionsBatch(editedIds, isPrivate) : Promise.resolve({} as Record<number, unknown>),
    allMsgIds.length > 0 ? getMessageMentionsBatch(allMsgIds) : Promise.resolve({} as Record<number, unknown>),
    mergedForwardIds.length > 0 ? getMergedForwardedMessagesBatch(mergedForwardIds) : Promise.resolve({} as Record<number, unknown>)
  ]);

  return rows.map(row => {
    const id = row.id as number;
    if (row.is_deleted === true) {
      return {
        id, isRecalled: true,
        recallTime: time.formatLocalTime((row.deleted_at || row.created_at) as string),
        created_at: time.formatLocalTime(row.created_at as string),
        messageTime: time.formatMessageTime(row.created_at as string),
        relativeTime: time.getRelativeTime(row.created_at as string),
        messageType: 'recalled',
        senderId: row.senderId || row.senderid || row.user_id,
        senderName: row.senderName || row.sendername,
        senderAvatar: row.senderAvatar || row.senderavatar,
        senderIsBot: !!(row.senderIsBot || row.senderisbot),
        isTopicMessage: !!row.topic_id
      };
    }

    const msg = { ...formatMessageRow(row) };

    if (['file', 'image', 'video'].includes(row.message_subtype as string)) {
      (msg as Record<string, unknown>).fileInfo = { url: row.file_url, name: row.file_name, size: row.file_size, type: row.file_type };
    }

    if (row.message_type === 'forwarded' && row.forward_source_id) {
      (msg as Record<string, unknown>).originalMessageId = row.forward_source_id;
      (msg as Record<string, unknown>).originalMessage = (originalData as Record<number, unknown>)[row.forward_source_id as number] || null;
    } else if (row.message_type === 'forwarded' && !row.forward_source_id) {
      (msg as Record<string, unknown>).originalMessages = (mergedForwardData as Record<number, unknown>)[id] || [];
    } else if (row.quoted_message_id) {
      (msg as Record<string, unknown>).quotedMessageId = row.quoted_message_id;
      (msg as Record<string, unknown>).quotedMessage = (quotedData as Record<number, unknown>)[row.quoted_message_id as number] || null;
    } else if (row.updated_at) {
      (msg as Record<string, unknown>).editHistory = (versionsData as Record<number, unknown>)[id] || [];
    }

    (msg as Record<string, unknown>).mentions = (mentionsData as Record<number, unknown>)[id] || [];

    return msg;
  });
}

export default Message;
