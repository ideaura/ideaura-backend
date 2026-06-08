import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.ts';
import { User, Friend } from '../models/index.ts';
import FriendService from '../services/friendService.ts';
import { getOnlineUserIdsSet } from '../services/mqtt.ts';
const router = Router();

router.post('/request', authenticateToken, async (req, res) => {
  const { userId } = req.body as { userId: number }; const cid = req.user!.id;
  if (!userId || isNaN(userId)) return res.status(400).json({ success: false, message: '目标用户ID无效' });
  if (+userId === cid) return res.status(400).json({ success: false, message: '不能添加自己为好友' });
  const tu = await User.findById(userId);
  if (!tu) return res.status(404).json({ success: false, message: '用户不存在' });
  if (tu.is_bot && !tu.auto_accept_friends) return res.status(403).json({ success: false, message: '该用户不接受好友请求' });
  const r = await Friend.createFriendRequest(cid, userId);
  FriendService.notifyFriendRequest(cid, userId, r).catch(() => {});
  res.json({ success: true, data: r });
});
router.post('/request/:requestId/accept', authenticateToken, async (req, res) => {
  try { res.json({ success: true, data: await Friend.acceptFriendRequest(+req.params.requestId, req.user!.id) }); }
  catch (e) { res.status(500).json({ success: false, message: (e as Error).message }); }
});
router.post('/request/:requestId/reject', authenticateToken, async (req, res) => {
  try { res.json({ success: true, data: await Friend.rejectFriendRequest(+req.params.requestId, req.user!.id) }); }
  catch (e) { res.status(500).json({ success: false, message: (e as Error).message }); }
});
router.delete('/request/:requestId', authenticateToken, async (req, res) => {
  try { res.json({ success: true, data: await Friend.rejectFriendRequest(+req.params.requestId, req.user!.id) }); }
  catch (e) { res.status(500).json({ success: false, message: (e as Error).message }); }
});
router.delete('/:friendId', authenticateToken, async (req, res) => {
  const r = await Friend.removeFriend(req.user!.id, +req.params.friendId);
  FriendService.notifyFriendRemoved(req.user!.id, +req.params.friendId).catch(() => {});
  res.json({ success: true, data: r });
});
router.get('/', authenticateToken, async (req, res) => {
  const friends = await Friend.getFriendList(req.user!.id);
  const online = await getOnlineUserIdsSet();
  const enriched = friends.map(f => ({
    ...f,
    isOnline: online.has(Number(f.friendId)),
    id: f.id ?? f.friendId // ensure id exists for key prop
  }));
  res.json({ success: true, data: enriched, total: enriched.length });
});
router.get('/pending', authenticateToken, async (req, res) => {
  res.json({ success: true, data: await Friend.getPendingRequests(req.user!.id) });
});
router.get('/requests/received', authenticateToken, async (req, res) => {
  res.json({ success: true, data: await Friend.getPendingRequests(req.user!.id) });
});
router.get('/requests/sent', authenticateToken, async (req, res) => {
  res.json({ success: true, data: await Friend.getSentRequests(req.user!.id) });
});
router.get('/count', authenticateToken, async (req, res) => {
  res.json({ success: true, data: { count: await Friend.getFriendCount(req.user!.id) } });
});
router.get('/check/:userId', authenticateToken, async (req, res) => {
  try {
    const areFriends = await Friend.areFriends(req.user!.id, +req.params.userId);
    res.json({ success: true, data: { areFriends } });
  } catch (e) { res.status(500).json({ success: false, message: '服务器错误' }); }
});

router.get('/requests/pending/count', authenticateToken, async (req, res) => {
  res.json({ success: true, data: { count: (await Friend.getPendingRequests(req.user!.id)).length } });
});
export default router;
