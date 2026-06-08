import db from '../config/database.ts';
import time from '../utils/time.ts';

interface FileRecordRow {
  id: number;
  user_id: number;
  file_path: string;
  file_size: number;
  original_name: string;
  mime_type: string;
  source_type: string;
  topic_id: number | null;
  is_private: boolean;
  message_id: number | null;
  moment_id: number | null;
  post_type: string | null;
  expires_at: string | null;
  file_deleted: boolean;
  created_at: string;
}

interface FileInfo {
  userId: number;
  filePath: string;
  fileSize: number;
  originalName: string;
  mimeType: string;
  sourceType: string;
  topicId?: number | null;
  isPrivate?: boolean;
  messageId?: number | null;
  momentId?: number | null;
  postType?: string | null;
  expiresAt?: string | null;
}

class FileRecord {
  static async create(fileInfo: FileInfo): Promise<number> {
    const {
      userId, filePath, fileSize, originalName, mimeType,
      sourceType, topicId = null, isPrivate = false, messageId = null,
      momentId = null, postType = null, expiresAt = null
    } = fileInfo;

    const currentTime = time.currentDbString();

    const result = await db.run(
      `INSERT INTO file_records
       (user_id, file_path, file_size, original_name, mime_type,
        source_type, topic_id, is_private, message_id,
        moment_id, post_type, expires_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       RETURNING id`,
      [userId, filePath, fileSize, originalName, mimeType,
       sourceType, topicId, isPrivate, messageId,
       momentId, postType, expiresAt, currentTime]
    );
    return result.lastID ?? 0;
  }

  static async createBatch(fileInfos: FileInfo[]): Promise<number[]> {
    if (!fileInfos || fileInfos.length === 0) return [];
    const currentTime = time.currentDbString();

    const promises = fileInfos.map(info => {
      const {
        userId, filePath, fileSize, originalName, mimeType,
        sourceType, topicId = null, isPrivate = false, messageId = null,
        momentId = null, postType = null, expiresAt = null
      } = info;

      return db.run(
        `INSERT INTO file_records
         (user_id, file_path, file_size, original_name, mime_type,
          source_type, topic_id, is_private, message_id,
          moment_id, post_type, expires_at, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         RETURNING id`,
        [userId, filePath, fileSize, originalName, mimeType,
         sourceType, topicId, isPrivate, messageId,
         momentId, postType, expiresAt, currentTime]
      );
    });

    const results = await Promise.all(promises);
    return results.map(r => r.lastID ?? 0);
  }

  static async findByMessageId(messageId: number): Promise<FileRecordRow | undefined> {
    return db.get<FileRecordRow>(
      "SELECT * FROM file_records WHERE message_id = ? AND file_deleted = false",
      [messageId]
    );
  }

  static async findByMomentId(momentId: number): Promise<FileRecordRow[]> {
    return db.all<FileRecordRow>(
      "SELECT * FROM file_records WHERE moment_id = ? AND file_deleted = false ORDER BY created_at ASC",
      [momentId]
    );
  }

  static async markDeleted(id: number): Promise<void> {
    await db.run(
      "UPDATE file_records SET file_deleted = true WHERE id = ?",
      [id]
    );
  }

  static async getExpiredFiles(): Promise<FileRecordRow[]> {
    return db.all<FileRecordRow>(
      "SELECT * FROM file_records WHERE expires_at IS NOT NULL AND expires_at < ? AND file_deleted = false",
      [time.currentDbString()]
    );
  }

  static async calcChatExpiry(mimeType: string): Promise<string> {
    const cfg = (await import('../config/index.ts')).default.upload;
    let days: number;
    if (mimeType.startsWith('image/')) days = cfg.chatImageExpiryDays;
    else if (mimeType.startsWith('video/')) days = cfg.chatVideoExpiryDays;
    else days = cfg.chatFileExpiryDays;
    return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
  }

  static async findByPath(filePath: string): Promise<FileRecordRow | undefined> {
    return db.get<FileRecordRow>("SELECT * FROM file_records WHERE file_path = ?", [filePath]);
  }

  static isVideo(mimeType: string): boolean {
    return mimeType.startsWith('video/');
  }

  static async getFilesBySource(sourceType: string, topicId: number | null = null): Promise<FileRecordRow[]> {
    if (topicId) {
      return db.all<FileRecordRow>(
        "SELECT * FROM file_records WHERE source_type = ? AND topic_id = ? AND file_deleted = false ORDER BY created_at DESC",
        [sourceType, topicId]
      );
    }
    return db.all<FileRecordRow>(
      "SELECT * FROM file_records WHERE source_type = ? AND file_deleted = false ORDER BY created_at DESC",
      [sourceType]
    );
  }
}

export default FileRecord;
