import type { Bootstrap, ChatDraft } from '../../../../src/shared/types';
import { api } from './ext';
import { emitChatDraft } from './events';
import { extractChatContext, getPageKind } from './boss';

let bootstrapCache: Bootstrap | null = null;
let bootstrapAt = 0;
let lastSignature = '';

export function invalidateBootstrap(): void {
  bootstrapAt = 0;
}

export async function getCachedBootstrap(force = false): Promise<Bootstrap | null> {
  if (!force && bootstrapCache && Date.now() - bootstrapAt < 60_000) return bootstrapCache;
  try {
    bootstrapCache = await api<Bootstrap>('/api/bootstrap');
    bootstrapAt = Date.now();
    return bootstrapCache;
  } catch {
    return bootstrapCache;
  }
}

function signatureOf(context: ReturnType<typeof extractChatContext>): string {
  if (!context) return '';
  const last = context.messages[context.messages.length - 1];
  return `${context.conversationKey}|${context.messages.length}|${last?.role}|${last?.text.slice(0, 200)}`;
}

export async function observeCurrentChat(force = false): Promise<ChatDraft | null> {
  const context = extractChatContext();
  if (!context) throw new Error('没有读取到当前对话，请先打开与 HR 的聊天窗口');
  const response = await api<{ draft: ChatDraft | null }>('/api/chats/observe', 'POST', {
    ...context,
    force,
  });
  if (response.draft) {
    lastSignature = signatureOf(context);
    emitChatDraft(response.draft);
    return response.draft;
  }
  return null;
}

export function startChatWatcher(): () => void {
  let stopped = false;

  const tick = async () => {
    if (stopped || document.visibilityState === 'hidden') return;
    if (getPageKind() !== 'chat') return;
    const context = extractChatContext();
    if (!context) return;
    const last = context.messages[context.messages.length - 1];
    if (!last || last.role !== 'hr') return;
    const signature = signatureOf(context);
    if (signature === lastSignature) return;

    const bootstrap = await getCachedBootstrap();
    if (stopped) return;
    if (!bootstrap?.settings.automation.autoDraftReplies) return;
    if (!bootstrap.profileReady || !bootstrap.llmConfigured) return;

    lastSignature = signature;
    try {
      const response = await api<{ draft: ChatDraft | null }>('/api/chats/observe', 'POST', context);
      if (response.draft) emitChatDraft(response.draft);
    } catch {
      lastSignature = '';
    }
  };

  const timer = window.setInterval(() => {
    void tick();
  }, 4500);
  window.setTimeout(() => {
    void tick();
  }, 1500);

  return () => {
    stopped = true;
    window.clearInterval(timer);
  };
}

export function resetChatSignature(): void {
  lastSignature = '';
}
