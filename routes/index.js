const express = require('express');
const router = express.Router();

// 导入子路由
const authRoutes = require('./auth');
const chatRoutes = require('./chat');
const userRoutes = require('./users');
const friendRoutes = require('./friends');
const momentRoutes = require('./moment');
const followRoutes = require('./follow');
const commentRoutes = require('./comment');
const likeRoutes = require('./like');
const communityRoutes = require('./communities');
const postRoutes = require('./posts');
const subsectionRoutes = require('./subsections');
const blogRoutes = require('./blog');

const oidcRoutes = require('./oidc');

// 使用子路由
router.use(authRoutes);
router.use(chatRoutes);
router.use(userRoutes);
router.use('/friends', friendRoutes);
router.use('/moments', momentRoutes);
router.use('/follow', followRoutes);
router.use('/comments', commentRoutes);
router.use('/likes', likeRoutes);
router.use('/communities', communityRoutes);
router.use('/posts', postRoutes);
router.use('/subsections', subsectionRoutes);
router.use('/blog', blogRoutes);

router.use(oidcRoutes);

module.exports = router;