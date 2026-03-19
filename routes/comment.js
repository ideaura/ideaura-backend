const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { Comment, Moment, User, Post } = require('../models');

// 创建评论 - 需要鉴权
router.post('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { momentId, postId, content, parentId = null } = req.body;

    // 验证输入
    if (!momentId && !postId) {
      return res.status(400).json({ success: false, message: '必须提供动态ID或帖子ID之一' });
    }
    if (momentId && postId) {
      return res.status(400).json({ success: false, message: '动态ID和帖子ID不能同时提供' });
    }
    if (!content || content.trim().length === 0) {
      return res.status(400).json({ success: false, message: '评论内容不能为空' });
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

    // 如果是回复评论，检查原评论是否存在
    if (parentId) {
      const parentComment = await Comment.findById(parentId);
      if (!parentComment) {
        return res.status(404).json({ success: false, message: '父评论不存在' });
      }
      // 验证父评论与目标动态或帖子的一致性
      if ((momentId && parentComment.momentId !== momentId) || (postId && parentComment.postId !== postId)) {
        return res.status(404).json({ success: false, message: '父评论不属于指定的目标' });
      }
    }

    // 创建评论
    const comment = await Comment.create(userId, content.trim(), momentId, postId, parentId);

    res.status(201).json({
      success: true,
      data: {
        id: comment.id,
        userId: comment.userId,
        momentId: comment.momentId,
        postId: comment.postId,
        content: comment.content,
        parentId: comment.parentId,
        createdAt: comment.createdAt
      },
      message: '评论创建成功'
    });
  } catch (error) {
    console.error('创建评论错误:', error);
    res.status(500).json({ success: false, message: '服务器内部错误' });
  }
});

// 获取动态的评论列表 - 无需鉴权（公开部分）
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
      // 如果不是公开动态，暂时返回空列表（实际应用中可能需要更复杂的权限检查）
      return res.json({
        success: true,
        data: [],
        message: '获取评论成功'
      });
    }

    const comments = await Comment.getByMomentId(momentId, page, limit);

    res.json({
      success: true,
      data: comments,
      message: '获取评论成功'
    });
  } catch (error) {
    console.error('获取评论错误:', error);
    res.status(500).json({ success: false, message: '服务器内部错误' });
  }
});

// 获取帖子的评论列表 - 无需鉴权（公开部分）
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
        message: '获取评论成功'
      });
    }

    const comments = await Comment.getByPostId(postId, page, limit);

    res.json({
      success: true,
      data: comments,
      message: '获取评论成功'
    });
  } catch (error) {
    console.error('获取帖子评论错误:', error);
    res.status(500).json({ success: false, message: '服务器内部错误' });
  }
});

// 获取评论的回复 - 无需鉴权（公开部分）
router.get('/reply/:commentId', async (req, res) => {
  try {
    const { commentId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;

    // 检查评论是否存在
    const comment = await Comment.findById(commentId);
    if (!comment) {
      return res.status(404).json({ success: false, message: '评论不存在' });
    }

    // 根据评论类型检查所属内容是否公开可访问
    if (comment.momentId) {
      // 评论属于动态
      const moment = await Moment.findById(comment.momentId);
      if (!moment || moment.visibility !== 'public') {
        // 如果不是公开动态，返回空列表
        return res.json({
          success: true,
          data: [],
          message: '获取回复成功'
        });
      }
    } else if (comment.postId) {
      // 评论属于帖子
      const post = await Post.findById(comment.postId);
      if (!post || post.status !== 'published') {
        // 如果帖子不可见，返回空列表
        return res.json({
          success: true,
          data: [],
          message: '获取回复成功'
        });
      }
    } else {
      // 评论既不属于动态也不属于帖子，返回空列表
      return res.json({
        success: true,
        data: [],
        message: '获取回复成功'
      });
    }

    const replies = await Comment.getRepliesByCommentId(commentId, page, limit);

    res.json({
      success: true,
      data: replies,
      message: '获取回复成功'
    });
  } catch (error) {
    console.error('获取回复错误:', error);
    res.status(500).json({ success: false, message: '服务器内部错误' });
  }
});

// 更新评论 - 需要鉴权且只能更新自己的评论
router.put('/:commentId', authenticateToken, async (req, res) => {
  try {
    const { commentId } = req.params;
    const userId = req.user.id;
    const { content } = req.body;

    // 验证输入
    if (!content || content.trim().length === 0) {
      return res.status(400).json({ success: false, message: '评论内容不能为空' });
    }

    // 检查评论是否存在且属于当前用户
    const comment = await Comment.findById(commentId);
    if (!comment || comment.userId !== userId) {
      return res.status(404).json({ success: false, message: '评论不存在或无权限修改' });
    }

    const result = await Comment.update(commentId, userId, content.trim());

    if (result.changes === 0) {
      return res.status(400).json({ success: false, message: '更新失败' });
    }

    res.json({
      success: true,
      message: '评论更新成功'
    });
  } catch (error) {
    console.error('更新评论错误:', error);
    res.status(500).json({ success: false, message: '服务器内部错误' });
  }
});

// 删除评论 - 需要鉴权且只能删除自己的评论
router.delete('/:commentId', authenticateToken, async (req, res) => {
  try {
    const { commentId } = req.params;
    const userId = req.user.id;

    // 检查评论是否存在且属于当前用户
    const comment = await Comment.findById(commentId);
    if (!comment || comment.userId !== userId) {
      return res.status(404).json({ success: false, message: '评论不存在或无权限删除' });
    }

    // 使用硬删除来同时删除评论及其回复
    const result = await Comment.hardDelete(commentId, userId);

    res.json({
      success: true,
      message: '评论删除成功'
    });
  } catch (error) {
    console.error('删除评论错误:', error);
    res.status(500).json({ success: false, message: '服务器内部错误' });
  }
});

module.exports = router;