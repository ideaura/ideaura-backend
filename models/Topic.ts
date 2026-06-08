import db from '../config/database.ts';
import time from '../utils/time.ts';

// Lazy import to avoid circular dependency with mqtt service
let invalidateTopicCacheFn: ((topicId: number) => Promise<void>) | null = null;
async function getInvalidateTopicCache() {
  if (!invalidateTopicCacheFn) {
    const mqtt = await import('../services/mqtt.ts');
    invalidateTopicCacheFn = mqtt.invalidateTopicCache;
  }
  return invalidateTopicCacheFn;
}

interface TopicRow {
  id: number;
  name: string;
  description: string | null;
  announcement: string | null;
  created_by: number;
  is_private: boolean;
  is_active: boolean;
  message_count: number;
  last_activity: string | null;
  avatar_url: string | null;
  linked_community_id?: number | null;
  created_at: string;
  updated_at: string | null;
}

interface LatestMsgRow {
  msg_id?: number;
  msg_content?: string;
  msg_created_at?: string;
  msg_senderName?: string;
  msg_sendername?: string;
}

function formatTopicRow(row: TopicRow & Record<string, unknown>, latestMessageRow?: LatestMsgRow | null): Record<string, unknown> {
  const formatDate = (val: unknown): string | null => {
    if (!val) return null;
    if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(val)) return val;
    return time.formatLocalTime(val as string);
  };

  return {
    id: row.id,
    name: row.name,
    description: row.description || null,
    avatar_url: row.avatar_url || null,
    created_by: row.created_by,
    creatorName: row.creatorName || row.creatorname || null,
    creatorAvatar: row.creatorAvatar || row.creatoravatar || null,
    creatorIsBot: row.creatorIsBot === 1 || row.creatorisbot === 1,
    is_private: row.is_private === true ? 1 : (row.is_private === false ? 0 : row.is_private),
    is_active: row.is_active === true ? 1 : (row.is_active === false ? 0 : row.is_active),
    message_count: row.message_count || 0,
    last_activity: formatDate(row.last_activity),
    created_at: formatDate(row.created_at),
    linked_community_id: row.linked_community_id || null,
    latestMessage: (latestMessageRow && latestMessageRow.msg_id) ? {
      content: `${latestMessageRow.msg_senderName || latestMessageRow.msg_sendername || ''}：${latestMessageRow.msg_content || ''}`,
      createdAt: formatDate(latestMessageRow.msg_created_at)
    } : null
  };
}

class Topic {
  static async attachUnreadInfoToTopics(topics: Record<string, unknown>[], userId: number): Promise<Record<string, unknown>[]> {
    if (!topics || topics.length === 0) return topics;
    const topicIds = topics.map(t => t.id as number);
    const placeholders = topicIds.map(() => '?').join(',');

    const readRows = await db.all<{ source_id: number; last_read_message_id: number }>(
      `SELECT source_id, last_read_message_id FROM user_message_reads
       WHERE user_id = ? AND source_type = 'topic' AND source_id IN (${placeholders})`,
      [userId, ...topicIds]
    );

    const readMap: Record<number, number> = {};
    for (const r of readRows) readMap[r.source_id] = r.last_read_message_id;

    await Promise.all(topics.map(async topic => {
      const id = topic.id as number;
      const lastReadId = readMap[id] || 0;
      const unreadRow = await db.get<{ unreadcount: number }>(
        "SELECT COUNT(id) as unreadCount FROM messages WHERE topic_id = ? AND id > ? AND is_deleted = false",
        [id, lastReadId]
      );
      const mentionRows = await db.all<{ id: number }>(
        `SELECT m.id FROM messages m JOIN message_mentions mm ON m.id = mm.message_id
         WHERE m.topic_id = ? AND m.id > ? AND m.is_deleted = false
         AND (mm.user_id = ? OR mm.mention_type = 'all')`,
        [id, lastReadId, userId]
      );
      topic.unreadCount = parseInt(String(unreadRow?.unreadcount ?? '0'));
      topic.hasMention = mentionRows.length > 0;
      topic.isMuted = topic.isMuted ?? false;
    }));

    return topics;
  }

  static async create(topicData: { name: string; description?: string | null; created_by: number; avatar_url?: string | null; is_private?: number | boolean }): Promise<number> {
    const { name, description = null, created_by, avatar_url = null } = topicData;
    const is_private = topicData.is_private !== undefined ? topicData.is_private : 1;
    const isPrivateBool = is_private === 1 || is_private === true;
    const currentTime = time.currentDbString();
    const result = await db.run(
      "INSERT INTO topics (name, description, announcement, created_by, is_private, avatar_url, last_activity, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING id",
      [name, description, null, created_by, isPrivateBool, avatar_url, currentTime, currentTime]
    );
    const topicId = result.lastID ?? 0;
    await db.run("INSERT INTO topic_members (topic_id, user_id, role, joined_at) VALUES (?, ?, 'creator', ?)", [topicId, created_by, currentTime]);
    return topicId;
  }

  static async findById(id: number): Promise<Record<string, unknown> | undefined> {
    return db.get(`SELECT t.*, u.id as "creatorId", u.username as "creatorName", u.avatar_url as "creatorAvatar"
      FROM topics t LEFT JOIN users u ON t.created_by = u.id WHERE t.id = ? AND t.is_active = true`, [id]);
  }

  static async findByCreator(userId: number): Promise<Record<string, unknown>[]> {
    return db.all(`SELECT t.*, u.id as "creatorId", u.username as "creatorName", u.avatar_url as "creatorAvatar"
      FROM topics t LEFT JOIN users u ON t.created_by = u.id WHERE t.created_by = ? AND t.is_active = true ORDER BY t.last_activity DESC`, [userId]);
  }

  static async findByMember(userId: number, limit: number = 50): Promise<Record<string, unknown>[]> {
    const rows = await db.all(
      `SELECT t.*, u.id as "creatorId", u.username as "creatorName", u.avatar_url as "creatorAvatar",
        m.id as msg_id, m.content as msg_content, m.created_at as msg_created_at,
        mu.username as msg_senderName, mu.avatar_url as msg_senderAvatar
       FROM topics t JOIN topic_members tm ON t.id = tm.topic_id
       LEFT JOIN users u ON t.created_by = u.id
       LEFT JOIN (SELECT topic_id, MAX(id) as max_id FROM messages WHERE is_deleted = false GROUP BY topic_id) latest ON latest.topic_id = t.id
       LEFT JOIN messages m ON m.id = latest.max_id
       LEFT JOIN users mu ON m.user_id = mu.id
       WHERE tm.user_id = ? AND t.is_active = true ORDER BY t.last_activity DESC LIMIT ?`,
      [userId, limit]
    );
    return rows.map(row => formatTopicRow(row, row));
  }

  static async getRecommendedTopics(userId: number, limit: number = 10): Promise<Record<string, unknown>[]> {
    const rows = await db.all(
      `SELECT t.*, u.id as "creatorId", u.username as "creatorName", u.avatar_url as "creatorAvatar",
        m.id as msg_id, m.content as msg_content, m.created_at as msg_created_at,
        mu.username as msg_senderName, mu.avatar_url as msg_senderAvatar,
        COUNT(DISTINCT msg_count.id) as msg_count
       FROM topics t LEFT JOIN users u ON t.created_by = u.id
       LEFT JOIN topic_members tm ON t.id = tm.topic_id AND tm.user_id = ?
       LEFT JOIN (SELECT topic_id, MAX(id) as max_id FROM messages WHERE is_deleted = false GROUP BY topic_id) latest ON latest.topic_id = t.id
       LEFT JOIN messages m ON m.id = latest.max_id LEFT JOIN users mu ON m.user_id = mu.id
       LEFT JOIN messages msg_count ON msg_count.topic_id = t.id AND msg_count.is_deleted = false
       WHERE t.is_active = true GROUP BY t.id, u.id, u.username, u.avatar_url, m.id, m.content, m.created_at, mu.username, mu.avatar_url
       ORDER BY COUNT(DISTINCT msg_count.id) DESC, t.last_activity DESC LIMIT ?`,
      [userId, limit]
    );
    return rows.map(row => formatTopicRow(row, row));
  }

  static async getRecentActiveTopics(limit: number = 10): Promise<Record<string, unknown>[]> {
    return db.all(`SELECT t.*, u.id as "creatorId", u.username as "creatorName", u.avatar_url as "creatorAvatar"
      FROM topics t LEFT JOIN users u ON t.created_by = u.id
      WHERE t.is_active = true AND t.last_activity >= ?
      ORDER BY t.last_activity DESC LIMIT ?`,
      [time.formatDatabaseTime(new Date(time.nowMs() - 7 * 24 * 3600 * 1000)), limit]);
  }

  static async getNewTopics(limit: number = 10): Promise<Record<string, unknown>[]> {
    return db.all(`SELECT t.*, u.id as "creatorId", u.username as "creatorName", u.avatar_url as "creatorAvatar"
      FROM topics t LEFT JOIN users u ON t.created_by = u.id WHERE t.is_active = true ORDER BY t.id DESC LIMIT ?`, [limit]);
  }

  static async searchTopics(userId: number, query: string, limit: number = 20): Promise<Record<string, unknown>[]> {
    const baseSelect = `SELECT t.*, u.id as "creatorId", u.username as "creatorName", u.avatar_url as "creatorAvatar",
      m.id as msg_id, m.content as msg_content, m.created_at as msg_created_at,
      mu.username as msg_senderName, mu.avatar_url as msg_senderAvatar,
      CASE WHEN tm.user_id IS NOT NULL THEN 1 ELSE 0 END AS is_member_flag
      FROM topics t LEFT JOIN users u ON t.created_by = u.id
      LEFT JOIN topic_members tm ON t.id = tm.topic_id AND tm.user_id = ?
      LEFT JOIN (SELECT topic_id, MAX(id) as max_id FROM messages WHERE is_deleted = false GROUP BY topic_id) latest ON latest.topic_id = t.id
      LEFT JOIN messages m ON m.id = latest.max_id LEFT JOIN users mu ON m.user_id = mu.id`;

    let sql: string;
    let params: unknown[];
    if (!isNaN(Number(query))) {
      sql = baseSelect + ` WHERE t.id = ? AND t.is_active = true AND (t.is_private = false OR tm.user_id IS NOT NULL) LIMIT ?`;
      params = [userId, parseInt(query), limit];
    } else {
      sql = baseSelect + ` WHERE t.name LIKE ? AND t.is_active = true AND (t.is_private = false OR tm.user_id IS NOT NULL) ORDER BY t.last_activity DESC, t.created_at DESC LIMIT ?`;
      params = [userId, `%${query}%`, limit];
    }

    const rows = await db.all<TopicRow & Record<string, unknown>>(sql, params);
    return rows.map(row => {
      const isMember = row.is_member_flag !== undefined && row.is_member_flag !== null;
      const formatted = formatTopicRow(row, row);
      (formatted as Record<string, unknown>).is_member = isMember;
      return formatted;
    });
  }

  static async findByName(name: string): Promise<{ id: number } | undefined> {
    return db.get<{ id: number }>("SELECT id FROM topics WHERE name = ? AND is_active = true", [name]);
  }

  static async getAnnouncement(topicId: number): Promise<string | null> {
    const row = await db.get<{ announcement: string }>("SELECT announcement FROM topics WHERE id = ? AND is_active = true", [topicId]);
    return row ? row.announcement : null;
  }

  static async isMember(topicId: number, userId: number): Promise<boolean> {
    const row = await db.get<{ 1?: number }>("SELECT 1 FROM topic_members WHERE topic_id = ? AND user_id = ?", [topicId, userId]);
    return !!row;
  }

  static async getUserRole(topicId: number, userId: number): Promise<string | null> {
    const row = await db.get<{ role: string }>("SELECT role FROM topic_members WHERE topic_id = ? AND user_id = ?", [topicId, userId]);
    return row ? row.role : null;
  }

  static async isCreatorOrAdmin(topicId: number, userId: number): Promise<boolean> {
    const row = await db.get<{ 1?: number }>("SELECT 1 FROM topic_members WHERE topic_id = ? AND user_id = ? AND (role = 'creator' OR role = 'admin')", [topicId, userId]);
    return !!row;
  }

  static async isCreator(topicId: number, userId: number): Promise<boolean> {
    const row = await db.get<{ 1?: number }>("SELECT 1 FROM topic_members WHERE topic_id = ? AND user_id = ? AND role = 'creator'", [topicId, userId]);
    return !!row;
  }

  static async getMembers(topicId: number, limit: number = 50): Promise<Record<string, unknown>[]> {
    const rows = await db.all(
      `SELECT u.id, u.username, u.avatar_url, u.registration_order, u.is_bot, tm.joined_at, tm.role,
        CASE WHEN tmu.user_id IS NOT NULL THEN 1 ELSE 0 END AS is_muted
       FROM topic_members tm JOIN users u ON tm.user_id = u.id
       LEFT JOIN topic_muted_users tmu ON tm.topic_id = tmu.topic_id AND tm.user_id = tmu.user_id
       WHERE tm.topic_id = ? ORDER BY CASE tm.role WHEN 'creator' THEN 1 WHEN 'admin' THEN 2 ELSE 3 END, tm.joined_at ASC LIMIT ?`,
      [topicId, limit]);
    return rows.map(row => ({ ...row, avatarUrl: row.avatar_url, isBot: !!row.is_bot, joined_at: time.formatLocalTime(row.joined_at), isMuted: !!row.is_muted }));
  }

  static async getMemberCount(topicId: number): Promise<number> {
    const row = await db.get<{ count: string }>("SELECT COUNT(*) as count FROM topic_members WHERE topic_id = ?", [topicId]);
    return row ? parseInt(row.count) : 0;
  }

  static async joinTopic(topicId: number, userId: number): Promise<{ changes: number }> {
    const result = await db.run(
      "INSERT INTO topic_members (topic_id, user_id, role, joined_at) VALUES (?, ?, 'member', ?) ON CONFLICT DO NOTHING",
      [topicId, userId, time.formatDatabaseTime()]);
    const fn = await getInvalidateTopicCache();
    fn(topicId).catch((err: Error) => console.error('清除topic缓存失败:', err));
    return { changes: result.changes };
  }

  static async leaveTopic(topicId: number, userId: number): Promise<{ changes: number }> {
    const row = await db.get<{ 1?: number }>("SELECT 1 FROM topic_members WHERE topic_id = ? AND user_id = ? AND role = 'creator'", [topicId, userId]);
    if (row) throw new Error('话题创建者不能退出自己创建的话题');
    const result = await db.run("DELETE FROM topic_members WHERE topic_id = ? AND user_id = ?", [topicId, userId]);
    const fn = await getInvalidateTopicCache();
    fn(topicId).catch((err: Error) => console.error('清除topic缓存失败:', err));
    return { changes: result.changes };
  }

  static async setAdmin(topicId: number, userId: number, adminId: number): Promise<{ changes: number }> {
    const c = await db.get<{ 1?: number }>("SELECT 1 FROM topic_members WHERE topic_id = ? AND user_id = ? AND role = 'creator'", [topicId, userId]);
    if (!c) throw new Error('只有话题创建者可以设置管理员');
    const a = await db.get<{ 1?: number }>("SELECT 1 FROM topic_members WHERE topic_id = ? AND user_id = ? AND role = 'creator'", [topicId, adminId]);
    if (a) throw new Error('不能修改创建者的角色');
    const result = await db.run("UPDATE topic_members SET role = 'admin' WHERE topic_id = ? AND user_id = ?", [topicId, adminId]);
    return { changes: result.changes };
  }

  static async removeAdmin(topicId: number, userId: number, adminId: number): Promise<{ changes: number }> {
    const c = await db.get<{ 1?: number }>("SELECT 1 FROM topic_members WHERE topic_id = ? AND user_id = ? AND role = 'creator'", [topicId, userId]);
    if (!c) throw new Error('只有话题创建者可以取消管理员');
    const a = await db.get<{ 1?: number }>("SELECT 1 FROM topic_members WHERE topic_id = ? AND user_id = ? AND role = 'creator'", [topicId, adminId]);
    if (a) throw new Error('不能修改创建者的角色');
    const result = await db.run("UPDATE topic_members SET role = 'member' WHERE topic_id = ? AND user_id = ?", [topicId, adminId]);
    return { changes: result.changes };
  }

  static async updateTopic(topicId: number, userId: number, updates: { name?: string; description?: string; announcement?: string; avatar_url?: string }): Promise<{ changes: number }> {
    const row = await db.get<{ 1?: number }>("SELECT 1 FROM topic_members WHERE topic_id = ? AND user_id = ? AND (role = 'creator' OR role = 'admin')", [topicId, userId]);
    if (!row) throw new Error('只有话题创建者和管理员可以修改话题信息');
    const { name, description, announcement, avatar_url } = updates;
    const uArr: string[] = []; const p: unknown[] = [];
    if (name !== undefined) { uArr.push("name = ?"); p.push(name); }
    if (description !== undefined) { uArr.push("description = ?"); p.push(description); }
    if (announcement !== undefined) { uArr.push("announcement = ?"); p.push(announcement); }
    if (avatar_url !== undefined) { uArr.push("avatar_url = ?"); p.push(avatar_url); }
    if (uArr.length === 0) return { changes: 0 };
    p.push(topicId);
    const result = await db.run(`UPDATE topics SET ${uArr.join(", ")} WHERE id = ?`, p);
    return { changes: result.changes };
  }

  static async updatePrivateStatus(topicId: number, userId: number, isPrivate: boolean): Promise<{ changes: number }> {
    const row = await db.get<{ 1?: number }>("SELECT 1 FROM topic_members WHERE topic_id = ? AND user_id = ? AND role = 'creator'", [topicId, userId]);
    if (!row) throw new Error('只有话题创建者可以修改话题的私有状态');
    const result = await db.run("UPDATE topics SET is_private = ? WHERE id = ?", [isPrivate, topicId]);
    return { changes: result.changes };
  }

  static async setAnnouncement(topicId: number, userId: number, announcement: string): Promise<{ changes: number }> {
    const row = await db.get<{ 1?: number }>("SELECT 1 FROM topic_members WHERE topic_id = ? AND user_id = ? AND (role = 'creator' OR role = 'admin')", [topicId, userId]);
    if (!row) throw new Error('只有话题创建者和管理员可以设置公告');
    const result = await db.run("UPDATE topics SET announcement = ? WHERE id = ?", [announcement, topicId]);
    return { changes: result.changes };
  }

  static async archive(id: number): Promise<{ changes: number }> {
    const result = await db.run("UPDATE topics SET is_active = false WHERE id = ?", [id]);
    return { changes: result.changes };
  }

  static async getRecentActiveTopics(limit = 10): Promise<Record<string, unknown>[]> {
    return db.all(`SELECT t.*, u.id as "creatorId", u.username as "creatorName", u.avatar_url as "creatorAvatar"
      FROM topics t LEFT JOIN users u ON t.created_by = u.id
      WHERE t.is_active = true AND t.last_activity >= ?
      ORDER BY t.last_activity DESC LIMIT ?`,
      [time.formatDatabaseTime(new Date(time.nowMs() - 7*24*3600*1000)), limit]);
  }

  static async getNewTopics(limit = 10): Promise<Record<string, unknown>[]> {
    return db.all(`SELECT t.*, u.id as "creatorId", u.username as "creatorName", u.avatar_url as "creatorAvatar"
      FROM topics t LEFT JOIN users u ON t.created_by = u.id WHERE t.is_active = true ORDER BY t.id DESC LIMIT ?`, [limit]);
  }

  static async removeMember(topicId: number, removerId: number, memberId: number): Promise<{ changes: number }> {
    const removerRow = await db.get<{ role: string }>("SELECT role FROM topic_members WHERE topic_id = ? AND user_id = ?", [topicId, removerId]);
    if (!removerRow) throw new Error('您不是该话题的成员');
    if (removerRow.role !== 'creator' && removerRow.role !== 'admin') throw new Error('只有话题创建者和管理员可以移除成员');
    const memberRow = await db.get<{ role: string }>("SELECT role FROM topic_members WHERE topic_id = ? AND user_id = ?", [topicId, memberId]);
    if (!memberRow) throw new Error('该用户不是话题成员');
    if (removerRow.role === 'admin' && (memberRow.role === 'creator' || memberRow.role === 'admin')) throw new Error('管理员不能移除创建者或其他管理员');
    if (removerId === memberId) throw new Error('不能移除自己');
    const result = await db.run("DELETE FROM topic_members WHERE topic_id = ? AND user_id = ?", [topicId, memberId]);
    const fn = await getInvalidateTopicCache();
    fn(topicId).catch((err: Error) => console.error('清除topic缓存失败:', err));
    return { changes: result.changes };
  }

  static async muteUser(topicId: number, muterId: number, userId: number, reason: string | null = null): Promise<{ changes: number }> {
    const muterRow = await db.get<{ role: string }>("SELECT role FROM topic_members WHERE topic_id = ? AND user_id = ?", [topicId, muterId]);
    if (!muterRow) throw new Error('您不是该话题的成员');
    if (muterRow.role !== 'creator' && muterRow.role !== 'admin') throw new Error('只有话题创建者和管理员可以禁言用户');
    const userRow = await db.get<{ role: string }>("SELECT role FROM topic_members WHERE topic_id = ? AND user_id = ?", [topicId, userId]);
    if (!userRow) throw new Error('该用户不是话题成员');
    if (muterRow.role === 'admin' && (userRow.role === 'creator' || userRow.role === 'admin')) throw new Error('管理员不能禁言创建者或其他管理员');
    if (muterId === userId) throw new Error('不能禁言自己');
    const result = await db.run(
      "INSERT INTO topic_muted_users (topic_id, user_id, muted_by, reason, created_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT (topic_id, user_id) DO UPDATE SET muted_by = EXCLUDED.muted_by, reason = EXCLUDED.reason, created_at = EXCLUDED.created_at",
      [topicId, userId, muterId, reason, time.formatDatabaseTime()]);
    return { changes: result.changes };
  }

  static async unmuteUser(topicId: number, unmuterId: number, userId: number): Promise<{ changes: number }> {
    const unmuterRow = await db.get<{ role: string }>("SELECT role FROM topic_members WHERE topic_id = ? AND user_id = ?", [topicId, unmuterId]);
    if (!unmuterRow) throw new Error('您不是该话题的成员');
    if (unmuterRow.role !== 'creator' && unmuterRow.role !== 'admin') throw new Error('只有话题创建者和管理员可以解除禁言');
    if (unmuterRow.role === 'admin') {
      const userRow = await db.get<{ role: string }>("SELECT role FROM topic_members WHERE topic_id = ? AND user_id = ?", [topicId, userId]);
      if (!userRow) throw new Error('该用户不是话题成员');
      if (userRow.role === 'creator' || userRow.role === 'admin') throw new Error('管理员只能解除普通成员的禁言');
    }
    const result = await db.run("DELETE FROM topic_muted_users WHERE topic_id = ? AND user_id = ?", [topicId, userId]);
    return { changes: result.changes };
  }

  static async isUserMuted(topicId: number, userId: number): Promise<boolean> {
    const row = await db.get<{ 1?: number }>("SELECT 1 FROM topic_muted_users WHERE topic_id = ? AND user_id = ?", [topicId, userId]);
    return !!row;
  }

  static async getUserMuteInfo(topicId: number, userId: number): Promise<Record<string, unknown> | undefined> {
    const row = await db.get(
      `SELECT tm.*, u.username as "mutedByUsername" FROM topic_muted_users tm
       JOIN users u ON tm.muted_by = u.id WHERE tm.topic_id = ? AND tm.user_id = ?`,
      [topicId, userId]);
    if (row) (row as Record<string, unknown>).created_at = time.formatLocalTime((row as Record<string, string>).created_at);
    return row;
  }

  // ── WithLatestMessage variants ──

  static async findByUserWithLatestMessage(userId: number, limit: number = 50): Promise<Record<string, unknown>[]> {
    const rows = await db.all(
      `SELECT t.*, u.id as "creatorId", u.username as "creatorName", u.avatar_url as "creatorAvatar",
        m.id as msg_id, m.content as msg_content, m.created_at as msg_created_at,
        mu.username as msg_senderName, mu.avatar_url as msg_senderAvatar
       FROM topics t INNER JOIN topic_members tm ON t.id = tm.topic_id
       LEFT JOIN users u ON t.created_by = u.id
       LEFT JOIN (SELECT topic_id, MAX(id) as max_id FROM messages WHERE is_deleted = false GROUP BY topic_id) latest ON latest.topic_id = t.id
       LEFT JOIN messages m ON m.id = latest.max_id LEFT JOIN users mu ON m.user_id = mu.id
       WHERE tm.user_id = ? AND t.is_active = true ORDER BY t.last_activity DESC, t.created_at DESC LIMIT ?`,
      [userId, limit]
    );
    return rows.map(row => formatTopicRow(row, row));
  }

  static async findAllWithLatestMessage(userId: number, limit: number = 50): Promise<Record<string, unknown>[]> {
    const rows = await db.all(
      `SELECT t.*, u.id as "creatorId", u.username as "creatorName", u.avatar_url as "creatorAvatar",
        m.id as msg_id, m.content as msg_content, m.created_at as msg_created_at,
        mu.username as msg_senderName, mu.avatar_url as msg_senderAvatar
       FROM topics t INNER JOIN topic_members tm ON t.id = tm.topic_id
       LEFT JOIN users u ON t.created_by = u.id
       LEFT JOIN (SELECT topic_id, MAX(id) as max_id FROM messages WHERE is_deleted = false GROUP BY topic_id) latest ON latest.topic_id = t.id
       LEFT JOIN messages m ON m.id = latest.max_id LEFT JOIN users mu ON m.user_id = mu.id
       WHERE tm.user_id = ? AND t.is_active = true ORDER BY t.last_activity DESC LIMIT ?`,
      [userId, limit]
    );
    return rows.map(row => formatTopicRow(row, row));
  }

  static async searchWithLatestMessage(query: string, userId: number, limit: number = 50): Promise<Record<string, unknown>[]> {
    const baseSelect = `SELECT t.*, u.id as "creatorId", u.username as "creatorName", u.avatar_url as "creatorAvatar",
      m.id as msg_id, m.content as msg_content, m.created_at as msg_created_at,
      mu.username as msg_senderName, mu.avatar_url as msg_senderAvatar
      FROM topics t LEFT JOIN users u ON t.created_by = u.id
      LEFT JOIN topic_members tm ON t.id = tm.topic_id AND tm.user_id = ?
      LEFT JOIN (SELECT topic_id, MAX(id) as max_id FROM messages WHERE is_deleted = false GROUP BY topic_id) latest ON latest.topic_id = t.id
      LEFT JOIN messages m ON m.id = latest.max_id LEFT JOIN users mu ON m.user_id = mu.id`;
    const isNumQuery = !isNaN(Number(query));
    const sql = baseSelect + (isNumQuery
      ? ` WHERE t.id = ? AND t.is_active = true AND (t.is_private = false OR tm.user_id IS NOT NULL) LIMIT ?`
      : ` WHERE t.name LIKE ? AND t.is_active = true AND (t.is_private = false OR tm.user_id IS NOT NULL) ORDER BY t.last_activity DESC LIMIT ?`);
    const params: unknown[] = isNumQuery ? [userId, parseInt(query), limit] : [userId, `%${query}%`, limit];
    const rows = await db.all(sql, params);
    return rows.map(row => formatTopicRow(row, row));
  }

  static async getPopularTopicsWithLatestMessage(limit: number = 10): Promise<Record<string, unknown>[]> {
    const rows = await db.all(
      `SELECT t.*, u.id as "creatorId", u.username as "creatorName", u.avatar_url as "creatorAvatar",
        m.id as msg_id, m.content as msg_content, m.created_at as msg_created_at,
        mu.username as msg_senderName, mu.avatar_url as msg_senderAvatar,
        COUNT(DISTINCT msg_count.id) as msg_count
       FROM topics t LEFT JOIN users u ON t.created_by = u.id
       LEFT JOIN (SELECT topic_id, MAX(id) as max_id FROM messages WHERE is_deleted = false GROUP BY topic_id) latest ON latest.topic_id = t.id
       LEFT JOIN messages m ON m.id = latest.max_id LEFT JOIN users mu ON m.user_id = mu.id
       LEFT JOIN messages msg_count ON msg_count.topic_id = t.id AND msg_count.is_deleted = false
       WHERE t.is_active = true GROUP BY t.id, u.id, u.username, u.avatar_url, m.id, m.content, m.created_at, mu.username, mu.avatar_url
       ORDER BY COUNT(DISTINCT msg_count.id) DESC, t.last_activity DESC LIMIT ?`,
      [limit]
    );
    return rows.map(row => formatTopicRow(row, row));
  }

  static async getRecentActiveTopicsWithLatestMessage(limit: number = 10): Promise<Record<string, unknown>[]> {
    const rows = await db.all(
      `SELECT t.*, u.id as "creatorId", u.username as "creatorName", u.avatar_url as "creatorAvatar",
        m.id as msg_id, m.content as msg_content, m.created_at as msg_created_at,
        mu.username as msg_senderName, mu.avatar_url as msg_senderAvatar
       FROM topics t LEFT JOIN users u ON t.created_by = u.id
       LEFT JOIN (SELECT topic_id, MAX(id) as max_id FROM messages WHERE is_deleted = false GROUP BY topic_id) latest ON latest.topic_id = t.id
       LEFT JOIN messages m ON m.id = latest.max_id LEFT JOIN users mu ON m.user_id = mu.id
       WHERE t.is_active = true AND t.last_activity >= ?
       ORDER BY t.last_activity DESC LIMIT ?`,
      [time.formatDatabaseTime(new Date(time.nowMs() - 7 * 24 * 3600 * 1000)), limit]
    );
    return rows.map(row => formatTopicRow(row, row));
  }

  static async getNewTopicsWithLatestMessage(limit: number = 10): Promise<Record<string, unknown>[]> {
    const rows = await db.all(
      `SELECT t.*, u.id as "creatorId", u.username as "creatorName", u.avatar_url as "creatorAvatar",
        m.id as msg_id, m.content as msg_content, m.created_at as msg_created_at,
        mu.username as msg_senderName, mu.avatar_url as msg_senderAvatar
       FROM topics t LEFT JOIN users u ON t.created_by = u.id
       LEFT JOIN (SELECT topic_id, MAX(id) as max_id FROM messages WHERE is_deleted = false GROUP BY topic_id) latest ON latest.topic_id = t.id
       LEFT JOIN messages m ON m.id = latest.max_id LEFT JOIN users mu ON m.user_id = mu.id
       WHERE t.is_active = true ORDER BY t.id DESC LIMIT ?`,
      [limit]
    );
    return rows.map(row => formatTopicRow(row, row));
  }
}

export default Topic;
