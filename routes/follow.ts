import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.ts';
import { Follow, User } from '../models/index.ts';
const router = Router();
router.post('/', authenticateToken, async (req, res) => {
  const fid = req.user!.id; const { followingId } = req.body as { followingId: number };
  if (!followingId) return res.status(400).json({ success: false, message: '被关注用户ID不能为空' });
  if (!(await User.findById(followingId))) return res.status(404).json({ success: false, message: '用户不存在' });
  if (fid === followingId) return res.status(400).json({ success: false, message: '不能关注自己' });
  res.json({ success: true, data: await Follow.follow(fid, followingId) });
});
router.delete('/:userId', authenticateToken, async (req, res) => {
  res.json({ success: true, data: await Follow.unfollow(req.user!.id, +req.params.userId) });
});

router.delete('/', authenticateToken, async (req, res) => {
  const { followingId } = req.body as { followingId: number };
  res.json({ success: true, data: await Follow.unfollow(req.user!.id, followingId) });
});
router.get('/following/:userId?', authenticateToken, async (req, res) => {
  const uid = req.params.userId ? +req.params.userId : req.user!.id;
  const { page, limit } = req.query as { page?: string; limit?: string };
  res.json({ success: true, data: await Follow.getFollowingList(uid, page ? +page : 1, limit ? +limit : 10) });
});
router.get('/followers/:userId?', authenticateToken, async (req, res) => {
  const uid = req.params.userId ? +req.params.userId : req.user!.id;
  const { page, limit } = req.query as { page?: string; limit?: string };
  res.json({ success: true, data: await Follow.getFollowerList(uid, page ? +page : 1, limit ? +limit : 10) });
});
router.get('/counts/:userId?', async (req, res) => {
  const uid = req.params.userId ? +req.params.userId : (req.user?.id ?? 0);
  const [fc, fic] = await Promise.all([Follow.getFollowingCount(uid), Follow.getFollowerCount(uid)]);
  res.json({ success: true, data: { followingCount: fc, followerCount: fic } });
});
router.get('/check/:userId', authenticateToken, async (req, res) => {
  try {
    const isFollowing = await Follow.isFollowing(req.user!.id, +req.params.userId);
    res.json({ success: true, data: { isFollowing } });
  } catch (e) { res.status(500).json({ success: false, message: '服务器错误' }); }
});
export default router;
