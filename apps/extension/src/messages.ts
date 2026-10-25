export type ExtensionMessage =
  | { type: 'GET_STATE' }
  | { type: 'SET_SERVER'; serverUrl: string }
  | { type: 'API'; path: string; method?: string; body?: unknown }
  | { type: 'FETCH_FILE'; path: string }
  | { type: 'OPEN_DASHBOARD'; path?: string }
  | { type: 'OPEN_URL'; path: string; download?: boolean }
  | { type: 'TOGGLE_PANEL' };

export interface ApiMessageResponse<T = unknown> {
  ok: boolean;
  status?: number;
  data?: T;
  error?: string;
}

export interface FileMessageResponse {
  ok: boolean;
  base64?: string;
  mime?: string;
  filename?: string;
  error?: string;
}

export interface StateMessageResponse {
  ok: boolean;
  serverUrl?: string;
  hasToken?: boolean;
  error?: string;
}

export const DEFAULT_SERVER_URL = 'http://127.0.0.1:8787';
