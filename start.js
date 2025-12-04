#!/usr/bin/env node

// 强制设置时区为亚洲/上海 (UTC+8)
process.env.TZ = 'Asia/Shanghai';

console.log(`🚀 启动聊天服务器`);
console.log(`⏰ 时区设置: ${process.env.TZ}`);
console.log(`📅 当前时间: ${new Date().toString()}`);
console.log(`🌐 UTC时间: ${new Date().toUTCString()}`);
console.log(`📍 本地时间: ${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}`);

// 加载环境变量
require('dotenv').config();

// 验证时区设置
const now = new Date();
console.log(`⚙️  时区偏移: ${now.getTimezoneOffset()}分钟`);

// 添加未捕获异常处理
process.on('uncaughtException', (error) => {
  console.error('未捕获的异常:', error);
  console.error('堆栈跟踪:', error.stack);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('未处理的Promise拒绝:', reason);
  console.error('拒绝的Promise:', promise);
  process.exit(1);
});

// 启动应用
const { startServer } = require('./app.js');
console.log('准备启动服务器...');
startServer().then(() => {
  console.log('服务器启动完成');
}).catch((error) => {
  console.error('启动服务器时出错:', error);
  console.error('错误堆栈:', error.stack);
  process.exit(1);
});