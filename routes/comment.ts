import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.ts';
import { Comment, Moment, Post } from '../models/index.ts';
const router = Router();
router.post('/', authenticateToken, async (req, res) => {
  const { momentId, postId, content, parentId } = req.body as { momentId?: number; postId?: number; content: string; parentId?: number };
  if (!momentId && !postId) return res.status(400).json({ success: false, message: '必须提供目标ID' });
  if (!content?.trim()) return res.status(400).json({ success: false, message: '评论内容不能为空' });
  if (momentId && !(await Moment.findById(momentId))) return res.status(404).json({ success: false, message: '动态不存在' });
  if (postId && !(await Post.findById(postId))) return res.status(404).json({ success: false, message: '帖子不存在' });
  const r = await Comment.create(req.user!.id, content.trim(), momentId ?? null, postId ?? null, parentId ?? null);
  res.status(201).json({ success: true, data: r });
});
router.get('/moment/:momentId', async (req, res) => {
  const { page, limit } = req.query as { page?: string; limit?: string };
  res.json({ success: true, data: await Comment.getByMomentId(+req.params.momentId, page ? +page : 1, limit ? +limit : 10) });
});
router.get('/post/:postId', async (req, res) => {
  const { page, limit } = req.query as { page?: string; limit?: string };
  res.json({ success: true, data: await Comment.getByPostId(+req.params.postId, page ? +page : 1, limit ? +limit : 10) });
});
router.get('/replies/:commentId', async (req, res) => {
  res.json({ success: true, data: await Comment.getReplies(+req.params.commentId) });
});
router.delete('/:commentId', authenticateToken, async (req, res) => {
  res.json({ success: true, data: await Comment.delete(+req.params.commentId, req.user!.id) });
});
export default router;
