const db = require('../config/database');
const time = require('../utils/time');
const formatLocalTime = (...args) => time.formatLocalTime(...args);


class Post {
  // 创建帖子
  static create(postData) {
    return new Promise((resolve, reject) => {
      const { community_id, user_id, subsection_id, title, content, tags, attachment_urls, type, category_id } = postData;

      const currentTime = time.currentDbString();

      db.run(
        `INSERT INTO posts (community_id, user_id, subsection_id, title, content, tags, attachment_urls, type, category_id, created_at, updated_at, published_at) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
        [community_id, user_id, subsection_id, title, content, tags, attachment_urls, type, category_id, currentTime, currentTime, currentTime],
        function (err) {
          if (err) return reject(err);
          resolve(this.lastID);
        }
      );
    });
  }

  // 获取帖子详情
  static findById(id) {
    return new Promise((resolve, reject) => {
      db.get(
        `SELECT p.*, u.username as author_name, u.avatar_url as author_avatar, c.name as community_name, s.name as subsection_name
         FROM posts p
         LEFT JOIN users u ON p.user_id = u.id
         LEFT JOIN communities c ON p.community_id = c.id
         LEFT JOIN subsections s ON p.subsection_id = s.id
         WHERE p.id = ? AND p.status = 'published'`,
        [id],
        (err, row) => {
          if (err) return reject(err);
          if (row) {
            row.created_at = formatLocalTime(row.created_at);
            row.updated_at = formatLocalTime(row.updated_at);
            row.published_at = formatLocalTime(row.published_at);
          }
          resolve(row);
        }
      );
    });
  }

  // 获取社区帖子列表
  static findByCommunity(communityId, limit = 20, offset = 0) {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT p.*, u.username as author_name, u.avatar_url as author_avatar, c.name as community_name, s.name as subsection_name
         FROM posts p
         LEFT JOIN users u ON p.user_id = u.id
         LEFT JOIN communities c ON p.community_id = c.id
         LEFT JOIN subsections s ON p.subsection_id = s.id
         WHERE p.community_id = ? AND p.status = 'published'
         ORDER BY p.created_at DESC
         LIMIT ? OFFSET ?`,
        [communityId, limit, offset],
        (err, rows) => {
          if (err) return reject(err);
          rows.forEach(row => {
            row.created_at = formatLocalTime(row.created_at);
            row.updated_at = formatLocalTime(row.updated_at);
            row.published_at = formatLocalTime(row.published_at);
          });
          resolve(rows);
        }
      );
    });
  }

  // 获取分区帖子列表
  static findBySubsection(subsectionId, limit = 20, offset = 0) {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT p.*, u.username as author_name, u.avatar_url as author_avatar, c.name as community_name, s.name as subsection_name
         FROM posts p
         LEFT JOIN users u ON p.user_id = u.id
         LEFT JOIN communities c ON p.community_id = c.id
         LEFT JOIN subsections s ON p.subsection_id = s.id
         WHERE p.subsection_id = ? AND p.status = 'published'
         ORDER BY p.created_at DESC
         LIMIT ? OFFSET ?`,
        [subsectionId, limit, offset],
        (err, rows) => {
          if (err) return reject(err);
          rows.forEach(row => {
            row.created_at = formatLocalTime(row.created_at);
            row.updated_at = formatLocalTime(row.updated_at);
            row.published_at = formatLocalTime(row.published_at);
          });
          resolve(rows);
        }
      );
    });
  }

  // 获取用户发布的帖子
  static findByUser(userId, limit = 20, offset = 0) {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT p.*, u.username as author_name, u.avatar_url as author_avatar, c.name as community_name, s.name as subsection_name
         FROM posts p
         LEFT JOIN users u ON p.user_id = u.id
         LEFT JOIN communities c ON p.community_id = c.id
         LEFT JOIN subsections s ON p.subsection_id = s.id
         WHERE p.user_id = ? AND p.status = 'published'
         ORDER BY p.created_at DESC
         LIMIT ? OFFSET ?`,
        [userId, limit, offset],
        (err, rows) => {
          if (err) return reject(err);
          rows.forEach(row => {
            row.created_at = formatLocalTime(row.created_at);
            row.updated_at = formatLocalTime(row.updated_at);
            row.published_at = formatLocalTime(row.published_at);
          });
          resolve(rows);
        }
      );
    });
  }

  // 获取全部帖子（可按社区筛选）
  static findAll(communityId = null, limit = 20, offset = 0) {
    return new Promise((resolve, reject) => {
      let sql, params;
      if (communityId) {
        sql = `SELECT p.*, u.username as author_name, u.avatar_url as author_avatar, c.name as community_name, s.name as subsection_name
               FROM posts p
               LEFT JOIN users u ON p.user_id = u.id
               LEFT JOIN communities c ON p.community_id = c.id
               LEFT JOIN subsections s ON p.subsection_id = s.id
               WHERE p.community_id = ? AND p.status = 'published'
               ORDER BY p.created_at DESC
               LIMIT ? OFFSET ?`;
        params = [communityId, limit, offset];
      } else {
        sql = `SELECT p.*, u.username as author_name, u.avatar_url as author_avatar, c.name as community_name, s.name as subsection_name
               FROM posts p
               LEFT JOIN users u ON p.user_id = u.id
               LEFT JOIN communities c ON p.community_id = c.id
               LEFT JOIN subsections s ON p.subsection_id = s.id
               WHERE p.status = 'published'
               ORDER BY p.created_at DESC
               LIMIT ? OFFSET ?`;
        params = [limit, offset];
      }

      db.all(sql, params, (err, rows) => {
        if (err) return reject(err);
        rows.forEach(row => {
          row.created_at = formatLocalTime(row.created_at);
          row.updated_at = formatLocalTime(row.updated_at);
          row.published_at = formatLocalTime(row.published_at);
        });
        resolve(rows);
      });
    });
  }

  // 搜索帖子
  static search(query, communityId = null, limit = 20, offset = 0) {
    return new Promise((resolve, reject) => {
      const searchQuery = `%${query}%`;
      let sql, params;

      if (communityId) {
        sql = `SELECT p.*, u.username as author_name, u.avatar_url as author_avatar, c.name as community_name, s.name as subsection_name
               FROM posts p
               LEFT JOIN users u ON p.user_id = u.id
               LEFT JOIN communities c ON p.community_id = c.id
               LEFT JOIN subsections s ON p.subsection_id = s.id
               WHERE (p.title LIKE ? OR p.content LIKE ? OR p.tags LIKE ?) AND p.community_id = ? AND p.status = 'published'
               ORDER BY p.created_at DESC
               LIMIT ? OFFSET ?`;
        params = [searchQuery, searchQuery, searchQuery, communityId, limit, offset];
      } else {
        sql = `SELECT p.*, u.username as author_name, u.avatar_url as author_avatar, c.name as community_name, s.name as subsection_name
               FROM posts p
               LEFT JOIN users u ON p.user_id = u.id
               LEFT JOIN communities c ON p.community_id = c.id
               LEFT JOIN subsections s ON p.subsection_id = s.id
               WHERE (p.title LIKE ? OR p.content LIKE ? OR p.tags LIKE ?) AND p.status = 'published'
               ORDER BY p.created_at DESC
               LIMIT ? OFFSET ?`;
        params = [searchQuery, searchQuery, searchQuery, limit, offset];
      }

      db.all(sql, params, (err, rows) => {
        if (err) return reject(err);
        rows.forEach(row => {
          row.created_at = formatLocalTime(row.created_at);
          row.updated_at = formatLocalTime(row.updated_at);
          row.published_at = formatLocalTime(row.published_at);
        });
        resolve(rows);
      });
    });
  }

  // 更新帖子
  static update(id, userId, updates) {
    return new Promise((resolve, reject) => {
      // 检查用户是否是帖子作者
      db.get(
        `SELECT user_id FROM posts WHERE id = ?`,
        [id],
        (err, row) => {
          if (err) return reject(err);

          if (!row) {
            return reject(new Error('帖子不存在'));
          }

          if (row.user_id !== userId) {
            return reject(new Error('只有帖子作者可以编辑帖子'));
          }

          const { title, content, tags, attachment_urls, type, category_id } = updates;
          const currentTime = time.currentDbString();

          let sql = 'UPDATE posts SET updated_at = ?';
          let params = [currentTime];

          if (title !== undefined) {
            sql += ', title = ?';
            params.push(title);
          }
          if (content !== undefined) {
            sql += ', content = ?';
            params.push(content);
          }
          if (tags !== undefined) {
            sql += ', tags = ?';
            params.push(tags);
          }
          if (attachment_urls !== undefined) {
            sql += ', attachment_urls = ?';
            params.push(attachment_urls);
          }
          if (type !== undefined) {
            sql += ', type = ?';
            params.push(type);
          }
          if (category_id !== undefined) {
            sql += ', category_id = ?';
            params.push(category_id);
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

  // 删除帖子
  static delete(id, userId) {
    return new Promise((resolve, reject) => {
      // 检查用户是否是帖子作者或管理员
      db.get(
        `SELECT p.user_id, cm.role 
         FROM posts p
         LEFT JOIN community_members cm ON p.community_id = cm.community_id AND cm.user_id = ?
         WHERE p.id = ?`,
        [userId, id],
        (err, row) => {
          if (err) return reject(err);

          if (!row) {
            return reject(new Error('帖子不存在'));
          }

          // 检查权限：帖子作者 或 社区管理员/所有者
          const isAuthor = row.user_id === userId;
          const hasManagementPermission = row.role === 'owner' || row.role === 'admin';

          if (!isAuthor && !hasManagementPermission) {
            return reject(new Error('没有权限删除此帖子'));
          }

          db.run(
            `UPDATE posts SET status = 'archived' WHERE id = ?`,
            [id],
            function (err) {
              if (err) return reject(err);
              resolve({ changes: this.changes });
            }
          );
        }
      );
    });
  }

  // 获取帖子统计数据
  static getStats(id) {
    return new Promise((resolve, reject) => {
      db.get(
        `SELECT view_count, like_count, comment_count, share_count FROM posts WHERE id = ?`,
        [id],
        (err, row) => {
          if (err) return reject(err);
          resolve(row || { view_count: 0, like_count: 0, comment_count: 0, share_count: 0 });
        }
      );
    });
  }

  // 增加帖子查看数
  static incrementViewCount(id) {
    return new Promise((resolve, reject) => {
      db.run(
        `UPDATE posts SET view_count = view_count + 1 WHERE id = ?`,
        [id],
        function (err) {
          if (err) return reject(err);
          resolve({ changes: this.changes });
        }
      );
    });
  }

  // 增加帖子评论数
  static incrementCommentCount(id) {
    return new Promise((resolve, reject) => {
      db.run(
        `UPDATE posts SET comment_count = comment_count + 1 WHERE id = ?`,
        [id],
        function (err) {
          if (err) return reject(err);
          resolve({ changes: this.changes });
        }
      );
    });
  }

  // 减少帖子评论数
  static decrementCommentCount(id) {
    return new Promise((resolve, reject) => {
      db.run(
        `UPDATE posts SET comment_count = CASE WHEN comment_count > 0 THEN comment_count - 1 ELSE 0 END WHERE id = ?`,
        [id],
        function (err) {
          if (err) return reject(err);
          resolve({ changes: this.changes });
        }
      );
    });
  }

  // 检查帖子是否存在且已发布
  static existsAndPublished(id) {
    return new Promise((resolve, reject) => {
      db.get(
        `SELECT 1 FROM posts WHERE id = ? AND status = 'published'`,
        [id],
        (err, row) => {
          if (err) return reject(err);
          resolve(!!row);
        }
      );
    });
  }

  // 检查帖子是否属于指定社区
  static belongsToCommunity(postId, communityId) {
    return new Promise((resolve, reject) => {
      db.get(
        `SELECT 1 FROM posts WHERE id = ? AND community_id = ? AND status = 'published'`,
        [postId, communityId],
        (err, row) => {
          if (err) return reject(err);
          resolve(!!row);
        }
      );
    });
  }

  // 检查帖子是否属于指定用户
  static belongsToUser(postId, userId) {
    return new Promise((resolve, reject) => {
      db.get(
        `SELECT 1 FROM posts WHERE id = ? AND user_id = ?`,
        [postId, userId],
        (err, row) => {
          if (err) return reject(err);
          resolve(!!row);
        }
      );
    });
  }

  // 获取用户发布的博客文章
  static findByUserWithBlogType(userId, limit = 20, offset = 0) {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT p.*, u.username as author_name, u.avatar_url as author_avatar, c.name as community_name, s.name as subsection_name
         FROM posts p
         LEFT JOIN users u ON p.user_id = u.id
         LEFT JOIN communities c ON p.community_id = c.id
         LEFT JOIN subsections s ON p.subsection_id = s.id
         WHERE p.user_id = ? AND p.type = 'blog' AND p.status = 'published'
         ORDER BY p.created_at DESC
         LIMIT ? OFFSET ?`,
        [userId, limit, offset],
        (err, rows) => {
          if (err) return reject(err);
          rows.forEach(row => {
            row.created_at = formatLocalTime(row.created_at);
            row.updated_at = formatLocalTime(row.updated_at);
            row.published_at = formatLocalTime(row.published_at);
          });
          resolve(rows);
        }
      );
    });
  }

  // 获取所有博客文章
  static findAllBlogPosts(limit = 20, offset = 0) {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT p.*, u.username as author_name, u.avatar_url as author_avatar, c.name as community_name, s.name as subsection_name
         FROM posts p
         LEFT JOIN users u ON p.user_id = u.id
         LEFT JOIN communities c ON p.community_id = c.id
         LEFT JOIN subsections s ON p.subsection_id = s.id
         WHERE p.type = 'blog' AND p.status = 'published'
         ORDER BY p.created_at DESC
         LIMIT ? OFFSET ?`,
        [limit, offset],
        (err, rows) => {
          if (err) return reject(err);
          rows.forEach(row => {
            row.created_at = formatLocalTime(row.created_at);
            row.updated_at = formatLocalTime(row.updated_at);
            row.published_at = formatLocalTime(row.published_at);
          });
          resolve(rows);
        }
      );
    });
  }

  // 按标签查找博客文章
  static findByTagWithBlogType(tag, limit = 20, offset = 0) {
    return new Promise((resolve, reject) => {
      const searchTag = `%"${tag}"%`;
      db.all(
        `SELECT p.*, u.username as author_name, u.avatar_url as author_avatar, c.name as community_name, s.name as subsection_name
         FROM posts p
         LEFT JOIN users u ON p.user_id = u.id
         LEFT JOIN communities c ON p.community_id = c.id
         LEFT JOIN subsections s ON p.subsection_id = s.id
         WHERE p.type = 'blog' AND p.tags LIKE ? AND p.status = 'published'
         ORDER BY p.created_at DESC
         LIMIT ? OFFSET ?`,
        [searchTag, limit, offset],
        (err, rows) => {
          if (err) return reject(err);
          rows.forEach(row => {
            row.created_at = formatLocalTime(row.created_at);
            row.updated_at = formatLocalTime(row.updated_at);
            row.published_at = formatLocalTime(row.published_at);
          });
          resolve(rows);
        }
      );
    });
  }

  // 搜索博客文章
  static searchBlogPosts(query, limit = 20, offset = 0) {
    return new Promise((resolve, reject) => {
      const searchQuery = `%${query}%`;
      db.all(
        `SELECT p.*, u.username as author_name, u.avatar_url as author_avatar, c.name as community_name, s.name as subsection_name
         FROM posts p
         LEFT JOIN users u ON p.user_id = u.id
         LEFT JOIN communities c ON p.community_id = c.id
         LEFT JOIN subsections s ON p.subsection_id = s.id
         WHERE p.type = 'blog' AND (p.title LIKE ? OR p.content LIKE ? OR p.tags LIKE ?) AND p.status = 'published'
         ORDER BY p.created_at DESC
         LIMIT ? OFFSET ?`,
        [searchQuery, searchQuery, searchQuery, limit, offset],
        (err, rows) => {
          if (err) return reject(err);
          rows.forEach(row => {
            row.created_at = formatLocalTime(row.created_at);
            row.updated_at = formatLocalTime(row.updated_at);
            row.published_at = formatLocalTime(row.published_at);
          });
          resolve(rows);
        }
      );
    });
  }
}

module.exports = Post;