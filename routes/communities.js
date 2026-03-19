const express = require('express');
const router = express.Router();
const db = require('../config/database');
const Community = require('../models/Community');
const Post = require('../models/Post');
const { body, param, query } = require('express-validator');
const { authenticateToken, authenticateOptionalToken } = require('../middleware/auth');
const crypto = require('crypto');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// 配置 multer 用于保存上传文件
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, '../uploads/avatars');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const tempName = time.nowMs() + '-' + Math.round(Math.random() * 1E9) + path.extname(file.originalname);
    cb(null, tempName);
  }
});
const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 } // 限制 5MB
});

// 处理头像上传的中间件
const processAvatar = (req, res, next) => {
  if (req.files && req.files.length > 0 && !req.file) {
    req.file = req.files[0];
  }

  if (!req.file) {
    return res.status(400).json({ success: false, message: '请上传图片文件' });
  }

  const filePath = req.file.path;
  const ext = path.extname(req.file.originalname);

  const fileBuffer = fs.readFileSync(filePath);
  const hash = crypto.createHash('md5');
  hash.update(fileBuffer);
  const fileMd5 = hash.digest('hex');

  const newFileName = fileMd5;
  const newFilePath = path.join(path.dirname(filePath), newFileName);

  if (filePath !== newFilePath) {
    fs.renameSync(filePath, newFilePath);
  }

  req.file.avatarUrl = `/uploads/avatars/${fileMd5}${ext}`;
  next();
};

// 创建圈子
router.post('/',
  authenticateToken,
  [
    body('name').trim().isLength({ min: 1, max: 100 }).withMessage('圈子名称不能为空且长度不能超过100个字符'),
    body('description').optional().trim().isLength({ max: 500 }).withMessage('圈子描述长度不能超过500个字符'),
    body('type').optional().isIn(['public', 'private']).withMessage('圈子类型必须是public或private'),
    body('join_policy').optional().isIn(['open', 'approval', 'invitation_only']).withMessage('加入方式必须是open、approval或invitation_only')
  ],
  async (req, res) => {
    try {
      let { name, description, tags, avatar_url, cover_image_url, type = 'public', join_policy = 'open' } = req.body;
      const userId = req.user.id;

      // 不强制使用“圈”结尾，直接使用用户提交纯名称
      name = name.trim();

      // 这里仍需保证最终的 communities 中 name 不冲突
      let finalCommunityName = name;
      let existingCount = await Community.countByName(finalCommunityName);
      if (existingCount > 0) {
        const randomSuffix = '_' + crypto.randomBytes(2).toString('hex');
        finalCommunityName += randomSuffix;
      }

      // 我们首先去自动同步创建话题（以便我们获取能够用来关联新圈子的 topic_id），话题名称就是当前的纯名
      const Topic = require('../models/Topic');
      const topicId = await Topic.create({
        name: name, // 比如：“测试”
        description: description ? description.trim() : null,
        created_by: userId,
        is_private: type === 'private' ? 1 : 0
      });

      // 然后拿对应的话题 ID 和生成的无冲突名称来建立圈子本身
      const communityData = {
        topic_id: topicId,
        name: finalCommunityName,
        description: description ? description.trim() : null,
        tags,
        avatar_url,
        cover_image_url,
        created_by: userId,
        type,
        join_policy
      };

      const communityId = await Community.create(communityData);

      // 自动将创建者加入圈子并设为所有者
      await Community.join(communityId, userId);
      await Community.setRole(communityId, userId, userId, 'owner');
      await Community.incrementMemberCount(communityId);

      const community = await Community.findById(communityId);
      res.status(201).json({ message: '圈子及相应话题创建成功', community });
    } catch (error) {
      console.error('创建圈子错误:', error);
      res.status(500).json({ error: error.message });
    }
  }
);

// 辅助函数：统一为圈子的名称添加后缀“圈”
function attachCircleSuffix(data) {
  if (!data) return data;
  if (Array.isArray(data)) {
    data.forEach(item => {
      if (item && item.name && !item.name.endsWith('圈')) {
        item.name += '圈';
      }
    });
  } else {
    if (data.name && !data.name.endsWith('圈')) {
      data.name += '圈';
    }
  }
  return data;
}

// 获取圈子列表
router.get('/',
  authenticateOptionalToken,
  [
    query('page').optional().isInt({ min: 1 }).withMessage('页码必须是正整数'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('每页数量必须在1-100之间')
  ],
  async (req, res) => {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;
      const offset = (page - 1) * limit;

      const communities = await Community.findAll(limit, offset);
      attachCircleSuffix(communities);

      // 查询总数
      const totalResult = await db.get('SELECT COUNT(*) as count FROM communities WHERE is_active = true');
      const total = totalResult ? totalResult.count : 0;

      res.json({
        communities,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      });
    } catch (error) {
      console.error('获取圈子列表错误:', error);
      res.status(500).json({ error: error.message });
    }
  }
);

// 获取推荐圈子
router.get('/recommended',
  authenticateOptionalToken,
  [
    query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('每页数量必须在1-50之间')
  ],
  async (req, res) => {
    try {
      const limit = parseInt(req.query.limit) || 10;
      const communities = await Community.getRecommended(limit);
      attachCircleSuffix(communities);

      res.json({ communities });
    } catch (error) {
      console.error('获取推荐圈子错误:', error);
      res.status(500).json({ error: error.message });
    }
  }
);

// 搜索圈子
router.get('/search/:query',
  authenticateOptionalToken,
  [
    param('query').trim().isLength({ min: 1 }).withMessage('搜索关键词不能为空'),
    query('page').optional().isInt({ min: 1 }).withMessage('页码必须是正整数'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('每页数量必须在1-100之间')
  ],
  async (req, res) => {
    try {
      const { query: searchQuery } = req.params;
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;
      const offset = (page - 1) * limit;

      const communities = await Community.search(searchQuery, limit, offset);
      attachCircleSuffix(communities);

      // 查询搜索结果总数
      const searchQueryPattern = `%${searchQuery}%`;
      const totalResult = await db.get(
        `SELECT COUNT(*) as count FROM communities WHERE (name LIKE ? OR description LIKE ? OR tags LIKE ?) AND is_active = true`,
        [searchQueryPattern, searchQueryPattern, searchQueryPattern]
      );
      const total = totalResult ? totalResult.count : 0;

      res.json({
        communities,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      });
    } catch (error) {
      console.error('搜索圈子错误:', error);
      res.status(500).json({ error: error.message });
    }
  }
);

// 获取圈子详情
router.get('/:id',
  authenticateOptionalToken,
  [
    param('id').isInt({ min: 1 }).withMessage('圈子ID必须是正整数')
  ],
  async (req, res) => {
    try {
      const { id } = req.params;
      const community = await Community.findById(id);

      if (!community) {
        return res.status(404).json({ error: '圈子不存在或已被删除' });
      }

      // 如果用户已登录，添加用户在该圈子的角色信息
      let userRole = null;
      if (req.user && req.user.id) {
        userRole = await Community.getRole(parseInt(id), req.user.id);
      }

      community.user_role = userRole;

      // 附加对应的同名话题 ID
      try {
        const Topic = require('../models/Topic');
        if (community.topic_id) {
          const topic = await Topic.findById(community.topic_id);
          if (topic) {
            community.linked_topic_id = topic.id;
          }
        }
      } catch (err) {
        console.error('获取关联话题ID失败:', err);
      }

      attachCircleSuffix(community);
      res.json({ community });
    } catch (error) {
      console.error('获取圈子详情错误:', error);
      res.status(500).json({ error: error.message });
    }
  }
);

// 获取用户创建的圈子
router.get('/my/created',
  authenticateToken,
  [
    query('page').optional().isInt({ min: 1 }).withMessage('页码必须是正整数'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('每页数量必须在1-100之间')
  ],
  async (req, res) => {
    try {
      const userId = req.user.id;
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;
      const offset = (page - 1) * limit;

      const communities = await Community.findByCreator(userId, limit, offset);
      attachCircleSuffix(communities);

      res.json({ communities });
    } catch (error) {
      console.error('获取用户创建的圈子错误:', error);
      res.status(500).json({ error: error.message });
    }
  }
);

// 获取用户加入的圈子
router.get('/my/joined',
  authenticateToken,
  [
    query('page').optional().isInt({ min: 1 }).withMessage('页码必须是正整数'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('每页数量必须在1-100之间')
  ],
  async (req, res) => {
    try {
      const userId = req.user.id;
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;
      const offset = (page - 1) * limit;

      const communities = await Community.findByMember(userId, limit, offset);
      attachCircleSuffix(communities);

      res.json({ communities });
    } catch (error) {
      console.error('获取用户加入的圈子错误:', error);
      res.status(500).json({ error: error.message });
    }
  }
);

// 上传圈子头像
router.post('/:id/avatar',
  authenticateToken,
  [
    param('id').isInt({ min: 1 }).withMessage('圈子ID必须是正整数')
  ],
  upload.any(),
  processAvatar,
  async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      const community = await Community.findById(id);
      if (!community) {
        return res.status(404).json({ error: '圈子不存在' });
      }

      // 检查用户是否有权限更新社区（必须是创建者或管理员）
      const userRole = await Community.getRole(id, userId);
      if (userRole !== 'owner' && userRole !== 'admin') {
        return res.status(403).json({ error: '只有圈子所有者或管理员可以修改圈子头像' });
      }

      const newAvatarUrl = req.file.avatarUrl;

      // 更新数据库
      await Community.update(parseInt(id), userId, { avatar_url: newAvatarUrl });

      const updatedCommunity = await Community.findById(id);
      res.json({ message: '圈子头像已更新', community: updatedCommunity });
    } catch (error) {
      console.error('上传圈子头像错误:', error);
      res.status(500).json({ error: error.message });
    }
  }
);

// 更新圈子信息
router.put('/:id',
  authenticateToken,
  [
    param('id').isInt({ min: 1 }).withMessage('圈子ID必须是正整数'),
    body('name').optional().trim().isLength({ min: 1, max: 100 }).withMessage('圈子名称不能为空且长度不能超过100个字符'),
    body('description').optional().trim().isLength({ max: 500 }).withMessage('圈子描述长度不能超过500个字符'),
    body('type').optional().isIn(['public', 'private']).withMessage('圈子类型必须是public或private'),
    body('join_policy').optional().isIn(['open', 'approval', 'invitation_only']).withMessage('加入方式必须是open、approval或invitation_only')
  ],
  async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.id;
      const updates = req.body;

      // 检查用户权限
      const userRole = await Community.getRole(id, userId);
      if (userRole !== 'owner' && userRole !== 'admin') {
        return res.status(403).json({ error: '只有圈子所有者或管理员可以更新圈子信息' });
      }

      const result = await Community.update(parseInt(id), userId, updates);

      if (result.changes === 0) {
        return res.status(404).json({ error: '圈子不存在或更新失败' });
      }

      // 同步更新话题隐私状态
      if (updates.type !== undefined) {
        try {
          const Topic = require('../models/Topic');
          const community = await Community.findById(id);
          if (community && community.topic_id) {
            const topic = await Topic.findById(community.topic_id);
            if (topic) {
              await Topic.updatePrivateStatus(topic.id, userId, updates.type === 'private');
            }
          }
        } catch (syncErr) {
          console.error('同步更新话题隐私状态失败:', syncErr);
        }
      }

      const community = await Community.findById(id);
      res.json({ message: '圈子信息更新成功', community });
    } catch (error) {
      console.error('更新圈子信息错误:', error);
      res.status(500).json({ error: error.message });
    }
  }
);

// 加入圈子
router.post('/:id/join',
  authenticateToken,
  [
    param('id').isInt({ min: 1 }).withMessage('圈子ID必须是正整数')
  ],
  async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      const community = await Community.findById(id);
      if (!community) {
        return res.status(404).json({ error: '圈子不存在' });
      }

      // 检查是否已经是成员
      const isMember = await Community.isMember(id, userId);
      if (isMember) {
        return res.status(400).json({ error: '您已经是该圈子的成员' });
      }

      // 根据加入政策判断是否需要审批
      if (community.join_policy === 'approval') {
        return res.status(400).json({ error: '该圈子需要管理员审批才能加入' });
      }

      if (community.join_policy === 'invitation_only') {
        return res.status(400).json({ error: '该圈子仅限邀请加入' });
      }

      await Community.join(parseInt(id), userId);
      await Community.incrementMemberCount(parseInt(id));

      // 同步加入话题
      try {
        const Topic = require('../models/Topic');
        if (community.topic_id) {
          const topic = await Topic.findById(community.topic_id);
          if (topic) {
            await Topic.joinTopic(topic.id, userId);
          }
        }
      } catch (syncErr) {
        if (syncErr.message !== '您已经是该话题的成员') {
          console.error('同步加入话题失败:', syncErr);
        }
      }

      res.json({ message: '成功加入圈子及相应话题' });
    } catch (error) {
      console.error('加入圈子错误:', error);
      res.status(500).json({ error: error.message });
    }
  }
);

// 退出圈子
router.delete('/:id/leave',
  authenticateToken,
  [
    param('id').isInt({ min: 1 }).withMessage('圈子ID必须是正整数')
  ],
  async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      const isMember = await Community.isMember(id, userId);
      if (!isMember) {
        return res.status(400).json({ error: '您不是该圈子的成员' });
      }

      // 检查是否是圈子所有者
      const isOwner = await Community.isOwner(id, userId);
      if (isOwner) {
        return res.status(400).json({ error: '圈子所有者不能退出自己创建的圈子' });
      }

      await Community.leave(parseInt(id), userId);
      await Community.decrementMemberCount(parseInt(id));

      // 同步退出话题
      try {
        const Topic = require('../models/Topic');
        const community = await Community.findById(id);
        if (community && community.topic_id) {
          const topic = await Topic.findById(community.topic_id);
          if (topic) {
            await Topic.leaveTopic(topic.id, userId);
          }
        }
      } catch (syncErr) {
        console.error('同步退出话题失败:', syncErr);
      }

      res.json({ message: '成功退出圈子及相应话题' });
    } catch (error) {
      console.error('退出圈子错误:', error);
      res.status(500).json({ error: error.message });
    }
  }
);

// 获取圈子成员列表
router.get('/:id/members',
  authenticateToken,
  [
    param('id').isInt({ min: 1 }).withMessage('圈子ID必须是正整数'),
    query('page').optional().isInt({ min: 1 }).withMessage('页码必须是正整数'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('每页数量必须在1-100之间')
  ],
  async (req, res) => {
    try {
      const { id } = req.params;
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;
      const offset = (page - 1) * limit;

      const members = await Community.getMembers(parseInt(id), limit, offset);
      const total = await Community.getActiveMemberCount(parseInt(id));

      res.json({
        members,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      });
    } catch (error) {
      console.error('获取圈子成员列表错误:', error);
      res.status(500).json({ error: error.message });
    }
  }
);

// 获取圈子管理员列表
router.get('/:id/admins',
  authenticateToken,
  [
    param('id').isInt({ min: 1 }).withMessage('圈子ID必须是正整数')
  ],
  async (req, res) => {
    try {
      const { id } = req.params;

      const admins = await Community.getAdmins(parseInt(id));

      res.json({ admins });
    } catch (error) {
      console.error('获取圈子管理员列表错误:', error);
      res.status(500).json({ error: error.message });
    }
  }
);

// 设置成员角色
router.post('/:communityId/members/:userId/role',
  authenticateToken,
  [
    param('communityId').isInt({ min: 1 }).withMessage('圈子ID必须是正整数'),
    param('userId').isInt({ min: 1 }).withMessage('用户ID必须是正整数'),
    body('role').isIn(['admin', 'moderator', 'member']).withMessage('角色必须是admin、moderator或member')
  ],
  async (req, res) => {
    try {
      const { communityId, userId } = req.params;
      const adminUserId = req.user.id;
      const { role } = req.body;

      // 检查权限 - 只有所有者可以更改角色
      const adminRole = await Community.getRole(parseInt(communityId), adminUserId);
      if (adminRole !== 'owner') {
        return res.status(403).json({ error: '只有圈子所有者可以更改成员角色' });
      }

      // 不能更改自己的角色
      if (parseInt(userId) === adminUserId) {
        return res.status(400).json({ error: '不能更改自己的角色' });
      }

      await Community.setRole(parseInt(communityId), adminUserId, parseInt(userId), role);

      res.json({ message: '成员角色更新成功' });
    } catch (error) {
      console.error('设置成员角色错误:', error);
      res.status(500).json({ error: error.message });
    }
  }
);

// 移除圈子成员
router.delete('/:communityId/members/:userId',
  authenticateToken,
  [
    param('communityId').isInt({ min: 1 }).withMessage('圈子ID必须是正整数'),
    param('userId').isInt({ min: 1 }).withMessage('用户ID必须是正整数')
  ],
  async (req, res) => {
    try {
      const { communityId, userId } = req.params;
      const adminUserId = req.user.id;

      // 检查权限 - 所有者和管理员可以移除成员
      const adminRole = await Community.getRole(parseInt(communityId), adminUserId);
      if (adminRole !== 'owner' && adminRole !== 'admin') {
        return res.status(403).json({ error: '只有圈子所有者或管理员可以移除成员' });
      }

      // 不能移除自己
      if (parseInt(userId) === adminUserId) {
        return res.status(400).json({ error: '不能移除自己' });
      }

      // 不能移除所有者
      const userRole = await Community.getRole(parseInt(communityId), parseInt(userId));
      if (userRole === 'owner') {
        return res.status(400).json({ error: '不能移除圈子所有者' });
      }

      await Community.removeMember(parseInt(communityId), adminUserId, parseInt(userId));
      await Community.decrementMemberCount(parseInt(communityId));

      res.json({ message: '成员已从圈子移除' });
    } catch (error) {
      console.error('移除圈子成员错误:', error);
      res.status(500).json({ error: error.message });
    }
  }
);

module.exports = router;