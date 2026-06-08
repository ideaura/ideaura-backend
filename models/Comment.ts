import db from '../config/database.ts';
import time from '../utils/time.ts';

interface CommentRow {
  id: number;
  user_id: number;
  target_type: string;
  target_id: number;
  content: string;
  parent_id: number | null;
  status: string;
  deleted_at: string | null;
  created_at: string;
  updated_at: string | null;
}

interface CommentWithUser extends CommentRow {
  username?: string;
  userAvatar?: string;
  registration_order?: number;
  isBot?: boolean;
}

class Comment {
  static async create(userId: number, content: string, momentId: number | null = null, postId: number | null = null, parentId: number | null = null): Promise<{
    id: number;
    userId: number;
    momentId: number | null;
    postId: number | null;
    content: string;
    parentId: number | null;
    createdAt: string;
  }> {
    const currentTime = time.currentDbString();

    if ((momentId === null && postId === null) || (momentId !== null && postId !== null)) {
      throw new Error('必须指定动态ID或帖子ID之一，不能同时指定或都不指定');
    }

    const target_type = momentId !== null ? 'moment' : 'post';
    const target_id = momentId !== null ? momentId : postId!;

    const result = await db.run(
      "INSERT INTO comments (user_id, target_type, target_id, content, parent_id, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 'active', ?, ?) RETURNING id",
      [userId, target_type, target_id, content, parentId ?? null, currentTime, currentTime]
    );

    return {
      id: result.lastID ?? 0,
      userId,
      momentId,
      postId,
      content,
      parentId,
      createdAt: currentTime
    };
  }

  static async getByMomentId(momentId: number, page: number = 1, limit: number = 10): Promise<CommentWithUser[]> {
    const offset = (page - 1) * limit;

    const rows = await db.all<CommentWithUser>(
      `SELECT c.*, u.username, u.avatar_url as "userAvatar", u.registration_order, u.is_bot as "isBot"
       FROM comments c
       JOIN users u ON c.user_id = u.id
       WHERE c.target_type = 'moment' AND c.target_id = ?
         AND c.parent_id IS NULL AND c.status = 'active'
       ORDER BY c.created_at DESC
       LIMIT ? OFFSET ?`,
      [momentId, limit, offset]
    );

    return rows.map(row => ({
      ...row,
      createdAt: time.formatLocalTime(row.created_at)
    }));
  }

  static async getByPostId(postId: number, page: number = 1, limit: number = 10): Promise<CommentWithUser[]> {
    const offset = (page - 1) * limit;

    const rows = await db.all<CommentWithUser>(
      `SELECT c.*, u.username, u.avatar_url as "userAvatar", u.registration_order, u.is_bot as "isBot"
       FROM comments c
       JOIN users u ON c.user_id = u.id
       WHERE c.target_type = 'post' AND c.target_id = ?
         AND c.parent_id IS NULL AND c.status = 'active'
       ORDER BY c.created_at DESC
       LIMIT ? OFFSET ?`,
      [postId, limit, offset]
    );

    return rows.map(row => ({
      ...row,
      createdAt: time.formatLocalTime(row.created_at)
    }));
  }

  static async getReplies(commentId: number): Promise<CommentWithUser[]> {
    const rows = await db.all<CommentWithUser>(
      `SELECT c.*, u.username, u.avatar_url as "userAvatar", u.registration_order, u.is_bot as "isBot"
       FROM comments c
       JOIN users u ON c.user_id = u.id
       WHERE c.parent_id = ? AND c.status = 'active'
       ORDER BY c.created_at ASC`,
      [commentId]
    );

    return rows.map(row => ({
      ...row,
      createdAt: time.formatLocalTime(row.created_at)
    }));
  }

  static async delete(commentId: number, userId: number): Promise<{ changes: number }> {
    const result = await db.run(
      "UPDATE comments SET status = 'deleted', deleted_at = ? WHERE id = ? AND user_id = ?",
      [time.currentDbString(), commentId, userId]
    );
    return { changes: result.changes };
  }

  static async getCount(momentId: number | null = null, postId: number | null = null): Promise<number> {
    if ((momentId === null && postId === null) || (momentId !== null && postId !== null)) {
      throw new Error('必须指定动态ID或帖子ID之一，不能同时指定或都不指定');
    }

    const target_type = momentId !== null ? 'moment' : 'post';
    const target_id = momentId !== null ? momentId : postId!;

    const row = await db.get<{ count: string }>(
      "SELECT COUNT(*) as count FROM comments WHERE target_type = ? AND target_id = ? AND status = 'active'",
      [target_type, target_id]
    );
    return row ? parseInt(String(row.count)) : 0;
  }
}

export default Comment;
