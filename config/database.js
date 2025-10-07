const sqlite3 = require('sqlite3').verbose();
const config = require('./index');

const db = new sqlite3.Database(config.database.path, (err) => {
  if (err) {
    console.error('Error opening database:', err);
  } else {
    console.log('Connected to chat database');
    // 设置数据库使用本地时区
    db.run("PRAGMA foreign_keys = ON");
    db.run("PRAGMA encoding = 'UTF-8'");
  }
});

module.exports = db;