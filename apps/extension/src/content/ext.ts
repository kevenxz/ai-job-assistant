import type { ApiMessageResponse, ExtensionMessage, FileMessageResponse, StateMessageResponse } from '../messages';

async function send<T>(message: ExtensionMessage): Promise<T> {
  let response: unknown;
  try {
    response = await chrome.runtime.sendMessage(message);
  } catch (error) {
    throw new Error(
      `扩展与本地服务通信失败：${error instanceof Error ? error.message : String(error)}。请刷新页面重试。`,
    );
  }
  if (!response || typeof response !== 'object') {
    throw new Error('扩展后台没有响应，请重新加载扩展或刷新页面');
  }
  return response as T;
}

export async function api<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  const response = await send<ApiMessageResponse<T>>({ type: 'API', path, method, body });
  if (!response.ok) throw new Error(response.error || '本地服务请求失败');
  return response.data as T;
}

export async function getState(): Promise<StateMessageResponse> {
  return send<StateMessageResponse>({ type: 'GET_STATE' });
}

export async function setServer(serverUrl: string): Promise<void> {
  const response = await send<{ ok: boolean; error?: string }>({ type: 'SET_SERVER', serverUrl });
  if (!response.ok) throw new Error(response.error || '连接失败');
}

export async function fetchFile(path: string): Promise<FileMessageResponse> {
  return send<FileMessageResponse>({ type: 'FETCH_FILE', path });
}

export async function openDashboard(path = ''): Promise<void> {
  const response = await send<{ ok: boolean; error?: string }>({ type: 'OPEN_DASHBOARD', path });
  if (!response.ok) throw new Error(response.error || '打开后台失败');
}

export async function openUrl(path: string, download = false): Promise<void> {
  const response = await send<{ ok: boolean; error?: string }>({ type: 'OPEN_URL', path, download });
  if (!response.ok) throw new Error(response.error || '打开文件失败');
}
