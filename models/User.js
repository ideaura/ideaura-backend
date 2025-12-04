const db = require('../config/database');
const bcrypt = require('bcryptjs');
const { generateToken } = require('../utils/tokens');
const { formatLocalTime } = require('../utils/timezone');

class User {
  static create(userData) {
    return new Promise((resolve, reject) => {
      const { username, email, password } = userData;
      const verificationToken = generateToken();
      
      // 首先获取当前用户总数，确定注册名次
      db.get("SELECT COUNT(*) as total FROM users", (err, countRow) => {
        if (err) return reject(err);
        
        const registrationOrder = countRow.total + 1;
        
        bcrypt.hash(password, 10, (err, hashedPassword) => {
          if (err) return reject(err);
          
          // 使用本地时间
          const currentTime = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false });
          
          db.run(
            "INSERT INTO users (username, email, password, email_verified, verification_token, registration_order, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
            [username, email, hashedPassword, 0, verificationToken, registrationOrder, currentTime],
            function(err) {
              if (err) return reject(err);
              resolve({ 
                id: this.lastID, 
                username, 
                email, 
                verificationToken,
                registrationOrder,
                createdAt: currentTime
              });
            }
          );
        });
      });
    });
  }

  static findByUsername(username) {
    return new Promise((resolve, reject) => {
      db.get(
        "SELECT id, username, email, password, email_verified, created_at, registration_order FROM users WHERE username = ?",
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

  static findByEmail(email) {
    return new Promise((resolve, reject) => {
      db.get(
        "SELECT id, username, email, email_verified, created_at, registration_order FROM users WHERE email = ?",
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
        "SELECT id, username, email, email_verified, created_at, registration_order FROM users WHERE id = ?",
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
          const currentTime = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false });
          
          db.run(
            "UPDATE users SET email_verified = 1, verification_token = NULL WHERE id = ?",
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
        function(err) {
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
        "UPDATE users SET reset_token = ?, reset_token_expires = datetime('now', '+1 hour') WHERE email = ?",
        [resetToken, email],
        function(err) {
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
        "SELECT id, username, email FROM users WHERE reset_token = ? AND reset_token_expires > datetime('now')",
        [token],
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
          "UPDATE users SET password = ?, reset_token = NULL, reset_token_expires = NULL WHERE reset_token = ? AND reset_token_expires > datetime('now')",
          [hashedPassword, token],
          function(err) {
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
        "UPDATE users SET reset_token = NULL, reset_token_expires = NULL WHERE reset_token_expires <= datetime('now')",
        function(err) {
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
        "SELECT id, username, created_at, registration_order FROM users ORDER BY created_at DESC LIMIT ?",
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
        "SELECT id, username, created_at, registration_order FROM users WHERE username LIKE ? ORDER BY username LIMIT ?",
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
}

module.exports = User;