const { broadcastMessage } = require('./mqtt');
const time = require('../utils/time');
const { Friend, User } = require('../models');

/**
 * 好友服务，用于处理好友相关的业务逻辑
 */
class FriendService {
  /**
   * 发送好友请求通知
   * @param {number} fromUserId - 请求发起者ID
   * @param {number} toUserId - 请求接收者ID
   * @param {object} requestDetails - 请求详细信息
   */
  static async notifyFriendRequest(fromUserId, toUserId, requestDetails) {
    try {
      // 获取发起者信息
      const fromUser = await User.findById(fromUserId);
      if (!fromUser) {
        throw new Error('发起者用户不存在');
      }

      // 构造通知消息
      const notification = {
        type: 'friend_request',
        subtype: 'new_request',
        fromUserId: fromUser.id,
        fromUserName: fromUser.username,
        requestId: requestDetails.id,
        message: `${fromUser.username} 向您发送了好友请求`,
        timestamp: time.now().toISOString(),
        createdAt: time.currentDbString()
      };

      // 广播给接收者
      broadcastMessage({
        ...notification,
        messageType: 'notification',
        receiver_id: toUserId,
        sender_id: fromUserId
      });

      return { success: true, message: '好友请求通知已发送' };
    } catch (error) {
      console.error('发送好友请求通知失败:', error);
      throw error;
    }
  }

  /**
   * 发送好友请求接受通知
   * @param {number} accepterId - 接受者ID
   * @param {number} requesterId - 请求发起者ID
   */
  static async notifyFriendRequestAccepted(accepterId, requesterId) {
    try {
      // 获取接受者信息
      const accepterUser = await User.findById(accepterId);
      if (!accepterUser) {
        throw new Error('接受者用户不存在');
      }

      // 获取请求发起者信息
      const requesterUser = await User.findById(requesterId);
      if (!requesterUser) {
        throw new Error('请求发起者用户不存在');
      }

      // 构造通知消息
      const notification = {
        type: 'friend_request',
        subtype: 'accepted',
        accepterId: accepterUser.id,
        accepterName: accepterUser.username,
        requesterId: requesterId,
        requesterName: requesterUser.username,
        message: `${accepterUser.username} 接受了您的好友请求，你们现在是好友了！`,
        timestamp: time.now().toISOString(),
        createdAt: time.currentDbString()
      };

      // 广播给请求发起者
      broadcastMessage({
        ...notification,
        messageType: 'notification',
        receiver_id: requesterId,
        sender_id: accepterId
      });

      return { success: true, message: '好友请求接受通知已发送' };
    } catch (error) {
      console.error('发送好友请求接受通知失败:', error);
      throw error;
    }
  }

  /**
   * 发送好友请求拒绝通知
   * @param {number} rejecterId - 拒绝者ID
   * @param {number} requesterId - 请求发起者ID
   */
  static async notifyFriendRequestRejected(rejecterId, requesterId) {
    try {
      // 获取拒绝者信息
      const rejecterUser = await User.findById(rejecterId);
      if (!rejecterUser) {
        throw new Error('拒绝者用户不存在');
      }

      // 获取请求发起者信息
      const requesterUser = await User.findById(requesterId);
      if (!requesterUser) {
        throw new Error('请求发起者用户不存在');
      }

      // 构造通知消息
      const notification = {
        type: 'friend_request',
        subtype: 'rejected',
        rejecterId: rejecterUser.id,
        rejecterName: rejecterUser.username,
        requesterId: requesterId,
        requesterName: requesterUser.username,
        message: `${rejecterUser.username} 拒绝了您的好友请求`,
        timestamp: time.now().toISOString(),
        createdAt: time.currentDbString()
      };

      // 广播给请求发起者
      broadcastMessage({
        ...notification,
        messageType: 'notification',
        receiver_id: requesterId,
        sender_id: rejecterId
      });

      return { success: true, message: '好友请求拒绝通知已发送' };
    } catch (error) {
      console.error('发送好友请求拒绝通知失败:', error);
      throw error;
    }
  }

  /**
   * 发送好友删除通知
   * @param {number} removerId - 删除好友者ID
   * @param {number} removedId - 被删除者ID
   */
  static async notifyFriendRemoved(removerId, removedId) {
    try {
      // 获取删除好友者信息
      const removerUser = await User.findById(removerId);
      if (!removerUser) {
        throw new Error('删除好友者用户不存在');
      }

      // 获取被删除者信息
      const removedUser = await User.findById(removedId);
      if (!removedUser) {
        throw new Error('被删除者用户不存在');
      }

      // 构造通知消息
      const notification = {
        type: 'friend_removed',
        removerId: removerUser.id,
        removerName: removerUser.username,
        removedId: removedId,
        removedName: removedUser.username,
        message: `${removerUser.username} 将您从好友列表中删除`,
        timestamp: time.now().toISOString(),
        createdAt: time.currentDbString()
      };

      // 广播给被删除者
      broadcastMessage({
        ...notification,
        messageType: 'notification',
        receiver_id: removedId,
        sender_id: removerId
      });

      return { success: true, message: '好友删除通知已发送' };
    } catch (error) {
      console.error('发送好友删除通知失败:', error);
      throw error;
    }
  }

  /**
   * 检查两个用户是否为好友
   * @param {number} userId1 - 用户1 ID
   * @param {number} userId2 - 用户2 ID
   * @returns {boolean} 是否为好友
   */
  static async checkIfFriends(userId1, userId2) {
    try {
      return await Friend.areFriends(userId1, userId2);
    } catch (error) {
      console.error('检查好友关系失败:', error);
      return false;
    }
  }

  /**
   * 获取好友总数
   * @param {number} userId - 用户ID
   * @returns {number} 好友总数
   */
  static async getFriendCount(userId) {
    try {
      return await Friend.getFriendCount(userId);
    } catch (error) {
      console.error('获取好友总数失败:', error);
      return 0;
    }
  }

  /**
   * 获取待处理好友请求数
   * @param {number} userId - 用户ID
   * @returns {number} 待处理好友请求数
   */
  static async getPendingRequestCount(userId) {
    try {
      return await Friend.getPendingRequestCount(userId);
    } catch (error) {
      console.error('获取待处理好友请求数失败:', error);
      return 0;
    }
  }
}

module.exports = FriendService;