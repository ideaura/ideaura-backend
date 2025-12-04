const express = require('express');
const bcrypt = require('bcryptjs');
const router = express.Router();

const User = require('../models/User');
const { generateToken, generateJWT } = require('../utils/tokens');
const { sendVerificationEmail, sendPasswordResetEmail } = require('../services/email');
const { validateEmail, validateUsername, validatePassword } = require('../utils/validators');
const { authenticateToken } = require('../middleware/auth');

// 用户注册
router.post('/auth/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    
    if (!username || !email || !password) {
      return res.status(400).json({ 
        success: false, 
        message: '用户名、邮箱和密码为必填项' 
      });
    }
    
    if (!validateEmail(email)) {
      return res.status(400).json({ 
        success: false, 
        message: '邮箱格式不正确' 
      });
    }
    
    if (!validateUsername(username)) {
      return res.status(400).json({ 
        success: false, 
        message: '用户名格式不正确(3-20位字母、数字或下划线)' 
      });
    }
    
    if (!validatePassword(password)) {
      return res.status(400).json({ 
        success: false, 
        message: '密码至少需要8个字符' 
      });
    }
    
    const emailCount = await User.countByEmail(email);
    if (emailCount >= 5) {
      return res.status(400).json({ 
        success: false, 
        message: '此邮箱已注册过多账号' 
      });
    }
    
    const existingUser = await User.findByUsername(username);
    if (existingUser) {
      return res.status(400).json({ 
        success: false, 
        message: '用户名已存在' 
      });
    }
    
    const newUser = await User.create({ username, email, password });
    
    try {
      await sendVerificationEmail(email, username, newUser.verificationToken);
      res.status(201).json({
        success: true,
        message: '注册成功，请查收验证邮件'
      });
    } catch (emailError) {
      console.error("发送邮件错误:", emailError);
      res.status(201).json({
        success: true,
        message: '注册成功，但验证邮件发送失败'
      });
    }
  } catch (error) {
    console.error("注册错误:", error);
    res.status(500).json({ 
      success: false, 
      message: '服务器错误' 
    });
  }
});

// 邮箱验证
router.get('/auth/verify-email', async (req, res) => {
  const { token } = req.query;
  
  if (!token) {
    return res.status(400).send('无效的验证链接');
  }
  
  try {
    const user = await User.verifyEmail(token);
    if (!user) {
      return res.status(400).send('无效的验证链接');
    }
    
    res.send('邮箱验证成功！您现在可以登录了。');
  } catch (error) {
    console.error("邮箱验证错误:", error);
    res.status(500).send('服务器错误');
  }
});

// 重新发送验证邮件
router.post('/auth/resend-verification', async (req, res) => {
  const { email } = req.body;
  
  if (!email) {
    return res.status(400).json({ 
      success: false, 
      message: '邮箱地址必填' 
    });
  }
  
  try {
    const user = await User.findByEmail(email);
    if (!user) {
      return res.status(400).json({ 
        success: false, 
        message: '邮箱未注册' 
      });
    }
    
    if (user.email_verified) {
      return res.status(400).json({ 
        success: false, 
        message: '邮箱已验证' 
      });
    }
    
    const verificationToken = generateToken();
    await User.updateVerificationToken(user.id, verificationToken);
    
    try {
      await sendVerificationEmail(email, user.username, verificationToken);
      res.json({
        success: true,
        message: '验证邮件已发送'
      });
    } catch (emailError) {
      console.error("发送邮件错误:", emailError);
      res.status(500).json({ 
        success: false, 
        message: '发送验证邮件失败' 
      });
    }
  } catch (error) {
    console.error("重新发送验证邮件错误:", error);
    res.status(500).json({ 
      success: false, 
      message: '服务器错误' 
    });
  }
});

// 忘记密码 - 通过邮箱发送重置链接
router.post('/auth/forgot-password/email', async (req, res) => {
  const { email } = req.body;
  
  if (!email) {
    return res.status(400).json({ 
      success: false, 
      message: '邮箱地址必填' 
    });
  }
  
  if (!validateEmail(email)) {
    return res.status(400).json({ 
      success: false, 
      message: '邮箱格式不正确' 
    });
  }
  
  try {
    const user = await User.findByEmail(email);
    if (!user) {
      // 为了安全，即使邮箱不存在也返回成功信息
      return res.json({
        success: true,
        message: '如果该邮箱已注册，重置密码的链接已发送到您的邮箱'
      });
    }
    
    const resetToken = await User.createPasswordResetToken(email);
    if (!resetToken) {
      return res.status(500).json({ 
        success: false, 
        message: '生成重置令牌失败' 
      });
    }
    
    try {
      await sendPasswordResetEmail(email, resetToken);
      res.json({
        success: true,
        message: '重置密码的链接已发送到您的邮箱'
      });
    } catch (emailError) {
      console.error("发送重置密码邮件错误:", emailError);
      res.status(500).json({ 
        success: false, 
        message: '发送重置密码邮件失败' 
      });
    }
  } catch (error) {
    console.error("处理忘记密码请求错误:", error);
    res.status(500).json({ 
      success: false, 
      message: '服务器错误' 
    });
  }
});

// 忘记密码 - 通过用户名发送重置链接
router.post('/auth/forgot-password/username', async (req, res) => {
  const { username } = req.body;
  
  if (!username) {
    return res.status(400).json({ 
      success: false, 
      message: '用户名必填' 
    });
  }
  
  try {
    const user = await User.findByUsername(username);
    if (!user) {
      // 为了安全，即使用户名不存在也返回成功信息
      return res.json({
        success: true,
        message: '如果该用户名已注册，重置密码的链接已发送到注册邮箱'
      });
    }
    
    const resetToken = await User.createPasswordResetToken(user.email);
    if (!resetToken) {
      return res.status(500).json({ 
        success: false, 
        message: '生成重置令牌失败' 
      });
    }
    
    try {
      await sendPasswordResetEmail(user.email, resetToken);
      res.json({
        success: true,
        message: '重置密码的链接已发送到您的注册邮箱'
      });
    } catch (emailError) {
      console.error("发送重置密码邮件错误:", emailError);
      res.status(500).json({ 
        success: false, 
        message: '发送重置密码邮件失败' 
      });
    }
  } catch (error) {
    console.error("处理忘记密码请求错误:", error);
    res.status(500).json({ 
      success: false, 
      message: '服务器错误' 
    });
  }
});

// 重置密码页面验证令牌
router.get('/auth/reset-password/validate', async (req, res) => {
  const { token } = req.query;
  
  if (!token) {
    return res.status(400).json({ 
      success: false, 
      message: '无效的重置链接' 
    });
  }
  
  try {
    const user = await User.validatePasswordResetToken(token);
    if (!user) {
      return res.status(400).json({ 
        success: false, 
        message: '重置链接已过期或无效' 
      });
    }
    
    res.json({
      success: true,
      message: '重置链接有效',
      data: {
        username: user.username
      }
    });
  } catch (error) {
    console.error("验证重置密码令牌错误:", error);
    res.status(500).json({ 
      success: false, 
      message: '服务器错误' 
    });
  }
});

// 重置密码
router.post('/auth/reset-password', async (req, res) => {
  const { token, password } = req.body;
  
  if (!token || !password) {
    return res.status(400).json({ 
      success: false, 
      message: '重置令牌和新密码为必填项' 
    });
  }
  
  if (!validatePassword(password)) {
    return res.status(400).json({ 
      success: false, 
      message: '密码至少需要8个字符' 
    });
  }
  
  try {
    const isValid = await User.validatePasswordResetToken(token);
    if (!isValid) {
      return res.status(400).json({ 
        success: false, 
        message: '重置链接已过期或无效' 
      });
    }
    
    const success = await User.resetPassword(token, password);
    if (!success) {
      return res.status(500).json({ 
        success: false, 
        message: '重置密码失败' 
      });
    }
    
    res.json({
      success: true,
      message: '密码重置成功，您现在可以使用新密码登录'
    });
  } catch (error) {
    console.error("重置密码错误:", error);
    res.status(500).json({ 
      success: false, 
      message: '服务器错误' 
    });
  }
});

// 用户登录
router.post('/auth/login', async (req, res) => {
  const { username, password } = req.body;
  
  if (!username || !password) {
    return res.status(400).json({ 
      success: false, 
      message: '用户名和密码为必填项' 
    });
  }
  
  try {
    const user = await User.findByUsername(username);
    if (!user) {
      return res.status(400).json({ 
        success: false, 
        message: '用户名或密码错误' 
      });
    }
    
    if (!user.email_verified) {
      return res.status(400).json({ 
        success: false, 
        message: '请先验证您的邮箱' 
      });
    }
    
    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      return res.status(400).json({ 
        success: false, 
        message: '用户名或密码错误' 
      });
    }
    
    const token = generateJWT({
      id: user.id,
      username: user.username,
      email: user.email
    });
    
    res.json({
      success: true,
      message: '登录成功',
      data: {
        token,
        user: {
          id: user.id,
          username: user.username,
          email: user.email
        }
      }
    });
  } catch (error) {
    console.error("登录错误:", error);
    res.status(500).json({ 
      success: false, 
      message: '服务器错误' 
    });
  }
});

module.exports = router;