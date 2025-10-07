const db = require('../config/database');
const { formatLocalTime, getRelativeTime, getDatabaseTimeString } = require('../utils/timezone');

class Message {
  static create(messageData) {
    return new Promise((resolve, reject) => {
      const { topic_id = null, user_id, content } = messageData;
      
      // 使用校准的UTC+8时间
      const currentTime = getDatabaseTimeString();
      
      db.run(
        "INSERT INTO messages (topic_id, user_id, content, created_at) VALUES (?, ?, ?, ?)",
        [topic_id, user_id, content, currentTime],
        function(err) {
          if (err) return reject(err);
          
          // 如果消息属于某个话题，更新话题的活动时间
          if (topic_id) {
            db.run(
              "UPDATE topics SET message_count = message_count + 1, last_activity = ? WHERE id = ?",
              [currentTime, topic_id]
            );
          }
          
          resolve(this.lastID);
        }
      );
    });
  }

  static findById(id) {
    return new Promise((resolve, reject) => {
      db.get(
        `SELECT m.*, u.username as senderName, t.name as topicName
         FROM messages m
         JOIN users u ON m.user_id = u.id
         LEFT JOIN topics t ON m.topic_id = t.id
         WHERE m.id = ?`,
        [id],
        (err, row) => {
          if (err) return reject(err);
          if (row) {
            row.created_at = formatLocalTime(row.created_at);
            row.relativeTime = getRelativeTime(row.created_at);
            row.isTopicMessage = !!row.topic_id; // 标记是否为话题消息
          }
          resolve(row);
        }
      );
    });
  }

  // 获取聊天室所有消息（包含话题消息）
  static findByChatroom(limit = 50, offset = 0) {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT m.*, u.username as senderName, t.name as topicName
         FROM messages m
         JOIN users u ON m.user_id = u.id
         LEFT JOIN topics t ON m.topic_id = t.id
         ORDER BY m.created_at DESC
         LIMIT ? OFFSET ?`,
        [limit, offset],
        (err, rows) => {
          if (err) return reject(err);
          // 格式化所有消息的时间
          const formattedRows = rows.map(row => ({
            ...row,
            created_at: formatLocalTime(row.created_at),
            relativeTime: getRelativeTime(row.created_at),
            isTopicMessage: !!row.topic_id
          }));
          resolve(formattedRows.reverse());
        }
      );
    });
  }

  // 获取特定话题的消息
  static findByTopic(topicId, limit = 50, offset = 0) {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT m.*, u.username as senderName, t.name as topicName
         FROM messages m
         JOIN users u ON m.user_id = u.id
         JOIN topics t ON m.topic_id = t.id
         WHERE m.topic_id = ?
         ORDER BY m.created_at DESC
         LIMIT ? OFFSET ?`,
        [topicId, limit, offset],
        (err, rows) => {
          if (err) return reject(err);
          // 格式化所有消息的时间
          const formattedRows = rows.map(row => ({
            ...row,
            created_at: formatLocalTime(row.created_at),
            relativeTime: getRelativeTime(row.created_at),
            isTopicMessage: true
          }));
          resolve(formattedRows.reverse());
        }
      );
    });
  }

  static getLastMessage() {
    return new Promise((resolve, reject) => {
      db.get(
        `SELECT m.content, m.created_at, u.username as senderName, t.name as topicName
         FROM messages m
         JOIN users u ON m.user_id = u.id
         LEFT JOIN topics t ON m.topic_id = t.id
         ORDER BY m.created_at DESC LIMIT 1`,
        (err, row) => {
          if (err) return reject(err);
          if (row) {
            row.created_at = formatLocalTime(row.created_at);
            row.isTopicMessage = !!row.topicName;
          }
          resolve(row);
        }
      );
    });
  }

  static getMessageCount(topicId = null) {
    return new Promise((resolve, reject) => {
      let sql = "SELECT COUNT(*) as count FROM messages";
      let params = [];
      
      if (topicId) {
        sql += " WHERE topic_id = ?";
        params = [topicId];
      }
      
      db.get(sql, params, (err, row) => {
        if (err) return reject(err);
        resolve(row ? row.count : 0);
      });
    });
  }

  static getRecentMessages(limit = 10) {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT m.*, u.username as senderName, t.name as topicName
         FROM messages m
         JOIN users u ON m.user_id = u.id
         LEFT JOIN topics t ON m.topic_id = t.id
         ORDER BY m.created_at DESC
         LIMIT ?`,
        [limit],
        (err, rows) => {
          if (err) return reject(err);
          // 格式化时间
          const formattedRows = rows.map(row => ({
            ...row,
            created_at: formatLocalTime(row.created_at),
            relativeTime: getRelativeTime(row.created_at),
            isTopicMessage: !!row.topic_id
          }));
          resolve(formattedRows);
        }
      );
    });
  }
}

module.exports = Message;