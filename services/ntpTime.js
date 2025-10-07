const dgram = require('dgram');
const { getCurrentTimestamp } = require('../utils/timezone');

class NTPClient {
  constructor(server = 'ntp.ntsc.ac.cn', port = 123) {
    this.server = server;
    this.port = port;
    this.timeOffset = 0; // 服务器时间与本地时间的偏移（毫秒）
    this.lastSync = null;
    this.syncInterval = 60 * 60 * 1000; // 每小时同步一次
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

  // 同步NTP时间
  sync() {
    return new Promise((resolve, reject) => {
      const socket = dgram.createSocket('udp4');
      const timeout = 5000; // 5秒超时

      const timeoutId = setTimeout(() => {
        socket.close();
        reject(new Error('NTP同步超时'));
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
          
          this.timeOffset = offset;
          this.lastSync = new Date();
          
          console.log(`✅ NTP时间同步成功: ${this.server}`);
          console.log(`   时间偏移: ${offset.toFixed(2)}ms`);
          console.log(`   服务器时间: ${new Date(Date.now() + offset).toLocaleString('zh-CN')}`);
          
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

      socket.send(buffer, 0, buffer.length, this.port, this.server, (err) => {
        if (err) {
          clearTimeout(timeoutId);
          socket.close();
          reject(err);
        }
      });
    });
  }

  // 获取校准后的时间
  getCalibratedTime() {
    return new Date(Date.now() + this.timeOffset);
  }

  // 开始定期同步
  startAutoSync() {
    console.log(`🕐 启动NTP自动时间同步: ${this.server}`);
    
    // 立即同步一次
    this.sync().catch(err => {
      console.warn('首次NTP同步失败:', err.message);
    });

    // 设置定时同步
    this.syncIntervalId = setInterval(() => {
      this.sync().catch(err => {
        console.warn('定时NTP同步失败:', err.message);
      });
    }, this.syncInterval);
  }

  // 停止同步
  stopAutoSync() {
    if (this.syncIntervalId) {
      clearInterval(this.syncIntervalId);
      console.log('🛑 NTP自动时间同步已停止');
    }
  }

  // 获取同步状态
  getStatus() {
    return {
      server: this.server,
      lastSync: this.lastSync,
      timeOffset: this.timeOffset,
      isSynced: this.lastSync !== null,
      calibratedTime: this.getCalibratedTime()
    };
  }
}

// 创建全局NTP客户端实例
const ntpClient = new NTPClient();

module.exports = ntpClient;