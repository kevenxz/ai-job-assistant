import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Bot,
  BriefcaseBusiness,
  ChevronRight,
  Download,
  ExternalLink,
  Eye,
  FileText,
  MessageSquareText,
  Plus,
  RefreshCw,
  Search,
  Send,
  Sparkles,
  TriangleAlert,
} from 'lucide-react';
import {
  APPLICATION_STATUS_LABELS,
  type ApplicationStatus,
  type ChatDraft,
  type Greeting,
  type JobWithState,
  type ResumeVariant,
} from '../../../../src/shared/types';
import { api, assetUrl } from '../api';
import type { PageProps } from '../page-types';
import {
  Badge,
  Button,
  CopyButton,
  Drawer,
  EmptyState,
  Field,
  ScoreRing,
  Spinner,
  StatusPill,
  VerdictBadge,
  formatDate,
  formatDay,
} from '../ui';

type FilterKey = 'all' | 'untouched' | 'submitted' | 'interview' | 'rejected';

interface JobDetail {
  job: JobWithState;
  greeting: Greeting | null;
  resumes: ResumeVariant[];
  chat: ChatDraft | null;
}

const FILTERS: Array<{ key: FilterKey; label: string }> = [
  { key: 'all', label: '全部' },
  { key: 'untouched', label: '未投递' },
  { key: 'submitted', label: '已投递' },
  { key: 'interview', label: '面试中' },
  { key: 'rejected', label: '已拒绝' },
];

function matchesFilter(job: JobWithState, filter: FilterKey): boolean {
  if (filter === 'all') return true;
  const status = job.application?.status;
  if (filter === 'untouched') return !status;
  if (filter === 'submitted') return status === 'submitted' || status === 'replied';
  if (filter === 'interview') return status === 'interview' || status === 'offer';
  return status === 'rejected';
}

function emptyManual() {
  return { title: '', company: '', salary: '', city: '', url: '', jdText: '' };
}

export function JobsPage({ bootstrap, refreshKey, navigate, refreshBootstrap, notify }: PageProps) {
  const [jobs, setJobs] = useState<JobWithState[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterKey>('all');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState<JobDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [tab, setTab] = useState<'analysis' | 'resume' | 'chat'>('analysis');
  const [busy, setBusy] = useState('');
  const [manualOpen, setManualOpen] = useState(false);
  const [manual, setManual] = useState(emptyManual());
  const [manualBusy, setManualBusy] = useState(false);

  const loadJobs = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      try {
        const response = await api.getJobs();
        setJobs(response.jobs);
      } catch (error) {
        notify('error', error instanceof Error ? error.message : '读取岗位失败');
      } finally {
        setLoading(false);
      }
    },
    [notify],
  );

  useEffect(() => {
    loadJobs();
  }, [loadJobs, refreshKey]);

  const loadDetail = useCallback(
    async (id: string, silent = false) => {
      if (!silent) setDetailLoading(true);
      try {
        const response = await api.getJob(id);
        setDetail(response);
      } catch (error) {
        notify('error', error instanceof Error ? error.message : '读取岗位详情失败');
      } finally {
        setDetailLoading(false);
      }
    },
    [notify],
  );

  useEffect(() => {
    if (!selected) return;
    setDetail(null);
    setTab('analysis');
    loadDetail(selected);
  }, [selected, loadDetail]);

  const filtered = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return jobs.filter((job) => {
      if (!matchesFilter(job, filter)) return false;
      if (!keyword) return true;
      return [job.title, job.company, job.city, ...(job.tags || [])]
        .join(' ')
        .toLowerCase()
        .includes(keyword);
    });
  }, [jobs, filter, query]);

  const counts = useMemo(() => {
    const result: Record<FilterKey, number> = {
      all: jobs.length,
      untouched: 0,
      submitted: 0,
      interview: 0,
      rejected: 0,
    };
    for (const job of jobs) {
      for (const key of FILTERS.map((item) => item.key)) {
        if (key !== 'all' && matchesFilter(job, key)) result[key] += 1;
      }
    }
    return result;
  }, [jobs]);

  async function runAction(name: string, action: () => Promise<void>) {
    setBusy(name);
    try {
      await action();
    } catch (error) {
      notify('error', error instanceof Error ? error.message : '操作失败');
    } finally {
      setBusy('');
    }
  }

  const handleAnalyze = (regenerate = false) =>
    selected &&
    runAction('analyze', async () => {
      await api.analyzeJob(selected, regenerate);
      await Promise.all([loadDetail(selected, true), loadJobs(true)]);
      notify('success', regenerate ? '已重新分析' : '分析完成');
    });

  const handleTailor = () =>
    selected &&
    runAction('tailor', async () => {
      await api.tailorResume(selected);
      await Promise.all([loadDetail(selected, true), loadJobs(true)]);
      setTab('resume');
      notify('success', '定制简历已生成');
    });

  const handleGreeting = (regenerate = false) =>
    selected &&
    runAction('greeting', async () => {
      await api.generateGreeting(selected, regenerate);
      await loadDetail(selected, true);
      notify('success', '招呼语已生成');
    });

  const handleMarkSubmitted = () =>
    selected &&
    detail?.greeting &&
    runAction('submit', async () => {
      await api.markSubmitted(selected, detail.greeting!.text, detail.resumes[0]?.id);
      await Promise.all([loadDetail(selected, true), loadJobs(true), refreshBootstrap()]);
      notify('success', '已标记为已投递');
    });

  const handleStatus = (status: ApplicationStatus) =>
    detail?.job.application &&
    runAction('status', async () => {
      await api.updateApplication(detail.job.application!.id, { status });
      await Promise.all([loadDetail(detail.job.id, true), loadJobs(true)]); 
      notify('success', `状态已更新为「${APPLICATION_STATUS_LABELS[status]}」`);
    });

  const handleRegenerateChat = () =>
    detail?.chat &&
    runAction('chat', async () => {
      await api.regenerateChat(detail.chat!.key);
      await loadDetail(detail.job.id, true);
      notify('success', '回复草稿已重新生成');
    });

  async function handleManualSubmit() {
    if (!manual.title.trim()) {
      notify('error', '请填写岗位名称');
      return;
    }
    if (manual.jdText.trim().length < 20) {
      notify('error', '请粘贴完整的岗位描述（至少 20 字）');
      return;
    }
    setManualBusy(true);
    try {
      const { job } = await api.captureJob(manual);
      setManualOpen(false);
      setManual(emptyManual());
      await loadJobs(true);
      setSelected(job.id);
      notify('success', '岗位已添加');
    } catch (error) {
      notify('error', error instanceof Error ? error.message : '添加岗位失败');
    } finally {
      setManualBusy(false);
    }
  }

  const hasLlm = bootstrap.llmConfigured;

  return (
    <div className="stack">
      <div className="toolbar">
        <div className="search-box">
          <Search size={16} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索岗位、公司或技能…"
          />
        </div>
        <div className="filter-chips">
          {FILTERS.map((item) => (
            <button
              key={item.key}
              className={`filter-chip ${filter === item.key ? 'active' : ''}`}
              onClick={() => setFilter(item.key)}
            >
              {item.label}
              <span>{counts[item.key]}</span>
            </button>
          ))}
        </div>
        <div className="toolbar-spacer" />
        <Button variant="secondary" icon={<Plus size={15} />} onClick={() => setManualOpen(true)}>
          手动添加
        </Button>
        <Button variant="ghost" icon={<RefreshCw size={15} />} onClick={() => loadJobs()}>
          刷新
        </Button>
      </div>

      {!hasLlm && (
        <div className="notice notice-warn">
          <Sparkles size={18} />
          <div>
            <b>未配置大模型</b>
            <p>可以采集和查看岗位，但无法分析、定制简历或生成招呼语。</p>
          </div>
          <Button size="sm" variant="secondary" onClick={() => navigate('settings')}>
            去设置
          </Button>
        </div>
      )}

      {loading ? (
        <Spinner label="正在读取岗位…" />
      ) : jobs.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={<BriefcaseBusiness size={26} />}
            title="还没有岗位"
            description="在 BOSS 直聘的职位详情页点击右下角「AI 求职」，采集岗位后会自动出现在这里。也可以手动添加一个岗位先体验流程。"
            action={
              <div className="inline-actions">
                <a
                  className="btn btn-primary btn-md"
                  href="https://www.zhipin.com/web/geek/jobs"
                  target="_blank"
                  rel="noreferrer"
                >
                  <ExternalLink size={15} />
                  去 BOSS 直聘
                </a>
                <Button variant="secondary" icon={<Plus size={15} />} onClick={() => setManualOpen(true)}>
                  手动添加岗位
                </Button>
              </div>
            }
          />
          <div className="install-hint">
            <b>扩展安装方式</b>
            <p>
              先运行 <code>npm run build:extension</code>，然后在 Chrome 打开{' '}
              <code>chrome://extensions</code>，开启开发者模式，选择「加载已解压的扩展程序」，指向{' '}
              <code>apps/extension/dist</code>。
            </p>
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={<Search size={24} />}
            title="没有符合条件的岗位"
            description="换个筛选条件或搜索词试试。"
            action={
              <Button variant="secondary" onClick={() => { setFilter('all'); setQuery(''); }}>
                清除筛选
              </Button>
            }
          />
        </div>
      ) : (
        <div className="job-table">
          <div className="job-table-head">
            <span>岗位 / 公司</span>
            <span>薪资 / 城市</span>
            <span>匹配</span>
            <span>状态</span>
            <span>采集</span>
            <span />
          </div>
          {filtered.map((job) => (
            <button className="job-row" key={job.id} onClick={() => setSelected(job.id)}>
              <div className="job-row-main">
                <div className="job-row-title">
                  {job.title}
                  {job.latestResume && (
                    <span className="mini-icon" title="已生成定制简历">
                      <FileText size={13} />
                    </span>
                  )}
                </div>
                <div className="job-row-company">
                  {job.company}
                  {job.hrName && <span> · {job.hrName}</span>}
                </div>
                {job.tags?.length ? (
                  <div className="job-row-tags">
                    {job.tags.slice(0, 3).map((tag) => (
                      <span key={tag}>{tag}</span>
                    ))}
                  </div>
                ) : null}
              </div>
              <div className="job-row-salary">
                <b>{job.salary || '面议'}</b>
                <span>{[job.city, job.area].filter(Boolean).join(' · ')}</span>
              </div>
              <div className="job-row-score">
                {job.analysis ? (
                  <>
                    <ScoreRing score={job.analysis.score} size={44} />
                    <span>{job.analysis.verdict}</span>
                  </>
                ) : (
                  <span className="muted">未分析</span>
                )}
              </div>
              <div className="job-row-status">
                {job.application ? (
                  <StatusPill status={job.application.status} />
                ) : (
                  <Badge tone="gray">未投递</Badge>
                )}
              </div>
              <div className="job-row-date">{formatDay(job.capturedAt)}</div>
              <ChevronRight size={17} className="job-row-arrow" />
            </button>
          ))}
        </div>
      )}

      <Drawer
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        title={detail?.job.title || '岗位详情'}
        subtitle={
          detail ? (
            <span>
              {[detail.job.company, detail.job.salary, detail.job.city, detail.job.experience]
                .filter(Boolean)
                .join(' · ')}
            </span>
          ) : (
            '加载中…'
          )
        }
        footer={
          <div className="drawer-footer-row">
            <Button
              variant="secondary"
              icon={<ExternalLink size={15} />}
              disabled={!detail?.job.url}
              onClick={() =>
                detail?.job.url && window.open(detail.job.url, '_blank', 'noopener,noreferrer')
              }
            >
              打开 BOSS 岗位
            </Button>
            <Button variant="ghost" onClick={() => setSelected(null)}>
              关闭
            </Button>
          </div>
        }
      >
        {detailLoading || !detail ? (
          <Spinner label="正在读取岗位详情…" />
        ) : (
          <div className="detail-stack">
            <div className="detail-meta">
              <div className="detail-meta-tags">
                {detail.job.salary && <Badge tone="blue">{detail.job.salary}</Badge>}
                {detail.job.city && <Badge>{detail.job.city}</Badge>}
                {detail.job.experience && <Badge>{detail.job.experience}</Badge>}
                {detail.job.education && <Badge>{detail.job.education}</Badge>}
                {(detail.job.tags || []).slice(0, 6).map((tag) => (
                  <Badge key={tag} tone="gray">
                    {tag}
                  </Badge>
                ))}
              </div>
              {detail.job.url && (
                <a className="subtle-link" href={detail.job.url} target="_blank" rel="noreferrer">
                  原岗位链接 <ExternalLink size={12} />
                </a>
              )}
            </div>

            <div className="application-strip">
              <div className="application-strip-left">
                <span className="muted">投递状态</span>
                {detail.job.application ? (
                  <StatusPill status={detail.job.application.status} />
                ) : (
                  <Badge tone="gray">未投递</Badge>
                )}
              </div>
              {detail.job.application ? (
                <select
                  className="select select-sm"
                  value={detail.job.application.status}
                  onChange={(event) => handleStatus(event.target.value as ApplicationStatus)}
                  disabled={busy === 'status'}
                >
                  {Object.entries(APPLICATION_STATUS_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              ) : detail.greeting ? (
                <Button
                  size="sm"
                  variant="soft"
                  icon={<Send size={14} />}
                  loading={busy === 'submit'}
                  onClick={handleMarkSubmitted}
                >
                  手动标记已投递
                </Button>
              ) : (
                <span className="muted">生成招呼语后可标记投递</span>
              )}
            </div>

            {detail.job.application && (
              <details className="timeline-details">
                <summary>投递时间线</summary>
                <div className="timeline">
                  {detail.job.application.timeline.map((event, index) => (
                    <div className="timeline-item" key={index}>
                      <span className="timeline-dot" />
                      <div>
                        <b>{APPLICATION_STATUS_LABELS[event.status]}</b>
                        <span>{formatDate(event.at)}</span>
                        {event.note && <p>{event.note}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </details>
            )}

            <div className="tabs">
              <button className={tab === 'analysis' ? 'active' : ''} onClick={() => setTab('analysis')}>
                岗位分析
              </button>
              <button className={tab === 'resume' ? 'active' : ''} onClick={() => setTab('resume')}>
                定制简历 {detail.resumes.length ? `(${detail.resumes.length})` : ''}
              </button>
              <button className={tab === 'chat' ? 'active' : ''} onClick={() => setTab('chat')}>
                沟通草稿
              </button>
            </div>

            {tab === 'analysis' && (
              <div className="tab-body">
                {detail.job.analysis ? (
                  <>
                    <div className="analysis-hero">
                      <ScoreRing score={detail.job.analysis.score} size={90} />
                      <div>
                        <div className="analysis-verdict">
                          <VerdictBadge verdict={detail.job.analysis.verdict} />
                          <span className="muted">{formatDate(detail.job.analysis.createdAt)}</span>
                        </div>
                        <p>{detail.job.analysis.summary || '暂无总体评价'}</p>
                      </div>
                    </div>

                    {detail.job.analysis.reasons.length > 0 && (
                      <div className="analysis-block">
                        <h4>判断依据</h4>
                        <ul className="dot-list">
                          {detail.job.analysis.reasons.map((reason) => (
                            <li key={reason}>{reason}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <div className="analysis-columns">
                      <div className="mini-panel success">
                        <h4>匹配点</h4>
                        {(detail.job.analysis.matched || []).length ? (
                          <ul className="dot-list">
                            {detail.job.analysis.matched.map((item) => (
                              <li key={item}>{item}</li>
                            ))}
                          </ul>
                        ) : (
                          <p className="muted">无</p>
                        )}
                      </div>
                      <div className="mini-panel warning">
                        <h4>缺口</h4>
                        {(detail.job.analysis.gaps || []).length ? (
                          <ul className="dot-list">
                            {detail.job.analysis.gaps.map((item) => (
                              <li key={item}>{item}</li>
                            ))}
                          </ul>
                        ) : (
                          <p className="muted">无</p>
                        )}
                      </div>
                    </div>

                    {detail.job.analysis.risks.length > 0 && (
                      <div className="notice notice-warn compact">
                        <TriangleAlert size={17} />
                        <div>
                          <b>风险提示</b>
                          <ul className="dot-list">
                            {detail.job.analysis.risks.map((risk) => (
                              <li key={risk}>{risk}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    )}

                    {detail.job.analysis.keywords.length > 0 && (
                      <div className="analysis-block">
                        <h4>关键词</h4>
                        <div className="keyword-list">
                          {detail.job.analysis.keywords.map((keyword) => (
                            <span key={keyword}>{keyword}</span>
                          ))}
                        </div>
                      </div>
                    )}

                    {detail.job.analysis.suggestedAngle && (
                      <div className="callout">
                        <b>投递切入角度</b>
                        <p>{detail.job.analysis.suggestedAngle}</p>
                      </div>
                    )}

                    {detail.job.analysis.salaryComment && (
                      <div className="analysis-block">
                        <h4>薪资判断</h4>
                        <p className="muted">{detail.job.analysis.salaryComment}</p>
                      </div>
                    )}

                    {detail.job.analysis.questionsToAsk.length > 0 && (
                      <div className="analysis-block">
                        <h4>建议向 HR 确认</h4>
                        <ul className="dot-list">
                          {detail.job.analysis.questionsToAsk.map((question) => (
                            <li key={question}>{question}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <div className="section-actions">
                      <Button
                        variant="secondary"
                        size="sm"
                        icon={<RefreshCw size={14} />}
                        loading={busy === 'analyze'}
                        disabled={!hasLlm}
                        onClick={() => handleAnalyze(true)}
                      >
                        重新分析
                      </Button>
                    </div>
                  </>
                ) : (
                  <EmptyState
                    icon={<Sparkles size={22} />}
                    title="还没有分析"
                    description={
                      hasLlm
                        ? '让 AI 对照你的档案评估匹配度、缺口与风险。'
                        : '需要先在设置中配置大模型。'
                    }
                    action={
                      <div className="inline-actions">
                        <Button
                          icon={<Sparkles size={15} />}
                          loading={busy === 'analyze'}
                          disabled={!hasLlm}
                          onClick={() => handleAnalyze(false)}
                        >
                          AI 分析岗位
                        </Button>
                        {!hasLlm && (
                          <Button variant="ghost" onClick={() => navigate('settings')}>
                            去设置
                          </Button>
                        )}
                      </div>
                    }
                  />
                )}
              </div>
            )}

            {tab === 'resume' && (
              <div className="tab-body">
                {detail.resumes.length ? (
                  <>
                    {detail.resumes.map((resume, index) => (
                      <div className="resume-card" key={resume.id}>
                        <div className="resume-card-head">
                          <div>
                            <b>{index === 0 ? '最新定制简历' : '历史版本'}</b>
                            <span className="muted">{formatDate(resume.createdAt)}</span>
                          </div>
                          <div className="inline-actions">
                            {resume.hasPdf ? (
                              <>
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  icon={<Eye size={14} />}
                                  onClick={() => window.open(assetUrl(resume.pdfUrl || ''), '_blank', 'noopener')}
                                >
                                  预览 PDF
                                </Button>
                                <a
                                  className="btn btn-ghost btn-sm"
                                  href={assetUrl(resume.pdfUrl || '', true)}
                                >
                                  <Download size={14} /> 下载
                                </a>
                              </>
                            ) : (
                              <Badge tone="amber">PDF 未生成</Badge>
                            )}
                            <a className="btn btn-ghost btn-sm" href={assetUrl(resume.htmlUrl || '')} target="_blank" rel="noreferrer">
                              查看 HTML
                            </a>
                          </div>
                        </div>

                        <div className="resume-preview">
                          <div className="resume-preview-head">
                            <b>{resume.doc.headline || detail.job.title}</b>
                            <span>{resume.doc.jobIntention}</span>
                          </div>
                          <p>{resume.doc.summary}</p>
                          {resume.doc.experience.slice(0, 2).map((entry) => (
                            <div className="resume-preview-item" key={`${entry.company}-${entry.title}`}>
                              <b>{entry.company}</b>
                              <span>{entry.title}</span>
                              <ul>
                                {entry.bullets.slice(0, 2).map((bullet) => (
                                  <li key={bullet}>{bullet}</li>
                                ))}
                              </ul>
                            </div>
                          ))}
                        </div>

                        {resume.changeNotes.length > 0 && (
                          <div className="change-notes">
                            <h4>本次调整</h4>
                            <ul className="dot-list">
                              {resume.changeNotes.map((note) => (
                                <li key={note}>{note}</li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {(resume.matchedKeywords.length > 0 || resume.missingKeywords.length > 0) && (
                          <div className="keyword-groups">
                            {resume.matchedKeywords.length > 0 && (
                              <div>
                                <span className="muted">已覆盖</span>
                                <div className="keyword-list success">
                                  {resume.matchedKeywords.slice(0, 12).map((keyword) => (
                                    <span key={keyword}>{keyword}</span>
                                  ))}
                                </div>
                              </div>
                            )}
                            {resume.missingKeywords.length > 0 && (
                              <div>
                                <span className="muted">仍缺口</span>
                                <div className="keyword-list warning">
                                  {resume.missingKeywords.slice(0, 12).map((keyword) => (
                                    <span key={keyword}>{keyword}</span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}

                    <div className="notice notice-info compact">
                      <FileText size={17} />
                      <div>
                        <b>如何在 BOSS 发送定制简历</b>
                        <p>
                          下载 PDF 后，在 BOSS 聊天窗口点击「+」选择发送文件，手动选择这份 PDF。平台不允许网页脚本直接设置本地附件时，扩展会提示你手动完成。
                        </p>
                      </div>
                    </div>

                    <div className="section-actions">
                      <Button
                        variant="secondary"
                        size="sm"
                        icon={<RefreshCw size={14} />}
                        loading={busy === 'tailor'}
                        disabled={!hasLlm}
                        onClick={handleTailor}
                      >
                        按当前岗位重新生成
                      </Button>
                    </div>
                  </>
                ) : (
                  <EmptyState
                    icon={<FileText size={22} />}
                    title="还没有定制简历"
                    description={
                      hasLlm
                        ? 'AI 会从档案中挑选最相关的经历，按岗位改写措辞并生成 PDF；不会新增不存在的事实。'
                        : '需要先在设置中配置大模型。'
                    }
                    action={
                      <Button
                        icon={<Sparkles size={15} />}
                        loading={busy === 'tailor'}
                        disabled={!hasLlm}
                        onClick={handleTailor}
                      >
                        生成定制简历
                      </Button>
                    }
                  />
                )}
              </div>
            )}

            {tab === 'chat' && (
              <div className="tab-body">
                {detail.chat ? (
                  <>
                    <div className="chat-summary">
                      <div>
                        <Badge tone="violet">{detail.chat.intent}</Badge>
                        <Badge>{detail.chat.sentiment}</Badge>
                        <span className="muted">{formatDate(detail.chat.updatedAt)}</span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={<RefreshCw size={14} />}
                        loading={busy === 'chat'}
                        onClick={handleRegenerateChat}
                      >
                        重新生成
                      </Button>
                    </div>

                    <div className="message-list">
                      {detail.chat.messages.slice(-8).map((message, index) => (
                        <div className={`message-bubble ${message.role}`} key={index}>
                          <span>{message.role === 'hr' ? detail.chat?.hrName || 'HR' : '我'}</span>
                          <p>{message.text}</p>
                        </div>
                      ))}
                    </div>

                    <div className="reply-box">
                      <div className="reply-box-head">
                        <b>
                          <Bot size={15} /> 建议回复
                        </b>
                        <CopyButton text={detail.chat.reply} />
                      </div>
                      <p>{detail.chat.reply}</p>
                    </div>

                    {detail.chat.riskFlags.length > 0 && (
                      <div className="notice notice-warn compact">
                        <TriangleAlert size={17} />
                        <div>
                          <b>注意</b>
                          <ul className="dot-list">
                            {detail.chat.riskFlags.map((flag) => (
                              <li key={flag}>{flag}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    )}

                    {detail.chat.nextAction && (
                      <p className="next-action">下一步：{detail.chat.nextAction}</p>
                    )}
                    <p className="field-hint">
                      草稿只保存在本机，不会自动发送。请在 BOSS 聊天页使用扩展面板确认后发送。
                    </p>
                  </>
                ) : (
                  <EmptyState
                    icon={<MessageSquareText size={22} />}
                    title="还没有对话草稿"
                    description="在 BOSS 聊天页打开扩展面板，扩展检测到 HR 新消息后会自动生成回复草稿。"
                  />
                )}
              </div>
            )}

            <details className="jd-details">
              <summary>查看岗位描述</summary>
              <div className="jd-text">{detail.job.jdText}</div>
              {detail.job.companyInfo && (
                <>
                  <h4>公司信息</h4>
                  <div className="jd-text">{detail.job.companyInfo}</div>
                </>
              )}
            </details>

            <div className="greeting-block">
              <div className="greeting-head">
                <div>
                  <h4>打招呼消息</h4>
                  <span className="muted">发送前请在扩展面板确认内容</span>
                </div>
                {detail.greeting && (
                  <div className="inline-actions">
                    <CopyButton text={detail.greeting.text} label="复制招呼语" />
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={<RefreshCw size={13} />}
                      loading={busy === 'greeting'}
                      disabled={!hasLlm}
                      onClick={() => handleGreeting(true)}
                    >
                      重新生成
                    </Button>
                  </div>
                )}
              </div>
              {detail.greeting ? (
                <blockquote>{detail.greeting.text}</blockquote>
              ) : (
                <div className="greeting-empty">
                  <p className="muted">还没有生成招呼语。</p>
                  <Button
                    size="sm"
                    variant="secondary"
                    icon={<Sparkles size={14} />}
                    loading={busy === 'greeting'}
                    disabled={!hasLlm}
                    onClick={() => handleGreeting(false)}
                  >
                    生成招呼语
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}
      </Drawer>

      <Drawer
        open={manualOpen}
        onClose={() => setManualOpen(false)}
        title="手动添加岗位"
        subtitle="扩展无法读取页面时，可以复制 JD 到这里，后续分析和简历流程完全一样。"
        footer={
          <div className="drawer-footer-row">
            <Button variant="ghost" onClick={() => setManualOpen(false)}>
              取消
            </Button>
            <Button loading={manualBusy} onClick={handleManualSubmit}>
              添加岗位
            </Button>
          </div>
        }
      >
        <div className="form-grid form-grid-2">
          <Field label="岗位名称" required>
            <input
              className="input"
              value={manual.title}
              onChange={(event) => setManual({ ...manual, title: event.target.value })}
              placeholder="高级前端工程师"
            />
          </Field>
          <Field label="公司">
            <input
              className="input"
              value={manual.company}
              onChange={(event) => setManual({ ...manual, company: event.target.value })}
            />
          </Field>
          <Field label="薪资">
            <input
              className="input"
              value={manual.salary}
              onChange={(event) => setManual({ ...manual, salary: event.target.value })}
              placeholder="25-35K"
            />
          </Field>
          <Field label="城市">
            <input
              className="input"
              value={manual.city}
              onChange={(event) => setManual({ ...manual, city: event.target.value })}
              placeholder="上海"
            />
          </Field>
        </div>
        <Field label="岗位链接">
          <input
            className="input"
            value={manual.url}
            onChange={(event) => setManual({ ...manual, url: event.target.value })}
            placeholder="https://www.zhipin.com/job_detail/..."
          />
        </Field>
        <Field label="岗位描述" required hint="把 BOSS 页面上的职位详情完整复制过来。">
          <textarea
            className="textarea"
            rows={12}
            value={manual.jdText}
            onChange={(event) => setManual({ ...manual, jdText: event.target.value })}
            placeholder="职位描述、任职要求、团队介绍…"
          />
        </Field>
      </Drawer>
    </div>
  );
}
