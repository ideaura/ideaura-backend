const db = require('../config/database');
const time = require('../utils/time');
const formatLocalTime = (...args) => time.formatLocalTime(...args);

class Friend {
  // 创建好友关系（双向）
  static async createFriendRequest(fromUserId, toUserId) {
    return new Promise((resolve, reject) => {
      // 检查是否已经存在好友关系
      db.get(
        `SELECT * FROM friends WHERE (user1_id = ? AND user2_id = ?) OR (user1_id = ? AND user2_id = ?)`,
        [fromUserId, toUserId, toUserId, fromUserId],
        (err, existingFriendship) => {
          if (err) return reject(err);

          if (existingFriendship) {
            // 如果已有关系，更新状态
            db.run(
              `UPDATE friends SET status = ?, updated_at = ? WHERE id = ?`,
              ['pending', time.currentDbString(), existingFriendship.id],
              function (err) {
                if (err) return reject(err);
                resolve({ id: existingFriendship.id, status: 'pending' });
              }
            );
          } else {
            // 创建新的好友关系记录
            db.run(
              `INSERT INTO friends (user1_id, user2_id, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?) RETURNING id`,
              [fromUserId, toUserId, 'pending', time.currentDbString(), time.currentDbString()],
              function (err) {
                if (err) return reject(err);
                resolve({ id: this.lastID, status: 'pending' });
              }
            );
          }
        }
      );
    });
  }

  // 接受好友请求
  static async acceptFriendRequest(requestId, userId) {
    return new Promise((resolve, reject) => {
      // 首先获取请求详情
      db.get(
        `SELECT * FROM friends WHERE id = ?`,
        [requestId],
        (err, friendship) => {
          if (err) return reject(err);
          if (!friendship) return reject(new Error('好友请求不存在'));

          // 检查是否是当前用户收到的请求
          if (friendship.user2_id !== userId) {
            return reject(new Error('无权接受此好友请求'));
          }

          // 更新状态为accepted
          db.run(
            `UPDATE friends SET status = ?, updated_at = ? WHERE id = ?`,
            ['accepted', time.currentDbString(), requestId],
            function (err) {
              if (err) return reject(err);
              resolve({ id: requestId, status: 'accepted' });
            }
          );
        }
      );
    });
  }

  // 拒绝好友请求
  static async rejectFriendRequest(requestId, userId) {
    return new Promise((resolve, reject) => {
      // 首先获取请求详情
      db.get(
        `SELECT * FROM friends WHERE id = ?`,
        [requestId],
        (err, friendship) => {
          if (err) return reject(err);
          if (!friendship) return reject(new Error('好友请求不存在'));

          // 检查是否是当前用户收到的请求
          if (friendship.user2_id !== userId) {
            return reject(new Error('无权拒绝此好友请求'));
          }

          // 删除好友请求
          db.run(
            `DELETE FROM friends WHERE id = ?`,
            [requestId],
            function (err) {
              if (err) return reject(err);
              resolve({ id: requestId, deleted: true });
            }
          );
        }
      );
    });
  }

  // 获取用户收到的好友请求列表
  static async getReceivedFriendRequests(userId) {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT f.*, u1.id as "requesterId", u1.username as "requesterName", u1.registration_order as "requesterRegistrationOrder", u1.avatar_url as "requesterAvatarUrl"
         FROM friends f
         JOIN users u1 ON f.user1_id = u1.id
         WHERE f.user2_id = ? AND f.status = 'pending'
         ORDER BY f.created_at DESC`,
        [userId],
        (err, rows) => {
          if (err) return reject(err);

          const formattedRows = rows.map(row => ({
            id: row.id,
            requesterId: row.requesterId || row.requesterid,
            requesterName: row.requesterName || row.requestername,
            requesterRegistrationOrder: row.requesterRegistrationOrder || row.requesterregistrationorder,
            status: row.status,
            createdAt: formatLocalTime(row.created_at),
            updatedAt: formatLocalTime(row.updated_at)
          }));

          resolve(formattedRows);
        }
      );
    });
  }

  // 获取用户发送的好友请求列表
  static async getSentFriendRequests(userId) {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT f.*, u2.id as "receiverId", u2.username as "receiverName", u2.registration_order as "receiverRegistrationOrder", u2.avatar_url as "receiverAvatarUrl"
         FROM friends f
         JOIN users u2 ON f.user2_id = u2.id
         WHERE f.user1_id = ? AND f.status = 'pending'
         ORDER BY f.created_at DESC`,
        [userId],
        (err, rows) => {
          if (err) return reject(err);

          const formattedRows = rows.map(row => ({
            id: row.id,
            receiverId: row.receiverId,
            receiverName: row.receiverName,
            receiverRegistrationOrder: row.receiverRegistrationOrder,
            avatarUrl: row.receiverAvatarUrl,
            status: row.status,
            createdAt: formatLocalTime(row.created_at),
            updatedAt: formatLocalTime(row.updated_at)
          }));

          resolve(formattedRows);
        }
      );
    });
  }

  // 获取用户的好友列表
  static async getUserFriends(userId) {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT f.*, 
                CASE 
                  WHEN f.user1_id = ? THEN u2.id 
                  ELSE u1.id 
                END as "friendId",
                CASE 
                  WHEN f.user1_id = ? THEN u2.username 
                  ELSE u1.username 
                END as "friendName",
                CASE 
                  WHEN f.user1_id = ? THEN u2.registration_order 
                  ELSE u1.registration_order 
                END as "friendRegistrationOrder",
                CASE 
                  WHEN f.user1_id = ? THEN u2.avatar_url 
                  ELSE u1.avatar_url 
                END as "friendAvatarUrl"
         FROM friends f
         LEFT JOIN users u1 ON f.user1_id = u1.id
         LEFT JOIN users u2 ON f.user2_id = u2.id
         WHERE ((f.user1_id = ? OR f.user2_id = ?) AND f.status = 'accepted')
         ORDER BY f.updated_at DESC`,
        [userId, userId, userId, userId, userId, userId],
        (err, rows) => {
          if (err) return reject(err);

          const formattedRows = rows.map(row => ({
            id: row.id,
            friendId: row.friendId,
            friendName: row.friendName,
            friendRegistrationOrder: row.friendRegistrationOrder,
            avatarUrl: row.friendAvatarUrl,
            status: row.status,
            createdAt: formatLocalTime(row.created_at),
            updatedAt: formatLocalTime(row.updated_at)
          }));

          resolve(formattedRows);
        }
      );
    });
  }

  // 检查两个用户是否为好友
  static async areFriends(userId1, userId2) {
    return new Promise((resolve, reject) => {
      db.get(
        `SELECT id FROM friends 
         WHERE ((user1_id = ? AND user2_id = ?) OR (user1_id = ? AND user2_id = ?)) 
         AND status = 'accepted'`,
        [userId1, userId2, userId2, userId1],
        (err, row) => {
          if (err) return reject(err);
          resolve(!!row);
        }
      );
    });
  }

  // 删除好友关系
  static async removeFriend(userId, friendId) {
    return new Promise((resolve, reject) => {
      db.run(
        `DELETE FROM friends 
         WHERE ((user1_id = ? AND user2_id = ?) OR (user1_id = ? AND user2_id = ?)) 
         AND status = 'accepted'`,
        [userId, friendId, friendId, userId],
        function (err) {
          if (err) return reject(err);
          resolve({ changes: this.changes });
        }
      );
    });
  }

  // 获取好友总数
  static async getFriendCount(userId) {
    return new Promise((resolve, reject) => {
      db.get(
        `SELECT COUNT(*) as count FROM friends 
         WHERE (user1_id = ? OR user2_id = ?) AND status = 'accepted'`,
        [userId, userId],
        (err, row) => {
          if (err) return reject(err);
          resolve(row.count || 0);
        }
      );
    });
  }

  // 获取好友请求总数（待处理）
  static async getPendingRequestCount(userId) {
    return new Promise((resolve, reject) => {
      db.get(
        `SELECT COUNT(*) as count FROM friends 
         WHERE user2_id = ? AND status = 'pending'`,
        [userId],
        (err, row) => {
          if (err) return reject(err);
          resolve(row.count || 0);
        }
      );
    });
  }
}

module.exports = Friend;