import fs from 'node:fs';
import path from 'node:path';
import type { Request, Response, NextFunction } from 'express';

const config = await import('../config/index.ts');
const cfg = config.default;
const uploadDir = path.join(import.meta.dir, '../uploads');
const videoExts = /\.(mp4|avi|mov|wmv|flv|webm|mkv|m4v|3gp)$/i;

const mimeTypes: Record<string, string> = {
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
  '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml',
  '.mp4': 'video/mp4', '.avi': 'video/x-msvideo', '.mov': 'video/quicktime',
  '.webm': 'video/webm', '.pdf': 'application/pdf', '.txt': 'text/plain', '.zip': 'application/zip'
};

function actualPath(filePath: string): string | null {
  if (fs.existsSync(filePath)) return filePath;
  const ext = path.extname(filePath);
  if (ext) { const np = filePath.slice(0, -ext.length); if (fs.existsSync(np)) return np; }
  return null;
}

function sendThrottled(filePath: string, res: Response, kbps: number): void {
  const ap = actualPath(filePath);
  if (!ap) { res.status(404).json({ success: false, message: '文件不存在' }); return; }
  const stat = fs.statSync(ap);
  const ext = path.extname(filePath).toLowerCase();
  res.setHeader('Content-Type', mimeTypes[ext] || 'application/octet-stream');
  res.setHeader('Content-Length', stat.size);
  if (kbps <= 0) { res.sendFile(ap); return; }

  const bps = kbps * 1024, cs = 16384, delay = Math.floor(cs / bps * 1000);
  const st = fs.createReadStream(ap, { highWaterMark: cs });
  st.on('data', (chunk: Buffer) => { st.pause(); setTimeout(() => { res.write(chunk); st.resume(); }, delay); });
  st.on('end', () => res.end());
  st.on('error', () => { if (!res.headersSent) res.status(500).json({ success: false, message: '读取错误' }); });
}

export default async function fileDownload(req: Request, res: Response, next: NextFunction): Promise<void> {
  const rp = req.path, isChat = rp.startsWith('/chat/'), isVideo = videoExts.test(rp);
  if (!isChat && !isVideo) return next();
  const abs = path.join(uploadDir, rp);
  try {
    if (isChat) {
      const FileRecord = (await import('../models/FileRecord.ts')).default;
      const rec = await FileRecord.findByPath('/uploads' + rp);
      if (rec?.expires_at && new Date(rec.expires_at) < new Date()) {
        fs.existsSync(abs) && fs.unlink(abs, () => {});
        await FileRecord.markDeleted(rec.id).catch(() => {});
        res.status(410).json({ success: false, message: '文件已过期' }); return;
      }
    }
    let limit = 0;
    if (isChat) limit = cfg.upload.chatDownloadSpeedLimitKBps;
    else if (isVideo) { limit = cfg.upload.videoDownloadSpeedLimitKBps; if (!limit) { res.status(403).json({ success: false, message: '视频已禁用' }); return; } }
    sendThrottled(abs, res, limit);
  } catch { next(); }
}
