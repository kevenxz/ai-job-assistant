import { useEffect, useMemo, useState } from 'react';
import {
  Cpu,
  Eye,
  EyeOff,
  HardDrive,
  KeyRound,
  MessageCircle,
  Palette,
  PlugZap,
  Save,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
} from 'lucide-react';
import type {
  AutomationSettings,
  AutoGreetSettings,
  PublicSettings,
  ReplyTone,
  ResumeSettings,
  SettingsPatch,
} from '../../../../src/shared/types';
import { api } from '../api';
import type { PageProps } from '../page-types';
import { Button, Card, Field, Spinner, Switch } from '../ui';

const PRESETS = [
  {
    name: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com/v1',
    model: 'deepseek-chat',
  },
  {
    name: '通义千问',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    model: 'qwen-plus',
  },
  {
    name: 'Kimi',
    baseUrl: 'https://api.moonshot.cn/v1',
    model: 'kimi-latest',
  },
  {
    name: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4o-mini',
  },
];

const COLOR_PRESETS = ['#1f5eff', '#0f766e', '#7c3aed', '#b45309', '#111827'];

const TONES: ReplyTone[] = ['专业', '友好', '简洁'];

export function SettingsPage({ refreshKey, refreshBootstrap, notify }: PageProps) {
  const [settings, setSettings] = useState<PublicSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [showKey, setShowKey] = useState(false);

  const [baseUrl, setBaseUrl] = useState('');
  const [model, setModel] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [temperature, setTemperature] = useState(0.4);
  const [jsonMode, setJsonMode] = useState(true);
  const [automation, setAutomation] = useState<AutomationSettings | null>(null);
  const [autoGreet, setAutoGreet] = useState<AutoGreetSettings | null>(null);
  const [resume, setResume] = useState<ResumeSettings | null>(null);
  const [replyTone, setReplyTone] = useState<ReplyTone>('专业');
  const [customInstructions, setCustomInstructions] = useState('');
  const [chromePath, setChromePath] = useState('');

  function applySettings(publicSettings: PublicSettings) {
    setSettings(publicSettings);
    setBaseUrl(publicSettings.llm.baseUrl);
    setModel(publicSettings.llm.model);
    setTemperature(publicSettings.llm.temperature);
    setJsonMode(publicSettings.llm.jsonMode);
    setAutomation(publicSettings.automation);
    setAutoGreet(publicSettings.autoGreet);
    setResume(publicSettings.resume);
    setReplyTone(publicSettings.replyTone);
    setCustomInstructions(publicSettings.customInstructions);
    setChromePath(publicSettings.chromePath);
    setApiKey('');
  }

  useEffect(() => {
    let alive = true;
    setLoading(true);
    api
      .getSettings()
      .then(({ settings: loaded }) => alive && applySettings(loaded))
      .catch((error: Error) => notify('error', error.message))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [refreshKey, notify]);

  const patch = useMemo<SettingsPatch>(() => {
    const next: SettingsPatch = {
      llm: {
        baseUrl,
        model,
        temperature,
        jsonMode,
      },
      replyTone,
      customInstructions,
      chromePath,
    };
    if (apiKey.trim()) next.llm!.apiKey = apiKey.trim();
    if (automation) next.automation = automation;
    if (autoGreet) next.autoGreet = autoGreet;
    if (resume) next.resume = resume;
    return next;
  }, [
    baseUrl,
    model,
    temperature,
    jsonMode,
    apiKey,
    automation,
    autoGreet,
    resume,
    replyTone,
    customInstructions,
    chromePath,
  ]);

  async function handleSave(silent = false): Promise<boolean> {
    setSaving(true);
    try {
      const result = await api.saveSettings(patch);
      applySettings(result.settings);
      await refreshBootstrap();
      if (!silent) notify('success', '设置已保存');
      return true;
    } catch (error) {
      notify('error', error instanceof Error ? error.message : '保存失败');
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function handleTest() {
    setTesting(true);
    try {
      const saved = await api.saveSettings(patch);
      applySettings(saved.settings);
      const result = await api.testLlm();
      notify('success', `连接成功，耗时 ${result.latencyMs} ms（模型回复：${result.reply}）`);
    } catch (error) {
      notify('error', error instanceof Error ? error.message : '连接测试失败');
    } finally {
      setTesting(false);
    }
  }

  if (loading || !settings || !automation || !autoGreet || !resume) {
    return <Spinner label="正在读取设置…" />;
  }

  return (
    <div className="stack">
      <Card
        title={
          <span className="title-with-icon">
            <Cpu size={18} /> 大模型
          </span>
        }
        subtitle="支持任意 OpenAI 兼容接口。API Key 只保存在本机，不会进入扩展或浏览器前端。"
        actions={
          <div className="inline-actions">
            <Button
              variant="secondary"
              icon={<PlugZap size={15} />}
              loading={testing}
              onClick={handleTest}
            >
              保存并测试
            </Button>
            <Button icon={<Save size={15} />} loading={saving} onClick={() => handleSave()}>
              保存
            </Button>
          </div>
        }
      >
        <div className="preset-row">
          <span className="field-label">快速选择</span>
          {PRESETS.map((preset) => {
            const active = baseUrl === preset.baseUrl;
            return (
              <button
                key={preset.name}
                className={`preset-chip ${active ? 'active' : ''}`}
                onClick={() => {
                  setBaseUrl(preset.baseUrl);
                  setModel(preset.model);
                }}
              >
                {preset.name}
              </button>
            );
          })}
        </div>

        <div className="form-grid form-grid-2">
          <Field label="API 地址（Base URL）" required hint="通常以 /v1 结尾，程序会自动补全 /chat/completions。">
            <input
              className="input"
              value={baseUrl}
              onChange={(event) => setBaseUrl(event.target.value)}
              placeholder="https://api.deepseek.com/v1"
              spellCheck={false}
            />
          </Field>
          <Field label="模型名称" required>
            <input
              className="input"
              value={model}
              onChange={(event) => setModel(event.target.value)}
              placeholder="deepseek-chat"
              spellCheck={false}
            />
          </Field>
        </div>

        <Field
          label="API Key"
          required={!settings.llm.hasApiKey}
          hint={
            settings.llm.hasApiKey
              ? `${settings.llm.apiKeyHint || '已保存'}。留空表示保持不变。`
              : '在这里填写你的密钥，保存后只存在本机数据目录。'
          }
        >
          <div className="input-with-action">
            <input
              className="input"
              type={showKey ? 'text' : 'password'}
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
              placeholder={settings.llm.hasApiKey ? '留空保持不变' : 'sk-…'}
              autoComplete="off"
              spellCheck={false}
            />
            <button type="button" className="icon-btn" onClick={() => setShowKey((value) => !value)}>
              {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </Field>

        <div className="form-grid form-grid-2">
          <Field label={`温度 ${temperature.toFixed(2)}`} hint="越低越稳定。分析建议 0.2，招呼语可以 0.5-0.7。">
            <input
              type="range"
              className="range"
              min={0}
              max={1}
              step={0.05}
              value={temperature}
              onChange={(event) => setTemperature(Number(event.target.value))}
            />
          </Field>
          <div className="field">
            <Switch
              checked={jsonMode}
              onChange={setJsonMode}
              label="JSON 模式"
              description="如果模型不支持 response_format，程序会自动回退。"
            />
          </div>
        </div>
      </Card>

      <Card
        title={
          <span className="title-with-icon">
            <ShieldCheck size={18} /> 投递风控
          </span>
        }
        subtitle="即使扩展可以自动发送，也建议保持人工确认。BOSS 对高频自动化操作有风控。"
      >
        <div className="form-grid form-grid-2">
          <Field label="每日投递上限" hint="达到上限后，服务端会拒绝新的投递记录。">
            <input
              className="input"
              type="number"
              min={1}
              max={100}
              value={automation.maxPerDay}
              onChange={(event) =>
                setAutomation({ ...automation, maxPerDay: Number(event.target.value) })
              }
            />
          </Field>
          <Field label="两次投递的最小间隔（秒）" hint="防止连续快速点击。建议 30-120 秒。">
            <input
              className="input"
              type="number"
              min={0}
              max={600}
              value={automation.minIntervalSeconds}
              onChange={(event) =>
                setAutomation({ ...automation, minIntervalSeconds: Number(event.target.value) })
              }
            />
          </Field>
        </div>
        <div className="switch-list">
          <Switch
            checked={automation.autoDraftReplies}
            onChange={(checked) => setAutomation({ ...automation, autoDraftReplies: checked })}
            label="自动生成 HR 回复草稿"
            description="检测到新的 HR 消息时自动调用模型。关闭后仍可在扩展中手动生成。"
          />
          <Switch
            checked={automation.autoSendGreeting}
            onChange={(checked) => setAutomation({ ...automation, autoSendGreeting: checked })}
            label="确认后自动发送招呼语"
            description="保持开启时，你在扩展中点击「确认投递」后由页面脚本填入并发送；关闭则只填入输入框。"
          />
          <Switch
            checked={automation.autoSendReply}
            onChange={(checked) => setAutomation({ ...automation, autoSendReply: checked })}
            label="确认后自动发送回复"
            description="关闭后只把草稿填入聊天框，需要你在 BOSS 中手动点击发送。"
          />
        </div>
      </Card>

      <Card
        title={
          <span className="title-with-icon">
            <Sparkles size={18} /> 自动打招呼
          </span>
        }
        subtitle="打开 BOSS 职位详情后自动分析，达标即生成并发送招呼语。只在当前职位页生效，不遍历搜索结果。"
      >
        <Switch
          checked={autoGreet.enabled}
          onChange={(checked) => setAutoGreet({ ...autoGreet, enabled: checked })}
          label="启用单职位页自动打招呼"
          description="默认关闭。启用后，打开职位详情会自动调用模型分析并可能直接发送招呼语。"
        />
        <div className="form-grid form-grid-2" style={{ marginTop: 14 }}>
          <Field
            label={`最低匹配分：${autoGreet.minScore}`}
            hint="低于该分数的岗位只分析，不会自动发送。"
          >
            <input
              type="range"
              className="range"
              min={0}
              max={100}
              step={5}
              value={autoGreet.minScore}
              onChange={(event) =>
                setAutoGreet({ ...autoGreet, minScore: Number(event.target.value) })
              }
            />
          </Field>
          <Field label="发送前倒计时（秒）" hint="3-30 秒。倒计时期间可在扩展面板点击取消。">
            <input
              className="input"
              type="number"
              min={3}
              max={30}
              value={autoGreet.countdownSeconds}
              onChange={(event) =>
                setAutoGreet({ ...autoGreet, countdownSeconds: Number(event.target.value) })
              }
            />
          </Field>
        </div>
        <div className="notice notice-warn compact">
          <TriangleAlert size={17} />
          <div>
            <b>启用后会自动发送招呼语</b>
            <p>
              匹配分达标、未投递过的岗位会在倒计时结束后直接发送，不再二次确认。不会自动发送简历附件。
              请保持较低的每日上限和发送频率，并遵守平台规则。关闭本开关即可停止。
            </p>
          </div>
        </div>
      </Card>

      <Card
        title={
          <span className="title-with-icon">
            <Palette size={18} /> 简历样式
          </span>
        }
        subtitle="分析生成简历时生效，仅影响 PDF 排版，不改变内容。"
      >
        <div className="form-grid form-grid-3">
          <Field label="主题色">
            <div className="color-row">
              <input
                type="color"
                value={resume.accentColor}
                onChange={(event) => setResume({ ...resume, accentColor: event.target.value })}
              />
              {COLOR_PRESETS.map((color) => (
                <button
                  key={color}
                  className={`color-dot ${resume.accentColor === color ? 'active' : ''}`}
                  style={{ background: color }}
                  aria-label={color}
                  onClick={() => setResume({ ...resume, accentColor: color })}
                />
              ))}
            </div>
          </Field>
          <Field label="页数上限">
            <div className="segmented">
              {[1, 2].map((count) => (
                <button
                  key={count}
                  className={resume.pageLimit === count ? 'active' : ''}
                  onClick={() => setResume({ ...resume, pageLimit: count })}
                >
                  {count} 页
                </button>
              ))}
            </div>
          </Field>
          <Field label={`字号缩放 ${Math.round(resume.fontScale * 100)}%`} hint="内容超出页数时，程序会自动尝试缩小字号。">
            <input
              type="range"
              className="range"
              min={0.85}
              max={1.1}
              step={0.01}
              value={resume.fontScale}
              onChange={(event) => setResume({ ...resume, fontScale: Number(event.target.value) })}
            />
          </Field>
        </div>
      </Card>

      <Card
        title={
          <span className="title-with-icon">
            <MessageCircle size={18} /> 沟通风格
          </span>
        }
      >
        <div className="form-grid form-grid-2">
          <Field label="回复语气">
            <div className="segmented">
              {TONES.map((tone) => (
                <button
                  key={tone}
                  className={replyTone === tone ? 'active' : ''}
                  onClick={() => setReplyTone(tone)}
                >
                  {tone}
                </button>
              ))}
            </div>
          </Field>
          <Field label="浏览器路径" hint="留空自动检测 Chrome/Edge，用于把简历 HTML 渲染成 PDF。">
            <input
              className="input"
              value={chromePath}
              onChange={(event) => setChromePath(event.target.value)}
              placeholder="C:\Program Files\Google\Chrome\Application\chrome.exe"
              spellCheck={false}
            />
          </Field>
        </div>
        <Field
          label="自定义偏好"
          hint="会附加到分析、简历和招呼语提示中。例如：只考虑非外包岗位；不要强调管理经验。"
        >
          <textarea
            className="textarea"
            rows={4}
            value={customInstructions}
            onChange={(event) => setCustomInstructions(event.target.value)}
            placeholder="例如：优先突出我在 AI 产品上的经验；不要主动提及薪资。"
          />
        </Field>
      </Card>

      <Card
        title={
          <span className="title-with-icon">
            <HardDrive size={18} /> 数据与隐私
          </span>
        }
      >
        <div className="privacy-list">
          <div>
            <KeyRound size={17} />
            <p>
              <b>个人资料、聊天记录与简历只保存在本机</b>
              <span>位置：项目根目录 <code>.data/</code>。请勿把这个目录提交到 Git。</span>
            </p>
          </div>
          <div>
            <Cpu size={17} />
            <p>
              <b>调用模型时会发送必要内容</b>
              <span>分析时发送档案和 JD；生成回复时发送最近对话。请确认所用服务商的数据政策。</span>
            </p>
          </div>
          <div>
            <TriangleAlert size={17} />
            <p>
              <b>平台规则风险</b>
              <span>BOSS 用户协议可能限制自动化操作。本工具默认每次发送都需你确认，请控制频率并自行承担账号风险。</span>
            </p>
          </div>
        </div>
      </Card>

      <div className="save-row">
        <div>
          <b>设置保存在本机</b>
          <span className="muted">
            API Key {settings.llm.hasApiKey ? '已配置' : '未配置'} · 每日上限{' '}
            {automation.maxPerDay} · {resume.pageLimit} 页简历
          </span>
        </div>
        <div className="inline-actions">
          <Button variant="secondary" loading={testing} icon={<PlugZap size={15} />} onClick={handleTest}>
            测试连接
          </Button>
          <Button loading={saving} icon={<Save size={15} />} onClick={() => handleSave()}>
            保存设置
          </Button>
        </div>
      </div>
    </div>
  );
}
