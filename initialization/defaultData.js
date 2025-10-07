const db = require('../config/database');

function initializeDefaultRooms() {
  return new Promise((resolve, reject) => {
    db.get("SELECT COUNT(*) as count FROM rooms", (err, row) => {
      if (err) {
        console.error("检查聊天室错误:", err);
        reject(err);
        return;
      }
      
      if (row.count === 0) {
        const defaultRooms = [
          { name: '公共聊天室', description: '欢迎来到公共聊天室' },
          { name: '技术交流', description: '技术讨论区' },
          { name: '休闲娱乐', description: '闲聊区' }
        ];
        
        let inserted = 0;
        defaultRooms.forEach(room => {
          db.run(
            "INSERT INTO rooms (name, description) VALUES (?, ?)",
            [room.name, room.description],
            function(err) {
              if (err) {
                console.error("插入聊天室错误:", err);
                reject(err);
                return;
              }
              inserted++;
              if (inserted === defaultRooms.length) {
                console.log("默认聊天室已创建");
                resolve();
              }
            }
          );
        });
      } else {
        console.log("聊天室已存在，跳过创建默认聊天室");
        resolve();
      }
    });
  });
}

module.exports = { initializeDefaultRooms };