const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { Follow, User } = require('../models');

// 关注用户 - 需要鉴权
router.post('/', authenticateToken, async (req, res) => {
  try {
    const followerId = req.user.id;
    const { followingId } = req.body;

    // 验证输入
    if (!followingId) {
      return res.status(400).json({ success: false, message: '被关注用户ID不能为空' });
    }

    // 检查被关注用户是否存在
    const user = await User.findById(followingId);
    if (!user) {
      return res.status(404).json({ success: false, message: '被关注用户不存在' });
    }

    // 检查是否试图关注自己
    if (followerId === followingId) {
      return res.status(400).json({ success: false, message: '不能关注自己' });
    }

    // 执行关注操作
    const followResult = await Follow.follow(followerId, followingId);

    res.json({
      success: true,
      data: followResult,
      message: followResult.alreadyFollowing ? '已经关注该用户' : '关注成功'
    });
  } catch (error) {
    console.error('关注用户错误:', error);
    res.status(500).json({ success: false, message: '服务器内部错误' });
  }
});

// 取消关注 - 需要鉴权
router.delete('/:followingId', authenticateToken, async (req, res) => {
  try {
    const followerId = req.user.id;
    const { followingId } = req.params;

    // 检查被取消关注用户是否存在
    const user = await User.findById(followingId);
    if (!user) {
      return res.status(404).json({ success: false, message: '被取消关注用户不存在' });
    }

    // 执行取消关注操作
    const result = await Follow.unfollow(followerId, followingId);

    if (result.changes === 0) {
      return res.status(404).json({ success: false, message: '未关注该用户或取消关注失败' });
    }

    res.json({
      success: true,
      message: '取消关注成功'
    });
  } catch (error) {
    console.error('取消关注错误:', error);
    res.status(500).json({ success: false, message: '服务器内部错误' });
  }
});

// 检查是否关注了指定用户 - 需要鉴权
router.get('/check/:followingId', authenticateToken, async (req, res) => {
  try {
    const followerId = req.user.id;
    const { followingId } = req.params;

    const isFollowing = await Follow.isFollowing(followerId, followingId);

    res.json({
      success: true,
      data: { isFollowing },
      message: '检查关注状态成功'
    });
  } catch (error) {
    console.error('检查关注状态错误:', error);
    res.status(500).json({ success: false, message: '服务器内部错误' });
  }
});

// 获取用户的关注列表 - 无需鉴权
router.get('/following/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;

    // 检查用户是否存在
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: '用户不存在' });
    }

    const followingList = await Follow.getFollowingList(userId, page, limit);
    const followingCount = await Follow.getFollowingCount(userId);

    res.json({
      success: true,
      data: {
        followingList,
        followingCount,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(followingCount / limit),
          totalItems: followingCount,
          hasNextPage: page * limit < followingCount,
          hasPrevPage: page > 1
        }
      },
      message: '获取关注列表成功'
    });
  } catch (error) {
    console.error('获取关注列表错误:', error);
    res.status(500).json({ success: false, message: '服务器内部错误' });
  }
});

// 获取用户的粉丝列表 - 无需鉴权
router.get('/followers/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;

    // 检查用户是否存在
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: '用户不存在' });
    }

    const followerList = await Follow.getFollowerList(userId, page, limit);
    const followerCount = await Follow.getFollowerCount(userId);

    res.json({
      success: true,
      data: {
        followerList,
        followerCount,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(followerCount / limit),
          totalItems: followerCount,
          hasNextPage: page * limit < followerCount,
          hasPrevPage: page > 1
        }
      },
      message: '获取粉丝列表成功'
    });
  } catch (error) {
    console.error('获取粉丝列表错误:', error);
    res.status(500).json({ success: false, message: '服务器内部错误' });
  }
});

module.exports = router;