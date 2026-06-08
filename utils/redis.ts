/**
 * Redis 客户端单例 + 缓存封装工具
 *
 * 优雅降级：Redis 不可用时所有读方法返回 null/false/空数组，
 * 写方法静默忽略，不抛异常，不影响主服务运行。
 */
import Redis from 'ioredis';

const config = await import('../config/index.ts');
const redisConfig = config.default.redis;

let client: Redis | null = null;
let enabled = false;

export async function init(): Promise<void> {
  if (enabled) return;
  if (client) return;

  return new Promise((resolve) => {
    try {
      client = new Redis(redisConfig);

      client.on('ready', () => {
        enabled = true;
        console.log('Redis 已连接');
        resolve();
      });

      client.on('error', (err: Error) => {
        if (!enabled) {
          console.error('Redis 连接失败，缓存功能不可用:', err.message);
          enabled = false;
          resolve();
        } else {
          console.error('Redis 运行时错误:', err.message);
        }
      });

      setTimeout(() => {
        if (!enabled) {
          console.error('Redis 连接超时，降级运行');
          resolve();
        }
      }, 3000);
    } catch (err) {
      console.error('Redis 初始化异常:', (err as Error).message);
      enabled = false;
      resolve();
    }
  });
}

export function isReady(): boolean {
  return enabled;
}

export function getClient(): Redis {
  if (!enabled || !client) throw new Error('Redis 不可用');
  return client;
}

// ---------- 基础 String 操作 ----------

export async function get(key: string): Promise<string | null> {
  if (!enabled || !client) return null;
  try { return await client.get(key); } catch (e) { logError('get', e); return null; }
}

export async function set(key: string, value: string, ttlSeconds?: number): Promise<boolean> {
  if (!enabled || !client) {
    console.warn(`[Redis] set(${key}) 跳过：Redis 不可用`);
    return false;
  }
  try {
    if (ttlSeconds && ttlSeconds > 0) {
      await client.set(key, value, 'EX', ttlSeconds);
    } else {
      await client.set(key, value);
    }
    return true;
  } catch (e) { logError('set', e); return false; }
}

export async function del(key: string): Promise<void> {
  if (!enabled || !client) return;
  try { await client.del(key); } catch (e) { logError('del', e); }
}

export async function exists(key: string): Promise<boolean> {
  if (!enabled || !client) return false;
  try { const r = await client.exists(key); return r === 1; } catch (e) { logError('exists', e); return false; }
}

// ---------- JSON 便捷方法 ----------

export async function getJson<T = unknown>(key: string): Promise<T | null> {
  const raw = await get(key);
  if (raw === null) return null;
  try { return JSON.parse(raw) as T; } catch { return null; }
}

export async function setJson<T = unknown>(key: string, value: T, ttlSeconds?: number): Promise<boolean> {
  if (!enabled || !client) {
    console.warn(`[Redis] setJson(${key}) 跳过：Redis 不可用`);
    return false;
  }
  try {
    return await set(key, JSON.stringify(value), ttlSeconds);
  } catch (e) { logError('setJson', e); return false; }
}

// ---------- Set 操作 ----------

export async function setAdd(key: string, member: string): Promise<void> {
  if (!enabled || !client) return;
  try { await client.sadd(key, member); } catch (e) { logError('setAdd', e); }
}

export async function setRemove(key: string, member: string): Promise<void> {
  if (!enabled || !client) return;
  try { await client.srem(key, member); } catch (e) { logError('setRemove', e); }
}

export async function setMembers(key: string): Promise<string[]> {
  if (!enabled || !client) return [];
  try { return await client.smembers(key); } catch (e) { logError('setMembers', e); return []; }
}

export async function setHas(key: string, member: string): Promise<boolean> {
  if (!enabled || !client) return false;
  try { const r = await client.sismember(key, member); return r === 1; } catch (e) { logError('setHas', e); return false; }
}

export async function setSize(key: string): Promise<number> {
  if (!enabled || !client) return 0;
  try { return await client.scard(key); } catch (e) { logError('setSize', e); return 0; }
}

// ---------- 优雅关闭 ----------

export async function close(): Promise<void> {
  if (client) {
    try { await client.quit(); } catch (e) { console.debug('[redis] 关闭连接失败:', (e as Error).message); }
    enabled = false;
    console.log('Redis 连接已关闭');
  }
}

function logError(op: string, err: unknown): void {
  console.error(`Redis ${op} 错误:`, (err as Error).message);
}
