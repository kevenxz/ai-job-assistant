import fs from 'node:fs';
import path from 'node:path';
import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import multipart from '@fastify/multipart';
import { dataDir as defaultDataDir, webDistDir } from './config';
import { HttpError } from './errors';
import { LlmClient } from './llm';
import { registerRoutes } from './routes';
import { Store } from './store';

const PUBLIC_API = new Set(['/api/health', '/api/pair']);

const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "frame-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'self'",
].join('; ');

function setupHtml(port: number): string {
  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>AI 求职助手 · 初始化</title>
<style>
  body { margin:0; font-family: "Microsoft YaHei", sans-serif; background:#f6f7fb; color:#1e2430; }
  .wrap { max-width:720px; margin:80px auto; padding:0 24px; }
  .card { background:#fff; border:1px solid #e4e7ef; border-radius:16px; padding:32px; box-shadow:0 12px 40px rgba(20,30,60,.06); }
  h1 { font-size:24px; margin:0 0 8px; }
  p { color:#5b6472; line-height:1.7; }
  code { background:#f0f2f7; padding:2px 6px; border-radius:6px; color:#1f5eff; }
  pre { background:#111827; color:#e5e7eb; padding:16px; border-radius:10px; overflow:auto; }
  .badge { display:inline-block; background:#e8f0ff; color:#1f5eff; border-radius:999px; padding:4px 10px; font-size:12px; margin-bottom:16px; }
  a { color:#1f5eff; }
</style>
</head>
<body>
  <div class="wrap">
    <div class="card">
      <div class="badge">本地服务运行中 · 127.0.0.1:${port}</div>
      <h1>管理后台还未构建</h1>
      <p>本地服务已经启动。请在项目根目录执行下面的命令构建管理后台，然后刷新本页：</p>
      <pre>npm run build:web</pre>
      <p>开发模式也可以直接运行 <code>npm run dev</code>，然后访问 Vite 提供的地址（默认 5173 端口）。</p>
      <p>API 健康检查：<a href="/api/health">/api/health</a></p>
    </div>
  </div>
</body>
</html>`;
}

export interface ServerOptions {
  dataDir?: string;
  logger?: boolean;
}

export async function buildServer(options: ServerOptions = {}) {
  const store = new Store(options.dataDir || defaultDataDir);
  const llm = new LlmClient(store);
  const port = Number(process.env.PORT || 8787);

  const app = Fastify({
    logger: options.logger ?? false,
    bodyLimit: 2 * 1024 * 1024,
    trustProxy: false,
  });

  await app.register(multipart, {
    limits: { fileSize: 15 * 1024 * 1024, files: 1, fields: 5 },
  });

  app.addHook('onRequest', async (request, reply) => {
    const pathname = new URL(request.url, 'http://127.0.0.1').pathname;
    if (!pathname.startsWith('/api/') || PUBLIC_API.has(pathname)) return;

    const authorization = request.headers.authorization || '';
    let provided = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
    if (!provided) {
      const headerToken = request.headers['x-aijob-token'];
      provided = Array.isArray(headerToken) ? headerToken[0] || '' : headerToken || '';
    }
    if (!provided && (request.method === 'GET' || request.method === 'HEAD')) {
      const query = request.query as Record<string, unknown> | undefined;
      provided = typeof query?.token === 'string' ? query.token : '';
    }

    if (provided !== store.getToken()) {
      return reply.code(401).send({ error: '未授权：请刷新扩展或管理后台重新连接本地服务' });
    }
  });

  app.addHook('onSend', async (request, reply, payload) => {
    const pathname = new URL(request.url, 'http://127.0.0.1').pathname;
    reply.header('X-Content-Type-Options', 'nosniff');
    reply.header('Referrer-Policy', 'no-referrer');
    reply.header('Content-Security-Policy', CSP);
    if (pathname.startsWith('/api/')) reply.header('Cache-Control', 'no-store');
    return payload;
  });

  registerRoutes(app, store, llm);

  const indexFile = path.join(webDistDir, 'index.html');
  const hasWebBuild = fs.existsSync(indexFile);
  if (hasWebBuild) {
    await app.register(fastifyStatic, { root: webDistDir, prefix: '/' });
  }

  app.setNotFoundHandler(async (request, reply) => {
    const pathname = new URL(request.url, 'http://127.0.0.1').pathname;
    if (pathname.startsWith('/api/')) {
      return reply.code(404).send({ error: '接口不存在' });
    }
    if (pathname.includes('.')) {
      return reply.code(404).send({ error: '文件不存在' });
    }
    if (hasWebBuild) {
      return reply.type('text/html; charset=utf-8').send(fs.readFileSync(indexFile));
    }
    return reply.type('text/html; charset=utf-8').send(setupHtml(port));
  });

  app.setErrorHandler(async (error, request, reply) => {
    if (error instanceof HttpError) {
      return reply.code(error.statusCode).send({ error: error.message });
    }
    const maybeError = error as { statusCode?: number; message?: string };
    const statusCode = typeof maybeError.statusCode === 'number' ? maybeError.statusCode : 500;
    const message = maybeError.message || '请求参数错误';
    if (statusCode >= 400 && statusCode < 500) {
      return reply.code(statusCode).send({ error: message });
    }
    console.error('[server]', error);
    return reply.code(500).send({ error: `服务器内部错误：${message}` });
  });

  return { app, store, llm };
}
