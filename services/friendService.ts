import { broadcastMessage } from './mqtt.ts';
import time from '../utils/time.ts';
import { Friend, User } from '../models/index.ts';

class FriendService {
  static async notifyFriendRequest(fromUserId: number, toUserId: number, requestDetails: { id: number }): Promise<{ success: boolean; message: string }> {
    const fromUser = await User.findById(fromUserId);
    if (!fromUser) throw new Error('发起者用户不存在');
    const notification = {
      type: 'friend_request', subtype: 'new_request', fromUserId: fromUser.id, fromUserName: fromUser.username,
      requestId: requestDetails.id, message: `${fromUser.username} 向您发送了好友请求`,
      timestamp: time.now().toISOString(), createdAt: time.currentDbString()
    };
    await broadcastMessage({ ...notification, messageType: 'notification', receiver_id: toUserId, sender_id: fromUserId });
    return { success: true, message: '好友请求通知已发送' };
  }

  static async notifyFriendRequestAccepted(accepterId: number, requesterId: number): Promise<{ success: boolean; message: string }> {
    const a = await User.findById(accepterId); if (!a) throw new Error('接受者不存在');
    const r = await User.findById(requesterId); if (!r) throw new Error('请求者不存在');
    const n = { type: 'friend_request', subtype: 'accepted', accepterId: a.id, accepterName: a.username, requesterId, requesterName: r.username, message: `${a.username} 接受了您的好友请求`, timestamp: time.now().toISOString(), createdAt: time.currentDbString() };
    await broadcastMessage({ ...n, messageType: 'notification', receiver_id: requesterId, sender_id: accepterId });
    return { success: true, message: '已发送' };
  }

  static async notifyFriendRequestRejected(rejecterId: number, requesterId: number): Promise<{ success: boolean; message: string }> {
    const rj = await User.findById(rejecterId); if (!rj) throw new Error('拒绝者不存在');
    const rq = await User.findById(requesterId); if (!rq) throw new Error('请求者不存在');
    const n = { type: 'friend_request', subtype: 'rejected', rejecterId: rj.id, rejecterName: rj.username, requesterId, requesterName: rq.username, message: `${rj.username} 拒绝了您的好友请求`, timestamp: time.now().toISOString(), createdAt: time.currentDbString() };
    await broadcastMessage({ ...n, messageType: 'notification', receiver_id: requesterId, sender_id: rejecterId });
    return { success: true, message: '已发送' };
  }

  static async notifyFriendRemoved(removerId: number, removedId: number): Promise<{ success: boolean; message: string }> {
    const rm = await User.findById(removerId); if (!rm) throw new Error('删除者不存在');
    const rd = await User.findById(removedId); if (!rd) throw new Error('被删者不存在');
    const n = { type: 'friend_removed', removerId: rm.id, removerName: rm.username, removedId, removedName: rd.username, message: `${rm.username} 将您从好友列表中删除`, timestamp: time.now().toISOString(), createdAt: time.currentDbString() };
    await broadcastMessage({ ...n, messageType: 'notification', receiver_id: removedId, sender_id: removerId });
    return { success: true, message: '已发送' };
  }

  static async checkIfFriends(userId1: number, userId2: number): Promise<boolean> {
    return Friend.areFriends(userId1, userId2);
  }
}
export default FriendService;
