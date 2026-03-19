const db = require('../config/database');
const time = require('../utils/time');
const formatLocalTime = (...args) => time.formatLocalTime(...args);


class Moment {
  // 创建动态
  static create(userId, content, type = 'public', visibility = 'public') {
    return new Promise((resolve, reject) => {
      const currentTime = time.currentDbString();

      db.run(
        `INSERT INTO moments (user_id, content, type, visibility, created_at) 
         VALUES (?, ?, ?, ?, ?) RETURNING id`,
        [userId, content, type, visibility, currentTime],
        function (err) {
          if (err) return reject(err);
          resolve({
            id: this.lastID,
            userId,
            content,
            type,
            visibility,
            createdAt: currentTime
          });
        }
      );
    });
  }

  // 根据ID获取动态
  static findById(momentId) {
    return new Promise((resolve, reject) => {
      db.get(
        `SELECT m.*, u.username, u.avatar_url as "userAvatar", u.registration_order 
         FROM moments m 
         JOIN users u ON m.user_id = u.id 
         WHERE m.id = ?`,
        [momentId],
        (err, row) => {
          if (err) return reject(err);
          if (row) {
            row.createdAt = formatLocalTime(row.created_at);
            delete row.created_at;
          }
          resolve(row);
        }
      );
    });
  }

  // 获取公共动态（无需鉴权）
  static getPublicMoments(page = 1, limit = 10) {
    return new Promise((resolve, reject) => {
      const offset = (page - 1) * limit;

      db.all(
        `SELECT m.*, u.username, u.avatar_url as "userAvatar", u.registration_order 
         FROM moments m 
         JOIN users u ON m.user_id = u.id 
         WHERE m.visibility = 'public' 
         ORDER BY m.created_at DESC 
         LIMIT ? OFFSET ?`,
        [limit, offset],
        (err, rows) => {
          if (err) return reject(err);

          const formattedRows = rows.map(row => ({
            ...row,
            createdAt: formatLocalTime(row.created_at),
            deletedAt: row.deleted_at ? formatLocalTime(row.deleted_at) : null
          }));

          resolve(formattedRows);
        }
      );
    });
  }

  // 获取特定用户的动态
  static getUserMoments(userId, page = 1, limit = 10) {
    return new Promise((resolve, reject) => {
      const offset = (page - 1) * limit;

      db.all(
        `SELECT m.*, u.username, u.avatar_url as "userAvatar", u.registration_order 
         FROM moments m 
         JOIN users u ON m.user_id = u.id 
         WHERE m.user_id = ? 
         ORDER BY m.created_at DESC 
         LIMIT ? OFFSET ?`,
        [userId, limit, offset],
        (err, rows) => {
          if (err) return reject(err);

          const formattedRows = rows.map(row => ({
            ...row,
            createdAt: formatLocalTime(row.created_at),
            deletedAt: row.deleted_at ? formatLocalTime(row.deleted_at) : null
          }));

          resolve(formattedRows);
        }
      );
    });
  }

  // 获取好友动态（需要鉴权）
  static getFriendMoments(userId, page = 1, limit = 10) {
    return new Promise((resolve, reject) => {
      const offset = (page - 1) * limit;

      db.all(
        `SELECT m.*, u.username, u.avatar_url as "userAvatar", u.registration_order 
         FROM moments m 
         JOIN users u ON m.user_id = u.id 
         WHERE m.user_id = ? OR m.user_id IN (
           SELECT CASE 
             WHEN f.user1_id = ? THEN f.user2_id 
             ELSE f.user1_id 
           END
           FROM friends f 
           WHERE (f.user1_id = ? OR f.user2_id = ?) 
           AND f.status = 'accepted'
         )
         AND m.visibility IN ('public', 'friends')
         ORDER BY m.created_at DESC 
         LIMIT ? OFFSET ?`,
        [userId, userId, userId, userId, limit, offset],
        (err, rows) => {
          if (err) return reject(err);

          const formattedRows = rows.map(row => ({
            ...row,
            createdAt: formatLocalTime(row.created_at),
            deletedAt: row.deleted_at ? formatLocalTime(row.deleted_at) : null
          }));

          resolve(formattedRows);
        }
      );
    });
  }

  // 获取关注用户的公共动态
  static getFollowingPublicMoments(userId, page = 1, limit = 10) {
    return new Promise((resolve, reject) => {
      const offset = (page - 1) * limit;

      db.all(
        `SELECT m.*, u.username, u.avatar_url as "userAvatar", u.registration_order 
         FROM moments m 
         JOIN users u ON m.user_id = u.id 
         WHERE m.user_id IN (
           SELECT following_id 
           FROM follows 
           WHERE follower_id = ? AND status = 'active'
         )
         AND m.visibility = 'public'
         ORDER BY m.created_at DESC 
         LIMIT ? OFFSET ?`,
        [userId, limit, offset],
        (err, rows) => {
          if (err) return reject(err);

          const formattedRows = rows.map(row => ({
            ...row,
            createdAt: formatLocalTime(row.created_at),
            deletedAt: row.deleted_at ? formatLocalTime(row.deleted_at) : null
          }));

          resolve(formattedRows);
        }
      );
    });
  }

  // 更新动态
  static update(momentId, userId, updateData) {
    return new Promise((resolve, reject) => {
      const { content, type, visibility } = updateData;
      const currentTime = time.currentDbString();

      let setClause = [];
      let params = [];

      if (content !== undefined) {
        setClause.push('content = ?');
        params.push(content);
      }

      if (type !== undefined) {
        setClause.push('type = ?');
        params.push(type);
      }

      if (visibility !== undefined) {
        setClause.push('visibility = ?');
        params.push(visibility);
      }

      if (setClause.length === 0) {
        return resolve({ changes: 0 });
      }

      setClause.push('updated_at = ?');
      params.push(currentTime);
      params.push(momentId);
      params.push(userId); // for WHERE condition

      db.run(
        `UPDATE moments SET ${setClause.join(', ')} WHERE id = ? AND user_id = ?`,
        params,
        function (err) {
          if (err) return reject(err);
          resolve({ changes: this.changes });
        }
      );
    });
  }

  // 删除动态
  static delete(momentId, userId) {
    return new Promise((resolve, reject) => {
      db.run(
        `DELETE FROM moments WHERE id = ? AND user_id = ?`,
        [momentId, userId],
        function (err) {
          if (err) return reject(err);
          resolve({ changes: this.changes });
        }
      );
    });
  }

  // 软删除动态（如果需要软删除功能）
  static softDelete(momentId, userId) {
    return new Promise((resolve, reject) => {
      const currentTime = time.currentDbString();

      db.run(
        `UPDATE moments SET deleted_at = ?, updated_at = ? WHERE id = ? AND user_id = ?`,
        [currentTime, currentTime, momentId, userId],
        function (err) {
          if (err) return reject(err);
          resolve({ changes: this.changes });
        }
      );
    });
  }
}

module.exports = Moment;