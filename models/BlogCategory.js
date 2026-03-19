const db = require('../config/database');
const time = require('../utils/time');
const formatLocalTime = (...args) => time.formatLocalTime(...args);


class BlogCategory {
  // 创建博客分类
  static create(categoryData) {
    return new Promise((resolve, reject) => {
      const { name, description, user_id } = categoryData;
      const createdAt = time.currentDbString();

      db.run(
        `INSERT INTO blog_categories (name, description, user_id, created_at, updated_at) 
         VALUES (?, ?, ?, ?, ?) RETURNING id`,
        [name, description, user_id, createdAt, createdAt],
        function(err) {
          if (err) {
            if (err.code === 'SQLITE_CONSTRAINT_UNIQUE' || err.code === '23505') {
              return reject(new Error('分类名称已存在'));
            }
            return reject(err);
          }
          resolve(this.lastID);
        }
      );
    });
  }

  // 获取用户的所有分类
  static findByUser(userId) {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT bc.*, COUNT(p.id) as post_count
         FROM blog_categories bc
         LEFT JOIN posts p ON bc.id = p.category_id AND p.type = 'blog'
         WHERE bc.user_id = ?
         GROUP BY bc.id
         ORDER BY bc.created_at DESC`,
        [userId],
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

  // 获取分类详情
  static findById(id) {
    return new Promise((resolve, reject) => {
      db.get(
        `SELECT bc.*, COUNT(p.id) as post_count
         FROM blog_categories bc
         LEFT JOIN posts p ON bc.id = p.category_id AND p.type = 'blog'
         WHERE bc.id = ?`,
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

  // 更新分类
  static update(id, userId, updates) {
    return new Promise((resolve, reject) => {
      const { name, description } = updates;
      const updatedAt = time.currentDbString();

      let sql = 'UPDATE blog_categories SET updated_at = ?';
      let params = [updatedAt];

      if (name !== undefined) {
        sql += ', name = ?';
        params.push(name);
      }
      if (description !== undefined) {
        sql += ', description = ?';
        params.push(description);
      }

      sql += ' WHERE id = ? AND user_id = ?';
      params.push(id, userId);

      db.run(sql, params, function(err) {
        if (err) {
          if (err.code === 'SQLITE_CONSTRAINT_UNIQUE' || err.code === '23505') {
            return reject(new Error('分类名称已存在'));
          }
          return reject(err);
        }
        resolve({ changes: this.changes });
      });
    });
  }

  // 删除分类
  static delete(id, userId) {
    return new Promise((resolve, reject) => {
      // 先将该分类下的博客文章的分类ID设为null
      db.run(
        `UPDATE posts SET category_id = NULL WHERE category_id = ? AND user_id = ? AND type = 'blog'`,
        [id, userId],
        (err) => {
          if (err) return reject(err);

          // 然后删除分类
          db.run(
            `DELETE FROM blog_categories WHERE id = ? AND user_id = ?`,
            [id, userId],
            function(err) {
              if (err) return reject(err);
              resolve({ changes: this.changes });
            }
          );
        }
      );
    });
  }

  // 检查分类是否属于指定用户
  static belongsToUser(categoryId, userId) {
    return new Promise((resolve, reject) => {
      db.get(
        `SELECT 1 FROM blog_categories WHERE id = ? AND user_id = ?`,
        [categoryId, userId],
        (err, row) => {
          if (err) return reject(err);
          resolve(!!row);
        }
      );
    });
  }

  // 根据名称查找用户分类
  static findByNameAndUser(name, userId) {
    return new Promise((resolve, reject) => {
      db.get(
        `SELECT * FROM blog_categories WHERE name = ? AND user_id = ?`,
        [name, userId],
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
}

module.exports = BlogCategory;