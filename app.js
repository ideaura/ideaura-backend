const express = require('express');
const http = require('http');
const path = require('path');
const cors = require('cors');

// 设置系统时区
const { setProcessTimezone, getCalibratedTime } = require('./utils/timezone');
setProcessTimezone();

// 导入配置
const config = require('./config');
const { initializeDatabase } = require('./initialization/database');
const { initMQTT } = require('./services/mqtt');
const ntpClient = require('./services/ntpTime');

// 导入路由
const routes = require('./routes');

const app = express();
const server = http.createServer(app);

// CORS配置 - 允许任何来源
app.use(cors({
  origin: '*', // 允许任何来源
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  credentials: false // 如果需要发送cookie，设置为true
}));

// 中间件
app.use(express.json());
app.use(express.static('public'));

// 日志中间件
app.use(require('./middleware/logging'));

// 路由
app.use('/api', routes);

// 健康检查端点（包含NTP状态）
app.get('/api/health', (req, res) => {
  const ntpStatus = ntpClient.getStatus();
  const calibratedTime = getCalibratedTime();
  
  res.json({
    success: true,
    data: {
      status: 'OK',
      timestamp: calibratedTime.toISOString(),
      calibratedTime: calibratedTime.toISOString(),
      systemTime: new Date().toISOString(),
      mqttConnected: global.mqttClient ? global.mqttClient.connected : false,
      connectedClients: global.connectedClients ? global.connectedClients.size : 0,
      ntp: {
        server: ntpStatus.server,
        isSynced: ntpStatus.isSynced,
        lastSync: ntpStatus.lastSync,
        timeOffset: ntpStatus.timeOffset
      }
    }
  });
});

// NTP状态检查端点
app.get('/api/ntp-status', (req, res) => {
  const status = ntpClient.getStatus();
  res.json({
    success: true,
    data: status
  });
});

// 启动服务器
async function startServer() {
  try {
    // 启动NTP时间同步
    ntpClient.startAutoSync();
    
    await initializeDatabase();
    console.log('数据库表初始化完成');
    
    await initMQTT();
    console.log('MQTT初始化完成');
    
    server.listen(config.port, '0.0.0.0', () => {
      console.log(`✅ 服务器运行在端口 ${config.port}`);
      console.log(`✅ MQTT Broker: ${config.mqtt.broker}`);
      console.log('✅ 实时消息通过MQTT广播');
      console.log('✅ UTC+8时区模式已启用');
      console.log('✅ NTP时间同步已启动');
    });
  } catch (error) {
    console.error('❌ 服务器启动失败:', error);
    process.exit(1);
  }
}

// 优雅关闭
process.on('SIGINT', () => {
  console.log('正在关闭服务器...');
  
  // 停止NTP同步
  ntpClient.stopAutoSync();
  
  if (global.mqttClient) {
    global.mqttClient.end();
    console.log('MQTT连接已关闭');
  }
  
  const db = require('./config/database');
  db.close((err) => {
    if (err) {
      console.error('关闭数据库错误:', err);
    } else {
      console.log('数据库连接已关闭');
    }
  });
  
  server.close(() => {
    console.log('服务器已关闭');
    process.exit(0);
  });
});

// 启动应用
startServer();

module.exports = app;