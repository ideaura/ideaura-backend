// app.ts — Express application setup
import express from 'express';
import cors from 'cors';
import path from 'node:path';
import fs from 'node:fs';

import routes from './routes/index.ts';
import { initializeDatabase } from './initialization/database.ts';
import { initializeOIDCClient } from './utils/oidcClient.ts';
import oidcSyncService from './services/oidcSync.ts';
import time from './utils/time.ts';
import { startCleanup } from './services/fileCleanup.ts';
import fileDownload from './middleware/fileDownload.ts';
import { requestLogger } from './middleware/logging.ts';

const config = await import('./config/index.ts');
const cfg = config.default;

// Set timezone
time.setProcessTimezone();

const app = express();
const PORT = cfg.port;

// Middleware
app.use(cors());
app.use(requestLogger);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static files
app.use('/static', express.static(path.join(import.meta.dir, 'public')));
app.use('/static/uploads', express.static(path.join(import.meta.dir, 'uploads')));

// File download middleware (rate-limited)
app.use('/uploads', fileDownload);

// MD5 filename handling for /uploads
app.use('/uploads', (req, res, next) => {
  const filePath = req.path;
  const ext = path.extname(filePath);
  const dirName = path.dirname(filePath);
  const fileNameWithoutExt = path.basename(filePath, ext);
  const uploadsDir = path.join(import.meta.dir, 'uploads');

  if (ext) {
    const md5FilePath = path.join(uploadsDir, dirName, fileNameWithoutExt);
    fs.access(md5FilePath, fs.constants.F_OK, (err) => {
      if (err) return next();

      const mimeTypes: Record<string, string> = {
        '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript', '.json': 'application/json',
        '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif',
        '.webp': 'image/webp', '.bmp': 'image/bmp', '.svg': 'image/svg+xml', '.pdf': 'application/pdf',
        '.txt': 'text/plain', '.mp4': 'video/mp4', '.avi': 'video/x-msvideo', '.mov': 'video/quicktime',
        '.wmv': 'video/x-ms-wmv', '.flv': 'video/x-flv', '.webm': 'video/webm',
        '.zip': 'application/zip', '.rar': 'application/x-rar-compressed', '.tar': 'application/x-tar',
        '.7z': 'application/x-7z-compressed', '.doc': 'application/msword',
        '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        '.xls': 'application/vnd.ms-excel', '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        '.ppt': 'application/vnd.ms-powerpoint', '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
      };

      res.setHeader('Content-Type', mimeTypes[ext.toLowerCase()] || 'application/octet-stream');
      res.sendFile(md5FilePath);
    });
  } else {
    next();
  }
});

// API routes
app.use('/api', routes);

// Reset password page
app.get('/reset-password', (req, res) => {
  const token = req.query.token || '';
  res.send(`<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>重置密码</title></head><body><div style="max-width:400px;margin:50px auto;padding:20px;border:1px solid #ccc;border-radius:5px"><h2>重置密码</h2><form id="f"><input type="hidden" id="t" value="${token}"><div style="margin-bottom:15px"><label>新密码:</label><br><input type="password" id="p" required style="width:100%;padding:8px;margin-top:5px"></div><div style="margin-bottom:15px"><label>确认密码:</label><br><input type="password" id="c" required style="width:100%;padding:8px;margin-top:5px"></div><button type="submit" style="width:100%;padding:10px;background:#007bff;color:#fff;border:none;border-radius:3px;cursor:pointer">重置密码</button></form><div id="m" style="margin-top:15px;padding:10px;display:none"></div></div><script>document.getElementById('f').addEventListener('submit',async function(e){e.preventDefault();const t=document.getElementById('t').value,p=document.getElementById('p').value,c=document.getElementById('c').value,m=document.getElementById('m');m.style.display='none';if(p.length<8)return show('密码至少需要8个字符','error');if(p!==c)return show('两次输入的密码不一致','error');if(!t)return show('无效的重置链接','error');try{const r=await fetch('/api/auth/reset-password',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token:t,password:p})});const d=await r.json();show(d.message,d.success?'success':'error');if(d.success){document.getElementById('p').value='';document.getElementById('c').value=''}}catch{show('发生错误，请稍后重试','error')}});function show(t,s){const m=document.getElementById('m');m.textContent=t;m.style.display='block';m.style.backgroundColor=s==='error'?'#f8d7da':'#d4edda';m.style.color=s==='error'?'#721c24':'#155724'}</script></body></html>`);
});

// Initialize all services
async function initialize(): Promise<void> {
  console.log('开始初始化数据库...');
  await initializeDatabase();
  console.log('✅ 数据库初始化完成');

  console.log('初始化 Redis 连接...');
  try {
    const redis = await import('./utils/redis.ts');
    await redis.init();
    console.log('✅ Redis 连接初始化完成');
  } catch (error) {
    console.error('❌ Redis 连接初始化失败:', error);
  }

  console.log('初始化OIDC客户端...');
  try {
    await initializeOIDCClient();
    console.log('✅ OIDC客户端初始化完成');
  } catch (error) {
    console.error('❌ OIDC客户端初始化失败:', error);
  }

  console.log('启动OIDC用户信息同步服务...');
  try {
    oidcSyncService.startSyncService();
    console.log('✅ OIDC用户信息同步服务启动完成');
  } catch (error) {
    console.error('❌ OIDC用户信息同步服务启动失败:', error);
  }

  // Clean expired reset tokens hourly
  const User = (await import('./models/User.ts')).default;
  setInterval(async () => {
    try { await User.cleanExpiredResetTokens(); } catch (e) { console.error('[cron] 清理过期令牌失败:', (e as Error).message); }
  }, 60 * 60 * 1000);

  // Global exception handlers
  process.on('uncaughtException', (error) => {
    console.error('未捕获的异常:', error);
    process.exit(1);
  });
  process.on('unhandledRejection', (reason) => {
    console.error('未处理的Promise拒绝:', reason);
    process.exit(1);
  });

  // File cleanup service
  startCleanup();

  console.log('✅ 全部服务初始化完成');
}

export default app;
export { initialize, PORT };
