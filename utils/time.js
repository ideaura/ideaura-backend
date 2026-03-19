const ntpClient = require('../services/ntpTime');
const config = require('../config');

class TimeManager {
    /**
     * 获取当前 NTP 校准后的时间戳（毫秒）
     */
    nowMs() {
        return Date.now() + ntpClient.timeOffset;
    }

    /**
     * 获取当前 NTP 校准后的 Date 对象
     */
    now() {
        return new Date(this.nowMs());
    }

    /**
     * 获取数据库兼容的时间字符串格式
     * @param {Date|string|number} date 可选时间，不传则使用当前 NTP 时间
     * @returns {string} 格式：YYYY-MM-DD HH:mm:ss
     */
    formatDatabaseTime(date = this.now()) {
        const d = new Date(date);
        if (isNaN(d.getTime())) return null;

        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const hours = String(d.getHours()).padStart(2, '0');
        const minutes = String(d.getMinutes()).padStart(2, '0');
        const seconds = String(d.getSeconds()).padStart(2, '0');

        const offset = config.timezoneOffset;
        const sign = offset >= 0 ? '+' : '-';
        const absOffset = String(Math.abs(offset)).padStart(2, '0');

        return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}${sign}${absOffset}`;
    }

    /**
     * 原用于替代 new Date().toLocaleString()
     */
    currentDbString() {
        return this.formatDatabaseTime(this.now());
    }

    // --- 兼容原 timezone.js 的方法 ---

    getLocalDateTime(date = this.now()) {
        return this.formatDatabaseTime(date);
    }

    getLocalDate(date = this.now()) {
        return this.formatDatabaseTime(date).substring(0, 10);
    }

    getLocalTime(date = this.now()) {
        return this.formatDatabaseTime(date).substring(11, 19);
    }

    getCurrentTimestamp() {
        return this.now();
    }

    getDatabaseTimeString(date = this.now()) {
        return this.formatDatabaseTime(date);
    }

    parseDatabaseTime(timeString) {
        if (!timeString) return null;
        try {
            if (timeString.includes('T') || timeString.includes('Z')) {
                let date = new Date(timeString);
                return date;
            }
            const match = timeString.match(/^(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2}):(\d{2})/);
            if (match) {
                const [, year, month, day, hours, minutes, seconds] = match;
                const date = new Date(Date.UTC(
                    parseInt(year),
                    parseInt(month) - 1,
                    parseInt(day),
                    parseInt(hours) - config.timezoneOffset,
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

    formatLocalTime(date = this.now(), includeTime = true) {
        if (!date) return '';
        const d = typeof date === 'string' ? this.parseDatabaseTime(date) : date;
        if (isNaN(d.getTime())) return '无效日期';
        if (!includeTime) {
            return this.formatDatabaseTime(d).substring(0, 10);
        }
        return this.formatDatabaseTime(d);
    }

    formatMessageTime(date) {
        if (!date) return '';
        const d = typeof date === 'string' ? this.parseDatabaseTime(date) : date;
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

    getRelativeTime(date) {
        if (!date) return '';
        const d = typeof date === 'string' ? this.parseDatabaseTime(date) : date;
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

    setProcessTimezone() {
        // 如果是正数偏移量，例如 +8，对应 Asia/Shanghai 等
        // 这里为了简单，如果偏移量是 8，我们默认设置为 Asia/Shanghai
        if (config.timezoneOffset === 8) {
            process.env.TZ = 'Asia/Shanghai';
            process.env.PGTZ = 'Asia/Shanghai';
        } else {
            // 否则尝试根据偏移量生成 GMT 格式 (注意：Etc/GMT 符号是反的，GMT+8 是 Etc/GMT-8)
            const offset = config.timezoneOffset;
            const sign = offset >= 0 ? '-' : '+';
            const absOffset = Math.abs(offset);
            process.env.TZ = `Etc/GMT${sign}${absOffset}`;
        }

        if (process.env.TZ) {
            console.log(`时区设置为: ${process.env.TZ} (基于偏移量 ${config.timezoneOffset})`);
            console.log(`当前网络校准时间: ${this.currentDbString()}`);
        } else {
            console.warn('时区设置失败，使用系统默认时区');
        }
    }
}

const timeManager = new TimeManager();
module.exports = timeManager;
