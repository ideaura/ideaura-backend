const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { User, Friend } = require('../models');

// 发送好友请求
router.post('/request', authenticateToken, async (req, res) => {
  const { userId } = req.body;
  const currentUserId = req.user.id;

  // 验证目标用户ID
  if (!userId || isNaN(userId)) {
    return res.status(400).json({
      success: false,
      message: '目标用户ID无效'
    });
  }

  // 不能添加自己为好友
  if (parseInt(userId) === currentUserId) {
    return res.status(400).json({
      success: false,
      message: '不能添加自己为好友'
    });
  }

  try {
    // 检查目标用户是否存在
    const targetUser = await User.findById(userId);
    if (!targetUser) {
      return res.status(404).json({
        success: false,
        message: '目标用户不存在'
      });
    }

    // 创建好友请求
    const result = await Friend.createFriendRequest(currentUserId, parseInt(userId));

    res.json({
      success: true,
      data: result,
      message: '好友请求已发送'
    });
  } catch (error) {
    console.error('发送好友请求错误:', error);
    res.status(500).json({
      success: false,
      message: '服务器错误'
    });
  }
});

// 接受好友请求
router.post('/request/:requestId/accept', authenticateToken, async (req, res) => {
  const { requestId } = req.params;
  const currentUserId = req.user.id;

  if (!requestId || isNaN(requestId)) {
    return res.status(400).json({
      success: false,
      message: '好友请求ID无效'
    });
  }

  try {
    const result = await Friend.acceptFriendRequest(parseInt(requestId), currentUserId);

    res.json({
      success: true,
      data: result,
      message: '好友请求已接受'
    });
  } catch (error) {
    console.error('接受好友请求错误:', error);
    res.status(error.message.includes('不存在') ? 404 : 500).json({
      success: false,
      message: error.message || '服务器错误'
    });
  }
});

// 拒绝好友请求
router.delete('/request/:requestId', authenticateToken, async (req, res) => {
  const { requestId } = req.params;
  const currentUserId = req.user.id;

  if (!requestId || isNaN(requestId)) {
    return res.status(400).json({
      success: false,
      message: '好友请求ID无效'
    });
  }

  try {
    const result = await Friend.rejectFriendRequest(parseInt(requestId), currentUserId);

    res.json({
      success: true,
      data: result,
      message: '好友请求已拒绝'
    });
  } catch (error) {
    console.error('拒绝好友请求错误:', error);
    res.status(error.message.includes('不存在') ? 404 : 500).json({
      success: false,
      message: error.message || '服务器错误'
    });
  }
});

// 获取收到的好友请求列表
router.get('/requests/received', authenticateToken, async (req, res) => {
  const currentUserId = req.user.id;

  try {
    const requests = await Friend.getReceivedFriendRequests(currentUserId);

    res.json({
      success: true,
      data: requests,
      total: requests.length
    });
  } catch (error) {
    console.error('获取收到的好友请求错误:', error);
    res.status(500).json({
      success: false,
      message: '服务器错误'
    });
  }
});

// 获取发送的好友请求列表
router.get('/requests/sent', authenticateToken, async (req, res) => {
  const currentUserId = req.user.id;

  try {
    const requests = await Friend.getSentFriendRequests(currentUserId);

    res.json({
      success: true,
      data: requests,
      total: requests.length
    });
  } catch (error) {
    console.error('获取发送的好友请求错误:', error);
    res.status(500).json({
      success: false,
      message: '服务器错误'
    });
  }
});

// 获取好友列表
router.get('', authenticateToken, async (req, res) => {
  const currentUserId = req.user.id;

  try {
    const friends = await Friend.getUserFriends(currentUserId);

    res.json({
      success: true,
      data: friends,
      total: friends.length
    });
  } catch (error) {
    console.error('获取好友列表错误:', error);
    res.status(500).json({
      success: false,
      message: '服务器错误'
    });
  }
});

// 删除好友
router.delete('/:friendId', authenticateToken, async (req, res) => {
  const { friendId } = req.params;
  const currentUserId = req.user.id;

  if (!friendId || isNaN(friendId)) {
    return res.status(400).json({
      success: false,
      message: '好友ID无效'
    });
  }

  try {
    // 检查是否为好友关系
    const areCurrentlyFriends = await Friend.areFriends(currentUserId, parseInt(friendId));
    if (!areCurrentlyFriends) {
      return res.status(400).json({
        success: false,
        message: '用户不是您的好友'
      });
    }

    const result = await Friend.removeFriend(currentUserId, parseInt(friendId));

    res.json({
      success: true,
      data: result,
      message: '好友已删除'
    });
  } catch (error) {
    console.error('删除好友错误:', error);
    res.status(500).json({
      success: false,
      message: '服务器错误'
    });
  }
});

// 检查与指定用户是否为好友
router.get('/check/:userId', authenticateToken, async (req, res) => {
  const { userId } = req.params;
  const currentUserId = req.user.id;

  if (!userId || isNaN(userId)) {
    return res.status(400).json({
      success: false,
      message: '用户ID无效'
    });
  }

  try {
    const areFriends = await Friend.areFriends(currentUserId, parseInt(userId));

    res.json({
      success: true,
      data: { areFriends }
    });
  } catch (error) {
    console.error('检查好友关系错误:', error);
    res.status(500).json({
      success: false,
      message: '服务器错误'
    });
  }
});

// 获取好友总数
router.get('/count', authenticateToken, async (req, res) => {
  const currentUserId = req.user.id;

  try {
    const count = await Friend.getFriendCount(currentUserId);

    res.json({
      success: true,
      data: { count }
    });
  } catch (error) {
    console.error('获取好友总数错误:', error);
    res.status(500).json({
      success: false,
      message: '服务器错误'
    });
  }
});

// 获取待处理的好友请求数量
router.get('/requests/pending/count', authenticateToken, async (req, res) => {
  const currentUserId = req.user.id;

  try {
    const count = await Friend.getPendingRequestCount(currentUserId);

    res.json({
      success: true,
      data: { count }
    });
  } catch (error) {
    console.error('获取待处理好友请求数量错误:', error);
    res.status(500).json({
      success: false,
      message: '服务器错误'
    });
  }
});

module.exports = router;