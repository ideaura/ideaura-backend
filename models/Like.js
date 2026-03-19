const db = require('../config/database');
const time = require('../utils/time');
const formatLocalTime = (...args) => time.formatLocalTime(...args);


class Like {
  // 点赞（支持动态和帖子）
  // 数据库 schema: target_type ('moment'|'post'), target_id
  // UNIQUE(user_id, target_type, target_id) — 无 status 列，点赞即存在，取消即删除
  static like(userId, momentId = null, postId = null) {
    return new Promise((resolve, reject) => {
      const currentTime = time.currentDbString();

      if ((momentId === null && postId === null) || (momentId !== null && postId !== null)) {
        return reject(new Error('必须指定动态ID或帖子ID之一，不能同时指定或都不指定'));
      }

      const target_type = momentId !== null ? 'moment' : 'post';
      const target_id   = momentId !== null ? momentId  : postId;

      // 检查是否已点赞
      db.get(
        `SELECT id FROM likes WHERE user_id = ? AND target_type = ? AND target_id = ?`,
        [userId, target_type, target_id],
        (err, existing) => {
          if (err) return reject(err);

          if (existing) {
            // 已经点赞 — 直接返回，不重复插入
            return resolve({ id: existing.id, status: 'active', alreadyLiked: true });
          }

          // 创建新点赞记录
          db.run(
            `INSERT INTO likes (user_id, target_type, target_id, created_at)
             VALUES (?, ?, ?, ?) RETURNING id`,
            [userId, target_type, target_id, currentTime],
            function (err) {
              if (err) {
                // 唯一约束冲突 → 已点赞
                if (err.code === '23505') {
                  return resolve({ status: 'active', alreadyLiked: true });
                }
                return reject(err);
              }

              // 如果是给帖子点赞，增加帖子的点赞数
              if (target_type === 'post') {
                db.run(
                  `UPDATE posts SET like_count = like_count + 1 WHERE id = ?`,
                  [target_id],
                  (err) => { if (err) console.error('更新帖子点赞数错误:', err); }
                );
              }

              resolve({ id: this.lastID, status: 'active' });
            }
          );
        }
      );
    });
  }

  // 取消点赞（支持动态和帖子）
  static unlike(userId, momentId = null, postId = null) {
    return new Promise((resolve, reject) => {
      if ((momentId === null && postId === null) || (momentId !== null && postId !== null)) {
        return reject(new Error('必须指定动态ID或帖子ID之一，不能同时指定或都不指定'));
      }

      const target_type = momentId !== null ? 'moment' : 'post';
      const target_id   = momentId !== null ? momentId  : postId;

      db.run(
        `DELETE FROM likes WHERE user_id = ? AND target_type = ? AND target_id = ?`,
        [userId, target_type, target_id],
        function (err) {
          if (err) return reject(err);

          // 如果确实删除了一条，且是帖子，减少帖子点赞数
          if (this.changes > 0 && target_type === 'post') {
            db.run(
              `UPDATE posts SET like_count = CASE WHEN like_count > 0 THEN like_count - 1 ELSE 0 END WHERE id = ?`,
              [target_id],
              (err) => { if (err) console.error('更新帖子点赞数错误:', err); }
            );
          }

          resolve({ changes: this.changes });
        }
      );
    });
  }

  // 检查是否点赞了指定内容（动态或帖子）
  static isLiked(userId, momentId = null, postId = null) {
    return new Promise((resolve, reject) => {
      if ((momentId === null && postId === null) || (momentId !== null && postId !== null)) {
        return reject(new Error('必须指定动态ID或帖子ID之一，不能同时指定或都不指定'));
      }

      const target_type = momentId !== null ? 'moment' : 'post';
      const target_id   = momentId !== null ? momentId  : postId;

      db.get(
        `SELECT id FROM likes WHERE user_id = ? AND target_type = ? AND target_id = ?`,
        [userId, target_type, target_id],
        (err, row) => {
          if (err) return reject(err);
          resolve(!!row);
        }
      );
    });
  }

  // 获取内容的点赞数（动态或帖子）
  static getLikesCount(momentId = null, postId = null) {
    return new Promise((resolve, reject) => {
      if ((momentId === null && postId === null) || (momentId !== null && postId !== null)) {
        return reject(new Error('必须指定动态ID或帖子ID之一，不能同时指定或都不指定'));
      }

      const target_type = momentId !== null ? 'moment' : 'post';
      const target_id   = momentId !== null ? momentId  : postId;

      db.get(
        `SELECT COUNT(*) as count FROM likes WHERE target_type = ? AND target_id = ?`,
        [target_type, target_id],
        (err, row) => {
          if (err) return reject(err);
          resolve(row ? row.count : 0);
        }
      );
    });
  }

  // 获取用户对某个内容的点赞状态（动态或帖子）
  static getUserLikeStatus(userId, momentId = null, postId = null) {
    return new Promise((resolve, reject) => {
      if ((momentId === null && postId === null) || (momentId !== null && postId !== null)) {
        return reject(new Error('必须指定动态ID或帖子ID之一，不能同时指定或都不指定'));
      }

      const target_type = momentId !== null ? 'moment' : 'post';
      const target_id   = momentId !== null ? momentId  : postId;

      db.get(
        `SELECT id FROM likes WHERE user_id = ? AND target_type = ? AND target_id = ?`,
        [userId, target_type, target_id],
        (err, row) => {
          if (err) return reject(err);
          // Return a status-like object so callers expecting {id, status} still work
          resolve(row ? { id: row.id, status: 'active' } : null);
        }
      );
    });
  }

  // 获取内容的点赞用户列表（动态或帖子）
  static getLikesByContentId(momentId = null, postId = null, page = 1, limit = 10) {
    return new Promise((resolve, reject) => {
      if ((momentId === null && postId === null) || (momentId !== null && postId !== null)) {
        return reject(new Error('必须指定动态ID或帖子ID之一，不能同时指定或都不指定'));
      }

      const offset = (page - 1) * limit;
      const target_type = momentId !== null ? 'moment' : 'post';
      const target_id   = momentId !== null ? momentId  : postId;

      db.all(
        `SELECT l.*, u.username, u.registration_order
         FROM likes l
         JOIN users u ON l.user_id = u.id
         WHERE l.target_type = ? AND l.target_id = ?
         ORDER BY l.created_at DESC
         LIMIT ? OFFSET ?`,
        [target_type, target_id, limit, offset],
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

  // 向后兼容方法
  static getLikesByMomentId(momentId, page = 1, limit = 10) {
    return Like.getLikesByContentId(momentId, null, page, limit);
  }

  static getLikesByPostId(postId, page = 1, limit = 10) {
    return Like.getLikesByContentId(null, postId, page, limit);
  }
}

module.exports = Like;