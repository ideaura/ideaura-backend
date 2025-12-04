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
    broker: process.env.MQTT_BROKER || 'wss://api-cofe.allons-y.uk:3009',
    topic: 'yunhu-chat/broadcast'
  },
  email: {
    host: process.env.SMTP_HOST || 'smtp.mail.me.com',
    port: process.env.SMTP_PORT || 587,
    secure: true,
    auth: {
      user: process.env.SMTP_USER || 'ybrinpds@icloud.com',
      pass: process.env.SMTP_PASS || 'xxx'
    },
    from: process.env.SMTP_USER || 'ybrinpds@icloud.com'
  },
  ssl: {
    enabled: process.env.SSL_ENABLED || 'true',
    keyPath: process.env.SSL_KEY_PATH || './ssl/api-cofe-allons-y-uk-1102130026_key.key',
    certPath: process.env.SSL_CERT_PATH || './ssl/api-cofe-allons-y-uk-1102130026_chain.pem'
    // 注意：CA证书是可选的，如果不需要可以不设置
    // caPath: process.env.SSL_CA_PATH || './ssl/ca.crt'
  },
  app: {
    name: '花枫咖啡馆',
    baseUrl: process.env.BASE_URL || 'https://api-cofe.allons-y.uk:3009'
  }
};