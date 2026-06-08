import db from '../config/database.ts';
import time from '../utils/time.ts';

interface CommunityRow {
  id: number;
  topic_id: number | null;
  name: string;
  description: string | null;
  tags: string | null;
  avatar_url: string | null;
  cover_image_url: string | null;
  created_by: number;
  type: string;
  join_policy: string;
  member_count: number;
  post_count: number;
  is_active: boolean;
  created_at: string;
  updated_at: string | null;
}

class Community {
  static async create(communityData: {
    topic_id: number | null;
    name: string;
    description?: string | null;
    tags?: string | null;
    avatar_url?: string | null;
    cover_image_url?: string | null;
    created_by: number;
    type?: string;
    join_policy?: string;
  }): Promise<number> {
    const { topic_id, name, description = null, tags = null, avatar_url = null, cover_image_url = null, created_by, type = 'public', join_policy = 'open' } = communityData;
    const currentTime = time.currentDbString();

    const result = await db.run(
      "INSERT INTO communities (topic_id, name, description, tags, avatar_url, cover_image_url, created_by, type, join_policy, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id",
      [topic_id, name, description, tags, avatar_url, cover_image_url, created_by, type, join_policy, currentTime, currentTime]
    );
    return result.lastID ?? 0;
  }

  static async findById(id: number): Promise<Record<string, unknown> | undefined> {
    const row = await db.get<CommunityRow & { creator_name?: string }>(
      `SELECT c.*, u.username as creator_name
       FROM communities c
       LEFT JOIN users u ON c.created_by = u.id
       WHERE c.id = ? AND c.is_active = true`,
      [id]
    );
    if (!row) return undefined;
    row.created_at = time.formatLocalTime(row.created_at);
    row.updated_at = row.updated_at ? time.formatLocalTime(row.updated_at) : null;
    return row;
  }

  static async findByTopicId(topicId: number): Promise<Record<string, unknown> | undefined> {
    const row = await db.get<CommunityRow & { creator_name?: string }>(
      `SELECT c.*, u.username as creator_name
       FROM communities c
       LEFT JOIN users u ON c.created_by = u.id
       WHERE c.topic_id = ? AND c.is_active = true`,
      [topicId]
    );
    if (!row) return undefined;
    row.created_at = time.formatLocalTime(row.created_at);
    row.updated_at = row.updated_at ? time.formatLocalTime(row.updated_at) : null;
    return row;
  }

  static async getAll(page: number = 1, limit: number = 10): Promise<Record<string, unknown>[]> {
    const offset = (page - 1) * limit;
    const rows = await db.all<CommunityRow & { creator_name?: string }>(
      `SELECT c.*, u.username as creator_name
       FROM communities c
       LEFT JOIN users u ON c.created_by = u.id
       WHERE c.is_active = true
       ORDER BY c.created_at DESC
       LIMIT ? OFFSET ?`,
      [limit, offset]
    );
    return rows.map(row => ({
      ...row,
      created_at: time.formatLocalTime(row.created_at),
      updated_at: row.updated_at ? time.formatLocalTime(row.updated_at) : null
    }));
  }

  static async getRecommended(page: number = 1, limit: number = 10): Promise<Record<string, unknown>[]> {
    const offset = (page - 1) * limit;
    const rows = await db.all<CommunityRow & { creator_name?: string }>(
      `SELECT c.*, u.username as creator_name
       FROM communities c
       LEFT JOIN users u ON c.created_by = u.id
       WHERE c.is_active = true AND c.type != 'private'
       ORDER BY (c.member_count + COALESCE(c.post_count, 0)) DESC, c.created_at DESC
       LIMIT ? OFFSET ?`,
      [limit, offset]
    );
    return rows.map(row => ({
      ...row,
      created_at: time.formatLocalTime(row.created_at),
      updated_at: row.updated_at ? time.formatLocalTime(row.updated_at) : null
    }));
  }

  static async getJoinedByUser(userId: number): Promise<Record<string, unknown>[]> {
    const rows = await db.all<CommunityRow & { creator_name?: string }>(
      `SELECT c.*, u.username as creator_name
       FROM communities c
       LEFT JOIN users u ON c.created_by = u.id
       INNER JOIN community_members cm ON cm.community_id = c.id
       WHERE cm.user_id = ? AND cm.status = 'active' AND c.is_active = true
       ORDER BY cm.joined_at DESC`,
      [userId]
    );
    return rows.map(row => ({
      ...row,
      created_at: time.formatLocalTime(row.created_at),
      updated_at: row.updated_at ? time.formatLocalTime(row.updated_at) : null
    }));
  }

  static async search(query: string, limit: number = 20, offset: number = 0): Promise<Record<string, unknown>[]> {
    const pattern = `%${query}%`;
    const rows = await db.all<CommunityRow & { creator_name?: string }>(
      `SELECT c.*, u.username as creator_name FROM communities c LEFT JOIN users u ON c.created_by = u.id
       WHERE c.is_active = true AND (c.name LIKE ? OR c.description LIKE ? OR c.tags LIKE ?)
       ORDER BY c.member_count DESC LIMIT ? OFFSET ?`,
      [pattern, pattern, pattern, limit, offset]
    );
    return rows.map(row => ({
      ...row, created_at: time.formatLocalTime(row.created_at),
      updated_at: row.updated_at ? time.formatLocalTime(row.updated_at) : null
    }));
  }

  static async getCreatedByUser(userId: number, limit: number = 20, offset: number = 0): Promise<Record<string, unknown>[]> {
    const rows = await db.all<CommunityRow & { creator_name?: string }>(
      `SELECT c.*, u.username as creator_name FROM communities c LEFT JOIN users u ON c.created_by = u.id
       WHERE c.created_by = ? AND c.is_active = true ORDER BY c.created_at DESC LIMIT ? OFFSET ?`,
      [userId, limit, offset]
    );
    return rows.map(row => ({
      ...row, created_at: time.formatLocalTime(row.created_at),
      updated_at: row.updated_at ? time.formatLocalTime(row.updated_at) : null
    }));
  }

  static async updateAvatar(communityId: number, userId: number, avatarUrl: string): Promise<void> {
    await db.run("UPDATE communities SET avatar_url = ?, updated_at = ? WHERE id = ? AND created_by = ?",
      [avatarUrl, time.currentDbString(), communityId, userId]);
  }

  static async getAdmins(communityId: number): Promise<Record<string, unknown>[]> {
    return db.all(
      `SELECT cm.*, u.username, u.avatar_url FROM community_members cm JOIN users u ON cm.user_id = u.id
       WHERE cm.community_id = ? AND cm.status = 'active' AND cm.role IN ('owner','admin')`,
      [communityId]
    );
  }

  static async join(communityId: number, userId: number, role: string = 'member'): Promise<void> {
    await db.run(
      "INSERT INTO community_members (community_id, user_id, role, joined_at) VALUES (?, ?, ?, ?) ON CONFLICT (community_id, user_id) DO UPDATE SET status = 'active', role = ?",
      [communityId, userId, role, time.currentDbString(), role]
    );
  }

  static async leave(communityId: number, userId: number): Promise<void> {
    await db.run(
      "UPDATE community_members SET status = 'inactive', left_at = ? WHERE community_id = ? AND user_id = ?",
      [time.currentDbString(), communityId, userId]
    );
  }

  static async getMembers(communityId: number, page: number = 1, limit: number = 20): Promise<Record<string, unknown>[]> {
    const offset = (page - 1) * limit;
    const rows = await db.all(
      `SELECT cm.*, u.username, u.avatar_url, u.is_bot
       FROM community_members cm
       JOIN users u ON cm.user_id = u.id
       WHERE cm.community_id = ? AND cm.status = 'active'
       ORDER BY cm.joined_at ASC
       LIMIT ? OFFSET ?`,
      [communityId, limit, offset]
    );
    return rows;
  }

  static async isMember(communityId: number, userId: number): Promise<boolean> {
    const row = await db.get<{ id: number }>(
      "SELECT id FROM community_members WHERE community_id = ? AND user_id = ? AND status = 'active'",
      [communityId, userId]
    );
    return !!row;
  }

  static async getMemberCount(communityId: number): Promise<number> {
    const row = await db.get<{ count: string }>(
      "SELECT COUNT(*) as count FROM community_members WHERE community_id = ? AND status = 'active'",
      [communityId]
    );
    return row ? parseInt(String(row.count)) : 0;
  }

  static async update(communityId: number, updates: Record<string, unknown>): Promise<{ changes: number }> {
    const sets: string[] = [];
    const values: unknown[] = [];

    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined) {
        sets.push(`${key} = ?`);
        values.push(value);
      }
    }

    if (sets.length === 0) return { changes: 0 };

    sets.push('updated_at = ?');
    values.push(time.currentDbString());
    values.push(communityId);

    const result = await db.run(
      `UPDATE communities SET ${sets.join(', ')} WHERE id = ?`,
      values
    );
    return { changes: result.changes };
  }

  static async delete(communityId: number): Promise<{ changes: number }> {
    const result = await db.run(
      "UPDATE communities SET is_active = false, updated_at = ? WHERE id = ?",
      [time.currentDbString(), communityId]
    );
    return { changes: result.changes };
  }

  static async findBatchByTopicIds(topicIds: number[]): Promise<Record<number, Record<string, unknown>>> {
    if (!topicIds.length) return {};
    const placeholders = topicIds.map(() => '?').join(',');
    const rows = await db.all<CommunityRow & { creator_name?: string }>(
      `SELECT c.*, u.username as creator_name FROM communities c LEFT JOIN users u ON c.created_by = u.id WHERE c.topic_id IN (${placeholders}) AND c.is_active = true`, topicIds);
    const map: Record<number, Record<string, unknown>> = {};
    for (const r of rows) { map[r.topic_id!] = { ...r, created_at: time.formatLocalTime(r.created_at), updated_at: r.updated_at ? time.formatLocalTime(r.updated_at) : null }; }
    return map;
  }

  static async setRole(communityId: number, userId: number, role: string): Promise<void> {
    await db.run("UPDATE community_members SET role = ? WHERE community_id = ? AND user_id = ?", [role, communityId, userId]);
  }

  static async removeMember(communityId: number, userId: number): Promise<void> {
    await db.run("UPDATE community_members SET status = 'inactive', left_at = ? WHERE community_id = ? AND user_id = ?", [time.currentDbString(), communityId, userId]);
  }

  static async getRole(communityId: number, userId: number): Promise<string | null> {
    const row = await db.get<{ role: string }>("SELECT role FROM community_members WHERE community_id = ? AND user_id = ? AND status = 'active'", [communityId, userId]);
    return row?.role ?? null;
  }

  static async incrementMemberCount(communityId: number): Promise<void> {
    await db.run("UPDATE communities SET member_count = member_count + 1 WHERE id = ?", [communityId]);
  }

  static async decrementMemberCount(communityId: number): Promise<void> {
    await db.run("UPDATE communities SET member_count = CASE WHEN member_count > 0 THEN member_count - 1 ELSE 0 END WHERE id = ?", [communityId]);
  }

  static async incrementPostCount(communityId: number): Promise<void> {
    await db.run("UPDATE communities SET post_count = post_count + 1 WHERE id = ?", [communityId]);
  }

  static async countByName(name: string): Promise<number> {
    const row = await db.get<{ count: string }>("SELECT COUNT(*) as count FROM communities WHERE name = ?", [name]);
    return row ? parseInt(row.count) : 0;
  }
}

export default Community;
