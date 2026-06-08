import { Router } from 'express';
const router = Router();

// Lazy imports to avoid circular dependency issues
const modules = await Promise.all([
  import('./auth.ts'),
  import('./chat.ts'),
  import('./users.ts'),
  import('./friends.ts'),
  import('./moment.ts'),
  import('./follow.ts'),
  import('./comment.ts'),
  import('./like.ts'),
  import('./communities.ts'),
  import('./posts.ts'),
  import('./subsections.ts'),
  import('./blog.ts'),
  import('./oidc.ts'),
  import('./bots.ts'),
]);

const [
  authRoutes,
  chatRoutes,
  userRoutes,
  friendRoutes,
  momentRoutes,
  followRoutes,
  commentRoutes,
  likeRoutes,
  communityRoutes,
  postRoutes,
  subsectionRoutes,
  blogRoutes,
  oidcRoutes,
  botsRoutes,
] = modules;

router.use(authRoutes.default);
router.use(chatRoutes.default);
router.use(userRoutes.default);
router.use('/friends', friendRoutes.default);
router.use('/moments', momentRoutes.default);
router.use('/follow', followRoutes.default);
router.use('/comments', commentRoutes.default);
router.use('/likes', likeRoutes.default);
router.use('/communities', communityRoutes.default);
router.use('/posts', postRoutes.default);
router.use('/subsections', subsectionRoutes.default);
router.use('/blog', blogRoutes.default);
router.use('/bots', botsRoutes.default);
router.use(oidcRoutes.default);

export default router;
