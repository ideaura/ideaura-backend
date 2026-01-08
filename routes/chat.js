const express = require('express');
const router = express.Router();
const { processFileWithMd5 } = require('../middleware/fileUpload');

const Topic = require('../models/Topic');
const Message = require('../models/Message');
const User = require('../models/User');
const { broadcastMessage, broadcastMessageEvent, generateUserInboxTopic } = require('../services/mqtt');
const path = require('path');
const fs = require('fs');
const { validateTopicName, validateTopicDescription } = require('../utils/validators');
const { getCalibratedTime } = require('../utils/timezone');
const { authenticateToken } = require('../middleware/auth');

// 上传文件
router.post('/chat/upload', authenticateToken, processFileWithMd5, (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: '请选择要上传的文件'
      });
    }
    
    // 返回文件信息
    res.json({
      success: true,
      data: {
        filename: req.file.filename,
        originalname: req.file.originalname,
        size: req.file.size,
        mimetype: req.file.mimetype,
        path: `/uploads/${req.file.originalname}`, // 使用带扩展名的完整文件名
        url: `/static/uploads/${req.file.filename}` // 假设我们通过静态服务提供文件
      },
      message: '文件上传成功'
    });
  } catch (error) {
    console.error('文件上传错误:', error);
    res.status(500).json({
      success: false,
      message: '文件上传失败'
    });
  }
});

// 获取用户个人收件箱主题名称
router.get('/chat/user-inbox-topic', authenticateToken, (req, res) => {
  try {
    const userId = req.user.id;
    const inboxTopic = generateUserInboxTopic(userId);
    
    res.json({
      success: true,
      data: {
        inboxTopic: inboxTopic,
        userId: userId
      }
    });
  } catch (error) {
    console.error("获取用户收件箱主题错误:", error);
    res.status(500).json({ 
      success: false, 
      message: '服务器错误' 
    });
  }
});

// 获取用户加入的话题列表（带最新消息）
router.get('/chat/topics', authenticateToken, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const topics = await Topic.findByUserWithLatestMessage(req.user.id, limit);
    
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

// 获取所有话题列表（仅用户加入的，带最新消息）
router.get('/chat/topics/all', authenticateToken, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const topics = await Topic.findAllWithLatestMessage(req.user.id, limit);
    
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

// 搜索话题（按名称或ID，带最新消息）
router.get('/chat/topics/search', authenticateToken, async (req, res) => {
  try {
    const { query, limit = 50 } = req.query;
    
    if (!query || query.trim().length < 1) {
      return res.status(400).json({
        success: false,
        message: '搜索关键词不能为空'
      });
    }

    const topics = await Topic.searchWithLatestMessage(query.trim(), req.user.id, parseInt(limit));
    
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

// 获取推荐话题（带最新消息）
router.get('/chat/topics/recommended', authenticateToken, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    
    // 获取三类推荐话题
    const popularTopics = await Topic.getPopularTopicsWithLatestMessage(limit);
    const recentActiveTopics = await Topic.getRecentActiveTopicsWithLatestMessage(limit);
    const newTopics = await Topic.getNewTopicsWithLatestMessage(limit);
    
    res.json({
      success: true,
      data: {
        popular: popularTopics,
        recentActive: recentActiveTopics,
        new: newTopics
      }
    });
  } catch (error) {
    console.error("获取推荐话题错误:", error);
    res.status(500).json({ 
      success: false, 
      message: '服务器错误' 
    });
  }
});

// 发送消息到聊天室（默认）
router.post('/chat/messages', authenticateToken, processFileWithMd5, async (req, res) => {
  const { 
    content, 
    topicId = null, 
    messageType = 'normal', 
    messageSubtype = 'text', // 基本消息类型
    forwardSourceId = null, 
    quotedMessageId = null 
  } = req.body; // topicId 为 null 表示发送到聊天室
  
  const userId = req.user.id;
  
  // 验证基本消息类型
  const validBasicMessageTypes = ['text', 'image', 'video', 'file', 'markdown', 'html'];
  if (!validBasicMessageTypes.includes(messageSubtype)) {
    return res.status(400).json({ 
      success: false, 
      message: '无效的基本消息类型，支持的类型: text, image, video, file, markdown, html' 
    });
  }
  
  // 根据基本消息类型验证内容
  if (messageSubtype === 'text' || messageSubtype === 'markdown' || messageSubtype === 'html') {
    if (!content || content.trim() === '') {
      return res.status(400).json({ 
        success: false, 
        message: '消息内容不能为空' 
      });
    }
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
      
      // 检查用户是否被禁言
      const isMuted = await Topic.isUserMuted(topicId, userId);
      if (isMuted) {
        return res.status(403).json({ 
          success: false, 
          message: '您已被禁言，无法在此话题中发送消息' 
        });
      }
    }
    
    // 处理文件上传
    let fileUrl = null;
    let fileName = null;
    let fileSize = null;
    let fileType = null;
    
    if (req.file) {
      fileUrl = `/uploads/${req.file.originalname}`; // 使用带扩展名的文件名
      fileName = req.file.originalname;
      fileSize = req.file.size;
      fileType = req.file.mimetype;
      
      // 如果没有明确指定消息子类型，根据文件类型自动设置
      if (messageSubtype === 'text' && req.file.mimetype.startsWith('image/')) {
        messageSubtype = 'image';
      } else if (messageSubtype === 'text' && req.file.mimetype.startsWith('video/')) {
        messageSubtype = 'video';
      } else if (messageSubtype === 'text') {
        messageSubtype = 'file';
      }
    }
    
    // 如果是文件、图片或视频类型，但没有上传文件，则需要内容作为描述
    if ((messageSubtype === 'file' || messageSubtype === 'image' || messageSubtype === 'video') && !req.file) {
      return res.status(400).json({ 
        success: false, 
        message: '文件、图片或视频消息必须上传文件' 
      });
    }

    const messageId = await Message.create({
      topic_id: topicId, // 为 null 时是聊天室消息，不为 null 时是话题消息
      user_id: userId,
      content: content ? content.trim() : '',
      message_type: messageType,
      message_subtype: messageSubtype,
      forward_source_id: forwardSourceId ? parseInt(forwardSourceId) : null,
      quoted_message_id: quotedMessageId ? parseInt(quotedMessageId) : null,
      file_url: fileUrl,
      file_name: fileName,
      file_size: fileSize,
      file_type: fileType
    });

    const message = await Message.findById(messageId);
    
    // 输出调试信息
    console.log('准备广播的消息:', JSON.stringify(message, null, 2));
    
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
router.post('/chat/private-messages', authenticateToken, processFileWithMd5, async (req, res) => {
  const { 
    content, 
    receiverId, 
    messageType = 'normal', 
    messageSubtype = 'text' // 基本消息类型
  } = req.body;
  const senderId = req.user.id;
  
  // 验证基本消息类型
  const validBasicMessageTypes = ['text', 'image', 'video', 'file', 'markdown', 'html'];
  if (!validBasicMessageTypes.includes(messageSubtype)) {
    return res.status(400).json({ 
      success: false, 
      message: '无效的基本消息类型，支持的类型: text, image, video, file, markdown, html' 
    });
  }
  
  // 根据基本消息类型验证内容
  if (messageSubtype === 'text' || messageSubtype === 'markdown' || messageSubtype === 'html') {
    if (!content || content.trim() === '') {
      return res.status(400).json({ 
        success: false, 
        message: '消息内容不能为空' 
      });
    }
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
  
  // 处理文件上传
  let fileUrl = null;
  let fileName = null;
  let fileSize = null;
  let fileType = null;
  
  if (req.file) {
    fileUrl = `/uploads/${req.file.originalname}`; // 使用带扩展名的文件名
    fileName = req.file.originalname;
    fileSize = req.file.size;
    fileType = req.file.mimetype;
    
    // 如果没有明确指定消息子类型，根据文件类型自动设置
    if (messageSubtype === 'text' && req.file.mimetype.startsWith('image/')) {
      messageSubtype = 'image';
    } else if (messageSubtype === 'text' && req.file.mimetype.startsWith('video/')) {
      messageSubtype = 'video';
    } else if (messageSubtype === 'text') {
      messageSubtype = 'file';
    }
  }
  
  // 如果是文件、图片或视频类型，但没有上传文件，则需要内容作为描述
  if ((messageSubtype === 'file' || messageSubtype === 'image' || messageSubtype === 'video') && !req.file) {
    return res.status(400).json({ 
      success: false, 
      message: '文件、图片或视频消息必须上传文件' 
    });
  }

  try {
    // 创建私聊消息
    const privateMessage = await Message.createPrivate({
      sender_id: senderId,
      receiver_id: parseInt(receiverId),
      content: content ? content.trim() : '',
      message_type: messageType,
      message_subtype: messageSubtype,
      forward_source_id: req.body.forwardSourceId ? parseInt(req.body.forwardSourceId) : null,
      quoted_message_id: req.body.quotedMessageId ? parseInt(req.body.quotedMessageId) : null,
      file_url: fileUrl,
      file_name: fileName,
      file_size: fileSize,
      file_type: fileType
    });

    // 输出调试信息
    console.log('准备广播的私聊消息:', JSON.stringify(privateMessage, null, 2));
    
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

// 获取聊天室消息历史（仅公共聊天室消息）
router.get('/chat/messages', authenticateToken, async (req, res) => {
  const limit = parseInt(req.query.limit) || 50;
  const offset = parseInt(req.query.offset) || 0;

  try {
    const messages = await Message.findPublicChatroomMessages(limit, offset);
    
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
    
    // 检查用户是否是话题成员
    const isMember = await Topic.isMember(topicId, userId);
    if (!isMember) {
      return res.status(403).json({ 
        success: false, 
        message: '您没有权限查看此话题的消息' 
      });
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

// 获取与当前用户有过私聊的所有用户（带最新消息）
router.get('/chat/private-messages/users', authenticateToken, async (req, res) => {
  const userId = req.user.id;

  try {
    const users = await Message.getPrivateChatUsersWithLatestMessage(userId);
    
    res.json({
      success: true,
      data: users,
      total: users.length
    });
  } catch (error) {
    console.error("获取私聊用户列表错误:", error);
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

// 创建话题（所有话题默认为私有）
router.post('/chat/topics', authenticateToken, async (req, res) => {
  const { name, description } = req.body;
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

    // 创建新话题（默认为私有）
    const topicId = await Topic.create({
      name: name.trim(),
      description: description ? description.trim() : null,
      created_by: userId
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
  const userId = req.user.id;

  // 验证话题ID
  if (isNaN(topicId)) {
    return res.status(400).json({ 
      success: false, 
      message: '话题ID无效' 
    });
  }

  try {
    // 验证话题是否存在
    const topic = await Topic.findById(topicId);
    if (!topic) {
      return res.status(404).json({ 
        success: false, 
        message: '话题不存在' 
      });
    }

    // 如果是私有话题，只有创建者和管理员可以邀请他人加入
    if (topic.is_private) {
      const isCreatorOrAdmin = await Topic.isCreatorOrAdmin(topicId, userId);
      if (!isCreatorOrAdmin) {
        return res.status(403).json({ 
          success: false, 
          message: '只有话题创建者和管理员可以邀请他人加入私有话题' 
        });
      }
    }

    // 加入话题
    const result = await Topic.joinTopic(topicId, userId);
    
    res.json({
      success: true,
      message: '成功加入话题',
      data: result
    });
  } catch (error) {
    console.error("加入话题错误:", error);
    res.status(500).json({ 
      success: false, 
      message: error.message || '服务器错误' 
    });
  }
});

// 退出话题
router.post('/chat/topics/:topicId/leave', authenticateToken, async (req, res) => {
  const topicId = req.params.topicId;
  const userId = req.user.id;

  // 验证话题ID
  if (isNaN(topicId)) {
    return res.status(400).json({ 
      success: false, 
      message: '话题ID无效' 
    });
  }

  try {
    // 验证话题是否存在
    const topic = await Topic.findById(topicId);
    if (!topic) {
      return res.status(404).json({ 
        success: false, 
        message: '话题不存在' 
      });
    }

    // 退出话题
    const result = await Topic.leaveTopic(topicId, userId);
    
    res.json({
      success: true,
      message: '成功退出话题',
      data: result
    });
  } catch (error) {
    console.error("退出话题错误:", error);
    res.status(500).json({ 
      success: false, 
      message: error.message || '服务器错误' 
    });
  }
});

// 获取话题成员列表
router.get('/chat/topics/:topicId/members', authenticateToken, async (req, res) => {
  const topicId = req.params.topicId;
  const limit = parseInt(req.query.limit) || 50;
  const userId = req.user.id;

  // 验证话题ID
  if (isNaN(topicId)) {
    return res.status(400).json({ 
      success: false, 
      message: '话题ID无效' 
    });
  }

  try {
    // 验证话题是否存在
    const topic = await Topic.findById(topicId);
    if (!topic) {
      return res.status(404).json({ 
        success: false, 
        message: '话题不存在' 
      });
    }

    // 检查用户是否有权限查看成员列表
    const isMember = await Topic.isMember(topicId, userId);
    if (topic.is_private && !isMember) {
      return res.status(403).json({ 
        success: false, 
        message: '您没有权限查看此私有话题的成员列表' 
      });
    }

    // 获取成员列表
    const members = await Topic.getMembers(topicId, limit);
    const memberCount = await Topic.getMemberCount(topicId);
    
    res.json({
      success: true,
      data: {
        members,
        count: memberCount
      }
    });
  } catch (error) {
    console.error("获取话题成员列表错误:", error);
    res.status(500).json({ 
      success: false, 
      message: '服务器错误' 
    });
  }
});

// 设置话题管理员
router.post('/chat/topics/:topicId/admins/:adminId', authenticateToken, async (req, res) => {
  const topicId = req.params.topicId;
  const adminId = req.params.adminId;
  const userId = req.user.id;

  // 验证参数
  if (isNaN(topicId) || isNaN(adminId)) {
    return res.status(400).json({ 
      success: false, 
      message: '话题ID或用户ID无效' 
    });
  }

  try {
    // 验证话题是否存在
    const topic = await Topic.findById(topicId);
    if (!topic) {
      return res.status(404).json({ 
        success: false, 
        message: '话题不存在' 
      });
    }

    // 验证要设置为管理员的用户是否存在
    const user = await User.findById(adminId);
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: '用户不存在' 
      });
    }

    // 设置管理员
    const result = await Topic.setAdmin(topicId, userId, parseInt(adminId));
    
    res.json({
      success: true,
      message: '成功设置管理员',
      data: result
    });
  } catch (error) {
    console.error("设置管理员错误:", error);
    res.status(500).json({ 
      success: false, 
      message: error.message || '服务器错误' 
    });
  }
});

// 取消话题管理员
router.delete('/chat/topics/:topicId/admins/:adminId', authenticateToken, async (req, res) => {
  const topicId = req.params.topicId;
  const adminId = req.params.adminId;
  const userId = req.user.id;

  // 验证参数
  if (isNaN(topicId) || isNaN(adminId)) {
    return res.status(400).json({ 
      success: false, 
      message: '话题ID或用户ID无效' 
    });
  }

  try {
    // 验证话题是否存在
    const topic = await Topic.findById(topicId);
    if (!topic) {
      return res.status(404).json({ 
        success: false, 
        message: '话题不存在' 
      });
    }

    // 验证要取消管理员的用户是否存在
    const user = await User.findById(adminId);
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: '用户不存在' 
      });
    }

    // 取消管理员
    const result = await Topic.removeAdmin(topicId, userId, parseInt(adminId));
    
    res.json({
      success: true,
      message: '成功取消管理员',
      data: result
    });
  } catch (error) {
    console.error("取消管理员错误:", error);
    res.status(500).json({ 
      success: false, 
      message: error.message || '服务器错误' 
    });
  }
});

// 修改话题信息
router.put('/chat/topics/:topicId', authenticateToken, async (req, res) => {
  const topicId = req.params.topicId;
  const userId = req.user.id;
  const { name, description } = req.body;

  // 验证话题ID
  if (isNaN(topicId)) {
    return res.status(400).json({ 
      success: false, 
      message: '话题ID无效' 
    });
  }

  try {
    // 验证话题是否存在
    const topic = await Topic.findById(topicId);
    if (!topic) {
      return res.status(404).json({ 
        success: false, 
        message: '话题不存在' 
      });
    }

    // 验证用户是否有权限修改话题
    const isCreatorOrAdmin = await Topic.isCreatorOrAdmin(topicId, userId);
    if (!isCreatorOrAdmin) {
      return res.status(403).json({ 
        success: false, 
        message: '只有话题创建者和管理员可以修改话题信息' 
      });
    }

    // 验证参数
    if (name !== undefined && (!name || name.trim().length === 0 || name.length > 50)) {
      return res.status(400).json({ 
        success: false, 
        message: '话题名称不能为空且不能超过50个字符' 
      });
    }

    if (description !== undefined && description.length > 200) {
      return res.status(400).json({ 
        success: false, 
        message: '话题描述不能超过200个字符' 
      });
    }

    // 更新话题信息
    const updates = {};
    if (name !== undefined) updates.name = name.trim();
    if (description !== undefined) updates.description = description.trim();
    
    const result = await Topic.updateTopic(topicId, userId, updates);
    
    // 获取更新后的话题信息
    const updatedTopic = await Topic.findById(topicId);
    
    res.json({
      success: true,
      message: '话题信息更新成功',
      data: updatedTopic
    });
  } catch (error) {
    console.error("修改话题信息错误:", error);
    res.status(500).json({ 
      success: false, 
      message: error.message || '服务器错误' 
    });
  }
});

// 修改话题私有状态
router.put('/chat/topics/:topicId/private', authenticateToken, async (req, res) => {
  const topicId = req.params.topicId;
  const userId = req.user.id;
  const { is_private } = req.body;

  // 验证话题ID
  if (isNaN(topicId)) {
    return res.status(400).json({ 
      success: false, 
      message: '话题ID无效' 
    });
  }

  // 验证参数
  if (is_private === undefined) {
    return res.status(400).json({ 
      success: false, 
      message: 'is_private 参数为必填项' 
    });
  }

  try {
    // 验证话题是否存在
    const topic = await Topic.findById(topicId);
    if (!topic) {
      return res.status(404).json({ 
        success: false, 
        message: '话题不存在' 
      });
    }

    // 更新话题私有状态（只有创建者可以操作）
    const result = await Topic.updatePrivateStatus(topicId, userId, is_private);
    
    // 获取更新后的话题信息
    const updatedTopic = await Topic.findById(topicId);
    
    res.json({
      success: true,
      message: `话题已设置为${is_private ? '私有' : '公开'}`,
      data: updatedTopic
    });
  } catch (error) {
    console.error("修改话题私有状态错误:", error);
    res.status(500).json({ 
      success: false, 
      message: error.message || '服务器错误' 
    });
  }
});

// 设置话题公告
router.put('/chat/topics/:topicId/announcement', authenticateToken, async (req, res) => {
  const topicId = req.params.topicId;
  const userId = req.user.id;
  const { announcement } = req.body;

  // 验证话题ID
  if (isNaN(topicId)) {
    return res.status(400).json({ 
      success: false, 
      message: '话题ID无效' 
    });
  }

  try {
    // 验证话题是否存在
    const topic = await Topic.findById(topicId);
    if (!topic) {
      return res.status(404).json({ 
        success: false, 
        message: '话题不存在' 
      });
    }

    // 设置公告（只有创建者和管理员可以操作）
    const result = await Topic.setAnnouncement(topicId, userId, announcement);
    
    res.json({
      success: true,
      message: '公告设置成功',
      data: result
    });
  } catch (error) {
    console.error("设置话题公告错误:", error);
    res.status(500).json({ 
      success: false, 
      message: error.message || '服务器错误' 
    });
  }
});

// 获取话题公告
router.get('/chat/topics/:topicId/announcement', authenticateToken, async (req, res) => {
  const topicId = req.params.topicId;
  const userId = req.user.id;

  // 验证话题ID
  if (isNaN(topicId)) {
    return res.status(400).json({ 
      success: false, 
      message: '话题ID无效' 
    });
  }

  try {
    // 验证话题是否存在
    const topic = await Topic.findById(topicId);
    if (!topic) {
      return res.status(404).json({ 
        success: false, 
        message: '话题不存在' 
      });
    }

    // 检查用户是否有权限查看公告
    const isMember = await Topic.isMember(topicId, userId);
    if (topic.is_private && !isMember) {
      return res.status(403).json({ 
        success: false, 
        message: '您没有权限查看此私有话题的公告' 
      });
    }

    // 获取公告
    const announcement = await Topic.getAnnouncement(topicId);
      
    res.json({
      success: true,
      data: { announcement }
    });
  } catch (error) {
    console.error("获取话题公告错误:", error);
    res.status(500).json({ 
      success: false, 
      message: '服务器错误' 
    });
  }
});

// 移除话题成员
router.delete('/chat/topics/:topicId/members/:memberId', authenticateToken, async (req, res) => {
  const topicId = req.params.topicId;
  const memberId = req.params.memberId;
  const removerId = req.user.id;

  // 验证参数
  if (isNaN(topicId) || isNaN(memberId)) {
    return res.status(400).json({ 
      success: false, 
      message: '话题ID或用户ID无效' 
    });
  }

  try {
    // 验证话题是否存在
    const topic = await Topic.findById(topicId);
    if (!topic) {
      return res.status(404).json({ 
        success: false, 
        message: '话题不存在' 
      });
    }

    // 验证要移除的用户是否存在
    const user = await User.findById(memberId);
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: '用户不存在' 
      });
    }

    // 移除成员
    const result = await Topic.removeMember(topicId, removerId, parseInt(memberId));
      
    res.json({
      success: true,
      message: '成功移除成员',
      data: result
    });
  } catch (error) {
    console.error("移除成员错误:", error);
    res.status(500).json({ 
      success: false, 
      message: error.message || '服务器错误' 
    });
  }
});

// 禁言用户
router.post('/chat/topics/:topicId/muted/:userId', authenticateToken, async (req, res) => {
  const topicId = req.params.topicId;
  const userId = req.params.userId;
  const muterId = req.user.id;
  const { reason } = req.body;

  // 验证参数
  if (isNaN(topicId) || isNaN(userId)) {
    return res.status(400).json({ 
      success: false, 
      message: '话题ID或用户ID无效' 
    });
  }

  try {
    // 验证话题是否存在
    const topic = await Topic.findById(topicId);
    if (!topic) {
      return res.status(404).json({ 
        success: false, 
        message: '话题不存在' 
      });
    }

    // 验证要禁言的用户是否存在
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: '用户不存在' 
      });
    }

    // 禁言用户
    const result = await Topic.muteUser(topicId, muterId, parseInt(userId), reason);
      
    res.json({
      success: true,
      message: '成功禁言用户',
      data: result
    });
  } catch (error) {
    console.error("禁言用户错误:", error);
    res.status(500).json({ 
      success: false, 
      message: error.message || '服务器错误' 
    });
  }
});

// 解除禁言
router.delete('/chat/topics/:topicId/muted/:userId', authenticateToken, async (req, res) => {
  const topicId = req.params.topicId;
  const userId = req.params.userId;
  const unmuterId = req.user.id;

  // 验证参数
  if (isNaN(topicId) || isNaN(userId)) {
    return res.status(400).json({ 
      success: false, 
      message: '话题ID或用户ID无效' 
    });
  }

  try {
    // 验证话题是否存在
    const topic = await Topic.findById(topicId);
    if (!topic) {
      return res.status(404).json({ 
        success: false, 
        message: '话题不存在' 
      });
    }

    // 验证要解除禁言的用户是否存在
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: '用户不存在' 
      });
    }

    // 解除禁言
    const result = await Topic.unmuteUser(topicId, unmuterId, parseInt(userId));
      
    res.json({
      success: true,
      message: '成功解除禁言',
      data: result
    });
  } catch (error) {
    console.error("解除禁言错误:", error);
    res.status(500).json({ 
      success: false, 
      message: error.message || '服务器错误' 
    });
  }
});

// 检查用户是否被禁言
router.get('/chat/topics/:topicId/muted/check', authenticateToken, async (req, res) => {
  const topicId = req.params.topicId;
  const userId = req.user.id;

  // 验证参数
  if (isNaN(topicId)) {
    return res.status(400).json({ 
      success: false, 
      message: '话题ID无效' 
    });
  }

  try {
    // 验证话题是否存在
    const topic = await Topic.findById(topicId);
    if (!topic) {
      return res.status(404).json({ 
        success: false, 
        message: '话题不存在' 
      });
    }

    // 检查用户是否被禁言
    const isMuted = await Topic.isUserMuted(topicId, userId);
      
    // 如果被禁言，获取禁言信息
    let muteInfo = null;
    if (isMuted) {
      muteInfo = await Topic.getUserMuteInfo(topicId, userId);
    }
      
    res.json({
      success: true,
      data: {
        isMuted,
        muteInfo
      }
    });
  } catch (error) {
    console.error("检查禁言状态错误:", error);
    res.status(500).json({ 
      success: false, 
      message: error.message || '服务器错误' 
    });
  }
});

// 撤回消息
router.delete('/chat/messages/:messageId', authenticateToken, async (req, res) => {
  const messageId = req.params.messageId;
  const userId = req.user.id;
  const { isPrivate, topicId } = req.query;
  
  // 验证参数
  if (isNaN(messageId)) {
    return res.status(400).json({ 
      success: false, 
      message: '消息ID无效' 
    });
  }
  
  if (topicId && isNaN(topicId)) {
    return res.status(400).json({ 
      success: false, 
      message: '话题ID无效' 
    });
  }
  
  try {
    // 撤回消息
    const result = await Message.recallMessage(parseInt(messageId), userId, isPrivate === 'true', topicId ? parseInt(topicId) : null);
    
    if (result.success) {
      // 广播消息撤回事件
      const { broadcastMessageEvent } = require('../services/mqtt');
      broadcastMessageEvent({
        eventType: 'recall',
        messageId: parseInt(messageId),
        userId: userId,
        messageType: isPrivate === 'true' ? 'private' : 'public',
        topicId: topicId ? parseInt(topicId) : null,
        timestamp: new Date().toISOString()
      });
      
      res.json({
        success: true,
        message: '消息已撤回'
      });
    } else {
      res.status(403).json({
        success: false,
        message: '无法撤回消息，权限不足'
      });
    }
  } catch (error) {
    console.error("撤回消息错误:", error);
    res.status(500).json({ 
      success: false, 
      message: '服务器错误' 
    });
  }
});

// 编辑消息
router.put('/chat/messages/:messageId', authenticateToken, async (req, res) => {
  const messageId = req.params.messageId;
  const userId = req.user.id;
  const { content, isPrivate } = req.body;
  
  // 验证参数
  if (isNaN(messageId)) {
    return res.status(400).json({ 
      success: false, 
      message: '消息ID无效' 
    });
  }
  
  if (!content || content.trim() === '') {
    return res.status(400).json({ 
      success: false, 
      message: '消息内容不能为空' 
    });
  }
  
  try {
    // 编辑消息
    const result = await Message.editMessage(parseInt(messageId), userId, content.trim(), isPrivate === 'true');
    
    if (result.success) {
      // 获取更新后的消息
      let updatedMessage;
      if (isPrivate === 'true') {
        updatedMessage = await Message.findPrivateById(messageId);
      } else {
        updatedMessage = await Message.findById(messageId);
      }
      
      // 广播消息编辑事件
      const { broadcastMessageEvent } = require('../services/mqtt');
      broadcastMessageEvent({
        eventType: 'edit',
        messageId: parseInt(messageId),
        userId: userId,
        content: content.trim(),
        updatedMessage: updatedMessage,
        messageType: isPrivate === 'true' ? 'private' : 'public',
        timestamp: new Date().toISOString()
      });
      
      res.json({
        success: true,
        message: '消息已更新',
        data: updatedMessage
      });
    } else {
      res.status(403).json({
        success: false,
        message: '无法编辑消息，仅消息发送者可以编辑自己的消息'
      });
    }
  } catch (error) {
    console.error("编辑消息错误:", error);
    res.status(500).json({ 
      success: false, 
      message: '服务器错误' 
    });
  }
});

// 获取消息历史版本
router.get('/chat/messages/:messageId/versions', authenticateToken, async (req, res) => {
  const messageId = req.params.messageId;
  const { isPrivate } = req.query;
  
  // 验证参数
  if (isNaN(messageId)) {
    return res.status(400).json({ 
      success: false, 
      message: '消息ID无效' 
    });
  }
  
  try {
    // 获取消息历史版本
    const versions = await Message.getMessageVersions(parseInt(messageId), isPrivate === 'true');
    
    res.json({
      success: true,
      data: versions
    });
  } catch (error) {
    console.error("获取消息历史版本错误:", error);
    res.status(500).json({ 
      success: false, 
      message: '服务器错误' 
    });
  }
});

// 转发消息
router.post('/chat/messages/forward', authenticateToken, async (req, res) => {
  const userId = req.user.id;
  const { messageIds, targetTopicId, targetReceiverId } = req.body;
  
  // 验证参数
  if (!messageIds || !Array.isArray(messageIds) || messageIds.length === 0) {
    return res.status(400).json({ 
      success: false, 
      message: '必须提供至少一个消息ID' 
    });
  }
  
  if (!targetTopicId && !targetReceiverId) {
    return res.status(400).json({ 
      success: false, 
      message: '必须指定转发目标（话题ID或接收者ID）' 
    });
  }
  
  try {
    // 转发消息
    const result = await Message.forwardMessages(messageIds, userId, targetTopicId ? parseInt(targetTopicId) : null, targetReceiverId ? parseInt(targetReceiverId) : null);
    
    if (result.success) {
      res.json({
        success: true,
        message: `成功转发 ${result.forwardedMessages.length} 条消息`,
        data: result.forwardedMessages
      });
    } else {
      res.status(500).json({
        success: false,
        message: '转发消息失败'
      });
    }
  } catch (error) {
    console.error("转发消息错误:", error);
    res.status(500).json({ 
      success: false, 
      message: '服务器错误' 
    });
  }
});

// 发送引用消息
router.post('/chat/messages/quote', authenticateToken, processFileWithMd5, async (req, res) => {
  const { 
    content, 
    quotedMessageId, 
    topicId = null, 
    receiverId = null,
    messageSubtype = 'text' // 基本消息类型
  } = req.body;
  
  const userId = req.user.id;
  
  // 验证基本消息类型
  const validBasicMessageTypes = ['text', 'image', 'video', 'file', 'markdown', 'html'];
  if (!validBasicMessageTypes.includes(messageSubtype)) {
    return res.status(400).json({ 
      success: false, 
      message: '无效的基本消息类型，支持的类型: text, image, video, file, markdown, html' 
    });
  }
  
  // 根据基本消息类型验证内容
  if (messageSubtype === 'text' || messageSubtype === 'markdown' || messageSubtype === 'html') {
    if (!content || content.trim() === '') {
      return res.status(400).json({ 
        success: false, 
        message: '消息内容不能为空' 
      });
    }
  }
  
  if (!quotedMessageId || isNaN(quotedMessageId)) {
    return res.status(400).json({ 
      success: false, 
      message: '引用消息ID无效' 
    });
  }
  
  // 处理文件上传
  let fileUrl = null;
  let fileName = null;
  let fileSize = null;
  let fileType = null;
  
  if (req.file) {
    fileUrl = `/uploads/${req.file.originalname}`; // 使用带扩展名的文件名
    fileName = req.file.originalname;
    fileSize = req.file.size;
    fileType = req.file.mimetype;
    
    // 如果没有明确指定消息子类型，根据文件类型自动设置
    if (messageSubtype === 'text' && req.file.mimetype.startsWith('image/')) {
      messageSubtype = 'image';
    } else if (messageSubtype === 'text' && req.file.mimetype.startsWith('video/')) {
      messageSubtype = 'video';
    } else if (messageSubtype === 'text') {
      messageSubtype = 'file';
    }
  }
  
  // 如果是文件、图片或视频类型，但没有上传文件，则需要内容作为描述
  if ((messageSubtype === 'file' || messageSubtype === 'image' || messageSubtype === 'video') && !req.file) {
    return res.status(400).json({ 
      success: false, 
      message: '文件、图片或视频消息必须上传文件' 
    });
  }
  
  try {
    let newMessage;
    
    if (receiverId) {
      // 发送私聊引用消息
      newMessage = await Message.createPrivate({
        sender_id: userId,
        receiver_id: parseInt(receiverId),
        content: content ? content.trim() : '',
        message_subtype: messageSubtype,
        quoted_message_id: parseInt(quotedMessageId),
        file_url: fileUrl,
        file_name: fileName,
        file_size: fileSize,
        file_type: fileType
      });
      
      newMessage.messageType = 'private';
    } else {
      // 发送公共或话题引用消息
      const messageId = await Message.create({
        topic_id: topicId, // 为 null 时是聊天室消息，不为 null 时是话题消息
        user_id: userId,
        content: content ? content.trim() : '',
        message_subtype: messageSubtype,
        quoted_message_id: parseInt(quotedMessageId),
        file_url: fileUrl,
        file_name: fileName,
        file_size: fileSize,
        file_type: fileType
      });
      
      newMessage = await Message.findById(messageId);
    }
    
    // 广播引用消息
    broadcastMessage(newMessage);
    
    res.json({
      success: true,
      data: newMessage,
      message: receiverId ? '引用消息已发送' : (topicId ? '话题引用消息已发送' : '公共引用消息已发送')
    });
  } catch (error) {
    console.error("发送引用消息错误:", error);
    res.status(500).json({ 
      success: false, 
      message: '服务器错误' 
    });
  }
});

module.exports = router;
