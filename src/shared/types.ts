export type JobPlatform = 'boss';

export interface Basics {
  name: string;
  phone: string;
  email: string;
  city: string;
  wechat?: string;
  birthYear?: string;
  gender?: string;
  workYears?: string;
  currentStatus?: string;
  github?: string;
  portfolio?: string;
}

export interface Expectations {
  roles: string[];
  cities: string[];
  salary: string;
  jobType: string;
  industries: string[];
  availability: string;
}

export interface ExperienceItem {
  company: string;
  title: string;
  start: string;
  end: string;
  city?: string;
  description?: string;
  achievements: string[];
  tech?: string[];
}

export interface ProjectItem {
  name: string;
  role?: string;
  start?: string;
  end?: string;
  description?: string;
  achievements: string[];
  tech: string[];
}

export interface EducationItem {
  school: string;
  degree: string;
  major: string;
  start: string;
  end: string;
  highlights?: string[];
}

export interface Profile {
  basics: Basics;
  headline: string;
  summary: string;
  expectations: Expectations;
  skills: string[];
  experience: ExperienceItem[];
  projects: ProjectItem[];
  education: EducationItem[];
  certificates: string[];
  extras: string;
  updatedAt?: string;
}

export interface CapturedJobInput {
  platform: JobPlatform;
  platformJobId?: string;
  url: string;
  title: string;
  company: string;
  salary: string;
  city: string;
  area?: string;
  experience?: string;
  education?: string;
  tags?: string[];
  jdText: string;
  hrName?: string;
  hrTitle?: string;
  companyInfo?: string;
  source: 'page' | 'manual';
}

export interface Job extends CapturedJobInput {
  id: string;
  capturedAt: string;
}

export type Verdict = '推荐投递' | '可以尝试' | '谨慎投递' | '不建议';

export interface JobAnalysis {
  score: number;
  verdict: Verdict;
  summary: string;
  reasons: string[];
  matched: string[];
  gaps: string[];
  risks: string[];
  keywords: string[];
  suggestedAngle: string;
  questionsToAsk: string[];
  salaryComment: string;
  createdAt: string;
}

export interface ResumeExperienceEntry {
  company: string;
  title: string;
  start: string;
  end: string;
  city?: string;
  bullets: string[];
}

export interface ResumeProjectEntry {
  name: string;
  role?: string;
  start?: string;
  end?: string;
  tech: string[];
  bullets: string[];
}

export interface ResumeEducationEntry {
  school: string;
  degree: string;
  major: string;
  start: string;
  end: string;
}

export interface ResumeDoc {
  headline: string;
  jobIntention: string;
  summary: string;
  skills: string[];
  experience: ResumeExperienceEntry[];
  projects: ResumeProjectEntry[];
  education: ResumeEducationEntry[];
  certificates: string[];
}

export interface ResumeVariant {
  id: string;
  jobId: string;
  doc: ResumeDoc;
  matchedKeywords: string[];
  missingKeywords: string[];
  changeNotes: string[];
  createdAt: string;
  hasPdf: boolean;
  pdfUrl?: string;
  htmlUrl?: string;
}

export interface Greeting {
  text: string;
  rationale: string;
  createdAt: string;
}

export type ApplicationStatus =
  | 'drafted'
  | 'submitted'
  | 'replied'
  | 'interview'
  | 'rejected'
  | 'offer'
  | 'archived';

export interface ApplicationEvent {
  at: string;
  status: ApplicationStatus;
  note?: string;
}

export interface Application {
  id: string;
  jobId: string;
  status: ApplicationStatus;
  greeting: string;
  resumeVariantId?: string;
  notes: string;
  createdAt: string;
  submittedAt?: string;
  timeline: ApplicationEvent[];
}

export type ChatRole = 'hr' | 'me' | 'system';

export interface ChatMessage {
  role: ChatRole;
  text: string;
  at?: string;
}

export interface ChatDraft {
  key: string;
  jobId?: string;
  hrName: string;
  company: string;
  jobTitle: string;
  jobUrl?: string;
  messages: ChatMessage[];
  intent: string;
  sentiment: string;
  reply: string;
  riskFlags: string[];
  nextAction: string;
  updatedAt: string;
}

export interface ChatObserveInput {
  conversationKey: string;
  jobId?: string;
  hrName: string;
  company?: string;
  jobTitle?: string;
  jobUrl?: string;
  messages: ChatMessage[];
}

export interface LlmSettings {
  baseUrl: string;
  apiKey: string;
  model: string;
  temperature: number;
  jsonMode: boolean;
}

export interface AutomationSettings {
  maxPerDay: number;
  minIntervalSeconds: number;
  autoDraftReplies: boolean;
  autoSendGreeting: boolean;
  autoSendReply: boolean;
}

export interface AutoGreetSettings {
  enabled: boolean;
  minScore: number;
  countdownSeconds: number;
}

export interface ResumeSettings {
  accentColor: string;
  pageLimit: number;
  fontScale: number;
}

export type ReplyTone = '专业' | '友好' | '简洁';

export interface Settings {
  llm: LlmSettings;
  automation: AutomationSettings;
  autoGreet: AutoGreetSettings;
  resume: ResumeSettings;
  replyTone: ReplyTone;
  customInstructions: string;
  chromePath: string;
}

export interface PublicSettings {
  llm: Omit<LlmSettings, 'apiKey'> & { hasApiKey: boolean; apiKeyHint: string };
  automation: AutomationSettings;
  autoGreet: AutoGreetSettings;
  resume: ResumeSettings;
  replyTone: ReplyTone;
  customInstructions: string;
  chromePath: string;
}

export interface Bootstrap {
  version: string;
  profileReady: boolean;
  llmConfigured: boolean;
  settings: PublicSettings;
  todayApplications: number;
}

export interface ResumeSummary {
  id: string;
  createdAt: string;
  hasPdf: boolean;
  pdfUrl: string;
  htmlUrl: string;
}

export interface JobWithState extends Job {
  analysis?: JobAnalysis;
  application?: Application;
  latestResume?: ResumeSummary;
}

export interface ApiErrorBody {
  error: string;
}

export interface SettingsPatch {
  llm?: {
    baseUrl?: string;
    apiKey?: string;
    model?: string;
    temperature?: number;
    jsonMode?: boolean;
  };
  automation?: Partial<AutomationSettings>;
  autoGreet?: Partial<AutoGreetSettings>;
  resume?: Partial<ResumeSettings>;
  replyTone?: ReplyTone;
  customInstructions?: string;
  chromePath?: string;
}

export const APPLICATION_STATUS_LABELS: Record<ApplicationStatus, string> = {
  drafted: '待投递',
  submitted: '已投递',
  replied: '已回复',
  interview: '面试中',
  rejected: '已拒绝',
  offer: '已录用',
  archived: '已归档',
};

export const DEFAULT_SETTINGS: Settings = {
  llm: {
    baseUrl: 'https://api.deepseek.com/v1',
    apiKey: '',
    model: 'deepseek-chat',
    temperature: 0.4,
    jsonMode: true,
  },
  automation: {
    maxPerDay: 20,
    minIntervalSeconds: 30,
    autoDraftReplies: true,
    autoSendGreeting: true,
    autoSendReply: true,
  },
  autoGreet: {
    enabled: false,
    minScore: 80,
    countdownSeconds: 5,
  },
  resume: {
    accentColor: '#1f5eff',
    pageLimit: 2,
    fontScale: 1,
  },
  replyTone: '专业',
  customInstructions: '',
  chromePath: '',
};

export const EMPTY_PROFILE: Profile = {
  basics: {
    name: '',
    phone: '',
    email: '',
    city: '',
    wechat: '',
    birthYear: '',
    gender: '',
    workYears: '',
    currentStatus: '',
    github: '',
    portfolio: '',
  },
  headline: '',
  summary: '',
  expectations: {
    roles: [],
    cities: [],
    salary: '',
    jobType: '全职',
    industries: [],
    availability: '',
  },
  skills: [],
  experience: [],
  projects: [],
  education: [],
  certificates: [],
  extras: '',
};

export function isProfileReady(profile: Profile | null | undefined): boolean {
  if (!profile) return false;
  return Boolean(profile.basics.name.trim() && (profile.experience.length > 0 || profile.projects.length > 0));
}
