/**
 * OIDC用户信息同步服务
 * 用于跟踪和管理OIDC用户信息的一致性
 */

const { getOIDCClient } = require('../utils/oidcClient');
const User = require('../models/User');

// 简单的内存存储，用于跟踪需要同步的用户
// 在生产环境中，这应该存储在数据库中
const syncQueue = new Set();

class OidcSyncService {
  constructor(intervalMinutes = 60) {
    this.intervalMinutes = intervalMinutes; // 默认每小时同步一次
    this.syncInterval = null;
    this.isRunning = false;
  }

  /**
   * 标记用户需要同步
   * @param {number} userId - 用户ID
   */
  markUserForSync(userId) {
    syncQueue.add(userId);
    console.log(`🔄 用户 ${userId} 已加入同步队列`);
  }

  /**
   * 同步单个用户的信息（仅在用户登录时有效）
   * @param {Object} user - 本地用户对象
   * @param {Object} oidcUserInfo - 从OIDC提供者获取的用户信息
   * @returns {Promise<boolean>} - 同步是否成功
   */
  async syncUserWithOidcData(user, oidcUserInfo) {
    try {
      console.log(`🔄 同步用户 ${user.id} (${user.username}) 的OIDC信息...`);

      const updateFields = {};
      
      // 检查并更新用户名
      const newUsername = oidcUserInfo.preferred_username || oidcUserInfo.name || oidcUserInfo.sub;
      if (user.username !== newUsername) {
        updateFields.username = newUsername;
        console.log(`🔄 用户 ${user.id} 的用户名已更新: ${user.username} -> ${newUsername}`);
      }
      
      // 检查并更新邮箱（如果OIDC提供者提供了邮箱变更）
      if (oidcUserInfo.email && user.email !== oidcUserInfo.email) {
        updateFields.email = oidcUserInfo.email;
        console.log(`🔄 用户 ${user.id} 的邮箱已更新: ${user.email} -> ${oidcUserInfo.email}`);
      }
      
      // 如果有任何字段需要更新
      if (Object.keys(updateFields).length > 0) {
        await User.update(user.id, updateFields);
        console.log(`🔄 已更新用户 ${user.id} 的信息以保持与OIDC提供者一致`);
        
        // 从同步队列中移除用户
        syncQueue.delete(user.id);
        
        return true;
      } else {
        console.log(`✅ 用户 ${user.id} 的信息已是最新，无需更新`);
        // 从同步队列中移除用户
        syncQueue.delete(user.id);
        return true;
      }
    } catch (error) {
      console.error(`❌ 同步用户 ${user.id} 信息失败:`, error);
      return false;
    }
  }

  /**
   * 获取需要同步的用户列表
   * @returns {Array<number>} - 需要同步的用户ID数组
   */
  getUsersPendingSync() {
    return Array.from(syncQueue);
  }

  /**
   * 启动定期同步服务
   */
  startSyncService() {
    if (this.isRunning) {
      console.log('🔄 OIDC同步服务已在运行中');
      return;
    }

    console.log(`🔄 启动OIDC用户信息同步服务，间隔: ${this.intervalMinutes} 分钟`);
    
    // 设置定期清理过期同步标记
    this.syncInterval = setInterval(() => {
      console.log(`📊 当前待同步用户数: ${syncQueue.size}`);
      if (syncQueue.size > 0) {
        console.log(`📋 待同步用户ID: [${Array.from(syncQueue).join(', ')}]`);
      }
    }, this.intervalMinutes * 60 * 1000);

    this.isRunning = true;
    console.log('✅ OIDC同步服务已启动');
  }

  /**
   * 停止同步服务
   */
  stopSyncService() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
      this.isRunning = false;
      console.log('✅ OIDC同步服务已停止');
    }
  }
}

// 导出单例
const oidcSyncService = new OidcSyncService();
module.exports = oidcSyncService;

// 如果直接运行此文件，则启动服务
if (require.main === module) {
  console.log('🔧 手动启动OIDC同步服务进行测试...');
  oidcSyncService.startSyncService();
  
  // 30秒后停止服务
  setTimeout(() => {
    oidcSyncService.stopSyncService();
    process.exit(0);
  }, 30000);
}