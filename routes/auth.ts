import { Router } from 'express';
import User from '../models/User.ts';
import { generateToken, generateJWT } from '../utils/tokens.ts';
import { sendVerificationEmail, sendPasswordResetEmail } from '../services/email.ts';
import { validateEmail, validateUsername, validatePassword } from '../utils/validators.ts';
import { authenticateToken } from '../middleware/auth.ts';
import appState from '../utils/AppState.ts';
const router = Router();

/*
const { initializeOIDCClient, getAuthorizationUrl, handleCallback } = require('../utils/oidcClient');
*/

// 用户注册
router.post('/auth/register', async (req, res) => {
  return res.status(403).json({
    success: false,
    message: '注册接口已关闭，请使用OIDC登录'
  });
  /* 
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
        message: '用户名不能为空'
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

    // 不再检查用户名是否已存在，允许重复用户名

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
  */
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
    const user = await User.findByEmailWithPassword(email);
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
    const user = await User.findByEmailWithPassword(email);
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
  const { email, password, useOidc } = req.body;

  // OIDC登录功能已被禁用（注释掉以备将来使用）
  /*
  if (useOidc) {
    try {
      const { url, state, nonce } = await getAuthorizationUrl();
      
      // 存储state和nonce用于后续验证

      
      appState.setOidc(state, {
        nonce,
        timestamp: time.nowMs(),
        // 保存原始请求信息，以便登录后可以返回到正确的页面
        returnUrl: req.query.returnUrl || '/'
      });

      // 5分钟后自动清除存储的状态
      setTimeout(() => {
        appState.deleteOidc(state);
      }, 300000); // 5分钟 = 300000毫秒

      // 返回重定向URL，前端可以根据这个URL进行重定向
      res.json({
        success: true,
        message: 'OIDC登录初始化成功',
        data: {
          redirectUrl: url,
          state: state
        }
      });
    } catch (error) {
      console.error("OIDC登录初始化错误:", error);
      res.status(500).json({
        success: false,
        message: 'OIDC登录初始化失败'
      });
    }
    return;
  }
  */

  // 传统邮箱/密码登录
  if (!email || !password) {
    console.log('[LOGIN] 缺少 email 或 password');
    return res.status(400).json({
      success: false,
      message: '邮箱和密码为必填项'
    });
  }

  try {
    console.log('[LOGIN] 开始查询用户 findByEmail...');
    const user = await User.findByEmailWithPassword(email);
    console.log('[LOGIN] findByEmail 返回:', user ? `找到用户 id=${user.id}` : '未找到');
    if (!user) {
      return res.status(400).json({
        success: false,
        message: '邮箱或密码错误'
      });
    }

    // 检查用户是否为OIDC用户，如果是，则不允许使用密码登录
    console.log('[LOGIN] password 字段, exists:', !!user.password, 'len:', user.password?.length);
    if (!user.password || user.password.trim() === '') {
      return res.status(400).json({
        success: false,
        message: '此账户使用OIDC登录，请使用OIDC方式进行登录'
      });
    }

    if (!user.email_verified) {
      console.log('[LOGIN] 邮箱未验证');
      return res.status(400).json({
        success: false,
        message: '请先验证您的邮箱'
      });
    }

    console.log('[LOGIN] 开始 bcrypt.compare...');
    const passwordMatch = await Bun.password.verify(password, user.password);
    console.log('[LOGIN] bcrypt.compare 完成, match:', passwordMatch);
    if (!passwordMatch) {
      return res.status(400).json({
        success: false,
        message: '邮箱或密码错误'
      });
    }

    const token = generateJWT({
      id: user.id,
      username: user.username,
      email: user.email
    });

    console.log('[LOGIN] 登录成功');
    res.json({
      success: true,
      message: '登录成功',
      data: {
        token,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          avatarUrl: user.avatar_url
        }
      }
    });
  } catch (error) {
    console.error("登录错误:", error);
    console.error("错误堆栈:", error.stack);
    res.status(500).json({
      success: false,
      message: '服务器错误'
    });
  }
});

// OIDC登录入口点（已注释，以备将来使用）
/*
router.get('/auth/oidc', async (req, res) => {
  try {
    const { url, state, nonce } = await getAuthorizationUrl();
    
    // 存储state和nonce用于后续验证

    
    appState.setOidc(state, {
      nonce,
      timestamp: time.nowMs(),
      returnUrl: req.query.returnUrl || '/' // 保存原始请求信息
    });

    // 5分钟后自动清除存储的状态
    setTimeout(() => {
      appState.deleteOidc(state);
    }, 300000); // 5分钟 = 300000毫秒

    // 重定向到OIDC提供者
    res.redirect(url);
  } catch (error) {
    console.error('OIDC登录初始化错误:', error);
    res.status(500).json({
      success: false,
      message: 'OIDC登录初始化失败'
    });
  }
});
*/

export default router;