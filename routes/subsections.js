const express = require('express');
const time = require('../utils/time');
const router = express.Router();
const db = require('../config/database');
const Community = require('../models/Community');
const { body, param, query } = require('express-validator');
const { authenticateToken } = require('../middleware/auth');

// 创建分区
router.post('/', 
  authenticateToken,
  [
    body('community_id').isInt({ min: 1 }).withMessage('社区ID必须是正整数'),
    body('name').trim().isLength({ min: 1, max: 100 }).withMessage('分区名称不能为空且长度不能超过100个字符'),
    body('description').optional().trim().isLength({ max: 500 }).withMessage('分区描述长度不能超过500个字符'),
    body('order_num').optional().isInt({ min: 0 }).withMessage('排序序号必须是非负整数')
  ],
  async (req, res) => {
    try {
      const { community_id, name, description, order_num = 0 } = req.body;
      const userId = req.user.id;

      // 检查用户是否是社区所有者或管理员
      const userRole = await Community.getRole(community_id, userId);
      if (userRole !== 'owner' && userRole !== 'admin') {
        return res.status(403).json({ error: '只有社区所有者或管理员可以创建分区' });
      }

      // 检查社区是否存在
      const community = await Community.findById(community_id);
      if (!community) {
        return res.status(404).json({ error: '社区不存在' });
      }

      // 检查分区名称是否已存在
      const existingSubsection = await db.get(
        'SELECT 1 FROM subsections WHERE community_id = ? AND name = ?',
        [community_id, name]
      );
      if (existingSubsection) {
        return res.status(400).json({ error: '该社区中已存在同名分区' });
      }

      const currentTime = time.currentDbString();

      const result = await db.run(
        `INSERT INTO subsections (community_id, name, description, order_num, created_at, updated_at) 
         VALUES (?, ?, ?, ?, ?, ?)`,
        [community_id, name, description, order_num, currentTime, currentTime]
      );

      const subsection = await db.get(
        `SELECT s.*, c.name as community_name
         FROM subsections s
         LEFT JOIN communities c ON s.community_id = c.id
         WHERE s.id = ?`,
        [result.lastID]
      );

      res.status(201).json({ message: '分区创建成功', subsection });
    } catch (error) {
      console.error('创建分区错误:', error);
      res.status(500).json({ error: error.message });
    }
  }
);

// 获取分区详情
router.get('/:id', 
  [
    param('id').isInt({ min: 1 }).withMessage('分区ID必须是正整数')
  ],
  async (req, res) => {
    try {
      const { id } = req.params;

      const subsection = await db.get(
        `SELECT s.*, c.name as community_name
         FROM subsections s
         LEFT JOIN communities c ON s.community_id = c.id
         WHERE s.id = ? AND s.is_active = true`,
        [id]
      );

      if (!subsection) {
        return res.status(404).json({ error: '分区不存在或已被禁用' });
      }

      res.json({ subsection });
    } catch (error) {
      console.error('获取分区详情错误:', error);
      res.status(500).json({ error: error.message });
    }
  }
);

// 获取社区的分区列表
router.get('/community/:communityId', 
  [
    param('communityId').isInt({ min: 1 }).withMessage('社区ID必须是正整数')
  ],
  async (req, res) => {
    try {
      const { communityId } = req.params;

      // 检查社区是否存在
      const community = await Community.findById(communityId);
      if (!community) {
        return res.status(404).json({ error: '社区不存在' });
      }

      const subsections = await db.all(
        `SELECT s.*, c.name as community_name
         FROM subsections s
         LEFT JOIN communities c ON s.community_id = c.id
         WHERE s.community_id = ? AND s.is_active = true
         ORDER BY s.order_num ASC, s.created_at DESC`,
        [communityId]
      );

      res.json({ subsections });
    } catch (error) {
      console.error('获取社区分区列表错误:', error);
      res.status(500).json({ error: error.message });
    }
  }
);

// 更新分区
router.put('/:id', 
  authenticateToken,
  [
    param('id').isInt({ min: 1 }).withMessage('分区ID必须是正整数'),
    body('name').optional().trim().isLength({ min: 1, max: 100 }).withMessage('分区名称不能为空且长度不能超过100个字符'),
    body('description').optional().trim().isLength({ max: 500 }).withMessage('分区描述长度不能超过500个字符'),
    body('order_num').optional().isInt({ min: 0 }).withMessage('排序序号必须是非负整数')
  ],
  async (req, res) => {
    try {
      const { id } = req.params;
      const { name, description, order_num } = req.body;
      const userId = req.user.id;

      // 获取分区信息
      const subsection = await db.get(
        'SELECT community_id FROM subsections WHERE id = ?',
        [id]
      );

      if (!subsection) {
        return res.status(404).json({ error: '分区不存在' });
      }

      // 检查用户是否是社区所有者或管理员
      const userRole = await Community.getRole(subsection.community_id, userId);
      if (userRole !== 'owner' && userRole !== 'admin') {
        return res.status(403).json({ error: '只有社区所有者或管理员可以更新分区' });
      }

      let sql = 'UPDATE subsections SET updated_at = ?';
      let params = [time.currentDbString()];
      let updates = [];

      if (name !== undefined) {
        updates.push('name = ?');
        params.push(name);
      }
      if (description !== undefined) {
        updates.push('description = ?');
        params.push(description);
      }
      if (order_num !== undefined) {
        updates.push('order_num = ?');
        params.push(order_num);
      }

      if (updates.length === 0) {
        return res.status(400).json({ error: '至少需要更新一个字段' });
      }

      sql += ', ' + updates.join(', ');
      sql += ' WHERE id = ?';
      params.push(id);

      const result = await db.run(sql, params);

      if (result.changes === 0) {
        return res.status(404).json({ error: '分区不存在或更新失败' });
      }

      const updatedSubsection = await db.get(
        `SELECT s.*, c.name as community_name
         FROM subsections s
         LEFT JOIN communities c ON s.community_id = c.id
         WHERE s.id = ?`,
        [id]
      );

      res.json({ message: '分区更新成功', subsection: updatedSubsection });
    } catch (error) {
      console.error('更新分区错误:', error);
      res.status(500).json({ error: error.message });
    }
  }
);

// 删除分区（软删除）
router.delete('/:id', 
  authenticateToken,
  [
    param('id').isInt({ min: 1 }).withMessage('分区ID必须是正整数')
  ],
  async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      // 获取分区信息
      const subsection = await db.get(
        'SELECT community_id FROM subsections WHERE id = ?',
        [id]
      );

      if (!subsection) {
        return res.status(404).json({ error: '分区不存在' });
      }

      // 检查用户是否是社区所有者或管理员
      const userRole = await Community.getRole(subsection.community_id, userId);
      if (userRole !== 'owner' && userRole !== 'admin') {
        return res.status(403).json({ error: '只有社区所有者或管理员可以删除分区' });
      }

      // 检查分区是否有关联的帖子
      const postCount = await db.get(
        'SELECT COUNT(*) as count FROM posts WHERE subsection_id = ?',
        [id]
      );

      if (postCount.count > 0) {
        return res.status(400).json({ error: '该分区下还有帖子，无法删除' });
      }

      const result = await db.run(
        'UPDATE subsections SET is_active = false WHERE id = ?',
        [id]
      );

      if (result.changes === 0) {
        return res.status(404).json({ error: '分区不存在或删除失败' });
      }

      res.json({ message: '分区删除成功' });
    } catch (error) {
      console.error('删除分区错误:', error);
      res.status(500).json({ error: error.message });
    }
  }
);

module.exports = router;