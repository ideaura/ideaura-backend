const db = require('../config/database');

// 为现有用户添加注册名次
db.serialize(() => {
  console.log("开始检查 users 表结构...");
  
  // 首先检查表是否存在
  db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='users'", (err, tableRow) => {
    if (err) {
      console.error("检查表是否存在错误:", err);
      process.exit(1);
    }
    
    if (!tableRow) {
      console.log("users 表不存在，无需迁移");
      process.exit(0);
    }
    
    // 检查 registration_order 列是否存在
    db.all("PRAGMA table_info(users)", (err, rows) => {
      if (err) {
        console.error("检查表结构错误:", err);
        process.exit(1);
      }
      
      console.log("当前 users 表结构:", rows);
      
      const hasRegistrationOrder = rows.some(row => row.name === 'registration_order');
      
      if (!hasRegistrationOrder) {
        console.log("添加 registration_order 列...");
        db.run("ALTER TABLE users ADD COLUMN registration_order INTEGER", (err) => {
          if (err) {
            console.error("添加列错误:", err);
            process.exit(1);
          }
          console.log("列添加成功");
          
          // 更新现有用户的注册名次
          updateExistingUsersRegistrationOrder();
        });
      } else {
        console.log("registration_order 列已存在");
        updateExistingUsersRegistrationOrder();
      }
    });
  });
});

function updateExistingUsersRegistrationOrder() {
  console.log("开始更新现有用户的注册名次...");
  
  // 获取所有用户按注册时间排序
  db.all("SELECT id, created_at FROM users ORDER BY created_at ASC", (err, users) => {
    if (err) {
      console.error("获取用户列表错误:", err);
      process.exit(1);
    }
    
    if (users.length === 0) {
      console.log("没有用户需要更新");
      process.exit(0);
    }
    
    console.log(`找到 ${users.length} 个用户需要更新`);
    
    let updatedCount = 0;
    users.forEach((user, index) => {
      const registrationOrder = index + 1;
      
      db.run(
        "UPDATE users SET registration_order = ? WHERE id = ?",
        [registrationOrder, user.id],
        (err) => {
          if (err) {
            console.error(`更新用户 ${user.id} 错误:`, err);
          } else {
            updatedCount++;
            console.log(`更新用户 ${user.id}: 注册名次 ${registrationOrder}`);
          }
          
          if (updatedCount === users.length) {
            console.log(`✅ 已完成 ${updatedCount} 个用户的注册名次更新`);
            process.exit(0);
          }
        }
      );
    });
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