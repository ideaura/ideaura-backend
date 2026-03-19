const express = require('express');
const router = express.Router();
const Post = require('../models/Post');
const Community = require('../models/Community');
const { body, param, query } = require('express-validator');
const { authenticateToken, authenticateOptionalToken } = require('../middleware/auth');

// 创建帖子
router.post('/', 
  authenticateToken,
  [
    body('title').trim().isLength({ min: 1, max: 200 }).withMessage('帖子标题不能为空且长度不能超过200个字符'),
    body('content').trim().isLength({ min: 1, max: 10000 }).withMessage('帖子内容不能为空且长度不能超过10000个字符'),
    body('community_id').optional().isInt({ min: 1 }).withMessage('社区ID必须是正整数'),
    body('subsection_id').optional().isInt({ min: 1 }).withMessage('分区ID必须是正整数'),
    body('tags').optional().isArray().withMessage('标签必须是数组'),
    body('type').optional().isIn(['discussion', 'announcement', 'article', 'blog']).withMessage('帖子类型必须是discussion、announcement、article或blog')
  ],
  async (req, res) => {
    try {
      const { title, content, community_id, subsection_id, tags, type = 'discussion', attachment_urls } = req.body;
      const userId = req.user.id;

      // 如果指定了社区，检查用户是否是该社区的成员
      if (community_id) {
        const community = await Community.findById(community_id);
        if (!community) {
          return res.status(404).json({ error: '社区不存在' });
        }

        const isMember = await Community.isMember(community_id, userId);
        if (!isMember) {
          return res.status(403).json({ error: '您不是该社区的成员，无法在此发布帖子' });
        }
      }

      const postData = {
        community_id: community_id || null,
        user_id: userId,
        subsection_id: subsection_id || null,
        title,
        content,
        tags: tags ? JSON.stringify(tags) : null,
        attachment_urls: attachment_urls ? JSON.stringify(attachment_urls) : null,
        type
      };

      const postId = await Post.create(postData);

      // 如果帖子属于社区，更新社区的帖子计数
      if (community_id) {
        await Community.incrementPostCount(community_id);
      }

      const post = await Post.findById(postId);
      res.status(201).json({ message: '帖子创建成功', post });
    } catch (error) {
      console.error('创建帖子错误:', error);
      res.status(500).json({ error: error.message });
    }
  }
);

// 获取帖子详情
router.get('/:id', 
  authenticateOptionalToken,
  [
    param('id').isInt({ min: 1 }).withMessage('帖子ID必须是正整数')
  ],
  async (req, res) => {
    try {
      const { id } = req.params;

      const post = await Post.findById(id);
      if (!post) {
        return res.status(404).json({ error: '帖子不存在或已被删除' });
      }

      // 增加帖子查看数
      await Post.incrementViewCount(id);

      res.json({ post });
    } catch (error) {
      console.error('获取帖子详情错误:', error);
      res.status(500).json({ error: error.message });
    }
  }
);

// 获取社区帖子列表
router.get('/community/:communityId', 
  authenticateOptionalToken,
  [
    param('communityId').isInt({ min: 1 }).withMessage('社区ID必须是正整数'),
    query('page').optional().isInt({ min: 1 }).withMessage('页码必须是正整数'),
    query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('每页数量必须在1-50之间')
  ],
  async (req, res) => {
    try {
      const { communityId } = req.params;
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;
      const offset = (page - 1) * limit;

      // 检查社区是否存在
      const community = await Community.findById(communityId);
      if (!community) {
        return res.status(404).json({ error: '社区不存在' });
      }

      const posts = await Post.findByCommunity(parseInt(communityId), limit, offset);

      res.json({ posts });
    } catch (error) {
      console.error('获取社区帖子列表错误:', error);
      res.status(500).json({ error: error.message });
    }
  }
);

// 获取分区帖子列表
router.get('/subsection/:subsectionId', 
  authenticateOptionalToken,
  [
    param('subsectionId').isInt({ min: 1 }).withMessage('分区ID必须是正整数'),
    query('page').optional().isInt({ min: 1 }).withMessage('页码必须是正整数'),
    query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('每页数量必须在1-50之间')
  ],
  async (req, res) => {
    try {
      const { subsectionId } = req.params;
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;
      const offset = (page - 1) * limit;

      const posts = await Post.findBySubsection(parseInt(subsectionId), limit, offset);

      res.json({ posts });
    } catch (error) {
      console.error('获取分区帖子列表错误:', error);
      res.status(500).json({ error: error.message });
    }
  }
);

// 获取用户发布的帖子
router.get('/user/:userId', 
  authenticateOptionalToken,
  [
    param('userId').isInt({ min: 1 }).withMessage('用户ID必须是正整数'),
    query('page').optional().isInt({ min: 1 }).withMessage('页码必须是正整数'),
    query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('每页数量必须在1-50之间')
  ],
  async (req, res) => {
    try {
      const { userId } = req.params;
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;
      const offset = (page - 1) * limit;

      const posts = await Post.findByUser(parseInt(userId), limit, offset);

      res.json({ posts });
    } catch (error) {
      console.error('获取用户帖子列表错误:', error);
      res.status(500).json({ error: error.message });
    }
  }
);

// 获取所有帖子
router.get('/', 
  authenticateOptionalToken,
  [
    query('communityId').optional().isInt({ min: 1 }).withMessage('社区ID必须是正整数'),
    query('page').optional().isInt({ min: 1 }).withMessage('页码必须是正整数'),
    query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('每页数量必须在1-50之间')
  ],
  async (req, res) => {
    try {
      const communityId = req.query.communityId ? parseInt(req.query.communityId) : null;
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;
      const offset = (page - 1) * limit;

      const posts = await Post.findAll(communityId, limit, offset);

      res.json({ posts });
    } catch (error) {
      console.error('获取帖子列表错误:', error);
      res.status(500).json({ error: error.message });
    }
  }
);

// 搜索帖子
router.get('/search/:query', 
  authenticateOptionalToken,
  [
    param('query').trim().isLength({ min: 1 }).withMessage('搜索关键词不能为空'),
    query('communityId').optional().isInt({ min: 1 }).withMessage('社区ID必须是正整数'),
    query('page').optional().isInt({ min: 1 }).withMessage('页码必须是正整数'),
    query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('每页数量必须在1-50之间')
  ],
  async (req, res) => {
    try {
      const { query: searchQuery } = req.params;
      const communityId = req.query.communityId ? parseInt(req.query.communityId) : null;
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;
      const offset = (page - 1) * limit;

      const posts = await Post.search(searchQuery, communityId, limit, offset);

      res.json({ posts });
    } catch (error) {
      console.error('搜索帖子错误:', error);
      res.status(500).json({ error: error.message });
    }
  }
);

// 更新帖子
router.put('/:id', 
  authenticateToken,
  [
    param('id').isInt({ min: 1 }).withMessage('帖子ID必须是正整数'),
    body('title').optional().trim().isLength({ min: 1, max: 200 }).withMessage('帖子标题不能为空且长度不能超过200个字符'),
    body('content').optional().trim().isLength({ min: 1, max: 10000 }).withMessage('帖子内容不能为空且长度不能超过10000个字符'),
    body('tags').optional().isArray().withMessage('标签必须是数组'),
    body('type').optional().isIn(['discussion', 'announcement', 'article', 'blog']).withMessage('帖子类型必须是discussion、announcement、article或blog')
  ],
  async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.id;
      const updates = req.body;

      // 检查帖子是否属于当前用户
      const belongsToUser = await Post.belongsToUser(parseInt(id), userId);
      if (!belongsToUser) {
        return res.status(403).json({ error: '只有帖子作者可以编辑帖子' });
      }

      const result = await Post.update(parseInt(id), userId, updates);
      
      if (result.changes === 0) {
        return res.status(404).json({ error: '帖子不存在或更新失败' });
      }

      const post = await Post.findById(id);
      res.json({ message: '帖子更新成功', post });
    } catch (error) {
      console.error('更新帖子错误:', error);
      res.status(500).json({ error: error.message });
    }
  }
);

// 删除帖子
router.delete('/:id', 
  authenticateToken,
  [
    param('id').isInt({ min: 1 }).withMessage('帖子ID必须是正整数')
  ],
  async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      const result = await Post.delete(parseInt(id), userId);
      
      if (result.changes === 0) {
        return res.status(404).json({ error: '帖子不存在或删除失败' });
      }

      res.json({ message: '帖子删除成功' });
    } catch (error) {
      console.error('删除帖子错误:', error);
      res.status(500).json({ error: error.message });
    }
  }
);

module.exports = router;