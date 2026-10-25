import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Bug,
  CheckCircle2,
  ChevronDown,
  Copy,
  Download,
  ExternalLink,
  FileText,
  Link2,
  Loader2,
  MessageSquareText,
  RefreshCw,
  Send,
  Sparkles,
  TriangleAlert,
  X,
} from 'lucide-react';
import {
  APPLICATION_STATUS_LABELS,
  type Bootstrap,
  type CapturedJobInput,
  type ChatDraft,
  type Greeting,
  type JobAnalysis,
  type JobWithState,
  type ResumeVariant,
} from '../../../../src/shared/types';
import { api, fetchFile, getState, openDashboard, openUrl, setServer } from './ext';
import {
  attachResumePdf,
  collectPageDiagnostics,
  extractChatContext,
  extractJobFromPage,
  getPageKind,
  hasChatInput,
  openChatForJob,
  sendChatMessage,
  type ChatContext,
  type ExtractedJob,
  type PageKind,
} from './boss';
import { invalidateBootstrap, observeCurrentChat, startChatWatcher } from './chat';
import { subscribeChatDraft } from './events';

interface JobDetailData {
  job: JobWithState;
  greeting: Greeting | null;
  resumes: ResumeVariant[];
  chat: ChatDraft | null;
}

interface PendingApply {
  jobId: string;
  greeting: string;
  resumeVariantId?: string;
  title: string;
  company: string;
  createdAt: number;
  autoSend?: boolean;
}

type AutoStage = 'analyzing' | 'generating' | 'countdown' | 'sending' | 'done' | 'skipped' | 'error';

interface AutoGreetState {
  stage: AutoStage;
  message: string;
  score?: number;
  countdown?: number;
}

const AUTO_LABELS: Record<AutoStage, string> = {
  analyzing: '分析中',
  generating: '生成中',
  countdown: '倒计时',
  sending: '发送中',
  done: '已完成',
  skipped: '已跳过',
  error: '失败',
};

const AUTO_BADGES: Record<AutoStage, string> = {
  analyzing: 'blue',
  generating: 'blue',
  countdown: 'amber',
  sending: 'blue',
  done: 'green',
  skipped: 'gray',
  error: 'amber',
};

type Toast = { type: 'success' | 'error' | 'info'; message: string };
type Busy =
  | ''
  | 'connect'
  | 'analyze'
  | 'tailor'
  | 'greeting'
  | 'apply'
  | 'pending'
  | 'resume'
  | 'chat'
  | 'status';

const PENDING_KEY = 'aijob_pending_apply_v1';
const DEFAULT_SERVER = 'http://127.0.0.1:8787';

function emptyManual() {
  return { title: '', company: '', salary: '', city: '', url: '', jdText: '' };
}

function manualFromExtracted(extracted: ExtractedJob | null) {
  if (!extracted) return emptyManual();
  return {
    title: extracted.input.title,
    company: extracted.input.company,
    salary: extracted.input.salary,
    city: extracted.input.city,
    url: extracted.input.url,
    jdText: extracted.input.jdText,
  };
}

function normalizeUrl(value: string): string {
  if (!value) return '';
  try {
    const url = new URL(value);
    return `${url.origin}${url.pathname}`;
  } catch {
    return value;
  }
}

function findMatchingJob(jobs: JobWithState[], input: CapturedJobInput): JobWithState | null {
  if (input.platformJobId) {
    const match = jobs.find((job) => job.platformJobId === input.platformJobId);
    if (match) return match;
  }
  const url = normalizeUrl(input.url);
  if (!url) return null;
  return jobs.find((job) => normalizeUrl(job.url) === url) || null;
}

function formatDate(value?: string): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function scoreColor(score: number): string {
  if (score >= 80) return '#12a150';
  if (score >= 65) return '#1f5eff';
  if (score >= 45) return '#d97706';
  return '#e5484d';
}

function verdictClass(verdict: string): string {
  if (verdict === '推荐投递') return 'green';
  if (verdict === '可以尝试') return 'blue';
  if (verdict === '谨慎投递') return 'amber';
  return 'red';
}

function initials(value: string): string {
  return (value || 'HR').slice(0, 1);
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const area = document.createElement('textarea');
      area.value = text;
      area.style.position = 'fixed';
      area.style.opacity = '0';
      document.body.appendChild(area);
      area.select();
      const ok = document.execCommand('copy');
      area.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

async function readPending(): Promise<PendingApply | null> {
  try {
    const stored = await chrome.storage.local.get(PENDING_KEY);
    const value = stored[PENDING_KEY] as PendingApply | undefined;
    if (!value || !value.jobId || !value.greeting) return null;
    if (Date.now() - value.createdAt > 15 * 60 * 1000) {
      await chrome.storage.local.remove(PENDING_KEY);
      return null;
    }
    return value;
  } catch {
    return null;
  }
}

async function savePending(value: PendingApply): Promise<void> {
  await chrome.storage.local.set({ [PENDING_KEY]: value });
}

async function clearPendingStorage(): Promise<void> {
  await chrome.storage.local.remove(PENDING_KEY);
}

export function Panel() {
  const initial = (() => {
    const kind = getPageKind();
    return {
      kind,
      extracted: kind === 'chat' ? null : extractJobFromPage(),
      chat: kind === 'chat' ? extractChatContext() : null,
    };
  })();

  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<'job' | 'chat'>(initial.kind === 'chat' ? 'chat' : 'job');
  const [connection, setConnection] = useState<'checking' | 'ok' | 'error'>('checking');
  const [serverUrl, setServerUrl] = useState(DEFAULT_SERVER);
  const [serverInput, setServerInput] = useState(DEFAULT_SERVER);
  const [connectionError, setConnectionError] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [bootstrap, setBootstrap] = useState<Bootstrap | null>(null);
  const [pageKind, setPageKind] = useState<PageKind>(initial.kind);
  const [extracted, setExtracted] = useState<ExtractedJob | null>(initial.extracted);
  const [detail, setDetail] = useState<JobDetailData | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [greetingText, setGreetingText] = useState('');
  const [busy, setBusy] = useState<Busy>('');
  const [toast, setToast] = useState<Toast | null>(null);
  const [manualOpen, setManualOpen] = useState(false);
  const [manual, setManual] = useState(manualFromExtracted(initial.extracted));
  const [chats, setChats] = useState<ChatDraft[]>([]);
  const [chatCtx, setChatCtx] = useState<ChatContext | null>(initial.chat);
  const [replyEdits, setReplyEdits] = useState<Record<string, string>>({});
  const [unread, setUnread] = useState(0);
  const [pending, setPending] = useState<PendingApply | null>(null);
  const [autoState, setAutoState] = useState<AutoGreetState | null>(null);
  const [pageVisible, setPageVisible] = useState(document.visibilityState === 'visible');

  const openRef = useRef(open);
  const tabRef = useRef(tab);
  const connectionRef = useRef(connection);
  const manualOpenRef = useRef(manualOpen);
  const pendingRef = useRef(pending);
  const pageUrlRef = useRef(location.href);
  const toastTimer = useRef<number | undefined>(undefined);
  const jobClickTimer = useRef<number | undefined>(undefined);
  const pendingSendingRef = useRef(false);
  const loadPageRef = useRef<() => void>(() => {});
  const ensureJobRef = useRef<() => Promise<JobDetailData>>(async () => {
    throw new Error('还未准备好');
  });
  const autoRunRef = useRef<(key: string) => Promise<void>>(async () => undefined);
  const autoCanceledRef = useRef(false);
  const autoRunKeyRef = useRef('');
  const pageKeyRef = useRef('');
  const autoPendingAttemptKeyRef = useRef('');

  openRef.current = open;
  tabRef.current = tab;
  connectionRef.current = connection;
  manualOpenRef.current = manualOpen;
  pendingRef.current = pending;

  const notify = useCallback((type: Toast['type'], message: string) => {
    setToast({ type, message });
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 5200);
  }, []);

  useEffect(() => () => window.clearTimeout(toastTimer.current), []);

  const applyDetail = useCallback((data: JobDetailData) => {
    setDetail(data);
    setGreetingText(data.job.application?.greeting || data.greeting?.text || '');
  }, []);

  const loadBootstrap = useCallback(async (silent = false) => {
    try {
      const data = await api<Bootstrap>('/api/bootstrap');
      setBootstrap(data);
      setConnection('ok');
      setConnectionError('');
      invalidateBootstrap();
      return data;
    } catch (error) {
      setConnection('error');
      if (!silent) {
        setConnectionError(error instanceof Error ? error.message : '无法连接本地服务');
      }
      return null;
    }
  }, []);

  const loadChats = useCallback(async () => {
    try {
      const response = await api<{ chats: ChatDraft[] }>('/api/chats');
      setChats(response.chats);
      setReplyEdits((previous) => {
        const next = { ...previous };
        for (const draft of response.chats) {
          if (next[draft.key] === undefined) next[draft.key] = draft.reply;
        }
        return next;
      });
    } catch {
      // 连接错误由主导出状态处理
    }
  }, []);

  const reloadDetail = useCallback(
    async (jobId: string) => {
      const data = await api<JobDetailData>(`/api/jobs/${jobId}`);
      applyDetail(data);
      return data;
    },
    [applyDetail],
  );

  const loadMatchingJob = useCallback(
    async (next: ExtractedJob | null) => {
      if (connectionRef.current !== 'ok' || !next?.input.title) return;
      setDetailLoading(true);
      try {
        const response = await api<{ jobs: JobWithState[] }>('/api/jobs');
        const match = findMatchingJob(response.jobs, next.input);
        if (match) {
          const data = await api<JobDetailData>(`/api/jobs/${match.id}`);
          applyDetail(data);
        } else {
          setDetail(null);
          setGreetingText('');
        }
      } catch (error) {
        notify('error', error instanceof Error ? error.message : '读取岗位记录失败');
      } finally {
        setDetailLoading(false);
      }
    },
    [applyDetail, notify],
  );

  const rescan = useCallback(() => {
    const kind = getPageKind();
    setPageKind(kind);
    pageUrlRef.current = location.href;
    if (kind === 'chat') {
      setChatCtx(extractChatContext());
      if (!pendingRef.current) setTab('chat');
      if (connectionRef.current === 'ok') void loadChats();
      return;
    }
    const next = extractJobFromPage();
    setExtracted(next);
    if (!manualOpenRef.current) setManual(manualFromExtracted(next));
    const nextKey =
      next?.input.platformJobId || normalizeUrl(next?.input.url || '') || location.href;
    if (pageKeyRef.current && pageKeyRef.current !== nextKey) {
      setAutoState(null);
      autoCanceledRef.current = false;
      autoRunKeyRef.current = '';
    }
    pageKeyRef.current = nextKey;
    setTab('job');
    setDetail(null);
    setGreetingText('');
    if (connectionRef.current === 'ok') void loadMatchingJob(next);
  }, [loadChats, loadMatchingJob]);

  loadPageRef.current = rescan;

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const state = await getState();
        if (!alive) return;
        if (state.serverUrl) {
          setServerUrl(state.serverUrl);
          setServerInput(state.serverUrl);
        }
        await loadBootstrap(true);
        const storedPending = await readPending();
        if (alive && storedPending) {
          setPending(storedPending);
          setOpen(true);
          setTab('job');
        }
      } catch (error) {
        if (!alive) return;
        setConnection('error');
        setConnectionError(error instanceof Error ? error.message : '无法连接扩展后台');
      }
    })();

    const unsubscribe = subscribeChatDraft((draft) => {
      setChats((previous) => {
        const index = previous.findIndex((item) => item.key === draft.key);
        if (index < 0) return [draft, ...previous];
        const next = [...previous];
        next[index] = draft;
        return next;
      });
      setReplyEdits((previous) =>
        previous[draft.key] === undefined ? { ...previous, [draft.key]: draft.reply } : previous,
      );
      if (!openRef.current || tabRef.current !== 'chat') setUnread((value) => value + 1);
    });

    const toggle = () => setOpen((value) => !value);
    window.addEventListener('aijob:toggle-panel', toggle);

    const onJobCardClicked = () => {
      window.clearTimeout(jobClickTimer.current);
      jobClickTimer.current = window.setTimeout(() => {
        loadPageRef.current();
      }, 450);
    };
    window.addEventListener('aijob:job-card-clicked', onJobCardClicked);

    return () => {
      alive = false;
      unsubscribe();
      window.clearTimeout(jobClickTimer.current);
      window.removeEventListener('aijob:toggle-panel', toggle);
      window.removeEventListener('aijob:job-card-clicked', onJobCardClicked);
    };
  }, [loadBootstrap]);

  useEffect(() => {
    if (connection !== 'ok') return;
    const stop = startChatWatcher();
    return stop;
  }, [connection]);

  useEffect(() => {
    if (connection === 'ok') loadPageRef.current();
  }, [connection]);

  useEffect(() => {
    if (!open || connection !== 'ok') return;
    void loadBootstrap(true);
    loadPageRef.current();
    if (tab === 'chat') void loadChats();
    // 仅在打开时刷新一次，避免滚动或操作时重置
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (!openRef.current) return;
      if (location.href !== pageUrlRef.current) {
        loadPageRef.current();
      }
    }, 1600);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!open || connection !== 'ok' || tab !== 'chat') return;
    const timer = window.setInterval(() => void loadChats(), 9000);
    return () => window.clearInterval(timer);
  }, [open, connection, tab, loadChats]);

  useEffect(() => {
    const onVisibilityChange = () => {
      const visible = document.visibilityState === 'visible';
      setPageVisible(visible);
      if (visible) void loadBootstrap(true);
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, [loadBootstrap]);

  useEffect(() => {
    if (!pending || connection !== 'ok') return;
    setOpen(true);
    setTab('job');
    reloadDetail(pending.jobId).catch(() => undefined);
  }, [pending, connection, reloadDetail]);

  useEffect(() => {
    if (!pageVisible || connection !== 'ok' || busy) return;
    const auto = bootstrap?.settings.autoGreet;
    if (!auto?.enabled || !bootstrap?.profileReady || !bootstrap?.llmConfigured) return;
    if (pageKind !== 'job' || !location.pathname.includes('job_detail')) return;
    if (pending) return;
    const input = extracted?.input;
    if (!input?.title || input.jdText.trim().length < 20) return;

    const key = input.platformJobId || normalizeUrl(input.url) || location.href;
    if (autoRunKeyRef.current === key) return;
    const marker = `aijob_auto_greet_${key}`;
    try {
      if (sessionStorage.getItem(marker)) return;
      sessionStorage.setItem(marker, 'started');
    } catch {
      // 浏览器的存储限制不应阻止手动使用
    }
    autoRunKeyRef.current = key;
    autoCanceledRef.current = false;
    setOpen(true);
    setTab('job');
    void autoRunRef.current(key);
  }, [
    pageVisible,
    connection,
    busy,
    bootstrap?.settings.autoGreet.enabled,
    bootstrap?.profileReady,
    bootstrap?.llmConfigured,
    pageKind,
    extracted?.input.url,
    extracted?.input.platformJobId,
    pending,
  ]);

  useEffect(() => {
    if (!pending?.autoSend || connection !== 'ok' || !pageVisible) return;
    if (pageKind !== 'chat') return;
    if (pending.jobId === autoPendingAttemptKeyRef.current) return;

    const context = extractChatContext();
    if (!context) return;

    if (!contextMatchesJob(pending.title, pending.company)) {
      autoPendingAttemptKeyRef.current = pending.jobId;
      const manualPending = { ...pending, autoSend: false };
      setPending(manualPending);
      void savePending(manualPending);
      setAutoState({
        stage: 'error',
        message: '跳转后的聊天对象与目标岗位不一致，已改为手动确认发送',
      });
      return;
    }

    autoPendingAttemptKeyRef.current = pending.jobId;
    const marker = `aijob_auto_pending_${pending.jobId}`;
    try {
      if (sessionStorage.getItem(marker)) return;
      sessionStorage.setItem(marker, '1');
    } catch {
      // 忽略存储限制
    }

    setOpen(true);
    setTab('job');
    setAutoState({ stage: 'sending', message: '已打开聊天窗口，正在发送招呼语…' });

    const timer = window.setTimeout(() => {
      void (async () => {
        setBusy('pending');
        try {
          const check = await api<{ duplicate: boolean }>('/api/applications/precheck', 'POST', {
            jobId: pending.jobId,
          });
          if (check.duplicate) {
            setAutoState({ stage: 'skipped', message: '该岗位已有投递记录，未重复发送' });
            await clearPendingStorage();
            setPending(null);
            return;
          }
          const sent = await sendAndMaybeRecord(
            pending.jobId,
            pending.greeting,
            pending.resumeVariantId,
            true,
          );
          setAutoState({
            stage: sent ? 'done' : 'error',
            message: sent ? '自动打招呼完成，投递已记录' : '未能确认发送，请到聊天窗口检查',
          });
        } catch (error) {
          setAutoState({
            stage: 'error',
            message: error instanceof Error ? error.message : '自动发送失败',
          });
        } finally {
          setBusy('');
        }
      })();
    }, 1200);

    return () => window.clearTimeout(timer);
  }, [pending, connection, pageVisible, pageKind, chatCtx]);

  const copy = useCallback(
    async (text: string) => {
      const ok = await copyText(text);
      notify(ok ? 'success' : 'error', ok ? '已复制到剪贴板' : '复制失败，请手动选择文本');
    },
    [notify],
  );

  const handleConnect = useCallback(async () => {
    setConnecting(true);
    setConnectionError('');
    try {
      await setServer(serverInput);
      const state = await getState();
      if (state.serverUrl) {
        setServerUrl(state.serverUrl);
        setServerInput(state.serverUrl);
      }
      const data = await loadBootstrap();
      if (data) notify('success', '已连接本地服务');
    } catch (error) {
      setConnection('error');
      setConnectionError(error instanceof Error ? error.message : '连接失败');
    } finally {
      setConnecting(false);
    }
  }, [serverInput, loadBootstrap, notify]);

  const handleOpenDashboard = useCallback(
    async (path = '') => {
      try {
        await openDashboard(path);
      } catch (error) {
        notify('error', error instanceof Error ? error.message : '打开后台失败');
      }
    },
    [notify],
  );

  const requireReady = useCallback(() => {
    if (!bootstrap?.profileReady) {
      notify('info', '请先在管理后台完善姓名和至少一段工作经历');
      void handleOpenDashboard('profile');
      return false;
    }
    if (!bootstrap?.llmConfigured) {
      notify('info', '请先配置大模型 API Key');
      void handleOpenDashboard('settings');
      return false;
    }
    return true;
  }, [bootstrap?.profileReady, bootstrap?.llmConfigured, notify, handleOpenDashboard]);

  function buildManualInput(): CapturedJobInput {
    if (manual.title.trim().length < 2) throw new Error('请填写岗位名称');
    if (manual.jdText.trim().length < 20) throw new Error('请粘贴完整的岗位描述（至少 20 字）');
    return {
      platform: 'boss',
      platformJobId: '',
      url: manual.url.trim() || location.href,
      title: manual.title.trim().slice(0, 200),
      company: manual.company.trim().slice(0, 200),
      salary: manual.salary.trim().slice(0, 100),
      city: manual.city.trim().slice(0, 100),
      area: '',
      experience: '',
      education: '',
      tags: [],
      jdText: manual.jdText.trim().slice(0, 30_000),
      hrName: '',
      hrTitle: '',
      companyInfo: '',
      source: 'manual',
    };
  }

  async function ensureJob(): Promise<JobDetailData> {
    if (detail) return detail;
    const useManual =
      manualOpen ||
      !extracted ||
      !extracted.input.title ||
      extracted.input.jdText.trim().length < 20;
    const input = useManual ? buildManualInput() : extracted.input;
    const captured = await api<{ job: JobWithState }>('/api/jobs/capture', 'POST', input);
    const data = await api<JobDetailData>(`/api/jobs/${captured.job.id}`);
    applyDetail(data);
    if (useManual) setManualOpen(false);
    return data;
  }

  ensureJobRef.current = ensureJob;

  function contextMatchesJob(jobTitle: string, company: string): boolean {
    const context = extractChatContext();
    if (!context) return true;
    const titleOk =
      !context.jobTitle ||
      !jobTitle ||
      context.jobTitle.includes(jobTitle) ||
      jobTitle.includes(context.jobTitle);
    const companyOk =
      !context.company ||
      !company ||
      context.company.includes(company) ||
      company.includes(context.company);
    return titleOk || companyOk;
  }

  const handleAnalyze = useCallback(async () => {
    if (!requireReady()) return;
    setBusy('analyze');
    try {
      const job = await ensureJobRef.current();
      await api(`/api/jobs/${job.job.id}/analyze`, 'POST', {});
      await reloadDetail(job.job.id);
      notify('success', '岗位分析完成');
    } catch (error) {
      notify('error', error instanceof Error ? error.message : '分析失败');
    } finally {
      setBusy('');
    }
  }, [notify, reloadDetail, requireReady]);

  const handleManualAnalyze = useCallback(async () => {
    if (!requireReady()) return;
    setBusy('analyze');
    try {
      const input = buildManualInput();
      const captured = await api<{ job: JobWithState }>('/api/jobs/capture', 'POST', input);
      await api(`/api/jobs/${captured.job.id}/analyze`, 'POST', {});
      await reloadDetail(captured.job.id);
      setManualOpen(false);
      notify('success', '岗位已添加并完成分析');
    } catch (error) {
      notify('error', error instanceof Error ? error.message : '分析失败');
    } finally {
      setBusy('');
    }
  }, [manual, notify, reloadDetail, requireReady]);

  const handleTailor = useCallback(async () => {
    if (!requireReady()) return;
    setBusy('tailor');
    try {
      const job = await ensureJobRef.current();
      await api(`/api/jobs/${job.job.id}/tailor`, 'POST', {});
      await reloadDetail(job.job.id);
      notify('success', '定制简历已生成');
    } catch (error) {
      notify('error', error instanceof Error ? error.message : '简历生成失败');
    } finally {
      setBusy('');
    }
  }, [notify, reloadDetail, requireReady]);

  const handleGreeting = useCallback(
    async (regenerate = false) => {
      if (!requireReady()) return;
      setBusy('greeting');
      try {
        const job = await ensureJobRef.current();
        await api(`/api/jobs/${job.job.id}/greeting`, 'POST', { regenerate });
        await reloadDetail(job.job.id);
        notify('success', '招呼语已生成');
      } catch (error) {
        notify('error', error instanceof Error ? error.message : '招呼语生成失败');
      } finally {
        setBusy('');
      }
    },
    [notify, reloadDetail, requireReady],
  );

  async function recordApplication(jobId: string, greeting: string, resumeVariantId?: string) {
    return api<{ application: unknown; duplicate: boolean }>('/api/applications', 'POST', {
      jobId,
      greeting,
      resumeVariantId,
    });
  }

  async function sendAndMaybeRecord(
    jobId: string,
    greeting: string,
    resumeVariantId: string | undefined,
    autoSend: boolean,
  ): Promise<boolean> {
    const result = await sendChatMessage(greeting, autoSend);
    if (!result.filled) {
      notify('error', result.error || '未能填入聊天框，请手动复制发送');
      return false;
    }
    await clearPendingStorage();
    setPending(null);
    if (!autoSend) {
      notify('info', '招呼语已填入聊天框，请在 BOSS 中确认并手动发送。发送后可点「手动标记已投递」。');
      return false;
    }
    if (!result.sent) {
      notify('error', result.error || '已尝试发送，但无法确认是否发出，请到聊天窗口检查');
      return false;
    }
    try {
      await recordApplication(jobId, greeting, resumeVariantId);
      await reloadDetail(jobId);
      notify('success', '招呼语已发送，投递记录已保存');
    } catch (error) {
      notify(
        'error',
        `招呼语可能已发送，但记录投递失败：${error instanceof Error ? error.message : String(error)}`,
      );
    }
    return true;
  }

  const handleApply = useCallback(async () => {
    if (!detail || !greetingText.trim()) {
      notify('error', '请先生成招呼语');
      return;
    }
    const job = detail.job;
    const autoSend = bootstrap?.settings.automation.autoSendGreeting !== false;
    const resumeId = detail.resumes[0]?.id;
    if (hasChatInput() && !contextMatchesJob(job.title, job.company)) {
      notify('error', '当前聊天窗口与目标岗位不一致，请回到该岗位的聊天窗口后再发送');
      return;
    }
    setBusy('apply');
    try {
      const check = await api<{ ok: boolean; duplicate: boolean }>(
        '/api/applications/precheck',
        'POST',
        { jobId: job.id },
      );
      if (check.duplicate) {
        notify('info', '这个岗位已经在投递记录中，无需重复投递');
        return;
      }

      if (!hasChatInput()) {
        await savePending({
          jobId: job.id,
          greeting: greetingText,
          resumeVariantId: resumeId,
          title: job.title,
          company: job.company,
          createdAt: Date.now(),
        });
        setPending({
          jobId: job.id,
          greeting: greetingText,
          resumeVariantId: resumeId,
          title: job.title,
          company: job.company,
          createdAt: Date.now(),
        });
        const opened = await openChatForJob();
        if (!opened.hasInput) {
          notify(
            'info',
            opened.message ||
              '已尝试打开聊天窗口。如果页面已跳转，请在右侧面板的待发送卡片中确认发送。',
          );
          return;
        }
      }

      await sendAndMaybeRecord(job.id, greetingText, resumeId, autoSend);
    } catch (error) {
      notify('error', error instanceof Error ? error.message : '发送失败');
    } finally {
      setBusy('');
    }
  }, [detail, greetingText, bootstrap, notify, reloadDetail]);

  const handleSendPending = useCallback(async () => {
    if (!pending || pendingSendingRef.current) return;
    pendingSendingRef.current = true;
    setBusy('pending');
    try {
      if (!contextMatchesJob(pending.title, pending.company)) {
        notify('error', '当前聊天窗口与待发送岗位不一致，请切换到正确的 HR 对话');
        return;
      }
      if (!hasChatInput()) {
        const opened = await openChatForJob();
        if (!opened.hasInput) {
          notify('info', opened.message || '请先在 BOSS 中打开与该 HR 的聊天窗口');
          return;
        }
      }
      const autoSend = bootstrap?.settings.automation.autoSendGreeting !== false;
      await sendAndMaybeRecord(pending.jobId, pending.greeting, pending.resumeVariantId, autoSend);
    } catch (error) {
      notify('error', error instanceof Error ? error.message : '发送失败');
    } finally {
      pendingSendingRef.current = false;
      setBusy('');
    }
  }, [pending, bootstrap, notify]);

  const handleCancelPending = useCallback(async () => {
    await clearPendingStorage();
    setPending(null);
    notify('info', '已取消待发送招呼语');
  }, [notify]);

  const cancelAutoGreet = useCallback(() => {
    autoCanceledRef.current = true;
    setAutoState((previous) =>
      previous && ['analyzing', 'generating', 'countdown'].includes(previous.stage)
        ? { ...previous, stage: 'skipped', message: '已取消自动发送' }
        : previous,
    );
    notify('info', '已取消自动打招呼');
  }, [notify]);

  async function runAutoGreet(_key: string) {
    autoCanceledRef.current = false;
    const autoSettings = bootstrap?.settings.autoGreet;
    const input = extracted?.input;
    if (!autoSettings?.enabled) return;
    if (!input?.title || input.jdText.trim().length < 20) {
      setAutoState({ stage: 'skipped', message: '页面岗位信息不完整，已跳过自动打招呼' });
      return;
    }

    setOpen(true);
    setTab('job');
    setAutoState({ stage: 'analyzing', message: '自动分析岗位中…' });

    try {
      const captured = await api<{ job: JobWithState }>('/api/jobs/capture', 'POST', input);
      let data = await api<JobDetailData>(`/api/jobs/${captured.job.id}`);
      applyDetail(data);

      if (autoCanceledRef.current) {
        setAutoState({ stage: 'skipped', message: '已取消自动发送' });
        return;
      }
      if (data.job.application) {
        setAutoState({ stage: 'skipped', message: '该岗位已经投递过，已跳过自动打招呼' });
        return;
      }

      await api(`/api/jobs/${captured.job.id}/analyze`, 'POST', {});
      data = await api<JobDetailData>(`/api/jobs/${captured.job.id}`);
      applyDetail(data);
      const score = data.job.analysis?.score ?? 0;

      if (autoCanceledRef.current) {
        setAutoState({ stage: 'skipped', message: '已取消自动发送', score });
        return;
      }
      if (score < autoSettings.minScore) {
        setAutoState({
          stage: 'skipped',
          message: `匹配分 ${score}，低于自动发送阈值 ${autoSettings.minScore}，未发送`,
          score,
        });
        return;
      }

      setAutoState({
        stage: 'generating',
        message: `匹配分 ${score}，正在生成招呼语…`,
        score,
      });
      await api(`/api/jobs/${captured.job.id}/greeting`, 'POST', {});
      data = await api<JobDetailData>(`/api/jobs/${captured.job.id}`);
      applyDetail(data);
      const greeting = data.greeting?.text || '';
      if (!greeting) throw new Error('模型没有返回招呼语');
      if (autoCanceledRef.current) {
        setAutoState({ stage: 'skipped', message: '已取消自动发送', score });
        return;
      }

      const seconds = Math.max(3, autoSettings.countdownSeconds);
      for (let remaining = seconds; remaining > 0; remaining -= 1) {
        if (autoCanceledRef.current) {
          setAutoState({ stage: 'skipped', message: '已取消自动发送', score });
          return;
        }
        if (document.visibilityState !== 'visible') {
          setAutoState({
            stage: 'skipped',
            message: '页面不在前台，已停止自动发送',
            score,
          });
          return;
        }
        setAutoState({
          stage: 'countdown',
          message: '即将自动发送招呼语',
          score,
          countdown: remaining,
        });
        await new Promise((resolve) => window.setTimeout(resolve, 1000));
      }
      if (autoCanceledRef.current) {
        setAutoState({ stage: 'skipped', message: '已取消自动发送', score });
        return;
      }
      if (document.visibilityState !== 'visible') {
        setAutoState({ stage: 'skipped', message: '页面不在前台，已停止自动发送', score });
        return;
      }

      setAutoState({ stage: 'sending', message: '正在发送招呼语…', score });
      const check = await api<{ duplicate: boolean }>('/api/applications/precheck', 'POST', {
        jobId: captured.job.id,
      });
      if (check.duplicate) {
        setAutoState({ stage: 'skipped', message: '该岗位已有投递记录', score });
        return;
      }

      if (!hasChatInput()) {
        const pendingData: PendingApply = {
          jobId: captured.job.id,
          greeting,
          title: captured.job.title,
          company: captured.job.company,
          createdAt: Date.now(),
          autoSend: true,
        };
        await savePending(pendingData);
        setPending(pendingData);
        const opened = await openChatForJob();
        if (!opened.hasInput) {
          setAutoState({
            stage: 'skipped',
            message: opened.message || '已尝试打开聊天窗口，请在跳转后的页面确认发送',
            score,
          });
          return;
        }
      }

      const sent = await sendAndMaybeRecord(captured.job.id, greeting, undefined, true);
      setAutoState({
        stage: sent ? 'done' : 'error',
        message: sent ? '自动打招呼完成，投递已记录' : '未能确认发送，请到聊天窗口检查',
        score,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : '自动打招呼失败';
      setAutoState({ stage: 'error', message });
      notify('error', message);
    }
  }

  autoRunRef.current = runAutoGreet;

  const handleMarkSubmitted = useCallback(async () => {
    if (!detail || !greetingText.trim()) {
      notify('error', '先生成招呼语再标记');
      return;
    }
    setBusy('status');
    try {
      const check = await api<{ ok: boolean; duplicate: boolean }>(
        '/api/applications/precheck',
        'POST',
        { jobId: detail.job.id },
      );
      if (check.duplicate) {
        notify('info', '该岗位已有投递记录');
        return;
      }
      await recordApplication(detail.job.id, greetingText, detail.resumes[0]?.id);
      await reloadDetail(detail.job.id);
      notify('success', '已记录为「已投递」');
    } catch (error) {
      notify('error', error instanceof Error ? error.message : '记录失败');
    } finally {
      setBusy('');
    }
  }, [detail, greetingText, notify, reloadDetail]);

  const handleSendResume = useCallback(async () => {
    const resume = detail?.resumes.find((item) => item.hasPdf && item.pdfUrl);
    if (!resume?.pdfUrl) {
      notify('info', '还没有可发送的 PDF 简历，请先生成');
      return;
    }
    if (!hasChatInput()) {
      notify('info', '请先打开与该 HR 的聊天窗口，再发送简历附件');
      return;
    }
    setBusy('resume');
    try {
      const file = await fetchFile(resume.pdfUrl);
      if (!file.ok || !file.base64) throw new Error(file.error || '读取简历文件失败');
      const result = await attachResumePdf(
        file.base64,
        file.filename || '简历.pdf',
        file.mime || 'application/pdf',
      );
      notify(result.ok ? 'info' : 'error', result.message);
      if (!result.ok) await openUrl(resume.pdfUrl, true);
    } catch (error) {
      notify('error', error instanceof Error ? error.message : '发送简历失败，请手动下载');
    } finally {
      setBusy('');
    }
  }, [detail, notify]);

  const currentDraft = chatCtx
    ? chats.find((draft) => draft.key === chatCtx.conversationKey) || null
    : null;
  const replyText = currentDraft
    ? replyEdits[currentDraft.key] ?? currentDraft.reply
    : '';

  const refreshChat = useCallback(() => {
    setChatCtx(extractChatContext());
    void loadChats();
  }, [loadChats]);

  const handleGenerateCurrentChat = useCallback(async () => {
    setBusy('chat');
    try {
      const draft = await observeCurrentChat(true);
      if (draft) {
        setChats((previous) => {
          const next = previous.filter((item) => item.key !== draft.key);
          return [draft, ...next];
        });
        setReplyEdits((previous) => ({ ...previous, [draft.key]: draft.reply }));
        notify('success', '回复草稿已生成');
      } else {
        notify('info', '当前没有需要回复的新消息');
      }
    } catch (error) {
      notify('error', error instanceof Error ? error.message : '生成回复失败');
    } finally {
      setBusy('');
    }
  }, [notify]);

  const handleRegenerateCurrentChat = useCallback(async () => {
    if (!currentDraft) return;
    setBusy('chat');
    try {
      const response = await api<{ draft: ChatDraft }>('/api/chats/regenerate', 'POST', {
        key: currentDraft.key,
      });
      setChats((previous) => {
        const next = previous.filter((item) => item.key !== response.draft.key);
        return [response.draft, ...next];
      });
      setReplyEdits((previous) => ({ ...previous, [response.draft.key]: response.draft.reply }));
      notify('success', '回复已重新生成');
    } catch (error) {
      notify('error', error instanceof Error ? error.message : '重新生成失败');
    } finally {
      setBusy('');
    }
  }, [currentDraft, notify]);

  const handleChatFill = useCallback(async () => {
    if (!currentDraft) return;
    setBusy('chat');
    try {
      const result = await sendChatMessage(replyText, false);
      notify(
        result.filled ? 'success' : 'error',
        result.filled ? '已填入聊天框，请确认后手动发送' : result.error || '填入失败',
      );
    } finally {
      setBusy('');
    }
  }, [currentDraft, replyText, notify]);

  const handleChatSend = useCallback(async () => {
    if (!currentDraft) return;
    const context = extractChatContext();
    if (!context || context.conversationKey !== currentDraft.key) {
      notify('error', '当前聊天窗口已切换，请回到对应 HR 的对话再发送');
      return;
    }
    const autoSend = bootstrap?.settings.automation.autoSendReply !== false;
    setBusy('chat');
    try {
      const result = await sendChatMessage(replyText, autoSend);
      if (!result.filled) {
        notify('error', result.error || '未能填入聊天框');
      } else if (!autoSend) {
        notify('info', '已填入聊天框，请在 BOSS 中手动发送');
      } else if (result.sent) {
        notify('success', '回复已发送');
        setUnread(0);
      } else {
        notify('error', result.error || '无法确认是否发送，请到聊天窗口检查');
      }
    } finally {
      setBusy('');
    }
  }, [currentDraft, replyText, bootstrap, notify]);

  const handleCopy = useCallback(
    (text: string) => {
      void copy(text);
    },
    [copy],
  );

  const handleCopyDiagnostics = useCallback(async () => {
    try {
      const info = collectPageDiagnostics();
      const ok = await copyText(info);
      notify(
        ok ? 'success' : 'error',
        ok
          ? '已复制页面诊断信息（标题、URL、类名和前 800 字），请发给开发者'
          : '复制失败，请打开开发者工具查看页面结构',
      );
    } catch (error) {
      notify('error', error instanceof Error ? error.message : '生成诊断信息失败');
    }
  }, [notify]);

  const autoSendGreeting = bootstrap?.settings.automation.autoSendGreeting !== false;
  const autoSendReply = bootstrap?.settings.automation.autoSendReply !== false;
  const autoBusy = Boolean(
    autoState && ['analyzing', 'generating', 'countdown', 'sending'].includes(autoState.stage),
  );
  const displayJob = detail?.job || null;
  const title = displayJob?.title || extracted?.input.title || '';
  const company = displayJob?.company || extracted?.input.company || '';
  const salary = displayJob?.salary || extracted?.input.salary || '';
  const city = displayJob?.city || extracted?.input.city || '';
  const tags = displayJob?.tags || extracted?.input.tags || [];
  const issues = !displayJob && extracted ? extracted.issues : [];
  const latestResume = detail?.resumes[0] || null;
  const application = displayJob?.application || null;
  const hasUsefulExtraction = Boolean(title || (extracted?.input.jdText.length || 0) > 20);
  const showFooter =
    connection === 'ok' && tab === 'job' && Boolean(displayJob || extracted) && !pending;
  const busyLabel =
    busy === 'analyze'
      ? 'AI 正在分析岗位，通常需要 10-30 秒…'
      : busy === 'tailor'
        ? '正在定制简历并渲染 PDF，可能需要 30-60 秒…'
        : busy === 'greeting'
          ? '正在生成招呼语…'
          : busy === 'apply' || busy === 'pending'
            ? '正在操作聊天窗口并记录投递…'
            : busy === 'resume'
              ? '正在准备 PDF 附件…'
              : busy === 'chat'
                ? '正在处理对话…'
                : '';

  return (
    <div
      className="aj-root"
      onKeyDown={(event) => event.stopPropagation()}
      onKeyUp={(event) => event.stopPropagation()}
      onKeyPress={(event) => event.stopPropagation()}
    >
      {!open && (
        <button
          className="aj-launcher"
          onClick={() => setOpen(true)}
          aria-label="打开 AI 求职助手"
          title="AI 求职助手"
        >
          AI
          {unread > 0 && <span className="aj-launcher-badge">{unread > 9 ? '9+' : unread}</span>}
        </button>
      )}

      {open && (
        <aside className="aj-panel" role="dialog" aria-label="AI 求职助手">
          <header className="aj-header">
            <div className="aj-brand">
              <div className="aj-logo">AI</div>
              <div>
                <b>AI 求职助手</b>
                <span>BOSS 直聘 · 本地运行</span>
              </div>
            </div>
            <div className="aj-head-actions">
              <button
                className="aj-icon-btn"
                title="复制页面诊断"
                onClick={handleCopyDiagnostics}
              >
                <Bug size={15} />
              </button>
              <button
                className="aj-icon-btn"
                title="打开管理后台"
                onClick={() => handleOpenDashboard('')}
              >
                <ExternalLink size={15} />
              </button>
              <button className="aj-icon-btn" title="关闭面板" onClick={() => setOpen(false)}>
                <X size={17} />
              </button>
            </div>
          </header>

          <div className="aj-status">
            <span
              className={`aj-dot ${connection === 'ok' ? '' : connection === 'checking' ? 'checking' : 'error'}`}
            />
            <span>
              {connection === 'ok'
                ? `已连接 ${serverUrl.replace(/^https?:\/\//, '')}`
                : connection === 'checking'
                  ? '正在连接本地服务…'
                  : '本地服务未连接'}
            </span>
            {bootstrap && !bootstrap.profileReady && <span className="aj-status-warn">资料未完善</span>}
            {bootstrap && !bootstrap.llmConfigured && <span className="aj-status-warn">模型未配置</span>}
            {bootstrap && (
              <span style={{ marginLeft: 'auto' }}>
                今日已投 {bootstrap.todayApplications}/{bootstrap.settings.automation.maxPerDay}
              </span>
            )}
          </div>

          <nav className="aj-tabs">
            <button
              className={`aj-tab ${tab === 'job' ? 'active' : ''}`}
              onClick={() => setTab('job')}
            >
              岗位
            </button>
            <button
              className={`aj-tab ${tab === 'chat' ? 'active' : ''}`}
              onClick={() => {
                setTab('chat');
                setUnread(0);
                setChatCtx(extractChatContext());
                if (connectionRef.current === 'ok') void loadChats();
              }}
            >
              对话
              {unread > 0 && <span className="aj-count">{unread > 9 ? '9+' : unread}</span>}
            </button>
          </nav>

          <div className="aj-body">
            {connection !== 'ok' ? (
              <div className="aj-connect">
                <h3>连接本地服务</h3>
                <p>
                  扩展需要本机的 AI 服务来生成分析、简历和回复。请先在项目目录运行{' '}
                  <span className="aj-code">npm start</span>，再点击下方按钮。
                </p>
                <div className="aj-field">
                  <span>服务地址</span>
                  <input
                    className="aj-input"
                    value={serverInput}
                    onChange={(event) => setServerInput(event.target.value)}
                    placeholder={DEFAULT_SERVER}
                    spellCheck={false}
                  />
                </div>
                {connectionError && <p className="aj-error">{connectionError}</p>}
                <div className="aj-actions" style={{ marginTop: 10 }}>
                  <button className="aj-btn aj-btn-primary" disabled={connecting} onClick={handleConnect}>
                    {connecting ? <Loader2 size={13} className="aj-spin" /> : null}
                    {connecting ? '正在连接…' : '连接本地服务'}
                  </button>
                  <button className="aj-btn aj-btn-ghost" onClick={() => handleOpenDashboard('')}>
                    打开后台
                  </button>
                </div>
                <p className="aj-hint" style={{ marginTop: 10 }}>
                  只允许连接本机地址。默认端口 8787，如修改过 PORT，请在 .env 和这里保持一致。
                </p>
              </div>
            ) : tab === 'job' ? (
              <>
                {!bootstrap?.profileReady && (
                  <div className="aj-notice warn">
                    <TriangleAlert size={14} />
                    <div>
                      <b>基础资料还不完整</b>
                      请先填写姓名和至少一段工作经历。
                      <div className="aj-row" style={{ marginTop: 6 }}>
                        <button
                          className="aj-btn aj-btn-secondary aj-btn-sm"
                          onClick={() => handleOpenDashboard('profile')}
                        >
                          去完善资料
                        </button>
                      </div>
                    </div>
                  </div>
                )}
                {!bootstrap?.llmConfigured && (
                  <div className="aj-notice warn">
                    <TriangleAlert size={14} />
                    <div>
                      <b>还没有配置大模型</b>
                      配置 API Key 后才能分析岗位和生成材料。
                      <div className="aj-row" style={{ marginTop: 6 }}>
                        <button
                          className="aj-btn aj-btn-secondary aj-btn-sm"
                          onClick={() => handleOpenDashboard('settings')}
                        >
                          去配置模型
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {autoState && (
                  <div className={`aj-auto-card stage-${autoState.stage}`}>
                    <div className="aj-auto-head">
                      <div className="aj-auto-title">
                        {autoState.stage === 'analyzing' ||
                        autoState.stage === 'generating' ||
                        autoState.stage === 'sending' ? (
                          <Loader2 size={14} className="aj-spin" />
                        ) : autoState.stage === 'done' ? (
                          <CheckCircle2 size={14} />
                        ) : autoState.stage === 'error' ? (
                          <TriangleAlert size={14} />
                        ) : (
                          <Sparkles size={14} />
                        )}
                        <b>自动打招呼</b>
                        <span className={`aj-badge ${AUTO_BADGES[autoState.stage]}`}>
                          {AUTO_LABELS[autoState.stage]}
                        </span>
                      </div>
                      {autoBusy && autoState.stage !== 'sending' ? (
                        <button
                          className="aj-btn aj-btn-secondary aj-btn-sm"
                          onClick={cancelAutoGreet}
                        >
                          取消
                        </button>
                      ) : !autoBusy ? (
                        <button
                          className="aj-icon-btn"
                          title="关闭提示"
                          onClick={() => setAutoState(null)}
                        >
                          <X size={13} />
                        </button>
                      ) : null}
                    </div>
                    <p className="aj-auto-message">{autoState.message}</p>
                    {autoState.stage === 'countdown' && (
                      <>
                        <div className="aj-auto-countdown">
                          <b>{autoState.countdown}</b>
                          <span>秒后自动发送招呼语</span>
                        </div>
                        <p className="aj-hint" style={{ marginTop: 5 }}>
                          点击「取消」可停止发送；关闭面板不会自动取消。
                        </p>
                      </>
                    )}
                  </div>
                )}

                {pending && (
                  <div className="aj-card" style={{ borderColor: '#b9cdfb', background: '#f8faff' }}>
                    <div className="aj-card-head">
                      <div>
                        <h3>待发送招呼语</h3>
                        <span className="aj-muted">
                          {[pending.title, pending.company].filter(Boolean).join(' · ')}
                        </span>
                      </div>
                      <button className="aj-icon-btn" title="取消" onClick={handleCancelPending}>
                        <X size={14} />
                      </button>
                    </div>
                    <p className="aj-greeting" style={{ margin: '0 0 9px' }}>
                      {pending.greeting}
                    </p>
                    <div className="aj-actions">
                      <button
                        className="aj-btn aj-btn-primary aj-btn-sm"
                        disabled={busy === 'pending' || autoBusy}
                        onClick={handleSendPending}
                      >
                        {busy === 'pending' ? <Loader2 size={12} className="aj-spin" /> : <Send size={12} />}
                        {autoSendGreeting ? '发送招呼语' : '填入招呼语'}
                      </button>
                      <button
                        className="aj-btn aj-btn-secondary aj-btn-sm"
                        onClick={() => handleCopy(pending.greeting)}
                      >
                        <Copy size={12} /> 复制
                      </button>
                      <button
                        className="aj-btn aj-btn-ghost aj-btn-sm"
                        onClick={() => {
                          setTab('chat');
                          setUnread(0);
                        }}
                      >
                        去对话
                      </button>
                    </div>
                    <p className="aj-hint" style={{ marginTop: 7 }}>
                      页面跳转后需要你在这里再确认一次，不会自动发送附件。
                    </p>
                  </div>
                )}

                {pageKind === 'chat' && !pending && (
                  <div className="aj-notice info">
                    <MessageSquareText size={14} />
                    <div>
                      <b>当前在聊天页</b>
                      可以切换到「对话」处理 HR 消息；如需分析新岗位，请回到职位详情页。
                      <div className="aj-row" style={{ marginTop: 6 }}>
                        <button
                          className="aj-btn aj-btn-secondary aj-btn-sm"
                          onClick={() => {
                            setTab('chat');
                            setUnread(0);
                          }}
                        >
                          去对话
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {busyLabel && (
                  <div className="aj-notice info">
                    <Loader2 size={14} className="aj-spin" />
                    <div>{busyLabel}</div>
                  </div>
                )}

                {(hasUsefulExtraction || displayJob) && (
                  <div className="aj-card">
                    <div className="aj-card-head">
                      <div style={{ minWidth: 0 }}>
                        <div className="aj-title">{title || '未识别到岗位'}</div>
                        <div className="aj-company">
                          {company && <span>{company}</span>}
                          {salary && <span className="aj-salary">{salary}</span>}
                          {city && <span>{city}</span>}
                        </div>
                      </div>
                      {displayJob && <span className="aj-badge green">已保存</span>}
                    </div>
                    {tags.length > 0 && (
                      <div className="aj-tags">
                        {tags.slice(0, 8).map((tag) => (
                          <span className="aj-tag" key={tag}>
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                    {issues.length > 0 && (
                      <div className="aj-notice warn" style={{ marginTop: 9 }}>
                        <TriangleAlert size={13} />
                        <div>
                          <b>页面读取不完整</b>
                          <ul className="aj-dot-list">
                            {issues.map((issue) => (
                              <li key={issue}>{issue}</li>
                            ))}
                          </ul>
                          <button
                            className="aj-btn aj-btn-ghost aj-btn-sm"
                            style={{ marginTop: 5, paddingLeft: 0 }}
                            onClick={handleCopyDiagnostics}
                          >
                            复制页面诊断
                          </button>
                        </div>
                      </div>
                    )}
                    <div className="aj-actions" style={{ marginTop: 10 }}>
                      <button
                        className="aj-btn aj-btn-primary aj-btn-sm"
                        disabled={Boolean(busy) || autoBusy || !hasUsefulExtraction}
                        onClick={handleAnalyze}
                      >
                        {busy === 'analyze' ? (
                          <Loader2 size={12} className="aj-spin" />
                        ) : (
                          <Sparkles size={12} />
                        )}
                        {displayJob?.analysis ? '重新分析' : 'AI 分析岗位'}
                      </button>
                      <button
                        className="aj-btn aj-btn-secondary aj-btn-sm"
                        disabled={Boolean(busy) || autoBusy}
                        onClick={() => {
                          const next = extractJobFromPage();
                          setExtracted(next);
                          setManual(manualFromExtracted(next));
                          void loadMatchingJob(next);
                        }}
                      >
                        <RefreshCw size={12} /> 重新读取
                      </button>
                      <button
                        className="aj-btn aj-btn-ghost aj-btn-sm"
                        onClick={() => setManualOpen((value) => !value)}
                      >
                        手动补全
                      </button>
                    </div>
                  </div>
                )}

                {!hasUsefulExtraction && !displayJob && pageKind !== 'chat' && (
                  <div className="aj-empty">
                    <FileText size={22} />
                    <b>没有读取到当前岗位</b>
                    请确认这是 BOSS 的职位详情页（URL 包含 <code>job_detail</code>），或手动粘贴岗位信息。
                    {extracted && extracted.issues.length > 0 && (
                      <ul
                        className="aj-dot-list"
                        style={{ textAlign: 'left', maxWidth: 290, margin: '8px auto 0' }}
                      >
                        {extracted.issues.map((issue) => (
                          <li key={issue}>{issue}</li>
                        ))}
                      </ul>
                    )}
                    <div
                      className="aj-hint"
                      style={{ marginTop: 7, wordBreak: 'break-all' }}
                    >
                      当前页面：{location.pathname}
                    </div>
                    <div className="aj-row" style={{ justifyContent: 'center', marginTop: 9 }}>
                      <button
                        className="aj-btn aj-btn-secondary aj-btn-sm"
                        onClick={() => {
                          const next = extractJobFromPage();
                          setExtracted(next);
                          setManual(manualFromExtracted(next));
                          setManualOpen(true);
                        }}
                      >
                        手动输入岗位
                      </button>
                      <button
                        className="aj-btn aj-btn-soft aj-btn-sm"
                        onClick={() => {
                          const next = extractJobFromPage();
                          setExtracted(next);
                          setManual(manualFromExtracted(next));
                          void loadMatchingJob(next);
                        }}
                      >
                        重新读取
                      </button>
                      <button
                        className="aj-btn aj-btn-ghost aj-btn-sm"
                        onClick={handleCopyDiagnostics}
                      >
                        复制页面诊断
                      </button>
                    </div>
                  </div>
                )}

                {manualOpen && (
                  <div className="aj-card">
                    <div className="aj-card-head">
                      <div>
                        <h3>手动填写岗位</h3>
                        <span className="aj-muted">页面结构变化时使用，字段会预填当前页面内容</span>
                      </div>
                      <button className="aj-icon-btn" onClick={() => setManualOpen(false)}>
                        <X size={14} />
                      </button>
                    </div>
                    <div className="aj-grid-2">
                      <label className="aj-field">
                        <span>岗位名称 *</span>
                        <input
                          className="aj-input"
                          value={manual.title}
                          onChange={(event) => setManual({ ...manual, title: event.target.value })}
                        />
                      </label>
                      <label className="aj-field">
                        <span>公司</span>
                        <input
                          className="aj-input"
                          value={manual.company}
                          onChange={(event) => setManual({ ...manual, company: event.target.value })}
                        />
                      </label>
                      <label className="aj-field">
                        <span>薪资</span>
                        <input
                          className="aj-input"
                          value={manual.salary}
                          onChange={(event) => setManual({ ...manual, salary: event.target.value })}
                        />
                      </label>
                      <label className="aj-field">
                        <span>城市</span>
                        <input
                          className="aj-input"
                          value={manual.city}
                          onChange={(event) => setManual({ ...manual, city: event.target.value })}
                        />
                      </label>
                    </div>
                    <label className="aj-field" style={{ marginTop: 8 }}>
                      <span>岗位链接</span>
                      <input
                        className="aj-input"
                        value={manual.url}
                        onChange={(event) => setManual({ ...manual, url: event.target.value })}
                      />
                    </label>
                    <label className="aj-field" style={{ marginTop: 8 }}>
                      <span>岗位描述 *</span>
                      <textarea
                        className="aj-textarea"
                        rows={7}
                        value={manual.jdText}
                        onChange={(event) => setManual({ ...manual, jdText: event.target.value })}
                        placeholder="粘贴职位职责和任职要求…"
                      />
                    </label>
                    <div className="aj-actions" style={{ marginTop: 9 }}>
                      <button
                        className="aj-btn aj-btn-primary aj-btn-sm"
                        disabled={Boolean(busy) || autoBusy}
                        onClick={handleManualAnalyze}
                      >
                        {busy === 'analyze' ? (
                          <Loader2 size={12} className="aj-spin" />
                        ) : (
                          <Sparkles size={12} />
                        )}
                        保存并分析
                      </button>
                      <button
                        className="aj-btn aj-btn-ghost aj-btn-sm"
                        onClick={() => setManualOpen(false)}
                      >
                        取消
                      </button>
                    </div>
                  </div>
                )}

                {detailLoading && <div className="aj-loading"><Loader2 size={14} className="aj-spin" />读取历史记录…</div>}

                {displayJob?.analysis && (
                  <div className="aj-card">
                    <div className="aj-score-row">
                      <div
                        className="aj-score-ring"
                        style={{
                          background: `conic-gradient(${scoreColor(displayJob.analysis.score)} ${
                            displayJob.analysis.score * 3.6
                          }deg, #e9edf5 0)`,
                        }}
                      >
                        <div className="aj-score-inner">
                          <b style={{ color: scoreColor(displayJob.analysis.score) }}>
                            {displayJob.analysis.score}
                          </b>
                          <span>匹配</span>
                        </div>
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <span className={`aj-verdict ${verdictClass(displayJob.analysis.verdict)}`}>
                          {displayJob.analysis.verdict}
                        </span>
                        <p className="aj-summary">{displayJob.analysis.summary}</p>
                      </div>
                    </div>
                    <div className="aj-two" style={{ marginTop: 8 }}>
                      <div className="aj-mini green">
                        <b>匹配点</b>
                        <ul className="aj-dot-list">
                          {displayJob.analysis.matched.slice(0, 4).map((item) => (
                            <li key={item}>{item}</li>
                          ))}
                        </ul>
                      </div>
                      <div className="aj-mini amber">
                        <b>缺口</b>
                        <ul className="aj-dot-list">
                          {displayJob.analysis.gaps.slice(0, 4).map((item) => (
                            <li key={item}>{item}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                    <details className="aj-details" style={{ marginTop: 9 }}>
                      <summary>
                        查看风险、关键词与切入建议 <ChevronDown size={11} style={{ verticalAlign: -1 }} />
                      </summary>
                      <div>
                        {displayJob.analysis.risks.length > 0 && (
                          <div className="aj-notice warn" style={{ marginBottom: 6 }}>
                            <TriangleAlert size={12} />
                            <div>
                              <b>风险</b>
                              {displayJob.analysis.risks.join('；')}
                            </div>
                          </div>
                        )}
                        {displayJob.analysis.keywords.length > 0 && (
                          <div className="aj-keywords" style={{ marginBottom: 6 }}>
                            {displayJob.analysis.keywords.slice(0, 12).map((keyword) => (
                              <span className="aj-keyword" key={keyword}>
                                {keyword}
                              </span>
                            ))}
                          </div>
                        )}
                        {displayJob.analysis.suggestedAngle && (
                          <p style={{ margin: '0 0 4px' }}>{displayJob.analysis.suggestedAngle}</p>
                        )}
                        {displayJob.analysis.salaryComment && (
                          <p style={{ margin: 0 }}>薪资：{displayJob.analysis.salaryComment}</p>
                        )}
                      </div>
                    </details>
                  </div>
                )}

                {displayJob && (
                  <div className="aj-card">
                    <div className="aj-card-head">
                      <div>
                        <h3>招呼语</h3>
                        <span className="aj-muted">
                          {application ? '已发送的版本' : '发送前请确认语气和事实'}
                        </span>
                      </div>
                      {detail?.greeting && !application && (
                        <button
                          className="aj-btn aj-btn-ghost aj-btn-sm"
                          disabled={Boolean(busy) || autoBusy}
                          onClick={() => handleGreeting(true)}
                        >
                          {busy === 'greeting' ? (
                            <Loader2 size={11} className="aj-spin" />
                          ) : (
                            <RefreshCw size={11} />
                          )}
                          重写
                        </button>
                      )}
                    </div>
                    {greetingText ? (
                      <>
                        <textarea
                          className="aj-textarea"
                          rows={6}
                          value={greetingText}
                          onChange={(event) => setGreetingText(event.target.value)}
                          readOnly={Boolean(application)}
                        />
                        <div className="aj-char">{greetingText.length} 字</div>
                        <div className="aj-actions">
                          <button
                            className="aj-btn aj-btn-secondary aj-btn-sm"
                            onClick={() => handleCopy(greetingText)}
                          >
                            <Copy size={11} /> 复制
                          </button>
                        </div>
                      </>
                    ) : (
                      <div className="aj-row-between">
                        <span className="aj-muted">还没有生成招呼语</span>
                        <button
                          className="aj-btn aj-btn-soft aj-btn-sm"
                          disabled={Boolean(busy) || autoBusy}
                          onClick={() => handleGreeting(false)}
                        >
                          {busy === 'greeting' ? (
                            <Loader2 size={11} className="aj-spin" />
                          ) : (
                            <Sparkles size={11} />
                          )}
                          生成招呼语
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {displayJob && (
                  <div className="aj-card">
                    <div className="aj-card-head">
                      <div>
                        <h3>定制简历</h3>
                        <span className="aj-muted">
                          {latestResume
                            ? `${formatDate(latestResume.createdAt)} 生成 · ${latestResume.hasPdf ? 'PDF 已就绪' : 'HTML'}` 
                            : '按岗位挑选经历并改写，不编造事实'}
                        </span>
                      </div>
                      {latestResume && (
                        <button
                          className="aj-btn aj-btn-ghost aj-btn-sm"
                          disabled={Boolean(busy) || autoBusy}
                          onClick={handleTailor}
                        >
                          {busy === 'tailor' ? (
                            <Loader2 size={11} className="aj-spin" />
                          ) : (
                            <RefreshCw size={11} />
                          )}
                          重新生成
                        </button>
                      )}
                    </div>
                    {latestResume ? (
                      <>
                        <div className="aj-row" style={{ marginBottom: 7 }}>
                          <FileText size={14} style={{ color: '#1f5eff' }} />
                          <span style={{ fontSize: 11.5, fontWeight: 600 }}>
                            {latestResume.doc.headline || displayJob.title}
                          </span>
                          <span className="aj-muted">{latestResume.doc.jobIntention}</span>
                        </div>
                        <p className="aj-muted" style={{ margin: '0 0 8px', lineHeight: 1.6 }}>
                          {latestResume.doc.summary}
                        </p>
                        <div className="aj-actions">
                          {latestResume.hasPdf && (
                            <>
                              <button
                                className="aj-btn aj-btn-secondary aj-btn-sm"
                                onClick={() => void openUrl(latestResume.pdfUrl!)}
                              >
                                <FileText size={11} /> 预览 PDF
                              </button>
                              <button
                                className="aj-btn aj-btn-ghost aj-btn-sm"
                                onClick={() => void openUrl(latestResume.pdfUrl!, true)}
                              >
                                <Download size={11} /> 下载
                              </button>
                              <button
                                className="aj-btn aj-btn-ghost aj-btn-sm"
                                disabled={busy === 'resume' || autoBusy}
                                onClick={handleSendResume}
                              >
                                {busy === 'resume' ? (
                                  <Loader2 size={11} className="aj-spin" />
                                ) : (
                                  <Link2 size={11} />
                                )}
                                发送 PDF
                              </button>
                            </>
                          )}
                          <button
                            className="aj-btn aj-btn-ghost aj-btn-sm"
                            onClick={() => void openUrl(latestResume.htmlUrl!)}
                          >
                            查看 HTML
                          </button>
                        </div>
                        {latestResume.changeNotes.length > 0 && (
                          <details className="aj-details" style={{ marginTop: 8 }}>
                            <summary>本次调整（{latestResume.changeNotes.length}）</summary>
                            <div>
                              <ul className="aj-dot-list">
                                {latestResume.changeNotes.map((note) => (
                                  <li key={note}>{note}</li>
                                ))}
                              </ul>
                            </div>
                          </details>
                        )}
                      </>
                    ) : (
                      <button
                        className="aj-btn aj-btn-soft aj-btn-sm aj-btn-block"
                        disabled={Boolean(busy) || autoBusy}
                        onClick={handleTailor}
                      >
                        {busy === 'tailor' ? (
                          <Loader2 size={12} className="aj-spin" />
                        ) : (
                          <Sparkles size={12} />
                        )}
                        {busy === 'tailor' ? '正在生成…' : '生成定制简历 PDF'}
                      </button>
                    )}
                    <p className="aj-hint" style={{ marginTop: 7 }}>
                      附件发送需要你在聊天窗口确认；平台风控下脚本不保证附件入口可用。
                    </p>
                  </div>
                )}

                {displayJob && (
                  <div className="aj-card flat">
                    <div className="aj-row-between">
                      <div>
                        <span className="aj-muted">投递状态</span>
                        <div style={{ marginTop: 3 }}>
                          {application ? (
                            <span className="aj-badge blue">
                              {APPLICATION_STATUS_LABELS[application.status]}
                            </span>
                          ) : (
                            <span className="aj-badge gray">未投递</span>
                          )}
                        </div>
                      </div>
                      {!application && greetingText && (
                        <button
                          className="aj-btn aj-btn-ghost aj-btn-sm"
                          disabled={Boolean(busy) || autoBusy}
                          onClick={handleMarkSubmitted}
                        >
                          {busy === 'status' ? (
                            <Loader2 size={11} className="aj-spin" />
                          ) : null}
                          手动标记已投递
                        </button>
                      )}
                      {application && latestResume?.hasPdf && (
                        <button
                          className="aj-btn aj-btn-secondary aj-btn-sm"
                          disabled={Boolean(busy) || autoBusy}
                          onClick={handleSendResume}
                        >
                          <Link2 size={11} /> 发送简历 PDF
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="aj-card">
                  <div className="aj-card-head">
                    <div>
                      <h3>当前对话</h3>
                      <span className="aj-muted">
                        {chatCtx
                          ? [chatCtx.company, chatCtx.jobTitle].filter(Boolean).join(' · ') ||
                            '已读取聊天内容'
                          : '请打开 BOSS 聊天页'}
                      </span>
                    </div>
                    <button className="aj-btn aj-btn-ghost aj-btn-sm" onClick={refreshChat}>
                      <RefreshCw size={11} /> 刷新
                    </button>
                  </div>
                  {chatCtx ? (
                    <div className="aj-chat-current">
                      <div className="aj-avatar">{initials(chatCtx.hrName)}</div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 600 }}>{chatCtx.hrName}</div>
                        <div className="aj-muted">
                          {chatCtx.messages.length} 条消息 · 可生成回复草稿
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p className="aj-muted" style={{ margin: 0, lineHeight: 1.6 }}>
                      打开任意一个 HR 聊天窗口后，扩展会在这里显示对话并生成回复草稿。
                    </p>
                  )}
                </div>

                {busyLabel && (
                  <div className="aj-notice info">
                    <Loader2 size={14} className="aj-spin" />
                    <div>{busyLabel}</div>
                  </div>
                )}

                {currentDraft ? (
                  <div className="aj-card">
                    <div className="aj-row-between" style={{ marginBottom: 8 }}>
                      <div className="aj-row">
                        <span className="aj-badge blue">{currentDraft.intent}</span>
                        <span className="aj-badge gray">{currentDraft.sentiment}</span>
                        <span className="aj-muted">{formatDate(currentDraft.updatedAt)}</span>
                      </div>
                      <button
                        className="aj-btn aj-btn-ghost aj-btn-sm"
                        disabled={busy === 'chat'}
                        onClick={handleRegenerateCurrentChat}
                      >
                        {busy === 'chat' ? (
                          <Loader2 size={11} className="aj-spin" />
                        ) : (
                          <RefreshCw size={11} />
                        )}
                        重写
                      </button>
                    </div>

                    <div className="aj-messages">
                      {currentDraft.messages.slice(-6).map((message, index) => (
                        <div className={`aj-msg ${message.role === 'me' ? 'me' : ''}`} key={index}>
                          <span>{message.role === 'me' ? '我' : currentDraft.hrName || 'HR'}</span>
                          <p>{message.text}</p>
                        </div>
                      ))}
                    </div>

                    <div className="aj-reply-box" style={{ marginTop: 9 }}>
                      <div className="aj-row-between" style={{ marginBottom: 5 }}>
                        <span style={{ fontSize: 11, fontWeight: 600 }}>建议回复</span>
                        <button
                          className="aj-btn aj-btn-ghost aj-btn-sm"
                          onClick={() => handleCopy(replyText)}
                        >
                          <Copy size={10} /> 复制
                        </button>
                      </div>
                      <textarea
                        className="aj-textarea"
                        rows={4}
                        value={replyText}
                        onChange={(event) =>
                          currentDraft &&
                          setReplyEdits((previous) => ({
                            ...previous,
                            [currentDraft.key]: event.target.value,
                          }))
                        }
                      />
                      <div className="aj-char">{replyText.length} 字</div>
                    </div>

                    {currentDraft.riskFlags.length > 0 && (
                      <div className="aj-notice warn" style={{ marginTop: 7 }}>
                        <TriangleAlert size={12} />
                        <div>{currentDraft.riskFlags.join('；')}</div>
                      </div>
                    )}
                    {currentDraft.nextAction && (
                      <p className="aj-hint" style={{ marginTop: 7 }}>
                        下一步：{currentDraft.nextAction}
                      </p>
                    )}

                    <div className="aj-actions" style={{ marginTop: 8 }}>
                      <button
                        className="aj-btn aj-btn-secondary aj-btn-sm"
                        disabled={busy === 'chat'}
                        onClick={handleChatFill}
                      >
                        仅填入输入框
                      </button>
                      {autoSendReply && (
                        <button
                          className="aj-btn aj-btn-primary aj-btn-sm"
                          disabled={busy === 'chat'}
                          onClick={handleChatSend}
                        >
                          {busy === 'chat' ? (
                            <Loader2 size={11} className="aj-spin" />
                          ) : (
                            <Send size={11} />
                          )}
                          发送回复
                        </button>
                      )}
                      {!autoSendReply && (
                        <button
                          className="aj-btn aj-btn-primary aj-btn-sm"
                          disabled={busy === 'chat'}
                          onClick={handleChatFill}
                        >
                          <Send size={11} /> 填入聊天框
                        </button>
                      )}
                    </div>
                    <p className="aj-hint" style={{ marginTop: 7 }}>
                      发送前请确认 HR 与岗位上下文。回复不会自动重试。
                    </p>
                  </div>
                ) : chatCtx ? (
                  <div className="aj-card">
                    <div className="aj-row-between">
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 600 }}>还没有回复草稿</div>
                        <div className="aj-muted" style={{ marginTop: 2 }}>
                          {bootstrap?.settings.automation.autoDraftReplies
                            ? '等待 HR 新消息，或立即生成'
                            : '自动草稿已关闭，可手动生成'}
                        </div>
                      </div>
                      <button
                        className="aj-btn aj-btn-soft aj-btn-sm"
                        disabled={busy === 'chat'}
                        onClick={handleGenerateCurrentChat}
                      >
                        {busy === 'chat' ? (
                          <Loader2 size={11} className="aj-spin" />
                        ) : (
                          <Sparkles size={11} />
                        )}
                        生成回复
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="aj-empty">
                    <MessageSquareText size={22} />
                    <b>打开一个聊天窗口</b>
                    HR 发来新消息后，扩展会自动生成回复草稿，发送前由你确认。
                  </div>
                )}

                {chats.filter((draft) => draft.key !== currentDraft?.key).length > 0 && (
                  <div className="aj-card flat">
                    <div className="aj-card-head">
                      <div>
                        <h3>其他对话草稿</h3>
                        <span className="aj-muted">切换到对应聊天窗口后再发送</span>
                      </div>
                    </div>
                    {chats
                      .filter((draft) => draft.key !== currentDraft?.key)
                      .slice(0, 5)
                      .map((draft) => (
                        <div className="aj-chat-item" key={draft.key}>
                          <div className="aj-row-between">
                            <div>
                              <b style={{ fontSize: 11.5 }}>{draft.hrName || 'HR'}</b>
                              <span className="aj-muted">
                                {[draft.company, draft.jobTitle].filter(Boolean).join(' · ')}
                              </span>
                            </div>
                            <span className="aj-badge gray">{draft.intent}</span>
                          </div>
                          <p>{draft.reply}</p>
                          <div className="aj-actions">
                            <button
                              className="aj-btn aj-btn-ghost aj-btn-sm"
                              onClick={() => handleCopy(draft.reply)}
                            >
                              <Copy size={10} /> 复制
                            </button>
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </>
            )}
          </div>

          {showFooter && (
            <footer className="aj-footer">
              <div className="aj-grow aj-footer-meta">
                {application
                  ? `投递状态：${APPLICATION_STATUS_LABELS[application.status]}`
                  : displayJob?.analysis
                    ? `匹配 ${displayJob.analysis.score} 分 · 每日上限 ${bootstrap?.settings.automation.maxPerDay ?? 20}`
                    : '先生成分析，再准备招呼语和简历'}
              </div>
              {application ? (
                latestResume?.hasPdf ? (
                  <button
                    className="aj-btn aj-btn-secondary aj-btn-sm"
                    disabled={busy === 'resume'}
                    onClick={handleSendResume}
                  >
                    {busy === 'resume' ? (
                      <Loader2 size={12} className="aj-spin" />
                    ) : (
                      <Link2 size={12} />
                    )}
                    发送简历
                  </button>
                ) : (
                  <button
                    className="aj-btn aj-btn-secondary aj-btn-sm"
                    onClick={() => handleOpenDashboard('jobs')}
                  >
                    查看记录
                  </button>
                )
              ) : (
                <>
                  {greetingText && (
                    <button
                      className="aj-btn aj-btn-ghost aj-btn-sm"
                      title="复制招呼语"
                      onClick={() => handleCopy(greetingText)}
                    >
                      <Copy size={13} />
                    </button>
                  )}
                  <button
                    className="aj-btn aj-btn-primary aj-btn-sm"
                    disabled={!greetingText || !detail || Boolean(busy) || autoBusy}
                    onClick={handleApply}
                  >
                    {busy === 'apply' ? (
                      <Loader2 size={12} className="aj-spin" />
                    ) : (
                      <Send size={12} />
                    )}
                    {autoSendGreeting ? '确认发送招呼语' : '填入招呼语'}
                  </button>
                </>
              )}
            </footer>
          )}

          {toast && <div className={`aj-toast ${toast.type}`}>{toast.message}</div>}
        </aside>
      )}
    </div>
  );
}
