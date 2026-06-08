import fs from 'node:fs';
import path from 'node:path';

const uploadDir = path.join(import.meta.dir, '../uploads');
let cleanupTimer: ReturnType<typeof setInterval> | null = null;

async function runCleanup(): Promise<void> {
  try {
    const FileRecord = (await import('../models/FileRecord.ts')).default;
    const expired = await FileRecord.getExpiredFiles();
    if (!expired.length) return;
    console.log(`[fileCleanup] 发现 ${expired.length} 个过期文件`);
    let deleted = 0;
    for (const r of expired) {
      try {
        const ap = path.join(uploadDir, r.file_path.replace(/^\/uploads\//, ''));
        if (fs.existsSync(ap)) { fs.unlinkSync(ap); deleted++; }
        await FileRecord.markDeleted(r.id);
      } catch (e) { console.error(`[fileCleanup] 失败 id=${r.id}:`, (e as Error).message); }
    }
    console.log(`[fileCleanup] 清理了 ${deleted} 个文件`);
  } catch (e) { console.error('[fileCleanup] 错误:', (e as Error).message); }
}

export function startCleanup(ms: number = 3600000): void {
  if (cleanupTimer) return;
  console.log(`[fileCleanup] 启动, 间隔 ${Math.round(ms / 60000)}min`);
  runCleanup();
  cleanupTimer = setInterval(runCleanup, ms);
  cleanupTimer.unref();
}

export function stopCleanup(): void {
  if (cleanupTimer) { clearInterval(cleanupTimer); cleanupTimer = null; }
}

export { runCleanup };
