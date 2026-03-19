const express = require('express');
const router = express.Router();
const Post = require('../models/Post');
const User = require('../models/User');
const BlogCategory = require('../models/BlogCategory');
const { body, param, query } = require('express-validator');
const { authenticateToken, authenticateOptionalToken } = require('../middleware/auth');

// 创建博客文章（需要用户鉴权）
router.post('/', 
  authenticateToken,
  [
    body('title').trim().isLength({ min: 1, max: 200 }).withMessage('博客标题不能为空且长度不能超过200个字符'),
    body('content').trim().isLength({ min: 1, max: 10000 }).withMessage('博客内容不能为空且长度不能超过10000个字符'),
    body('tags').optional().isArray().withMessage('标签必须是数组'),
    body('category_id').optional().isInt({ min: 1 }).withMessage('分类ID必须是正整数')
  ],
  async (req, res) => {
    try {
      const { title, content, tags, attachment_urls, category_id } = req.body;
      const userId = req.user.id;

      // 如果提供了分类ID，验证分类是否属于当前用户
      if (category_id) {
        const category = await BlogCategory.findById(category_id);
        if (!category || category.user_id !== userId) {
          return res.status(403).json({ error: '分类不存在或不属于当前用户' });
        }
      }

      // 博客文章不属于任何社区，所以 community_id 为 null，并且强制类型为 'blog'
      const postData = {
        community_id: null, // 博客文章不属于任何社区
        user_id: userId,
        subsection_id: null, // 博客文章不隶属于任何分区
        title,
        content,
        tags: tags ? JSON.stringify(tags) : null,
        attachment_urls: attachment_urls ? JSON.stringify(attachment_urls) : null,
        type: 'blog', // 强制类型为博客
        category_id: category_id || null
      };

      const postId = await Post.create(postData);

      const post = await Post.findById(postId);
      res.status(201).json({ message: '博客文章创建成功', post });
    } catch (error) {
      console.error('创建博客文章错误:', error);
      res.status(500).json({ error: error.message });
    }
  }
);

// 获取博客文章详情（无需鉴权）
router.get('/:id', 
  authenticateOptionalToken,
  [
    param('id').isInt({ min: 1 }).withMessage('博客文章ID必须是正整数')
  ],
  async (req, res) => {
    try {
      const { id } = req.params;

      const post = await Post.findById(id);
      if (!post) {
        return res.status(404).json({ error: '博客文章不存在或已被删除' });
      }

      // 确保是博客类型的文章
      if (post.type !== 'blog') {
        return res.status(404).json({ error: '博客文章不存在' });
      }

      // 增加博客文章查看数
      await Post.incrementViewCount(id);

      res.json({ post });
    } catch (error) {
      console.error('获取博客文章详情错误:', error);
      res.status(500).json({ error: error.message });
    }
  }
);

// 获取用户的所有博客文章（无需鉴权）
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

      // 检查用户是否存在
      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({ error: '用户不存在' });
      }

      // 获取用户的博客文章（type = 'blog'）
      const posts = await Post.findByUserWithBlogType(parseInt(userId), limit, offset);

      res.json({ posts, user_info: { id: user.id, username: user.username, nickname: user.nickname } });
    } catch (error) {
      console.error('获取用户博客文章列表错误:', error);
      res.status(500).json({ error: error.message });
    }
  }
);

// 获取所有博客文章（无需鉴权）
router.get('/', 
  authenticateOptionalToken,
  [
    query('page').optional().isInt({ min: 1 }).withMessage('页码必须是正整数'),
    query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('每页数量必须在1-50之间'),
    query('tag').optional().trim().isLength({ min: 1, max: 50 }).withMessage('标签长度必须在1-50个字符之间')
  ],
  async (req, res) => {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;
      const tag = req.query.tag;
      const offset = (page - 1) * limit;

      let posts;
      if (tag) {
        // 按标签过滤博客文章
        posts = await Post.findByTagWithBlogType(tag, limit, offset);
      } else {
        // 获取所有博客文章
        posts = await Post.findAllBlogPosts(limit, offset);
      }

      res.json({ posts });
    } catch (error) {
      console.error('获取博客文章列表错误:', error);
      res.status(500).json({ error: error.message });
    }
  }
);

// 搜索博客文章（无需鉴权）
router.get('/search/:query', 
  authenticateOptionalToken,
  [
    param('query').trim().isLength({ min: 1 }).withMessage('搜索关键词不能为空'),
    query('page').optional().isInt({ min: 1 }).withMessage('页码必须是正整数'),
    query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('每页数量必须在1-50之间')
  ],
  async (req, res) => {
    try {
      const { query: searchQuery } = req.params;
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;
      const offset = (page - 1) * limit;

      const posts = await Post.searchBlogPosts(searchQuery, limit, offset);

      res.json({ posts });
    } catch (error) {
      console.error('搜索博客文章错误:', error);
      res.status(500).json({ error: error.message });
    }
  }
);

// 更新博客文章（需要用户鉴权）
router.put('/:id', 
  authenticateToken,
  [
    param('id').isInt({ min: 1 }).withMessage('博客文章ID必须是正整数'),
    body('title').optional().trim().isLength({ min: 1, max: 200 }).withMessage('博客标题不能为空且长度不能超过200个字符'),
    body('content').optional().trim().isLength({ min: 1, max: 10000 }).withMessage('博客内容不能为空且长度不能超过10000个字符'),
    body('tags').optional().isArray().withMessage('标签必须是数组'),
    body('type').optional().isIn(['blog']).withMessage('博客文章类型只能是blog'),
    body('category_id').optional().isInt({ min: 1 }).withMessage('分类ID必须是正整数')
  ],
  async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.id;
      const updates = req.body;

      // 检查帖子是否属于当前用户且是博客类型
      const belongsToUser = await Post.belongsToUser(parseInt(id), userId);
      const post = await Post.findById(id);
      
      if (!belongsToUser || !post || post.type !== 'blog') {
        return res.status(403).json({ error: '只有博客文章作者可以编辑博客文章' });
      }

      // 如果提供了分类ID，验证分类是否属于当前用户
      if (updates.category_id !== undefined) {
        if (updates.category_id) {
          const category = await BlogCategory.findById(updates.category_id);
          if (!category || category.user_id !== userId) {
            return res.status(403).json({ error: '分类不存在或不属于当前用户' });
          }
        } else {
          // 允许设置为null以移除分类
          updates.category_id = null;
        }
      }

      // 确保更新的类型仍然是博客类型
      updates.type = 'blog';

      const result = await Post.update(parseInt(id), userId, updates);
      
      if (result.changes === 0) {
        return res.status(404).json({ error: '博客文章不存在或更新失败' });
      }

      const updatedPost = await Post.findById(id);
      res.json({ message: '博客文章更新成功', post: updatedPost });
    } catch (error) {
      console.error('更新博客文章错误:', error);
      res.status(500).json({ error: error.message });
    }
  }
);

// 删除博客文章（需要用户鉴权）
router.delete('/:id', 
  authenticateToken,
  [
    param('id').isInt({ min: 1 }).withMessage('博客文章ID必须是正整数')
  ],
  async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      // 检查帖子是否属于当前用户且是博客类型
      const post = await Post.findById(id);
      if (!post || post.type !== 'blog') {
        return res.status(404).json({ error: '博客文章不存在' });
      }

      const belongsToUser = await Post.belongsToUser(parseInt(id), userId);
      if (!belongsToUser) {
        return res.status(403).json({ error: '只有博客文章作者可以删除博客文章' });
      }

      const result = await Post.delete(parseInt(id), userId);
      
      if (result.changes === 0) {
        return res.status(404).json({ error: '博客文章不存在或删除失败' });
      }

      res.json({ message: '博客文章删除成功' });
    } catch (error) {
      console.error('删除博客文章错误:', error);
      res.status(500).json({ error: error.message });
    }
  }
);

// ========== 博客分类功能 ==========
// 创建博客分类
router.post('/categories', 
  authenticateToken,
  [
    body('name').trim().isLength({ min: 1, max: 50 }).withMessage('分类名称不能为空且长度不能超过50个字符'),
    body('description').optional().trim().isLength({ max: 200 }).withMessage('分类描述长度不能超过200个字符')
  ],
  async (req, res) => {
    try {
      const { name, description } = req.body;
      const userId = req.user.id;

      // 检查是否已存在同名分类
      const existingCategory = await BlogCategory.findByNameAndUser(name, userId);
      if (existingCategory) {
        return res.status(409).json({ error: '分类名称已存在' });
      }

      const categoryData = {
        name,
        description: description || null,
        user_id: userId
      };

      const categoryId = await BlogCategory.create(categoryData);
      const category = await BlogCategory.findById(categoryId);

      res.status(201).json({ message: '博客分类创建成功', category });
    } catch (error) {
      console.error('创建博客分类错误:', error);
      res.status(500).json({ error: error.message });
    }
  }
);

// 获取用户的所有博客分类
router.get('/categories/user/:userId', 
  [
    param('userId').isInt({ min: 1 }).withMessage('用户ID必须是正整数')
  ],
  async (req, res) => {
    try {
      const { userId } = req.params;

      const categories = await BlogCategory.findByUser(parseInt(userId));

      res.json({ categories });
    } catch (error) {
      console.error('获取用户博客分类列表错误:', error);
      res.status(500).json({ error: error.message });
    }
  }
);

// 获取分类详情
router.get('/categories/:id', 
  [
    param('id').isInt({ min: 1 }).withMessage('分类ID必须是正整数')
  ],
  async (req, res) => {
    try {
      const { id } = req.params;

      const category = await BlogCategory.findById(parseInt(id));
      if (!category) {
        return res.status(404).json({ error: '分类不存在' });
      }

      res.json({ category });
    } catch (error) {
      console.error('获取分类详情错误:', error);
      res.status(500).json({ error: error.message });
    }
  }
);

// 更新博客分类
router.put('/categories/:id', 
  authenticateToken,
  [
    param('id').isInt({ min: 1 }).withMessage('分类ID必须是正整数'),
    body('name').optional().trim().isLength({ min: 1, max: 50 }).withMessage('分类名称不能为空且长度不能超过50个字符'),
    body('description').optional().trim().isLength({ max: 200 }).withMessage('分类描述长度不能超过200个字符')
  ],
  async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.id;
      const updates = req.body;

      // 检查分类是否属于当前用户
      const belongsToUser = await BlogCategory.belongsToUser(parseInt(id), userId);
      if (!belongsToUser) {
        return res.status(403).json({ error: '只有分类创建者可以编辑分类' });
      }

      // 检查是否已存在同名分类（排除当前分类）
      if (updates.name) {
        const existingCategory = await BlogCategory.findByNameAndUser(updates.name, userId);
        if (existingCategory && existingCategory.id !== parseInt(id)) {
          return res.status(409).json({ error: '分类名称已存在' });
        }
      }

      const result = await BlogCategory.update(parseInt(id), userId, updates);
      
      if (result.changes === 0) {
        return res.status(404).json({ error: '分类不存在或更新失败' });
      }

      const category = await BlogCategory.findById(parseInt(id));
      res.json({ message: '博客分类更新成功', category });
    } catch (error) {
      console.error('更新博客分类错误:', error);
      res.status(500).json({ error: error.message });
    }
  }
);

// 删除博客分类
router.delete('/categories/:id', 
  authenticateToken,
  [
    param('id').isInt({ min: 1 }).withMessage('分类ID必须是正整数')
  ],
  async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      // 检查分类是否属于当前用户
      const belongsToUser = await BlogCategory.belongsToUser(parseInt(id), userId);
      if (!belongsToUser) {
        return res.status(403).json({ error: '只有分类创建者可以删除分类' });
      }

      const result = await BlogCategory.delete(parseInt(id), userId);
      
      if (result.changes === 0) {
        return res.status(404).json({ error: '分类不存在或删除失败' });
      }

      res.json({ message: '博客分类删除成功' });
    } catch (error) {
      console.error('删除博客分类错误:', error);
      res.status(500).json({ error: error.message });
    }
  }
);

module.exports = router;