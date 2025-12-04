const db = require('../config/database');
const { formatLocalTime, formatMessageTime, getRelativeTime } = require('../utils/timezone');

class Message {
  static create(messageData) {
    return new Promise((resolve, reject) => {
      const { topic_id = null, user_id, content } = messageData;
      
      // 使用本地时间
      const currentTime = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false });
      
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

  // 创建私聊消息
  static createPrivate(privateMessageData) {
    return new Promise((resolve, reject) => {
      const { sender_id, receiver_id, content } = privateMessageData;
      
      // 使用本地时间
      const currentTime = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false });
      
      db.run(
        "INSERT INTO private_messages (sender_id, receiver_id, content, is_read, created_at) VALUES (?, ?, ?, ?, ?)",
        [sender_id, receiver_id, content, 0, currentTime],
        function(err) {
          if (err) return reject(err);
          
          // 获取插入的消息ID
          const messageId = this.lastID;
          
          // 获取完整的消息信息
          db.get(
            `SELECT pm.*, 
                    u1.username as senderName, 
                    u2.username as receiverName
             FROM private_messages pm
             JOIN users u1 ON pm.sender_id = u1.id
             JOIN users u2 ON pm.receiver_id = u2.id
             WHERE pm.id = ?`,
            [messageId],
            (err, row) => {
              if (err) return reject(err);
              if (row) {
                row.created_at = formatLocalTime(row.created_at);
                row.messageTime = formatMessageTime(row.created_at);
                row.relativeTime = getRelativeTime(row.created_at);
                resolve({
                  id: messageId,
                  ...row
                });
              } else {
                resolve({ id: messageId });
              }
            }
          );
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
            row.messageTime = formatMessageTime(row.created_at);
            row.relativeTime = getRelativeTime(row.created_at);
            row.isTopicMessage = !!row.topic_id; // 标记是否为话题消息
          }
          resolve(row);
        }
      );
    });
  }

  // 根据ID查找私聊消息
  static findPrivateById(id) {
    return new Promise((resolve, reject) => {
      db.get(
        `SELECT pm.*, 
                u1.username as senderName, 
                u2.username as receiverName
         FROM private_messages pm
         JOIN users u1 ON pm.sender_id = u1.id
         JOIN users u2 ON pm.receiver_id = u2.id
         WHERE pm.id = ?`,
        [id],
        (err, row) => {
          if (err) return reject(err);
          if (row) {
            row.created_at = formatLocalTime(row.created_at);
            row.messageTime = formatMessageTime(row.created_at);
            row.relativeTime = getRelativeTime(row.created_at);
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
            messageTime: formatMessageTime(row.created_at),
            relativeTime: getRelativeTime(row.created_at),
            isTopicMessage: !!row.topic_id
          }));
          resolve(formattedRows.reverse());
        }
      );
    });
  }

  // 获取公共聊天室消息（不包含话题消息）
  static findPublicChatroomMessages(limit = 50, offset = 0) {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT m.*, u.username as senderName
         FROM messages m
         JOIN users u ON m.user_id = u.id
         WHERE m.topic_id IS NULL
         ORDER BY m.created_at DESC
         LIMIT ? OFFSET ?`,
        [limit, offset],
        (err, rows) => {
          if (err) return reject(err);
          // 格式化所有消息的时间
          const formattedRows = rows.map(row => ({
            ...row,
            created_at: formatLocalTime(row.created_at),
            messageTime: formatMessageTime(row.created_at),
            relativeTime: getRelativeTime(row.created_at),
            isTopicMessage: false
          }));
          resolve(formattedRows.reverse());
        }
      );
    });
  }

  // 获取指定话题的消息历史
  static findByTopic(topicId, limit = 50, offset = 0) {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT m.*, u.username as senderName
         FROM messages m
         JOIN users u ON m.user_id = u.id
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
            messageTime: formatMessageTime(row.created_at),
            relativeTime: getRelativeTime(row.created_at)
          }));
          resolve(formattedRows.reverse());
        }
      );
    });
  }

  // 获取两个用户之间的私聊消息历史
  static findPrivateMessagesBetweenUsers(userId1, userId2, limit = 50, offset = 0) {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT pm.*, 
                u1.username as senderName, 
                u2.username as receiverName
         FROM private_messages pm
         JOIN users u1 ON pm.sender_id = u1.id
         JOIN users u2 ON pm.receiver_id = u2.id
         WHERE (pm.sender_id = ? AND pm.receiver_id = ?) 
            OR (pm.sender_id = ? AND pm.receiver_id = ?)
         ORDER BY pm.created_at DESC
         LIMIT ? OFFSET ?`,
        [userId1, userId2, userId2, userId1, limit, offset],
        (err, rows) => {
          if (err) return reject(err);
          // 格式化所有消息的时间
          const formattedRows = rows.map(row => ({
            ...row,
            created_at: formatLocalTime(row.created_at),
            messageTime: formatMessageTime(row.created_at),
            relativeTime: getRelativeTime(row.created_at)
          }));
          resolve(formattedRows.reverse());
        }
      );
    });
  }

  // 获取用户收到的私聊消息（未读）
  static findUnreadPrivateMessagesByReceiver(receiverId) {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT pm.*, 
                u1.username as senderName
         FROM private_messages pm
         JOIN users u1 ON pm.sender_id = u1.id
         WHERE pm.receiver_id = ? AND pm.is_read = 0
         ORDER BY pm.created_at ASC`,
        [receiverId],
        (err, rows) => {
          if (err) return reject(err);
          // 格式化所有消息的时间
          const formattedRows = rows.map(row => ({
            ...row,
            created_at: formatLocalTime(row.created_at),
            messageTime: formatMessageTime(row.created_at),
            relativeTime: getRelativeTime(row.created_at)
          }));
          resolve(formattedRows);
        }
      );
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
            messageTime: formatMessageTime(row.created_at),
            relativeTime: getRelativeTime(row.created_at),
            isTopicMessage: !!row.topic_id
          }));
          resolve(formattedRows);
        }
      );
    });
  }

  // 获取与当前用户有过私聊的所有用户（带最新消息）
  static getPrivateChatUsersWithLatestMessage(currentUserId) {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT DISTINCT u.id, u.username, u.registration_order, u.created_at
         FROM users u
         WHERE u.id IN (
           SELECT DISTINCT pm.sender_id
           FROM private_messages pm
           WHERE pm.receiver_id = ?
           UNION
           SELECT DISTINCT pm.receiver_id
           FROM private_messages pm
           WHERE pm.sender_id = ?
         ) AND u.id != ?
         ORDER BY u.username`,
        [currentUserId, currentUserId, currentUserId],
        async (err, rows) => {
          if (err) return reject(err);
          
          // 为每个用户获取最新消息
          const usersWithLatestMessage = await Promise.all(rows.map(async (user) => {
            const latestMessage = await Message.getLatestPrivateMessageBetweenUsers(currentUserId, user.id);
            return {
              ...user,
              created_at: formatLocalTime(user.created_at),
              latestMessage: latestMessage ? {
                content: latestMessage.content,
                createdAt: latestMessage.created_at
              } : null
            };
          }));
          
          resolve(usersWithLatestMessage);
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
            row.messageTime = formatMessageTime(row.created_at);
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

  // 获取指定话题的最新消息
  static getLatestMessageByTopic(topicId) {
    return new Promise((resolve, reject) => {
      db.get(
        `SELECT m.content, m.created_at, u.username as senderName
         FROM messages m
         JOIN users u ON m.user_id = u.id
         WHERE m.topic_id = ?
         ORDER BY m.created_at DESC 
         LIMIT 1`,
        [topicId],
        (err, row) => {
          if (err) return reject(err);
          if (row) {
            row.created_at = formatLocalTime(row.created_at);
            row.messageTime = formatMessageTime(row.created_at);
          }
          resolve(row);
        }
      );
    });
  }

  // 获取用户未读私聊消息数量
  static getUnreadPrivateMessageCount(userId) {
    return new Promise((resolve, reject) => {
      db.get(
        "SELECT COUNT(*) as count FROM private_messages WHERE receiver_id = ? AND is_read = 0",
        [userId],
        (err, row) => {
          if (err) return reject(err);
          resolve(row ? row.count : 0);
        }
      );
    });
  }

  // 获取两个用户之间最新的私聊消息
  static getLatestPrivateMessageBetweenUsers(userId1, userId2) {
    return new Promise((resolve, reject) => {
      db.get(
        `SELECT pm.content, pm.created_at
         FROM private_messages pm
         WHERE (pm.sender_id = ? AND pm.receiver_id = ?) 
            OR (pm.sender_id = ? AND pm.receiver_id = ?)
         ORDER BY pm.created_at DESC 
         LIMIT 1`,
        [userId1, userId2, userId2, userId1],
        (err, row) => {
          if (err) return reject(err);
          if (row) {
            row.created_at = formatLocalTime(row.created_at);
            row.messageTime = formatMessageTime(row.created_at);
          }
          resolve(row);
        }
      );
    });
  }

  // 标记两个用户之间的私聊消息为已读
  static markPrivateMessagesAsReadBetweenUsers(userId1, userId2) {
    return new Promise((resolve, reject) => {
      db.run(
        `UPDATE private_messages 
         SET is_read = 1 
         WHERE ((sender_id = ? AND receiver_id = ?) 
            OR (sender_id = ? AND receiver_id = ?)) 
         AND is_read = 0`,
        [userId1, userId2, userId2, userId1],
        function(err) {
          if (err) return reject(err);
          resolve({ changes: this.changes });
        }
      );
    });
  }
}

module.exports = Message;