import crypto from 'node:crypto';
import { isProfileReady, type ChatDraft, type ChatObserveInput, type Greeting, type Job, type JobAnalysis, type Profile, type ResumeVariant } from '../../../src/shared/types';
import { errorMessage, HttpError } from './errors';
import { LlmClient } from './llm';
import {
  groundResumeDoc,
  normalizeAnalysis,
  normalizeChatResult,
  normalizeGreeting,
  normalizeResumeResult,
} from './normalize';
import { analyzePrompt, chatReplyPrompt, greetingPrompt, tailorPrompt } from './prompts';
import { buildResumeHtml, renderResumePdf } from './resume';
import { Store } from './store';

export function requireProfile(store: Store): Profile {
  const profile = store.getProfile();
  if (!isProfileReady(profile)) {
    throw new HttpError(400, '请先在管理后台完善基础资料：填写姓名，并至少添加一段工作或项目经历。');
  }
  return profile;
}

function requireKeyInfo(store: Store, jobId: string): Job {
  const job = store.getJob(jobId);
  if (!job) throw new HttpError(404, '岗位不存在或已被删除');
  return job;
}

export async function runAnalysis(
  store: Store,
  llm: LlmClient,
  jobId: string,
  regenerate = false,
): Promise<JobAnalysis> {
  const job = requireKeyInfo(store, jobId);
  if (!regenerate) {
    const cached = store.getAnalysis(jobId);
    if (cached) return cached;
  }
  const profile = requireProfile(store);
  const prompt = analyzePrompt(job, profile, store.getSettings());
  const raw = await llm.json<unknown>(prompt.system, prompt.user, { temperature: 0.2 });
  const analysis = normalizeAnalysis(raw);
  return store.saveAnalysis(jobId, analysis);
}

export async function runResumeTailoring(
  store: Store,
  llm: LlmClient,
  jobId: string,
): Promise<ResumeVariant> {
  const job = requireKeyInfo(store, jobId);
  const profile = requireProfile(store);
  const analysis = store.getAnalysis(jobId);
  const prompt = tailorPrompt(job, profile, analysis, store.getSettings());
  const raw = await llm.json<unknown>(prompt.system, prompt.user, { temperature: 0.35 });
  const parsed = normalizeResumeResult(raw);
  const grounded = groundResumeDoc(parsed.doc, profile);

  const id = crypto.randomUUID();
  const html = buildResumeHtml(grounded.doc, profile, store.getSettings());
  store.writeResumeFile(id, 'html', html);

  let hasPdf = false;
  const changeNotes = [...parsed.changeNotes, ...grounded.notes];
  const matchedKeywords = parsed.matchedKeywords.slice(0, 25);
  const missingKeywords = parsed.missingKeywords.slice(0, 25);

  try {
    const result = await renderResumePdf(grounded.doc, profile, store.getSettings());
    store.writeResumeFile(id, 'pdf', result.pdf);
    hasPdf = true;
    changeNotes.push(...result.warnings);
  } catch (error) {
    changeNotes.push(`PDF 未生成：${errorMessage(error)}`);
  }

  const variant: ResumeVariant = {
    id,
    jobId,
    doc: grounded.doc,
    matchedKeywords,
    missingKeywords,
    changeNotes: [...new Set(changeNotes)].slice(0, 10),
    createdAt: new Date().toISOString(),
    hasPdf,
  };
  return store.saveResume(variant);
}

export async function runGreeting(
  store: Store,
  llm: LlmClient,
  jobId: string,
  regenerate = false,
): Promise<Greeting> {
  const job = requireKeyInfo(store, jobId);
  if (!regenerate) {
    const cached = store.getGreeting(jobId);
    if (cached) return cached;
  }
  const profile = requireProfile(store);
  const analysis = store.getAnalysis(jobId);
  const prompt = greetingPrompt(job, profile, analysis, store.getSettings());
  const raw = await llm.json<unknown>(prompt.system, prompt.user, { temperature: 0.6 });
  const parsed = normalizeGreeting(raw);
  return store.saveGreeting(jobId, {
    text: parsed.text,
    rationale: parsed.rationale,
    createdAt: new Date().toISOString(),
  });
}

function messageSignature(messages: ChatObserveInput['messages']): string {
  return messages
    .slice(-8)
    .map((message) => `${message.role}:${message.text}`)
    .join('\n')
    .slice(-4000);
}

export async function runChatDraft(
  store: Store,
  llm: LlmClient,
  input: ChatObserveInput,
  force = false,
): Promise<{ draft: ChatDraft; cached: boolean }> {
  const profile = requireProfile(store);
  const existing = store.getChat(input.conversationKey);

  if (
    !force &&
    existing &&
    existing.messages.length === input.messages.length &&
    messageSignature(existing.messages) === messageSignature(input.messages)
  ) {
    return { draft: existing, cached: true };
  }

  let jobId = input.jobId && store.getJob(input.jobId) ? input.jobId : undefined;
  if (!jobId) {
    const matched = store.listJobs().find((job) => {
      const companyMatch = input.company ? job.company.includes(input.company) || input.company.includes(job.company) : false;
      const titleMatch = input.jobTitle ? job.title.includes(input.jobTitle) || input.jobTitle.includes(job.title) : false;
      return companyMatch && titleMatch;
    });
    jobId = matched?.id;
  }

  const prompt = chatReplyPrompt(
    {
      hrName: input.hrName,
      company: input.company || '',
      jobTitle: input.jobTitle || '',
      messages: input.messages,
    },
    profile,
    store.getSettings(),
  );
  const raw = await llm.json<unknown>(prompt.system, prompt.user, { temperature: 0.4 });
  const parsed = normalizeChatResult(raw);

  const draft: ChatDraft = {
    key: input.conversationKey,
    jobId,
    hrName: input.hrName || 'HR',
    company: input.company || '',
    jobTitle: input.jobTitle || '',
    jobUrl: input.jobUrl || '',
    messages: input.messages.slice(-30),
    intent: parsed.intent,
    sentiment: parsed.sentiment,
    reply: parsed.reply,
    riskFlags: parsed.riskFlags,
    nextAction: parsed.nextAction,
    updatedAt: new Date().toISOString(),
  };
  return { draft: store.saveChat(draft), cached: false };
}
