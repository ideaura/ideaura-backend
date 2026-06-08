import db from '../config/database.ts';
import time from '../utils/time.ts';

interface MomentRow {
  id: number; user_id: number; content: string; type: string; visibility: string;
  media_urls: string | null; video_url: string | null; likes_count: number; comments_count: number;
  deleted_at: string | null; created_at: string; updated_at: string | null;
}

class Moment {
  private static formatRow(row: MomentRow & Record<string, unknown>): Record<string, unknown> {
    return {
      ...row, createdAt: time.formatLocalTime(row.created_at),
      updatedAt: row.updated_at ? time.formatLocalTime(row.updated_at as string) : null,
      deletedAt: row.deleted_at ? time.formatLocalTime(row.deleted_at as string) : null,
      mediaUrls: row.media_urls ? (() => { try { return JSON.parse(row.media_urls as string); } catch { return row.media_urls; } })() : null,
      videoUrl: row.video_url ?? null
    };
  }

  static async create(userId: number, content: string, type = 'public', visibility = 'public', mediaUrls?: string[] | null, videoUrl?: string | null): Promise<Record<string, unknown>> {
    const t = time.currentDbString();
    const ms = mediaUrls ? JSON.stringify(mediaUrls) : null;
    const r = await db.run("INSERT INTO moments (user_id, content, type, visibility, media_urls, video_url, created_at) VALUES (?,?,?,?,?,?,?) RETURNING id", [userId, content, type, visibility, ms, videoUrl ?? null, t]);
    return { id: r.lastID ?? 0, userId, content, type, visibility, mediaUrls, videoUrl, createdAt: t };
  }

  static async findById(mid: number): Promise<Record<string, unknown> | undefined> {
    const row = await db.get<MomentRow & { username?: string; userAvatar?: string; isBot?: boolean }>(
      `SELECT m.*, u.username, u.avatar_url as "userAvatar", u.is_bot as "isBot" FROM moments m JOIN users u ON m.user_id=u.id WHERE m.id=?`, [mid]);
    return row ? Moment.formatRow(row) : undefined;
  }

  static async getPublicMoments(page = 1, limit = 10): Promise<Record<string, unknown>[]> {
    const rows = await db.all<MomentRow & { username?: string; userAvatar?: string; isBot?: boolean }>(
      `SELECT m.*, u.username, u.avatar_url as "userAvatar", u.is_bot as "isBot" FROM moments m JOIN users u ON m.user_id=u.id WHERE m.visibility='public' ORDER BY m.created_at DESC LIMIT ? OFFSET ?`, [limit, (page-1)*limit]);
    return rows.map(Moment.formatRow);
  }

  static async getUserMoments(userId: number, page = 1, limit = 10): Promise<Record<string, unknown>[]> {
    const rows = await db.all<MomentRow & { username?: string; userAvatar?: string }>(
      `SELECT m.*, u.username, u.avatar_url as "userAvatar" FROM moments m JOIN users u ON m.user_id=u.id WHERE m.user_id=? ORDER BY m.created_at DESC LIMIT ? OFFSET ?`, [userId, limit, (page-1)*limit]);
    return rows.map(Moment.formatRow);
  }

  static async getFriendMoments(userId: number, page = 1, limit = 10): Promise<Record<string, unknown>[]> {
    const rows = await db.all<MomentRow & { username?: string; userAvatar?: string; isBot?: boolean }>(
      `SELECT m.*, u.username, u.avatar_url as "userAvatar", u.is_bot as "isBot" FROM moments m JOIN users u ON m.user_id=u.id
       WHERE (m.user_id=? OR m.user_id IN (SELECT CASE WHEN f.user1_id=? THEN f.user2_id ELSE f.user1_id END FROM friends f WHERE (f.user1_id=? OR f.user2_id=?) AND f.status='accepted'))
       AND m.visibility IN ('public','friends') ORDER BY m.created_at DESC LIMIT ? OFFSET ?`,
      [userId, userId, userId, userId, limit, (page-1)*limit]);
    return rows.map(Moment.formatRow);
  }

  static async getFollowingPublicMoments(userId: number, page = 1, limit = 10): Promise<Record<string, unknown>[]> {
    const rows = await db.all<MomentRow & { username?: string; userAvatar?: string; isBot?: boolean }>(
      `SELECT m.*, u.username, u.avatar_url as "userAvatar", u.is_bot as "isBot" FROM moments m JOIN users u ON m.user_id=u.id
       WHERE m.user_id IN (SELECT following_id FROM follows WHERE follower_id=? AND status='active') AND m.visibility='public'
       ORDER BY m.created_at DESC LIMIT ? OFFSET ?`, [userId, limit, (page-1)*limit]);
    return rows.map(Moment.formatRow);
  }

  static async getTimeline(_userId: number, page = 1, limit = 10): Promise<Record<string, unknown>[]> {
    return Moment.getPublicMoments(page, limit);
  }

  static async findByUser(userId: number, page = 1, limit = 10): Promise<Record<string, unknown>[]> {
    return Moment.getUserMoments(userId, page, limit);
  }

  static async update(mid: number, userId: number, data: { content?: string; type?: string; visibility?: string }): Promise<{ changes: number }> {
    const sets: string[] = []; const vals: unknown[] = [];
    if (data.content !== undefined) { sets.push('content=?'); vals.push(data.content); }
    if (data.type !== undefined) { sets.push('type=?'); vals.push(data.type); }
    if (data.visibility !== undefined) { sets.push('visibility=?'); vals.push(data.visibility); }
    if (!sets.length) return { changes: 0 };
    sets.push('updated_at=?'); vals.push(time.currentDbString()); vals.push(mid); vals.push(userId);
    const r = await db.run(`UPDATE moments SET ${sets.join(',')} WHERE id=? AND user_id=?`, vals);
    return { changes: r.changes };
  }

  static async softDelete(mid: number, userId: number): Promise<{ changes: number }> {
    const t = time.currentDbString();
    const r = await db.run("UPDATE moments SET deleted_at=?, updated_at=? WHERE id=? AND user_id=?", [t, t, mid, userId]);
    return { changes: r.changes };
  }

  static async delete(mid: number, userId: number): Promise<{ changes: number }> {
    return Moment.softDelete(mid, userId);
  }

  static async getCount(userId: number): Promise<number> {
    const row = await db.get<{ count: string }>("SELECT COUNT(*) as count FROM moments WHERE user_id=? AND deleted_at IS NULL", [userId]);
    return row ? parseInt(row.count) : 0;
  }
}

export default Moment;
