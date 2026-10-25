import {
  DEFAULT_SERVER_URL,
  type ApiMessageResponse,
  type ExtensionMessage,
  type FileMessageResponse,
  type StateMessageResponse,
} from './messages';

interface Config {
  serverUrl: string;
  token: string;
}

async function readConfig(): Promise<Config> {
  const stored = await chrome.storage.local.get(['serverUrl', 'token']);
  return {
    serverUrl: typeof stored.serverUrl === 'string' ? stored.serverUrl : DEFAULT_SERVER_URL,
    token: typeof stored.token === 'string' ? stored.token : '',
  };
}

function normalizeServerUrl(input: string): string {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    throw new Error('请输入有效的本地服务地址，例如 http://127.0.0.1:8787');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('服务地址必须以 http:// 或 https:// 开头');
  }
  if (!['127.0.0.1', 'localhost', '::1'].includes(url.hostname)) {
    throw new Error('为保护数据安全，只允许连接本机地址（127.0.0.1 或 localhost）');
  }
  return url.origin;
}

async function pair(serverUrl: string): Promise<string> {
  let response: Response;
  try {
    response = await fetch(`${serverUrl}/api/pair`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(6000),
    });
  } catch {
    throw new Error(`无法连接本地服务 ${serverUrl}，请确认 npm start 正在运行`);
  }
  if (!response.ok) throw new Error(`本地服务返回 ${response.status}，请确认版本是否匹配`);
  const data = (await response.json()) as { token?: string };
  if (!data.token) throw new Error('本地服务没有返回访问令牌');
  await chrome.storage.local.set({ token: data.token });
  return data.token;
}

async function authorizedFetch(
  path: string,
  init: RequestInit,
  retry = true,
): Promise<globalThis.Response> {
  const config = await readConfig();
  const token = config.token || (await pair(config.serverUrl));
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${token}`);
  let response: globalThis.Response;
  try {
    response = await fetch(`${config.serverUrl}${path}`, {
      ...init,
      headers,
      signal: AbortSignal.timeout(200_000),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`无法连接本地服务（${message}）。请确认服务正在运行，地址为 ${config.serverUrl}`);
  }
  if (response.status === 401 && retry) {
    await pair(config.serverUrl);
    return authorizedFetch(path, init, false);
  }
  return response;
}

async function handleApi(
  message: Extract<ExtensionMessage, { type: 'API' }>,
): Promise<ApiMessageResponse> {
  const method = (message.method || 'GET').toUpperCase();
  const init: RequestInit = { method };
  if (message.body !== undefined) {
    init.headers = { 'Content-Type': 'application/json' };
    init.body = JSON.stringify(message.body);
  }
  const response = await authorizedFetch(message.path, init);
  const text = await response.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }
  if (!response.ok) {
    const error =
      (data as { error?: string } | null)?.error || `本地服务请求失败（HTTP ${response.status}）`;
    return { ok: false, status: response.status, error };
  }
  return { ok: true, status: response.status, data };
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = '';
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return btoa(binary);
}

async function handleFile(
  message: Extract<ExtensionMessage, { type: 'FETCH_FILE' }>,
): Promise<FileMessageResponse> {
  const response = await authorizedFetch(message.path, { method: 'GET' });
  if (!response.ok) {
    return { ok: false, error: `下载简历失败（HTTP ${response.status}）` };
  }
  const buffer = await response.arrayBuffer();
  if (buffer.byteLength > 8 * 1024 * 1024) {
    return { ok: false, error: '文件超过 8MB，请到管理后台手动下载' };
  }
  const disposition = response.headers.get('content-disposition') || '';
  const encoded = /filename\*=UTF-8''([^;]+)/.exec(disposition)?.[1];
  let filename = '简历.pdf';
  if (encoded) {
    try {
      filename = decodeURIComponent(encoded);
    } catch {
      filename = '简历.pdf';
    }
  }
  return {
    ok: true,
    base64: arrayBufferToBase64(buffer),
    mime: response.headers.get('content-type') || 'application/pdf',
    filename,
  };
}

async function openUrl(path: string, download = false): Promise<void> {
  if (!path.startsWith('/')) throw new Error('非法的文件路径');
  const config = await readConfig();
  const token = config.token || (await pair(config.serverUrl));
  const separator = path.includes('?') ? '&' : '?';
  const url = `${config.serverUrl}${path}${separator}token=${encodeURIComponent(token)}${
    download ? '&download=1' : ''
  }`;
  await chrome.tabs.create({ url });
}

async function openDashboard(path = ''): Promise<void> {
  const config = await readConfig();
  const clean = path.replace(/^#?\/?/, '');
  const hash = clean ? `#/${clean}` : '';
  await chrome.tabs.create({ url: `${config.serverUrl}/${hash}` });
}

async function handleMessage(message: ExtensionMessage): Promise<unknown> {
  switch (message.type) {
    case 'GET_STATE': {
      const config = await readConfig();
      const response: StateMessageResponse = {
        ok: true,
        serverUrl: config.serverUrl,
        hasToken: Boolean(config.token),
      };
      return response;
    }
    case 'SET_SERVER': {
      const serverUrl = normalizeServerUrl(message.serverUrl);
      await chrome.storage.local.set({ serverUrl, token: '' });
      await pair(serverUrl);
      return { ok: true, serverUrl };
    }
    case 'API':
      return handleApi(message);
    case 'FETCH_FILE':
      return handleFile(message);
    case 'OPEN_DASHBOARD':
      await openDashboard(message.path || '');
      return { ok: true };
    case 'OPEN_URL':
      await openUrl(message.path, message.download);
      return { ok: true };
    default:
      return { ok: false, error: '未知的扩展消息' };
  }
}

chrome.runtime.onMessage.addListener((message: ExtensionMessage, _sender, sendResponse) => {
  handleMessage(message)
    .then((response) => sendResponse(response))
    .catch((error) =>
      sendResponse({ ok: false, error: error instanceof Error ? error.message : String(error) }),
    );
  return true;
});

chrome.runtime.onInstalled.addListener(async () => {
  const stored = await chrome.storage.local.get(['serverUrl']);
  if (!stored.serverUrl) {
    await chrome.storage.local.set({ serverUrl: DEFAULT_SERVER_URL });
  }
});

chrome.action.onClicked.addListener(async (tab) => {
  if (tab.id) {
    try {
      await chrome.tabs.sendMessage(tab.id, { type: 'TOGGLE_PANEL' });
      return;
    } catch {
      // 页面没有内容脚本时打开管理后台
    }
  }
  await openDashboard('jobs');
});
