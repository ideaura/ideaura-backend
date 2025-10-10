const db = require('../config/database');
const { formatLocalTime } = require('../utils/timezone');

class Topic {
  static create(topicData) {
    return new Promise((resolve, reject) => {
      // 所有话题默认为私有
      const { name, description, created_by } = topicData;
      const is_private = 1; // 强制设置为私有
      
      db.run(
        "INSERT INTO topics (name, description, created_by, is_private, last_activity) VALUES (?, ?, ?, ?, datetime('now', 'localtime'))",
        [name, description, created_by, is_private],
        function(err) {
          if (err) return reject(err);
          
          const topicId = this.lastID;
          
          // 自动将创建者加入话题并设为创建者角色
          db.run(
            "INSERT INTO topic_members (topic_id, user_id, role) VALUES (?, ?, 'creator')",
            [topicId, created_by],
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

  // 获取推荐话题 - 消息数较多的话题
  static getPopularTopics(limit = 10) {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT t.*, u.username as creatorName, COUNT(m.id) as message_count
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

  // 获取推荐话题 - 近期活跃的话题（7天内有人发消息）
  static getRecentActiveTopics(limit = 10) {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT t.*, u.username as creatorName
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

  // 获取推荐话题 - 新创建的话题
  static getNewTopics(limit = 10) {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT t.*, u.username as creatorName
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

  // 获取所有话题（仅用户加入的）
  static findAll(userId, limit = 50) {
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

  // 搜索话题（按名称或ID，显示所有话题供用户加入）
  static search(query, userId, limit = 50) {
    return new Promise((resolve, reject) => {
      // 如果查询是数字，按ID搜索；否则按名称搜索
      let sql, params;
      if (!isNaN(query)) {
        // 按ID搜索（所有话题）
        sql = `SELECT t.*, u.username as creatorName
               FROM topics t
               LEFT JOIN users u ON t.created_by = u.id
               WHERE t.id = ? AND t.is_active = 1
               LIMIT ?`;
        params = [parseInt(query), limit];
      } else {
        // 按名称搜索（所有话题）
        sql = `SELECT t.*, u.username as creatorName
               FROM topics t
               LEFT JOIN users u ON t.created_by = u.id
               WHERE t.name LIKE ? AND t.is_active = 1
               ORDER BY t.last_activity DESC, t.created_at DESC
               LIMIT ?`;
        params = [`%${query}%`, limit];
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

  // 获取话题成员列表（包含角色信息）
  static getMembers(topicId, limit = 50) {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT u.id, u.username, u.registration_order, tm.joined_at, tm.role
         FROM topic_members tm
         JOIN users u ON tm.user_id = u.id
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
        "INSERT OR IGNORE INTO topic_members (topic_id, user_id, role) VALUES (?, ?, 'member')",
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

  // 修改话题名称和介绍
  static updateTopic(topicId, userId, updates) {
    return new Promise((resolve, reject) => {
      const { name, description } = updates;
      
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