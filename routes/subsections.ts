import { Router } from 'express';
import time from '../utils/time.ts';
import db from '../config/database.ts';
import Community from '../models/Community.ts';
import { body, param, query } from 'express-validator';
import { authenticateToken } from '../middleware/auth.ts';
const router = Router();

router.post('/', authenticateToken, [
  body('community_id').isInt({ min: 1 }).withMessage('社区ID必须是正整数'),
  body('name').trim().isLength({ min: 1, max: 100 }).withMessage('分区名称不能为空且长度不能超过100个字符'),
  body('description').optional().trim().isLength({ max: 500 }),
  body('order_num').optional().isInt({ min: 0 })
], async (req, res) => {
  try {
    const { community_id, name, description, order_num = 0 } = req.body as { community_id: number; name: string; description?: string; order_num?: number };
    const community = await Community.findById(community_id);
    if (!community) return res.status(404).json({ success: false, message: '社区不存在' });
    const exists = await db.get<{ id: number }>("SELECT id FROM subsections WHERE community_id = ? AND name = ?", [community_id, name.trim()]);
    if (exists) return res.status(400).json({ success: false, message: '分区名称已存在' });
    const result = await db.run(
      "INSERT INTO subsections (community_id, name, description, order_num, created_at) VALUES (?, ?, ?, ?, ?) RETURNING id",
      [community_id, name.trim(), description?.trim() ?? null, order_num, time.currentDbString()]
    );
    res.status(201).json({ success: true, data: { id: result.lastID, name: name.trim() } });
  } catch (e) { console.error('创建分区别:', e); res.status(500).json({ success: false, message: '服务器错误' }); }
});

router.get('/community/:communityId', async (req, res) => {
  try {
    const rows = await db.all(
      "SELECT * FROM subsections WHERE community_id = ? AND is_active = true ORDER BY order_num ASC, id ASC",
      [+req.params.communityId]
    );
    res.json({ success: true, data: { subsections: rows } });
  } catch (e) { res.status(500).json({ success: false, message: '服务器错误' }); }
});

router.put('/:id', authenticateToken, [
  param('id').isInt({ min: 1 }),
  body('name').optional().trim().isLength({ min: 1, max: 100 }),
  body('description').optional().trim(),
  body('order_num').optional().isInt({ min: 0 })
], async (req, res) => {
  try {
    const id = +req.params.id;
    const { name, description, order_num } = req.body as { name?: string; description?: string; order_num?: number };
    const subsection = await db.get<{ community_id: number }>("SELECT community_id FROM subsections WHERE id = ?", [id]);
    if (!subsection) return res.status(404).json({ success: false, message: '分区不存在' });
    const sets: string[] = []; const vals: unknown[] = [];
    if (name !== undefined) { sets.push('name = ?'); vals.push(name.trim()); }
    if (description !== undefined) { sets.push('description = ?'); vals.push(description); }
    if (order_num !== undefined) { sets.push('order_num = ?'); vals.push(order_num); }
    if (!sets.length) return res.status(400).json({ success: false, message: '没有要更新的字段' });
    vals.push(id);
    await db.run(`UPDATE subsections SET ${sets.join(', ')} WHERE id = ?`, vals);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, message: '服务器错误' }); }
});

router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    await db.run("UPDATE subsections SET is_active = false WHERE id = ?", [+req.params.id]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, message: '服务器错误' }); }
});
export default router;
