const path = require('path');
const fs = require('fs');

// 确保数据目录存在
const dbDir = './data';
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
  console.log('Created data directory');
}

module.exports = {
  port: process.env.PORT || 3009,
  jwtSecret: process.env.JWT_SECRET || 'XXX',
  database: {
    path: './data/chat.db'
  },
  mqtt: {
    broker: process.env.MQTT_BROKER || 'mqtt://mqtt.allons-y.uk:1883',
    topic: 'yunhu-chat/broadcast'
  },
  email: {
    host: process.env.SMTP_HOST || 'smtp.xxx',
    port: process.env.SMTP_PORT || 587,
    secure: false,
    auth: {
      user: process.env.SMTP_USER || 'xxx@xxx',
      pass: process.env.SMTP_PASS || 'xxx'
    },
    from: process.env.SMTP_USER || 'xxx@xxx'
  },
  app: {
    name: '花枫咖啡馆',
    baseUrl: process.env.BASE_URL || 'https://api-chatroom.allons-y.uk'
  }
};