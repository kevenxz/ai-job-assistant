import { buildServer } from './app';
import { dataDir, repoRoot, serverConfig } from './config';
import { detectChromePath } from './resume';

const { app, store } = await buildServer({
  logger: process.env.AIJOB_LOG === '1',
});

try {
  await app.listen({ host: serverConfig.host, port: serverConfig.port });
} catch (error) {
  console.error(`\n启动失败：${error instanceof Error ? error.message : String(error)}`);
  if (error instanceof Error && error.message.includes('EADDRINUSE')) {
    console.error(`端口 ${serverConfig.port} 已被占用。请关闭占用该端口的进程，或设置 PORT 环境变量。`);
  }
  process.exit(1);
}

const settings = store.getSettings();
const chromePath = detectChromePath(settings);
const token = store.getToken();

console.log(`
┌─────────────────────────────────────────────────────────────┐
│  AI 求职助手 · 本地服务已启动                                │
└─────────────────────────────────────────────────────────────┘
  管理后台   http://${serverConfig.host}:${serverConfig.port}
  健康检查   http://${serverConfig.host}:${serverConfig.port}/api/health
  数据目录   ${dataDir}
  访问令牌   ${token.slice(0, 6)}…${token.slice(-4)}（保存在 .data/token，后台/扩展会自动配对）

  模型       ${settings.llm.model} · ${settings.llm.apiKey ? 'API Key 已配置' : '尚未配置 API Key'}
  PDF 引擎   ${chromePath ? chromePath : '未找到 Chrome/Edge（简历只能下载 HTML）'}

  加载扩展   Chrome → chrome://extensions → 开发者模式 → 加载已解压的扩展程序
             选择 ${repoRoot}\\apps\\extension\\dist
`);
