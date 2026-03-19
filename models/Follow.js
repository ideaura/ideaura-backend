const db = require('../config/database');
const time = require('../utils/time');
const formatLocalTime = (...args) => time.formatLocalTime(...args);


class Follow {
  // 关注用户
  static follow(followerId, followingId) {
    return new Promise((resolve, reject) => {
      const currentTime = time.currentDbString();

      // 检查是否已经关注
      db.get(
        `SELECT id FROM follows WHERE follower_id = ? AND following_id = ?`,
        [followerId, followingId],
        (err, existing) => {
          if (err) return reject(err);

          if (existing) {
            // 如果已存在但状态不是active，则更新状态
            if (existing.status !== 'active') {
              db.run(
                `UPDATE follows SET status = ?, updated_at = ? WHERE id = ?`,
                ['active', currentTime, existing.id],
                function(err) {
                  if (err) return reject(err);
                  resolve({ id: existing.id, status: 'active' });
                }
              );
            } else {
              resolve({ id: existing.id, status: 'active', alreadyFollowing: true });
            }
          } else {
            // 创建新的关注关系
            db.run(
              `INSERT INTO follows (follower_id, following_id, status, created_at, updated_at) 
               VALUES (?, ?, ?, ?, ?) RETURNING id`,
              [followerId, followingId, 'active', currentTime, currentTime],
              function(err) {
                if (err) return reject(err);
                resolve({ id: this.lastID, status: 'active' });
              }
            );
          }
        }
      );
    });
  }

  // 取消关注
  static unfollow(followerId, followingId) {
    return new Promise((resolve, reject) => {
      db.run(
        `UPDATE follows SET status = ?, updated_at = ? WHERE follower_id = ? AND following_id = ? AND status = 'active'`,
        ['inactive', time.currentDbString(), followerId, followingId],
        function(err) {
          if (err) return reject(err);
          resolve({ changes: this.changes });
        }
      );
    });
  }

  // 检查是否关注了指定用户
  static isFollowing(followerId, followingId) {
    return new Promise((resolve, reject) => {
      db.get(
        `SELECT id FROM follows WHERE follower_id = ? AND following_id = ? AND status = 'active'`,
        [followerId, followingId],
        (err, row) => {
          if (err) return reject(err);
          resolve(!!row);
        }
      );
    });
  }

  // 获取用户的关注列表
  static getFollowingList(userId, page = 1, limit = 10) {
    return new Promise((resolve, reject) => {
      const offset = (page - 1) * limit;
      
      db.all(
        `SELECT f.*, u.username, u.registration_order 
         FROM follows f
         JOIN users u ON f.following_id = u.id
         WHERE f.follower_id = ? AND f.status = 'active'
         ORDER BY f.created_at DESC 
         LIMIT ? OFFSET ?`,
        [userId, limit, offset],
        (err, rows) => {
          if (err) return reject(err);
          
          const formattedRows = rows.map(row => ({
            ...row,
            createdAt: formatLocalTime(row.created_at),
            updatedAt: row.updated_at ? formatLocalTime(row.updated_at) : null
          }));
          
          resolve(formattedRows);
        }
      );
    });
  }

  // 获取用户的粉丝列表
  static getFollowerList(userId, page = 1, limit = 10) {
    return new Promise((resolve, reject) => {
      const offset = (page - 1) * limit;
      
      db.all(
        `SELECT f.*, u.username, u.registration_order 
         FROM follows f
         JOIN users u ON f.follower_id = u.id
         WHERE f.following_id = ? AND f.status = 'active'
         ORDER BY f.created_at DESC 
         LIMIT ? OFFSET ?`,
        [userId, limit, offset],
        (err, rows) => {
          if (err) return reject(err);
          
          const formattedRows = rows.map(row => ({
            ...row,
            createdAt: formatLocalTime(row.created_at),
            updatedAt: row.updated_at ? formatLocalTime(row.updated_at) : null
          }));
          
          resolve(formattedRows);
        }
      );
    });
  }

  // 获取关注数量
  static getFollowingCount(userId) {
    return new Promise((resolve, reject) => {
      db.get(
        `SELECT COUNT(*) as count FROM follows WHERE follower_id = ? AND status = 'active'`,
        [userId],
        (err, row) => {
          if (err) return reject(err);
          resolve(row.count || 0);
        }
      );
    });
  }

  // 获取粉丝数量
  static getFollowerCount(userId) {
    return new Promise((resolve, reject) => {
      db.get(
        `SELECT COUNT(*) as count FROM follows WHERE following_id = ? AND status = 'active'`,
        [userId],
        (err, row) => {
          if (err) return reject(err);
          resolve(row.count || 0);
        }
      );
    });
  }
}

module.exports = Follow;