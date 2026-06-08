import { Router } from 'express';
import time from '../utils/time.ts';
import User from '../models/User.ts';
import { authenticateToken } from '../middleware/auth.ts';
import { isUserOnline, getOnlineUserIdsSet } from '../services/mqtt.ts';

const router = Router();

router.get('/users/me', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user!.id);
    if (!user) return res.status(404).json({ success: false, message: '用户不存在' });
    const online = await getOnlineUserIdsSet();
    res.json({ success: true, data: { ...user, isOnline: true } });
  } catch (e) { res.status(500).json({ success: false, message: '服务器错误' }); }
});

router.get('/users/search', authenticateToken, async (req, res) => {
  try {
    const { q, page, limit } = req.query as { q?: string; page?: string; limit?: string };
    if (!q?.trim()) return res.status(400).json({ success: false, message: '搜索关键词不能为空' });
    const users = await User.searchUsers(q, limit ? +limit : 20);
    res.json({ success: true, data: users });
  } catch (e) { res.status(500).json({ success: false, message: '服务器错误' }); }
});

router.get('/users/:id/public', async (req, res) => {
  try {
    const user = await User.findById(+req.params.id);
    if (!user) return res.status(404).json({ success: false, message: '用户不存在' });
    const safe = { ...user };
    delete (safe as Record<string, unknown>).password;
    res.json({ success: true, data: safe });
  } catch (e) { res.status(500).json({ success: false, message: '服务器错误' }); }
});

router.get('/users/:id', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(+req.params.id);
    if (!user) return res.status(404).json({ success: false, message: '用户不存在' });
    const online = await isUserOnline(user.id);
    res.json({ success: true, data: { ...user, isOnline: online } });
  } catch (e) { res.status(500).json({ success: false, message: '服务器错误' }); }
});

router.get('/users/stats', authenticateToken, async (req, res) => {
  try {
    const row = await User.getTotalUsers();
    res.json({ success: true, data: row });
  } catch (e) { res.status(500).json({ success: false, message: '服务器错误' }); }
});

router.put('/users/username', authenticateToken, async (req, res) => {
  try {
    const { username } = req.body as { username: string };
    if (!username?.trim()) return res.status(400).json({ success: false, message: '用户名不能为空' });
    await User.update(req.user!.id, { username: username.trim() });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, message: '服务器错误' }); }
});

router.put('/users/me', authenticateToken, async (req, res) => {
  try {
    const { username, avatar_url } = req.body as { username?: string; avatar_url?: string };
    const updates: Record<string, string> = {};
    if (username) updates.username = username;
    if (avatar_url !== undefined) updates.avatar_url = avatar_url;
    if (!Object.keys(updates).length) return res.status(400).json({ success: false, message: '没有要更新的字段' });
    await User.update(req.user!.id, updates);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, message: '服务器错误' }); }
});

export default router;
