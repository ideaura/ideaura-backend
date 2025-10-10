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
          // 表已存在，只创建缺失的索引
          console.log(`✅ 表 ${table.name} 已存在`);
          createIndexesForTable(table);
        }
      });

      function createIndexesForTable(table) {
        if (table.indexes && table.indexes.length > 0) {
          let indexesProcessed = 0;
          
          table.indexes.forEach(indexSql => {
            db.run(indexSql, (err) => {
              if (err) {
                console.error(`创建索引错误 (${indexSql}):`, err);
              } else {
                indexesCreated++;
                console.log(`✅ 索引创建成功: ${indexSql.split(' ')[5]}`); // 提取索引名
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
          console.log(`- 创建了 ${indexesCreated} 个索引`);
          console.log('✅ 数据库结构完整\n');
          resolve();
        }
      }
    });
  });
}

module.exports = { initializeDatabase };