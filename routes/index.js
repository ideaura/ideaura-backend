const express = require('express');
const router = express.Router();

// 导入子路由
const authRoutes = require('./auth');
const chatRoutes = require('./chat');
const userRoutes = require('./users');

// 使用子路由
router.use(authRoutes);
router.use(chatRoutes);
router.use(userRoutes);

module.exports = router;