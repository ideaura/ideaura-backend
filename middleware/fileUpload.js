const multer = require('multer');
const path = require('path');
const fs = require('fs');
const md5 = require('md5');
const crypto = require('crypto');

// 确保uploads目录存在
const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// 配置multer存储
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    // 生成临时文件名
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, 'temp-' + uniqueSuffix + ext);
  }
});

// 文件类型过滤器
const fileFilter = (req, file, cb) => {
  // 允许的文件类型
  const allowedMimes = [
    // 图片
    'image/jpeg',
    'image/jpg', 
    'image/png',
    'image/gif',
    'image/webp',
    'image/bmp',
    'image/svg+xml',
    // 视频
    'video/mp4',
    'video/avi',
    'video/mov',
    'video/wmv',
    'video/flv',
    'video/quicktime',
    'video/x-msvideo',
    'video/webm',
    // 其他文件
    'text/plain',
    'text/html',
    'text/css',
    'text/javascript',
    'application/javascript',
    'application/json',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/zip',
    'application/x-rar-compressed',
    'application/x-tar',
    'application/x-7z-compressed'
  ];

  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('不支持的文件类型'), false);
  }
};

// 创建multer中间件
const upload = multer({ 
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024 // 限制10MB
  }
});

// 导出一个函数，该函数在上传完成后处理MD5重命名
const processFileWithMd5 = (req, res, next) => {
  upload.single('file')(req, res, async (err) => {
    if (err) {
      return next(err);
    }
    
    if (req.file) {
      try {
        // 读取临时文件内容并计算MD5
        const fileBuffer = fs.readFileSync(req.file.path);
        const fileMd5 = md5(fileBuffer);
        
        // 获取原始文件扩展名
        const ext = path.extname(req.file.originalname);
        
        // 构建新的文件路径
        const newPath = path.join(uploadDir, fileMd5);
        
        // 重命名文件为MD5值（无扩展名）
        fs.renameSync(req.file.path, newPath);
        
        // 更新req.file信息
        req.file.filename = fileMd5;
        req.file.path = newPath;
        req.file.originalname = fileMd5 + ext; // 保留扩展名信息
      } catch (error) {
        console.error('处理MD5文件时出错:', error);
        return next(error);
      }
    }
    
    next();
  });
};

module.exports = { upload, processFileWithMd5 };