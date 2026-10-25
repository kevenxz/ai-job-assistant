import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {
  DEFAULT_SETTINGS,
  EMPTY_PROFILE,
  type Application,
  type ApplicationStatus,
  type CapturedJobInput,
  type ChatDraft,
  type Greeting,
  type Job,
  type JobAnalysis,
  type Profile,
  type PublicSettings,
  type ResumeVariant,
  type Settings,
  type SettingsPatch,
} from '../../../src/shared/types';
import { envLlm, envChromePath } from './config';
import { HttpError } from './errors';

interface DbFile {
  version: number;
  profile: Profile;
  jobs: Job[];
  analyses: Record<string, JobAnalysis>;
  resumes: ResumeVariant[];
  greetings: Record<string, Greeting>;
  applications: Application[];
  chats: ChatDraft[];
  settings: Settings;
}

export interface NewApplicationResult {
  application: Application;
  duplicate: boolean;
}

function mergeSettings(base: Settings, patch: SettingsPatch): Settings {
  const next: Settings = {
    ...base,
    llm: { ...base.llm, ...(patch.llm || {}) },
    automation: { ...base.automation, ...(patch.automation || {}) },
    autoGreet: { ...base.autoGreet, ...(patch.autoGreet || {}) },
    resume: { ...base.resume, ...(patch.resume || {}) },
    replyTone: patch.replyTone ?? base.replyTone,
    customInstructions: patch.customInstructions ?? base.customInstructions,
    chromePath: patch.chromePath ?? base.chromePath,
  };

  if (!next.llm.baseUrl.startsWith('http://') && !next.llm.baseUrl.startsWith('https://')) {
    throw new HttpError(400, 'API 地址必须以 http:// 或 https:// 开头');
  }
  if (!next.llm.model.trim()) throw new HttpError(400, '模型名称不能为空');
  next.llm.temperature = Math.min(1.5, Math.max(0, Number(next.llm.temperature) || 0));
  next.llm.baseUrl = next.llm.baseUrl.trim().replace(/\/+$/, '');
  next.llm.model = next.llm.model.trim();
  next.llm.jsonMode = Boolean(next.llm.jsonMode);

  next.automation.maxPerDay = Math.min(100, Math.max(1, Math.round(next.automation.maxPerDay)));
  next.automation.minIntervalSeconds = Math.min(
    600,
    Math.max(0, Math.round(next.automation.minIntervalSeconds)),
  );
  next.autoGreet.enabled = Boolean(next.autoGreet.enabled);
  next.autoGreet.minScore = Math.min(100, Math.max(0, Math.round(Number(next.autoGreet.minScore) || 80)));
  next.autoGreet.countdownSeconds = Math.min(
    30,
    Math.max(3, Math.round(Number(next.autoGreet.countdownSeconds) || 5)),
  );
  next.resume.pageLimit = next.resume.pageLimit === 1 ? 1 : 2;
  next.resume.fontScale = Math.min(1.1, Math.max(0.82, Number(next.resume.fontScale) || 1));
  if (!/^#[0-9a-fA-F]{6}$/.test(next.resume.accentColor)) {
    next.resume.accentColor = DEFAULT_SETTINGS.resume.accentColor;
  }
  next.customInstructions = next.customInstructions.slice(0, 2000);
  next.chromePath = next.chromePath.slice(0, 500);
  return next;
}

function dayKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.hash = '';
    for (const key of [...parsed.searchParams.keys()]) {
      if (!['jobId', 'query', 'city'].includes(key)) parsed.searchParams.delete(key);
    }
    return parsed.toString();
  } catch {
    return url.trim();
  }
}

function extractBossJobId(url: string): string {
  return url.match(/job_detail\/([^./?]+)\.html/)?.[1] || '';
}

export class Store {
  readonly dataDir: string;
  readonly resumeDir: string;
  private dbPath: string;
  private tokenPath: string;
  private db: DbFile;
  private token: string;

  constructor(dataDir: string) {
    this.dataDir = dataDir;
    this.resumeDir = path.join(dataDir, 'resumes');
    this.dbPath = path.join(dataDir, 'db.json');
    this.tokenPath = path.join(dataDir, 'token');
    fs.mkdirSync(this.resumeDir, { recursive: true });
    this.token = this.loadOrCreateToken();
    this.db = this.load();
  }

  private loadOrCreateToken(): string {
    try {
      const existing = fs.readFileSync(this.tokenPath, 'utf8').trim();
      if (existing.length >= 24) return existing;
    } catch {
      // create below
    }
    const token = crypto.randomBytes(24).toString('hex');
    fs.writeFileSync(this.tokenPath, token, { encoding: 'utf8', mode: 0o600 });
    return token;
  }

  getToken(): string {
    return this.token;
  }

  private load(): DbFile {
    if (!fs.existsSync(this.dbPath)) {
      const seeded: Settings = {
        ...DEFAULT_SETTINGS,
        llm: {
          ...DEFAULT_SETTINGS.llm,
          baseUrl: envLlm.baseUrl || DEFAULT_SETTINGS.llm.baseUrl,
          apiKey: envLlm.apiKey || '',
          model: envLlm.model || DEFAULT_SETTINGS.llm.model,
        },
        chromePath: envChromePath || '',
      };
      return {
        version: 1,
        profile: structuredClone(EMPTY_PROFILE),
        jobs: [],
        analyses: {},
        resumes: [],
        greetings: {},
        applications: [],
        chats: [],
        settings: seeded,
      };
    }
    const raw = JSON.parse(fs.readFileSync(this.dbPath, 'utf8')) as Partial<DbFile>;
    return {
      version: 1,
      profile: raw.profile || structuredClone(EMPTY_PROFILE),
      jobs: raw.jobs || [],
      analyses: raw.analyses || {},
      resumes: raw.resumes || [],
      greetings: raw.greetings || {},
      applications: raw.applications || [],
      chats: raw.chats || [],
      settings: mergeSettings(DEFAULT_SETTINGS, raw.settings || {}),
    };
  }

  private persist(): void {
    const tmp = `${this.dbPath}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(this.db, null, 2), 'utf8');
    fs.renameSync(tmp, this.dbPath);
  }

  getProfile(): Profile {
    return this.db.profile;
  }

  saveProfile(profile: Profile): Profile {
    this.db.profile = { ...profile, updatedAt: new Date().toISOString() };
    this.persist();
    return this.db.profile;
  }

  listJobs(): Job[] {
    return [...this.db.jobs].sort((a, b) => b.capturedAt.localeCompare(a.capturedAt));
  }

  getJob(id: string): Job | undefined {
    return this.db.jobs.find((job) => job.id === id);
  }

  upsertJob(input: CapturedJobInput): { job: Job; created: boolean } {
    const url = normalizeUrl(input.url || '');
    const platformJobId = (input.platformJobId || extractBossJobId(url)).trim();
    const title = (input.title || '未命名岗位').trim().slice(0, 200);
    const company = (input.company || '未知公司').trim().slice(0, 200);
    const hashSource = `${url}|${company}|${title}`;
    const id = platformJobId
      ? `boss_${platformJobId}`
      : `boss_${crypto.createHash('sha1').update(hashSource).digest('hex').slice(0, 16)}`;

    const clean: CapturedJobInput = {
      ...input,
      platform: 'boss',
      platformJobId,
      url,
      title,
      company,
      salary: (input.salary || '').trim().slice(0, 100),
      city: (input.city || '').trim().slice(0, 100),
      area: (input.area || '').trim().slice(0, 200),
      experience: (input.experience || '').trim().slice(0, 100),
      education: (input.education || '').trim().slice(0, 100),
      tags: (input.tags || []).filter(Boolean).slice(0, 20).map((tag) => String(tag).slice(0, 40)),
      jdText: (input.jdText || '').trim().slice(0, 30000),
      hrName: (input.hrName || '').trim().slice(0, 100),
      hrTitle: (input.hrTitle || '').trim().slice(0, 100),
      companyInfo: (input.companyInfo || '').trim().slice(0, 5000),
    };

    const existing = this.db.jobs.find(
      (job) => job.id === id || (!platformJobId && job.url && job.url === url),
    );
    if (existing) {
      const jdChanged = existing.jdText !== clean.jdText;
      Object.assign(existing, clean, { id: existing.id });
      if (jdChanged) {
        delete this.db.analyses[existing.id];
        delete this.db.greetings[existing.id];
      }
      this.persist();
      return { job: existing, created: false };
    }

    const job: Job = {
      ...clean,
      id,
      capturedAt: new Date().toISOString(),
    };
    this.db.jobs.push(job);
    this.persist();
    return { job, created: true };
  }

  getAnalysis(jobId: string): JobAnalysis | undefined {
    return this.db.analyses[jobId];
  }

  saveAnalysis(jobId: string, analysis: JobAnalysis): JobAnalysis {
    this.db.analyses[jobId] = analysis;
    this.persist();
    return analysis;
  }

  getGreeting(jobId: string): Greeting | undefined {
    return this.db.greetings[jobId];
  }

  saveGreeting(jobId: string, greeting: Greeting): Greeting {
    this.db.greetings[jobId] = greeting;
    this.persist();
    return greeting;
  }

  listResumes(jobId?: string): ResumeVariant[] {
    const list = jobId ? this.db.resumes.filter((resume) => resume.jobId === jobId) : this.db.resumes;
    return [...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  getResume(id: string): ResumeVariant | undefined {
    return this.db.resumes.find((resume) => resume.id === id);
  }

  saveResume(resume: ResumeVariant): ResumeVariant {
    this.db.resumes.push(resume);
    this.persist();
    return resume;
  }

  getApplicationByJob(jobId: string): Application | undefined {
    return this.db.applications.find((application) => application.jobId === jobId);
  }

  listApplications(): Application[] {
    return [...this.db.applications].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  countTodayApplications(): number {
    const today = dayKey(new Date());
    return this.db.applications.filter(
      (application) =>
        application.submittedAt && dayKey(new Date(application.submittedAt)) === today,
    ).length;
  }

  assertCanSubmit(): void {
    const now = new Date();
    const settings = this.db.settings.automation;
    const todayCount = this.countTodayApplications();
    if (todayCount >= settings.maxPerDay) {
      throw new HttpError(
        429,
        `已达到今日投递上限（${settings.maxPerDay} 个），请在设置中调整上限或明天再试。`,
      );
    }
    const latest = this.db.applications
      .filter((application) => application.submittedAt)
      .sort((a, b) => (b.submittedAt || '').localeCompare(a.submittedAt || ''))[0];
    if (latest?.submittedAt) {
      const elapsed = now.getTime() - new Date(latest.submittedAt).getTime();
      const waitMs = settings.minIntervalSeconds * 1000 - elapsed;
      if (waitMs > 0) {
        throw new HttpError(429, `投递间隔过短，请等待 ${Math.ceil(waitMs / 1000)} 秒后再试。`);
      }
    }
  }

  precheckApplication(jobId: string): { ok: true; duplicate: boolean; application?: Application } {
    if (!this.getJob(jobId)) throw new HttpError(404, '岗位不存在');
    const existing = this.getApplicationByJob(jobId);
    if (existing && existing.status !== 'drafted') {
      return { ok: true, duplicate: true, application: existing };
    }
    this.assertCanSubmit();
    return { ok: true, duplicate: false, application: existing };
  }

  submitApplication(jobId: string, greeting: string, resumeVariantId?: string): NewApplicationResult {
    if (!this.getJob(jobId)) throw new HttpError(404, '岗位不存在');
    const existing = this.getApplicationByJob(jobId);
    if (existing && existing.status !== 'drafted') {
      return { application: existing, duplicate: true };
    }

    const now = new Date();
    this.assertCanSubmit();
    const timestamp = now.toISOString();
    if (existing) {
      existing.status = 'submitted';
      existing.greeting = greeting;
      existing.resumeVariantId = resumeVariantId || existing.resumeVariantId;
      existing.submittedAt = timestamp;
      existing.timeline.push({ at: timestamp, status: 'submitted', note: '招呼语已发送' });
      this.persist();
      return { application: existing, duplicate: false };
    }

    const application: Application = {
      id: crypto.randomUUID(),
      jobId,
      status: 'submitted',
      greeting,
      resumeVariantId,
      notes: '',
      createdAt: timestamp,
      submittedAt: timestamp,
      timeline: [{ at: timestamp, status: 'submitted', note: '招呼语已发送' }],
    };
    this.db.applications.push(application);
    this.persist();
    return { application, duplicate: false };
  }

  updateApplication(
    id: string,
    patch: { status?: ApplicationStatus; notes?: string },
  ): Application {
    const application = this.db.applications.find((item) => item.id === id);
    if (!application) throw new HttpError(404, '投递记录不存在');
    if (patch.status && patch.status !== application.status) {
      application.status = patch.status;
      application.timeline.push({
        at: new Date().toISOString(),
        status: patch.status,
        note: patch.notes || '',
      });
    }
    if (typeof patch.notes === 'string') application.notes = patch.notes.slice(0, 2000);
    this.persist();
    return application;
  }

  listChats(): ChatDraft[] {
    return [...this.db.chats].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  getChat(key: string): ChatDraft | undefined {
    return this.db.chats.find((chat) => chat.key === key);
  }

  saveChat(chat: ChatDraft): ChatDraft {
    const index = this.db.chats.findIndex((item) => item.key === chat.key);
    if (index >= 0) this.db.chats[index] = chat;
    else this.db.chats.push(chat);
    if (this.db.chats.length > 200) {
      this.db.chats = this.db.chats
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
        .slice(0, 200);
    }
    this.persist();
    return chat;
  }

  getSettings(): Settings {
    return this.db.settings;
  }

  getPublicSettings(): PublicSettings {
    const { llm, ...rest } = this.db.settings;
    return {
      ...rest,
      llm: {
        baseUrl: llm.baseUrl,
        model: llm.model,
        temperature: llm.temperature,
        jsonMode: llm.jsonMode,
        hasApiKey: Boolean(llm.apiKey),
        apiKeyHint: llm.apiKey ? `已保存（尾号 ${llm.apiKey.slice(-4)}）` : '',
      },
    };
  }

  updateSettings(patch: SettingsPatch): Settings {
    const sanitized: SettingsPatch = { ...patch };
    if (sanitized.llm?.apiKey !== undefined && !sanitized.llm.apiKey.trim()) {
      sanitized.llm = { ...sanitized.llm };
      delete sanitized.llm.apiKey;
    }
    this.db.settings = mergeSettings(this.db.settings, sanitized);
    this.persist();
    return this.db.settings;
  }

  writeResumeFile(id: string, type: 'html' | 'pdf', content: string | Buffer): string {
    const filePath = path.join(this.resumeDir, `${id}.${type}`);
    fs.writeFileSync(filePath, content);
    return filePath;
  }

  resumeFilePath(id: string, type: 'html' | 'pdf'): string {
    return path.join(this.resumeDir, `${id}.${type}`);
  }
}
