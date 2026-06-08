import ntpClient from '../services/ntpTime.ts';

const config = await import('../config/index.ts');
const cfg = config.default;

class TimeManager {
  /**
   * 获取当前 NTP 校准后的时间戳（毫秒）
   */
  nowMs(): number {
    return Date.now() + ntpClient.timeOffset;
  }

  /**
   * 获取当前 NTP 校准后的 Date 对象
   */
  now(): Date {
    return new Date(this.nowMs());
  }

  /**
   * 获取数据库兼容的时间字符串格式
   */
  formatDatabaseTime(date: Date | string | number = this.now()): string {
    const d = new Date(date);
    if (isNaN(d.getTime())) return '';

    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const seconds = String(d.getSeconds()).padStart(2, '0');

    const offset = cfg.timezoneOffset;
    const sign = offset >= 0 ? '+' : '-';
    const absOffset = String(Math.abs(offset)).padStart(2, '0');

    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}${sign}${absOffset}`;
  }

  currentDbString(): string {
    return this.formatDatabaseTime(this.now());
  }

  // --- 兼容原 timezone.js 的方法 ---

  getLocalDateTime(date?: Date): string {
    return this.formatDatabaseTime(date);
  }

  getLocalDate(date?: Date): string {
    return this.formatDatabaseTime(date).substring(0, 10);
  }

  getLocalTime(date?: Date): string {
    return this.formatDatabaseTime(date).substring(11, 19);
  }

  getCurrentTimestamp(): Date {
    return this.now();
  }

  getDatabaseTimeString(date?: Date): string {
    return this.formatDatabaseTime(date);
  }

  parseDatabaseTime(timeString: string | null | undefined): Date | null {
    if (!timeString) return null;
    try {
      if (timeString.includes('T') || timeString.includes('Z')) {
        return new Date(timeString);
      }
      const match = timeString.match(/^(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2}):(\d{2})/);
      if (match) {
        const [, year, month, day, hours, minutes, seconds] = match;
        const date = new Date(Date.UTC(
          parseInt(year),
          parseInt(month) - 1,
          parseInt(day),
          parseInt(hours) - cfg.timezoneOffset,
          parseInt(minutes),
          parseInt(seconds)
        ));
        return date;
      }
      return new Date(timeString);
    } catch (error) {
      console.error('解析时间错误:', error, timeString);
      return new Date(timeString);
    }
  }

  formatLocalTime(date: Date | string | null | undefined, includeTime: boolean = true): string {
    if (!date) return '';
    const d = typeof date === 'string' ? (this.parseDatabaseTime(date) ?? new Date()) : date;
    if (isNaN(d.getTime())) return '无效日期';
    if (!includeTime) {
      return this.formatDatabaseTime(d).substring(0, 10);
    }
    return this.formatDatabaseTime(d);
  }

  formatMessageTime(date: Date | string | null | undefined): string {
    if (!date) return '';
    const d = typeof date === 'string' ? (this.parseDatabaseTime(date) ?? new Date()) : date;
    if (isNaN(d.getTime())) return '无效日期';

    const now = this.now();
    const isToday = d.toDateString() === now.toDateString();
    const isYesterday = new Date(now.getTime() - 24 * 3600 * 1000).toDateString() === d.toDateString();

    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');

    if (isToday) return `${hours}:${minutes}`;
    if (isYesterday) return `昨天 ${hours}:${minutes}`;
    return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 ${hours}:${minutes}`;
  }

  getRelativeTime(date: Date | string | null | undefined): string {
    if (!date) return '';
    const d = typeof date === 'string' ? (this.parseDatabaseTime(date) ?? new Date()) : date;
    if (isNaN(d.getTime())) return '时间错误';

    const diffMs = this.nowMs() - d.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    if (diffSec < 60) return '刚刚';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}分钟前`;
    const diffHour = Math.floor(diffMin / 60);
    if (diffHour < 24) return `${diffHour}小时前`;
    const diffDay = Math.floor(diffHour / 24);
    if (diffDay === 1) return '昨天';
    if (diffDay < 7) return `${diffDay}天前`;
    if (diffDay < 30) return `${Math.floor(diffDay / 7)}周前`;
    if (diffDay < 365) return `${Math.floor(diffDay / 30)}个月前`;
    return `${Math.floor(diffDay / 365)}年前`;
  }

  setProcessTimezone(): void {
    if (cfg.timezoneOffset === 8) {
      process.env.TZ = 'Asia/Shanghai';
      process.env.PGTZ = 'Asia/Shanghai';
    } else {
      const offset = cfg.timezoneOffset;
      const sign = offset >= 0 ? '-' : '+';
      const absOffset = Math.abs(offset);
      process.env.TZ = `Etc/GMT${sign}${absOffset}`;
    }

    if (process.env.TZ) {
      console.log(`时区设置为: ${process.env.TZ} (基于偏移量 ${cfg.timezoneOffset})`);
      console.log(`当前网络校准时间: ${this.currentDbString()}`);
    } else {
      console.warn('时区设置失败，使用系统默认时区');
    }
  }
}

const timeManager = new TimeManager();
export default timeManager;
