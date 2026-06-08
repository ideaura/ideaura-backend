import db from '../config/database.ts';
import time from '../utils/time.ts';

interface FriendRow {
  id: number;
  user1_id: number;
  user2_id: number;
  status: string;
  created_at: string;
  updated_at: string | null;
}

class Friend {
  static async createFriendRequest(fromUserId: number, toUserId: number): Promise<{ id: number; status: string }> {
    const existingFriendship = await db.get<FriendRow>(
      "SELECT * FROM friends WHERE (user1_id = ? AND user2_id = ?) OR (user1_id = ? AND user2_id = ?)",
      [fromUserId, toUserId, toUserId, fromUserId]
    );

    if (existingFriendship) {
      await db.run(
        "UPDATE friends SET status = ?, updated_at = ? WHERE id = ?",
        ['pending', time.currentDbString(), existingFriendship.id]
      );
      return { id: existingFriendship.id, status: 'pending' };
    }

    const result = await db.run(
      "INSERT INTO friends (user1_id, user2_id, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?) RETURNING id",
      [fromUserId, toUserId, 'pending', time.currentDbString(), time.currentDbString()]
    );
    return { id: result.lastID ?? 0, status: 'pending' };
  }

  static async acceptFriendRequest(requestId: number, userId: number): Promise<{ id: number; status: string }> {
    const friendship = await db.get<FriendRow>(
      "SELECT * FROM friends WHERE id = ?",
      [requestId]
    );
    if (!friendship) throw new Error('好友请求不存在');
    if (friendship.user2_id !== userId) throw new Error('无权接受此好友请求');

    await db.run(
      "UPDATE friends SET status = ?, updated_at = ? WHERE id = ?",
      ['accepted', time.currentDbString(), requestId]
    );
    return { id: requestId, status: 'accepted' };
  }

  static async rejectFriendRequest(requestId: number, userId: number): Promise<{ id: number; status: string }> {
    const friendship = await db.get<FriendRow>(
      "SELECT * FROM friends WHERE id = ?",
      [requestId]
    );
    if (!friendship) throw new Error('好友请求不存在');
    // Allow rejecting if you're the receiver (user2) OR canceling if you're the sender (user1)
    if (friendship.user2_id !== userId && friendship.user1_id !== userId) throw new Error('无权操作此好友请求');

    await db.run(
      "UPDATE friends SET status = ?, updated_at = ? WHERE id = ?",
      ['rejected', time.currentDbString(), requestId]
    );
    return { id: requestId, status: 'rejected' };
  }

  static async removeFriend(userId: number, friendId: number): Promise<{ changes: number }> {
    const result = await db.run(
      "DELETE FROM friends WHERE (user1_id = ? AND user2_id = ?) OR (user1_id = ? AND user2_id = ?)",
      [userId, friendId, friendId, userId]
    );
    return { changes: result.changes };
  }

  static async areFriends(userId1: number, userId2: number): Promise<boolean> {
    const row = await db.get<{ id: number }>(
      "SELECT id FROM friends WHERE ((user1_id = ? AND user2_id = ?) OR (user1_id = ? AND user2_id = ?)) AND status = 'accepted'",
      [userId1, userId2, userId2, userId1]
    );
    return !!row;
  }

  static async getFriendList(userId: number): Promise<Record<string, unknown>[]> {
    const rows = await db.all(
      `SELECT f.id, u.id as "friendId", u.username as "friendName", u.avatar_url as "avatarUrl", u.is_bot as "isBot", u.registration_order as "friendRegistrationOrder",
              f.created_at, f.status, f.updated_at
       FROM friends f
       JOIN users u ON (f.user1_id = u.id OR f.user2_id = u.id)
       WHERE (f.user1_id = ? OR f.user2_id = ?) AND f.status = 'accepted' AND u.id != ?
       ORDER BY f.updated_at DESC`,
      [userId, userId, userId]
    );
    return rows.map(row => ({
      ...row,
      createdAt: time.formatLocalTime(row.created_at),
      updatedAt: row.updated_at ? time.formatLocalTime(row.updated_at) : null
    }));
  }

  static async getPendingRequests(userId: number): Promise<Record<string, unknown>[]> {
    const rows = await db.all(
      `SELECT f.*, u.username as "fromUserName", u.avatar_url as "fromUserAvatar", u.registration_order
       FROM friends f
       JOIN users u ON f.user1_id = u.id
       WHERE f.user2_id = ? AND f.status = 'pending'
       ORDER BY f.created_at DESC`,
      [userId]
    );
    return rows.map(row => ({
      ...row,
      createdAt: time.formatLocalTime(row.created_at)
    }));
  }

  static async getSentRequests(userId: number): Promise<Record<string, unknown>[]> {
    const rows = await db.all(
      `SELECT f.*, u.username as "toUserName", u.avatar_url as "toUserAvatar", u.registration_order
       FROM friends f
       JOIN users u ON f.user2_id = u.id
       WHERE f.user1_id = ? AND f.status = 'pending'
       ORDER BY f.created_at DESC`,
      [userId]
    );
    return rows.map(row => ({
      ...row,
      createdAt: time.formatLocalTime(row.created_at)
    }));
  }

  static async getFriendCount(userId: number): Promise<number> {
    const row = await db.get<{ count: string }>(
      "SELECT COUNT(*) as count FROM friends WHERE (user1_id = ? OR user2_id = ?) AND status = 'accepted'",
      [userId, userId]
    );
    return row ? parseInt(String(row.count)) : 0;
  }

  static async getStatus(userId1: number, userId2: number): Promise<string | null> {
    const row = await db.get<{ status: string }>(
      "SELECT status FROM friends WHERE (user1_id = ? AND user2_id = ?) OR (user1_id = ? AND user2_id = ?)",
      [userId1, userId2, userId2, userId1]
    );
    return row ? row.status : null;
  }
}

export default Friend;
