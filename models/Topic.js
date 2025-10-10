const db = require('../config/database');
const { formatLocalTime } = require('../utils/timezone');

class Topic {
  static create(topicData) {
    return new Promise((resolve, reject) => {
      const { name, description, created_by, is_private = 0 } = topicData;
      
      db.run(
        "INSERT INTO topics (name, description, created_by, is_private, last_activity) VALUES (?, ?, ?, ?, datetime('now', 'localtime'))",
        [name, description, created_by, is_private],
        function(err) {
          if (err) return reject(err);
          
          const topicId = this.lastID;
          
          // 如果是私有话题，自动将创建者加入话题
          if (is_private) {
            db.run(
              "INSERT INTO topic_members (topic_id, user_id) VALUES (?, ?)",
              [topicId, created_by],
              (err) => {
                if (err) {
                  console.error("添加创建者到私有话题成员失败:", err);
                }
                resolve(topicId);
              }
            );
          } else {
            resolve(topicId);
          }
        }
      );
    });
  }

  // 获取用户加入的所有话题
  static findByUser(userId, limit = 50) {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT t.*, u.username as creatorName
         FROM topics t
         LEFT JOIN users u ON t.created_by = u.id
         INNER JOIN topic_members tm ON t.id = tm.topic_id
         WHERE tm.user_id = ? AND t.is_active = 1
         ORDER BY t.last_activity DESC, t.created_at DESC
         LIMIT ?`,
        [userId, limit],
        (err, rows) => {
          if (err) return reject(err);
          resolve(rows);
        }
      );
    });
  }

  // 获取所有话题（公开的）
  static findAll(limit = 50) {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT t.*, u.username as creatorName
         FROM topics t
         LEFT JOIN users u ON t.created_by = u.id
         WHERE t.is_active = 1 AND t.is_private = 0
         ORDER BY t.last_activity DESC, t.created_at DESC
         LIMIT ?`,
        [limit],
        (err, rows) => {
          if (err) return reject(err);
          resolve(rows);
        }
      );
    });
  }

  // 搜索话题（按名称或ID）
  static search(query, userId, limit = 50) {
    return new Promise((resolve, reject) => {
      // 如果查询是数字，按ID搜索；否则按名称搜索
      let sql, params;
      if (!isNaN(query)) {
        // 按ID搜索（包括公开话题和用户加入的私有话题）
        sql = `SELECT t.*, u.username as creatorName
               FROM topics t
               LEFT JOIN users u ON t.created_by = u.id
               LEFT JOIN topic_members tm ON t.id = tm.topic_id AND tm.user_id = ?
               WHERE t.id = ? AND t.is_active = 1 AND (t.is_private = 0 OR tm.user_id = ?)
               LIMIT ?`;
        params = [userId, parseInt(query), userId, limit];
      } else {
        // 按名称搜索（包括公开话题和用户加入的私有话题）
        sql = `SELECT t.*, u.username as creatorName
               FROM topics t
               LEFT JOIN users u ON t.created_by = u.id
               LEFT JOIN topic_members tm ON t.id = tm.topic_id AND tm.user_id = ?
               WHERE t.name LIKE ? AND t.is_active = 1 AND (t.is_private = 0 OR tm.user_id = ?)
               ORDER BY t.last_activity DESC, t.created_at DESC
               LIMIT ?`;
        params = [userId, `%${query}%`, userId, limit];
      }
      
      db.all(sql, params, (err, rows) => {
        if (err) return reject(err);
        resolve(rows);
      });
    });
  }

  static findByName(name) {
    return new Promise((resolve, reject) => {
      db.get(
        "SELECT id FROM topics WHERE name = ? AND is_active = 1",
        [name],
        (err, row) => {
          if (err) return reject(err);
          resolve(row);
        }
      );
    });
  }

  static findById(id) {
    return new Promise((resolve, reject) => {
      db.get(
        `SELECT t.*, u.username as creatorName
         FROM topics t
         LEFT JOIN users u ON t.created_by = u.id
         WHERE t.id = ? AND t.is_active = 1`,
        [id],
        (err, row) => {
          if (err) return reject(err);
          resolve(row);
        }
      );
    });
  }

  // 检查用户是否是话题成员
  static isMember(topicId, userId) {
    return new Promise((resolve, reject) => {
      db.get(
        `SELECT 1 FROM topic_members WHERE topic_id = ? AND user_id = ?`,
        [topicId, userId],
        (err, row) => {
          if (err) return reject(err);
          resolve(!!row);
        }
      );
    });
  }

  // 获取话题成员列表
  static getMembers(topicId, limit = 50) {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT u.id, u.username, u.registration_order, tm.joined_at
         FROM topic_members tm
         JOIN users u ON tm.user_id = u.id
         WHERE tm.topic_id = ?
         ORDER BY tm.joined_at ASC
         LIMIT ?`,
        [topicId, limit],
        (err, rows) => {
          if (err) return reject(err);
          // 格式化时间
          const formattedRows = rows.map(row => ({
            ...row,
            joined_at: formatLocalTime(row.joined_at)
          }));
          resolve(formattedRows);
        }
      );
    });
  }

  // 获取话题成员数量
  static getMemberCount(topicId) {
    return new Promise((resolve, reject) => {
      db.get(
        "SELECT COUNT(*) as count FROM topic_members WHERE topic_id = ?",
        [topicId],
        (err, row) => {
          if (err) return reject(err);
          resolve(row ? row.count : 0);
        }
      );
    });
  }

  // 用户加入话题
  static joinTopic(topicId, userId) {
    return new Promise((resolve, reject) => {
      db.run(
        "INSERT OR IGNORE INTO topic_members (topic_id, user_id) VALUES (?, ?)",
        [topicId, userId],
        function(err) {
          if (err) return reject(err);
          resolve({ changes: this.changes });
        }
      );
    });
  }

  // 用户退出话题
  static leaveTopic(topicId, userId) {
    return new Promise((resolve, reject) => {
      db.run(
        "DELETE FROM topic_members WHERE topic_id = ? AND user_id = ?",
        [topicId, userId],
        function(err) {
          if (err) return reject(err);
          resolve({ changes: this.changes });
        }
      );
    });
  }

  // 归档话题（设为非活跃）
  static archive(id) {
    return new Promise((resolve, reject) => {
      db.run(
        "UPDATE topics SET is_active = 0 WHERE id = ?",
        [id],
        function(err) {
          if (err) return reject(err);
          resolve({ changes: this.changes });
        }
      );
    });
  }
}

module.exports = Topic;