const db = require('../config/database');
const { formatLocalTime } = require('../utils/timezone');

class Topic {
  static create(topicData) {
    return new Promise((resolve, reject) => {
      // 所有话题默认为私有
      const { name, description, created_by } = topicData;
      const is_private = 1; // 强制设置为私有
      
      // 使用本地时间
      const currentTime = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false });
      
      db.run(
        "INSERT INTO topics (name, description, announcement, created_by, is_private, is_active, message_count, last_activity, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [name, description, null, created_by, is_private, 1, 0, currentTime, currentTime],
        function(err) {
          if (err) return reject(err);
          
          const topicId = this.lastID;
          
          // 自动将创建者加入话题并设为创建者角色
          db.run(
            "INSERT INTO topic_members (topic_id, user_id, role, joined_at) VALUES (?, ?, 'creator', ?)",
            [topicId, created_by, currentTime],
            (err) => {
              if (err) {
                console.error("添加创建者到话题成员失败:", err);
              }
              resolve(topicId);
            }
          );
        }
      );
    });
  }

  // 获取用户加入的所有话题
  static findByUser(userId, limit = 50) {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT t.*, u.id as creatorId, u.username as creatorName
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

  // 获取用户加入的所有话题（带最新消息）
  static findByUserWithLatestMessage(userId, limit = 50) {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT t.*, u.id as creatorId, u.username as creatorName
         FROM topics t
         LEFT JOIN users u ON t.created_by = u.id
         INNER JOIN topic_members tm ON t.id = tm.topic_id
         WHERE tm.user_id = ? AND t.is_active = 1
         ORDER BY t.last_activity DESC, t.created_at DESC
         LIMIT ?`,
        [userId, limit],
        async (err, rows) => {
          if (err) return reject(err);
          
          // 为每个话题获取最新消息
          const topicsWithLatestMessage = await Promise.all(rows.map(async (topic) => {
            const latestMessage = await require('./Message').getLatestMessageByTopic(topic.id);
            return {
              ...topic,
              latestMessage: latestMessage ? {
                content: `${latestMessage.senderName}：${latestMessage.content}`,
                createdAt: latestMessage.created_at
              } : null
            };
          }));
          
          resolve(topicsWithLatestMessage);
        }
      );
    });
  }

  // 获取推荐话题 - 消息数较多的话题
  static getPopularTopics(limit = 10) {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT t.*, u.id as creatorId, u.username as creatorName, COUNT(m.id) as message_count
         FROM topics t
         LEFT JOIN users u ON t.created_by = u.id
         LEFT JOIN messages m ON t.id = m.topic_id
         WHERE t.is_active = 1
         GROUP BY t.id
         ORDER BY message_count DESC, t.last_activity DESC
         LIMIT ?`,
        [limit],
        (err, rows) => {
          if (err) return reject(err);
          resolve(rows);
        }
      );
    });
  }

  // 获取推荐话题 - 消息数较多的话题（带最新消息）
  static getPopularTopicsWithLatestMessage(limit = 10) {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT t.*, u.id as creatorId, u.username as creatorName, COUNT(m.id) as message_count
         FROM topics t
         LEFT JOIN users u ON t.created_by = u.id
         LEFT JOIN messages m ON t.id = m.topic_id
         WHERE t.is_active = 1
         GROUP BY t.id
         ORDER BY message_count DESC, t.last_activity DESC
         LIMIT ?`,
        [limit],
        async (err, rows) => {
          if (err) return reject(err);
          
          // 为每个话题获取最新消息
          const topicsWithLatestMessage = await Promise.all(rows.map(async (topic) => {
            const latestMessage = await require('./Message').getLatestMessageByTopic(topic.id);
            return {
              ...topic,
              latestMessage: latestMessage ? {
                content: `${latestMessage.senderName}：${latestMessage.content}`,
                createdAt: latestMessage.created_at
              } : null
            };
          }));
          
          resolve(topicsWithLatestMessage);
        }
      );
    });
  }

  // 获取推荐话题 - 近期活跃的话题（7天内有人发消息）
  static getRecentActiveTopics(limit = 10) {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT t.*, u.id as creatorId, u.username as creatorName
         FROM topics t
         LEFT JOIN users u ON t.created_by = u.id
         WHERE t.is_active = 1 
         AND t.last_activity >= datetime('now', '-7 days', 'localtime')
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

  // 获取推荐话题 - 近期活跃的话题（7天内有人发消息，带最新消息）
  static getRecentActiveTopicsWithLatestMessage(limit = 10) {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT t.*, u.id as creatorId, u.username as creatorName
         FROM topics t
         LEFT JOIN users u ON t.created_by = u.id
         WHERE t.is_active = 1 
         AND t.last_activity >= datetime('now', '-7 days', 'localtime')
         ORDER BY t.last_activity DESC
         LIMIT ?`,
        [limit],
        async (err, rows) => {
          if (err) return reject(err);
          
          // 为每个话题获取最新消息
          const topicsWithLatestMessage = await Promise.all(rows.map(async (topic) => {
            const latestMessage = await require('./Message').getLatestMessageByTopic(topic.id);
            return {
              ...topic,
              latestMessage: latestMessage ? {
                content: `${latestMessage.senderName}：${latestMessage.content}`,
                createdAt: latestMessage.created_at
              } : null
            };
          }));
          
          resolve(topicsWithLatestMessage);
        }
      );
    });
  }

  // 获取推荐话题 - 新创建的话题
  static getNewTopics(limit = 10) {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT t.*, u.id as creatorId, u.username as creatorName
         FROM topics t
         LEFT JOIN users u ON t.created_by = u.id
         WHERE t.is_active = 1
         ORDER BY t.created_at DESC
         LIMIT ?`,
        [limit],
        (err, rows) => {
          if (err) return reject(err);
          resolve(rows);
        }
      );
    });
  }

  // 获取推荐话题 - 新创建的话题（带最新消息）
  static getNewTopicsWithLatestMessage(limit = 10) {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT t.*, u.id as creatorId, u.username as creatorName
         FROM topics t
         LEFT JOIN users u ON t.created_by = u.id
         WHERE t.is_active = 1
         ORDER BY t.created_at DESC
         LIMIT ?`,
        [limit],
        async (err, rows) => {
          if (err) return reject(err);
          
          // 为每个话题获取最新消息
          const topicsWithLatestMessage = await Promise.all(rows.map(async (topic) => {
            const latestMessage = await require('./Message').getLatestMessageByTopic(topic.id);
            return {
              ...topic,
              latestMessage: latestMessage ? {
                content: `${latestMessage.senderName}：${latestMessage.content}`,
                createdAt: latestMessage.created_at
              } : null
            };
          }));
          
          resolve(topicsWithLatestMessage);
        }
      );
    });
  }

  // 获取所有话题（仅用户加入的）
  static findAll(userId, limit = 50) {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT t.*, u.id as creatorId, u.username as creatorName
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

  // 获取所有话题（仅用户加入的，带最新消息）
  static findAllWithLatestMessage(userId, limit = 50) {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT t.*, u.id as creatorId, u.username as creatorName
         FROM topics t
         LEFT JOIN users u ON t.created_by = u.id
         INNER JOIN topic_members tm ON t.id = tm.topic_id
         WHERE tm.user_id = ? AND t.is_active = 1
         ORDER BY t.last_activity DESC, t.created_at DESC
         LIMIT ?`,
        [userId, limit],
        async (err, rows) => {
          if (err) return reject(err);
          
          // 为每个话题获取最新消息
          const topicsWithLatestMessage = await Promise.all(rows.map(async (topic) => {
            const latestMessage = await require('./Message').getLatestMessageByTopic(topic.id);
            return {
              ...topic,
              latestMessage: latestMessage ? {
                content: `${latestMessage.senderName}：${latestMessage.content}`,
                createdAt: latestMessage.created_at
              } : null
            };
          }));
          
          resolve(topicsWithLatestMessage);
        }
      );
    });
  }

  // 搜索话题（按名称或ID，仅显示非私有话题或用户已加入的私有话题）
  static search(query, userId, limit = 50) {
    return new Promise((resolve, reject) => {
      // 如果查询是数字，按ID搜索；否则按名称搜索
      let sql, params;
      if (!isNaN(query)) {
        // 按ID搜索（仅非私有话题或用户已加入的私有话题）
        sql = `SELECT t.*, u.id as creatorId, u.username as creatorName
               FROM topics t
               LEFT JOIN users u ON t.created_by = u.id
               LEFT JOIN topic_members tm ON t.id = tm.topic_id AND tm.user_id = ?
               WHERE t.id = ? AND t.is_active = 1 AND (t.is_private = 0 OR tm.user_id IS NOT NULL)
               LIMIT ?`;
        params = [userId, parseInt(query), limit];
      } else {
        // 按名称搜索（仅非私有话题或用户已加入的私有话题）
        sql = `SELECT t.*, u.id as creatorId, u.username as creatorName
               FROM topics t
               LEFT JOIN users u ON t.created_by = u.id
               LEFT JOIN topic_members tm ON t.id = tm.topic_id AND tm.user_id = ?
               WHERE t.name LIKE ? AND t.is_active = 1 AND (t.is_private = 0 OR tm.user_id IS NOT NULL)
               ORDER BY t.last_activity DESC, t.created_at DESC
               LIMIT ?`;
        params = [userId, `%${query}%`, limit];
      }
      
      db.all(sql, params, (err, rows) => {
        if (err) return reject(err);
        
        // 为每个话题添加用户是否已加入的信息
        const topicPromises = rows.map(async (topic) => {
          const isMember = await Topic.isMember(topic.id, userId);
          return {
            ...topic,
            is_member: isMember
          };
        });
        
        Promise.all(topicPromises).then(resolve).catch(reject);
      });
    });
  }

  // 搜索话题（按名称或ID，仅显示非私有话题或用户已加入的私有话题，带最新消息）
  static searchWithLatestMessage(query, userId, limit = 50) {
    return new Promise((resolve, reject) => {
      // 如果查询是数字，按ID搜索；否则按名称搜索
      let sql, params;
      if (!isNaN(query)) {
        // 按ID搜索（仅非私有话题或用户已加入的私有话题）
        sql = `SELECT t.*, u.id as creatorId, u.username as creatorName
               FROM topics t
               LEFT JOIN users u ON t.created_by = u.id
               LEFT JOIN topic_members tm ON t.id = tm.topic_id AND tm.user_id = ?
               WHERE t.id = ? AND t.is_active = 1 AND (t.is_private = 0 OR tm.user_id IS NOT NULL)
               LIMIT ?`;
        params = [userId, parseInt(query), limit];
      } else {
        // 按名称搜索（仅非私有话题或用户已加入的私有话题）
        sql = `SELECT t.*, u.id as creatorId, u.username as creatorName
               FROM topics t
               LEFT JOIN users u ON t.created_by = u.id
               LEFT JOIN topic_members tm ON t.id = tm.topic_id AND tm.user_id = ?
               WHERE t.name LIKE ? AND t.is_active = 1 AND (t.is_private = 0 OR tm.user_id IS NOT NULL)
               ORDER BY t.last_activity DESC, t.created_at DESC
               LIMIT ?`;
        params = [userId, `%${query}%`, limit];
      }
      
      db.all(sql, params, async (err, rows) => {
        if (err) return reject(err);
        
        // 为每个话题获取最新消息
        const topicsWithLatestMessage = await Promise.all(rows.map(async (topic) => {
          const latestMessage = await require('./Message').getLatestMessageByTopic(topic.id);
          return {
            ...topic,
            latestMessage: latestMessage ? {
              content: `${latestMessage.senderName}：${latestMessage.content}`,
              createdAt: latestMessage.created_at
            } : null
          };
        }));
        
        resolve(topicsWithLatestMessage);
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
        `SELECT t.*, u.id as creatorId, u.username as creatorName
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

  // 获取话题公告
  static getAnnouncement(topicId) {
    return new Promise((resolve, reject) => {
      db.get(
        `SELECT announcement FROM topics WHERE id = ? AND is_active = 1`,
        [topicId],
        (err, row) => {
          if (err) return reject(err);
          resolve(row ? row.announcement : null);
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

  // 检查用户在话题中的角色
  static getUserRole(topicId, userId) {
    return new Promise((resolve, reject) => {
      db.get(
        `SELECT role FROM topic_members WHERE topic_id = ? AND user_id = ?`,
        [topicId, userId],
        (err, row) => {
          if (err) return reject(err);
          resolve(row ? row.role : null);
        }
      );
    });
  }

  // 检查用户是否是话题创建者或管理者
  static isCreatorOrAdmin(topicId, userId) {
    return new Promise((resolve, reject) => {
      db.get(
        `SELECT 1 FROM topic_members WHERE topic_id = ? AND user_id = ? AND (role = 'creator' OR role = 'admin')`,
        [topicId, userId],
        (err, row) => {
          if (err) return reject(err);
          resolve(!!row);
        }
      );
    });
  }

  // 检查用户是否是话题创建者
  static isCreator(topicId, userId) {
    return new Promise((resolve, reject) => {
      db.get(
        `SELECT 1 FROM topic_members WHERE topic_id = ? AND user_id = ? AND role = 'creator'`,
        [topicId, userId],
        (err, row) => {
          if (err) return reject(err);
          resolve(!!row);
        }
      );
    });
  }

  // 检查用户是否是话题管理员
  static isAdmin(topicId, userId) {
    return new Promise((resolve, reject) => {
      db.get(
        `SELECT 1 FROM topic_members WHERE topic_id = ? AND user_id = ? AND role = 'admin'`,
        [topicId, userId],
        (err, row) => {
          if (err) return reject(err);
          resolve(!!row);
        }
      );
    });
  }

  // 获取话题成员列表（包含角色信息和禁言状态）
  static getMembers(topicId, limit = 50) {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT u.id, u.username, u.registration_order, tm.joined_at, tm.role, 
               CASE WHEN tmu.user_id IS NOT NULL THEN 1 ELSE 0 END AS is_muted
         FROM topic_members tm
         JOIN users u ON tm.user_id = u.id
         LEFT JOIN topic_muted_users tmu ON tm.topic_id = tmu.topic_id AND tm.user_id = tmu.user_id
         WHERE tm.topic_id = ?
         ORDER BY 
           CASE tm.role
             WHEN 'creator' THEN 1
             WHEN 'admin' THEN 2
             ELSE 3
           END,
           tm.joined_at ASC
         LIMIT ?`,
        [topicId, limit],
        (err, rows) => {
          if (err) return reject(err);
          // 格式化时间
          const formattedRows = rows.map(row => ({
            ...row,
            joined_at: formatLocalTime(row.joined_at),
            isMuted: !!row.is_muted
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
      // 使用本地时间
      const currentTime = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false });
      
      db.run(
        "INSERT OR IGNORE INTO topic_members (topic_id, user_id, role, joined_at) VALUES (?, ?, 'member', ?)",
        [topicId, userId, currentTime],
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
      // 不能退出自己创建的话题
      db.get(
        "SELECT 1 FROM topic_members WHERE topic_id = ? AND user_id = ? AND role = 'creator'",
        [topicId, userId],
        (err, row) => {
          if (err) return reject(err);
          
          if (row) {
            return reject(new Error('话题创建者不能退出自己创建的话题'));
          }
          
          db.run(
            "DELETE FROM topic_members WHERE topic_id = ? AND user_id = ?",
            [topicId, userId],
            function(err) {
              if (err) return reject(err);
              resolve({ changes: this.changes });
            }
          );
        }
      );
    });
  }

  // 设置话题管理员
  static setAdmin(topicId, userId, adminId) {
    return new Promise((resolve, reject) => {
      // 只有创建者可以设置管理员
      db.get(
        "SELECT 1 FROM topic_members WHERE topic_id = ? AND user_id = ? AND role = 'creator'",
        [topicId, userId],
        (err, row) => {
          if (err) return reject(err);
          
          if (!row) {
            return reject(new Error('只有话题创建者可以设置管理员'));
          }
          
          // 不能将创建者设为管理员（创建者始终是创建者）
          db.get(
            "SELECT 1 FROM topic_members WHERE topic_id = ? AND user_id = ? AND role = 'creator'",
            [topicId, adminId],
            (err, row) => {
              if (err) return reject(err);
              
              if (row) {
                return reject(new Error('不能修改创建者的角色'));
              }
              
              db.run(
                "UPDATE topic_members SET role = 'admin' WHERE topic_id = ? AND user_id = ?",
                [topicId, adminId],
                function(err) {
                  if (err) return reject(err);
                  resolve({ changes: this.changes });
                }
              );
            }
          );
        }
      );
    });
  }

  // 取消话题管理员
  static removeAdmin(topicId, userId, adminId) {
    return new Promise((resolve, reject) => {
      // 只有创建者可以取消管理员
      db.get(
        "SELECT 1 FROM topic_members WHERE topic_id = ? AND user_id = ? AND role = 'creator'",
        [topicId, userId],
        (err, row) => {
          if (err) return reject(err);
          
          if (!row) {
            return reject(new Error('只有话题创建者可以取消管理员'));
          }
          
          // 不能修改创建者的角色
          db.get(
            "SELECT 1 FROM topic_members WHERE topic_id = ? AND user_id = ? AND role = 'creator'",
            [topicId, adminId],
            (err, row) => {
              if (err) return reject(err);
              
              if (row) {
                return reject(new Error('不能修改创建者的角色'));
              }
              
              db.run(
                "UPDATE topic_members SET role = 'member' WHERE topic_id = ? AND user_id = ?",
                [topicId, adminId],
                function(err) {
                  if (err) return reject(err);
                  resolve({ changes: this.changes });
                }
              );
            }
          );
        }
      );
    });
  }

  // 修改话题信息
  static updateTopic(topicId, userId, updates) {
    return new Promise((resolve, reject) => {
      const { name, description, announcement } = updates;
      
      // 只有创建者和管理员可以修改话题信息
      db.get(
        "SELECT 1 FROM topic_members WHERE topic_id = ? AND user_id = ? AND (role = 'creator' OR role = 'admin')",
        [topicId, userId],
        (err, row) => {
          if (err) return reject(err);
          
          if (!row) {
            return reject(new Error('只有话题创建者和管理员可以修改话题信息'));
          }
          
          let sql = "UPDATE topics SET ";
          let params = [];
          let updatesArr = [];
          
          if (name !== undefined) {
            updatesArr.push("name = ?");
            params.push(name);
          }
          
          if (description !== undefined) {
            updatesArr.push("description = ?");
            params.push(description);
          }
          
          if (announcement !== undefined) {
            updatesArr.push("announcement = ?");
            params.push(announcement);
          }
          
          if (updatesArr.length === 0) {
            return resolve({ changes: 0 });
          }
          
          sql += updatesArr.join(", ");
          sql += " WHERE id = ?";
          params.push(topicId);
          
          db.run(sql, params, function(err) {
            if (err) return reject(err);
            resolve({ changes: this.changes });
          });
        }
      );
    });
  }

  // 修改话题私有状态
  static updatePrivateStatus(topicId, userId, isPrivate) {
    return new Promise((resolve, reject) => {
      // 只有创建者可以修改话题的私有状态
      db.get(
        "SELECT 1 FROM topic_members WHERE topic_id = ? AND user_id = ? AND role = 'creator'",
        [topicId, userId],
        (err, row) => {
          if (err) return reject(err);
          
          if (!row) {
            return reject(new Error('只有话题创建者可以修改话题的私有状态'));
          }
          
          db.run(
            "UPDATE topics SET is_private = ? WHERE id = ?",
            [isPrivate ? 1 : 0, topicId],
            function(err) {
              if (err) return reject(err);
              resolve({ changes: this.changes });
            }
          );
        }
      );
    });
  }

  // 设置话题公告（仅创建者和管理员可以设置）
  static setAnnouncement(topicId, userId, announcement) {
    return new Promise((resolve, reject) => {
      // 只有创建者和管理员可以设置公告
      db.get(
        "SELECT 1 FROM topic_members WHERE topic_id = ? AND user_id = ? AND (role = 'creator' OR role = 'admin')",
        [topicId, userId],
        (err, row) => {
          if (err) return reject(err);
          
          if (!row) {
            return reject(new Error('只有话题创建者和管理员可以设置公告'));
          }
          
          db.run(
            "UPDATE topics SET announcement = ? WHERE id = ?",
            [announcement, topicId],
            function(err) {
              if (err) return reject(err);
              resolve({ changes: this.changes });
            }
          );
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

  // 移除话题成员
  static removeMember(topicId, removerId, memberId) {
    return new Promise((resolve, reject) => {
      // 检查操作者是否是话题创建者或管理员
      db.get(
        "SELECT role FROM topic_members WHERE topic_id = ? AND user_id = ?",
        [topicId, removerId],
        (err, removerRow) => {
          if (err) return reject(err);
          
          if (!removerRow) {
            return reject(new Error('您不是该话题的成员'));
          }
          
          // 只有创建者和管理员可以移除成员
          if (removerRow.role !== 'creator' && removerRow.role !== 'admin') {
            return reject(new Error('只有话题创建者和管理员可以移除成员'));
          }
          
          // 检查被移除者的信息
          db.get(
            "SELECT role FROM topic_members WHERE topic_id = ? AND user_id = ?",
            [topicId, memberId],
            (err, memberRow) => {
              if (err) return reject(err);
              
              if (!memberRow) {
                return reject(new Error('该用户不是话题成员'));
              }
              
              // 管理员不能移除创建者或其它管理员
              if (removerRow.role === 'admin' && (memberRow.role === 'creator' || memberRow.role === 'admin')) {
                return reject(new Error('管理员不能移除创建者或其他管理员'));
              }
              
              // 不能移除自己
              if (removerId === memberId) {
                return reject(new Error('不能移除自己'));
              }
              
              // 执行移除操作
              db.run(
                "DELETE FROM topic_members WHERE topic_id = ? AND user_id = ?",
                [topicId, memberId],
                function(err) {
                  if (err) return reject(err);
                  resolve({ changes: this.changes });
                }
              );
            }
          );
        }
      );
    });
  }

  // 禁言用户
  static muteUser(topicId, muterId, userId, reason = null) {
    return new Promise((resolve, reject) => {
      // 检查操作者是否是话题创建者或管理员
      db.get(
        "SELECT role FROM topic_members WHERE topic_id = ? AND user_id = ?",
        [topicId, muterId],
        (err, muterRow) => {
          if (err) return reject(err);
          
          if (!muterRow) {
            return reject(new Error('您不是该话题的成员'));
          }
          
          // 只有创建者和管理员可以禁言用户
          if (muterRow.role !== 'creator' && muterRow.role !== 'admin') {
            return reject(new Error('只有话题创建者和管理员可以禁言用户'));
          }
          
          // 检查被禁言者的信息
          db.get(
            "SELECT role FROM topic_members WHERE topic_id = ? AND user_id = ?",
            [topicId, userId],
            (err, userRow) => {
              if (err) return reject(err);
              
              if (!userRow) {
                return reject(new Error('该用户不是话题成员'));
              }
              
              // 管理员不能禁言创建者或其它管理员
              if (muterRow.role === 'admin' && (userRow.role === 'creator' || userRow.role === 'admin')) {
                return reject(new Error('管理员不能禁言创建者或其他管理员'));
              }
              
              // 不能禁言自己
              if (muterId === userId) {
                return reject(new Error('不能禁言自己'));
              }
              
              // 执行禁言操作
              const currentTime = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false });
              db.run(
                "INSERT OR REPLACE INTO topic_muted_users (topic_id, user_id, muted_by, reason, created_at) VALUES (?, ?, ?, ?, ?)",
                [topicId, userId, muterId, reason, currentTime],
                function(err) {
                  if (err) return reject(err);
                  resolve({ changes: this.changes });
                }
              );
            }
          );
        }
      );
    });
  }

  // 解除禁言
  static unmuteUser(topicId, unmuterId, userId) {
    return new Promise((resolve, reject) => {
      // 检查操作者是否是话题创建者或管理员
      db.get(
        "SELECT role FROM topic_members WHERE topic_id = ? AND user_id = ?",
        [topicId, unmuterId],
        (err, unmuterRow) => {
          if (err) return reject(err);
          
          if (!unmuterRow) {
            return reject(new Error('您不是该话题的成员'));
          }
          
          // 只有创建者和管理员可以解除禁言
          if (unmuterRow.role !== 'creator' && unmuterRow.role !== 'admin') {
            return reject(new Error('只有话题创建者和管理员可以解除禁言'));
          }
          
          // 管理员只能解除普通成员的禁言，不能解除创建者或其它管理员的禁言
          if (unmuterRow.role === 'admin') {
            db.get(
              "SELECT role FROM topic_members WHERE topic_id = ? AND user_id = ?",
              [topicId, userId],
              (err, userRow) => {
                if (err) return reject(err);
                
                if (!userRow) {
                  return reject(new Error('该用户不是话题成员'));
                }
                
                if (userRow.role === 'creator' || userRow.role === 'admin') {
                  return reject(new Error('管理员只能解除普通成员的禁言'));
                }
                
                // 执行解除禁言操作
                db.run(
                  "DELETE FROM topic_muted_users WHERE topic_id = ? AND user_id = ?",
                  [topicId, userId],
                  function(err) {
                    if (err) return reject(err);
                    resolve({ changes: this.changes });
                  }
                );
              }
            );
          } else {
            // 创建者可以解除任何人的禁言
            db.run(
              "DELETE FROM topic_muted_users WHERE topic_id = ? AND user_id = ?",
              [topicId, userId],
              function(err) {
                if (err) return reject(err);
                resolve({ changes: this.changes });
              }
            );
          }
        }
      );
    });
  }

  // 检查用户是否被禁言
  static isUserMuted(topicId, userId) {
    return new Promise((resolve, reject) => {
      db.get(
        "SELECT 1 FROM topic_muted_users WHERE topic_id = ? AND user_id = ?",
        [topicId, userId],
        (err, row) => {
          if (err) return reject(err);
          resolve(!!row);
        }
      );
    });
  }

  // 获取用户的禁言信息
  static getUserMuteInfo(topicId, userId) {
    return new Promise((resolve, reject) => {
      db.get(
        `SELECT tm.*, u.username as mutedByUsername
         FROM topic_muted_users tm
         JOIN users u ON tm.muted_by = u.id
         WHERE tm.topic_id = ? AND tm.user_id = ?`,
        [topicId, userId],
        (err, row) => {
          if (err) return reject(err);
          if (row) {
            row.created_at = formatLocalTime(row.created_at);
          }
          resolve(row);
        }
      );
    });
  }
}

module.exports = Topic;