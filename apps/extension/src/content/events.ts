import type { ChatDraft } from '../../../../src/shared/types';

type ChatDraftListener = (draft: ChatDraft) => void;

const listeners = new Set<ChatDraftListener>();

export function emitChatDraft(draft: ChatDraft): void {
  for (const listener of listeners) listener(draft);
}

export function subscribeChatDraft(listener: ChatDraftListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
