import { Router } from 'express';
import db from '../config/database.ts';
import Community from '../models/Community.ts';
import Post from '../models/Post.ts';
import { body, param } from 'express-validator';
import { authenticateToken, authenticateOptionalToken } from '../middleware/auth.ts';
import { processFileWithMd5 } from '../middleware/fileUpload.ts';

const router = Router();

router.post('/', authenticateToken, [
  body('name').trim().isLength({ min: 1, max: 100 }).withMessage('圈子名称不能为空'),
  body('description').optional().trim().isLength({ max: 500 }),
  body('type').optional().isIn(['public', 'private']),
  body('join_policy').optional().isIn(['open', 'approval', 'invitation_only'])
], processFileWithMd5, async (req, res) => {
  try {
    const { name, description, type = 'public', join_policy = 'open' } = req.body as { name: string; description?: string; type?: string; join_policy?: string };
    const avatar_url = (req.file as Record<string, unknown>)?.fileUrl as string || null;

    const communityId = await Community.create({
      topic_id: null, name: name.trim(), description: description?.trim() ?? null,
      tags: null, avatar_url, cover_image_url: null,
      created_by: req.user!.id, type, join_policy
    });

    await Community.join(communityId, req.user!.id, 'owner');

    const community = await Community.findById(communityId);
    res.status(201).json({ success: true, data: community });
  } catch (e) { console.error('创建圈子错误:', e); res.status(500).json({ success: false, message: '服务器错误' }); }
});

router.get('/', authenticateOptionalToken, async (req, res) => {
  try {
    const { page, limit } = req.query as { page?: string; limit?: string };
    const communities = await Community.getAll(page ? +page : 1, limit ? +limit : 10);
    res.json({ success: true, data: { communities } });
  } catch (e) { res.status(500).json({ success: false, message: '服务器错误' }); }
});

router.get('/recommended', authenticateOptionalToken, async (req, res) => {
  try {
    const communities = await Community.getRecommended(1, 10);
    res.json({ success: true, data: { communities } });
  } catch (e) { console.error('[communities/recommended]', (e as Error).message); res.status(500).json({ success: false, message: '服务器错误' }); }
});

router.get('/search/:query', authenticateOptionalToken, async (req, res) => {
  try {
    const { page, limit } = req.query as { page?: string; limit?: string };
    const l = limit ? +limit : 20;
    const p = page ? +page : 1;
    const communities = await Community.search(req.params.query, l, (p - 1) * l);
    res.json({ communities });
  } catch (e) { res.status(500).json({ success: false, message: '服务器错误' }); }
});

router.get('/my/created', authenticateToken, async (req, res) => {
  try {
    const { page, limit } = req.query as { page?: string; limit?: string };
    const l = limit ? +limit : 20;
    const p = page ? +page : 1;
    const communities = await Community.getCreatedByUser(req.user!.id, l, (p - 1) * l);
    res.json({ communities });
  } catch (e) { res.status(500).json({ success: false, message: '服务器错误' }); }
});

router.get('/my/joined', authenticateToken, async (req, res) => {
  try {
    const communities = await Community.getJoinedByUser(req.user!.id);
    res.json({ success: true, data: { communities } });
  } catch (e) { console.error('[communities/my/joined] 错误:', (e as Error).message, (e as Error).stack); res.status(500).json({ success: false, message: '服务器错误' }); }
});

router.get('/:id', authenticateOptionalToken, async (req, res) => {
  try {
    const community = await Community.findById(+req.params.id);
    if (!community) return res.status(404).json({ success: false, message: '圈子不存在' });
    const memberCount = await Community.getMemberCount(+req.params.id);
    res.json({ success: true, data: { community: { ...community, member_count: memberCount } } });
  } catch (e) { res.status(500).json({ success: false, message: '服务器错误' }); }
});

router.post('/:id/join', authenticateToken, async (req, res) => {
  try {
    await Community.join(+req.params.id, req.user!.id);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, message: '服务器错误' }); }
});

router.post('/:id/leave', authenticateToken, async (req, res) => {
  try {
    await Community.leave(+req.params.id, req.user!.id);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, message: '服务器错误' }); }
});

router.post('/:id/avatar', authenticateToken, processFileWithMd5, async (req, res) => {
  try {
    const fileUrl = (req.file as Record<string, unknown>)?.fileUrl as string || null;
    if (!fileUrl) return res.status(400).json({ success: false, message: '没有上传文件' });
    await Community.updateAvatar(+req.params.id, req.user!.id, fileUrl);
    res.json({ success: true, data: { avatar_url: fileUrl } });
  } catch (e) { res.status(500).json({ success: false, message: (e as Error).message || '服务器错误' }); }
});

router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { name, description, type, join_policy } = req.body as { name?: string; description?: string; type?: string; join_policy?: string };
    const updates: Record<string, unknown> = {};
    if (name) updates.name = name.trim();
    if (description !== undefined) updates.description = description;
    if (type) updates.type = type;
    if (join_policy) updates.join_policy = join_policy;
    await Community.update(+req.params.id, updates);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, message: (e as Error).message || '服务器错误' }); }
});

router.delete('/:id/leave', authenticateToken, async (req, res) => {
  try {
    await Community.leave(+req.params.id, req.user!.id);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, message: '服务器错误' }); }
});

router.get('/:id/members', async (req, res) => {
  try {
    const members = await Community.getMembers(+req.params.id);
    res.json({ success: true, data: members });
  } catch (e) { res.status(500).json({ success: false, message: '服务器错误' }); }
});

router.get('/:id/admins', authenticateToken, async (req, res) => {
  try {
    const admins = await Community.getAdmins(+req.params.id);
    res.json({ success: true, data: admins });
  } catch (e) { res.status(500).json({ success: false, message: '服务器错误' }); }
});

router.post('/:communityId/members/:userId/role', authenticateToken, async (req, res) => {
  try {
    const { role } = req.body as { role: string };
    if (!role) return res.status(400).json({ success: false, message: '角色不能为空' });
    await Community.setRole(+req.params.communityId, +req.params.userId, role);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, message: (e as Error).message || '服务器错误' }); }
});

router.delete('/:communityId/members/:userId', authenticateToken, async (req, res) => {
  try {
    await Community.removeMember(+req.params.communityId, +req.params.userId);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, message: (e as Error).message || '服务器错误' }); }
});

export default router;
