import { useEffect, useRef, useState } from 'react';
import {
  Award,
  BriefcaseBusiness,
  FileText,
  FolderKanban,
  GraduationCap,
  Plus,
  Save,
  Sparkles,
  Trash2,
  UploadCloud,
  UserRound,
  Wand2,
} from 'lucide-react';
import {
  EMPTY_PROFILE,
  type EducationItem,
  type ExperienceItem,
  type Profile,
  type ProjectItem,
} from '../../../../src/shared/types';
import { api } from '../api';
import type { PageProps } from '../page-types';
import { Button, Card, ChipsInput, Field, Spinner } from '../ui';

function newExperience(): ExperienceItem {
  return {
    company: '',
    title: '',
    start: '',
    end: '',
    city: '',
    description: '',
    achievements: [],
    tech: [],
  };
}

function newProject(): ProjectItem {
  return {
    name: '',
    role: '',
    start: '',
    end: '',
    description: '',
    achievements: [],
    tech: [],
  };
}

function newEducation(): EducationItem {
  return { school: '', degree: '', major: '', start: '', end: '', highlights: [] };
}

function LinedTextarea({
  value,
  onChange,
  placeholder,
  rows = 4,
}: {
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <textarea
      className="textarea"
      rows={rows}
      value={value.join('\n')}
      placeholder={placeholder}
      onChange={(event) => onChange(event.target.value.split('\n'))}
    />
  );
}

export function ProfilePage({ bootstrap, refreshKey, refreshBootstrap, notify }: PageProps) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [rawText, setRawText] = useState('');
  const [fileName, setFileName] = useState('');
  const [importing, setImporting] = useState(false);
  const [parsing, setParsing] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    api
      .getProfile()
      .then(({ profile: loaded }) => {
        if (!alive) return;
        setProfile({ ...structuredClone(EMPTY_PROFILE), ...loaded });
        setDirty(false);
      })
      .catch((error: Error) => notify('error', error.message))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [refreshKey, notify]);

  function change(updater: (draft: Profile) => void) {
    setProfile((current) => {
      if (!current) return current;
      const next = structuredClone(current);
      updater(next);
      return next;
    });
    setDirty(true);
  }

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setImporting(true);
    try {
      const result = await api.uploadResume(file);
      setRawText(result.text);
      setFileName(result.fileName);
      notify('success', '已提取简历文本，请核对后再让 AI 解析');
    } catch (error) {
      notify('error', error instanceof Error ? error.message : '文件导入失败');
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function handleParse() {
    if (!bootstrap.llmConfigured) {
      notify('error', '请先到「设置」配置大模型 API Key');
      return;
    }
    if (rawText.trim().length < 30) {
      notify('error', '请先粘贴或导入至少 30 个字符的简历文本');
      return;
    }
    setParsing(true);
    try {
      const { profile: parsed } = await api.parseResume(rawText);
      setProfile(parsed);
      setDirty(true);
      notify('success', '解析完成。请逐项核对，确认无误后保存');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error) {
      notify('error', error instanceof Error ? error.message : '解析失败');
    } finally {
      setParsing(false);
    }
  }

  async function handleSave() {
    if (!profile) return;
    if (!profile.basics.name.trim()) {
      notify('error', '请先填写姓名');
      return;
    }
    setSaving(true);
    try {
      const result = await api.saveProfile(profile);
      setProfile(result.profile);
      setDirty(false);
      await refreshBootstrap();
      notify('success', '资料已保存，简历定制会以这份档案为准');
    } catch (error) {
      notify('error', error instanceof Error ? error.message : '保存失败');
    } finally {
      setSaving(false);
    }
  }

  if (loading || !profile) return <Spinner label="正在读取你的档案…" />;

  return (
    <div className="stack">
      <Card
        title={
          <span className="title-with-icon">
            <Wand2 size={18} /> 从已有简历导入
          </span>
        }
        subtitle="上传 PDF / DOCX / TXT，AI 只抽取原文信息，不编造。解析后请逐项核对。"
      >
        <div className="import-grid">
          <label
            className={`dropzone ${importing ? 'busy' : ''}`}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              handleFile(event.dataTransfer.files?.[0]);
            }}
          >
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.docx,.doc,.txt,.md"
              hidden
              onChange={(event) => handleFile(event.target.files?.[0])}
            />
            <UploadCloud size={28} />
            <b>{importing ? '正在提取文本…' : '点击选择或拖入简历文件'}</b>
            <span>支持 PDF、DOCX、TXT，最大 15MB</span>
            {fileName && <em>{fileName}</em>}
          </label>

          <div className="import-text">
            <Field label="简历原文" hint="也可以直接把简历内容粘贴到这里，再点击「AI 解析」。">
              <textarea
                className="textarea"
                rows={8}
                value={rawText}
                onChange={(event) => setRawText(event.target.value)}
                placeholder="粘贴简历全文，包含工作经历、项目、教育背景等…"
              />
            </Field>
            <div className="inline-actions">
              <Button
                icon={<Sparkles size={15} />}
                onClick={handleParse}
                loading={parsing}
                disabled={rawText.trim().length < 30}
              >
                AI 解析成结构化资料
              </Button>
              {rawText && (
                <Button
                  variant="ghost"
                  onClick={() => {
                    setRawText('');
                    setFileName('');
                  }}
                >
                  清空
                </Button>
              )}
            </div>
            {!bootstrap.llmConfigured && (
              <p className="field-hint warn">尚未配置大模型，导入后暂时无法 AI 解析。</p>
            )}
          </div>
        </div>
      </Card>

      <Card
        title={
          <span className="title-with-icon">
            <UserRound size={18} /> 基本信息
          </span>
        }
        subtitle="简历页眉和招呼语会用到这些信息"
        actions={
          <Button size="sm" loading={saving} icon={<Save size={14} />} onClick={handleSave}>
            保存资料
          </Button>
        }
      >
        <div className="form-grid form-grid-3">
          <Field label="姓名" required>
            <input
              className="input"
              value={profile.basics.name}
              onChange={(event) => change((draft) => (draft.basics.name = event.target.value))}
              placeholder="张三"
            />
          </Field>
          <Field label="手机">
            <input
              className="input"
              value={profile.basics.phone}
              onChange={(event) => change((draft) => (draft.basics.phone = event.target.value))}
              placeholder="13800000000"
            />
          </Field>
          <Field label="邮箱">
            <input
              className="input"
              value={profile.basics.email}
              onChange={(event) => change((draft) => (draft.basics.email = event.target.value))}
              placeholder="you@example.com"
            />
          </Field>
          <Field label="现居城市">
            <input
              className="input"
              value={profile.basics.city}
              onChange={(event) => change((draft) => (draft.basics.city = event.target.value))}
              placeholder="上海"
            />
          </Field>
          <Field label="工作年限">
            <input
              className="input"
              value={profile.basics.workYears}
              onChange={(event) => change((draft) => (draft.basics.workYears = event.target.value))}
              placeholder="5年"
            />
          </Field>
          <Field label="当前状态">
            <input
              className="input"
              value={profile.basics.currentStatus}
              onChange={(event) => change((draft) => (draft.basics.currentStatus = event.target.value))}
              placeholder="在职 / 离职 / 应届"
            />
          </Field>
          <Field label="微信" hint="仅保存在本机档案中，不会自动写入简历页眉。">
            <input
              className="input"
              value={profile.basics.wechat || ''}
              onChange={(event) => change((draft) => (draft.basics.wechat = event.target.value))}
              placeholder="选填"
            />
          </Field>
          <Field label="GitHub">
            <input
              className="input"
              value={profile.basics.github || ''}
              onChange={(event) => change((draft) => (draft.basics.github = event.target.value))}
              placeholder="github.com/yourname"
            />
          </Field>
          <Field label="个人网站 / 作品集">
            <input
              className="input"
              value={profile.basics.portfolio || ''}
              onChange={(event) => change((draft) => (draft.basics.portfolio = event.target.value))}
              placeholder="选填"
            />
          </Field>
        </div>
        <Field label="个人定位" hint="一句话说明你的方向和优势，会作为简历标题下的副标题。">
          <input
            className="input"
            value={profile.headline}
            onChange={(event) => change((draft) => (draft.headline = event.target.value))}
            placeholder="5 年前端工程师 · 数据产品与性能优化"
          />
        </Field>
      </Card>

      <Card
        title={
          <span className="title-with-icon">
            <BriefcaseBusiness size={18} /> 求职意向
          </span>
        }
        subtitle="AI 分析匹配度、生成招呼语时会参考"
      >
        <div className="form-grid form-grid-2">
          <Field label="期望职位">
            <ChipsInput
              value={profile.expectations.roles}
              onChange={(value) => change((draft) => (draft.expectations.roles = value))}
              placeholder="如：前端工程师、全栈工程师"
            />
          </Field>
          <Field label="期望城市">
            <ChipsInput
              value={profile.expectations.cities}
              onChange={(value) => change((draft) => (draft.expectations.cities = value))}
              placeholder="如：上海、杭州、远程"
            />
          </Field>
          <Field label="期望薪资">
            <input
              className="input"
              value={profile.expectations.salary}
              onChange={(event) => change((draft) => (draft.expectations.salary = event.target.value))}
              placeholder="25-35K"
            />
          </Field>
          <Field label="工作性质">
            <select
              className="select"
              value={profile.expectations.jobType}
              onChange={(event) => change((draft) => (draft.expectations.jobType = event.target.value))}
            >
              <option value="全职">全职</option>
              <option value="兼职">兼职</option>
              <option value="实习">实习</option>
              <option value="合同制">合同制</option>
            </select>
          </Field>
          <Field label="期望行业">
            <ChipsInput
              value={profile.expectations.industries}
              onChange={(value) => change((draft) => (draft.expectations.industries = value))}
              placeholder="如：SaaS、电商、AI"
            />
          </Field>
          <Field label="到岗时间 / 面试可用时间" hint="HR 问时间安排时，AI 只会引用这里已有的信息。">
            <input
              className="input"
              value={profile.expectations.availability}
              onChange={(event) => change((draft) => (draft.expectations.availability = event.target.value))}
              placeholder="两周内到岗；工作日晚上可面试"
            />
          </Field>
        </div>
        <Field label="个人简介" hint={`${profile.summary.length} 字。写清楚经验年限、擅长领域和代表成果，不要空泛。`}>
          <textarea
            className="textarea"
            rows={4}
            value={profile.summary}
            onChange={(event) => change((draft) => (draft.summary = event.target.value))}
            placeholder="5 年前端开发经验，主要做 B 端数据产品…"
          />
        </Field>
        <Field label="专业技能">
          <ChipsInput
            value={profile.skills}
            onChange={(value) => change((draft) => (draft.skills = value))}
            placeholder="如：TypeScript、React、Node.js"
            tone="green"
          />
        </Field>
      </Card>

      <Card
        title={
          <span className="title-with-icon">
            <BriefcaseBusiness size={18} /> 工作经历
          </span>
        }
        subtitle="按时间倒序。AI 只会改写和挑选这里的事实。"
        actions={
          <Button
            variant="secondary"
            size="sm"
            icon={<Plus size={14} />}
            onClick={() => change((draft) => draft.experience.push(newExperience()))}
          >
            添加经历
          </Button>
        }
      >
        {profile.experience.length ? (
          <div className="entry-list">
            {profile.experience.map((entry, index) => (
              <div className="entry-card" key={index}>
                <div className="entry-card-head">
                  <b>经历 {index + 1}</b>
                  <button
                    className="icon-btn danger"
                    aria-label="删除这段经历"
                    onClick={() =>
                      change((draft) => {
                        draft.experience.splice(index, 1);
                      })
                    }
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
                <div className="form-grid form-grid-3">
                  <Field label="公司" required>
                    <input
                      className="input"
                      value={entry.company}
                      onChange={(event) =>
                        change((draft) => (draft.experience[index].company = event.target.value))
                      }
                    />
                  </Field>
                  <Field label="职位" required>
                    <input
                      className="input"
                      value={entry.title}
                      onChange={(event) =>
                        change((draft) => (draft.experience[index].title = event.target.value))
                      }
                    />
                  </Field>
                  <Field label="城市">
                    <input
                      className="input"
                      value={entry.city || ''}
                      onChange={(event) =>
                        change((draft) => (draft.experience[index].city = event.target.value))
                      }
                    />
                  </Field>
                  <Field label="开始时间">
                    <input
                      className="input"
                      value={entry.start}
                      onChange={(event) =>
                        change((draft) => (draft.experience[index].start = event.target.value))
                      }
                      placeholder="2021-03"
                    />
                  </Field>
                  <Field label="结束时间">
                    <input
                      className="input"
                      value={entry.end}
                      onChange={(event) =>
                        change((draft) => (draft.experience[index].end = event.target.value))
                      }
                      placeholder="至今"
                    />
                  </Field>
                  <Field label="技术 / 工具">
                    <ChipsInput
                      value={entry.tech || []}
                      onChange={(value) => change((draft) => (draft.experience[index].tech = value))}
                      placeholder="React、Node.js"
                    />
                  </Field>
                </div>
                <Field label="职责概述">
                  <textarea
                    className="textarea"
                    rows={2}
                    value={entry.description || ''}
                    onChange={(event) =>
                      change((draft) => (draft.experience[index].description = event.target.value))
                    }
                    placeholder="一句话说明负责的业务和范围"
                  />
                </Field>
                <Field
                  label="主要业绩 / 工作内容"
                  hint="每行一条。数字、百分比必须真实；没有量化结果就写定性结果。"
                >
                  <LinedTextarea
                    value={entry.achievements}
                    onChange={(value) => change((draft) => (draft.experience[index].achievements = value))}
                    placeholder={'主导数据看板重构，页面加载时间从 4s 降到 1.5s\n搭建组件库，覆盖 12 个业务线'}
                    rows={5}
                  />
                </Field>
              </div>
            ))}
          </div>
        ) : (
          <div className="inline-empty">还没有工作经历，点击右上角添加。</div>
        )}
      </Card>

      <Card
        title={
          <span className="title-with-icon">
            <FolderKanban size={18} /> 项目经历
          </span>
        }
        actions={
          <Button
            variant="secondary"
            size="sm"
            icon={<Plus size={14} />}
            onClick={() => change((draft) => draft.projects.push(newProject()))}
          >
            添加项目
          </Button>
        }
      >
        {profile.projects.length ? (
          <div className="entry-list">
            {profile.projects.map((entry, index) => (
              <div className="entry-card" key={index}>
                <div className="entry-card-head">
                  <b>项目 {index + 1}</b>
                  <button
                    className="icon-btn danger"
                    aria-label="删除这个项目"
                    onClick={() =>
                      change((draft) => {
                        draft.projects.splice(index, 1);
                      })
                    }
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
                <div className="form-grid form-grid-3">
                  <Field label="项目名称" required>
                    <input
                      className="input"
                      value={entry.name}
                      onChange={(event) =>
                        change((draft) => (draft.projects[index].name = event.target.value))
                      }
                    />
                  </Field>
                  <Field label="担任角色">
                    <input
                      className="input"
                      value={entry.role || ''}
                      onChange={(event) =>
                        change((draft) => (draft.projects[index].role = event.target.value))
                      }
                    />
                  </Field>
                  <Field label="技术栈">
                    <ChipsInput
                      value={entry.tech}
                      onChange={(value) => change((draft) => (draft.projects[index].tech = value))}
                      placeholder="React、ECharts"
                    />
                  </Field>
                  <Field label="开始时间">
                    <input
                      className="input"
                      value={entry.start || ''}
                      onChange={(event) =>
                        change((draft) => (draft.projects[index].start = event.target.value))
                      }
                    />
                  </Field>
                  <Field label="结束时间">
                    <input
                      className="input"
                      value={entry.end || ''}
                      onChange={(event) =>
                        change((draft) => (draft.projects[index].end = event.target.value))
                      }
                    />
                  </Field>
                </div>
                <Field label="项目描述">
                  <textarea
                    className="textarea"
                    rows={2}
                    value={entry.description || ''}
                    onChange={(event) =>
                      change((draft) => (draft.projects[index].description = event.target.value))
                    }
                    placeholder="项目解决了什么问题，你的职责是什么"
                  />
                </Field>
                <Field label="项目亮点">
                  <LinedTextarea
                    value={entry.achievements}
                    onChange={(value) => change((draft) => (draft.projects[index].achievements = value))}
                    rows={4}
                  />
                </Field>
              </div>
            ))}
          </div>
        ) : (
          <div className="inline-empty">还没有项目，点击右上角添加。</div>
        )}
      </Card>

      <Card
        title={
          <span className="title-with-icon">
            <GraduationCap size={18} /> 教育背景
          </span>
        }
        actions={
          <Button
            variant="secondary"
            size="sm"
            icon={<Plus size={14} />}
            onClick={() => change((draft) => draft.education.push(newEducation()))}
          >
            添加学历
          </Button>
        }
      >
        {profile.education.length ? (
          <div className="entry-list">
            {profile.education.map((entry, index) => (
              <div className="entry-card" key={index}>
                <div className="entry-card-head">
                  <b>教育经历 {index + 1}</b>
                  <button
                    className="icon-btn danger"
                    aria-label="删除这段教育经历"
                    onClick={() =>
                      change((draft) => {
                        draft.education.splice(index, 1);
                      })
                    }
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
                <div className="form-grid form-grid-3">
                  <Field label="学校" required>
                    <input
                      className="input"
                      value={entry.school}
                      onChange={(event) =>
                        change((draft) => (draft.education[index].school = event.target.value))
                      }
                    />
                  </Field>
                  <Field label="专业">
                    <input
                      className="input"
                      value={entry.major}
                      onChange={(event) =>
                        change((draft) => (draft.education[index].major = event.target.value))
                      }
                    />
                  </Field>
                  <Field label="学历">
                    <input
                      className="input"
                      value={entry.degree}
                      onChange={(event) =>
                        change((draft) => (draft.education[index].degree = event.target.value))
                      }
                      placeholder="本科 / 硕士"
                    />
                  </Field>
                  <Field label="开始时间">
                    <input
                      className="input"
                      value={entry.start}
                      onChange={(event) =>
                        change((draft) => (draft.education[index].start = event.target.value))
                      }
                      placeholder="2014-09"
                    />
                  </Field>
                  <Field label="结束时间">
                    <input
                      className="input"
                      value={entry.end}
                      onChange={(event) =>
                        change((draft) => (draft.education[index].end = event.target.value))
                      }
                      placeholder="2018-06"
                    />
                  </Field>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="inline-empty">还没有教育经历，点击右上角添加。</div>
        )}
      </Card>

      <Card
        title={
          <span className="title-with-icon">
            <Award size={18} /> 证书与其他
          </span>
        }
      >
        <Field label="证书 / 资质">
          <ChipsInput
            value={profile.certificates}
            onChange={(value) => change((draft) => (draft.certificates = value))}
            placeholder="如：CET-6、PMP"
          />
        </Field>
        <Field label="其他补充" hint="可以写语言能力、荣誉、开源项目等；不要写无法核实的内容。">
          <textarea
            className="textarea"
            rows={3}
            value={profile.extras}
            onChange={(event) => change((draft) => (draft.extras = event.target.value))}
          />
        </Field>
      </Card>

      {dirty && (
        <div className="profile-save-row">
          <div>
            <b>有未保存的修改</b>
            <span className="muted">
              {profile.experience.length} 段工作经历 · {profile.projects.length} 个项目 ·{' '}
              {profile.skills.length} 项技能
            </span>
          </div>
          <Button loading={saving} icon={<Save size={15} />} onClick={handleSave}>
            保存资料
          </Button>
        </div>
      )}

      {!bootstrap.profileReady && (
        <div className="notice notice-info">
          <FileText size={18} />
          <div>
            <b>资料还不完整</b>
            <p>填写姓名，并至少添加一段工作或项目经历后，才能生成简历。</p>
          </div>
        </div>
      )}
    </div>
  );
}
