const db = require('../config/database');
const { formatLocalTime, formatMessageTime, getRelativeTime } = require('../utils/timezone');

class Message {
  // 基本消息类型定义
  static basicMessageTypes = ['text', 'image', 'video', 'file', 'markdown', 'html'];
  
  static create(messageData) {
    return new Promise((resolve, reject) => {
      const { 
        topic_id = null, 
        user_id, 
        content, 
        message_type = 'normal', 
        message_subtype = 'text', // 基本消息类型
        forward_source_id = null, 
        quoted_message_id = null,
        file_url = null, // 文件上传相关字段
        file_name = null,
        file_size = null,
        file_type = null
      } = messageData;
      
      // 使用本地时间
      const currentTime = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false });
      
      db.run(
        "INSERT INTO messages (topic_id, user_id, content, created_at, message_type, message_subtype, forward_source_id, quoted_message_id, file_url, file_name, file_size, file_type) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [topic_id, user_id, content, currentTime, message_type, message_subtype, forward_source_id, quoted_message_id, file_url, file_name, file_size, file_type],
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
      const { 
        sender_id, 
        receiver_id, 
        content, 
        message_type = 'normal', 
        message_subtype = 'text', // 基本消息类型
        forward_source_id = null, 
        quoted_message_id = null,
        file_url = null, // 文件上传相关字段
        file_name = null,
        file_size = null,
        file_type = null
      } = privateMessageData;
      
      // 使用本地时间
      const currentTime = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false });
      
      db.run(
        "INSERT INTO private_messages (sender_id, receiver_id, content, is_read, created_at, message_type, message_subtype, forward_source_id, quoted_message_id, file_url, file_name, file_size, file_type) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [sender_id, receiver_id, content, 0, currentTime, message_type, message_subtype, forward_source_id, quoted_message_id, file_url, file_name, file_size, file_type],
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
        `SELECT m.*, u.id as senderId, u.username as senderName, t.name as topicName
         FROM messages m
         JOIN users u ON m.user_id = u.id
         LEFT JOIN topics t ON m.topic_id = t.id
         WHERE m.id = ?`,
        [id],
        (err, row) => {
          if (err) return reject(err);
          if (row) {
            let messageData;
            
            // 根据消息类型创建不同的数据结构
            if (row.is_deleted === 1) {
              // 撤回消息 - 不包含内容字段
              messageData = {
                id: row.id,
                isRecalled: true,
                recallTime: formatLocalTime(row.deleted_at || row.created_at),
                created_at: formatLocalTime(row.created_at),
                messageTime: formatMessageTime(row.created_at),
                relativeTime: getRelativeTime(row.created_at),
                messageType: 'recalled',
                senderId: row.senderId || row.user_id,
                senderName: row.senderName,
                topicName: row.topicName,
                isTopicMessage: !!row.topic_id
              };
              
              resolve(messageData);
            } else {
              // 非撤回消息 - 包含完整内容
              messageData = {
                ...row,
                created_at: formatLocalTime(row.created_at),
                messageTime: formatMessageTime(row.created_at),
                relativeTime: getRelativeTime(row.created_at),
                messageType: row.message_type || 'normal',
                messageSubtype: row.message_subtype || 'text', // 基本消息类型
                isTopicMessage: !!row.topic_id
              };
              
              // 如果是文件、图片或视频消息，添加文件信息
              if (['file', 'image', 'video'].includes(row.message_subtype)) {
                messageData.fileInfo = {
                  url: row.file_url,
                  name: row.file_name,
                  size: row.file_size,
                  type: row.file_type
                };
              }
              
              // 根据具体消息类型添加额外字段
              if (row.message_type === 'forwarded') {
                messageData.originalMessageId = row.forward_source_id;
                // 获取原始消息信息
                if (messageData.originalMessageId) {
                  Message.getOriginalForwardedMessageInfo(messageData.originalMessageId).then(originalMsg => {
                    messageData.originalMessage = originalMsg;
                    resolve(messageData);
                  }).catch(() => {
                    resolve(messageData);
                  });
                } else {
                  resolve(messageData);
                }
              } else if (row.quoted_message_id) {
                messageData.quotedMessageId = row.quoted_message_id;
                // 获取引用消息信息
                if (messageData.quotedMessageId) {
                  Message.getQuotedMessageInfo(messageData.quotedMessageId).then(quotedMessage => {
                    messageData.quotedMessage = quotedMessage;
                    resolve(messageData);
                  }).catch(() => {
                    resolve(messageData);
                  });
                } else {
                  resolve(messageData);
                }
              } else if (row.updated_at) {
                messageData.updated_at = formatLocalTime(row.updated_at);
                // 获取编辑历史
                Message.getMessageVersions(row.id, false)
                  .then(versions => {
                    messageData.editHistory = versions;
                    resolve(messageData);
                  }).catch(() => {
                    messageData.editHistory = [];
                    resolve(messageData);
                  });
              } else {
                resolve(messageData);
              }
            }
          } else {
            resolve(row);
          }
        }
      );
    });
  }

  // 根据ID查找私聊消息
  static findPrivateById(id) {
    return new Promise((resolve, reject) => {
      db.get(
        `SELECT pm.*, 
                u1.id as senderId, u1.username as senderName, 
                u2.id as receiverId, u2.username as receiverName
         FROM private_messages pm
         JOIN users u1 ON pm.sender_id = u1.id
         JOIN users u2 ON pm.receiver_id = u2.id
         WHERE pm.id = ?`,
        [id],
        (err, row) => {
          if (err) return reject(err);
          if (row) {
            let messageData;
            
            // 根据消息类型创建不同的数据结构
            if (row.is_deleted === 1) {
              // 撤回消息 - 不包含内容字段
              messageData = {
                id: row.id,
                isRecalled: true,
                recallTime: formatLocalTime(row.deleted_at || row.created_at),
                created_at: formatLocalTime(row.created_at),
                messageTime: formatMessageTime(row.created_at),
                relativeTime: getRelativeTime(row.created_at),
                messageType: 'recalled',
                senderId: row.senderId,
                senderName: row.senderName,
                receiverId: row.receiverId,
                receiverName: row.receiverName
              };
              
              resolve(messageData);
            } else {
              // 非撤回消息 - 包含完整内容
              messageData = {
                ...row,
                created_at: formatLocalTime(row.created_at),
                messageTime: formatMessageTime(row.created_at),
                relativeTime: getRelativeTime(row.created_at),
                messageType: row.message_type || 'normal',
                messageSubtype: row.message_subtype || 'text' // 基本消息类型
              };
              
              // 如果是文件、图片或视频消息，添加文件信息
              if (['file', 'image', 'video'].includes(row.message_subtype)) {
                messageData.fileInfo = {
                  url: row.file_url,
                  name: row.file_name,
                  size: row.file_size,
                  type: row.file_type
                };
              }
              
              // 根据具体消息类型添加额外字段
              if (row.message_type === 'forwarded') {
                messageData.originalMessageId = row.forward_source_id;
                // 获取原始消息信息
                if (messageData.originalMessageId) {
                  Message.getOriginalForwardedPrivateMessageInfo(messageData.originalMessageId).then(originalMsg => {
                    messageData.originalMessage = originalMsg;
                    resolve(messageData);
                  }).catch(() => {
                    resolve(messageData);
                  });
                } else {
                  resolve(messageData);
                }
              } else if (row.quoted_message_id) {
                messageData.quotedMessageId = row.quoted_message_id;
                // 获取引用消息信息
                if (messageData.quotedMessageId) {
                  Message.getQuotedPrivateMessageInfo(messageData.quotedMessageId).then(quotedMessage => {
                    messageData.quotedMessage = quotedMessage;
                    resolve(messageData);
                  }).catch(() => {
                    resolve(messageData);
                  });
                } else {
                  resolve(messageData);
                }
              } else if (row.updated_at) {
                messageData.updated_at = formatLocalTime(row.updated_at);
                // 获取编辑历史
                Message.getMessageVersions(row.id, true)
                  .then(versions => {
                    messageData.editHistory = versions;
                    resolve(messageData);
                  }).catch(() => {
                    messageData.editHistory = [];
                    resolve(messageData);
                  });
              } else {
                resolve(messageData);
              }
            }
          } else {
            resolve(row);
          }
        }
      );
    });
  }

  // 获取聊天室所有消息（包含话题消息）
  static findByChatroom(limit = 50, offset = 0) {
    return new Promise(async (resolve, reject) => {
      db.all(
        `SELECT m.*, u.id as senderId, u.username as senderName, t.name as topicName
         FROM messages m
         JOIN users u ON m.user_id = u.id
         LEFT JOIN topics t ON m.topic_id = t.id
         WHERE m.is_deleted = 0
         ORDER BY m.created_at DESC
         LIMIT ? OFFSET ?`,
        [limit, offset],
        async (err, rows) => {
          if (err) return reject(err);
          
          const formattedRows = [];
          for (const row of rows) {
            let messageData;
            
            // 根据消息类型创建不同的数据结构
            if (row.is_deleted === 1) {
              // 撤回消息 - 不包含内容字段
              messageData = {
                id: row.id,
                isRecalled: true,
                recallTime: formatLocalTime(row.deleted_at || row.created_at),
                created_at: formatLocalTime(row.created_at),
                messageTime: formatMessageTime(row.created_at),
                relativeTime: getRelativeTime(row.created_at),
                messageType: 'recalled',
                senderId: row.senderId || row.user_id,
                senderName: row.senderName,
                topicName: row.topicName,
                isTopicMessage: !!row.topic_id
              };
            } else {
              // 非撤回消息 - 包含完整内容
              messageData = {
                id: row.id,
                topic_id: row.topic_id,
                user_id: row.user_id,
                content: row.content,
                created_at: formatLocalTime(row.created_at),
                updated_at: row.updated_at ? formatLocalTime(row.updated_at) : null,
                message_type: row.message_type,
                message_subtype: row.message_subtype,
                forward_source_id: row.forward_source_id,
                is_deleted: row.is_deleted,
                quoted_message_id: row.quoted_message_id,
                deleted_at: row.deleted_at,
                senderId: row.senderId || row.user_id,
                senderName: row.senderName,
                messageTime: formatMessageTime(row.created_at),
                relativeTime: getRelativeTime(row.created_at),
                messageType: row.message_type || 'normal',
                messageSubtype: row.message_subtype || 'text', // 基本消息类型
                isTopicMessage: !!row.topic_id,
                topicName: row.topicName
              };
              
              // 如果是文件、图片或视频消息，添加文件信息
              if (['file', 'image', 'video'].includes(row.message_subtype)) {
                messageData.fileInfo = {
                  url: row.file_url,
                  name: row.file_name,
                  size: row.file_size,
                  type: row.file_type
                };
              }
              
              // 根据具体消息类型添加额外字段
              if (row.message_type === 'forwarded') {
                messageData.originalMessageId = row.forward_source_id;
                // 获取原始消息信息
                if (messageData.originalMessageId) {
                  try {
                    const originalMsg = await Message.getOriginalForwardedMessageInfo(messageData.originalMessageId);
                    messageData.originalMessage = originalMsg;
                  } catch (error) {
                    messageData.originalMessage = null;
                  }
                }
              } else if (row.quoted_message_id) {
                messageData.quotedMessageId = row.quoted_message_id;
                // 获取引用消息信息
                if (messageData.quotedMessageId) {
                  try {
                    const quotedMsg = await Message.getQuotedMessageInfo(messageData.quotedMessageId);
                    messageData.quotedMessage = quotedMsg;
                  } catch (error) {
                    messageData.quotedMessage = null;
                  }
                }
              } else if (row.updated_at) {
                messageData.updated_at = formatLocalTime(row.updated_at);
                // 获取编辑历史
                try {
                  const versions = await Message.getMessageVersions(row.id, false);
                  messageData.editHistory = versions;
                } catch (error) {
                  messageData.editHistory = [];
                }
              }
            }
            
            formattedRows.push(messageData);
          }
          
          resolve(formattedRows.reverse());
        }
      );
    });
  }

  // 获取公共聊天室消息（不包含话题消息）
  static findPublicChatroomMessages(limit = 50, offset = 0) {
    return new Promise(async (resolve, reject) => {
      db.all(
        `SELECT m.*, u.id as senderId, u.username as senderName
         FROM messages m
         JOIN users u ON m.user_id = u.id
         WHERE m.topic_id IS NULL AND m.is_deleted = 0
         ORDER BY m.created_at DESC
         LIMIT ? OFFSET ?`,
        [limit, offset],
        async (err, rows) => {
          if (err) return reject(err);
          
          const formattedRows = [];
          for (const row of rows) {
            let messageData;
            
            // 根据消息类型创建不同的数据结构
            if (row.is_deleted === 1) {
              // 撤回消息 - 不包含内容字段
              messageData = {
                id: row.id,
                isRecalled: true,
                recallTime: formatLocalTime(row.deleted_at || row.created_at),
                created_at: formatLocalTime(row.created_at),
                messageTime: formatMessageTime(row.created_at),
                relativeTime: getRelativeTime(row.created_at),
                messageType: 'recalled',
                senderId: row.senderId || row.user_id,
                senderName: row.senderName,
                isTopicMessage: false
              };
            } else {
              // 非撤回消息 - 包含完整内容
              messageData = {
                id: row.id,
                topic_id: row.topic_id,
                user_id: row.user_id,
                content: row.content,
                created_at: formatLocalTime(row.created_at),
                updated_at: row.updated_at ? formatLocalTime(row.updated_at) : null,
                message_type: row.message_type,
                message_subtype: row.message_subtype,
                forward_source_id: row.forward_source_id,
                is_deleted: row.is_deleted,
                quoted_message_id: row.quoted_message_id,
                deleted_at: row.deleted_at,
                senderId: row.senderId || row.user_id,
                senderName: row.senderName,
                messageTime: formatMessageTime(row.created_at),
                relativeTime: getRelativeTime(row.created_at),
                messageType: row.message_type || 'normal',
                messageSubtype: row.message_subtype || 'text', // 基本消息类型
                isTopicMessage: false
              };
              
              // 如果是文件、图片或视频消息，添加文件信息
              if (['file', 'image', 'video'].includes(row.message_subtype)) {
                messageData.fileInfo = {
                  url: row.file_url,
                  name: row.file_name,
                  size: row.file_size,
                  type: row.file_type
                };
              }
              
              // 根据具体消息类型添加额外字段
              if (row.message_type === 'forwarded') {
                messageData.originalMessageId = row.forward_source_id;
                // 获取原始消息信息
                if (messageData.originalMessageId) {
                  try {
                    const originalMsg = await Message.getOriginalForwardedMessageInfo(messageData.originalMessageId);
                    messageData.originalMessage = originalMsg;
                  } catch (error) {
                    messageData.originalMessage = null;
                  }
                }
              } else if (row.quoted_message_id) {
                messageData.quotedMessageId = row.quoted_message_id;
                // 获取引用消息信息
                if (messageData.quotedMessageId) {
                  try {
                    const quotedMsg = await Message.getQuotedMessageInfo(messageData.quotedMessageId);
                    messageData.quotedMessage = quotedMsg;
                  } catch (error) {
                    messageData.quotedMessage = null;
                  }
                }
              } else if (row.updated_at) {
                messageData.updated_at = formatLocalTime(row.updated_at);
                // 获取编辑历史
                try {
                  const versions = await Message.getMessageVersions(row.id, false);
                  messageData.editHistory = versions;
                } catch (error) {
                  messageData.editHistory = [];
                }
              }
            }
            
            formattedRows.push(messageData);
          }
          
          resolve(formattedRows.reverse());
        }
      );
    });
  }

  // 获取指定话题的消息历史
  static findByTopic(topicId, limit = 50, offset = 0) {
    return new Promise(async (resolve, reject) => {
      db.all(
        `SELECT m.*, u.id as senderId, u.username as senderName
         FROM messages m
         JOIN users u ON m.user_id = u.id
         WHERE m.topic_id = ?
         ORDER BY m.created_at DESC
         LIMIT ? OFFSET ?`,
        [topicId, limit, offset],
        async (err, rows) => {
          if (err) return reject(err);
          
          const formattedRows = [];
          for (const row of rows) {
            let messageData;
            
            // 根据消息类型创建不同的数据结构
            if (row.is_deleted === 1) {
              // 撤回消息 - 不包含内容字段
              messageData = {
                id: row.id,
                isRecalled: true,
                recallTime: formatLocalTime(row.deleted_at || row.created_at),
                created_at: formatLocalTime(row.created_at),
                messageTime: formatMessageTime(row.created_at),
                relativeTime: getRelativeTime(row.created_at),
                messageType: 'recalled',
                senderId: row.senderId || row.user_id,
                senderName: row.senderName,
                isTopicMessage: true
              };
            } else {
              // 非撤回消息 - 包含完整内容
              messageData = {
                id: row.id,
                topic_id: row.topic_id,
                user_id: row.user_id,
                content: row.content,
                created_at: formatLocalTime(row.created_at),
                updated_at: row.updated_at ? formatLocalTime(row.updated_at) : null,
                message_type: row.message_type,
                message_subtype: row.message_subtype,
                forward_source_id: row.forward_source_id,
                is_deleted: row.is_deleted,
                quoted_message_id: row.quoted_message_id,
                deleted_at: row.deleted_at,
                senderId: row.senderId || row.user_id,
                senderName: row.senderName,
                messageTime: formatMessageTime(row.created_at),
                relativeTime: getRelativeTime(row.created_at),
                messageType: row.message_type || 'normal',
                messageSubtype: row.message_subtype || 'text', // 基本消息类型
                isTopicMessage: true
              };
              
              // 如果是文件、图片或视频消息，添加文件信息
              if (['file', 'image', 'video'].includes(row.message_subtype)) {
                messageData.fileInfo = {
                  url: row.file_url,
                  name: row.file_name,
                  size: row.file_size,
                  type: row.file_type
                };
              }
              
              // 根据具体消息类型添加额外字段
              if (row.message_type === 'forwarded') {
                messageData.originalMessageId = row.forward_source_id;
                // 获取原始消息信息
                if (messageData.originalMessageId) {
                  try {
                    const originalMsg = await Message.getOriginalForwardedMessageInfo(messageData.originalMessageId);
                    messageData.originalMessage = originalMsg;
                  } catch (error) {
                    messageData.originalMessage = null;
                  }
                }
              } else if (row.quoted_message_id) {
                messageData.quotedMessageId = row.quoted_message_id;
                // 获取引用消息信息
                if (messageData.quotedMessageId) {
                  try {
                    const quotedMsg = await Message.getQuotedMessageInfo(messageData.quotedMessageId);
                    messageData.quotedMessage = quotedMsg;
                  } catch (error) {
                    messageData.quotedMessage = null;
                  }
                }
              } else if (row.updated_at) {
                messageData.updated_at = formatLocalTime(row.updated_at);
                // 获取编辑历史
                try {
                  const versions = await Message.getMessageVersions(row.id, false);
                  messageData.editHistory = versions;
                } catch (error) {
                  messageData.editHistory = [];
                }
              }
            }
            
            formattedRows.push(messageData);
          }
          
          resolve(formattedRows.reverse());
        }
      );
    });
  }

  // 获取两个用户之间的私聊消息历史
  static findPrivateMessagesBetweenUsers(userId1, userId2, limit = 50, offset = 0) {
    return new Promise(async (resolve, reject) => {
      db.all(
        `SELECT pm.*, 
                u1.id as senderId, u1.username as senderName, 
                u2.id as receiverId, u2.username as receiverName
         FROM private_messages pm
         JOIN users u1 ON pm.sender_id = u1.id
         JOIN users u2 ON pm.receiver_id = u2.id
         WHERE ((pm.sender_id = ? AND pm.receiver_id = ?) 
            OR (pm.sender_id = ? AND pm.receiver_id = ?))
         ORDER BY pm.created_at DESC
         LIMIT ? OFFSET ?`,
        [userId1, userId2, userId2, userId1, limit, offset],
        async (err, rows) => {
          if (err) return reject(err);
          
          const formattedRows = [];
          for (const row of rows) {
            let messageData;
            
            // 根据消息类型创建不同的数据结构
            if (row.is_deleted === 1) {
              // 撤回消息 - 不包含内容字段
              messageData = {
                id: row.id,
                isRecalled: true,
                recallTime: formatLocalTime(row.deleted_at || row.created_at),
                created_at: formatLocalTime(row.created_at),
                messageTime: formatMessageTime(row.created_at),
                relativeTime: getRelativeTime(row.created_at),
                messageType: 'recalled',
                senderId: row.senderId,
                senderName: row.senderName,
                receiverId: row.receiverId,
                receiverName: row.receiverName
              };
            } else {
              // 非撤回消息 - 包含完整内容
              messageData = {
                id: row.id,
                sender_id: row.sender_id,
                receiver_id: row.receiver_id,
                content: row.content,
                is_read: row.is_read,
                created_at: formatLocalTime(row.created_at),
                updated_at: row.updated_at ? formatLocalTime(row.updated_at) : null,
                message_type: row.message_type,
                message_subtype: row.message_subtype,
                forward_source_id: row.forward_source_id,
                is_deleted: row.is_deleted,
                quoted_message_id: row.quoted_message_id,
                deleted_at: row.deleted_at,
                senderId: row.senderId,
                senderName: row.senderName,
                receiverId: row.receiverId,
                receiverName: row.receiverName,
                messageTime: formatMessageTime(row.created_at),
                relativeTime: getRelativeTime(row.created_at),
                messageType: row.message_type || 'normal',
                messageSubtype: row.message_subtype || 'text' // 基本消息类型
              };
              
              // 如果是文件、图片或视频消息，添加文件信息
              if (['file', 'image', 'video'].includes(row.message_subtype)) {
                messageData.fileInfo = {
                  url: row.file_url,
                  name: row.file_name,
                  size: row.file_size,
                  type: row.file_type
                };
              }
              
              // 根据具体消息类型添加额外字段
              if (row.message_type === 'forwarded') {
                messageData.originalMessageId = row.forward_source_id;
                // 获取原始消息信息
                if (messageData.originalMessageId) {
                  try {
                    const originalMsg = await Message.getOriginalForwardedPrivateMessageInfo(messageData.originalMessageId);
                    messageData.originalMessage = originalMsg;
                  } catch (error) {
                    messageData.originalMessage = null;
                  }
                }
              } else if (row.quoted_message_id) {
                messageData.quotedMessageId = row.quoted_message_id;
                // 获取引用消息信息
                if (messageData.quotedMessageId) {
                  try {
                    const quotedMsg = await Message.getQuotedPrivateMessageInfo(messageData.quotedMessageId);
                    messageData.quotedMessage = quotedMsg;
                  } catch (error) {
                    messageData.quotedMessage = null;
                  }
                }
              } else if (row.updated_at) {
                messageData.updated_at = formatLocalTime(row.updated_at);
                // 获取编辑历史
                try {
                  const versions = await Message.getMessageVersions(row.id, true);
                  messageData.editHistory = versions;
                } catch (error) {
                  messageData.editHistory = [];
                }
              }
            }
            
            formattedRows.push(messageData);
          }
          
          resolve(formattedRows.reverse());
        }
      );
    });
  }

  // 获取用户收到的私聊消息（未读）
  static findUnreadPrivateMessagesByReceiver(receiverId) {
    return new Promise(async (resolve, reject) => {
      db.all(
        `SELECT pm.*, 
                u1.id as senderId, u1.username as senderName
         FROM private_messages pm
         JOIN users u1 ON pm.sender_id = u1.id
         WHERE pm.receiver_id = ?
         ORDER BY pm.created_at ASC`,
        [receiverId],
        async (err, rows) => {
          if (err) return reject(err);
          
          const formattedRows = [];
          for (const row of rows) {
            let messageData;
            
            // 根据消息类型创建不同的数据结构
            if (row.is_deleted === 1) {
              // 撤回消息 - 不包含内容字段
              messageData = {
                id: row.id,
                isRecalled: true,
                recallTime: formatLocalTime(row.deleted_at || row.created_at),
                created_at: formatLocalTime(row.created_at),
                messageTime: formatMessageTime(row.created_at),
                relativeTime: getRelativeTime(row.created_at),
                messageType: 'recalled',
                senderId: row.senderId,
                senderName: row.senderName
              };
            } else {
              // 非撤回消息 - 包含完整内容
              messageData = {
                id: row.id,
                sender_id: row.sender_id,
                receiver_id: row.receiver_id,
                content: row.content,
                is_read: row.is_read,
                created_at: formatLocalTime(row.created_at),
                updated_at: row.updated_at ? formatLocalTime(row.updated_at) : null,
                message_type: row.message_type,
                message_subtype: row.message_subtype,
                forward_source_id: row.forward_source_id,
                is_deleted: row.is_deleted,
                quoted_message_id: row.quoted_message_id,
                deleted_at: row.deleted_at,
                senderId: row.senderId,
                senderName: row.senderName,
                messageTime: formatMessageTime(row.created_at),
                relativeTime: getRelativeTime(row.created_at),
                messageType: row.message_type || 'normal',
                messageSubtype: row.message_subtype || 'text' // 基本消息类型
              };
              
              // 如果是文件、图片或视频消息，添加文件信息
              if (['file', 'image', 'video'].includes(row.message_subtype)) {
                messageData.fileInfo = {
                  url: row.file_url,
                  name: row.file_name,
                  size: row.file_size,
                  type: row.file_type
                };
              }
              
              // 根据具体消息类型添加额外字段
              if (row.message_type === 'forwarded') {
                messageData.originalMessageId = row.forward_source_id;
                // 获取原始消息信息
                if (messageData.originalMessageId) {
                  try {
                    const originalMsg = await Message.getOriginalForwardedPrivateMessageInfo(messageData.originalMessageId);
                    messageData.originalMessage = originalMsg;
                  } catch (error) {
                    messageData.originalMessage = null;
                  }
                }
              } else if (row.quoted_message_id) {
                messageData.quotedMessageId = row.quoted_message_id;
                // 获取引用消息信息
                if (messageData.quotedMessageId) {
                  try {
                    const quotedMsg = await Message.getQuotedPrivateMessageInfo(messageData.quotedMessageId);
                    messageData.quotedMessage = quotedMsg;
                  } catch (error) {
                    messageData.quotedMessage = null;
                  }
                }
              } else if (row.updated_at) {
                messageData.updated_at = formatLocalTime(row.updated_at);
                // 获取编辑历史
                try {
                  const versions = await Message.getMessageVersions(row.id, true);
                  messageData.editHistory = versions;
                } catch (error) {
                  messageData.editHistory = [];
                }
              }
            }
            
            formattedRows.push(messageData);
          }
          
          resolve(formattedRows);
        }
      );
    });
  }

  static getRecentMessages(limit = 10) {
    return new Promise(async (resolve, reject) => {
      db.all(
        `SELECT m.*, u.id as senderId, u.username as senderName, t.name as topicName
         FROM messages m
         JOIN users u ON m.user_id = u.id
         LEFT JOIN topics t ON m.topic_id = t.id
         ORDER BY m.created_at DESC
         LIMIT ?`,
        [limit],
        async (err, rows) => {
          if (err) return reject(err);
          
          const formattedRows = [];
          for (const row of rows) {
            let messageData;
            
            // 根据消息类型创建不同的数据结构
            if (row.is_deleted === 1) {
              // 撤回消息 - 不包含内容字段
              messageData = {
                id: row.id,
                isRecalled: true,
                recallTime: formatLocalTime(row.deleted_at || row.created_at),
                created_at: formatLocalTime(row.created_at),
                messageTime: formatMessageTime(row.created_at),
                relativeTime: getRelativeTime(row.created_at),
                messageType: 'recalled',
                senderId: row.senderId || row.user_id,
                senderName: row.senderName,
                topicName: row.topicName,
                isTopicMessage: !!row.topic_id
              };
            } else {
              // 非撤回消息 - 包含完整内容
              messageData = {
                id: row.id,
                topic_id: row.topic_id,
                user_id: row.user_id,
                content: row.content,
                created_at: formatLocalTime(row.created_at),
                updated_at: row.updated_at ? formatLocalTime(row.updated_at) : null,
                message_type: row.message_type,
                forward_source_id: row.forward_source_id,
                is_deleted: row.is_deleted,
                quoted_message_id: row.quoted_message_id,
                deleted_at: row.deleted_at,
                senderId: row.senderId || row.user_id,
                senderName: row.senderName,
                messageTime: formatMessageTime(row.created_at),
                relativeTime: getRelativeTime(row.created_at),
                messageType: row.message_type || 'normal',
                isTopicMessage: !!row.topic_id,
                topicName: row.topicName
              };
              
              // 根据具体消息类型添加额外字段
              if (row.message_type === 'forwarded') {
                messageData.originalMessageId = row.forward_source_id;
                // 获取原始消息信息
                if (messageData.originalMessageId) {
                  try {
                    const originalMsg = await Message.getOriginalForwardedMessageInfo(messageData.originalMessageId);
                    messageData.originalMessage = originalMsg;
                  } catch (error) {
                    messageData.originalMessage = null;
                  }
                }
              } else if (row.quoted_message_id) {
                messageData.quotedMessageId = row.quoted_message_id;
                // 获取引用消息信息
                if (messageData.quotedMessageId) {
                  try {
                    const quotedMsg = await Message.getQuotedMessageInfo(messageData.quotedMessageId);
                    messageData.quotedMessage = quotedMsg;
                  } catch (error) {
                    messageData.quotedMessage = null;
                  }
                }
              } else if (row.updated_at) {
                messageData.updated_at = formatLocalTime(row.updated_at);
                // 获取编辑历史
                try {
                  const versions = await Message.getMessageVersions(row.id, false);
                  messageData.editHistory = versions;
                } catch (error) {
                  messageData.editHistory = [];
                }
              }
            }
            
            formattedRows.push(messageData);
          }
          
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
                content: `${latestMessage.senderName}：${latestMessage.content}`,
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
    return new Promise(async (resolve, reject) => {
      db.get(
        `SELECT m.*, u.id as senderId, u.username as senderName, t.name as topicName
         FROM messages m
         JOIN users u ON m.user_id = u.id
         LEFT JOIN topics t ON m.topic_id = t.id
         ORDER BY m.created_at DESC LIMIT 1`,
        async (err, row) => {
          if (err) return reject(err);
          if (row) {
            let messageData;
            
            // 根据消息类型创建不同的数据结构
            if (row.is_deleted === 1) {
              // 撤回消息 - 不包含内容字段
              messageData = {
                id: row.id,
                isRecalled: true,
                recallTime: formatLocalTime(row.deleted_at || row.created_at),
                created_at: formatLocalTime(row.created_at),
                messageTime: formatMessageTime(row.created_at),
                relativeTime: getRelativeTime(row.created_at),
                messageType: 'recalled',
                senderId: row.senderId || row.user_id,
                senderName: row.senderName,
                topicName: row.topicName,
                isTopicMessage: !!row.topic_id
              };
            } else {
              // 非撤回消息 - 包含完整内容
              messageData = {
                id: row.id,
                topic_id: row.topic_id,
                user_id: row.user_id,
                content: row.content,
                created_at: formatLocalTime(row.created_at),
                updated_at: row.updated_at ? formatLocalTime(row.updated_at) : null,
                message_type: row.message_type,
                forward_source_id: row.forward_source_id,
                is_deleted: row.is_deleted,
                quoted_message_id: row.quoted_message_id,
                deleted_at: row.deleted_at,
                senderId: row.senderId || row.user_id,
                senderName: row.senderName,
                messageTime: formatMessageTime(row.created_at),
                relativeTime: getRelativeTime(row.created_at),
                messageType: row.message_type || 'normal',
                isTopicMessage: !!row.topic_id,
                topicName: row.topicName
              };
              
              // 根据具体消息类型添加额外字段
              if (row.message_type === 'forwarded') {
                messageData.originalMessageId = row.forward_source_id;
                // 获取原始消息信息
                if (messageData.originalMessageId) {
                  try {
                    const originalMsg = await Message.getOriginalForwardedMessageInfo(messageData.originalMessageId);
                    messageData.originalMessage = originalMsg;
                  } catch (error) {
                    messageData.originalMessage = null;
                  }
                }
              } else if (row.quoted_message_id) {
                messageData.quotedMessageId = row.quoted_message_id;
                // 获取引用消息信息
                if (messageData.quotedMessageId) {
                  try {
                    const quotedMsg = await Message.getQuotedMessageInfo(messageData.quotedMessageId);
                    messageData.quotedMessage = quotedMsg;
                  } catch (error) {
                    messageData.quotedMessage = null;
                  }
                }
              } else if (row.updated_at) {
                messageData.updated_at = formatLocalTime(row.updated_at);
                // 获取编辑历史
                try {
                  const versions = await Message.getMessageVersions(row.id, false);
                  messageData.editHistory = versions;
                } catch (error) {
                  messageData.editHistory = [];
                }
              }
            }
            
            resolve(messageData);
          } else {
            resolve(row);
          }
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
    return new Promise(async (resolve, reject) => {
      db.get(
        `SELECT m.*, u.id as senderId, u.username as senderName
         FROM messages m
         JOIN users u ON m.user_id = u.id
         WHERE m.topic_id = ?
         ORDER BY m.created_at DESC 
         LIMIT 1`,
        [topicId],
        async (err, row) => {
          if (err) return reject(err);
          if (row) {
            let messageData;
            
            // 根据消息类型创建不同的数据结构
            if (row.is_deleted === 1) {
              // 撤回消息 - 不包含内容字段
              messageData = {
                id: row.id,
                isRecalled: true,
                recallTime: formatLocalTime(row.deleted_at || row.created_at),
                created_at: formatLocalTime(row.created_at),
                messageTime: formatMessageTime(row.created_at),
                relativeTime: getRelativeTime(row.created_at),
                messageType: 'recalled',
                senderId: row.senderId || row.user_id,
                senderName: row.senderName,
                isTopicMessage: true
              };
            } else {
              // 非撤回消息 - 包含完整内容
              messageData = {
                id: row.id,
                topic_id: row.topic_id,
                user_id: row.user_id,
                content: row.content,
                created_at: formatLocalTime(row.created_at),
                updated_at: row.updated_at ? formatLocalTime(row.updated_at) : null,
                message_type: row.message_type,
                forward_source_id: row.forward_source_id,
                is_deleted: row.is_deleted,
                quoted_message_id: row.quoted_message_id,
                deleted_at: row.deleted_at,
                senderId: row.senderId || row.user_id,
                senderName: row.senderName,
                messageTime: formatMessageTime(row.created_at),
                relativeTime: getRelativeTime(row.created_at),
                messageType: row.message_type || 'normal',
                isTopicMessage: true
              };
              
              // 根据具体消息类型添加额外字段
              if (row.message_type === 'forwarded') {
                messageData.originalMessageId = row.forward_source_id;
                // 获取原始消息信息
                if (messageData.originalMessageId) {
                  try {
                    const originalMsg = await Message.getOriginalForwardedMessageInfo(messageData.originalMessageId);
                    messageData.originalMessage = originalMsg;
                  } catch (error) {
                    messageData.originalMessage = null;
                  }
                }
              } else if (row.quoted_message_id) {
                messageData.quotedMessageId = row.quoted_message_id;
                // 获取引用消息信息
                if (messageData.quotedMessageId) {
                  try {
                    const quotedMsg = await Message.getQuotedMessageInfo(messageData.quotedMessageId);
                    messageData.quotedMessage = quotedMsg;
                  } catch (error) {
                    messageData.quotedMessage = null;
                  }
                }
              } else if (row.updated_at) {
                messageData.updated_at = formatLocalTime(row.updated_at);
                // 获取编辑历史
                try {
                  const versions = await Message.getMessageVersions(row.id, false);
                  messageData.editHistory = versions;
                } catch (error) {
                  messageData.editHistory = [];
                }
              }
            }
            
            resolve(messageData);
          } else {
            resolve(row);
          }
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

  // 获取原始转发消息信息
  static getOriginalForwardedMessageInfo(messageId) {
    return new Promise((resolve, reject) => {
      db.get(
        `SELECT m.*, u.id as senderId, u.username as senderName, t.name as topicName
         FROM messages m
         JOIN users u ON m.user_id = u.id
         LEFT JOIN topics t ON m.topic_id = t.id
         WHERE m.id = ?`,
        [messageId],
        (err, row) => {
          if (err) return reject(err);
          if (row) {
            const originalMessage = {
              id: row.id,
              topic_id: row.topic_id,
              user_id: row.user_id,
              senderId: row.senderId,
              senderName: row.senderName,
              content: row.content,
              created_at: formatLocalTime(row.created_at),
              messageTime: formatMessageTime(row.created_at),
              relativeTime: getRelativeTime(row.created_at),
              isTopicMessage: !!row.topic_id,
              messageType: row.message_type || 'normal',
              topicName: row.topicName
            };
            resolve(originalMessage);
          } else {
            resolve(null);
          }
        }
      );
    });
  }

  // 获取原始转发私聊消息信息
  static getOriginalForwardedPrivateMessageInfo(messageId) {
    return new Promise((resolve, reject) => {
      db.get(
        `SELECT pm.*, u.id as senderId, u.username as senderName
         FROM private_messages pm
         JOIN users u ON pm.sender_id = u.id
         WHERE pm.id = ?`,
        [messageId],
        (err, row) => {
          if (err) return reject(err);
          if (row) {
            const originalMessage = {
              id: row.id,
              sender_id: row.sender_id,
              receiver_id: row.receiver_id,
              senderId: row.senderId,
              senderName: row.senderName,
              receiverName: row.receiverName,
              content: row.content,
              created_at: formatLocalTime(row.created_at),
              messageTime: formatMessageTime(row.created_at),
              relativeTime: getRelativeTime(row.created_at),
              messageType: row.message_type || 'normal'
            };
            resolve(originalMessage);
          } else {
            resolve(null);
          }
        }
      );
    });
  }

  // 获取两个用户之间最新的私聊消息
  static getLatestPrivateMessageBetweenUsers(userId1, userId2) {
    return new Promise(async (resolve, reject) => {
      db.get(
        `SELECT pm.*, u.id as senderId, u.username as senderName
         FROM private_messages pm
         JOIN users u ON pm.sender_id = u.id
         WHERE (pm.sender_id = ? AND pm.receiver_id = ?) 
            OR (pm.sender_id = ? AND pm.receiver_id = ?)
         ORDER BY pm.created_at DESC 
         LIMIT 1`,
        [userId1, userId2, userId2, userId1],
        async (err, row) => {
          if (err) return reject(err);
          if (row) {
            let messageData;
            
            // 根据消息类型创建不同的数据结构
            if (row.is_deleted === 1) {
              // 撤回消息 - 不包含内容字段
              messageData = {
                id: row.id,
                isRecalled: true,
                recallTime: formatLocalTime(row.deleted_at || row.created_at),
                created_at: formatLocalTime(row.created_at),
                messageTime: formatMessageTime(row.created_at),
                relativeTime: getRelativeTime(row.created_at),
                messageType: 'recalled',
                senderId: row.senderId,
                senderName: row.senderName
              };
            } else {
              // 非撤回消息 - 包含完整内容
              messageData = {
                id: row.id,
                sender_id: row.sender_id,
                receiver_id: row.receiver_id,
                content: row.content,
                is_read: row.is_read,
                created_at: formatLocalTime(row.created_at),
                updated_at: row.updated_at ? formatLocalTime(row.updated_at) : null,
                message_type: row.message_type,
                forward_source_id: row.forward_source_id,
                is_deleted: row.is_deleted,
                quoted_message_id: row.quoted_message_id,
                deleted_at: row.deleted_at,
                senderId: row.senderId,
                senderName: row.senderName,
                messageTime: formatMessageTime(row.created_at),
                relativeTime: getRelativeTime(row.created_at),
                messageType: row.message_type || 'normal'
              };
              
              // 根据具体消息类型添加额外字段
              if (row.message_type === 'forwarded') {
                messageData.originalMessageId = row.forward_source_id;
                // 获取原始消息信息
                if (messageData.originalMessageId) {
                  try {
                    const originalMsg = await Message.getOriginalForwardedPrivateMessageInfo(messageData.originalMessageId);
                    messageData.originalMessage = originalMsg;
                  } catch (error) {
                    messageData.originalMessage = null;
                  }
                }
              } else if (row.quoted_message_id) {
                messageData.quotedMessageId = row.quoted_message_id;
                // 获取引用消息信息
                if (messageData.quotedMessageId) {
                  try {
                    const quotedMsg = await Message.getQuotedPrivateMessageInfo(messageData.quotedMessageId);
                    messageData.quotedMessage = quotedMsg;
                  } catch (error) {
                    messageData.quotedMessage = null;
                  }
                }
              } else if (row.updated_at) {
                messageData.updated_at = formatLocalTime(row.updated_at);
                // 获取编辑历史
                try {
                  const versions = await Message.getMessageVersions(row.id, true);
                  messageData.editHistory = versions;
                } catch (error) {
                  messageData.editHistory = [];
                }
              }
            }
            
            resolve(messageData);
          } else {
            resolve(row);
          }
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

  // 撤回消息
  static async recallMessage(messageId, userId, isPrivate = false, topicId = null) {
    const table = isPrivate ? 'private_messages' : 'messages';
    const currentTime = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false });
    
    if (topicId) {
      // 话题中的消息撤回逻辑
      // 首先获取消息信息
      const message = await new Promise((resolve, reject) => {
        db.get(`SELECT ${isPrivate ? 'sender_id' : 'user_id'} as senderId FROM ${table} WHERE id = ? AND topic_id = ?`, 
               [messageId, topicId], (err, row) => {
          if (err) return reject(err);
          resolve(row);
        });
      });
      
      if (!message) {
        return { success: false };
      }
      
      const messageSenderId = message.senderId;
      
      // 检查权限
      let hasPermission = false;
      
      // 1. 消息发送者可以撤回自己的消息
      if (messageSenderId == userId) {
        hasPermission = true;
      } else {
        // 导入Topic模型以检查权限
        const Topic = require('./Topic');
        
        // 2. 话题创建者可以撤回任何人的消息
        const isTopicCreator = await Topic.isCreator(topicId, userId);
        if (isTopicCreator) {
          hasPermission = true;
        } else {
          // 3. 管理员可以撤回普通成员的消息，但不能撤回其他管理员的消息
          const isUserAdmin = await Topic.isAdmin(topicId, userId);
          if (isUserAdmin) {
            // 检查被撤回消息的发送者是否也是管理员
            const isMessageSenderAdmin = await Topic.isAdmin(topicId, messageSenderId);
            if (!isMessageSenderAdmin) {
              hasPermission = true;
            }
          }
        }
      }
      
      if (!hasPermission) {
        return { success: false };
      }
      
      // 执行撤回操作
      return new Promise((resolve, reject) => {
        const sql = `UPDATE ${table} SET is_deleted = 1, deleted_at = ? WHERE id = ?`;
        db.run(sql, [currentTime, messageId], function(err) {
          if (err) return reject(err);
          resolve({ success: this.changes > 0, isRecalled: true });
        });
      });
    } else {
      // 非话题消息（私聊或公共消息）只能由发送者撤回
      return new Promise((resolve, reject) => {
        const sql = `UPDATE ${table} SET is_deleted = 1, deleted_at = ? WHERE id = ? AND 
                      (${isPrivate ? 'sender_id' : 'user_id'} = ?)`;
        db.run(sql, [currentTime, messageId, userId], function(err) {
          if (err) return reject(err);
          resolve({ success: this.changes > 0, isRecalled: true });
        });
      });
    }
  }

  // 编辑消息
  static editMessage(messageId, userId, newContent, isPrivate = false) {
    return new Promise((resolve, reject) => {
      const table = isPrivate ? 'private_messages' : 'messages';
      const currentTime = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false });
      
      // 保存旧版本到历史记录
      const saveVersionSql = `INSERT INTO message_versions (message_id, content, created_at, message_type) 
                             SELECT id, content, created_at, '${isPrivate ? 'private' : 'public'}' 
                             FROM ${table} WHERE id = ?`;
      
      db.serialize(() => {
        // 保存旧版本
        db.run(saveVersionSql, [messageId], (err) => {
          if (err) {
            console.error('保存消息版本失败:', err);
            // 即使保存版本失败，也继续编辑消息
          }
          
          // 更新消息内容（仅允许发送者编辑自己的消息）
          const updateSql = `UPDATE ${table} SET content = ?, updated_at = ? WHERE id = ? AND 
                            (${isPrivate ? 'sender_id' : 'user_id'} = ?)`;
          
          db.run(updateSql, [newContent, currentTime, messageId, userId], function(err) {
            if (err) return reject(err);
            resolve({ success: this.changes > 0, isEdited: true });
          });
        });
      });
    });
  }

  // 获取消息历史版本
  static getMessageVersions(messageId, isPrivate = false) {
    return new Promise((resolve, reject) => {
      const messageType = isPrivate ? 'private' : 'public';
      
      db.all(
        `SELECT * FROM message_versions 
         WHERE message_id = ? AND message_type = ?
         ORDER BY created_at DESC`,
        [messageId, messageType],
        (err, rows) => {
          if (err) return reject(err);
          
          // 格式化时间
          const formattedRows = rows.map(row => ({
            ...row,
            created_at: formatLocalTime(row.created_at)
          }));
          
          resolve(formattedRows);
        }
      );
    });
  }

  // 转发消息
  static forwardMessages(originalMessageIds, forwarderId, targetTopicId = null, targetReceiverId = null) {
    return new Promise(async (resolve, reject) => {
      try {
        const forwardedMessages = [];
        
        for (const originalMessageId of originalMessageIds) {
          // 获取原始消息
          let originalMessage;
          if (targetReceiverId) {
            // 私聊消息转发
            originalMessage = await Message.findPrivateById(originalMessageId);
          } else {
            // 公共消息或话题消息转发
            originalMessage = await Message.findById(originalMessageId);
          }
          
          if (!originalMessage) {
            continue; // 跳过不存在的消息
          }
          
          // 创建转发消息
          const forwardContent = `[转发自 ${originalMessage.senderName}]: ${originalMessage.content}`;
          
          let forwardedMessageId;
          if (targetReceiverId) {
            // 转发到私聊
            const privateMessageData = {
              sender_id: forwarderId,
              receiver_id: targetReceiverId,
              content: forwardContent,
              message_type: 'forwarded',
              message_subtype: originalMessage.messageSubtype || 'text', // 保持原始消息的基本类型
              forward_source_id: originalMessageId,
              // 如果原始消息是文件类型，保留文件信息
              file_url: originalMessage.fileInfo ? originalMessage.fileInfo.url : null,
              file_name: originalMessage.fileInfo ? originalMessage.fileInfo.name : null,
              file_size: originalMessage.fileInfo ? originalMessage.fileInfo.size : null,
              file_type: originalMessage.fileInfo ? originalMessage.fileInfo.type : null
            };
            
            const privateMessage = await Message.createPrivate(privateMessageData);
            forwardedMessageId = privateMessage.id;
          } else {
            // 转发到话题或公共聊天室
            const messageData = {
              topic_id: targetTopicId,
              user_id: forwarderId,
              content: forwardContent,
              message_type: 'forwarded',
              message_subtype: originalMessage.messageSubtype || 'text', // 保持原始消息的基本类型
              forward_source_id: originalMessageId,
              // 如果原始消息是文件类型，保留文件信息
              file_url: originalMessage.fileInfo ? originalMessage.fileInfo.url : null,
              file_name: originalMessage.fileInfo ? originalMessage.fileInfo.name : null,
              file_size: originalMessage.fileInfo ? originalMessage.fileInfo.size : null,
              file_type: originalMessage.fileInfo ? originalMessage.fileInfo.type : null
            };
            
            forwardedMessageId = await Message.create(messageData);
          }
          
          // 记录转发关系
          const currentTime = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false });
          await new Promise((res, rej) => {
            db.run(
              `INSERT INTO forwarded_messages 
               (original_message_id, forwarded_message_id, forwarder_id, created_at, message_type) 
               VALUES (?, ?, ?, ?, ?)`,
              [originalMessageId, forwardedMessageId, forwarderId, currentTime, targetReceiverId ? 'private' : 'public'],
              (err) => {
                if (err) return rej(err);
                res();
              }
            );
          });
          
          forwardedMessages.push({
            originalMessageId,
            forwardedMessageId
          });
        }
        
        resolve({
          success: true,
          forwardedMessages
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  // 获取引用消息信息
  static getQuotedMessageInfo(quotedMessageId) {
    return new Promise((resolve, reject) => {
      db.get(
        `SELECT m.*, u.id as senderId, u.username as senderName
         FROM messages m
         JOIN users u ON m.user_id = u.id
         WHERE m.id = ?`,
        [quotedMessageId],
        (err, row) => {
          if (err) return reject(err);
          if (row) {
            const messageData = {
              ...row,
              created_at: formatLocalTime(row.created_at),
              messageTime: formatMessageTime(row.created_at),
              relativeTime: getRelativeTime(row.created_at),
              // 添加消息类型信息
              messageType: row.message_type || 'normal',
              isEdited: !!row.updated_at,
              isRecalled: row.is_deleted === 1,
              isQuoted: !!row.quoted_message_id
            };
            
            // 如果是撤回的消息，显示特殊内容
            if (messageData.isRecalled) {
              messageData.content = '[消息已被撤回]';
              // 清除其他敏感信息
              delete messageData.quotedMessage;
            }
            
            resolve(messageData);
          } else {
            resolve(row);
          }
        }
      );
    });
  }

  // 获取私聊引用消息信息
  static getQuotedPrivateMessageInfo(quotedMessageId) {
    return new Promise((resolve, reject) => {
      db.get(
        `SELECT pm.*, u.id as senderId, u.username as senderName
         FROM private_messages pm
         JOIN users u ON pm.sender_id = u.id
         WHERE pm.id = ?`,
        [quotedMessageId],
        (err, row) => {
          if (err) return reject(err);
          if (row) {
            const messageData = {
              ...row,
              created_at: formatLocalTime(row.created_at),
              messageTime: formatMessageTime(row.created_at),
              relativeTime: getRelativeTime(row.created_at),
              // 添加消息类型信息
              messageType: row.message_type || 'normal',
              isEdited: !!row.updated_at,
              isRecalled: row.is_deleted === 1,
              isQuoted: !!row.quoted_message_id
            };
            
            // 如果是撤回的消息，显示特殊内容
            if (messageData.isRecalled) {
              messageData.content = '[消息已被撤回]';
              // 清除其他敏感信息
              delete messageData.quotedMessage;
            }
            
            resolve(messageData);
          } else {
            resolve(row);
          }
        }
      );
    });
  }

  // 检查消息是否已撤回
  static isMessageDeleted(messageId, isPrivate = false) {
    return new Promise((resolve, reject) => {
      const table = isPrivate ? 'private_messages' : 'messages';
      
      db.get(
        `SELECT is_deleted FROM ${table} WHERE id = ?`,
        [messageId],
        (err, row) => {
          if (err) return reject(err);
          resolve(row ? row.is_deleted === 1 : false);
        }
      );
    });
  }

  // 检查消息是否属于特定话题
  static isMessageInTopic(messageId, topicId, isPrivate = false) {
    return new Promise((resolve, reject) => {
      const table = isPrivate ? 'private_messages' : 'messages';
      
      db.get(
        `SELECT 1 FROM ${table} WHERE id = ? AND topic_id = ?`,
        [messageId, topicId],
        (err, row) => {
          if (err) return reject(err);
          resolve(!!row);
        }
      );
    });
  }
}

module.exports = Message;