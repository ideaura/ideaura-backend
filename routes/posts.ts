import { Router } from 'express';
import Post from '../models/Post.ts';
import Community from '../models/Community.ts';
import { body } from 'express-validator';
import { authenticateToken, authenticateOptionalToken } from '../middleware/auth.ts';
import { contentUpload } from '../middleware/fileUpload.ts';
import FileRecord from '../models/FileRecord.ts';

const router = Router();

// ── Create post ──
router.post('/', authenticateToken, [
  body('title').trim().isLength({ min: 1, max: 200 }),
  body('content').trim().isLength({ min: 1, max: 10000 }),
  body('community_id').optional().isInt({ min: 1 }),
  body('subsection_id').optional().isInt({ min: 1 }),
  body('content_type').optional().isIn(['text', 'markdown', 'html'])
], contentUpload, async (req, res) => {
  try {
    const { title, content, community_id, subsection_id, type, category_id, content_type, tags } = req.body as Record<string, unknown>;
    const postId = await Post.create({
      community_id: community_id ? +community_id : null, user_id: req.user!.id,
      subsection_id: subsection_id ? +subsection_id : null,
      title: (title as string).trim(), content: (content as string).trim(),
      type: type as string || 'discussion', category_id: category_id ? +category_id : null,
      content_type: content_type as string || 'text',
      tags: tags ? JSON.stringify((typeof tags === 'string' ? (tags as string).split(',').map(t => t.trim()).filter(Boolean) : tags)) : null
    });
    const files = (req as Record<string, unknown>).contentFiles as string[] | null;
    if (files?.length) {
      const meta = (req as Record<string, unknown>).contentFilesMeta as { filePath: string; fileSize: number; mimeType: string; originalName: string }[];
      for (let i = 0; i < files.length; i++) {
        await FileRecord.create({ userId: req.user!.id, filePath: meta[i].filePath, fileSize: meta[i].fileSize, originalName: meta[i].originalName, mimeType: meta[i].mimeType, sourceType: 'post', postType: type as string || 'discussion', messageId: postId });
      }
    }
    res.status(201).json({ success: true, data: { id: postId } });
  } catch (e) { console.error('[posts] create:', e); res.status(500).json({ success: false, message: '服务器错误' }); }
});

// ── Named paths MUST come before /:id ──

// Upload post attachments
router.post('/upload', authenticateToken, contentUpload, async (req, res) => {
  const files = (req as Record<string, unknown>).contentFiles as string[] | null;
  if (!files?.length) return res.status(400).json({ success: false, message: '没有上传文件' });
  res.json({ success: true, data: { urls: files } });
});

// Posts by community
router.get('/community/:communityId', authenticateOptionalToken, async (req, res) => {
  try {
    const { page, limit } = req.query as { page?: string; limit?: string };
    const l = limit ? +limit : 20;
    const p = page ? +page : 1;
    const posts = await Post.findByCommunity(+req.params.communityId, l, (p - 1) * l);
    res.json({ success: true, data: { posts } });
  } catch (e) { console.error('[posts] community:', e); res.status(500).json({ success: false, message: '服务器错误' }); }
});

// Posts by subsection
router.get('/subsection/:subsectionId', authenticateOptionalToken, async (req, res) => {
  try {
    const { page, limit } = req.query as { page?: string; limit?: string };
    const l = limit ? +limit : 20;
    const p = page ? +page : 1;
    const db = await import('../config/database.ts');
    const time = await import('../utils/time.ts');
    const rows = await db.default.all(
      `SELECT p.*, u.username as author_name, u.avatar_url as author_avatar, u.is_bot as author_is_bot, c.name as community_name, s.name as subsection_name
       FROM posts p LEFT JOIN users u ON p.user_id = u.id LEFT JOIN communities c ON p.community_id = c.id LEFT JOIN subsections s ON p.subsection_id = s.id
       WHERE p.subsection_id = ? AND p.status = 'published' ORDER BY p.created_at DESC LIMIT ? OFFSET ?`,
      [+req.params.subsectionId, l, (p - 1) * l]
    );
    const posts = rows.map((row: Record<string, unknown>) => ({
      ...row, created_at: time.default.formatLocalTime(row.created_at as string),
      updated_at: row.updated_at ? time.default.formatLocalTime(row.updated_at as string) : null,
      published_at: row.published_at ? time.default.formatLocalTime(row.published_at as string) : null
    }));
    res.json({ success: true, data: { posts } });
  } catch (e) { console.error('[posts] subsection:', e); res.status(500).json({ success: false, message: '服务器错误' }); }
});

// Posts by user
router.get('/user/:userId', authenticateOptionalToken, async (req, res) => {
  try {
    const { page, limit } = req.query as { page?: string; limit?: string };
    const l = limit ? +limit : 20;
    const p = page ? +page : 1;
    const posts = await Post.findByUser(+req.params.userId, p, l);
    res.json({ success: true, data: { posts } });
  } catch (e) { res.status(500).json({ success: false, message: '服务器错误' }); }
});

// Search posts
router.get('/search/:query', authenticateOptionalToken, async (req, res) => {
  try {
    const { page, limit } = req.query as { page?: string; limit?: string };
    const l = limit ? +limit : 20;
    const p = page ? +page : 1;
    const posts = await Post.search(req.params.query, null, l, (p - 1) * l);
    res.json({ success: true, data: { posts } });
  } catch (e) { res.status(500).json({ success: false, message: '服务器错误' }); }
});

// Popular tags for posts
router.get('/tags/popular', async (req, res) => {
  try {
    const { limit } = req.query as { limit?: string };
    const tags = await Post.getPopularTags(limit ? +limit : 20);
    res.json({ success: true, data: { tags } });
  } catch (e) { res.status(500).json({ success: false, message: '服务器错误' }); }
});

// ── Generic :id routes — MUST be last ──
router.get('/:id', authenticateOptionalToken, async (req, res) => {
  try {
    const post = await Post.findById(+req.params.id);
    if (!post) return res.status(404).json({ success: false, message: '帖子不存在' });
    await Post.incrementViewCount(+req.params.id);
    res.json({ success: true, data: { post } });
  } catch (e) { console.error('[posts] get:', e); res.status(500).json({ success: false, message: '服务器错误' }); }
});

router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { title, content, content_type } = req.body as { title?: string; content?: string; content_type?: string };
    const updates: Record<string, unknown> = {};
    if (title) updates.title = title;
    if (content) updates.content = content;
    if (content_type) updates.content_type = content_type;
    const result = await Post.update(+req.params.id, req.user!.id, updates);
    res.json({ success: true, data: { post: result } });
  } catch (e) { res.status(500).json({ success: false, message: '服务器错误' }); }
});

router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const result = await Post.delete(+req.params.id, req.user!.id);
    res.json({ success: true, data: result });
  } catch (e) { res.status(500).json({ success: false, message: '服务器错误' }); }
});

// List all (community_id as query param for backward compat)
router.get('/', authenticateOptionalToken, async (req, res) => {
  try {
    const { community_id, page, limit } = req.query as { community_id?: string; page?: string; limit?: string };
    let posts: Record<string, unknown>[];
    if (community_id) {
      const l = limit ? +limit : 20;
      const p = page ? +page : 1;
      posts = await Post.findByCommunity(+community_id, l, (p - 1) * l);
    } else {
      posts = await Post.getAll(page ? +page : 1, limit ? +limit : 10);
    }
    res.json({ success: true, data: { posts } });
  } catch (e) { console.error('[posts] list:', e); res.status(500).json({ success: false, message: '服务器错误' }); }
});

export default router;
