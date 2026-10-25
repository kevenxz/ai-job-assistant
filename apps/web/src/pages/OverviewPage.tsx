import { useEffect, useState } from 'react';
import {
  ArrowRight,
  BriefcaseBusiness,
  CalendarCheck2,
  CheckCircle2,
  MessageSquareText,
  Send,
  Sparkles,
  Wand2,
} from 'lucide-react';
import type { ChatDraft, JobWithState } from '../../../../src/shared/types';
import { api } from '../api';
import type { PageProps } from '../page-types';
import {
  Badge,
  Button,
  Card,
  CopyButton,
  EmptyState,
  ScoreRing,
  Spinner,
  StatusPill,
  formatDate,
} from '../ui';

export function OverviewPage({ bootstrap, navigate, refreshKey, refreshBootstrap }: PageProps) {
  const [jobs, setJobs] = useState<JobWithState[]>([]);
  const [chats, setChats] = useState<ChatDraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    setLoading(true);
    Promise.all([api.getJobs(), api.getChats()])
      .then(([jobsResponse, chatsResponse]) => {
        if (!alive) return;
        setJobs(jobsResponse.jobs);
        setChats(chatsResponse.chats);
        setError('');
      })
      .catch((reason: Error) => alive && setError(reason.message))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [refreshKey]);

  const applications = jobs
    .filter((job) => job.application)
    .sort((a, b) =>
      (b.application?.submittedAt || b.application?.createdAt || '').localeCompare(
        a.application?.submittedAt || a.application?.createdAt || '',
      ),
    );
  const interviews = applications.filter(
    (job) => job.application?.status === 'interview' || job.application?.status === 'offer',
  ).length;
  const highMatches = jobs.filter((job) => (job.analysis?.score || 0) >= 75).length;

  const steps = [
    {
      done: bootstrap.profileReady,
      title: '完善基础资料',
      description: '把真实经历整理成结构化档案，这是简历定制的事实来源。',
      action: '去完善',
      onClick: () => navigate('profile'),
    },
    {
      done: bootstrap.llmConfigured,
      title: '配置大模型',
      description: '填写 OpenAI 兼容 API（DeepSeek、通义千问、Kimi 等均可）。',
      action: '去配置',
      onClick: () => navigate('settings'),
    },
    {
      done: jobs.length > 0,
      title: '在 BOSS 页面采集岗位',
      description: '安装扩展后，打开职位详情点击右下角「AI 求职」面板。',
      action: '查看岗位',
      onClick: () => navigate('jobs'),
    },
    {
      done: applications.length > 0,
      title: '审核并发送招呼语',
      description: '人工确认 AI 草稿后，由扩展填入 BOSS 聊天窗口发送。',
      action: '去投递',
      onClick: () => navigate('jobs'),
    },
  ];

  return (
    <div className="stack">
      {(error || loading) && (
        <div className="inline-status">
          {loading ? <Spinner label="正在读取岗位与对话…" /> : <span className="form-error">{error}</span>}
        </div>
      )}

      {!bootstrap.llmConfigured && (
        <div className="notice notice-warn">
          <Sparkles size={18} />
          <div>
            <b>还差一步：配置大模型</b>
            <p>没有 API Key 时只能整理资料，无法生成分析、简历和回复草稿。</p>
          </div>
          <Button size="sm" variant="secondary" onClick={() => navigate('settings')}>
            去设置
          </Button>
        </div>
      )}

      {!bootstrap.profileReady && (
        <div className="notice notice-info">
          <Wand2 size={18} />
          <div>
            <b>先建立你的事实档案</b>
            <p>支持上传 PDF/DOCX 简历，让 AI 自动解析成结构化资料，再人工校正。</p>
          </div>
          <Button size="sm" onClick={() => navigate('profile')}>
            开始整理
          </Button>
        </div>
      )}

      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-icon blue">
            <BriefcaseBusiness size={19} />
          </div>
          <div>
            <div className="stat-value">{jobs.length}</div>
            <div className="stat-label">已采集岗位</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon violet">
            <Send size={19} />
          </div>
          <div>
            <div className="stat-value">{applications.length}</div>
            <div className="stat-label">已投递岗位</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon green">
            <CalendarCheck2 size={19} />
          </div>
          <div>
            <div className="stat-value">{interviews}</div>
            <div className="stat-label">面试 / Offer</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon amber">
            <Sparkles size={19} />
          </div>
          <div>
            <div className="stat-value">{bootstrap.todayApplications}</div>
            <div className="stat-label">今日已投递 · 上限 {bootstrap.settings.automation.maxPerDay}</div>
          </div>
        </div>
      </div>

      <div className="overview-grid">
        <Card
          title="开始使用"
          subtitle="四步走完，之后每个岗位只需要一次确认"
          className="span-2"
        >
          <div className="steps">
            {steps.map((step, index) => (
              <div className={`step ${step.done ? 'done' : ''}`} key={step.title}>
                <div className="step-index">
                  {step.done ? <CheckCircle2 size={18} /> : index + 1}
                </div>
                <div className="step-body">
                  <b>{step.title}</b>
                  <p>{step.description}</p>
                </div>
                <button className="step-action" onClick={step.onClick}>
                  {step.action}
                  <ArrowRight size={14} />
                </button>
              </div>
            ))}
          </div>
        </Card>

        <Card title="待处理对话" subtitle="AI 已为新消息准备好草稿">
          {loading ? (
            <Spinner label="读取中…" />
          ) : chats.length ? (
            <div className="chat-mini-list">
              {chats.slice(0, 3).map((chat) => (
                <div className="chat-mini" key={chat.key}>
                  <div className="chat-mini-head">
                    <div>
                      <b>{chat.hrName || 'HR'}</b>
                      <span className="muted">
                        {[chat.company, chat.jobTitle].filter(Boolean).join(' · ') || '未知岗位'}
                      </span>
                    </div>
                    <Badge tone="violet">{chat.intent}</Badge>
                  </div>
                  <p className="chat-mini-reply">{chat.reply}</p>
                  <div className="chat-mini-actions">
                    <span className="muted">{formatDate(chat.updatedAt)}</span>
                    <CopyButton text={chat.reply} label="复制回复" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={<MessageSquareText size={22} />}
              title="还没有对话草稿"
              description="扩展监测到 HR 新消息后，会在这里生成可直接发送的回复。"
            />
          )}
        </Card>
      </div>

      <Card
        title="最近投递"
        subtitle={highMatches ? `有 ${highMatches} 个高匹配岗位值得优先关注` : '投递进度会自动记录'}
        actions={
          applications.length ? (
            <Button variant="ghost" size="sm" onClick={() => navigate('jobs')}>
              查看全部
            </Button>
          ) : undefined
        }
      >
        {loading ? (
          <Spinner label="读取中…" />
        ) : applications.length ? (
          <div className="list">
            {applications.slice(0, 6).map((job) => (
              <button className="list-row" key={job.id} onClick={() => navigate('jobs')}>
                {job.analysis ? <ScoreRing score={job.analysis.score} size={48} /> : <div className="score-placeholder">—</div>}
                <div className="list-main">
                  <div className="list-title">{job.title}</div>
                  <div className="list-meta">
                    <span>{job.company}</span>
                    {job.salary && <span>{job.salary}</span>}
                    {job.city && <span>{job.city}</span>}
                  </div>
                </div>
                {job.application && <StatusPill status={job.application.status} />}
                <span className="list-date">{formatDate(job.application?.submittedAt)}</span>
              </button>
            ))}
          </div>
        ) : jobs.length ? (
          <EmptyState
            icon={<Send size={22} />}
            title="还没有投递记录"
            description="在岗位详情里生成招呼语后，在 BOSS 页面确认发送，或手动标记已投递。"
            action={
              <Button variant="secondary" onClick={() => navigate('jobs')}>
                查看已采集岗位
              </Button>
            }
          />
        ) : (
          <EmptyState
            icon={<BriefcaseBusiness size={22} />}
            title="还没有采集岗位"
            description="安装扩展后，在 BOSS 职位详情页点击右下角的「AI 求职」按钮开始。"
            action={
              <div className="inline-actions">
                <a className="btn btn-secondary btn-md" href="https://www.zhipin.com/web/geek/jobs" target="_blank" rel="noreferrer">
                  打开 BOSS 直聘
                </a>
                <Button variant="ghost" onClick={() => navigate('jobs')}>
                  查看使用说明
                </Button>
              </div>
            }
          />
        )}
      </Card>
    </div>
  );
}
