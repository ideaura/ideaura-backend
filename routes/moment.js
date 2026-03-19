const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { Moment } = require('../models');

// 导入其他相关模型
const { User, Follow, Comment, Like } = require('../models');

// 发布动态 - 需要鉴权
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { content, type = 'public', visibility = 'public' } = req.body;
    const userId = req.user.id;

    // 验证输入
    if (!content || content.trim().length === 0) {
      return res.status(400).json({ success: false, message: '动态内容不能为空' });
    }

    // 创建动态
    const moment = await Moment.create(userId, content.trim(), type, visibility);

    res.status(201).json({
      success: true,
      data: {
        id: moment.id,
        userId: moment.userId,
        content: moment.content,
        type: moment.type,
        visibility: moment.visibility,
        createdAt: moment.createdAt
      },
      message: '动态发布成功'
    });
  } catch (error) {
    console.error('发布动态错误:', error);
    res.status(500).json({ success: false, message: '服务器内部错误' });
  }
});

// 获取公共动态 - 无需鉴权
router.get('/public', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    const moments = await Moment.getPublicMoments(page, limit);

    // SQL 已通过 LEFT JOIN COUNT 聚合返回统计字段
    const momentsWithStats = moments.map((moment) => ({
      ...moment,
      likeCount: moment.likesCount || 0,
      commentCount: moment.commentsCount || 0
    }));

    res.json({
      success: true,
      data: momentsWithStats,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(momentsWithStats.length / limit), // 实际应该从数据库查询总数
        totalItems: momentsWithStats.length,
        hasNextPage: false, // 实际应该根据总数计算
        hasPrevPage: page > 1
      },
      message: '获取公共动态成功'
    });
  } catch (error) {
    console.error('获取公共动态错误:', error);
    res.status(500).json({ success: false, message: '服务器内部错误' });
  }
});

// 获取用户自己的动态 - 需要鉴权
router.get('/my', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;

    const moments = await Moment.getUserMoments(userId, page, limit);

    // SQL 已通过 LEFT JOIN COUNT 聚合返回统计字段
    const momentsWithStats = moments.map((moment) => ({
      ...moment,
      likeCount: moment.likesCount || 0,
      commentCount: moment.commentsCount || 0
    }));

    res.json({
      success: true,
      data: momentsWithStats,
      message: '获取我的动态成功'
    });
  } catch (error) {
    console.error('获取我的动态错误:', error);
    res.status(500).json({ success: false, message: '服务器内部错误' });
  }
});

// 获取特定用户的动态 - 无需鉴权（公开部分）
router.get('/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;

    // 检查用户是否存在
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: '用户不存在' });
    }

    const moments = await Moment.getUserMoments(userId, page, limit);

    // 过滤只返回公开的动态
    const publicMoments = moments.filter(moment => moment.visibility === 'public');

    // SQL 已通过 LEFT JOIN COUNT 聚合返回统计字段
    const momentsWithStats = publicMoments.map((moment) => ({
      ...moment,
      likeCount: moment.likesCount || 0,
      commentCount: moment.commentsCount || 0
    }));

    res.json({
      success: true,
      data: momentsWithStats,
      message: '获取用户动态成功'
    });
  } catch (error) {
    console.error('获取用户动态错误:', error);
    res.status(500).json({ success: false, message: '服务器内部错误' });
  }
});

// 获取好友动态 - 需要鉴权
router.get('/friends', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;

    const moments = await Moment.getFriendMoments(userId, page, limit);

    // SQL 已通过 LEFT JOIN COUNT 聚合返回统计字段
    const momentsWithStats = moments.map((moment) => ({
      ...moment,
      likeCount: moment.likesCount || 0,
      commentCount: moment.commentsCount || 0
    }));

    res.json({
      success: true,
      data: momentsWithStats,
      message: '获取好友动态成功'
    });
  } catch (error) {
    console.error('获取好友动态错误:', error);
    res.status(500).json({ success: false, message: '服务器内部错误' });
  }
});

// 获取关注用户的公共动态 - 需要鉴权
router.get('/following', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;

    const moments = await Moment.getFollowingPublicMoments(userId, page, limit);

    // SQL 已通过 LEFT JOIN COUNT 聚合返回统计字段
    const momentsWithStats = moments.map((moment) => ({
      ...moment,
      likeCount: moment.likesCount || 0,
      commentCount: moment.commentsCount || 0
    }));

    res.json({
      success: true,
      data: momentsWithStats,
      message: '获取关注用户动态成功'
    });
  } catch (error) {
    console.error('获取关注用户动态错误:', error);
    res.status(500).json({ success: false, message: '服务器内部错误' });
  }
});

// 获取动态详情 - 无需鉴权（如果是公开的）
router.get('/:momentId', async (req, res) => {
  try {
    const { momentId } = req.params;

    const moment = await Moment.findById(momentId);
    if (!moment) {
      return res.status(404).json({ success: false, message: '动态不存在' });
    }

    // 检查动态是否公开可访问
    if (moment.visibility !== 'public') {
      // 如果不是公开动态，暂时返回404（实际应用中可能需要更复杂的权限检查）
      return res.status(404).json({ success: false, message: '动态不存在或无法访问' });
    }

    // 获取点赞数和评论数
    const likeCount = await Like.getLikesCount(momentId);
    const commentCount = await new Promise((resolve) => {
      Comment.getByMomentId(momentId, 1, 1)
        .then(comments => resolve(comments.length))
        .catch(() => resolve(0));
    });

    res.json({
      success: true,
      data: {
        ...moment,
        likeCount,
        commentCount
      },
      message: '获取动态详情成功'
    });
  } catch (error) {
    console.error('获取动态详情错误:', error);
    res.status(500).json({ success: false, message: '服务器内部错误' });
  }
});

// 更新动态 - 需要鉴权且只能更新自己的动态
router.put('/:momentId', authenticateToken, async (req, res) => {
  try {
    const { momentId } = req.params;
    const userId = req.user.id;
    const { content, type, visibility } = req.body;

    // 验证输入
    if (!content && type === undefined && visibility === undefined) {
      return res.status(400).json({ success: false, message: '至少需要提供一个要更新的字段' });
    }

    // 检查动态是否存在且属于当前用户
    const moment = await Moment.findById(momentId);
    if (!moment || moment.userId !== userId) {
      return res.status(404).json({ success: false, message: '动态不存在或无权限修改' });
    }

    const updateData = {};
    if (content !== undefined) updateData.content = content;
    if (type !== undefined) updateData.type = type;
    if (visibility !== undefined) updateData.visibility = visibility;

    const result = await Moment.update(momentId, userId, updateData);

    if (result.changes === 0) {
      return res.status(400).json({ success: false, message: '更新失败' });
    }

    res.json({
      success: true,
      message: '动态更新成功'
    });
  } catch (error) {
    console.error('更新动态错误:', error);
    res.status(500).json({ success: false, message: '服务器内部错误' });
  }
});

// 删除动态 - 需要鉴权且只能删除自己的动态
router.delete('/:momentId', authenticateToken, async (req, res) => {
  try {
    const { momentId } = req.params;
    const userId = req.user.id;

    const result = await Moment.delete(momentId, userId);

    if (result.changes === 0) {
      return res.status(404).json({ success: false, message: '动态不存在或无权限删除' });
    }

    res.json({
      success: true,
      message: '动态删除成功'
    });
  } catch (error) {
    console.error('删除动态错误:', error);
    res.status(500).json({ success: false, message: '服务器内部错误' });
  }
});

module.exports = router;