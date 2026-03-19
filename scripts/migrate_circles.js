const db = require('../config/database');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

async function runMigration() {
    console.log('开始执行数据库迁移脚本...');

    return new Promise((resolve, reject) => {
        db.serialize(() => {
            db.run('BEGIN TRANSACTION;');

            try {
                // 1. 解除 topics 表名 UNIQUE 约束
                console.log('1. 重建 topics 表去除 UNIQUE 约束...');
                db.run(`CREATE TABLE new_topics (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          description TEXT,
          announcement TEXT,
          created_by INTEGER NOT NULL,
          is_private BOOLEAN DEFAULT 1,
          is_active BOOLEAN DEFAULT 1,
          message_count INTEGER DEFAULT 0,
          avatar_url TEXT,
          last_activity DATETIME,
          created_at DATETIME DEFAULT (datetime('now', 'localtime'))
        )`);
                db.run(`INSERT INTO new_topics SELECT * FROM topics`);
                db.run(`DROP TABLE topics`);
                db.run(`ALTER TABLE new_topics RENAME TO topics`);
                db.run(`CREATE INDEX idx_topics_name ON topics(name)`);
                db.run(`CREATE INDEX idx_topics_created_by ON topics(created_by)`);
                db.run(`CREATE INDEX idx_topics_is_private ON topics(is_private)`);
                db.run(`CREATE INDEX idx_topics_is_active ON topics(is_active)`);
                db.run(`CREATE INDEX idx_topics_last_activity ON topics(last_activity)`);
                db.run(`CREATE INDEX idx_topics_created_at ON topics(created_at)`);

                // 2. 修改 communities 表解除 UNIQUE 并新增 topic_id
                console.log('2. 重建 communities 表去除 UNIQUE 约束并新增 topic_id...');
                db.run(`CREATE TABLE new_communities (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          topic_id INTEGER UNIQUE,
          name TEXT NOT NULL,
          description TEXT,
          tags TEXT,
          avatar_url TEXT,
          cover_image_url TEXT,
          created_by INTEGER NOT NULL,
          type TEXT DEFAULT 'public',
          join_policy TEXT DEFAULT 'open',
          is_active BOOLEAN DEFAULT 1,
          member_count INTEGER DEFAULT 0,
          post_count INTEGER DEFAULT 0,
          created_at DATETIME DEFAULT (datetime('now', 'localtime')),
          updated_at DATETIME DEFAULT (datetime('now', 'localtime')),
          FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
        )`);

                console.log('3. 清洗并同步旧数据...');
                // 去除圈子名字里的圈
                db.run(`UPDATE topics SET name = SUBSTR(name, 1, LENGTH(name) - 1) WHERE name LIKE '%圈'`);

                // 构建新圈子
                db.run(`
          INSERT INTO new_communities (id, topic_id, name, description, tags, avatar_url, cover_image_url, created_by, type, join_policy, is_active, member_count, post_count, created_at, updated_at)
          SELECT 
              id, 
              id AS topic_id,
              name, 
              description, 
              NULL AS tags, 
              avatar_url, 
              NULL AS cover_image_url, 
              created_by, 
              CASE WHEN is_private = 1 THEN 'private' ELSE 'public' END AS type, 
              'open' AS join_policy, 
              is_active, 
              0 AS member_count, 
              0 AS post_count, 
              created_at, 
              datetime('now', 'localtime') AS updated_at
          FROM topics
        `);
                db.run(`DROP TABLE communities`);
                db.run(`ALTER TABLE new_communities RENAME TO communities`);
                db.run(`CREATE INDEX idx_communities_name ON communities(name)`);
                db.run(`CREATE INDEX idx_communities_created_by ON communities(created_by)`);
                db.run(`CREATE INDEX idx_communities_type ON communities(type)`);
                db.run(`CREATE INDEX idx_communities_join_policy ON communities(join_policy)`);
                db.run(`CREATE INDEX idx_communities_is_active ON communities(is_active)`);
                db.run(`CREATE INDEX idx_communities_created_at ON communities(created_at)`);

                console.log('4. 重新同步组成员...');
                db.run(`DELETE FROM community_members`);
                db.run(`
          INSERT INTO community_members (community_id, user_id, role, status, joined_at)
          SELECT 
              topic_id AS community_id,
              user_id,
              CASE 
                  WHEN role = 'creator' THEN 'owner'
                  WHEN role = 'admin' THEN 'admin'
                  ELSE 'member' 
              END AS role,
              'active' AS status,
              joined_at
          FROM topic_members
        `);

                console.log('5. 更新组成员总数...');
                db.run(`
          UPDATE communities 
          SET member_count = (
              SELECT COUNT(*) 
              FROM community_members 
              WHERE community_members.community_id = communities.id
          )
        `);

                db.run('COMMIT;', (err) => {
                    if (err) {
                        console.error('提交事务失败:', err);
                        db.run('ROLLBACK;');
                        reject(err);
                    } else {
                        console.log('✅ 数据迁移和表结构重建完成！');
                        resolve();
                    }
                });
            } catch (err) {
                console.error('执行脚本时出错:', err);
                db.run('ROLLBACK;');
                reject(err);
            }
        });
    });
}

runMigration()
    .then(() => process.exit(0))
    .catch(err => {
        console.error(err);
        process.exit(1);
    });
