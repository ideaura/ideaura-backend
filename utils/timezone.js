/**
 * 时区处理工具函数 - UTC+8 中国时区
 */

// 延迟加载ntpClient以避免循环依赖
let ntpClient = null;
function getNtpClient() {
  if (!ntpClient) {
    ntpClient = require('../services/ntpTime');
  }
  return ntpClient;
}

// 设置时区为亚洲/上海 (UTC+8)
const TIMEZONE = 'Asia/Shanghai';
const UTC_OFFSET = 8 * 60 * 60 * 1000; // UTC+8 的毫秒数

// 获取校准后的当前时间（优先使用NTP时间）
function getCalibratedTime() {
  try {
    const client = getNtpClient();
    if (client.getStatus().isSynced) {
      return client.getCalibratedTime();
    }
  } catch (error) {
    // 如果NTP客户端不可用，使用备用方案
    console.warn('NTP客户端不可用，使用系统时间:', error.message);
  }
  // 备用方案：系统时间（不需要额外的时区偏移，因为系统已经是本地时间）
  return new Date();
}

// 获取本地时间字符串（UTC+8）
function getLocalDateTime(date = getCalibratedTime()) {
  try {
    // getCalibratedTime() 已经返回了正确的时间，不需要额外偏移
    return date.toISOString().replace('T', ' ').substring(0, 19);
  } catch (error) {
    console.error('获取本地时间错误:', error);
    // 备用方案
    const now = new Date();
    return now.toISOString().replace('T', ' ').substring(0, 19);
  }
}

// 获取本地日期字符串（YYYY-MM-DD）
function getLocalDate(date = getCalibratedTime()) {
  try {
    // getCalibratedTime() 已经返回了正确的时间，不需要额外偏移
    return date.toISOString().substring(0, 10);
  } catch (error) {
    console.error('获取本地日期错误:', error);
    const now = new Date();
    return now.toISOString().substring(0, 10);
  }
}

// 获取本地时间字符串（HH:MM:SS）
function getLocalTime(date = getCalibratedTime()) {
  try {
    // getCalibratedTime() 已经返回了正确的时间，不需要额外偏移
    return date.toISOString().substring(11, 19);
  } catch (error) {
    console.error('获取本地时间字符串错误:', error);
    const now = new Date();
    return now.toISOString().substring(11, 19);
  }
}

// 从数据库时间字符串转换为本地时间对象（假设数据库存储的是UTC+8时间）
function parseDatabaseTime(timeString) {
  if (!timeString) return null;
  
  try {
    // 如果已经是ISO格式
    if (timeString.includes('T') || timeString.includes('Z')) {
      let date = new Date(timeString);
      // 如果包含Z（UTC时间），转换为UTC+8
      if (timeString.includes('Z')) {
        date = new Date(date.getTime() + UTC_OFFSET);
      }
      return date;
    }
    
    // 处理SQLite的本地时间格式 (YYYY-MM-DD HH:MM:SS)
    // 假设数据库存储的是UTC+8时间
    const datePattern = /^(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2}):(\d{2})/;
    const match = timeString.match(datePattern);
    
    if (match) {
      const [, year, month, day, hours, minutes, seconds] = match;
      // 直接创建UTC+8时间对象
      const date = new Date(Date.UTC(
        parseInt(year),
        parseInt(month) - 1,
        parseInt(day),
        parseInt(hours) - 8, // 调整为UTC时间
        parseInt(minutes),
        parseInt(seconds)
      ));
      return new Date(date.getTime() + UTC_OFFSET);
    }
    
    // 备用方案
    return new Date(timeString);
  } catch (error) {
    console.error('解析时间错误:', error, timeString);
    return new Date(timeString);
  }
}

// 格式化时间为本地字符串
function formatLocalTime(date, includeTime = true) {
  if (!date) return '';
  
  const d = typeof date === 'string' ? parseDatabaseTime(date) : date;
  
  if (isNaN(d.getTime())) {
    console.error('无效的日期:', date);
    return '无效日期';
  }
  
  try {
    // 确保时间是UTC+8
    const localDate = new Date(d.getTime());
    
    const year = localDate.getFullYear();
    const month = String(localDate.getMonth() + 1).padStart(2, '0');
    const day = String(localDate.getDate()).padStart(2, '0');
    
    if (!includeTime) {
      return `${year}-${month}-${day}`;
    }
    
    const hours = String(localDate.getHours()).padStart(2, '0');
    const minutes = String(localDate.getMinutes()).padStart(2, '0');
    const seconds = String(localDate.getSeconds()).padStart(2, '0');
    
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  } catch (error) {
    console.error('格式化时间错误:', error);
    return '时间格式错误';
  }
}

// 格式化消息时间为中文格式（如：2025年11月6日 12:00）
function formatMessageTime(date) {
  if (!date) return '';
  
  const d = typeof date === 'string' ? parseDatabaseTime(date) : date;
  
  if (isNaN(d.getTime())) {
    console.error('无效的日期:', date);
    return '无效日期';
  }
  
  try {
    // 确保时间是UTC+8
    const localDate = new Date(d.getTime());
    
    const now = getCalibratedTime();
    const isToday = localDate.toDateString() === now.toDateString();
    const isYesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000).toDateString() === localDate.toDateString();
    
    const year = localDate.getFullYear();
    const month = localDate.getMonth() + 1;
    const day = localDate.getDate();
    const hours = String(localDate.getHours()).padStart(2, '0');
    const minutes = String(localDate.getMinutes()).padStart(2, '0');
    
    // 如果是今天，只显示时间
    if (isToday) {
      return `${hours}:${minutes}`;
    }
    
    // 如果是昨天，显示"昨天 HH:MM"
    if (isYesterday) {
      return `昨天 ${hours}:${minutes}`;
    }
    
    // 其他日期显示完整格式
    return `${year}年${month}月${day}日 ${hours}:${minutes}`;
  } catch (error) {
    console.error('格式化消息时间错误:', error);
    return '时间格式错误';
  }
}

// 获取当前UTC+8时间戳（用于数据库存储）
function getCurrentTimestamp() {
  return getCalibratedTime();
}

// 获取数据库格式的时间字符串（UTC+8）
function getDatabaseTimeString(date = getCalibratedTime()) {
  const localDate = new Date(date.getTime());
  const year = localDate.getFullYear();
  const month = String(localDate.getMonth() + 1).padStart(2, '0');
  const day = String(localDate.getDate()).padStart(2, '0');
  const hours = String(localDate.getHours()).padStart(2, '0');
  const minutes = String(localDate.getMinutes()).padStart(2, '0');
  const seconds = String(localDate.getSeconds()).padStart(2, '0');
  
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

// 计算相对时间（中文）
function getRelativeTime(date) {
  const now = getCalibratedTime();
  const d = typeof date === 'string' ? parseDatabaseTime(date) : date;
  
  if (isNaN(d.getTime())) {
    return '时间错误';
  }
  
  const diffMs = now - d;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);
  
  if (diffSec < 60) return '刚刚';
  if (diffMin < 60) return `${diffMin}分钟前`;
  if (diffHour < 24) return `${diffHour}小时前`;
  if (diffDay === 1) return '昨天';
  if (diffDay < 7) return `${diffDay}天前`;
  if (diffDay < 30) return `${Math.floor(diffDay / 7)}周前`;
  if (diffDay < 365) return `${Math.floor(diffDay / 30)}个月前`;
  return `${Math.floor(diffDay / 365)}年前`;
}

// 设置系统时区
function setProcessTimezone() {
  // 设置进程的时区
  process.env.TZ = TIMEZONE;
  
  // 验证时区设置
  if (process.env.TZ) {
    console.log(`时区设置为: ${process.env.TZ}`);
    console.log(`当前校准时间: ${formatLocalTime(getCalibratedTime())}`);
  } else {
    console.warn('时区设置失败，使用系统默认时区');
  }
}

module.exports = {
  getLocalDateTime,
  getLocalDate,
  getLocalTime,
  parseDatabaseTime,
  formatLocalTime,
  formatMessageTime,
  getRelativeTime,
  getCurrentTimestamp,
  getDatabaseTimeString,
  getCalibratedTime,
  setProcessTimezone
};