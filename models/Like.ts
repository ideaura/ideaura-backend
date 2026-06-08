import db from '../config/database.ts';
import time from '../utils/time.ts';

interface LikeRow {
  id: number;
  user_id: number;
  target_type: string;
  target_id: number;
  created_at: string;
}

interface LikeStatus {
  id?: number;
  status: string;
  alreadyLiked?: boolean;
}

class Like {
  static async like(userId: number, momentId: number | null = null, postId: number | null = null): Promise<LikeStatus> {
    const currentTime = time.currentDbString();

    if ((momentId === null && postId === null) || (momentId !== null && postId !== null)) {
      throw new Error('必须指定动态ID或帖子ID之一，不能同时指定或都不指定');
    }

    const target_type = momentId !== null ? 'moment' : 'post';
    const target_id = momentId !== null ? momentId : postId!;

    const existing = await db.get<{ id: number }>(
      "SELECT id FROM likes WHERE user_id = ? AND target_type = ? AND target_id = ?",
      [userId, target_type, target_id]
    );

    if (existing) {
      return { id: existing.id, status: 'active', alreadyLiked: true };
    }

    try {
      const result = await db.run(
        "INSERT INTO likes (user_id, target_type, target_id, created_at) VALUES (?, ?, ?, ?) RETURNING id",
        [userId, target_type, target_id, currentTime]
      );

      if (target_type === 'post') {
        await db.run("UPDATE posts SET like_count = like_count + 1 WHERE id = ?", [target_id]);
      }

      return { id: result.lastID ?? 0, status: 'active' };
    } catch (err) {
      if ((err as { code?: string }).code === '23505') {
        return { status: 'active', alreadyLiked: true };
      }
      throw err;
    }
  }

  static async unlike(userId: number, momentId: number | null = null, postId: number | null = null): Promise<{ changes: number }> {
    if ((momentId === null && postId === null) || (momentId !== null && postId !== null)) {
      throw new Error('必须指定动态ID或帖子ID之一，不能同时指定或都不指定');
    }

    const target_type = momentId !== null ? 'moment' : 'post';
    const target_id = momentId !== null ? momentId : postId!;

    const result = await db.run(
      "DELETE FROM likes WHERE user_id = ? AND target_type = ? AND target_id = ?",
      [userId, target_type, target_id]
    );

    if (result.changes > 0 && target_type === 'post') {
      await db.run(
        "UPDATE posts SET like_count = CASE WHEN like_count > 0 THEN like_count - 1 ELSE 0 END WHERE id = ?",
        [target_id]
      );
    }

    return { changes: result.changes };
  }

  static async isLiked(userId: number, momentId: number | null = null, postId: number | null = null): Promise<boolean> {
    if ((momentId === null && postId === null) || (momentId !== null && postId !== null)) {
      throw new Error('必须指定动态ID或帖子ID之一，不能同时指定或都不指定');
    }

    const target_type = momentId !== null ? 'moment' : 'post';
    const target_id = momentId !== null ? momentId : postId!;

    const row = await db.get<{ id: number }>(
      "SELECT id FROM likes WHERE user_id = ? AND target_type = ? AND target_id = ?",
      [userId, target_type, target_id]
    );
    return !!row;
  }

  static async getLikesCount(momentId: number | null = null, postId: number | null = null): Promise<number> {
    if ((momentId === null && postId === null) || (momentId !== null && postId !== null)) {
      throw new Error('必须指定动态ID或帖子ID之一，不能同时指定或都不指定');
    }

    const target_type = momentId !== null ? 'moment' : 'post';
    const target_id = momentId !== null ? momentId : postId!;

    const row = await db.get<{ count: string }>(
      "SELECT COUNT(*) as count FROM likes WHERE target_type = ? AND target_id = ?",
      [target_type, target_id]
    );
    return row ? parseInt(String(row.count)) : 0;
  }

  static async getUserLikeStatus(userId: number, momentId: number | null = null, postId: number | null = null): Promise<LikeStatus | null> {
    if ((momentId === null && postId === null) || (momentId !== null && postId !== null)) {
      throw new Error('必须指定动态ID或帖子ID之一，不能同时指定或都不指定');
    }

    const target_type = momentId !== null ? 'moment' : 'post';
    const target_id = momentId !== null ? momentId : postId!;

    const row = await db.get<{ id: number }>(
      "SELECT id FROM likes WHERE user_id = ? AND target_type = ? AND target_id = ?",
      [userId, target_type, target_id]
    );
    return row ? { id: row.id, status: 'active' } : null;
  }

  static async getLikesByContentId(momentId: number | null = null, postId: number | null = null, page: number = 1, limit: number = 10): Promise<Record<string, unknown>[]> {
    if ((momentId === null && postId === null) || (momentId !== null && postId !== null)) {
      throw new Error('必须指定动态ID或帖子ID之一，不能同时指定或都不指定');
    }

    const offset = (page - 1) * limit;
    const target_type = momentId !== null ? 'moment' : 'post';
    const target_id = momentId !== null ? momentId : postId!;

    const rows = await db.all(
      `SELECT l.*, u.username, u.registration_order
       FROM likes l
       JOIN users u ON l.user_id = u.id
       WHERE l.target_type = ? AND l.target_id = ?
       ORDER BY l.created_at DESC
       LIMIT ? OFFSET ?`,
      [target_type, target_id, limit, offset]
    );

    return rows.map(row => ({
      ...row,
      createdAt: time.formatLocalTime(row.created_at)
    }));
  }

  static getLikesByMomentId(momentId: number, page: number = 1, limit: number = 10): Promise<Record<string, unknown>[]> {
    return Like.getLikesByContentId(momentId, null, page, limit);
  }

  static getLikesByPostId(postId: number, page: number = 1, limit: number = 10): Promise<Record<string, unknown>[]> {
    return Like.getLikesByContentId(null, postId, page, limit);
  }
}

export default Like;
