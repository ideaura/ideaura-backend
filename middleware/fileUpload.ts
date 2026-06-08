// middleware/fileUpload.ts — Bun-only simplified version
// File upload is handled by start.ts's Bun.serve fetch handler (native formData).
// These middleware are pass-throughs that forward req.chatFile / req.contentFiles / req.momentMedia.

import type { Request, Response, NextFunction } from 'express';

function makeUploadMiddleware(fieldName: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    // Files are already parsed by Bun's native formData in start.ts
    // and attached to the request object.
    if (!(req as Record<string, unknown>)[fieldName] && !(req as Record<string, unknown>).contentFiles && !(req as Record<string, unknown>).momentMedia) {
      // No file data from Bun layer — fall through
    }
    next();
  };
}

const processFileWithMd5 = makeUploadMiddleware('file');
const chatFileUpload = makeUploadMiddleware('chatFile');
const contentUpload = makeUploadMiddleware('contentFiles');
const momentUpload = makeUploadMiddleware('momentMedia');

export { processFileWithMd5, chatFileUpload, contentUpload, momentUpload };
