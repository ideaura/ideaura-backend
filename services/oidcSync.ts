import { getOIDCClient } from '../utils/oidcClient.ts';
import User from '../models/User.ts';
import * as redis from '../utils/redis.ts';

const SYNC_QUEUE_KEY = 'oidc:sync:queue';

class OidcSyncService {
  private intervalMinutes: number;
  private syncInterval: ReturnType<typeof setInterval> | null = null;
  private isRunning = false;

  constructor(intervalMinutes = 60) { this.intervalMinutes = intervalMinutes; }

  async markUserForSync(userId: number): Promise<void> {
    await redis.setAdd(SYNC_QUEUE_KEY, String(userId));
  }

  async syncUserWithOidcData(user: { id: number; username: string; email: string }, oidcUserInfo: Record<string, unknown>): Promise<boolean> {
    try {
      const updateFields: Record<string, string> = {};
      const newUsername = (oidcUserInfo.preferred_username || oidcUserInfo.name || oidcUserInfo.sub) as string | undefined;
      if (newUsername && user.username !== newUsername) { updateFields.username = newUsername; }
      if (oidcUserInfo.email && user.email !== oidcUserInfo.email) { updateFields.email = oidcUserInfo.email as string; }
      if (Object.keys(updateFields).length > 0) { await User.update(user.id, updateFields); }
      return true;
    } catch { return false; }
  }

  async processSyncQueue(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;
    try {
      const members = await redis.setMembers(SYNC_QUEUE_KEY);
      if (!members.length) { this.isRunning = false; return; }
      const client = getOIDCClient();
      for (const uidStr of members) {
        try {
          const uid = parseInt(uidStr);
          const user = await User.findById(uid);
          if (!user) continue;
          // Get userinfo from OIDC provider (no token needed for userinfo endpoint with client credentials)
          const userinfo = await client.userinfo('').catch(() => null);
          if (userinfo) await this.syncUserWithOidcData({ id: user.id, username: user.username, email: user.email }, userinfo);
        } catch (e) { console.warn('[oidcSync] 同步用户失败:', (e as Error).message); }
        await redis.setRemove(SYNC_QUEUE_KEY, uidStr);
      }
    } finally { this.isRunning = false; }
  }

  startSyncService(): void {
    if (this.syncInterval) return;
    this.processSyncQueue();
    this.syncInterval = setInterval(() => this.processSyncQueue(), this.intervalMinutes * 60 * 1000);
    this.syncInterval.unref();
  }

  stopSyncService(): void { if (this.syncInterval) { clearInterval(this.syncInterval); this.syncInterval = null; } }
}

const oidcSyncService = new OidcSyncService();
export default oidcSyncService;
