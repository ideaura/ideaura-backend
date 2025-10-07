#!/usr/bin/env node

// 强制设置时区为亚洲/上海 (UTC+8)
process.env.TZ = 'Asia/Shanghai';

console.log(`🚀 启动聊天服务器`);
console.log(`⏰ 时区设置: ${process.env.TZ}`);
console.log(`📅 当前时间: ${new Date().toString()}`);
console.log(`🌐 UTC时间: ${new Date().toUTCString()}`);
console.log(`📍 本地时间: ${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}`);

// 验证时区设置
const now = new Date();
console.log(`⚙️  时区偏移: ${now.getTimezoneOffset()}分钟`);

// 启动应用
require('./app');