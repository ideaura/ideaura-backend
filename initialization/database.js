const db = require('../config/database');
const { getDatabaseTimeString } = require('../utils/timezone');

function initializeDatabase() {
  return new Promise((resolve, reject) => {
    console.log('开始全面检查数据库表结构...');

    const tableSchemas = [
      {
        name: 'users',
        schema: `CREATE TABLE users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          username TEXT UNIQUE NOT NULL,
          email TEXT UNIQUE NOT NULL,
          password TEXT NOT NULL,
          email_verified INTEGER DEFAULT 0,
          verification_token TEXT,
          registration_order INTEGER,
          created_at DATETIME DEFAULT (datetime('now', 'localtime')) -- 使用本地时间(UTC+8)
        )`,
        indexes: [
          'CREATE INDEX IF NOT EXISTS idx_users_username ON users(username)',
          'CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)',
          'CREATE INDEX IF NOT EXISTS idx_users_registration_order ON users(registration_order)',
          'CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at)'
        ],
        // 定义需要检查和可能添加的列
        columns: [
          { name: 'registration_order', type: 'INTEGER' }
        ]
      },
      {
        name: 'email_verifications',
        schema: `CREATE TABLE email_verifications (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          email TEXT NOT NULL,
          token TEXT NOT NULL,
          created_at DATETIME DEFAULT (datetime('now', 'localtime')) -- 使用本地时间(UTC+8)
        )`,
        indexes: [
          'CREATE INDEX IF NOT EXISTS idx_email_verifications_token ON email_verifications(token)',
          'CREATE INDEX IF NOT EXISTS idx_email_verifications_created_at ON email_verifications(created_at)'
        ]
      },
      {
        name: 'topics',
        schema: `CREATE TABLE topics (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL UNIQUE,
          description TEXT,
          created_by INTEGER NOT NULL,
          is_private BOOLEAN DEFAULT 1, -- 默认为私有话题
          is_active BOOLEAN DEFAULT 1,
          message_count INTEGER DEFAULT 0,
          last_activity DATETIME, -- 使用本地时间(UTC+8)
          created_at DATETIME DEFAULT (datetime('now', 'localtime')) -- 使用本地时间(UTC+8)
        )`,
        indexes: [
          'CREATE INDEX IF NOT EXISTS idx_topics_name ON topics(name)',
          'CREATE INDEX IF NOT EXISTS idx_topics_created_by ON topics(created_by)',
          'CREATE INDEX IF NOT EXISTS idx_topics_is_private ON topics(is_private)',
          'CREATE INDEX IF NOT EXISTS idx_topics_is_active ON topics(is_active)',
          'CREATE INDEX IF NOT EXISTS idx_topics_last_activity ON topics(last_activity)',
          'CREATE INDEX IF NOT EXISTS idx_topics_created_at ON topics(created_at)'
        ],
        // 定义需要检查和可能添加的列
        columns: [
          { name: 'is_private', type: 'BOOLEAN', default: '1' },
          { name: 'is_active', type: 'BOOLEAN', default: '1' },
          { name: 'message_count', type: 'INTEGER', default: '0' },
          { name: 'last_activity', type: 'DATETIME' }
        ]
      },
      {
        name: 'topic_members',
        schema: `CREATE TABLE topic_members (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          topic_id INTEGER NOT NULL,
          user_id INTEGER NOT NULL,
          role TEXT DEFAULT 'member', -- 角色: 'creator', 'admin', 'member'
          joined_at DATETIME DEFAULT (datetime('now', 'localtime')), -- 使用本地时间(UTC+8)
          FOREIGN KEY (topic_id) REFERENCES topics(id) ON DELETE CASCADE,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )`,
        indexes: [
          'CREATE INDEX IF NOT EXISTS idx_topic_members_topic_id ON topic_members(topic_id)',
          'CREATE INDEX IF NOT EXISTS idx_topic_members_user_id ON topic_members(user_id)',
          'CREATE UNIQUE INDEX IF NOT EXISTS idx_topic_members_unique ON topic_members(topic_id, user_id)'
        ],
        // 定义需要检查和可能添加的列
        columns: [
          { name: 'role', type: 'TEXT', default: "'member'" }
        ]
      },
      {
        name: 'messages',
        schema: `CREATE TABLE messages (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          topic_id INTEGER,
          user_id INTEGER NOT NULL,
          content TEXT NOT NULL,
          created_at DATETIME DEFAULT (datetime('now', 'localtime')) -- 使用本地时间(UTC+8)
        )`,
        indexes: [
          'CREATE INDEX IF NOT EXISTS idx_messages_topic_id ON messages(topic_id)',
          'CREATE INDEX IF NOT EXISTS idx_messages_user_id ON messages(user_id)',
          'CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at)'
        ]
      },
      {
        name: 'private_messages',
        schema: `CREATE TABLE private_messages (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          sender_id INTEGER NOT NULL,
          receiver_id INTEGER NOT NULL,
          content TEXT NOT NULL,
          is_read BOOLEAN DEFAULT 0,
          created_at DATETIME DEFAULT (datetime('now', 'localtime')) -- 使用本地时间(UTC+8)
        )`,
        indexes: [
          'CREATE INDEX IF NOT EXISTS idx_private_messages_sender_id ON private_messages(sender_id)',
          'CREATE INDEX IF NOT EXISTS idx_private_messages_receiver_id ON private_messages(receiver_id)',
          'CREATE INDEX IF NOT EXISTS idx_private_messages_is_read ON private_messages(is_read)',
          'CREATE INDEX IF NOT EXISTS idx_private_messages_created_at ON private_messages(created_at)'
        ],
        // 定义需要检查和可能添加的列
        columns: [
          { name: 'is_read', type: 'BOOLEAN', default: '0' }
        ]
      },
      {
        name: 'sessions',
        schema: `CREATE TABLE sessions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          socket_id TEXT,
          created_at DATETIME DEFAULT (datetime('now', 'localtime')) -- 使用本地时间(UTC+8)
        )`,
        indexes: [
          'CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id)',
          'CREATE INDEX IF NOT EXISTS idx_sessions_socket_id ON sessions(socket_id)',
          'CREATE INDEX IF NOT EXISTS idx_sessions_created_at ON sessions(created_at)'
        ]
      }
    ];

    let tablesProcessed = 0;
    let tablesCreated = 0;
    let indexesCreated = 0;
    let columnsAdded = 0;

    // 检查并创建每个表
    tableSchemas.forEach(table => {
      // 检查表是否存在
      db.get(`SELECT name FROM sqlite_master WHERE type='table' AND name='${table.name}'`, (err, row) => {
        if (err) {
          console.error(`检查表 ${table.name} 错误:`, err);
          reject(err);
          return;
        }

        if (!row) {
          // 表不存在，创建它
          console.log(`表 ${table.name} 不存在，正在创建...`);
          db.run(table.schema, (err) => {
            if (err) {
              console.error(`创建表 ${table.name} 错误:`, err);
              reject(err);
              return;
            }
            console.log(`✅ 表 ${table.name} 创建成功`);
            tablesCreated++;
            
            // 创建索引
            createIndexesForTable(table);
          });
        } else {
          // 表已存在，检查是否需要添加新列并创建缺失的索引
          console.log(`✅ 表 ${table.name} 已存在，检查结构完整性...`);
          checkAndUpgradeTable(table, () => {
            createIndexesForTable(table);
          });
        }
      });

      // 检查并升级表结构
      function checkAndUpgradeTable(table, callback) {
        // 获取当前表结构
        db.all(`PRAGMA table_info(${table.name})`, (err, currentColumns) => {
          if (err) {
            console.error(`获取表 ${table.name} 结构错误:`, err);
            callback();
            return;
          }

          // 检查是否需要添加新列
          if (table.columns && table.columns.length > 0) {
            let columnsProcessed = 0;
            let columnsToAdd = [];

            table.columns.forEach(column => {
              // 检查列是否已存在
              const columnExists = currentColumns.some(col => col.name === column.name);
              
              if (!columnExists) {
                columnsToAdd.push(column);
              }
            });

            if (columnsToAdd.length > 0) {
              // 添加缺失的列
              addMissingColumns(table.name, columnsToAdd, () => {
                columnsAdded += columnsToAdd.length;
                callback();
              });
            } else {
              callback();
            }
          } else {
            callback();
          }
        });
      }

      // 添加缺失的列
      function addMissingColumns(tableName, columns, callback) {
        if (columns.length === 0) {
          callback();
          return;
        }

        let columnsProcessed = 0;
        
        columns.forEach(column => {
          let sql = `ALTER TABLE ${tableName} ADD COLUMN ${column.name} ${column.type}`;
          if (column.default !== undefined) {
            sql += ` DEFAULT ${column.default}`;
          }
          
          db.run(sql, (err) => {
            columnsProcessed++;
            if (err) {
              console.error(`添加列 ${column.name} 到表 ${tableName} 错误:`, err);
            } else {
              console.log(`✅ 列 ${column.name} 已添加到表 ${tableName}`);
            }
            
            if (columnsProcessed === columns.length) {
              callback();
            }
          });
        });
      }

      function createIndexesForTable(table) {
        if (table.indexes && table.indexes.length > 0) {
          let indexesProcessed = 0;
          
          table.indexes.forEach(indexSql => {
            db.run(indexSql, (err) => {
              if (err) {
                console.error(`创建索引错误 (${indexSql}):`, err);
              } else {
                indexesCreated++;
                const indexName = indexSql.split(' ')[5]; // 提取索引名
                console.log(`✅ 索引创建成功: ${indexName}`);
              }
              
              indexesProcessed++;
              if (indexesProcessed === table.indexes.length) {
                tableComplete();
              }
            });
          });
        } else {
          tableComplete();
        }
      }

      function tableComplete() {
        tablesProcessed++;
        if (tablesProcessed === tableSchemas.length) {
          console.log(`\n数据库检查完成:`);
          console.log(`- 检查了 ${tableSchemas.length} 个表`);
          console.log(`- 创建了 ${tablesCreated} 个新表`);
          console.log(`- 添加了 ${columnsAdded} 个新列`);
          console.log(`- 创建了 ${indexesCreated} 个索引`);
          console.log('✅ 数据库结构完整\n');
          
          // 如果有结构更新，执行数据修复
          if (columnsAdded > 0) {
            performDataFixes(() => {
              resolve();
            });
          } else {
            resolve();
          }
        }
      }
    });

    // 执行数据修复操作
    function performDataFixes(callback) {
      console.log('开始执行数据修复...');
      let fixesCompleted = 0;
      let totalFixes = 3; // 我们有3个修复操作

      // 修复1: 为现有用户设置注册顺序
      fixUserRegistrationOrder(() => {
        fixesCompleted++;
        if (fixesCompleted === totalFixes) {
          console.log('✅ 数据修复完成');
          callback();
        }
      });

      // 修复2: 为现有话题成员设置默认角色
      fixTopicMemberRoles(() => {
        fixesCompleted++;
        if (fixesCompleted === totalFixes) {
          console.log('✅ 数据修复完成');
          callback();
        }
      });

      // 修复3: 为现有私聊消息设置已读状态
      fixPrivateMessageReadStatus(() => {
        fixesCompleted++;
        if (fixesCompleted === totalFixes) {
          console.log('✅ 数据修复完成');
          callback();
        }
      });
    }

    // 修复用户注册顺序
    function fixUserRegistrationOrder(callback) {
      db.get("SELECT COUNT(*) as count FROM users WHERE registration_order IS NULL", (err, row) => {
        if (err) {
          console.error('检查用户注册顺序错误:', err);
          callback();
          return;
        }

        if (row && row.count > 0) {
          console.log(`发现 ${row.count} 个用户需要修复注册顺序...`);
          
          // 获取所有用户按注册时间排序
          db.all("SELECT id, created_at FROM users ORDER BY created_at ASC", (err, users) => {
            if (err) {
              console.error('获取用户列表错误:', err);
              callback();
              return;
            }

            if (users.length === 0) {
              callback();
              return;
            }

            let updatedCount = 0;
            users.forEach((user, index) => {
              const registrationOrder = index + 1;
              
              db.run(
                "UPDATE users SET registration_order = ? WHERE id = ?",
                [registrationOrder, user.id],
                (err) => {
                  if (err) {
                    console.error(`更新用户 ${user.id} 注册顺序错误:`, err);
                  } else {
                    updatedCount++;
                  }
                  
                  if (updatedCount === users.length) {
                    console.log(`✅ 已修复 ${updatedCount} 个用户的注册顺序`);
                    callback();
                  }
                }
              );
            });
          });
        } else {
          console.log('✅ 用户注册顺序无需修复');
          callback();
        }
      });
    }

    // 修复话题成员角色
    function fixTopicMemberRoles(callback) {
      db.get("SELECT COUNT(*) as count FROM topic_members WHERE role IS NULL OR role = ''", (err, row) => {
        if (err) {
          console.error('检查话题成员角色错误:', err);
          callback();
          return;
        }

        if (row && row.count > 0) {
          console.log(`发现 ${row.count} 个话题成员需要修复角色...`);
          
          // 首先将所有成员设置为默认成员角色
          db.run("UPDATE topic_members SET role = 'member' WHERE role IS NULL OR role = ''", (err) => {
            if (err) {
              console.error('更新话题成员角色错误:', err);
              callback();
              return;
            }
            
            console.log('✅ 话题成员角色修复完成');
            callback();
          });
        } else {
          console.log('✅ 话题成员角色无需修复');
          callback();
        }
      });
    }

    // 修复私聊消息已读状态
    function fixPrivateMessageReadStatus(callback) {
      db.get("SELECT COUNT(*) as count FROM private_messages WHERE is_read IS NULL", (err, row) => {
        if (err) {
          console.error('检查私聊消息已读状态错误:', err);
          callback();
          return;
        }

        if (row && row.count > 0) {
          console.log(`发现 ${row.count} 个私聊消息需要修复已读状态...`);
          
          // 将所有消息设置为未读
          db.run("UPDATE private_messages SET is_read = 0 WHERE is_read IS NULL", (err) => {
            if (err) {
              console.error('更新私聊消息已读状态错误:', err);
              callback();
              return;
            }
            
            console.log('✅ 私聊消息已读状态修复完成');
            callback();
          });
        } else {
          console.log('✅ 私聊消息已读状态无需修复');
          callback();
        }
      });
    }
  });
}

module.exports = { initializeDatabase };