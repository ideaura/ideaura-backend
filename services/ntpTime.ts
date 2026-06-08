import dgram from 'node:dgram';
import time from '../utils/time.ts';

class NTPClient {
  servers: string[];
  port: number;
  timeOffset: number;
  lastSync: Date | null;
  syncInterval: number;
  private offsetHistory: number[];
  private historySize: number;
  private syncIntervalId: ReturnType<typeof setInterval> | null;

  constructor(servers: string[] = ['ntp.ntsc.ac.cn', 'ntp.aliyun.com', 'time.apple.com', 'time.google.com'], port: number = 123) {
    this.servers = servers;
    this.port = port;
    this.timeOffset = 0;
    this.lastSync = null;
    this.syncInterval = 60 * 60 * 1000;
    this.offsetHistory = [];
    this.historySize = 5;
    this.syncIntervalId = null;
  }

  private ntpToMillis(ntpSeconds: number, ntpFraction: number): number {
    return (ntpSeconds - 2208988800) * 1000 + (ntpFraction / 4294967296) * 1000;
  }

  private millisToNtp(timestamp: number): { seconds: number; fraction: number } {
    const ntpEpoch = 2208988800;
    return {
      seconds: Math.floor(timestamp / 1000) + ntpEpoch,
      fraction: Math.round((timestamp % 1000) / 1000 * 4294967296)
    };
  }

  private calculateMedianOffset(newOffset: number): number {
    this.offsetHistory.push(newOffset);
    if (this.offsetHistory.length > this.historySize) this.offsetHistory.shift();
    const sorted = [...this.offsetHistory].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
  }

  private syncWithServer(server: string): Promise<number> {
    return new Promise((resolve, reject) => {
      const socket = dgram.createSocket('udp4');
      const timeout = setTimeout(() => { socket.close(); reject(new Error(`NTP同步超时: ${server}`)); }, 3000);

      socket.on('message', (msg: Buffer) => {
        clearTimeout(timeout);
        try {
          const originateTimestamp = this.millisToNtp(Date.now() - this.timeOffset);
          const receiveTimestamp = { seconds: msg.readUInt32BE(32), fraction: msg.readUInt32BE(36) };
          const transmitTimestamp = { seconds: msg.readUInt32BE(40), fraction: msg.readUInt32BE(44) };
          const t4 = this.millisToNtp(Date.now());
          const offset = ((receiveTimestamp.seconds - originateTimestamp.seconds) + (transmitTimestamp.seconds - t4.seconds)) / 2 * 1000;
          socket.close();
          resolve(offset);
        } catch (error) { socket.close(); reject(error); }
      });

      socket.on('error', (err: Error) => { clearTimeout(timeout); socket.close(); reject(err); });

      const buffer = Buffer.alloc(48);
      buffer[0] = 0x1B;
      socket.send(buffer, 0, buffer.length, this.port, server, (err?: Error) => {
        if (err) { clearTimeout(timeout); socket.close(); reject(err); }
      });
    });
  }

  async sync(): Promise<number> {
    for (const server of this.servers) {
      try {
        const offset = await this.syncWithServer(server);
        this.timeOffset = this.calculateMedianOffset(offset);
        this.lastSync = new Date();
        console.log(`✅ NTP时间同步成功: ${server} | 偏移: ${offset.toFixed(2)}ms | 平滑: ${this.timeOffset.toFixed(2)}ms`);
        return this.timeOffset;
      } catch (err) { console.warn(`⚠️ NTP 同步失败 (${server}):`, (err as Error).message); }
    }
    console.error('❌ 所有NTP服务器同步均失败');
    return this.timeOffset;
  }

  getStatus() {
    return {
      servers: this.servers, lastSync: this.lastSync, timeOffset: this.timeOffset,
      isSynced: this.lastSync !== null, historySize: this.offsetHistory.length
    };
  }

  startAutoSync(): void {
    console.log(`🕐 启动NTP自动时间同步，服务器: ${this.servers.join(', ')}`);
    this.sync().catch(err => console.error('首次NTP同步抛错:', err));
    this.syncIntervalId = setInterval(() => this.sync().catch(err => console.error('定时NTP同步抛错:', err)), this.syncInterval);
  }

  stopAutoSync(): void {
    if (this.syncIntervalId) { clearInterval(this.syncIntervalId); console.log('🛑 NTP自动时间同步已停止'); }
  }
}

const ntpClient = new NTPClient();
export default ntpClient;
