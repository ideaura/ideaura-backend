import { Router } from 'express';
import { processFileWithMd5, chatFileUpload } from '../middleware/fileUpload.ts';
import FileRecord from '../models/FileRecord.ts';
import Topic from '../models/Topic.ts';
import Message from '../models/Message.ts';
import User from '../models/User.ts';
import Friend from '../models/Friend.ts';
import Community from '../models/Community.ts';
import { broadcastMessage, broadcastMessageEvent, generateUserInboxTopic, getOnlineUserIdsSet } from '../services/mqtt.ts';
import appState from '../utils/AppState.ts';
import time from '../utils/time.ts';
import path from 'node:path';
import fs from 'node:fs';
import { validateTopicName, validateTopicDescription } from '../utils/validators.ts';
import { authenticateToken } from '../middleware/auth.ts';
import db from '../config/database.ts';
import crypto from 'node:crypto';
const router = Router();


// 上传文件（聊天）
router.post('/chat/upload', authenticateToken, chatFileUpload, async (req, res) => {
  try {
    if (!req.chatFile) {
      return res.status(400).json({
        success: false,
        message: '请选择要上传的文件'
      });
    }

    const userId = req.user.id;
    const { filePath, fileSize, mimeType, originalName, rawOriginalName } = req.chatFile;

    // 计算过期时间
    const expiresAt = await FileRecord.calcChatExpiry(mimeType);

    // 写入 file_records（暂不关联消息，等发送消息时再补）
    await FileRecord.create({
      userId,
      filePath,
      fileSize,
      originalName: rawOriginalName,
      mimeType,
      sourceType: 'chat',
      expiresAt
    });

    // 返回文件信息
    res.json({
      success: true,
      data: {
        filename: originalName,
        originalname: rawOriginalName,
        size: fileSize,
        mimetype: mimeType,
        path: filePath,
        url: filePath
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
router.get('/chat/user-inbox-topic', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const inboxTopic = await generateUserInboxTopic(userId);

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

// 辅助函数：为话题列表附加对应的圈子ID
async function attachCommunityIdToTopics(topics) {
  if (!topics) return topics;
  const isArray = Array.isArray(topics);
  const topicList = isArray ? topics : [topics];
  if (topicList.length === 0) return topics;


  try {
    const topicIds = topicList.map(t => t.id);
    if (topicIds.length > 0) {
      const commMap = await Community.findBatchByTopicIds(topicIds);
      topicList.forEach(topic => {
        if (commMap[topic.id]) {
          topic.linked_community_id = commMap[topic.id].id;
        }
      });
    }
  } catch (err) {
    console.error('获取关联圈子ID失败:', err);
  }
  return isArray ? topicList : topicList[0];
}

// 获取用户加入的话题列表（带最新消息）
router.get('/chat/topics', authenticateToken, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    let topics = await Topic.findByUserWithLatestMessage(req.user.id, limit);
    topics = await Topic.attachUnreadInfoToTopics(topics, req.user.id);
    topics = await attachCommunityIdToTopics(topics);

    res.json({
      success: true,
      data: topics,
      total: topics.length
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
    let topics = await Topic.findAllWithLatestMessage(req.user.id, limit);
    topics = await Topic.attachUnreadInfoToTopics(topics, req.user.id);
    topics = await attachCommunityIdToTopics(topics);

    res.json({
      success: true,
      data: topics,
      total: topics.length
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

    let topics = await Topic.searchWithLatestMessage(query.trim(), req.user.id, parseInt(limit));
    topics = await Topic.attachUnreadInfoToTopics(topics, req.user.id);
    topics = await attachCommunityIdToTopics(topics);

    res.json({
      success: true,
      data: topics,
      total: topics.length
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
    let popularTopics = await Topic.getPopularTopicsWithLatestMessage(limit);
    let recentActiveTopics = await Topic.getRecentActiveTopicsWithLatestMessage(limit);
    let newTopics = await Topic.getNewTopicsWithLatestMessage(limit);

    popularTopics = await attachCommunityIdToTopics(popularTopics);
    recentActiveTopics = await attachCommunityIdToTopics(recentActiveTopics);
    newTopics = await attachCommunityIdToTopics(newTopics);

    const userId = req.user.id;
    popularTopics = await Topic.attachUnreadInfoToTopics(popularTopics, userId);
    recentActiveTopics = await Topic.attachUnreadInfoToTopics(recentActiveTopics, userId);
    newTopics = await Topic.attachUnreadInfoToTopics(newTopics, userId);

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
router.post('/chat/messages', authenticateToken, chatFileUpload, async (req, res) => {
  const {
    content,
    topicId = null,
    messageType = 'normal',
    forwardSourceId = null,
    quotedMessageId = null,
    mentions = []
  } = req.body; // topicId 为 null 表示发送到聊天室
  let messageSubtype = req.body.messageSubtype || 'text'; // 基本消息类型（需要后续根据文件类型动态修改）

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

      // 验证 @全体成员 权限
      if (mentions && mentions.some(m => m.type === 'all')) {
        const userRole = await Topic.getUserRole(topicId, userId);
        if (userRole !== 'creator' && userRole !== 'admin') {
          return res.status(403).json({
            success: false,
            message: '只有话题创建者和管理员可以@全体成员'
          });
        }
      }
    } else {
      // 验证公共聊天室 @全体成员 权限
      if (mentions && mentions.some(m => m.type === 'all')) {
        if (req.user.role !== 'admin' && req.user.role !== 'superadmin' && req.user.username !== 'admin') {
          return res.status(403).json({
            success: false,
            message: '普通用户不能在公共聊天室@全体成员'
          });
        }
      }
    }

    // 处理文件上传
    let fileUrl = null;
    let fileName = null;
    let fileSize = null;
    let fileType = null;
    let chatFileInfo = null;

    if (req.chatFile) {
      fileUrl = req.chatFile.filePath;
      fileName = req.chatFile.originalName;
      fileSize = req.chatFile.fileSize;
      fileType = req.chatFile.mimeType;
      chatFileInfo = req.chatFile;

      // 如果没有明确指定消息子类型，根据文件类型自动设置
      if (messageSubtype === 'text' && req.chatFile.mimeType.startsWith('image/')) {
        messageSubtype = 'image';
      } else if (messageSubtype === 'text' && req.chatFile.mimeType.startsWith('video/')) {
        messageSubtype = 'video';
      } else if (messageSubtype === 'text') {
        messageSubtype = 'file';
      }
    }

    // 如果是文件、图片或视频类型，但没有上传文件，则需要内容作为描述
    if ((messageSubtype === 'file' || messageSubtype === 'image' || messageSubtype === 'video') && !req.chatFile) {
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
      source_type: topicId ? 'topic' : 'chatroom',
      forward_source_id: forwardSourceId ? parseInt(forwardSourceId) : null,
      quoted_message_id: quotedMessageId ? parseInt(quotedMessageId) : null,
      file_url: fileUrl,
      file_name: fileName,
      file_size: fileSize,
      file_type: fileType,
      mentions: mentions,
      command_id: req.body.commandId || null
    });

    // 写入 file_records（聊天文件）
    if (chatFileInfo) {
      const expiresAt = await FileRecord.calcChatExpiry(fileType);
      await FileRecord.create({
        userId,
        filePath: fileUrl,
        fileSize,
        originalName: chatFileInfo.rawOriginalName,
        mimeType: fileType,
        sourceType: 'chat',
        topicId: topicId || null,
        isPrivate: false,
        messageId,
        expiresAt
      }).catch(err => console.error('写入 file_records 失败:', err));
    }

    const message = await Message.findById(messageId);

    // 输出调试信息
    console.log('准备广播的消息:', JSON.stringify(message, null, 2));

    // 广播消息给所有连接的客户端
    await broadcastMessage(message);

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
router.post('/chat/private-messages', authenticateToken, chatFileUpload, async (req, res) => {
  let {
    content,
    receiverId,
    messageType = 'normal',
    messageSubtype = 'text' // 基本消息类型（后续可能根据文件类型修改）
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
  let chatFileInfo = null;

  if (req.chatFile) {
    fileUrl = req.chatFile.filePath;
    fileName = req.chatFile.originalName;
    fileSize = req.chatFile.fileSize;
    fileType = req.chatFile.mimeType;
    chatFileInfo = req.chatFile;

    if (messageSubtype === 'text' && req.chatFile.mimeType.startsWith('image/')) {
      messageSubtype = 'image';
    } else if (messageSubtype === 'text' && req.chatFile.mimeType.startsWith('video/')) {
      messageSubtype = 'video';
    } else if (messageSubtype === 'text') {
      messageSubtype = 'file';
    }
  }

  if ((messageSubtype === 'file' || messageSubtype === 'image' || messageSubtype === 'video') && !req.chatFile) {
    return res.status(400).json({
      success: false,
      message: '文件、图片或视频消息必须上传文件'
    });
  }

  try {
    // 检查发送者和接收者是否为好友
    const areFriends = await Friend.areFriends(senderId, parseInt(receiverId));
    if (!areFriends) {
      return res.status(403).json({
        success: false,
        message: '您必须先添加对方为好友才能发送私聊消息'
      });
    }

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
      file_type: fileType,
      command_id: req.body.commandId || null
    });

    // 写入 file_records（私聊文件）
    if (chatFileInfo) {
      const expiresAt = await FileRecord.calcChatExpiry(fileType);
      await FileRecord.create({
        userId: senderId,
        filePath: fileUrl,
        fileSize,
        originalName: chatFileInfo.rawOriginalName,
        mimeType: fileType,
        sourceType: 'chat',
        isPrivate: true,
        messageId: privateMessage.id,
        expiresAt
      }).catch(err => console.error('写入 file_records 失败:', err));
    }

    // 输出调试信息
    console.log('准备广播的私聊消息:', JSON.stringify(privateMessage, null, 2));

    // 广播私聊消息（现在使用安全的主题）
    await broadcastMessage({
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
  const before = req.query.before ? parseInt(req.query.before) : null;

  try {
    const messages = await Message.findPublicChatroomMessages(limit, offset, before);

    if (messages && messages.length > 0) {
      const maxMsgId = Math.max(...messages.map(m => m.id));
      await Message.markAsRead(req.user.id, 'chatroom', 0, maxMsgId).catch(err => console.error("Read mark error:", err));
    }

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
  const before = req.query.before ? parseInt(req.query.before) : null;
  const userId = req.user.id;

  try {
    // 验证话题是否存在
    let topic = await Topic.findById(topicId);
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

    topic = await attachCommunityIdToTopics(topic);
    const messages = await Message.findByTopic(topicId, limit, offset, before);

    if (messages && messages.length > 0) {
      const maxMsgId = Math.max(...messages.map(m => m.id));
      await Message.markAsRead(userId, 'topic', topicId, maxMsgId).catch(err => console.error("Read mark error:", err));
    }

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
  const before = req.query.before ? parseInt(req.query.before) : null;

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
      offset,
      before
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
      onlineCount: appState.getOnlineCount(),
      timestamp: time.now().toISOString()
    }
  });
});

// 创建话题（支持设置公开/私有，并同步创建圈子）
router.post('/chat/topics', authenticateToken, async (req, res) => {
  let { name, description, is_private } = req.body;
  const userId = req.user.id;

  // 不再强制附加“圈”，使用用户填写的纯名
  name = name.trim();

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
    // 话题允许重名，去掉话题名的同名检测

    // 解析is_private，如果未传默认按私有处理
    const isPrivateFlag = is_private !== undefined ? (is_private == 1 || is_private === true || is_private === 'true') : true;

    // 创建新话题 (存储纯名)
    const topicId = await Topic.create({
      name: name, // 比如：“测试”
      description: description ? description.trim() : null,
      created_by: userId,
      is_private: isPrivateFlag ? 1 : 0
    });

    // 检查并处理即将给圈子赋值的纯名称是否在 communities 中冲突
  
    let finalCommunityName = name;

    // 我们在此通过一个循环来确保名字绝对不会冲突
    let existingCount = await Community.countByName(finalCommunityName);
    if (existingCount > 0) {
      // 产生附加在后面的如 _1a2b
      const randomSuffix = '_' + crypto.randomBytes(2).toString('hex');
      finalCommunityName += randomSuffix;
    }

    // 同步创建圈子
    const communityData = {
      topic_id: topicId, // 新加入的强关联绑定
      name: finalCommunityName, // 带着潜在随机后缀的纯名
      description: description ? description.trim() : null,
      tags: null,
      avatar_url: null,
      cover_image_url: null,
      created_by: userId,
      type: isPrivateFlag ? 'private' : 'public',
      join_policy: 'open'
    };

    const communityId = await Community.create(communityData);

    // 自动将创建者加入圈子并设为圈主
    await Community.join(communityId, userId);
    await Community.setRole(communityId, userId, userId, 'owner');
    await Community.incrementMemberCount(communityId);

    const topic = await Topic.findById(topicId);

    // 为了符合之前加入的逻辑，我们也把产生的 community.id 在返回前贴上去
    topic.linked_community_id = communityId;

    res.status(201).json({
      success: true,
      message: '话题及相应圈子创建成功',
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

// 加入话题并同步加入圈子
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

    // 同步加入圈子
    try {
    
      const community = await Community.findByTopicId(topic.id);
      if (community) {
        // 加入圈子可能会报已经加入的错误，忽略该错误
        await Community.join(community.id, userId);
        await Community.incrementMemberCount(community.id);
      }
    } catch (joinErr) {
      if (joinErr.message !== '您已经是该社区的成员' && joinErr.message !== '您已经是该圈子的成员') {
        console.error('同步加入圈子失败:', joinErr);
      }
    }

    res.json({
      success: true,
      message: '成功加入话题及相应圈子',
      data: result
    });
  } catch (error) {
    if (error.message === '您已经是该话题的成员') {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }
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

    // 同步退出圈子
    try {
    
      const community = await Community.findByTopicId(topic.id);
      if (community) {
        await Community.leave(community.id, userId);
        await Community.decrementMemberCount(community.id);
      }
    } catch (leaveErr) {
      console.error('同步退出圈子失败:', leaveErr);
    }

    res.json({
      success: true,
      message: '成功退出话题及相应圈子',
      data: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || '服务器错误'
    });
  }
});

// 邀请用户加入话题
router.post('/chat/topics/:topicId/invite', authenticateToken, async (req, res) => {
  const topicId = req.params.topicId;
  const { userId } = req.body;
  const currentUserId = req.user.id;

  if (!userId || isNaN(topicId)) {
    return res.status(400).json({ success: false, message: '无效的参数' });
  }

  try {
    const topic = await Topic.findById(topicId);
    if (!topic) {
      return res.status(404).json({ success: false, message: '话题不存在' });
    }

    const isCreatorOrAdmin = await Topic.isCreatorOrAdmin(topicId, currentUserId);
    if (topic.is_private && !isCreatorOrAdmin) {
      return res.status(403).json({ success: false, message: '只有话题创建者和管理员可以邀请他人加入私有话题' });
    }

    const targetUser = await User.findById(userId);
    if (!targetUser) {
      return res.status(404).json({ success: false, message: '目标用户不存在' });
    }

    // 机器人相关限制
    if (targetUser.is_bot && !targetUser.allow_topic_invites) {
      if (targetUser.bot_owner_id !== String(currentUserId)) {
        return res.status(403).json({ success: false, message: '该机器人已关闭话题邀请' });
      }
    }

    const result = await Topic.joinTopic(topicId, userId);

    // 同步加入圈子
    try {
    
      const community = await Community.findByTopicId(topic.id);
      if (community) {
        await Community.join(community.id, userId);
        await Community.incrementMemberCount(community.id);
      }
    } catch (e) {}

    res.json({
      success: true,
      message: '成功邀请加入话题及相应圈子',
      data: result
    });
  } catch (error) {
    if (error.message === '您已经是该话题的成员') {
      return res.status(400).json({ success: false, message: '该用户已经是该话题的成员' });
    }
    console.error("邀请加入话题错误:", error);
    res.status(500).json({ success: false, message: error.message || '服务器错误' });
  }
});

// 将用户移出话题
router.post('/chat/topics/:topicId/kick', authenticateToken, async (req, res) => {
  const topicId = req.params.topicId;
  const { userId } = req.body;
  const currentUserId = req.user.id;

  if (!userId || isNaN(topicId)) {
    return res.status(400).json({ success: false, message: '无效的参数' });
  }

  try {
    const topic = await Topic.findById(topicId);
    if (!topic) {
      return res.status(404).json({ success: false, message: '话题不存在' });
    }

    const isCreatorOrAdmin = await Topic.isCreatorOrAdmin(topicId, currentUserId);
    
    // 权限检查
    if (!isCreatorOrAdmin) {
      // 拥有者可以把自己的机器人移出
      const targetUser = await User.findById(userId);
      if (!targetUser || targetUser.bot_owner_id !== String(currentUserId)) {
        return res.status(403).json({ success: false, message: '只有话题管理员可以移出成员' });
      }
    } else {
      const isTargetCreator = await Topic.isCreator(topicId, userId);
      if (isTargetCreator) {
        return res.status(403).json({ success: false, message: '不能移出话题创建者' });
      }
    }

    const result = await Topic.leaveTopic(topicId, userId);

    // 同步退出圈子
    try {
    
      const community = await Community.findByTopicId(topic.id);
      if (community) {
        await Community.leave(community.id, userId);
        await Community.decrementMemberCount(community.id);
      }
    } catch (e) {}

    res.json({
      success: true,
      message: '成功移出话题及相应圈子',
      data: result
    });
  } catch (error) {
    console.error("移出话题错误:", error);
    res.status(500).json({ success: false, message: error.message || '服务器错误' });
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
    const onlineUserIds = await getOnlineUserIdsSet();

    const membersWithOnline = members.map(m => ({
      ...m,
      isOnline: onlineUserIds.has(m.id)
    }));

    res.json({
      success: true,
      data: {
        members: membersWithOnline,
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

// 上传话题头像
router.post('/chat/topics/:topicId/avatar', authenticateToken, processFileWithMd5, async (req, res) => {
  const topicId = req.params.topicId;
  const userId = req.user.id;

  if (isNaN(topicId)) {
    return res.status(400).json({ success: false, message: '话题ID无效' });
  }

  if (!req.file) {
    return res.status(400).json({ success: false, message: '请上传图片文件' });
  }

  try {
    const topic = await Topic.findById(topicId);
    if (!topic) {
      return res.status(404).json({ success: false, message: '话题不存在' });
    }

    const isCreatorOrAdmin = await Topic.isCreatorOrAdmin(topicId, userId);
    if (!isCreatorOrAdmin) {
      return res.status(403).json({ success: false, message: '只有话题创建者和管理员可以修改话题头像' });
    }

    const newAvatarUrl = req.file.avatarUrl;

    // 更新数据库
    await Topic.updateTopic(topicId, userId, { avatar_url: newAvatarUrl });
    const updatedTopic = await Topic.findById(topicId);

    res.json({
      success: true,
      message: '话题头像已更新',
      data: updatedTopic
    });
  } catch (error) {
    console.error("话题头像上传错误:", error);
    res.status(500).json({ success: false, message: '服务器错误' });
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

    // 同步更新圈子私有状态
    try {
    
      const community = await Community.findByTopicId(topic.id);
      if (community) {
        await Community.update(community.id, userId, { type: is_private ? 'private' : 'public' });
      }
    } catch (syncErr) {
      console.error('同步更新圈子隐私状态失败:', syncErr);
    }

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
    // 私聊消息撤回前，先查出双方用户ID
    let targetUserId = null;
    if (isPrivate === 'true') {
      const pmRow = await db.get<{ sender_id: number; receiver_id: number }>('SELECT sender_id, receiver_id FROM private_messages WHERE id = ?', [parseInt(String(messageId))]);
      if (pmRow) {
        // 对方就是不等于当前操作者的那一方
        targetUserId = pmRow.sender_id === userId ? pmRow.receiver_id : pmRow.sender_id;
      }
    }

    // 撤回消息
    const result = await Message.recallMessage(parseInt(messageId), userId, isPrivate === 'true', topicId ? parseInt(topicId) : null);

    if (result.success) {
      // 广播消息撤回事件

      await broadcastMessageEvent({
        eventType: 'recall',
        messageId: parseInt(messageId),
        userId: userId,
        targetUserId: targetUserId,
        messageType: isPrivate === 'true' ? 'private' : 'public',
        topicId: topicId ? parseInt(topicId) : null,
        timestamp: time.now().toISOString()
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
    // 私聊消息编辑前，先查出双方用户ID
    let targetUserId = null;
    if (isPrivate === 'true') {
      const pmRow = await db.get<{ sender_id: number; receiver_id: number }>('SELECT sender_id, receiver_id FROM private_messages WHERE id = ?', [parseInt(String(messageId))]);
      if (pmRow) {
        targetUserId = pmRow.sender_id === userId ? pmRow.receiver_id : pmRow.sender_id;
      }
    }

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

      await broadcastMessageEvent({
        eventType: 'edit',
        messageId: parseInt(messageId),
        userId: userId,
        targetUserId: targetUserId,
        content: content.trim(),
        updatedMessage: updatedMessage,
        messageType: isPrivate === 'true' ? 'private' : 'public',
        topicId: updatedMessage?.topic_id || null,
        timestamp: time.now().toISOString()
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
      // 广播转发的消息
      if (result.broadcastMessage) {
        await broadcastMessage(result.broadcastMessage);
      }
      
      res.json({
        success: true,
        message: `成功转发 ${result.forwardedMessages.length} 条消息`,
        data: result.forwardedMessages,
        forwardedMessage: result.broadcastMessage
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
router.post('/chat/messages/quote', authenticateToken, chatFileUpload, async (req, res) => {
  let {
    content,
    quotedMessageId,
    topicId = null,
    receiverId = null,
    messageSubtype = 'text' // 基本消息类型（后续可能根据文件类型修改）
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
  let chatFileInfo = null;

  if (req.chatFile) {
    fileUrl = req.chatFile.filePath;
    fileName = req.chatFile.originalName;
    fileSize = req.chatFile.fileSize;
    fileType = req.chatFile.mimeType;
    chatFileInfo = req.chatFile;

    if (messageSubtype === 'text' && req.chatFile.mimeType.startsWith('image/')) {
      messageSubtype = 'image';
    } else if (messageSubtype === 'text' && req.chatFile.mimeType.startsWith('video/')) {
      messageSubtype = 'video';
    } else if (messageSubtype === 'text') {
      messageSubtype = 'file';
    }
  }

  if ((messageSubtype === 'file' || messageSubtype === 'image' || messageSubtype === 'video') && !req.chatFile) {
    return res.status(400).json({
      success: false,
      message: '文件、图片或视频消息必须上传文件'
    });
  }

  try {
    let newMessage;

    if (receiverId) {
      // 检查发送者和接收者是否为好友
      const areFriends = await Friend.areFriends(userId, parseInt(receiverId));
      if (!areFriends) {
        return res.status(403).json({
          success: false,
          message: '您必须先添加对方为好友才能发送私聊消息'
        });
      }

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
        source_type: topicId ? 'topic' : 'chatroom',
        quoted_message_id: parseInt(quotedMessageId),
        file_url: fileUrl,
        file_name: fileName,
        file_size: fileSize,
        file_type: fileType
      });

      newMessage = await Message.findById(messageId);
    }

    // 写入 file_records（引用消息中的文件）
    if (chatFileInfo) {
      const expiresAt = await FileRecord.calcChatExpiry(fileType);
      await FileRecord.create({
        userId,
        filePath: fileUrl,
        fileSize,
        originalName: chatFileInfo.rawOriginalName,
        mimeType: fileType,
        sourceType: 'chat',
        topicId: topicId || null,
        isPrivate: !!receiverId,
        messageId: newMessage.id,
        expiresAt
      }).catch(err => console.error('写入 file_records 失败:', err));
    }

    // 广播引用消息
    await broadcastMessage(newMessage);

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

export default router;
