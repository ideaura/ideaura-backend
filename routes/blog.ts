import { Router } from 'express';
import Post from '../models/Post.ts';
import BlogCategory from '../models/BlogCategory.ts';
import { body } from 'express-validator';
import { authenticateToken, authenticateOptionalToken } from '../middleware/auth.ts';
import { contentUpload } from '../middleware/fileUpload.ts';
import FileRecord from '../models/FileRecord.ts';
import Comment from '../models/Comment.ts';

const router = Router();

router.post('/', authenticateToken, [
  body('title').trim().isLength({ min: 1, max: 200 }),
  body('content').trim().isLength({ min: 1, max: 10000 }),
  body('category_id').optional().isInt({ min: 1 }),
  body('content_type').optional().isIn(['text', 'markdown', 'html'])
], contentUpload, async (req, res) => {
  try {
    const { title, content, category_id, tags, content_type = 'text' } = req.body as Record<string, unknown>;
    const postId = await Post.create({
      community_id: null, user_id: req.user!.id, subsection_id: null,
      title: (title as string).trim(), content: (content as string).trim(),
      type: 'blog', category_id: category_id ? +category_id : null,
      content_type: content_type as string,
      tags: tags ? JSON.stringify((typeof tags === 'string' ? (tags as string).split(',').map(t => t.trim()).filter(Boolean) : tags)) : null
    });
    const files = (req as Record<string, unknown>).contentFiles as string[] | null;
    if (files?.length) {
      const meta = (req as Record<string, unknown>).contentFilesMeta as { filePath: string; fileSize: number; mimeType: string; originalName: string }[];
      for (let i = 0; i < files.length; i++) {
        await FileRecord.create({ userId: req.user!.id, filePath: meta[i].filePath, fileSize: meta[i].fileSize, originalName: meta[i].originalName, mimeType: meta[i].mimeType, sourceType: 'blog', postType: 'blog', messageId: postId });
      }
    }
    res.status(201).json({ success: true, data: { id: postId } });
  } catch (e) { res.status(500).json({ success: false, message: '服务器错误' }); }
});

// ── Specific named paths BEFORE /:id ──

// Blog image upload (handled by start.ts multipart processing)
router.post('/upload', authenticateToken, async (req, res) => {
  const files = (req as Record<string, unknown>).contentFiles as string[] | null;
  if (!files?.length) return res.status(400).json({ success: false, message: '没有上传文件' });
  res.json({ success: true, data: { urls: files } });
});

// Blog categories
router.post('/categories', authenticateToken, async (req, res) => {
  try {
    const { name, description } = req.body as { name: string; description?: string };
    const result = await BlogCategory.create(req.user!.id, name.trim(), description ?? null);
    res.status(201).json({ success: true, data: result });
  } catch (e) { res.status(500).json({ success: false, message: '服务器错误' }); }
});

router.get('/categories', authenticateToken, async (req, res) => {
  try {
    const categories = await BlogCategory.getAll(req.user!.id);
    res.json({ categories });
  } catch (e) { res.status(500).json({ success: false, message: '服务器错误' }); }
});

router.get('/search/:query', async (req, res) => {
  try {
    const { page, limit } = req.query as { page?: string; limit?: string };
    const l = limit ? +limit : 20;
    const posts = await Post.search(req.params.query, null, l, page ? (+page - 1) * l : 0);
    res.json({ posts, total: posts.length, page: page ? +page : 1, limit: limit ? +limit : 10 });
  } catch (e) { console.error('搜索博客错误:', e); res.status(500).json({ success: false, message: '服务器错误' }); }
});

router.get('/user/:userId/comments', async (req, res) => {
  try {
    const { limit, offset } = req.query as { limit?: string; offset?: string };
    const posts = await Post.findByUser(+req.params.userId, 1, 100, 'blog');
    let all: Record<string, unknown>[] = [];
    for (const p of posts) {
      const c = await Comment.getByPostId(p.id as number, 1, 100);
      all = all.concat(c as Record<string, unknown>[]);
    }
    all.sort((a, b) => new Date(b.created_at as string).getTime() - new Date(a.created_at as string).getTime());
    const start = offset ? +offset : 0;
    res.json({ comments: all.slice(start, limit ? start + +limit : start + 20), total: all.length });
  } catch (e) { console.error('获取博客评论错误:', e); res.status(500).json({ success: false, message: '服务器错误' }); }
});

router.get('/user/:userId', async (req, res) => {
  try {
    const { page, limit } = req.query as { page?: string; limit?: string };
    const p = page ? +page : 1;
    const l = limit ? +limit : 10;
    const posts = await Post.findByUser(+req.params.userId, p, l, 'blog');
    res.json({ posts, total: posts.length, page: p, limit: l });
  } catch (e) { console.error('[blog] user blogs:', e); res.status(500).json({ success: false, message: '服务器错误' }); }
});

router.get('/user/:userId/tags', async (req, res) => {
  try {
    const tags = await Post.getPopularTags(50);
    res.json({ tags });
  } catch (e) { res.status(500).json({ success: false, message: '服务器错误' }); }
});

router.get('/tags/popular', async (req, res) => {
  try {
    const { limit } = req.query as { limit?: string };
    const tags = await Post.getPopularTags(limit ? +limit : 20);
    res.json({ tags });
  } catch (e) { res.status(500).json({ success: false, message: '服务器错误' }); }
});

router.get('/categories/user/:userId', async (req, res) => {
  try {
    const categories = await BlogCategory.getAll(+req.params.userId);
    res.json({ categories });
  } catch (e) { res.status(500).json({ success: false, message: '服务器错误' }); }
});

router.get('/categories/:id', async (req, res) => {
  try {
    const cat = await BlogCategory.getById(+req.params.id, 0);
    if (!cat) return res.status(404).json({ success: false, message: '分类不存在' });
    res.json({ success: true, data: cat });
  } catch (e) { res.status(500).json({ success: false, message: '服务器错误' }); }
});

router.put('/categories/:id', authenticateToken, async (req, res) => {
  try {
    const { name, description } = req.body as { name?: string; description?: string };
    const result = await BlogCategory.update(+req.params.id, req.user!.id, name ?? '', description ?? null);
    res.json({ success: true, data: result });
  } catch (e) { res.status(500).json({ success: false, message: '服务器错误' }); }
});

router.delete('/categories/:id', authenticateToken, async (req, res) => {
  try {
    const result = await BlogCategory.delete(+req.params.id, req.user!.id);
    res.json({ success: true, data: result });
  } catch (e) { res.status(500).json({ success: false, message: '服务器错误' }); }
});

// ── Generic :id routes — MUST be last ──
router.get('/:id', authenticateOptionalToken, async (req, res) => {
  try {
    const post = await Post.findById(+req.params.id);
    if (!post) return res.status(404).json({ success: false, message: '文章不存在' });
    await Post.incrementViewCount(+req.params.id);
    res.json({ post });
  } catch (e) { res.status(500).json({ success: false, message: '服务器错误' }); }
});

router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { title, content, content_type, category_id } = req.body as Record<string, unknown>;
    const updates: Record<string, unknown> = {};
    if (title) updates.title = title;
    if (content) updates.content = content;
    if (content_type) updates.content_type = content_type;
    if (category_id !== undefined) updates.category_id = category_id ? +category_id : null;
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

// List all blogs (must be last to avoid conflict with :id)
router.get('/', authenticateOptionalToken, async (req, res) => {
  try {
    const { page, limit, tag } = req.query as { page?: string; limit?: string; tag?: string };
    const p = page ? +page : 1;
    const l = limit ? +limit : 20;
    let posts: Record<string, unknown>[];
    if (tag) {
      posts = await Post.search(tag, null, l, (p - 1) * l);
    } else {
      posts = await Post.getAll(p, l, 'blog');
    }
    res.json({ posts });
  } catch (e) { res.status(500).json({ success: false, message: '服务器错误' }); }
});

export default router;
