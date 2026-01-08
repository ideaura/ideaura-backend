const express = require('express');
const router = express.Router();

const User = require('../models/User');
const { getCalibratedTime } = require('../utils/timezone');
const { authenticateToken } = require('../middleware/auth');

// 获取当前用户信息
router.get('/users/me', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: '用户不存在'
      });
    }

    res.json({
      success: true,
      data: {
        uid: user.id,
        username: user.username,
        email: user.email,
        emailVerified: Boolean(user.email_verified),
        registrationOrder: user.registration_order,
        registrationDate: user.created_at,
        joinDuration: calculateJoinDuration(user.created_at)
      }
    });
  } catch (error) {
    console.error("获取用户信息错误:", error);
    res.status(500).json({ 
      success: false, 
      message: '服务器错误' 
    });
  }
});

// 获取用户公开信息
router.get('/users/:id/public', async (req, res) => {
  try {
    const userId = req.params.id;
    
    // 验证用户ID是否为数字
    if (isNaN(userId)) {
      return res.status(400).json({
        success: false,
        message: '用户ID格式不正确'
      });
    }

    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: '用户不存在'
      });
    }

    res.json({
      success: true,
      data: {
        uid: user.id,
        username: user.username,
        registrationOrder: user.registration_order,
        registrationDate: user.created_at,
        joinDuration: calculateJoinDuration(user.created_at),
        isEmailVerified: Boolean(user.email_verified)
      }
    });
  } catch (error) {
    console.error("获取用户公开信息错误:", error);
    res.status(500).json({ 
      success: false, 
      message: '服务器错误' 
    });
  }
});

// 搜索用户
router.get('/users/search', authenticateToken, async (req, res) => {
  try {
    const { username, limit = 10 } = req.query;
    
    if (!username || username.trim().length < 2) {
      return res.status(400).json({
        success: false,
        message: '用户名至少需要2个字符'
      });
    }

    const users = await searchUsersByUsername(username.trim(), parseInt(limit));
    
    res.json({
      success: true,
      data: users.map(user => ({
        uid: user.id,
        username: user.username,
        registrationOrder: user.registration_order,
        registrationDate: user.created_at
      }))
    });
  } catch (error) {
    console.error("搜索用户错误:", error);
    res.status(500).json({ 
      success: false, 
      message: '服务器错误' 
    });
  }
});

// 获取用户统计信息
router.get('/users/stats', authenticateToken, async (req, res) => {
  try {
    const totalUsers = await User.getTotalUsers();
    const recentUsers = await User.getRecentUsers(5);
    
    res.json({
      success: true,
      data: {
        totalUsers,
        recentRegistrations: recentUsers.map(user => ({
          username: user.username,
          registrationDate: user.created_at,
          registrationOrder: user.registration_order
        }))
      }
    });
  } catch (error) {
    console.error("获取用户统计信息错误:", error);
    res.status(500).json({ 
      success: false, 
      message: '服务器错误' 
    });
  }
});

// 添加用户名更新路由
router.put('/users/username', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { newUsername } = req.body;
    
    // 验证用户名
    const { validateUsername } = require('../utils/validators');
    if (!validateUsername(newUsername)) {
      return res.status(400).json({
        success: false,
        message: '用户名不能为空'
      });
    }
    
    // 不再检查新用户名是否已存在，允许重复用户名
    
    // 更新用户名
    const result = await User.updateUsername(userId, newUsername.trim());
    
    if (result.changes === 0) {
      return res.status(400).json({
        success: false,
        message: '用户名更新失败'
      });
    }
    
    res.json({
      success: true,
      message: '用户名更新成功',
      data: {
        newUsername: newUsername.trim()
      }
    });
  } catch (error) {
    console.error("更新用户名错误:", error);
    res.status(500).json({ 
      success: false, 
      message: '服务器错误' 
    });
  }
});

// 辅助函数：计算加入时长
function calculateJoinDuration(registrationDate) {
  const joinDate = new Date(registrationDate);
  const now = getCalibratedTime();
  const diffTime = Math.abs(now - joinDate);
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) {
    const diffHours = Math.floor(diffTime / (1000 * 60 * 60));
    if (diffHours === 0) {
      const diffMinutes = Math.floor(diffTime / (1000 * 60));
      return `${diffMinutes}分钟`;
    }
    return `${diffHours}小时`;
  }
  
  if (diffDays < 30) {
    return `${diffDays}天`;
  }
  
  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths < 12) {
    return `${diffMonths}个月`;
  }
  
  const diffYears = Math.floor(diffMonths / 12);
  return `${diffYears}年`;
}

// 辅助函数：按用户名搜索用户
function searchUsersByUsername(username, limit) {
  return new Promise((resolve, reject) => {
    const db = require('../config/database');
    db.all(
      "SELECT id, username, created_at, registration_order FROM users WHERE username LIKE ? ORDER BY username LIMIT ?",
      [`%${username}%`, limit],
      (err, rows) => {
        if (err) return reject(err);
        resolve(rows);
      }
    );
  });
}

module.exports = router;