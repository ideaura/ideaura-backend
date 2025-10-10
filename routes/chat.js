const express = require('express');
const router = express.Router();

const Topic = require('../models/Topic');
const Message = require('../models/Message');
const { broadcastMessage } = require('../services/mqtt');
const { validateTopicName, validateTopicDescription } = require('../utils/validators');
const { getCalibratedTime } = require('../utils/timezone');
const { authenticateToken } = require('../middleware/auth');

// 获取用户加入的话题列表
router.get('/chat/topics', authenticateToken, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const topics = await Topic.findByUser(req.user.id, limit);
    
    res.json({
      success: true,
      data: topics
    });
  } catch (error) {
    console.error("获取用户话题列表错误:", error);
    res.status(500).json({ 
      success: false, 
      message: '服务器错误' 
    });
  }
});

// 获取所有公开话题列表
router.get('/chat/topics/all', authenticateToken, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const topics = await Topic.findAll(limit);
    
    res.json({
      success: true,
      data: topics
    });
  } catch (error) {
    console.error("获取所有话题列表错误:", error);
    res.status(500).json({ 
      success: false, 
      message: '服务器错误' 
    });
  }
});

// 搜索话题（按名称或ID）
router.get('/chat/topics/search', authenticateToken, async (req, res) => {
  try {
    const { query, limit = 50 } = req.query;
    
    if (!query || query.trim().length < 1) {
      return res.status(400).json({
        success: false,
        message: '搜索关键词不能为空'
      });
    }

    const topics = await Topic.search(query.trim(), req.user.id, parseInt(limit));
    
    res.json({
      success: true,
      data: topics
    });
  } catch (error) {
    console.error("搜索话题错误:", error);
    res.status(500).json({ 
      success: false, 
      message: '服务器错误' 
    });
  }
});

// 发送消息到聊天室（默认）
router.post('/chat/messages', authenticateToken, async (req, res) => {
  const { content, topicId = null } = req.body; // topicId 为 null 表示发送到聊天室
  const userId = req.user.id;

  if (!content || content.trim() === '') {
    return res.status(400).json({ 
      success: false, 
      message: '消息内容不能为空' 
    });
  }

  try {
    // 如果指定了话题，验证话题是否存在且用户有权访问
    if (topicId) {
      const topic = await Topic.findById(topicId);
      if (!topic) {
        return res.status(400).json({ 
          success: false, 
          message: '话题不存在' 
        });
      }
      
      // 检查是否是私有话题且用户不是成员
      if (topic.is_private) {
        const isMember = await Topic.isMember(topicId, userId);
        if (!isMember) {
          return res.status(403).json({ 
            success: false, 
            message: '您没有权限在此话题中发送消息' 
          });
        }
      }
    }

    const messageId = await Message.create({
      topic_id: topicId, // 为 null 时是聊天室消息，不为 null 时是话题消息
      user_id: userId,
      content: content.trim()
    });

    const message = await Message.findById(messageId);
    
    // 广播消息给所有连接的客户端
    broadcastMessage(message);

    res.json({
      success: true,
      data: message,
      message: topicId ? '话题消息已发送' : '消息已发送到聊天室'
    });
  } catch (error) {
    console.error("发送消息错误:", error);
    res.status(500).json({ 
      success: false, 
      message: '服务器错误' 
    });
  }
});

// 发送私聊消息
router.post('/chat/private-messages', authenticateToken, async (req, res) => {
  const { content, receiverId } = req.body;
  const senderId = req.user.id;

  // 验证参数
  if (!content || content.trim() === '') {
    return res.status(400).json({ 
      success: false, 
      message: '消息内容不能为空' 
    });
  }

  if (!receiverId || isNaN(receiverId)) {
    return res.status(400).json({ 
      success: false, 
      message: '接收者ID无效' 
    });
  }

  // 不能给自己发私聊消息
  if (parseInt(receiverId) === senderId) {
    return res.status(400).json({ 
      success: false, 
      message: '不能给自己发送私聊消息' 
    });
  }

  try {
    // 创建私聊消息
    const privateMessage = await Message.createPrivate({
      sender_id: senderId,
      receiver_id: parseInt(receiverId),
      content: content.trim()
    });

    // 广播私聊消息（现在使用安全的主题）
    broadcastMessage({
      ...privateMessage,
      messageType: 'private'
    });

    res.json({
      success: true,
      data: privateMessage,
      message: '私聊消息已发送'
    });
  } catch (error) {
    console.error("发送私聊消息错误:", error);
    res.status(500).json({ 
      success: false, 
      message: '服务器错误' 
    });
  }
});

// 获取聊天室消息历史（包含所有消息）
router.get('/chat/messages', authenticateToken, async (req, res) => {
  const limit = parseInt(req.query.limit) || 50;
  const offset = parseInt(req.query.offset) || 0;

  try {
    const messages = await Message.findByChatroom(limit, offset);
    
    res.json({
      success: true,
      data: messages,
      total: messages.length
    });
  } catch (error) {
    console.error("获取消息历史错误:", error);
    res.status(500).json({ 
      success: false, 
      message: '服务器错误' 
    });
  }
});

// 获取特定话题的消息历史
router.get('/chat/topics/:topicId/messages', authenticateToken, async (req, res) => {
  const topicId = req.params.topicId;
  const limit = parseInt(req.query.limit) || 50;
  const offset = parseInt(req.query.offset) || 0;
  const userId = req.user.id;

  try {
    // 验证话题是否存在
    const topic = await Topic.findById(topicId);
    if (!topic) {
      return res.status(404).json({ 
        success: false, 
        message: '话题不存在' 
      });
    }
    
    // 检查是否是私有话题且用户不是成员
    if (topic.is_private) {
      const isMember = await Topic.isMember(topicId, userId);
      if (!isMember) {
        return res.status(403).json({ 
          success: false, 
          message: '您没有权限查看此话题的消息' 
        });
      }
    }

    const messages = await Message.findByTopic(topicId, limit, offset);
    
    res.json({
      success: true,
      data: {
        topic,
        messages,
        total: messages.length
      }
    });
  } catch (error) {
    console.error("获取话题消息历史错误:", error);
    res.status(500).json({ 
      success: false, 
      message: '服务器错误' 
    });
  }
});

// 获取与特定用户的私聊消息历史
router.get('/chat/private-messages/:userId', authenticateToken, async (req, res) => {
  const otherUserId = req.params.userId;
  const currentUserId = req.user.id;
  const limit = parseInt(req.query.limit) || 50;
  const offset = parseInt(req.query.offset) || 0;

  // 验证用户ID
  if (isNaN(otherUserId)) {
    return res.status(400).json({ 
      success: false, 
      message: '用户ID无效' 
    });
  }

  try {
    const messages = await Message.findPrivateMessagesBetweenUsers(
      currentUserId, 
      parseInt(otherUserId), 
      limit, 
      offset
    );
    
    // 标记这些消息为已读
    await Message.markPrivateMessagesAsReadBetweenUsers(
      currentUserId, 
      parseInt(otherUserId)
    );
    
    res.json({
      success: true,
      data: messages,
      total: messages.length
    });
  } catch (error) {
    console.error("获取私聊消息历史错误:", error);
    res.status(500).json({ 
      success: false, 
      message: '服务器错误' 
    });
  }
});

// 获取未读私聊消息
router.get('/chat/private-messages/unread', authenticateToken, async (req, res) => {
  const userId = req.user.id;

  try {
    const messages = await Message.findUnreadPrivateMessagesByReceiver(userId);
    
    res.json({
      success: true,
      data: messages,
      total: messages.length
    });
  } catch (error) {
    console.error("获取未读私聊消息错误:", error);
    res.status(500).json({ 
      success: false, 
      message: '服务器错误' 
    });
  }
});

// 获取未读私聊消息数量
router.get('/chat/private-messages/unread/count', authenticateToken, async (req, res) => {
  const userId = req.user.id;

  try {
    const count = await Message.getUnreadPrivateMessageCount(userId);
    
    res.json({
      success: true,
      data: { count }
    });
  } catch (error) {
    console.error("获取未读私聊消息数量错误:", error);
    res.status(500).json({ 
      success: false, 
      message: '服务器错误' 
    });
  }
});

// 获取在线用户数
router.get('/chat/online-users', authenticateToken, (req, res) => {
  res.json({
    success: true,
    data: {
      onlineCount: global.connectedClients ? global.connectedClients.size : 0,
      timestamp: getCalibratedTime().toISOString()
    }
  });
});

// 创建话题（支持私有话题）
router.post('/chat/topics', authenticateToken, async (req, res) => {
  const { name, description, isPrivate = false } = req.body;
  const userId = req.user.id;

  if (!validateTopicName(name)) {
    return res.status(400).json({ 
      success: false, 
      message: '话题名称不能为空且不能超过50个字符' 
    });
  }

  if (!validateTopicDescription(description)) {
    return res.status(400).json({ 
      success: false, 
      message: '话题描述不能超过200个字符' 
    });
  }

  try {
    // 检查是否已存在同名话题
    const existingTopic = await Topic.findByName(name.trim());
    if (existingTopic) {
      return res.status(400).json({ 
        success: false, 
        message: '话题名称已存在' 
      });
    }

    // 创建新话题
    const topicId = await Topic.create({
      name: name.trim(),
      description: description ? description.trim() : null,
      created_by: userId,
      is_private: isPrivate ? 1 : 0
    });

    const topic = await Topic.findById(topicId);

    res.status(201).json({
      success: true,
      message: '话题创建成功',
      data: topic
    });
  } catch (error) {
    console.error("创建话题错误:", error);
    res.status(500).json({ 
      success: false, 
      message: '服务器错误' 
    });
  }
});

// 加入话题
router.post('/chat/topics/:topicId/join', authenticateToken, async (req, res) => {
  const topicId = req.params.topicId;
  const userId = req.user.id