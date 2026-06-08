import db from '../config/database.ts';
import time from '../utils/time.ts';

interface PostRow {
  id: number;
  community_id: number | null;
  user_id: number;
  subsection_id: number | null;
  category_id: number | null;
  title: string;
  content: string | null;
  tags: string | null;
  attachment_urls: string | null;
  type: string;
  content_type: string;
  view_count: number;
  like_count: number;
  comment_count: number;
  share_count: number;
  status: string;
  published_at: string | null;
  created_at: string;
  updated_at: string | null;
}

class Post {
  static async create(postData: {
    community_id: number | null;
    user_id: number;
    subsection_id?: number | null;
    title: string;
    content?: string | null;
    tags?: string | null;
    attachment_urls?: string | null;
    type?: string;
    category_id?: number | null;
    content_type?: string;
  }): Promise<number> {
    const { community_id, user_id, subsection_id = null, title, content = null, tags = null, attachment_urls = null, type = 'discussion', category_id = null, content_type = 'text' } = postData;
    const currentTime = time.currentDbString();

    const result = await db.run(
      "INSERT INTO posts (community_id, user_id, subsection_id, title, content, tags, attachment_urls, type, category_id, content_type, created_at, updated_at, published_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id",
      [community_id, user_id, subsection_id, title, content, tags, attachment_urls, type, category_id, content_type, currentTime, currentTime, currentTime]
    );
    return result.lastID ?? 0;
  }

  static async findById(id: number): Promise<Record<string, unknown> | undefined> {
    const row = await db.get<PostRow & { author_name?: string; author_avatar?: string; author_is_bot?: boolean; community_name?: string; subsection_name?: string }>(
      `SELECT p.*, u.username as author_name, u.avatar_url as author_avatar, u.is_bot as author_is_bot, c.name as community_name, s.name as subsection_name
       FROM posts p
       LEFT JOIN users u ON p.user_id = u.id
       LEFT JOIN communities c ON p.community_id = c.id
       LEFT JOIN subsections s ON p.subsection_id = s.id
       WHERE p.id = ? AND p.status = 'published'`,
      [id]
    );
    if (!row) return undefined;
    row.created_at = time.formatLocalTime(row.created_at);
    row.updated_at = row.updated_at ? time.formatLocalTime(row.updated_at) : null;
    row.published_at = row.published_at ? time.formatLocalTime(row.published_at) : null;
    return row;
  }

  static async findByCommunity(communityId: number, limit: number = 20, offset: number = 0): Promise<Record<string, unknown>[]> {
    const rows = await db.all<PostRow & { author_name?: string; author_avatar?: string; author_is_bot?: boolean; community_name?: string; subsection_name?: string }>(
      `SELECT p.*, u.username as author_name, u.avatar_url as author_avatar, u.is_bot as author_is_bot, c.name as community_name, s.name as subsection_name
       FROM posts p
       LEFT JOIN users u ON p.user_id = u.id
       LEFT JOIN communities c ON p.community_id = c.id
       LEFT JOIN subsections s ON p.subsection_id = s.id
       WHERE p.community_id = ? AND p.status = 'published'
       ORDER BY p.created_at DESC
       LIMIT ? OFFSET ?`,
      [communityId, limit, offset]
    );
    return rows.map(row => ({
      ...row,
      created_at: time.formatLocalTime(row.created_at),
      updated_at: row.updated_at ? time.formatLocalTime(row.updated_at) : null,
      published_at: row.published_at ? time.formatLocalTime(row.published_at) : null
    }));
  }

  static async findByUser(userId: number, page: number = 1, limit: number = 10, type?: string): Promise<Record<string, unknown>[]> {
    const offset = (page - 1) * limit;
    let sql = "SELECT p.*, u.username as author_name, c.name as community_name FROM posts p LEFT JOIN users u ON p.user_id = u.id LEFT JOIN communities c ON p.community_id = c.id WHERE p.user_id = ? AND p.status = 'published'";
    const params: unknown[] = [userId];
    if (type) { sql += " AND p.type = ?"; params.push(type); }
    sql += " ORDER BY p.created_at DESC LIMIT ? OFFSET ?";
    params.push(limit, offset);
    const rows = await db.all<PostRow & { author_name?: string; community_name?: string }>(sql, params);
    return rows.map(row => ({
      ...row,
      created_at: time.formatLocalTime(row.created_at),
      updated_at: row.updated_at ? time.formatLocalTime(row.updated_at) : null,
      published_at: row.published_at ? time.formatLocalTime(row.published_at) : null
    }));
  }

  static async getAll(page: number = 1, limit: number = 10, type?: string): Promise<Record<string, unknown>[]> {
    const offset = (page - 1) * limit;
    let sql = "SELECT p.*, u.username as author_name, c.name as community_name FROM posts p LEFT JOIN users u ON p.user_id = u.id LEFT JOIN communities c ON p.community_id = c.id WHERE p.status = 'published'";
    const params: unknown[] = [];
    if (type) { sql += " AND p.type = ?"; params.push(type); }
    sql += " ORDER BY p.created_at DESC LIMIT ? OFFSET ?";
    params.push(limit, offset);
    const rows = await db.all<PostRow & { author_name?: string; community_name?: string }>(sql, params);
    return rows.map(row => ({
      ...row,
      created_at: time.formatLocalTime(row.created_at),
      updated_at: row.updated_at ? time.formatLocalTime(row.updated_at) : null,
      published_at: row.published_at ? time.formatLocalTime(row.published_at) : null
    }));
  }

  static async update(id: number, userId: number, updates: Record<string, unknown>): Promise<{ changes: number }> {
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
    values.push(id);
    values.push(userId);

    const result = await db.run(
      `UPDATE posts SET ${sets.join(', ')} WHERE id = ? AND user_id = ?`,
      values
    );
    return { changes: result.changes };
  }

  static async delete(id: number, userId: number): Promise<{ changes: number }> {
    const result = await db.run(
      "UPDATE posts SET status = 'deleted', updated_at = ? WHERE id = ? AND user_id = ?",
      [time.currentDbString(), id, userId]
    );
    return { changes: result.changes };
  }

  static async incrementViewCount(id: number): Promise<void> {
    await db.run("UPDATE posts SET view_count = view_count + 1 WHERE id = ?", [id]);
  }

  static async search(query: string, communityId?: number | null, limit = 20, offset = 0): Promise<Record<string, unknown>[]> {
    const sq = `%${query}%`; const params: unknown[] = [sq, sq];
    let sql = `SELECT p.*, u.username as author_name, c.name as community_name FROM posts p LEFT JOIN users u ON p.user_id=u.id LEFT JOIN communities c ON p.community_id=c.id WHERE p.status='published' AND (p.title LIKE ? OR p.content LIKE ?)`;
    if (communityId) { sql += ' AND p.community_id=?'; params.push(communityId); }
    else { sql += " AND p.type='blog'"; }
    sql += ' ORDER BY p.created_at DESC LIMIT ? OFFSET ?'; params.push(limit, offset);
    const rows = await db.all<PostRow & { author_name?: string; community_name?: string }>(sql, params);
    return rows.map(r => ({ ...r, created_at: time.formatLocalTime(r.created_at), updated_at: r.updated_at ? time.formatLocalTime(r.updated_at) : null, published_at: r.published_at ? time.formatLocalTime(r.published_at) : null }));
  }

  static async belongsToUser(postId: number, userId: number): Promise<boolean> {
    const row = await db.get<{ 1?: number }>("SELECT 1 FROM posts WHERE id=? AND user_id=?", [postId, userId]);
    return !!row;
  }

  static async getPopularTags(limit = 20): Promise<{ name: string; count: number }[]> {
    const rows = await db.all<{ tags: string }>("SELECT tags FROM posts WHERE type='blog' AND tags IS NOT NULL AND status='published'");
    const tc: Record<string, number> = {};
    let parseErrors = 0;
    for (const r of rows) {
      let tags: string[] = [];
      if (typeof r.tags === 'string' && r.tags.length > 0) {
        try {
          const parsed = JSON.parse(r.tags);
          if (Array.isArray(parsed)) tags = parsed;
          else if (typeof parsed === 'string') tags = [parsed];
          else { parseErrors++; continue; }
        } catch {
          // Not valid JSON — treat as comma-separated plain text
          tags = r.tags.split(',').map(t => t.trim()).filter(Boolean);
          if (tags.length === 0) tags = [r.tags.trim()];
        }
      }
      for (const t of tags) {
        const tr = (typeof t === 'string' ? t : String(t)).trim();
        if (tr) tc[tr] = (tc[tr] || 0) + 1;
      }
    }
    if (parseErrors > 0) console.debug(`[Post] getPopularTags: ${parseErrors} 条记录无法解析 tags`);
    return Object.entries(tc).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, limit);
  }
}

export default Post;
