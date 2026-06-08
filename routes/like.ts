import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.ts';
import { Like, Moment, Post } from '../models/index.ts';
const router = Router();
router.post('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user!.id;
    const { momentId, postId } = req.body as { momentId?: number; postId?: number };
    if (!momentId && !postId) return res.status(400).json({ success: false, message: '必须提供动态ID或帖子ID之一' });
    if (momentId && postId) return res.status(400).json({ success: false, message: '只能指定一种' });
    if (momentId && !(await Moment.findById(momentId))) return res.status(404).json({ success: false, message: '动态不存在' });
    if (postId && !(await Post.findById(postId))) return res.status(404).json({ success: false, message: '帖子不存在' });
    const r = await Like.like(userId, momentId ?? null, postId ?? null);
    res.json({ success: true, data: r });
  } catch (e) { res.status(500).json({ success: false, message: '服务器错误' }); }
});

router.delete('/:postId', authenticateToken, async (req, res) => {
  try {
    const r = await Like.unlike(req.user!.id, null, +req.params.postId);
    res.json({ success: true, data: r });
  } catch (e) { res.status(500).json({ success: false, message: '服务器错误' }); }
});

router.get('/check/:postId', authenticateToken, async (req, res) => {
  try {
    const r = await Like.getUserLikeStatus(req.user!.id, null, +req.params.postId);
    res.json({ success: true, data: r });
  } catch (e) { res.status(500).json({ success: false, message: '服务器错误' }); }
});

router.delete('/', authenticateToken, async (req, res) => {
  try {
    const { momentId, postId } = req.body as { momentId?: number; postId?: number };
    const r = await Like.unlike(req.user!.id, momentId ?? null, postId ?? null);
    res.json({ success: true, data: r });
  } catch (e) { res.status(500).json({ success: false, message: '服务器错误' }); }
});
router.get('/status', authenticateToken, async (req, res) => {
  const { momentId, postId } = req.query as { momentId?: string; postId?: string };
  const r = await Like.getUserLikeStatus(req.user!.id, momentId ? +momentId : null, postId ? +postId : null);
  res.json({ success: true, data: r });
});
router.get('/count', async (req, res) => {
  const { momentId, postId } = req.query as { momentId?: string; postId?: string };
  const c = await Like.getLikesCount(momentId ? +momentId : null, postId ? +postId : null);
  res.json({ success: true, data: { count: c } });
});
router.get('/list', async (req, res) => {
  const { momentId, postId, page, limit } = req.query as { momentId?: string; postId?: string; page?: string; limit?: string };
  const r = await Like.getLikesByContentId(momentId ? +momentId : null, postId ? +postId : null, page ? +page : 1, limit ? +limit : 10);
  res.json({ success: true, data: r });
});
export default router;
