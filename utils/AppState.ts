/**
 * 应用全局状态（重构版）
 *
 * - connectedClients: 保留内存 Set（仅存储 clientId 字符串，数量有限）
 * - OIDC 临时存储: 全部迁移到 Redis，利用 TTL 自动过期
 */
import * as redis from './redis.ts';

const OIDC_PREFIX = 'oidc:';

class AppState {
  private connectedClients: Set<string>;

  constructor() {
    this.connectedClients = new Set();
  }

  // --- OIDC 临时存储（Redis 后端）---

  async setOidc(key: string, value: unknown, ttlMs: number = 5 * 60 * 1000): Promise<void> {
    const ttlSeconds = Math.ceil(ttlMs / 1000);
    const ok = await redis.setJson(`${OIDC_PREFIX}${key}`, value, ttlSeconds);
    if (!ok) {
      console.error(`[AppState] OIDC state 存储失败 (key=${key})：Redis 不可用，移动端 OIDC 登录将无法完成回调`);
    }
  }

  async getOidc<T = unknown>(key: string): Promise<T | null> {
    return redis.getJson<T>(`${OIDC_PREFIX}${key}`);
  }

  async deleteOidc(key: string): Promise<void> {
    await redis.del(`${OIDC_PREFIX}${key}`);
  }

  async hasOidc(key: string): Promise<boolean> {
    return redis.exists(`${OIDC_PREFIX}${key}`);
  }

  // --- 连接客户端（保留内存 Set）---

  addClient(clientId: string): void {
    this.connectedClients.add(clientId);
  }

  removeClient(clientId: string): void {
    this.connectedClients.delete(clientId);
  }

  getOnlineCount(): number {
    return this.connectedClients.size;
  }
}

const appState = new AppState();
export default appState;
