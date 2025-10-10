const db = require('../config/database');

// 为现有的topic_members表添加role字段
db.serialize(() => {
  console.log("开始检查 topic_members 表结构...");
  
  // 首先检查表是否存在
  db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='topic_members'", (err, tableRow) => {
    if (err) {
      console.error("检查表是否存在错误:", err);
      process.exit(1);
    }
    
    if (!tableRow) {
      console.log("topic_members 表不存在，无需迁移");
      process.exit(0);
    }
    
    // 检查 role 列是否存在
    db.all("PRAGMA table_info(topic_members)", (err, rows) => {
      if (err) {
        console.error("检查表结构错误:", err);
        process.exit(1);
      }
      
      console.log("当前 topic_members 表结构:", rows);
      
      const hasRoleColumn = rows.some(row => row.name === 'role');
      
      if (!hasRoleColumn) {
        console.log("添加 role 列...");
        // SQLite 不支持直接添加带默认值的列，我们需要重建表
        addRoleColumnToTopicMembers();
      } else {
        console.log("role 列已存在");
        // 更新现有成员的角色：创建者设为'creator'，其他设为'member'
        updateExistingMembersRole();
      }
    });
  });
});

function addRoleColumnToTopicMembers() {
  console.log("开始添加 role 列到 topic_members 表...");
  
  db.serialize(() => {
    // 开始事务
    db.run("BEGIN TRANSACTION");
    
    // 1. 重命名原表
    db.run("ALTER TABLE topic_members RENAME TO topic_members_old", (err) => {
      if (err) {
        console.error("重命名表错误:", err);
        db.run("ROLLBACK");
        process.exit(1);
      }
      
      // 2. 创建新表（包含role列）
      db.run(`CREATE TABLE topic_members (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        topic_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        role TEXT DEFAULT 'member',
        joined_at DATETIME DEFAULT (datetime('now', 'localtime')),
        FOREIGN KEY (topic_id) REFERENCES topics(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )`, (err) => {
        if (err) {
          console.error("创建新表错误:", err);
          db.run("ROLLBACK");
          process.exit(1);
        }
        
        // 3. 复制数据
        db.run(`INSERT INTO topic_members (id, topic_id, user_id, joined_at)
                SELECT id, topic_id, user_id, joined_at FROM topic_members_old`, (err) => {
          if (err) {
            console.error("复制数据错误:", err);
            db.run("ROLLBACK");
            process.exit(1);
          }
          
          // 4. 删除旧表
          db.run("DROP TABLE topic_members_old", (err) => {
            if (err) {
              console.error("删除旧表错误:", err);
              db.run("ROLLBACK");
              process.exit(1);
            }
            
            // 5. 提交事务
            db.run("COMMIT", (err) => {
              if (err) {
                console.error("提交事务错误:", err);
                process.exit(1);
              }
              
              console.log("✅ role 列添加成功");
              // 更新现有成员的角色
              updateExistingMembersRole();
            });
          });
        });
      });
    });
  });
}

function updateExistingMembersRole() {
  console.log("开始更新现有成员的角色...");
  
  // 获取所有话题及其创建者
  db.all("SELECT id, created_by FROM topics", (err, topics) => {
    if (err) {
      console.error("获取话题列表错误:", err);
      process.exit(1);
    }
    
    if (topics.length === 0) {
      console.log("没有话题需要更新");
      process.exit(0);
    }
    
    console.log(`找到 ${topics.length} 个话题需要更新`);
    
    let processedTopics = 0;
    
    topics.forEach(topic => {
      // 将话题创建者设为'creator'
      db.run(
        "UPDATE topic_members SET role = 'creator' WHERE topic_id = ? AND user_id = ?",
        [topic.id, topic.created_by],
        (err) => {
          if (err) {
            console.error(`更新话题 ${topic.id} 的创建者角色错误:`, err);
          } else {
            console.log(`更新话题 ${topic.id} 的创建者 ${topic.created_by} 角色为 creator`);
          }
          
          processedTopics++;
          if (processedTopics === topics.length) {
            console.log("✅ 所有成员角色更新完成");
            // 设置默认角色为'member'
            setDefaultRoleForMember();
          }
        }
      );
    });
  });
}

function setDefaultRoleForMember() {
  console.log("设置默认角色为 'member'...");
  
  db.run("UPDATE topic_members SET role = 'member' WHERE role IS NULL OR role = ''", (err) => {
    if (err) {
      console.error("设置默认角色错误:", err);
    } else {
      console.log("✅ 默认角色设置完成");
    }
    process.exit(0);
  });
}

// 处理未捕获的异常
process.on('uncaughtException', (err) => {
  console.error('未捕获的异常:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('未处理的 Promise 拒绝:', reason);
  process.exit(1);
});