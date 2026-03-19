const db = require('../config/database');
const time = require('../utils/time');
const formatLocalTime = (...args) => time.formatLocalTime(...args);


class Community {
  // 创建社区
  static create(communityData) {
    return new Promise((resolve, reject) => {
      const { topic_id, name, description, tags, avatar_url, cover_image_url, created_by, type, join_policy } = communityData;

      const currentTime = time.currentDbString();

      db.run(
        `INSERT INTO communities (topic_id, name, description, tags, avatar_url, cover_image_url, created_by, type, join_policy, created_at, updated_at) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
        [topic_id, name, description, tags, avatar_url, cover_image_url, created_by, type, join_policy, currentTime, currentTime],
        function (err) {
          if (err) return reject(err);
          resolve(this.lastID);
        }
      );
    });
  }

  // 获取社区信息
  static findById(id) {
    return new Promise((resolve, reject) => {
      db.get(
        `SELECT c.*, u.username as creator_name
         FROM communities c
         LEFT JOIN users u ON c.created_by = u.id
         WHERE c.id = ? AND c.is_active = true`,
        [id],
        (err, row) => {
          if (err) return reject(err);
          if (row) {
            row.created_at = formatLocalTime(row.created_at);
            row.updated_at = formatLocalTime(row.updated_at);
          }
          resolve(row);
        }
      );
    });
  }

  // 根据绑定的主题ID查找社区
  static findByTopicId(topicId) {
    return new Promise((resolve, reject) => {
      db.get(
        `SELECT c.*, u.username as creator_name
         FROM communities c
         LEFT JOIN users u ON c.created_by = u.id
         WHERE c.topic_id = ? AND c.is_active = true`,
        [topicId],
        (err, row) => {
          if (err) return reject(err);
          if (row) {
            row.created_at = formatLocalTime(row.created_at);
            row.updated_at = formatLocalTime(row.updated_at);
          }
          resolve(row);
        }
      );
    });
  }

  // 批量根据绑定的主题 ID 查找社区（用于消除 N+1）
  static findBatchByTopicIds(topicIds) {
    if (!topicIds || topicIds.length === 0) return Promise.resolve({});
    return new Promise((resolve, reject) => {
      const placeholders = topicIds.map(() => '?').join(',');
      db.all(
        `SELECT c.*, u.username as creator_name
         FROM communities c
         LEFT JOIN users u ON c.created_by = u.id
         WHERE c.topic_id IN (${placeholders}) AND c.is_active = true`,
        topicIds,
        (err, rows) => {
          if (err) return reject(err);
          const resultMap = {};
          rows.forEach(row => {
            row.created_at = formatLocalTime(row.created_at);
            row.updated_at = formatLocalTime(row.updated_at);
            resultMap[row.topic_id] = row;
          });
          resolve(resultMap);
        }
      );
    });
  }


  // 获取社区列表（所有活跃社区）
  static findAll(limit = 50, offset = 0) {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT c.*, u.username as creator_name
         FROM communities c
         LEFT JOIN users u ON c.created_by = u.id
         WHERE c.is_active = true
         ORDER BY c.created_at DESC
         LIMIT ? OFFSET ?`,
        [limit, offset],
        (err, rows) => {
          if (err) return reject(err);
          rows.forEach(row => {
            row.created_at = formatLocalTime(row.created_at);
            row.updated_at = formatLocalTime(row.updated_at);
          });
          resolve(rows);
        }
      );
    });
  }

  // 获取用户创建的社区
  static findByCreator(userId, limit = 50, offset = 0) {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT c.*, u.username as creator_name
         FROM communities c
         LEFT JOIN users u ON c.created_by = u.id
         WHERE c.created_by = ? AND c.is_active = true
         ORDER BY c.created_at DESC
         LIMIT ? OFFSET ?`,
        [userId, limit, offset],
        (err, rows) => {
          if (err) return reject(err);
          rows.forEach(row => {
            row.created_at = formatLocalTime(row.created_at);
            row.updated_at = formatLocalTime(row.updated_at);
          });
          resolve(rows);
        }
      );
    });
  }

  // 获取用户加入的社区
  static findByMember(userId, limit = 50, offset = 0) {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT c.*, u.username as creator_name, cm.role, cm.status as member_status
         FROM communities c
         LEFT JOIN users u ON c.created_by = u.id
         INNER JOIN community_members cm ON c.id = cm.community_id
         WHERE cm.user_id = ? AND c.is_active = true AND cm.status = 'active'
         ORDER BY c.created_at DESC
         LIMIT ? OFFSET ?`,
        [userId, limit, offset],
        (err, rows) => {
          if (err) return reject(err);
          rows.forEach(row => {
            row.created_at = formatLocalTime(row.created_at);
            row.updated_at = formatLocalTime(row.updated_at);
          });
          resolve(rows);
        }
      );
    });
  }

  // 搜索社区
  static search(query, limit = 50, offset = 0) {
    return new Promise((resolve, reject) => {
      const searchQuery = `%${query}%`;
      db.all(
        `SELECT c.*, u.username as creator_name
         FROM communities c
         LEFT JOIN users u ON c.created_by = u.id
         WHERE (c.name LIKE ? OR c.description LIKE ? OR c.tags LIKE ?) AND c.is_active = true
         ORDER BY c.member_count DESC, c.created_at DESC
         LIMIT ? OFFSET ?`,
        [searchQuery, searchQuery, searchQuery, limit, offset],
        (err, rows) => {
          if (err) return reject(err);
          rows.forEach(row => {
            row.created_at = formatLocalTime(row.created_at);
            row.updated_at = formatLocalTime(row.updated_at);
          });
          resolve(rows);
        }
      );
    });
  }

  // 获取推荐社区（按成员数排序）
  static getRecommended(limit = 10) {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT c.*, u.username as creator_name
         FROM communities c
         LEFT JOIN users u ON c.created_by = u.id
         WHERE c.is_active = true
         ORDER BY c.member_count DESC, c.post_count DESC
         LIMIT ?`,
        [limit],
        (err, rows) => {
          if (err) return reject(err);
          rows.forEach(row => {
            row.created_at = formatLocalTime(row.created_at);
            row.updated_at = formatLocalTime(row.updated_at);
          });
          resolve(rows);
        }
      );
    });
  }

  // 更新社区信息
  static update(id, userId, updates) {
    return new Promise((resolve, reject) => {
      // 首先检查用户是否有权限更新社区（必须是创建者或管理员）
      db.get(
        `SELECT role FROM community_members WHERE community_id = ? AND user_id = ? AND (role = 'owner' OR role = 'admin')`,
        [id, userId],
        (err, memberRow) => {
          if (err) return reject(err);

          if (!memberRow) {
            return reject(new Error('只有社区所有者或管理员可以更新社区信息'));
          }

          const { name, description, tags, avatar_url, cover_image_url, type, join_policy } = updates;
          const currentTime = time.currentDbString();

          let sql = 'UPDATE communities SET updated_at = ?';
          let params = [currentTime];

          if (name !== undefined) {
            sql += ', name = ?';
            params.push(name);
          }
          if (description !== undefined) {
            sql += ', description = ?';
            params.push(description);
          }
          if (tags !== undefined) {
            sql += ', tags = ?';
            params.push(tags);
          }
          if (avatar_url !== undefined) {
            sql += ', avatar_url = ?';
            params.push(avatar_url);
          }
          if (cover_image_url !== undefined) {
            sql += ', cover_image_url = ?';
            params.push(cover_image_url);
          }
          if (type !== undefined) {
            sql += ', type = ?';
            params.push(type);
          }
          if (join_policy !== undefined) {
            sql += ', join_policy = ?';
            params.push(join_policy);
          }

          sql += ' WHERE id = ?';
          params.push(id);

          db.run(sql, params, function (err) {
            if (err) return reject(err);
            resolve({ changes: this.changes });
          });
        }
      );
    });
  }

  // 检查社区是否存在
  static exists(id) {
    return new Promise((resolve, reject) => {
      db.get(
        'SELECT 1 FROM communities WHERE id = ? AND is_active = true',
        [id],
        (err, row) => {
          if (err) return reject(err);
          resolve(!!row);
        }
      );
    });
  }

  // 获取社区成员数量
  static getMemberCount(communityId) {
    return new Promise((resolve, reject) => {
      db.get(
        'SELECT member_count FROM communities WHERE id = ?',
        [communityId],
        (err, row) => {
          if (err) return reject(err);
          resolve(row ? row.member_count : 0);
        }
      );
    });
  }

  // 获取社区帖子数量
  static getPostCount(communityId) {
    return new Promise((resolve, reject) => {
      db.get(
        'SELECT post_count FROM communities WHERE id = ?',
        [communityId],
        (err, row) => {
          if (err) return reject(err);
          resolve(row ? row.post_count : 0);
        }
      );
    });
  }

  // 增加社区成员数量
  static incrementMemberCount(communityId) {
    return new Promise((resolve, reject) => {
      db.run(
        'UPDATE communities SET member_count = member_count + 1 WHERE id = ?',
        [communityId],
        function (err) {
          if (err) return reject(err);
          resolve({ changes: this.changes });
        }
      );
    });
  }

  // 减少社区成员数量
  static decrementMemberCount(communityId) {
    return new Promise((resolve, reject) => {
      db.run(
        'UPDATE communities SET member_count = CASE WHEN member_count > 0 THEN member_count - 1 ELSE 0 END WHERE id = ?',
        [communityId],
        function (err) {
          if (err) return reject(err);
          resolve({ changes: this.changes });
        }
      );
    });
  }

  // 增加社区帖子数量
  static incrementPostCount(communityId) {
    return new Promise((resolve, reject) => {
      db.run(
        'UPDATE communities SET post_count = post_count + 1 WHERE id = ?',
        [communityId],
        function (err) {
          if (err) return reject(err);
          resolve({ changes: this.changes });
        }
      );
    });
  }

  // 获取社区总数
  static getCount() {
    return new Promise((resolve, reject) => {
      db.get(
        'SELECT COUNT(*) as count FROM communities WHERE is_active = true',
        [],
        (err, row) => {
          if (err) return reject(err);
          resolve(row ? row.count : 0);
        }
      );
    });
  }

  // 搜索社区结果计数
  static searchCount(query) {
    return new Promise((resolve, reject) => {
      const searchQuery = `%${query}%`;
      db.get(
        `SELECT COUNT(*) as count FROM communities WHERE (name LIKE ? OR description LIKE ? OR tags LIKE ?) AND is_active = true`,
        [searchQuery, searchQuery, searchQuery],
        (err, row) => {
          if (err) return reject(err);
          resolve(row ? row.count : 0);
        }
      );
    });
  }

  // 根据名称模糊查找或精确校验社区
  static countByName(name) {
    return new Promise((resolve, reject) => {
      db.get(
        'SELECT count(*) as count FROM communities WHERE name = ? AND is_active = true',
        [name],
        (err, row) => {
          if (err) return reject(err);
          resolve(row ? row.count : 0);
        }
      );
    });
  }

  // ==================== 社区成员管理功能 ====================

  // 加入社区
  static join(communityId, userId, joinReason = null) {
    return new Promise((resolve, reject) => {
      const currentTime = time.currentDbString();

      db.run(
        `INSERT INTO community_members (community_id, user_id, join_reason, joined_at) 
         VALUES (?, ?, ?, ?) RETURNING id`,
        [communityId, userId, joinReason, currentTime],
        function (err) {
          if (err) {
            if (err.code === 'SQLITE_CONSTRAINT_UNIQUE' || err.code === '23505') {
              return reject(new Error('您已经是该社区的成员'));
            }
            return reject(err);
          }
          resolve(this.lastID);
        }
      );
    });
  }

  // 退出社区
  static leave(communityId, userId) {
    return new Promise((resolve, reject) => {
      const currentTime = time.currentDbString();

      // 检查用户是否是社区所有者
      db.get(
        `SELECT role FROM community_members WHERE community_id = ? AND user_id = ?`,
        [communityId, userId],
        (err, row) => {
          if (err) return reject(err);

          if (row && row.role === 'owner') {
            return reject(new Error('社区所有者不能退出自己创建的社区'));
          }

          db.run(
            `UPDATE community_members SET status = 'inactive', left_at = ? WHERE community_id = ? AND user_id = ? AND status = 'active'`,
            [currentTime, communityId, userId],
            function (err) {
              if (err) return reject(err);
              resolve({ changes: this.changes });
            }
          );
        }
      );
    });
  }

  // 获取社区成员列表
  static getMembers(communityId, limit = 50, offset = 0) {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT cm.*, u.username, u.email
         FROM community_members cm
         INNER JOIN users u ON cm.user_id = u.id
         WHERE cm.community_id = ? AND cm.status = 'active'
         ORDER BY 
           CASE cm.role
             WHEN 'owner' THEN 1
             WHEN 'admin' THEN 2
             WHEN 'moderator' THEN 3
             ELSE 4
           END,
           cm.joined_at ASC
         LIMIT ? OFFSET ?`,
        [communityId, limit, offset],
        (err, rows) => {
          if (err) return reject(err);
          rows.forEach(row => {
            row.joined_at = formatLocalTime(row.joined_at);
            if (row.left_at) {
              row.left_at = formatLocalTime(row.left_at);
            }
          });
          resolve(rows);
        }
      );
    });
  }

  // 获取用户在某个社区的角色
  static getRole(communityId, userId) {
    return new Promise((resolve, reject) => {
      db.get(
        `SELECT role FROM community_members WHERE community_id = ? AND user_id = ?`,
        [communityId, userId],
        (err, row) => {
          if (err) return reject(err);
          resolve(row ? row.role : null);
        }
      );
    });
  }

  // 检查用户是否是社区成员
  static isMember(communityId, userId) {
    return new Promise((resolve, reject) => {
      db.get(
        `SELECT 1 FROM community_members WHERE community_id = ? AND user_id = ? AND status = 'active'`,
        [communityId, userId],
        (err, row) => {
          if (err) return reject(err);
          resolve(!!row);
        }
      );
    });
  }

  // 检查用户是否是社区所有者
  static isOwner(communityId, userId) {
    return new Promise((resolve, reject) => {
      db.get(
        `SELECT 1 FROM community_members WHERE community_id = ? AND user_id = ? AND role = 'owner'`,
        [communityId, userId],
        (err, row) => {
          if (err) return reject(err);
          resolve(!!row);
        }
      );
    });
  }

  // 检查用户是否是社区管理员
  static isAdmin(communityId, userId) {
    return new Promise((resolve, reject) => {
      db.get(
        `SELECT 1 FROM community_members WHERE community_id = ? AND user_id = ? AND role = 'admin'`,
        [communityId, userId],
        (err, row) => {
          if (err) return reject(err);
          resolve(!!row);
        }
      );
    });
  }

  // 检查用户是否是社区版主
  static isModerator(communityId, userId) {
    return new Promise((resolve, reject) => {
      db.get(
        `SELECT 1 FROM community_members WHERE community_id = ? AND user_id = ? AND role = 'moderator'`,
        [communityId, userId],
        (err, row) => {
          if (err) return reject(err);
          resolve(!!row);
        }
      );
    });
  }

  // 检查用户是否有管理权限
  static hasManagementPermission(communityId, userId) {
    return new Promise((resolve, reject) => {
      db.get(
        `SELECT 1 FROM community_members WHERE community_id = ? AND user_id = ? AND (role = 'owner' OR role = 'admin' OR role = 'moderator')`,
        [communityId, userId],
        (err, row) => {
          if (err) return reject(err);
          resolve(!!row);
        }
      );
    });
  }

  // 设置社区角色（所有者或管理员）
  static setRole(communityId, setterId, targetUserId, newRole) {
    return new Promise((resolve, reject) => {
      // 检查操作者权限
      db.get(
        `SELECT role FROM community_members WHERE community_id = ? AND user_id = ?`,
        [communityId, setterId],
        (err, setterRow) => {
          if (err) return reject(err);

          if (!setterRow) {
            return reject(new Error('操作者不是该社区成员'));
          }

          // 特殊情况：创建者为自己设置owner角色（首次设置角色）
          if (setterId === targetUserId && newRole === 'owner' && (!setterRow.role || setterRow.role === 'member')) {
            // 这是创建者首次设置角色，允许设置为owner
            db.run(
              `UPDATE community_members SET role = ? WHERE community_id = ? AND user_id = ?`,
              [newRole, communityId, targetUserId],
              function (err) {
                if (err) return reject(err);
                resolve({ changes: this.changes });
              }
            );
            return;
          }

          // 检查操作者权限（必须是所有者或管理员）
          if (setterRow.role !== 'owner' && setterRow.role !== 'admin') {
            return reject(new Error('只有社区所有者或管理员可以设置用户角色'));
          }

          // 获取目标用户信息
          db.get(
            `SELECT role FROM community_members WHERE community_id = ? AND user_id = ?`,
            [communityId, targetUserId],
            (err, targetRow) => {
              if (err) return reject(err);

              if (!targetRow) {
                return reject(new Error('目标用户不是该社区成员'));
              }

              // 检查是否试图修改所有者角色
              if (targetRow.role === 'owner') {
                return reject(new Error('不能修改社区所有者的角色'));
              }

              // 检查权限等级
              if (setterRow.role === 'admin' && newRole === 'owner') {
                return reject(new Error('管理员不能将他人设为所有者'));
              }

              db.run(
                `UPDATE community_members SET role = ? WHERE community_id = ? AND user_id = ?`,
                [newRole, communityId, targetUserId],
                function (err) {
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

  // 移除社区成员（踢出社区）
  static removeMember(communityId, removerId, targetUserId) {
    return new Promise((resolve, reject) => {
      // 检查操作者权限
      db.get(
        `SELECT role FROM community_members WHERE community_id = ? AND user_id = ?`,
        [communityId, removerId],
        (err, removerRow) => {
          if (err) return reject(err);

          if (!removerRow) {
            return reject(new Error('操作者不是该社区成员'));
          }

          // 检查操作者权限（必须是所有者或管理员）
          if (removerRow.role !== 'owner' && removerRow.role !== 'admin') {
            return reject(new Error('只有社区所有者或管理员可以移除成员'));
          }

          // 获取目标用户信息
          db.get(
            `SELECT role FROM community_members WHERE community_id = ? AND user_id = ?`,
            [communityId, targetUserId],
            (err, targetRow) => {
              if (err) return reject(err);

              if (!targetRow) {
                return reject(new Error('目标用户不是该社区成员'));
              }

              // 权限检查
              if (removerRow.role === 'admin' && targetRow.role !== 'member') {
                return reject(new Error('管理员不能移除所有者、其他管理员或版主'));
              }

              // 不能移除自己
              if (removerId === targetUserId) {
                return reject(new Error('不能移除自己'));
              }

              const currentTime = time.currentDbString();

              db.run(
                `UPDATE community_members SET status = 'inactive', left_at = ? WHERE community_id = ? AND user_id = ?`,
                [currentTime, communityId, targetUserId],
                function (err) {
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

  // 获取用户加入的社区数量
  static getJoinedCommunityCount(userId) {
    return new Promise((resolve, reject) => {
      db.get(
        `SELECT COUNT(*) as count FROM community_members WHERE user_id = ? AND status = 'active'`,
        [userId],
        (err, row) => {
          if (err) return reject(err);
          resolve(row ? row.count : 0);
        }
      );
    });
  }

  // 获取社区管理员列表（所有者、管理员、版主）
  static getAdmins(communityId) {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT cm.*, u.username, u.email
         FROM community_members cm
         INNER JOIN users u ON cm.user_id = u.id
         WHERE cm.community_id = ? AND cm.role IN ('owner', 'admin', 'moderator') AND cm.status = 'active'
         ORDER BY 
           CASE cm.role
             WHEN 'owner' THEN 1
             WHEN 'admin' THEN 2
             WHEN 'moderator' THEN 3
             ELSE 4
           END,
           cm.joined_at ASC`,
        [communityId],
        (err, rows) => {
          if (err) return reject(err);
          rows.forEach(row => {
            row.joined_at = formatLocalTime(row.joined_at);
            if (row.left_at) {
              row.left_at = formatLocalTime(row.left_at);
            }
          });
          resolve(rows);
        }
      );
    });
  }

  // 获取社区活跃成员数量
  static getActiveMemberCount(communityId) {
    return new Promise((resolve, reject) => {
      db.get(
        `SELECT COUNT(*) as count FROM community_members WHERE community_id = ? AND status = 'active'`,
        [communityId],
        (err, row) => {
          if (err) return reject(err);
          resolve(row ? row.count : 0);
        }
      );
    });
  }
}

module.exports = Community;