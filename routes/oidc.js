const express = require('express');
const router = express.Router();
const { initializeOIDCClient, getAuthorizationUrl, handleCallback } = require('../utils/oidcClient');
const User = require('../models/User');
const oidcSyncService = require('../services/oidcSync');
const time = require('../utils/time');

// 使用全局存储以与其他路由共享状态
const appState = require('../utils/AppState');


// 初始化OIDC客户端
initializeOIDCClient().catch(console.error);

// 生成随机字符串
function generateRandomString(length) {
  const crypto = require('crypto');
  return crypto.randomBytes(Math.ceil(length / 2))
    .toString('hex') /** convert to hexadecimal format */
    .slice(0, length);   /** return required number of characters */
}

// OIDC预登录路由 - 获取MQTT连接所需的参数
router.get('/auth/oidc/pre-login', (req, res) => {
  try {
    const secureString = generateRandomString(32); // 足够长，用于MQTT频道
    const authString = generateRandomString(16);   // 用于认证

    // 存储到全局存储中
    appState.setOidc(secureString, {
      authString,
      isVerified: false,
      timestamp: time.nowMs(),
      type: 'pre-login'
    });

    // 10分钟后过期
    setTimeout(() => {
      if (appState.hasOidc(secureString)) {
        appState.deleteOidc(secureString);
      }
    }, 600000);

    res.json({
      success: true,
      data: {
        secureString,
        authString
      }
    });
  } catch (error) {
    console.error('Pre-login error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate pre-login parameters'
    });
  }
});

// OIDC登录路由
router.get('/auth/oidc/login', async (req, res) => {
  try {
    const { url, state, nonce } = await getAuthorizationUrl();

    // 获取前端传递的secureString (s参数)
    const secureString = req.query.s;
    const isMobile = req.query.mobile === 'true';
    if (secureString) {
      console.log(`收到带有secureString的登录请求: ${secureString}`);
    }
    if (isMobile) {
      console.log(`收到移动端登录请求`);
    }

    // 存储state和nonce用于后续验证
    appState.setOidc(state, {
      nonce,
      timestamp: time.nowMs(),
      returnUrl: req.query.returnUrl || '/',
      secureString: secureString, // 关联secureString
      isMobile: isMobile // 关联移动端标识
    });

    // 5分钟后自动清除存储的状态
    setTimeout(() => {
      appState.deleteOidc(state);
    }, 300000); // 5分钟 = 300000毫秒

    // 直接跳转到OIDC认证页面
    res.redirect(url);
  } catch (error) {
    console.error('OIDC登录错误:', error);
    res.status(500).json({
      success: false,
      message: 'OIDC登录初始化失败'
    });
  }
});

// OIDC回调路由
router.get('/auth/oidc/callback', async (req, res) => {
  try {
    const { code, state, error, error_description } = req.query;

    // 检查错误
    if (error) {
      console.error('OIDC回调错误:', error, error_description);
      return res.status(400).json({
        success: false,
        message: `OIDC认证失败: ${error}`,
        errorDetails: error_description
      });
    }

    // 验证state参数
    if (!state) {
      return res.status(400).json({
        success: false,
        message: '缺少state参数'
      });
    }

    const storedData = appState.getOidc(state);
    if (!storedData) {
      return res.status(400).json({
        success: false,
        message: '无效的state参数，可能已过期'
      });
    }

    // 验证nonce
    const expectedNonce = storedData.nonce;
    appState.deleteOidc(state); // 一次性使用后删除

    if (!code) {
      return res.status(400).json({
        success: false,
        message: '缺少授权码'
      });
    }

    // 处理回调并获取用户信息
    const result = await handleCallback(
      code,
      require('../config/oidc').redirectURL,
      state,
      expectedNonce
    );

    // 从OIDC提供者获取的用户信息
    const { userinfo } = result;

    // 检查用户是否已存在于我们的数据库中
    // 优先使用OIDC的sub作为ID进行查找
    let user = null;
    const oidcId = userinfo.sub; // OIDC提供的唯一ID

    // 尝试通过ID查找用户
    if (oidcId) {
      try {
        user = await User.findById(oidcId);
      } catch (err) {
        console.error('通过ID查找用户失败:', err);
      }
    }

    // 如果通过ID没找到，尝试通过邮箱查找（处理既有用户或ID不匹配的情况）
    if (!user) {
      user = await User.findByEmail(userinfo.email);

      if (user) {
        console.log(`⚠️ 邮箱 ${userinfo.email} 已存在，但ID不匹配 (Local: ${user.id}, OIDC: ${oidcId})。将使用现有本地用户。`);
      }
    }

    if (!user) {
      // 如果用户完全不存在，创建新用户
      // 使用OIDC的ID作为本地ID
      const newUser = {
        id: oidcId, // 使用OIDC ID
        username: userinfo.preferred_username || userinfo.name || `user_${oidcId}`,
        email: userinfo.email,
        password: "", // OIDC用户密码为空字符串
        isOidcUser: true,
        avatar_url: userinfo.picture || null
      };

      try {
        // 创建用户
        user = await User.create(newUser);
        console.log(`✅ 已创建新OIDC用户: ${user.username} (ID: ${user.id})`);
      } catch (createError) {
        console.error('创建OIDC用户失败:', createError);
        throw createError;
      }
    } else {
      // 如果用户存在，检查并更新用户信息以保持一致性
      const updateFields = {};

      // 检查并更新用户名
      const newUsername = userinfo.preferred_username || userinfo.name || userinfo.sub;
      if (user.username !== newUsername) {
        updateFields.username = newUsername;
      }

      // 检查并更新邮箱（如果OIDC提供者提供了邮箱变更）
      if (userinfo.email && user.email !== userinfo.email) {
        updateFields.email = userinfo.email;
      }

      // 如果是OIDC登录，确保邮箱已验证
      if (!user.email_verified) {
        updateFields.email_verified = 1;
      }

      // 检查并更新头像
      if (userinfo.picture && user.avatar_url !== userinfo.picture) {
        updateFields.avatar_url = userinfo.picture;
      }

      // 如果有任何字段需要更新
      if (Object.keys(updateFields).length > 0) {
        await User.update(user.id, updateFields);
        console.log(`🔄 已更新用户 ${user.id} 的信息以保持与OIDC提供者一致`);

        // 重新获取更新后的用户信息
        user = await User.findById(user.id);
      }
    }

    // 获取完整的用户信息
    user = await User.findById(user.id);

    // 生成我们自己的JWT令牌
    const { generateJWT } = require('../utils/tokens');
    const token = generateJWT({
      id: user.id,
      username: user.username,
      email: user.email
    });

    // 成功登录响应

    // 如果是移动端登录，直接重定向回App
    if (storedData.isMobile) {
      console.log(`📱 移动端OIDC登录成功，重定向回App`);
      return res.redirect(`ideaura://token=${token}`);
    }

    // 检查是否有关联的secureString
    if (storedData.secureString) {
      const mqttService = require('../services/mqtt');
      // 广播token给前端
      mqttService.broadcastToOidcSession(storedData.secureString, {
        success: true,
        token,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          emailVerified: Boolean(user.email_verified),
          avatarUrl: user.avatar_url
        }
      });

      // 返回简单的HTML页面
      return res.send(`
         <!DOCTYPE html>
         <html>
         <head>
           <title>登录成功</title>
           <meta charset="utf-8">
           <meta name="viewport" content="width=device-width, initial-scale=1">
           <style>
             body { font-family: sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background-color: #f0f2f5; }
             .container { text-align: center; padding: 40px; background: white; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
             h1 { color: #28a745; margin-bottom: 10px; }
             p { color: #666; }
           </style>
         </head>
         <body>
           <div class="container">
             <h1>✅ 登录成功</h1>
             <p>您已成功登录，请返回应用继续操作。</p>
             <p>此页面可以关闭。</p>
             <script>
               // 尝试自动关闭窗口
               setTimeout(() => {
                 window.close();
               }, 3000);
             </script>
           </div>
         </body>
         </html>
       `);
    }

    res.json({
      success: true,
      message: 'OIDC登录成功',
      data: {
        token,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          emailVerified: Boolean(user.email_verified),
          avatarUrl: user.avatar_url
        },
        oidcInfo: {
          sub: userinfo.sub,
          name: userinfo.name,
          email: userinfo.email,
          preferred_username: userinfo.preferred_username
        }
      }
    });
  } catch (error) {
    console.error('OIDC回调处理错误:', error);
    res.status(500).json({
      success: false,
      message: 'OIDC回调处理失败',
      error: error.message
    });
  }
});

// OIDC用户信息路由
router.get('/auth/oidc/userinfo', async (req, res) => {
  try {
    // 验证本地JWT令牌
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        message: '访问令牌必填'
      });
    }

    const { verifyJWT } = require('../utils/tokens');
    let user;
    try {
      user = verifyJWT(token);
    } catch (error) {
      return res.status(403).json({
        success: false,
        message: '无效的访问令牌'
      });
    }

    // 获取完整用户信息
    const fullUser = await User.findById(user.id);

    res.json({
      success: true,
      data: {
        user: {
          id: fullUser.id,
          username: fullUser.username,
          email: fullUser.email,
          emailVerified: Boolean(fullUser.email_verified),
          createdAt: fullUser.created_at,
          avatarUrl: fullUser.avatar_url
        }
      }
    });
  } catch (error) {
    console.error('获取用户信息错误:', error);
    res.status(500).json({
      success: false,
      message: '获取用户信息失败'
    });
  }
});

module.exports = router;