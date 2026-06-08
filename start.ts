// start.ts — Bun-only entry point
import app from './app.ts';
import { initialize, PORT } from './app.ts';
import { getBunWebSocketConfig } from './services/mqtt.ts';

const config = await import('./config/index.ts');
const cfg = config.default;
const fs = await import('node:fs');

// Build server config
const serverConfig: Record<string, unknown> = {
  port: PORT,
  websocket: getBunWebSocketConfig(),

  async fetch(request: Request, server: unknown) {
    const url = new URL(request.url);

    // WebSocket upgrade
    if (url.pathname === '/mqtt') {
      const upgraded = (server as { upgrade: (r: Request) => boolean }).upgrade(request);
      if (upgraded) return;
      return new Response('WebSocket upgrade failed', { status: 426 });
    }

    // File upload routes — use Bun native formData
    const contentType = request.headers.get('content-type') || '';
    const isUpload = request.method === 'POST' && contentType.includes('multipart/form-data');

    let bodyBuffer: Buffer;
    let chatFile: Record<string, unknown> | null = null;
    let contentFiles: string[] | null = null;
    let contentFilesMeta: Record<string, unknown>[] | null = null;

    if (isUpload) {
      const formData = await request.formData();
      const files: { key: string; file: File }[] = [];
      const jsonFields: Record<string, unknown> = {};

      for (const [key, value] of formData.entries()) {
        if (value instanceof File) files.push({ key, file: value });
        else jsonFields[key] = value;
      }
      bodyBuffer = Buffer.from(JSON.stringify(jsonFields));

      let uploadType: string | null = null;
      if (url.pathname.includes('/chat/')) {
        uploadType = 'chat';
      } else if (url.pathname.includes('/blog/')) {
        uploadType = 'blog';
      } else if (url.pathname.includes('/posts/')) {
        uploadType = 'posts';
      } else if (url.pathname.includes('/moments')) {
        uploadType = 'moments';
      } else if (url.pathname.includes('/communities') || url.pathname.includes('/avatar') || url.pathname.includes('/users/')) {
        uploadType = 'avatars';
      }

      if (uploadType) {
        const targetDir = `${import.meta.dir}/uploads/${uploadType}`;
        if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });

        const uploadedUrls: string[] = [];
        const uploadedMeta: { filePath: string; fileSize: number; mimeType: string; originalName: string }[] = [];

        for (const { key, file } of files) {
          if ((uploadType === 'chat' && key !== 'file') || (uploadType !== 'chat' && key !== 'files')) continue;

          const arrayBuffer = await file.arrayBuffer();
          const fileBuffer = Buffer.from(arrayBuffer);
          const hasher = new Bun.CryptoHasher('md5');
          hasher.update(fileBuffer);
          const fileMd5 = hasher.digest('hex');
          const ext = '.' + (file.name.split('.').pop() || 'bin');
          const destPath = `${targetDir}/${fileMd5}`;
          const urlPath = `/uploads/${uploadType}/${fileMd5}${ext}`;

          if (!fs.existsSync(destPath)) await Bun.write(destPath, fileBuffer);

          uploadedUrls.push(urlPath);
          uploadedMeta.push({ filePath: urlPath, fileSize: file.size, mimeType: file.type || 'application/octet-stream', originalName: file.name });
        }

        if (uploadType === 'chat') {
          const first = uploadedMeta[0];
          chatFile = first ? {
            filePath: first.filePath, fileSize: first.fileSize, mimeType: first.mimeType,
            originalName: first.filePath.split('/').pop()!, rawOriginalName: first.originalName,
            md5: first.filePath.split('/').pop()!.replace(/\.[^.]+$/, '')
          } : null;
          contentFiles = uploadedUrls;
          contentFilesMeta = uploadedMeta;
        } else if (uploadType === 'moments') {
          const imgUrls = uploadedUrls.filter(u => uploadedMeta.find(m => m.filePath === u)?.mimeType?.startsWith('image/'));
          const vidUrl = uploadedUrls.find(u => uploadedMeta.find(m => m.filePath === u)?.mimeType?.startsWith('video/')) || null;
          (req as Record<string, unknown>).momentMedia = { mediaUrls: imgUrls.length > 0 ? imgUrls : null, videoUrl: vidUrl };
          contentFiles = uploadedUrls;
          contentFilesMeta = uploadedMeta;
        } else {
          contentFiles = uploadedUrls;
          contentFilesMeta = uploadedMeta;
        }
      }
    } else {
      bodyBuffer = Buffer.from(await request.arrayBuffer());
    }

    // Build IncomingMessage-compatible request
    const http = await import('node:http');
    const { EventEmitter } = await import('node:events');
    const socket = new EventEmitter() as Record<string, unknown>;
    (socket as { destroy: () => void }).destroy = () => {};
    (socket as { destroyed: boolean }).destroyed = false;
    (socket as { writable: boolean }).writable = true;
    (socket as { readable: boolean }).readable = true;
    (socket as { remoteAddress: string }).remoteAddress = '127.0.0.1';
    (socket as { remotePort: number }).remotePort = 0;

    const req = new http.IncomingMessage(socket as import('net').Socket);
    req.method = request.method;
    req.url = url.pathname + url.search;

    const headers: Record<string, string> = {};
    for (const [k, v] of request.headers.entries()) headers[k.toLowerCase()] = v;

    if (isUpload) {
      headers['content-type'] = 'application/json';
      headers['content-length'] = String(bodyBuffer.length);
      (req as Record<string, unknown>).chatFile = chatFile;
      (req as Record<string, unknown>).contentFiles = contentFiles;
      (req as Record<string, unknown>).contentFilesMeta = contentFilesMeta;
    }

    req.headers = headers;

    if (isUpload || !contentType.includes('multipart/form-data')) {
      req.push(bodyBuffer);
      req.push(null);
    } else {
      let bodyOffset = 0;
      (req as Record<string, unknown>)._read = function(size: number) {
        if (bodyOffset >= bodyBuffer.length) { (this as { push: (d: null) => void }).push(null); return; }
        const end = Math.min(bodyOffset + (size || 64 * 1024), bodyBuffer.length);
        (this as { push: (d: Buffer) => void }).push(bodyBuffer.slice(bodyOffset, end));
        bodyOffset = end;
      };
    }

    const res = new http.ServerResponse(req);
    return new Promise<Response>((resolve) => {
      const chunks: Buffer[] = [];
      const originalWrite = res.write.bind(res);
      const originalEnd = res.end.bind(res);

      res.write = function(chunk: string | Buffer, encoding?: BufferEncoding, callback?: () => void) {
        if (chunk) chunks.push(Buffer.from(chunk, encoding));
        if (callback) callback();
        return true;
      };
      res.end = function(chunk?: string | Buffer, encoding?: BufferEncoding, callback?: () => void) {
        if (chunk) chunks.push(Buffer.from(chunk, encoding));
        const body = Buffer.concat(chunks);
        const respHeaders: Record<string, string> = {};
        const headerNames = typeof res.getHeaderNames === 'function' ? res.getHeaderNames() : Object.keys((res as Record<string, unknown>)._headers as object || {});
        for (const name of headerNames) respHeaders[name] = String(res.getHeader(name));
        resolve(new Response(body, { status: res.statusCode || 200, headers: respHeaders }));
        if (callback) callback();
      };

      app(req, res);
    });
  }
};

// SSL
if (cfg.ssl && cfg.ssl.enabled !== 'false') {
  (serverConfig as Record<string, unknown>).tls = {
    key: fs.readFileSync(cfg.ssl.keyPath),
    cert: fs.readFileSync(cfg.ssl.certPath)
  };
  if (cfg.ssl.caPath && fs.existsSync(cfg.ssl.caPath)) {
    (serverConfig as Record<string, unknown>).tls = {
      ...(serverConfig as Record<string, { key: Buffer; cert: Buffer; ca?: Buffer }>).tls,
      ca: fs.readFileSync(cfg.ssl.caPath)
    };
  }
  console.log(`[Bun] SSL 已启用`);
}

// Initialize services, then start
await initialize();

console.log(`[Bun] 服务器启动在端口 ${PORT}`);
export default serverConfig;
