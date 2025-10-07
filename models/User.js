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
          
          // 检查 registration_order 列是否存在
          db.all("PRAGMA table_info(users)", (err, rows) => {
            if (err) return reject(err);
            
            const hasRegistrationOrder = rows.some(row => row.name === 'registration_order');
            let sql, params;
            
            if (hasRegistrationOrder) {
              sql = "INSERT INTO users (username, email, password, verification_token, registration_order) VALUES (?, ?, ?, ?, ?)";
              params = [username, email, hashedPassword, verificationToken, registrationOrder];
            } else {
              sql = "INSERT INTO users (username, email, password, verification_token) VALUES (?, ?, ?, ?)";
              params = [username, email, hashedPassword, verificationToken];
            }
            
            db.run(sql, params, function(err) {
              if (err) return reject(err);
              resolve({ 
                id: this.lastID, 
                username, 
                email, 
                verificationToken,
                registrationOrder: hasRegistrationOrder ? registrationOrder : null,
                createdAt: new Date()
              });
            });
          });
        });
      });
    });
  }

  static findByUsername(username) {
    return new Promise((resolve, reject) => {
      db.all("PRAGMA table_info(users)", (err, rows) => {
        if (err) return reject(err);
        
        const hasRegistrationOrder = rows.some(row => row.name === 'registration_order');
        let sql;
        
        if (hasRegistrationOrder) {
          sql = "SELECT id, username, email, password, email_verified, created_at, registration_order FROM users WHERE username = ?";
        } else {
          sql = "SELECT id, username, email, password, email_verified, created_at, NULL as registration_order FROM users WHERE username = ?";
        }
        
        db.get(sql, [username], (err, row) => {
          if (err) return reject(err);
          if (row) {
            row.created_at = formatLocalTime(row.created_at);
          }
          resolve(row);
        });
      });
    });
  }

  static findByEmail(email) {
    return new Promise((resolve, reject) => {
      db.all("PRAGMA table_info(users)", (err, rows) => {
        if (err) return reject(err);
        
        const hasRegistrationOrder = rows.some(row => row.name === 'registration_order');
        let sql;
        
        if (hasRegistrationOrder) {
          sql = "SELECT id, username, email, email_verified, created_at, registration_order FROM users WHERE email = ?";
        } else {
          sql = "SELECT id, username, email, email_verified, created_at, NULL as registration_order FROM users WHERE email = ?";
        }
        
        db.get(sql, [email], (err, row) => {
          if (err) return reject(err);
          if (row) {
            row.created_at = formatLocalTime(row.created_at);
          }
          resolve(row);
        });
      });
    });
  }

  static findById(id) {
    return new Promise((resolve, reject) => {
      db.all("PRAGMA table_info(users)", (err, rows) => {
        if (err) return reject(err);
        
        const hasRegistrationOrder = rows.some(row => row.name === 'registration_order');
        let sql;
        
        if (hasRegistrationOrder) {
          sql = "SELECT id, username, email, email_verified, created_at, registration_order FROM users WHERE id = ?";
        } else {
          sql = "SELECT id, username, email, email_verified, created_at, NULL as registration_order FROM users WHERE id = ?";
        }
        
        db.get(sql, [id], (err, row) => {
          if (err) return reject(err);
          if (row) {
            row.created_at = formatLocalTime(row.created_at);
          }
          resolve(row);
        });
      });
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