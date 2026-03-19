const db = require('../config/database');
const bcrypt = require('bcryptjs');
const { generateToken } = require('../utils/tokens');

const time = require('../utils/time');
const formatLocalTime = (...args) => time.formatLocalTime(...args);

class User {
  static create(userData) {
    return new Promise((resolve, reject) => {
      const { id, username, email, password, isOidcUser = false, avatar_url = null } = userData;
      const verificationToken = generateToken();

      // 首先获取当前用户总数，确定注册名次
      db.get("SELECT COUNT(*) as total FROM users", (err, countRow) => {
        if (err) return reject(err);

        const registrationOrder = parseInt(countRow.total) + 1;

        // 对于OIDC用户，可能没有密码
        const passwordHashPromise = password ?
          new Promise((res, rej) => bcrypt.hash(password, 10, (err, hashedPassword) => {
            if (err) rej(err);
            else res(hashedPassword);
          })) :
          Promise.resolve(""); // OIDC用户密码为空字符串

        passwordHashPromise.then(hashedPassword => {
          // 使用本地时间
          const currentTime = time.currentDbString();

          let query = "INSERT INTO users (username, email, password, email_verified, verification_token, registration_order, avatar_url, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING id";
          let params = [username, email, hashedPassword, isOidcUser ? true : false, verificationToken, registrationOrder, avatar_url, currentTime];

          if (id) {
            query = "INSERT INTO users (id, username, email, password, email_verified, verification_token, registration_order, avatar_url, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id";
            params = [id, username, email, hashedPassword, isOidcUser ? true : false, verificationToken, registrationOrder, avatar_url, currentTime];
          }

          db.run(
            query,
            params,
            function (err) {
              if (err) return reject(err);
              resolve({
                id: id || this.lastID,
                username,
                email,
                verificationToken,
                registrationOrder,
                avatar_url,
                createdAt: currentTime
              });
            }
          );
        }).catch(reject);
      });
    });
  }

  static findByUsername(username) {
    return new Promise((resolve, reject) => {
      db.get(
        "SELECT id, username, email, password, email_verified, avatar_url, created_at, registration_order FROM users WHERE username = ?",
        [username],
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

  // 更新用户名
  static updateUsername(userId, newUsername) {
    return new Promise((resolve, reject) => {
      // 使用本地时间
      const currentTime = time.currentDbString();

      db.run(
        "UPDATE users SET username = ?, updated_at = ? WHERE id = ?",
        [newUsername, currentTime, userId],
        function (err) {
          if (err) return reject(err);
          resolve({ changes: this.changes });
        }
      );
    });
  }

  // 检查用户名是否已存在
  static checkUsernameExists(username) {
    return new Promise((resolve, reject) => {
      db.get(
        "SELECT 1 FROM users WHERE username = ?",
        [username],
        (err, row) => {
          if (err) return reject(err);
          resolve(!!row);
        }
      );
    });
  }

  static findByEmail(email) {
    return new Promise((resolve, reject) => {
      db.get(
        "SELECT id, username, email, password, email_verified, avatar_url, created_at, registration_order FROM users WHERE email = ?",
        [email],
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

  static findById(id) {
    return new Promise((resolve, reject) => {
      db.get(
        "SELECT id, username, email, email_verified, avatar_url, created_at, registration_order FROM users WHERE id = ?",
        [id],
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

  static verifyEmail(token) {
    return new Promise((resolve, reject) => {
      db.get(
        "SELECT id, email FROM users WHERE verification_token = ?",
        [token],
        (err, row) => {
          if (err) return reject(err);
          if (!row) return resolve(null);

          // 使用本地时间
          const currentTime = time.currentDbString();

          db.run(
            "UPDATE users SET email_verified = true, verification_token = NULL WHERE id = ?",
            [row.id],
            (err) => {
              if (err) return reject(err);
              resolve(row);
            }
          );
        }
      );
    });
  }

  static updateVerificationToken(userId, token) {
    return new Promise((resolve, reject) => {
      db.run(
        "UPDATE users SET verification_token = ? WHERE id = ?",
        [token, userId],
        function (err) {
          if (err) return reject(err);
          resolve({ changes: this.changes });
        }
      );
    });
  }

  // 添加创建密码重置令牌的方法
  static createPasswordResetToken(email) {
    return new Promise((resolve, reject) => {
      const resetToken = generateToken();

      db.run(
        "UPDATE users SET reset_token = ?, reset_token_expires = ? WHERE email = ?",
        [resetToken, time.currentDbString(time.nowMs() + 3600 * 1000), email],
        function (err) {
          if (err) return reject(err);
          if (this.changes === 0) return resolve(null);
          resolve(resetToken);
        }
      );
    });
  }

  // 添加验证密码重置令牌的方法
  static validatePasswordResetToken(token) {
    return new Promise((resolve, reject) => {
      db.get(
        "SELECT id, username, email FROM users WHERE reset_token = ? AND reset_token_expires > ?",
        [token, time.currentDbString()],
        (err, row) => {
          if (err) return reject(err);
          resolve(row);
        }
      );
    });
  }

  // 添加重置密码的方法
  static resetPassword(token, newPassword) {
    return new Promise((resolve, reject) => {
      bcrypt.hash(newPassword, 10, (err, hashedPassword) => {
        if (err) return reject(err);

        db.run(
          "UPDATE users SET password = ?, reset_token = NULL, reset_token_expires = NULL WHERE reset_token = ? AND reset_token_expires > ?",
          [hashedPassword, token, time.currentDbString()],
          function (err) {
            if (err) return reject(err);
            if (this.changes === 0) return resolve(false);
            resolve(true);
          }
        );
      });
    });
  }

  // 添加清理过期密码重置令牌的方法
  static cleanExpiredResetTokens() {
    return new Promise((resolve, reject) => {
      db.run(
        "UPDATE users SET reset_token = NULL, reset_token_expires = NULL WHERE reset_token_expires <= ?",
        [time.currentDbString()],
        function (err) {
          if (err) return reject(err);
          console.log(`清理了 ${this.changes} 个过期的密码重置令牌`);
          resolve({ cleaned: this.changes });
        }
      );
    });
  }

  static countByEmail(email) {
    return new Promise((resolve, reject) => {
      db.get(
        "SELECT COUNT(*) as count FROM users WHERE email = ?",
        [email],
        (err, row) => {
          if (err) return reject(err);
          resolve(row.count);
        }
      );
    });
  }

  static getTotalUsers() {
    return new Promise((resolve, reject) => {
      db.get(
        "SELECT COUNT(*) as total FROM users",
        (err, row) => {
          if (err) return reject(err);
          resolve(row.total);
        }
      );
    });
  }

  static getRecentUsers(limit = 10) {
    return new Promise((resolve, reject) => {
      db.all(
        "SELECT id, username, avatar_url, created_at, registration_order FROM users ORDER BY created_at DESC LIMIT ?",
        [limit],
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

  static searchByUsername(username, limit = 10) {
    return new Promise((resolve, reject) => {
      db.all(
        "SELECT id, username, avatar_url, created_at, registration_order FROM users WHERE username LIKE ? ORDER BY username LIMIT ?",
        [`%${username}%`, limit],
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

  static findAll() {
    return new Promise((resolve, reject) => {
      db.all(
        "SELECT id, username, email, password, email_verified, avatar_url, created_at, registration_order FROM users",
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

  static update(userId, updateFields) {
    return new Promise((resolve, reject) => {
      // 构建动态更新查询
      const fields = Object.keys(updateFields);
      if (fields.length === 0) {
        return resolve({ changes: 0 });
      }

      const setClause = fields.map(field => `${field} = ?`).join(', ');
      const values = fields.map(field => updateFields[field]);
      // 使用本地时间
      const currentTime = time.currentDbString();
      values.push(currentTime); // 添加更新时间到值数组
      values.push(userId); // 最后一个参数是WHERE条件的用户ID

      db.run(
        `UPDATE users SET ${setClause}, updated_at = ? WHERE id = ?`,
        values,
        function (err) {
          if (err) return reject(err);
          resolve({ changes: this.changes });
        }
      );
    });
  }
}

module.exports = User;