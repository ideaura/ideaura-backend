const db = require('../config/database');
const time = require('../utils/time');
const formatLocalTime = (...args) => time.formatLocalTime(...args);


class Comment {
  // 创建评论（支持动态和帖子）
  // 数据库 schema: target_type ('moment'|'post'), target_id, parent_id
  static create(userId, content, momentId = null, postId = null, parentId = null) {
    return new Promise((resolve, reject) => {
      const currentTime = time.currentDbString();

      if ((momentId === null && postId === null) || (momentId !== null && postId !== null)) {
        return reject(new Error('必须指定动态ID或帖子ID之一，不能同时指定或都不指定'));
      }

      const target_type = momentId !== null ? 'moment' : 'post';
      const target_id   = momentId !== null ? momentId : postId;

      db.run(
        `INSERT INTO comments (user_id, target_type, target_id, content, parent_id, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 'active', ?, ?) RETURNING id`,
        [userId, target_type, target_id, content, parentId || null, currentTime, currentTime],
        function (err) {
          if (err) return reject(err);
          resolve({
            id: this.lastID,
            userId,
            momentId,
            postId,
            content,
            parentId,
            createdAt: currentTime
          });
        }
      );
    });
  }

  // 获取动态的所有顶层评论（不含回复）
  static getByMomentId(momentId, page = 1, limit = 10) {
    return new Promise((resolve, reject) => {
      const offset = (page - 1) * limit;

      db.all(
        `SELECT c.*, u.username, u.avatar_url as "userAvatar", u.registration_order
         FROM comments c
         JOIN users u ON c.user_id = u.id
         WHERE c.target_type = 'moment' AND c.target_id = ?
           AND c.parent_id IS NULL AND c.status = 'active'
         ORDER BY c.created_at DESC
         LIMIT ? OFFSET ?`,
        [momentId, limit, offset],
        (err, rows) => {
          if (err) return reject(err);
          const formattedRows = rows.map(row => ({
            ...row,
            createdAt: formatLocalTime(row.created_at)
          }));
          resolve(formattedRows);
        }
      );
    });
  }

  // 获取帖子的所有顶层评论（不含回复）
  static getByPostId(postId, page = 1, limit = 10) {
    return new Promise((resolve, reject) => {
      const offset = (page - 1) * limit;

      db.all(
        `SELECT c.*, u.username, u.avatar_url as "userAvatar", u.registration_order
         FROM comments c
         JOIN users u ON c.user_id = u.id
         WHERE c.target_type = 'post' AND c.target_id = ?
           AND c.parent_id IS NULL AND c.status = 'active'
         ORDER BY c.created_at DESC
         LIMIT ? OFFSET ?`,
        [postId, limit, offset],
        (err, rows) => {
          if (err) return reject(err);
          const formattedRows = rows.map(row => ({
            ...row,
            createdAt: formatLocalTime(row.created_at)
          }));
          resolve(formattedRows);
        }
      );
    });
  }

  // 获取评论的回复
  static getRepliesByCommentId(commentId, page = 1, limit = 10) {
    return new Promise((resolve, reject) => {
      const offset = (page - 1) * limit;

      db.all(
        `SELECT c.*, u.username, u.avatar_url as "userAvatar", u.registration_order
         FROM comments c
         JOIN users u ON c.user_id = u.id
         WHERE c.parent_id = ? AND c.status = 'active'
         ORDER BY c.created_at ASC
         LIMIT ? OFFSET ?`,
        [commentId, limit, offset],
        (err, rows) => {
          if (err) return reject(err);
          const formattedRows = rows.map(row => ({
            ...row,
            createdAt: formatLocalTime(row.created_at)
          }));
          resolve(formattedRows);
        }
      );
    });
  }

  // 获取单个评论
  static findById(commentId) {
    return new Promise((resolve, reject) => {
      db.get(
        `SELECT c.*, u.username, u.avatar_url as "userAvatar", u.registration_order
         FROM comments c
         JOIN users u ON c.user_id = u.id
         WHERE c.id = ?`,
        [commentId],
        (err, row) => {
          if (err) return reject(err);
          if (row) {
            row.createdAt = formatLocalTime(row.created_at);
            // Normalise to legacy momentId/postId fields so routes still work
            row.momentId = row.target_type === 'moment' ? row.target_id : null;
            row.postId   = row.target_type === 'post'   ? row.target_id : null;
          }
          resolve(row);
        }
      );
    });
  }

  // 更新评论
  static update(commentId, userId, content) {
    return new Promise((resolve, reject) => {
      const currentTime = time.currentDbString();

      db.run(
        `UPDATE comments SET content = ?, updated_at = ? WHERE id = ? AND user_id = ?`,
        [content, currentTime, commentId, userId],
        function (err) {
          if (err) return reject(err);
          resolve({ changes: this.changes });
        }
      );
    });
  }

  // 删除评论（软删除）
  static delete(commentId, userId) {
    return new Promise((resolve, reject) => {
      const currentTime = time.currentDbString();

      db.run(
        `UPDATE comments SET status = 'deleted', deleted_at = ?, updated_at = ? WHERE id = ? AND user_id = ?`,
        [currentTime, currentTime, commentId, userId],
        function (err) {
          if (err) return reject(err);
          resolve({ changes: this.changes });
        }
      );
    });
  }

  // 完全删除评论及其所有回复（软删除）
  static hardDelete(commentId, userId) {
    return new Promise((resolve, reject) => {
      const currentTime = time.currentDbString();

      // 先软删除所有子回复
      db.run(
        `UPDATE comments SET status = 'deleted', deleted_at = ?, updated_at = ?
         WHERE parent_id = ?`,
        [currentTime, currentTime, commentId],
        function (err) {
          if (err) return reject(err);

          // 再软删除主评论
          db.run(
            `UPDATE comments SET status = 'deleted', deleted_at = ?, updated_at = ?
             WHERE id = ? AND user_id = ?`,
            [currentTime, currentTime, commentId, userId],
            function (err) {
              if (err) return reject(err);
              resolve({ changes: this.changes });
            }
          );
        }
      );
    });
  }

  // 检查评论是否属于某个帖子
  static belongsToPost(commentId, postId) {
    return new Promise((resolve, reject) => {
      db.get(
        `SELECT 1 FROM comments WHERE id = ? AND target_type = 'post' AND target_id = ? AND status = 'active'`,
        [commentId, postId],
        (err, row) => {
          if (err) return reject(err);
          resolve(!!row);
        }
      );
    });
  }

  // 检查评论是否属于某个动态
  static belongsToMoment(commentId, momentId) {
    return new Promise((resolve, reject) => {
      db.get(
        `SELECT 1 FROM comments WHERE id = ? AND target_type = 'moment' AND target_id = ? AND status = 'active'`,
        [commentId, momentId],
        (err, row) => {
          if (err) return reject(err);
          resolve(!!row);
        }
      );
    });
  }

  // 获取帖子的评论总数（仅顶层）
  static getPostCommentCount(postId) {
    return new Promise((resolve, reject) => {
      db.get(
        `SELECT COUNT(*) as count FROM comments
         WHERE target_type = 'post' AND target_id = ?
           AND parent_id IS NULL AND status = 'active'`,
        [postId],
        (err, row) => {
          if (err) return reject(err);
          resolve(row ? row.count : 0);
        }
      );
    });
  }
}

module.exports = Comment;