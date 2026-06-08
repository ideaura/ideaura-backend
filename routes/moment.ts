import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.ts';
import { momentUpload } from '../middleware/fileUpload.ts';
import { Moment, User, Follow, Comment, Like } from '../models/index.ts';
import FileRecord from '../models/FileRecord.ts';

const router = Router();

router.post('/', authenticateToken, momentUpload, async (req, res) => {
  try {
    const { content, type = 'public', visibility = 'public' } = req.body as { content?: string; type?: string; visibility?: string };
    const userId = req.user!.id;
    const mediaUrls = (req as Record<string, unknown>).momentMedia?.mediaUrls || null;
    const videoUrl = (req as Record<string, unknown>).momentMedia?.videoUrl || null;
    const hasMedia = mediaUrls || videoUrl;
    if ((!content || !content.trim()) && !hasMedia) return res.status(400).json({ success: false, message: '动态内容不能为空' });

    const moment = await Moment.create(userId, content?.trim() ?? '', type, visibility, mediaUrls, videoUrl);

    if (hasMedia) {
      const files = (req as Record<string, unknown>).contentFiles as string[] | null;
      const meta = (req as Record<string, unknown>).contentFilesMeta as { filePath: string; fileSize: number; mimeType: string; originalName: string }[] | null;
      if (files && meta) {
        for (let i = 0; i < files.length; i++) {
          await FileRecord.create({
            userId, filePath: meta[i].filePath, fileSize: meta[i].fileSize,
            originalName: meta[i].originalName, mimeType: meta[i].mimeType,
            sourceType: 'moment', momentId: moment.id as number
          });
        }
      }
    }

    res.status(201).json({ success: true, data: moment });
  } catch (e) { console.error('发布动态错误:', e); res.status(500).json({ success: false, message: '服务器错误' }); }
});

router.get('/public', async (req, res) => {
  try {
    const { page, limit } = req.query as { page?: string; limit?: string };
    const moments = await Moment.getPublicMoments(page ? +page : 1, limit ? +limit : 20);
    res.json({ success: true, data: moments });
  } catch (e) { console.error('[moments/public] 错误:', (e as Error).message, (e as Error).stack); res.status(500).json({ success: false, message: '服务器错误' }); }
});
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { page, limit } = req.query as { page?: string; limit?: string };
    const moments = await Moment.getTimeline(req.user!.id, page ? +page : 1, limit ? +limit : 10);
    res.json({ success: true, data: moments });
  } catch (e) { res.status(500).json({ success: false, message: '服务器错误' }); }
});

router.get('/user/:userId', async (req, res) => {
  try {
    const { page, limit } = req.query as { page?: string; limit?: string };
    const moments = await Moment.findByUser(+req.params.userId, page ? +page : 1, limit ? +limit : 10);
    res.json({ success: true, data: moments });
  } catch (e) { res.status(500).json({ success: false, message: '服务器错误' }); }
});

router.get('/my', authenticateToken, async (req, res) => {
  try {
    const { page, limit } = req.query as { page?: string; limit?: string };
    const moments = await Moment.findByUser(req.user!.id, page ? +page : 1, limit ? +limit : 10);
    res.json({ success: true, data: moments });
  } catch (e) { res.status(500).json({ success: false, message: '服务器错误' }); }
});

router.get('/friends', authenticateToken, async (req, res) => {
  try {
    const { page, limit } = req.query as { page?: string; limit?: string };
    const moments = await Moment.getFriendMoments(req.user!.id, page ? +page : 1, limit ? +limit : 10);
    res.json({ success: true, data: moments });
  } catch (e) { res.status(500).json({ success: false, message: '服务器错误' }); }
});

router.get('/following', authenticateToken, async (req, res) => {
  try {
    const { page, limit } = req.query as { page?: string; limit?: string };
    const moments = await Moment.getFollowingPublicMoments(req.user!.id, page ? +page : 1, limit ? +limit : 10);
    res.json({ success: true, data: moments });
  } catch (e) { res.status(500).json({ success: false, message: '服务器错误' }); }
});

router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { content, type, visibility } = req.body as { content?: string; type?: string; visibility?: string };
    const result = await Moment.update(+req.params.id, req.user!.id, { content, type, visibility });
    res.json({ success: true, data: result });
  } catch (e) { res.status(500).json({ success: false, message: '服务器错误' }); }
});

router.get('/:id', async (req, res) => {
  try {
    const moment = await Moment.findById(+req.params.id);
    if (!moment) return res.status(404).json({ success: false, message: '动态不存在' });
    res.json({ success: true, data: moment });
  } catch (e) { res.status(500).json({ success: false, message: '服务器错误' }); }
});

router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const result = await Moment.delete(+req.params.id, req.user!.id);
    res.json({ success: true, data: result });
  } catch (e) { res.status(500).json({ success: false, message: '服务器错误' }); }
});

export default router;
