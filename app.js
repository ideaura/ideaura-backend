const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const https = require('https');

const routes = require('./routes');
const { initializeDatabase } = require('./initialization/database');
// 移除对不存在的 initializeDefaultData 的引用
const config = require('./config');
const { initInternalMQTT } = require('./services/mqtt');
const { initializeOIDCClient } = require('./utils/oidcClient');
const oidcSyncService = require('./services/oidcSync');
const time = require('./utils/time');

// 设置全局时区为 Asia/Shanghai
time.setProcessTimezone();

const app = express();
const PORT = config.port;

// 中间件
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 提供静态文件服务
app.use('/static', express.static(path.join(__dirname, 'public')));
app.use('/static/uploads', express.static(path.join(__dirname, 'uploads')));

// 处理上传文件的MD5文件名访问
app.use('/uploads', (req, res, next) => {
  const filePath = req.path;
  const uploadsDir = path.join(__dirname, 'uploads');

  // 提取文件名和扩展名
  const ext = path.extname(filePath);
  const fileNameWithoutExt = path.basename(filePath, ext);

  // 检查是否有扩展名，如果有，检查对应的无扩展名文件是否存在
  if (ext) {
    const md5FilePath = path.join(uploadsDir, fileNameWithoutExt);

    fs.access(md5FilePath, fs.constants.F_OK, (err) => {
      if (err) {
        // 文件不存在，继续下一个中间件
        next();
      } else {
        // 文件存在，设置正确的Content-Type并发送文件
        const mimeTypes = {
          '.html': 'text/html',
          '.css': 'text/css',
          '.js': 'application/javascript',
          '.json': 'application/json',
          '.png': 'image/png',
          '.jpg': 'image/jpeg',
          '.jpeg': 'image/jpeg',
          '.gif': 'image/gif',
          '.webp': 'image/webp',
          '.bmp': 'image/bmp',
          '.svg': 'image/svg+xml',
          '.pdf': 'application/pdf',
          '.txt': 'text/plain',
          '.mp4': 'video/mp4',
          '.avi': 'video/x-msvideo',
          '.mov': 'video/quicktime',
          '.wmv': 'video/x-ms-wmv',
          '.flv': 'video/x-flv',
          '.webm': 'video/webm',
          '.zip': 'application/zip',
          '.rar': 'application/x-rar-compressed',
          '.tar': 'application/x-tar',
          '.7z': 'application/x-7z-compressed',
          '.doc': 'application/msword',
          '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          '.xls': 'application/vnd.ms-excel',
          '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          '.ppt': 'application/vnd.ms-powerpoint',
          '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
        };

        const contentType = mimeTypes[ext.toLowerCase()] || 'application/octet-stream';
        res.setHeader('Content-Type', contentType);

        // 发送文件
        res.sendFile(md5FilePath);
      }
    });
  } else {
    // 没有扩展名，直接使用静态文件服务
    next();
  }
});

// API路由
app.use('/api', routes);

// 重置密码页面
app.get('/reset-password', (req, res) => {
  const token = req.query.token;

  // 简单的HTML表单页面
  const html = `
  <!DOCTYPE html>
  <html lang="zh-CN">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>重置密码</title>
  </head>
  <body>
    <div style="max-width: 400px; margin: 50px auto; padding: 20px; border: 1px solid #ccc; border-radius: 5px;">
      <h2>重置密码</h2>
      <form id="resetForm">
        <input type="hidden" id="token" value="${token || ''}">
        <div style="margin-bottom: 15px;">
          <label for="password">新密码:</label><br>
          <input type="password" id="password" required style="width: 100%; padding: 8px; margin-top: 5px;">
        </div>
        <div style="margin-bottom: 15px;">
          <label for="confirmPassword">确认密码:</label><br>
          <input type="password" id="confirmPassword" required style="width: 100%; padding: 8px; margin-top: 5px;">
        </div>
        <button type="submit" style="width: 100%; padding: 10px; background-color: #007bff; color: white; border: none; border-radius: 3px; cursor: pointer;">重置密码</button>
      </form>
      <div id="message" style="margin-top: 15px; padding: 10px; display: none;"></div>
    </div>

    <script>
      document.getElementById('resetForm').addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const token = document.getElementById('token').value;
        const password = document.getElementById('password').value;
        const confirmPassword = document.getElementById('confirmPassword').value;
        const messageDiv = document.getElementById('message');
        
        // 清除之前的消息
        messageDiv.style.display = 'none';
        
        // 验证密码
        if (password.length < 8) {
          showMessage('密码至少需要8个字符', 'error');
          return;
        }
        
        if (password !== confirmPassword) {
          showMessage('两次输入的密码不一致', 'error');
          return;
        }
        
        // 如果没有令牌，显示错误
        if (!token) {
          showMessage('无效的重置链接', 'error');
          return;
        }
        
        try {
          const response = await fetch('/api/auth/reset-password', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ token, password })
          });
          
          const result = await response.json();
          
          if (result.success) {
            showMessage(result.message, 'success');
            // 重置密码成功后清空表单
            document.getElementById('password').value = '';
            document.getElementById('confirmPassword').value = '';
          } else {
            showMessage(result.message, 'error');
          }
        } catch (error) {
          showMessage('发生错误，请稍后重试', 'error');
        }
      });
      
      function showMessage(text, type) {
        const messageDiv = document.getElementById('message');
        messageDiv.textContent = text;
        messageDiv.style.display = 'block';
        
        if (type === 'error') {
          messageDiv.style.backgroundColor = '#f8d7da';
          messageDiv.style.color = '#721c24';
          messageDiv.style.borderColor = '#f5c6cb';
        } else {
          messageDiv.style.backgroundColor = '#d4edda';
          messageDiv.style.color = '#155724';
          messageDiv.style.borderColor = '#c3e6cb';
        }
      }
    </script>
  </body>
  </html>
  `;

  res.send(html);
});

// 启动服务器
async function startServer() {
  try {
    console.log('开始初始化数据库...');
    // 初始化数据库
    await initializeDatabase();
    console.log('✅ 数据库初始化完成');

    // OIDC客户端初始化
    console.log('初始化OIDC客户端...');
    try {
      await initializeOIDCClient();
      console.log('✅ OIDC客户端初始化完成');
    } catch (error) {
      console.error('❌ OIDC客户端初始化失败:', error);
      // 不抛出错误，因为这不应该阻止服务器启动
    }

    console.log('启动OIDC用户信息同步服务...');
    try {
      oidcSyncService.startSyncService();
      console.log('✅ OIDC用户信息同步服务启动完成');
    } catch (error) {
      console.error('❌ OIDC用户信息同步服务启动失败:', error);
      // 不抛出错误，因为这不应该阻止服务器启动
    }

    console.log('准备启动服务器...');
    let server;

    // 检查是否启用SSL
    if (config.ssl.enabled) {
      console.log('🔒 SSL已启用');
      try {
        // 检查证书文件是否存在
        if (!fs.existsSync(config.ssl.keyPath)) {
          throw new Error(`SSL私钥文件不存在: ${config.ssl.keyPath}`);
        }
        if (!fs.existsSync(config.ssl.certPath)) {
          throw new Error(`SSL证书文件不存在: ${config.ssl.certPath}`);
        }

        // 读取SSL证书
        const sslOptions = {
          key: fs.readFileSync(config.ssl.keyPath),
          cert: fs.readFileSync(config.ssl.certPath)
        };

        // 如果有CA证书，也读取它
        if (config.ssl.caPath && fs.existsSync(config.ssl.caPath)) {
          sslOptions.ca = fs.readFileSync(config.ssl.caPath);
        }

        // 创建HTTPS服务器
        server = https.createServer(sslOptions, app);
        console.log('✅ SSL证书加载成功');
      } catch (error) {
        console.error('SSL配置错误:', error.message);
        console.log('⚠️  回退到HTTP服务器');
        server = app.listen(0); // 先创建一个临时服务器
      }
    } else {
      // 创建HTTP服务器
      server = app.listen(0); // 先创建一个临时服务器
    }

    // 启动服务器
    server.listen(PORT, () => {
      const protocol = config.ssl.enabled ? 'https' : 'http';
      console.log(`🚀 服务器运行在 ${protocol}://localhost:${PORT}`);
      console.log(`📡 MQTT代理: ${config.mqtt.broker}`);
    });

    // 初始化内部MQTT WebSocket服务器
    try {
      await initInternalMQTT(server);
      console.log('✅ MQTT WebSocket服务器初始化完成');
    } catch (error) {
      console.error('MQTT WebSocket服务器初始化失败:', error);
    }

    // 监听服务器启动错误
    server.on('error', (error) => {
      console.error('服务器启动错误:', error);
    });

    // 设置定时任务，每小时清理一次过期的密码重置令牌
    const User = require('./models/User');
    setInterval(async () => {
      try {
        await User.cleanExpiredResetTokens();
      } catch (error) {
        console.error('清理过期密码重置令牌时出错:', error);
      }
    }, 60 * 60 * 1000); // 每小时执行一次

    // 优雅关闭
    process.on('SIGINT', () => {
      console.log('\n正在关闭服务器...');
      server.close(() => {
        console.log('服务器已关闭');
        // 停止同步服务（OIDC功能已禁用）
        oidcSyncService.stopSyncService();
        process.exit(0);
      });
    });

    // 添加未捕获异常处理
    process.on('uncaughtException', (error) => {
      console.error('未捕获的异常:', error);
      console.error('堆栈跟踪:', error.stack);
      process.exit(1);
    });

    process.on('unhandledRejection', (reason, promise) => {
      console.error('未处理的Promise拒绝:', reason);
      console.error('拒绝的Promise:', promise);
      process.exit(1);
    });

  } catch (error) {
    console.error('启动服务器时出错:', error);
    console.error('错误堆栈:', error.stack);
    process.exit(1);
  }
}

module.exports = { app, startServer };

// 如果直接运行此文件，则启动服务器
if (require.main === module) {
  startServer().then(() => {
    console.log('服务器启动完成');
  }).catch((error) => {
    console.error('启动服务器时出错:', error);
    console.error('错误堆栈:', error.stack);
    process.exit(1);
  });
}