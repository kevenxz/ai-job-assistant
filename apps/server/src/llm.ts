import type { LlmSettings } from '../../../src/shared/types';
import { HttpError } from './errors';
import { Store } from './store';

export interface LlmCallOptions {
  temperature?: number;
  maxTokens?: number;
  json?: boolean;
}

const JSON_ONLY = '\n\n只返回一个合法 JSON 对象。不要输出 Markdown 代码块，不要在 JSON 前后添加任何解释文字。';

export function parseJsonFromText(text: string): unknown {
  let cleaned = text.replace(/^\uFEFF/, '').trim();
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();

  const tryParse = (candidate: string): unknown => {
    try {
      return JSON.parse(candidate);
    } catch {
      return undefined;
    }
  };

  const direct = tryParse(cleaned);
  if (direct !== undefined) return direct;

  const objectStart = cleaned.indexOf('{');
  const objectEnd = cleaned.lastIndexOf('}');
  if (objectStart >= 0 && objectEnd > objectStart) {
    const slice = cleaned.slice(objectStart, objectEnd + 1);
    const parsed = tryParse(slice);
    if (parsed !== undefined) return parsed;
    const repaired = tryParse(slice.replace(/,\s*([}\]])/g, '$1'));
    if (repaired !== undefined) return repaired;
  }

  const arrayStart = cleaned.indexOf('[');
  const arrayEnd = cleaned.lastIndexOf(']');
  if (arrayStart >= 0 && arrayEnd > arrayStart) {
    const parsed = tryParse(cleaned.slice(arrayStart, arrayEnd + 1));
    if (parsed !== undefined) return parsed;
  }

  throw new HttpError(502, '模型返回的内容不是合法 JSON，请重试或换一个模型');
}

function completionsUrl(baseUrl: string): string {
  const base = baseUrl.trim().replace(/\/+$/, '');
  if (base.endsWith('/chat/completions')) return base;
  return `${base}/chat/completions`;
}

function contentToText(content: unknown): string {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === 'string') return part;
        if (part && typeof part === 'object' && 'text' in part) {
          return String((part as { text?: unknown }).text ?? '');
        }
        return '';
      })
      .join('');
  }
  return '';
}

function friendlyHttpError(status: number, body: string): string {
  const snippet = body.replace(/\s+/g, ' ').slice(0, 240);
  if (status === 401 || status === 403) {
    return '大模型鉴权失败（401/403），请检查 API Key 是否正确、是否有该模型权限。';
  }
  if (status === 404) {
    return `大模型接口返回 404，请检查 API 地址是否包含正确的版本路径（通常以 /v1 结尾）。${snippet ? ` 详情：${snippet}` : ''}`;
  }
  if (status === 429) {
    return '大模型请求过于频繁或额度不足（429），请稍后重试或检查账户余额。';
  }
  return `大模型请求失败（HTTP ${status}）：${snippet || '无返回内容'}`;
}

export class LlmClient {
  constructor(private readonly store: Store) {}

  private getSettings(): LlmSettings {
    const settings = this.store.getSettings().llm;
    if (!settings.apiKey.trim()) {
      throw new HttpError(400, '尚未配置大模型 API Key，请先在管理后台「设置」中填写。');
    }
    if (!settings.baseUrl.trim() || !settings.model.trim()) {
      throw new HttpError(400, '大模型地址或模型名称未配置，请先在管理后台完成设置。');
    }
    return settings;
  }

  private async request(
    system: string,
    user: string,
    options: LlmCallOptions = {},
    allowCompatRetry = true,
  ): Promise<string> {
    const settings = this.getSettings();
    const body: Record<string, unknown> = {
      model: settings.model,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      temperature: options.temperature ?? settings.temperature,
      stream: false,
      max_tokens: options.maxTokens ?? 4000,
    };
    if (options.json && settings.jsonMode) {
      body.response_format = { type: 'json_object' };
    }

    let response: Response;
    try {
      response = await fetch(completionsUrl(settings.baseUrl), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${settings.apiKey}`,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(120_000),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new HttpError(
        502,
        `无法连接大模型接口（${message}）。请检查 API 地址、网络或代理设置。`,
      );
    }

    const rawText = await response.text();
    if (!response.ok) {
      if (allowCompatRetry && options.json && settings.jsonMode && response.status === 400) {
        const retryBody = { ...body };
        delete retryBody.response_format;
        return this.requestWithoutFormat(retryBody, settings);
      }
      throw new HttpError(502, friendlyHttpError(response.status, rawText));
    }

    let data: unknown;
    try {
      data = JSON.parse(rawText);
    } catch {
      throw new HttpError(502, '大模型接口返回了非 JSON 响应，请检查 API 地址是否正确。');
    }

    const choices = (data as { choices?: Array<{ message?: { content?: unknown } }> }).choices;
    const content = contentToText(choices?.[0]?.message?.content);
    if (!content.trim()) {
      throw new HttpError(502, '大模型返回了空内容，请重试。');
    }
    return content.trim();
  }

  private async requestWithoutFormat(
    body: Record<string, unknown>,
    settings: LlmSettings,
  ): Promise<string> {
    let response: Response;
    try {
      response = await fetch(completionsUrl(settings.baseUrl), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${settings.apiKey}`,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(120_000),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new HttpError(502, `无法连接大模型接口（${message}）。请检查 API 地址或网络。`);
    }
    const rawText = await response.text();
    if (!response.ok) throw new HttpError(502, friendlyHttpError(response.status, rawText));
    let data: unknown;
    try {
      data = JSON.parse(rawText);
    } catch {
      throw new HttpError(502, '大模型接口返回了非 JSON 响应，请检查 API 地址是否正确。');
    }
    const content = contentToText(
      (data as { choices?: Array<{ message?: { content?: unknown } }> }).choices?.[0]?.message?.content,
    );
    if (!content.trim()) throw new HttpError(502, '大模型返回了空内容，请重试。');
    return content.trim();
  }

  async json<T>(system: string, user: string, options: LlmCallOptions = {}): Promise<T> {
    const first = await this.request(`${system}${JSON_ONLY}`, user, { ...options, json: true });
    try {
      return parseJsonFromText(first) as T;
    } catch {
      const retry = await this.request(
        `${system}${JSON_ONLY}\n上一次输出无法被解析。请严格输出 JSON，不要任何额外文字。`,
        user,
        { ...options, json: true, temperature: Math.min(0.2, options.temperature ?? 0.2) },
      );
      return parseJsonFromText(retry) as T;
    }
  }

  async text(system: string, user: string, options: LlmCallOptions = {}): Promise<string> {
    return this.request(system, user, options);
  }

  async test(): Promise<{ latencyMs: number; reply: string }> {
    const started = Date.now();
    const reply = await this.text(
      '你是 API 连通性测试助手。只回复“OK”两个字母，不要输出其他内容。',
      '请回复 OK。',
      { maxTokens: 10, temperature: 0 },
    );
    return { latencyMs: Date.now() - started, reply: reply.slice(0, 50) };
  }
}
