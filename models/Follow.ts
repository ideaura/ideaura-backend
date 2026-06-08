import db from '../config/database.ts';
import time from '../utils/time.ts';

interface FollowRow {
  id: number;
  follower_id: number;
  following_id: number;
  status: string;
  created_at: string;
  updated_at: string | null;
}

class Follow {
  static async follow(followerId: number, followingId: number): Promise<{ id: number; status: string; alreadyFollowing?: boolean }> {
    const currentTime = time.currentDbString();

    const existing = await db.get<FollowRow>(
      "SELECT id, status FROM follows WHERE follower_id = ? AND following_id = ?",
      [followerId, followingId]
    );

    if (existing) {
      if (existing.status !== 'active') {
        await db.run(
          "UPDATE follows SET status = ?, updated_at = ? WHERE id = ?",
          ['active', currentTime, existing.id]
        );
        return { id: existing.id, status: 'active' };
      }
      return { id: existing.id, status: 'active', alreadyFollowing: true };
    }

    const result = await db.run(
      "INSERT INTO follows (follower_id, following_id, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?) RETURNING id",
      [followerId, followingId, 'active', currentTime, currentTime]
    );
    return { id: result.lastID ?? 0, status: 'active' };
  }

  static async unfollow(followerId: number, followingId: number): Promise<{ changes: number }> {
    const result = await db.run(
      "UPDATE follows SET status = ?, updated_at = ? WHERE follower_id = ? AND following_id = ? AND status = 'active'",
      ['inactive', time.currentDbString(), followerId, followingId]
    );
    return { changes: result.changes };
  }

  static async isFollowing(followerId: number, followingId: number): Promise<boolean> {
    const row = await db.get<{ id: number }>(
      "SELECT id FROM follows WHERE follower_id = ? AND following_id = ? AND status = 'active'",
      [followerId, followingId]
    );
    return !!row;
  }

  static async getFollowingList(userId: number, page: number = 1, limit: number = 10): Promise<Record<string, unknown>[]> {
    const offset = (page - 1) * limit;
    const rows = await db.all(
      `SELECT f.*, u.username, u.registration_order, u.avatar_url as "avatarUrl", u.is_bot as "isBot"
       FROM follows f
       JOIN users u ON f.following_id = u.id
       WHERE f.follower_id = ? AND f.status = 'active'
       ORDER BY f.created_at DESC
       LIMIT ? OFFSET ?`,
      [userId, limit, offset]
    );
    return rows.map(row => ({
      ...row,
      createdAt: time.formatLocalTime(row.created_at),
      updatedAt: row.updated_at ? time.formatLocalTime(row.updated_at) : null
    }));
  }

  static async getFollowerList(userId: number, page: number = 1, limit: number = 10): Promise<Record<string, unknown>[]> {
    const offset = (page - 1) * limit;
    const rows = await db.all(
      `SELECT f.*, u.username, u.registration_order, u.avatar_url as "avatarUrl", u.is_bot as "isBot"
       FROM follows f
       JOIN users u ON f.follower_id = u.id
       WHERE f.following_id = ? AND f.status = 'active'
       ORDER BY f.created_at DESC
       LIMIT ? OFFSET ?`,
      [userId, limit, offset]
    );
    return rows.map(row => ({
      ...row,
      createdAt: time.formatLocalTime(row.created_at),
      updatedAt: row.updated_at ? time.formatLocalTime(row.updated_at) : null
    }));
  }

  static async getFollowingCount(userId: number): Promise<number> {
    const row = await db.get<{ count: number }>(
      "SELECT COUNT(*) as count FROM follows WHERE follower_id = ? AND status = 'active'",
      [userId]
    );
    return row?.count ?? 0;
  }

  static async getFollowerCount(userId: number): Promise<number> {
    const row = await db.get<{ count: number }>(
      "SELECT COUNT(*) as count FROM follows WHERE following_id = ? AND status = 'active'",
      [userId]
    );
    return row?.count ?? 0;
  }
}

export default Follow;
