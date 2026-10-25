import fs from 'node:fs';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import {
  APPLICATION_STATUS_LABELS,
  isProfileReady,
  type ApplicationStatus,
  type CapturedJobInput,
  type ChatObserveInput,
  type Job,
  type JobWithState,
  type ReplyTone,
  type ResumeSummary,
  type ResumeVariant,
  type SettingsPatch,
} from '../../../src/shared/types';
import { HttpError } from './errors';
import { LlmClient } from './llm';
import { isRecord, normalizeChatMessages, normalizeProfile } from './normalize';
import { profileImportPrompt } from './prompts';
import { extractResumeText, sanitizeFileName } from './resume';
import { runAnalysis, runChatDraft, runGreeting, runResumeTailoring } from './services';
import { Store } from './store';

function bodyOf(request: FastifyRequest): Record<string, unknown> {
  if (!isRecord(request.body)) throw new HttpError(400, '请求体必须是 JSON 对象');
  return request.body;
}

function str(value: unknown, max = 2000): string {
  if (typeof value === 'string') return value.trim().slice(0, max);
  if (typeof value === 'number') return String(value);
  return '';
}

function strArray(value: unknown, maxItems = 20, maxLen = 60): string[] {
  return Array.isArray(value)
    ? value
        .map((item) => (typeof item === 'string' ? item.trim() : ''))
        .filter(Boolean)
        .slice(0, maxItems)
        .map((item) => item.slice(0, maxLen))
    : [];
}

function publicResume(variant: ResumeVariant): ResumeVariant {
  return {
    ...variant,
    pdfUrl: variant.hasPdf ? `/api/resumes/${variant.id}.pdf` : undefined,
    htmlUrl: `/api/resumes/${variant.id}.html`,
  };
}

function resumeSummary(variant: ResumeVariant): ResumeSummary {
  return {
    id: variant.id,
    createdAt: variant.createdAt,
    hasPdf: variant.hasPdf,
    pdfUrl: variant.hasPdf ? `/api/resumes/${variant.id}.pdf` : '',
    htmlUrl: `/api/resumes/${variant.id}.html`,
  };
}

function jobWithState(store: Store, job: Job): JobWithState {
  const analysis = store.getAnalysis(job.id);
  const application = store.getApplicationByJob(job.id);
  const latest = store.listResumes(job.id)[0];
  return {
    ...job,
    ...(analysis ? { analysis } : {}),
    ...(application ? { application } : {}),
    ...(latest ? { latestResume: resumeSummary(latest) } : {}),
  };
}

function contentDisposition(type: 'inline' | 'attachment', filename: string): string {
  return `${type}; filename*=UTF-8''${encodeURIComponent(filename).replace(/'/g, '%27')}`;
}

export function registerRoutes(app: FastifyInstance, store: Store, llm: LlmClient): void {
  app.get('/api/health', async () => ({
    ok: true,
    version: '0.1.0',
    time: new Date().toISOString(),
  }));

  app.get('/api/pair', async (_request, reply) => {
    reply.header('Cache-Control', 'no-store');
    return { token: store.getToken() };
  });

  app.get('/api/bootstrap', async () => {
    const settings = store.getPublicSettings();
    return {
      version: '0.1.0',
      profileReady: isProfileReady(store.getProfile()),
      llmConfigured: settings.llm.hasApiKey,
      settings,
      todayApplications: store.countTodayApplications(),
    };
  });

  app.get('/api/profile', async () => ({ profile: store.getProfile() }));

  app.put('/api/profile', async (request) => {
    const body = bodyOf(request);
    const raw = 'profile' in body ? body.profile : body;
    const profile = normalizeProfile(raw);
    if (profile.basics.name.length > 100) throw new HttpError(400, '姓名过长');
    return { profile: store.saveProfile(profile) };
  });

  app.post('/api/profile/import', async (request) => {
    const file = await request.file();
    if (!file) throw new HttpError(400, '请选择一个简历文件');
    const buffer = await file.toBuffer();
    if (buffer.length > 15 * 1024 * 1024) throw new HttpError(413, '文件不能超过 15MB');
    const extracted = await extractResumeText(file.filename || 'resume', buffer);
    return {
      fileName: file.filename,
      text: extracted.text,
      pages: extracted.pages || null,
    };
  });

  app.post('/api/profile/parse', async (request) => {
    const body = bodyOf(request);
    const text = str(body.text, 60_000);
    if (text.length < 30) throw new HttpError(400, '简历文本太短，至少需要 30 个字符');
    const prompt = profileImportPrompt(text);
    const raw = await llm.json<unknown>(prompt.system, prompt.user, { temperature: 0.1 });
    return { profile: normalizeProfile(raw) };
  });

  app.get('/api/settings', async () => ({ settings: store.getPublicSettings() }));

  app.put('/api/settings', async (request) => {
    const body = bodyOf(request);
    const patch: SettingsPatch = {};

    if (isRecord(body.llm)) {
      const llmPatch: NonNullable<SettingsPatch['llm']> = {};
      if (typeof body.llm.baseUrl === 'string') llmPatch.baseUrl = body.llm.baseUrl;
      if (typeof body.llm.apiKey === 'string') llmPatch.apiKey = body.llm.apiKey;
      if (typeof body.llm.model === 'string') llmPatch.model = body.llm.model;
      if (typeof body.llm.temperature === 'number') llmPatch.temperature = body.llm.temperature;
      if (typeof body.llm.jsonMode === 'boolean') llmPatch.jsonMode = body.llm.jsonMode;
      patch.llm = llmPatch;
    }

    if (isRecord(body.automation)) {
      const automation: NonNullable<SettingsPatch['automation']> = {};
      if (typeof body.automation.maxPerDay === 'number') automation.maxPerDay = body.automation.maxPerDay;
      if (typeof body.automation.minIntervalSeconds === 'number') {
        automation.minIntervalSeconds = body.automation.minIntervalSeconds;
      }
      if (typeof body.automation.autoDraftReplies === 'boolean') {
        automation.autoDraftReplies = body.automation.autoDraftReplies;
      }
      if (typeof body.automation.autoSendGreeting === 'boolean') {
        automation.autoSendGreeting = body.automation.autoSendGreeting;
      }
      if (typeof body.automation.autoSendReply === 'boolean') {
        automation.autoSendReply = body.automation.autoSendReply;
      }
      patch.automation = automation;
    }

    if (isRecord(body.autoGreet)) {
      const autoGreet: NonNullable<SettingsPatch['autoGreet']> = {};
      if (typeof body.autoGreet.enabled === 'boolean') autoGreet.enabled = body.autoGreet.enabled;
      if (typeof body.autoGreet.minScore === 'number') autoGreet.minScore = body.autoGreet.minScore;
      if (typeof body.autoGreet.countdownSeconds === 'number') {
        autoGreet.countdownSeconds = body.autoGreet.countdownSeconds;
      }
      patch.autoGreet = autoGreet;
    }

    if (isRecord(body.resume)) {
      const resume: NonNullable<SettingsPatch['resume']> = {};
      if (typeof body.resume.accentColor === 'string') resume.accentColor = body.resume.accentColor;
      if (typeof body.resume.pageLimit === 'number') resume.pageLimit = body.resume.pageLimit;
      if (typeof body.resume.fontScale === 'number') resume.fontScale = body.resume.fontScale;
      patch.resume = resume;
    }

    if (typeof body.replyTone === 'string' && ['专业', '友好', '简洁'].includes(body.replyTone)) {
      patch.replyTone = body.replyTone as ReplyTone;
    }
    if (typeof body.customInstructions === 'string') {
      patch.customInstructions = body.customInstructions;
    }
    if (typeof body.chromePath === 'string') patch.chromePath = body.chromePath;

    store.updateSettings(patch);
    return { settings: store.getPublicSettings() };
  });

  app.post('/api/settings/test', async () => {
    const result = await llm.test();
    return { ok: true, ...result };
  });

  app.get('/api/jobs', async () => ({
    jobs: store.listJobs().map((job) => jobWithState(store, job)),
  }));

  app.get('/api/jobs/:id', async (request) => {
    const { id } = request.params as { id: string };
    const job = store.getJob(id);
    if (!job) throw new HttpError(404, '岗位不存在');
    return {
      job: jobWithState(store, job),
      greeting: store.getGreeting(id) || null,
      resumes: store.listResumes(id).map(publicResume),
      chat: store.listChats().find((chat) => chat.jobId === id) || null,
    };
  });

  app.post('/api/jobs/capture', async (request) => {
    const body = bodyOf(request);
    const payload = isRecord(body.job) ? body.job : body;
    const input: CapturedJobInput = {
      platform: 'boss',
      platformJobId: str(payload.platformJobId, 120),
      url: str(payload.url, 2000),
      title: str(payload.title, 200),
      company: str(payload.company, 200),
      salary: str(payload.salary, 100),
      city: str(payload.city, 100),
      area: str(payload.area, 200),
      experience: str(payload.experience, 100),
      education: str(payload.education, 100),
      tags: strArray(payload.tags, 20, 40),
      jdText: str(payload.jdText, 30_000),
      hrName: str(payload.hrName, 100),
      hrTitle: str(payload.hrTitle, 100),
      companyInfo: str(payload.companyInfo, 5000),
      source: payload.source === 'manual' ? 'manual' : 'page',
    };

    if (!input.title) throw new HttpError(400, '未识别到岗位名称，请手动填写');
    if (input.jdText.length < 20) {
      throw new HttpError(400, '岗位描述太短，请在页面展开职位详情，或手动粘贴完整 JD。');
    }

    const { job, created } = store.upsertJob(input);
    return { job: jobWithState(store, job), created };
  });

  app.post('/api/jobs/:id/analyze', async (request) => {
    const { id } = request.params as { id: string };
    const body = isRecord(request.body) ? request.body : {};
    const analysis = await runAnalysis(store, llm, id, body.regenerate === true);
    return { analysis };
  });

  app.post('/api/jobs/:id/tailor', async (request) => {
    const { id } = request.params as { id: string };
    const variant = await runResumeTailoring(store, llm, id);
    return { resume: publicResume(variant) };
  });

  app.post('/api/jobs/:id/greeting', async (request) => {
    const { id } = request.params as { id: string };
    const body = isRecord(request.body) ? request.body : {};
    const greeting = await runGreeting(store, llm, id, body.regenerate === true);
    return { greeting };
  });

  app.get('/api/applications', async () => ({
    applications: store.listApplications(),
  }));

  app.post('/api/applications/precheck', async (request) => {
    const body = bodyOf(request);
    const jobId = str(body.jobId, 100);
    if (!jobId) throw new HttpError(400, '缺少岗位 ID');
    return store.precheckApplication(jobId);
  });

  app.post('/api/applications', async (request) => {
    const body = bodyOf(request);
    const jobId = str(body.jobId, 100);
    const greeting = str(body.greeting, 500);
    const resumeVariantId = str(body.resumeVariantId, 100) || undefined;
    if (!jobId) throw new HttpError(400, '缺少岗位 ID');
    if (!greeting) throw new HttpError(400, '招呼语不能为空');

    if (resumeVariantId) {
      const variant = store.getResume(resumeVariantId);
      if (!variant || variant.jobId !== jobId) throw new HttpError(400, '简历与岗位不匹配');
    }

    const result = store.submitApplication(jobId, greeting, resumeVariantId);
    return result;
  });

  app.patch('/api/applications/:id', async (request) => {
    const { id } = request.params as { id: string };
    const body = bodyOf(request);
    const status =
      typeof body.status === 'string' &&
      Object.keys(APPLICATION_STATUS_LABELS).includes(body.status)
        ? (body.status as ApplicationStatus)
        : undefined;
    const notes = typeof body.notes === 'string' ? body.notes : undefined;
    const application = store.updateApplication(id, { status, notes });
    return { application };
  });

  app.get('/api/chats', async () => ({ chats: store.listChats() }));

  app.post('/api/chats/observe', async (request) => {
    const body = bodyOf(request);
    const key = str(body.conversationKey, 120);
    if (!/^[a-zA-Z0-9_-]{6,120}$/.test(key)) {
      throw new HttpError(400, '对话标识不合法');
    }
    const messages = normalizeChatMessages(body.messages);
    if (!messages.length) throw new HttpError(400, '没有可分析的对话消息');
    if (messages[messages.length - 1].role !== 'hr') {
      return { draft: store.getChat(key) || null, skipped: true };
    }

    const input: ChatObserveInput = {
      conversationKey: key,
      jobId: str(body.jobId, 100) || undefined,
      hrName: str(body.hrName, 100) || 'HR',
      company: str(body.company, 200),
      jobTitle: str(body.jobTitle, 200),
      jobUrl: str(body.jobUrl, 2000),
      messages,
    };
    const { draft, cached } = await runChatDraft(store, llm, input, body.force === true);
    return { draft, cached };
  });

  app.post('/api/chats/regenerate', async (request) => {
    const body = bodyOf(request);
    const key = str(body.key, 120);
    const existing = store.getChat(key);
    if (!existing) throw new HttpError(404, '对话草稿不存在');
    const { draft } = await runChatDraft(
      store,
      llm,
      {
        conversationKey: existing.key,
        jobId: existing.jobId,
        hrName: existing.hrName,
        company: existing.company,
        jobTitle: existing.jobTitle,
        jobUrl: existing.jobUrl,
        messages: existing.messages,
      },
      true,
    );
    return { draft };
  });

  app.get('/api/resumes/:file', async (request, reply) => {
    const { file } = request.params as { file: string };
    const match = /^([a-zA-Z0-9-]{8,64})\.(pdf|html)$/.exec(file);
    if (!match) throw new HttpError(404, '简历文件不存在');
    const [, id, type] = match;
    const variant = store.getResume(id);
    if (!variant) throw new HttpError(404, '简历不存在');
    const filePath = store.resumeFilePath(id, type as 'pdf' | 'html');
    if (!fs.existsSync(filePath)) throw new HttpError(404, '简历文件尚未生成');
    const job = store.getJob(variant.jobId);
    const name = sanitizeFileName(
      `${store.getProfile().basics.name || '简历'}_${job?.title || '定制简历'}_${job?.company || ''}`,
    );
    const wantDownload = (request.query as { download?: string }).download === '1';
    reply.header(
      'Content-Disposition',
      contentDisposition(wantDownload ? 'attachment' : 'inline', `${name}.${type}`),
    );
    reply.header('Cache-Control', 'private, max-age=60');
    if (type === 'pdf') {
      reply.type('application/pdf');
      return reply.send(fs.readFileSync(filePath));
    }
    reply.type('text/html; charset=utf-8');
    reply.header(
      'Content-Security-Policy',
      "default-src 'none'; style-src 'unsafe-inline'; img-src data:; frame-ancestors 'self'",
    );
    return reply.send(fs.readFileSync(filePath));
  });
}
