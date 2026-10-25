import type {
  Application,
  ApplicationStatus,
  Bootstrap,
  ChatDraft,
  Greeting,
  JobAnalysis,
  JobWithState,
  Profile,
  PublicSettings,
  ResumeVariant,
  SettingsPatch,
} from '../../../src/shared/types';

let token = '';

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function ensureToken(force = false): Promise<void> {
  if (token && !force) return;
  const response = await fetch('/api/pair', { cache: 'no-store' });
  if (!response.ok) throw new ApiError('无法连接本地服务，请确认 npm start 正在运行', response.status);
  const data = (await response.json()) as { token?: string };
  if (!data.token) throw new ApiError('本地服务没有返回访问令牌', 500);
  token = data.token;
}

async function request<T>(path: string, init: RequestInit = {}, retry = true): Promise<T> {
  await ensureToken();
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${token}`);
  if (typeof init.body === 'string' && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  const response = await fetch(path, { ...init, headers });
  if (response.status === 401 && retry) {
    token = '';
    await ensureToken(true);
    return request<T>(path, init, false);
  }
  const text = await response.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }
  if (!response.ok) {
    const message = (data as { error?: string } | null)?.error || `请求失败（HTTP ${response.status}）`;
    throw new ApiError(message, response.status);
  }
  return data as T;
}

export function assetUrl(path: string, download = false): string {
  if (!path) return '';
  const separator = path.includes('?') ? '&' : '?';
  return `${path}${separator}token=${encodeURIComponent(token)}${download ? '&download=1' : ''}`;
}

export const api = {
  bootstrap: () => request<Bootstrap>('/api/bootstrap'),

  getProfile: () => request<{ profile: Profile }>('/api/profile'),
  saveProfile: (profile: Profile) =>
    request<{ profile: Profile }>('/api/profile', { method: 'PUT', body: JSON.stringify(profile) }),
  uploadResume: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return request<{ fileName: string; text: string; pages: number | null }>('/api/profile/import', {
      method: 'POST',
      body: form,
    });
  },
  parseResume: (text: string) =>
    request<{ profile: Profile }>('/api/profile/parse', {
      method: 'POST',
      body: JSON.stringify({ text }),
    }),

  getSettings: () => request<{ settings: PublicSettings }>('/api/settings'),
  saveSettings: (patch: SettingsPatch) =>
    request<{ settings: PublicSettings }>('/api/settings', {
      method: 'PUT',
      body: JSON.stringify(patch),
    }),
  testLlm: () =>
    request<{ ok: boolean; latencyMs: number; reply: string }>('/api/settings/test', { method: 'POST' }),

  getJobs: () => request<{ jobs: JobWithState[] }>('/api/jobs'),
  captureJob: (input: {
    title: string;
    company: string;
    salary: string;
    city: string;
    url: string;
    jdText: string;
  }) =>
    request<{ job: JobWithState; created: boolean }>('/api/jobs/capture', {
      method: 'POST',
      body: JSON.stringify({ ...input, platform: 'boss', source: 'manual' }),
    }),
  getJob: (id: string) =>
    request<{
      job: JobWithState;
      greeting: Greeting | null;
      resumes: ResumeVariant[];
      chat: ChatDraft | null;
    }>(`/api/jobs/${encodeURIComponent(id)}`),
  analyzeJob: (id: string, regenerate = false) =>
    request<{ analysis: JobAnalysis }>(`/api/jobs/${encodeURIComponent(id)}/analyze`, {
      method: 'POST',
      body: JSON.stringify({ regenerate }),
    }),
  tailorResume: (id: string) =>
    request<{ resume: ResumeVariant }>(`/api/jobs/${encodeURIComponent(id)}/tailor`, {
      method: 'POST',
      body: '{}',
    }),
  generateGreeting: (id: string, regenerate = false) =>
    request<{ greeting: Greeting }>(`/api/jobs/${encodeURIComponent(id)}/greeting`, {
      method: 'POST',
      body: JSON.stringify({ regenerate }),
    }),

  markSubmitted: (jobId: string, greeting: string, resumeVariantId?: string) =>
    request<{ application: Application; duplicate: boolean }>('/api/applications', {
      method: 'POST',
      body: JSON.stringify({ jobId, greeting, resumeVariantId }),
    }),
  updateApplication: (id: string, patch: { status?: ApplicationStatus; notes?: string }) =>
    request<{ application: Application }>(`/api/applications/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),

  getChats: () => request<{ chats: ChatDraft[] }>('/api/chats'),
  regenerateChat: (key: string) =>
    request<{ draft: ChatDraft }>('/api/chats/regenerate', {
      method: 'POST',
      body: JSON.stringify({ key }),
    }),
};
