const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { Like, Moment, User, Post } = require('../models');

// 点赞 - 需要鉴权
router.post('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { momentId, postId } = req.body;

    // 验证输入
    if (!momentId && !postId) {
      return res.status(400).json({ success: false, message: '必须提供动态ID或帖子ID之一' });
    }
    if (momentId && postId) {
      return res.status(400).json({ success: false, message: '动态ID和帖子ID不能同时提供' });
    }

    // 检查动态或帖子是否存在
    if (momentId) {
      const moment = await Moment.findById(momentId);
      if (!moment) {
        return res.status(404).json({ success: false, message: '动态不存在' });
      }
    } else if (postId) {
      const post = await Post.findById(postId);
      if (!post) {
        return res.status(404).json({ success: false, message: '帖子不存在' });
      }
    }

    // 执行点赞操作
    const likeResult = await Like.like(userId, momentId, postId);

    res.json({
      success: true,
      data: likeResult,
      message: likeResult.alreadyLiked ? '已经点赞该动态或帖子' : '点赞成功'
    });
  } catch (error) {
    console.error('点赞错误:', error);
    res.status(500).json({ success: false, message: '服务器内部错误' });
  }
});

// 取消点赞 - 需要鉴权
router.delete('/:targetId', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { targetId } = req.params;
    const targetType = req.query.targetType || 'moment'; // 默认为moment

    // 验证targetType参数
    if (!['moment', 'post'].includes(targetType)) {
      return res.status(400).json({ success: false, message: 'targetType参数必须是moment或post' });
    }

    // 检查动态或帖子是否存在
    if (targetType === 'moment') {
      const moment = await Moment.findById(targetId);
      if (!moment) {
        return res.status(404).json({ success: false, message: '动态不存在' });
      }
    } else if (targetType === 'post') {
      const post = await Post.findById(targetId);
      if (!post) {
        return res.status(404).json({ success: false, message: '帖子不存在' });
      }
    }

    // 执行取消点赞操作
    const result = await Like.unlike(userId, targetType === 'moment' ? targetId : null, targetType === 'post' ? targetId : null);

    if (result.changes === 0) {
      return res.status(404).json({ success: false, message: '未对该动态或帖子点赞或取消点赞失败' });
    }

    res.json({
      success: true,
      message: '取消点赞成功'
    });
  } catch (error) {
    console.error('取消点赞错误:', error);
    res.status(500).json({ success: false, message: '服务器内部错误' });
  }
});

// 检查是否点赞了指定动态或帖子 - 需要鉴权
router.get('/check/:targetId', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { targetId } = req.params;
    const targetType = req.query.targetType || 'moment'; // 默认为moment

    // 验证targetType参数
    if (!['moment', 'post'].includes(targetType)) {
      return res.status(400).json({ success: false, message: 'targetType参数必须是moment或post' });
    }

    const isLiked = await Like.isLiked(userId, targetType === 'moment' ? targetId : null, targetType === 'post' ? targetId : null);

    res.json({
      success: true,
      data: { isLiked },
      message: '检查点赞状态成功'
    });
  } catch (error) {
    console.error('检查点赞状态错误:', error);
    res.status(500).json({ success: false, message: '服务器内部错误' });
  }
});

// 获取动态的点赞列表 - 无需鉴权（公开部分）
router.get('/moment/:momentId', async (req, res) => {
  try {
    const { momentId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;

    // 检查动态是否存在
    const moment = await Moment.findById(momentId);
    if (!moment) {
      return res.status(404).json({ success: false, message: '动态不存在' });
    }

    // 检查动态是否公开可访问
    if (moment.visibility !== 'public') {
      // 如果不是公开动态，暂时返回空列表
      return res.json({
        success: true,
        data: [],
        message: '获取点赞列表成功'
      });
    }

    const likes = await Like.getLikesByMomentId(momentId, page, limit);
    const likeCount = await Like.getLikesCount(momentId);

    res.json({
      success: true,
      data: {
        likes,
        likeCount,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(likeCount / limit),
          totalItems: likeCount,
          hasNextPage: page * limit < likeCount,
          hasPrevPage: page > 1
        }
      },
      message: '获取点赞列表成功'
    });
  } catch (error) {
    console.error('获取点赞列表错误:', error);
    res.status(500).json({ success: false, message: '服务器内部错误' });
  }
});

// 获取帖子的点赞列表 - 无需鉴权（公开部分）
router.get('/post/:postId', async (req, res) => {
  try {
    const { postId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;

    // 检查帖子是否存在
    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ success: false, message: '帖子不存在' });
    }

    // 检查帖子是否已发布（可访问）
    if (post.status !== 'published') {
      // 如果帖子未发布，返回空列表
      return res.json({
        success: true,
        data: [],
        message: '获取点赞列表成功'
      });
    }

    const likes = await Like.getLikesByPostId(postId, page, limit);
    const likeCount = await Like.getLikesCount(null, postId);

    res.json({
      success: true,
      data: {
        likes,
        likeCount,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(likeCount / limit),
          totalItems: likeCount,
          hasNextPage: page * limit < likeCount,
          hasPrevPage: page > 1
        }
      },
      message: '获取点赞列表成功'
    });
  } catch (error) {
    console.error('获取帖子点赞列表错误:', error);
    res.status(500).json({ success: false, message: '服务器内部错误' });
  }
});

module.exports = router;