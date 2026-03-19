const dgram = require('dgram');
const time = require('../utils/time');

class NTPClient {
  constructor(servers = ['ntp.ntsc.ac.cn', 'ntp.aliyun.com', 'time.apple.com', 'time.google.com'], port = 123) {
    this.servers = Array.isArray(servers) ? servers : [servers];
    this.port = port;
    this.timeOffset = 0; // 服务器时间与本地时间的偏移（毫秒）
    this.lastSync = null;
    this.syncInterval = 60 * 60 * 1000; // 每小时同步一次

    this.offsetHistory = [];
    this.historySize = 5; // 用于计算中位数的数据池大小
  }

  // NTP协议时间转换
  ntpToMillis(ntpSeconds, ntpFraction) {
    const milliseconds = (ntpSeconds - 2208988800) * 1000;
    const fractionMillis = (ntpFraction / 4294967296) * 1000;
    return milliseconds + fractionMillis;
  }

  millisToNtp(timestamp) {
    const ntpEpoch = 2208988800;
    const seconds = Math.floor(timestamp / 1000) + ntpEpoch;
    const fraction = Math.round((timestamp % 1000) / 1000 * 4294967296);
    return { seconds, fraction };
  }

  calculateMedianOffset(newOffset) {
    this.offsetHistory.push(newOffset);
    if (this.offsetHistory.length > this.historySize) {
      this.offsetHistory.shift();
    }
    const sorted = [...this.offsetHistory].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    if (sorted.length % 2 === 0) {
      return (sorted[mid - 1] + sorted[mid]) / 2;
    } else {
      return sorted[mid];
    }
  }

  syncWithServer(server) {
    return new Promise((resolve, reject) => {
      const socket = dgram.createSocket('udp4');
      const timeout = 3000; // 3秒超时

      const timeoutId = setTimeout(() => {
        socket.close();
        reject(new Error(`NTP同步超时: ${server}`));
      }, timeout);

      socket.on('message', (msg) => {
        clearTimeout(timeoutId);
        try {
          // NTP协议解析
          const originateTimestamp = this.millisToNtp(Date.now() - this.timeOffset);
          const receiveTimestamp = {
            seconds: msg.readUInt32BE(32),
            fraction: msg.readUInt32BE(36)
          };
          const transmitTimestamp = {
            seconds: msg.readUInt32BE(40),
            fraction: msg.readUInt32BE(44)
          };

          const t1 = originateTimestamp;
          const t2 = receiveTimestamp;
          const t3 = transmitTimestamp;
          const t4 = this.millisToNtp(Date.now());

          // 计算时间偏移
          const offset = ((t2.seconds - t1.seconds) + (t3.seconds - t4.seconds)) / 2 * 1000;
          socket.close();
          resolve(offset);
        } catch (error) {
          socket.close();
          reject(error);
        }
      });

      socket.on('error', (err) => {
        clearTimeout(timeoutId);
        socket.close();
        reject(err);
      });

      // 发送NTP请求包
      const buffer = Buffer.alloc(48);
      buffer[0] = 0x1B; // LI=0, Version=3, Mode=3 (Client)

      socket.send(buffer, 0, buffer.length, this.port, server, (err) => {
        if (err) {
          clearTimeout(timeoutId);
          socket.close();
          reject(err);
        }
      });
    });
  }

  // 同步NTP时间，带多服务器降级方案
  async sync() {
    for (let i = 0; i < this.servers.length; i++) {
      const server = this.servers[i];
      try {
        const offset = await this.syncWithServer(server);

        // 计算并应用中位数逻辑
        this.timeOffset = this.calculateMedianOffset(offset);
        this.lastSync = new Date(); // 使用系统时间记录最近同步时间即可

        console.log(`✅ NTP时间同步成功: ${server} | 原始偏移: ${offset.toFixed(2)}ms | 平滑偏移(中位数): ${this.timeOffset.toFixed(2)}ms`);
        // 成功则中断重试
        return this.timeOffset;
      } catch (err) {
        console.warn(`⚠️ NTP 同步失败 (${server}): ${err.message}`);
      }
    }

    console.error('❌ 所有NTP服务器同步均失败，平滑降级使用系统原本的流逝时间和最后一次成功的偏移量。');
    // 如果一次同步都没成功过，timeOffset 将保持默认的 0（原系统时间）
    return this.timeOffset;
  }

  // 获取同步状态
  getStatus() {
    return {
      servers: this.servers,
      lastSync: this.lastSync,
      timeOffset: this.timeOffset,
      isSynced: this.lastSync !== null,
      historySize: this.offsetHistory.length
    };
  }

  // 开始定期同步
  startAutoSync() {
    console.log(`🕐 启动NTP自动时间同步，服务器列表: ${this.servers.join(', ')}`);

    // 立即同步一次
    this.sync().catch(err => console.error('首次NTP同步抛错:', err));

    // 设置定时同步
    this.syncIntervalId = setInterval(() => {
      this.sync().catch(err => console.error('定时NTP同步抛错:', err));
    }, this.syncInterval);
  }

  // 停止同步
  stopAutoSync() {
    if (this.syncIntervalId) {
      clearInterval(this.syncIntervalId);
      console.log('🛑 NTP自动时间同步已停止');
    }
  }
}

// 创建全局NTP客户端实例
const ntpClient = new NTPClient();

module.exports = ntpClient;