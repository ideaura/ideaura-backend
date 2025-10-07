const db = require('../config/database');

class Topic {
  static create(topicData) {
    return new Promise((resolve, reject) => {
      const { name, description, created_by } = topicData;
      
      db.run(
        "INSERT INTO topics (name, description, created_by, last_activity) VALUES (?, ?, ?, datetime('now', 'localtime'))",
        [name, description, created_by],
        function(err) {
          if (err) return reject(err);
          resolve(this.lastID);
        }
      );
    });
  }

  // 获取活跃话题（有最近活动的）
  static findActive(limit = 10) {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT t.*, u.username as creatorName
         FROM topics t
         LEFT JOIN users u ON t.created_by = u.id
         WHERE t.is_active = 1 AND t.last_activity IS NOT NULL
         ORDER BY t.last_activity DESC
         LIMIT ?`,
        [limit],
        (err, rows) => {
          if (err) return reject(err);
          resolve(rows);
        }
      );
    });
  }

  // 获取所有话题
  static findAll(limit = 50) {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT t.*, u.username as creatorName
         FROM topics t
         LEFT JOIN users u ON t.created_by = u.id
         WHERE t.is_active = 1
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