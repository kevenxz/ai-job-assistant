import {
  EMPTY_PROFILE,
  type ChatMessage,
  type JobAnalysis,
  type Profile,
  type ResumeDoc,
  type Verdict,
} from '../../../src/shared/types';
import { HttpError } from './errors';

type Rec = Record<string, unknown>;

export function isRecord(value: unknown): value is Rec {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function pick(obj: Rec, keys: string[]): unknown {
  for (const key of keys) {
    if (obj[key] !== undefined && obj[key] !== null) return obj[key];
  }
  return undefined;
}

function asRecord(value: unknown): Rec {
  return isRecord(value) ? value : {};
}

function asString(value: unknown, max = 2000): string {
  if (typeof value === 'string') return value.trim().slice(0, max);
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return '';
}

function asStringArray(value: unknown, maxItems = 20, maxLen = 300): string[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (typeof item === 'string') return item.trim();
        if (isRecord(item)) return asString(pick(item, ['name', 'title', 'label', 'text', 'value']), maxLen);
        return asString(item, maxLen);
      })
      .filter(Boolean)
      .slice(0, maxItems);
  }
  if (typeof value === 'string') {
    return value
      .split(/\n|、|,|，|;|；/)
      .map((item) => item.replace(/^[-*•\d.、\s]+/, '').trim())
      .filter(Boolean)
      .slice(0, maxItems);
  }
  return [];
}

function unique(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

export function normalizeProfile(raw: unknown): Profile {
  const root = isRecord(raw) && isRecord(raw.profile) ? raw.profile : asRecord(raw);
  const basicsRaw = {
    ...root,
    ...asRecord(pick(root, ['basics', 'personalInfo', 'basicInfo', '基本信息'])),
  };
  const expectationsRaw = asRecord(pick(root, ['expectations', 'jobExpectation', '求职意向']));
  const skillsRaw = pick(root, ['skills', '专业技能', 'skillsList']);

  const experienceRaw = pick(root, ['experience', 'workExperience', '工作经历']);
  const projectRaw = pick(root, ['projects', 'projectExperience', '项目经历']);
  const educationRaw = pick(root, ['education', '教育背景']);
  const certificateRaw = pick(root, ['certificates', 'certifications', '证书']);

  const profile: Profile = {
    basics: {
      name: asString(pick(basicsRaw, ['name', 'fullName', '姓名']), 100),
      phone: asString(pick(basicsRaw, ['phone', 'mobile', 'telephone', '手机', '电话']), 50),
      email: asString(pick(basicsRaw, ['email', '邮箱']), 120),
      city: asString(pick(basicsRaw, ['city', 'location', '现居城市', '城市']), 60),
      wechat: asString(pick(basicsRaw, ['wechat', '微信']), 80),
      birthYear: asString(pick(basicsRaw, ['birthYear', 'birthday', '出生年份']), 20),
      gender: asString(pick(basicsRaw, ['gender', '性别']), 10),
      workYears: asString(pick(basicsRaw, ['workYears', 'yearsOfExperience', '工作年限']), 20),
      currentStatus: asString(pick(basicsRaw, ['currentStatus', 'status', '求职状态']), 40),
      github: asString(pick(basicsRaw, ['github', 'githubUrl']), 200),
      portfolio: asString(pick(basicsRaw, ['portfolio', 'website', '个人网站']), 200),
    },
    headline: asString(pick(root, ['headline', 'title', '个人标签']), 200),
    summary: asString(pick(root, ['summary', 'profile', 'about', '个人简介']), 2000),
    expectations: {
      roles: asStringArray(pick(expectationsRaw, ['roles', 'positions', 'jobTitles', '期望职位']), 8, 60),
      cities: asStringArray(pick(expectationsRaw, ['cities', 'locations', '期望城市']), 8, 60),
      salary: asString(pick(expectationsRaw, ['salary', 'expectedSalary', '期望薪资']), 60),
      jobType: asString(pick(expectationsRaw, ['jobType', 'type', '工作性质']), 40) || '全职',
      industries: asStringArray(pick(expectationsRaw, ['industries', 'industry', '期望行业']), 8, 60),
      availability: asString(pick(expectationsRaw, ['availability', 'noticePeriod', '到岗时间']), 100),
    },
    skills: unique(asStringArray(skillsRaw, 40, 80)),
    experience: Array.isArray(experienceRaw)
      ? experienceRaw
          .map((item) => {
            const entry = asRecord(item);
            const achievements = asStringArray(
              pick(entry, ['achievements', 'highlights', 'bullets', 'responsibilities', '业绩', '主要职责']),
              8,
              500,
            );
            return {
              company: asString(pick(entry, ['company', 'employer', '公司']), 200),
              title: asString(pick(entry, ['title', 'position', 'role', '职位']), 120),
              start: asString(pick(entry, ['start', 'startDate', '开始时间']), 40),
              end: asString(pick(entry, ['end', 'endDate', '结束时间']), 40),
              city: asString(pick(entry, ['city', 'location']), 60),
              description: asString(pick(entry, ['description', 'summary', '描述']), 1000),
              achievements,
              tech: asStringArray(pick(entry, ['tech', 'technologies', '技术栈']), 20, 40),
            };
          })
          .filter((entry) => entry.company || entry.title)
          .slice(0, 12)
      : [],
    projects: Array.isArray(projectRaw)
      ? projectRaw
          .map((item) => {
            const entry = asRecord(item);
            return {
              name: asString(pick(entry, ['name', 'projectName', '项目名称']), 200),
              role: asString(pick(entry, ['role', 'title', '角色']), 100),
              start: asString(pick(entry, ['start', 'startDate']), 40),
              end: asString(pick(entry, ['end', 'endDate']), 40),
              description: asString(pick(entry, ['description', 'summary', '描述']), 1000),
              achievements: asStringArray(
                pick(entry, ['achievements', 'highlights', 'bullets', '业绩']),
                8,
                500,
              ),
              tech: asStringArray(pick(entry, ['tech', 'technologies', '技术栈']), 20, 40),
            };
          })
          .filter((entry) => entry.name)
          .slice(0, 12)
      : [],
    education: Array.isArray(educationRaw)
      ? educationRaw
          .map((item) => {
            const entry = asRecord(item);
            return {
              school: asString(pick(entry, ['school', 'university', '学校']), 200),
              degree: asString(pick(entry, ['degree', '学历']), 60),
              major: asString(pick(entry, ['major', '专业']), 100),
              start: asString(pick(entry, ['start', 'startDate']), 40),
              end: asString(pick(entry, ['end', 'endDate']), 40),
              highlights: asStringArray(pick(entry, ['highlights', 'achievements']), 5, 200),
            };
          })
          .filter((entry) => entry.school)
          .slice(0, 6)
      : [],
    certificates: unique(
      Array.isArray(certificateRaw)
        ? certificateRaw
            .map((item) => {
              if (typeof item === 'string') return item;
              return asString(pick(asRecord(item), ['name', 'title']), 200);
            })
            .filter(Boolean)
            .slice(0, 20)
        : [],
    ),
    extras: asString(pick(root, ['extras', 'additional', '其他']), 2000),
    updatedAt: new Date().toISOString(),
  };

  if (!profile.basics.name) profile.basics.name = asString(pick(root, ['name']), 100);
  return profile;
}

const VERDICTS: Verdict[] = ['推荐投递', '可以尝试', '谨慎投递', '不建议'];

function verdictFromScore(score: number): Verdict {
  if (score >= 80) return '推荐投递';
  if (score >= 65) return '可以尝试';
  if (score >= 45) return '谨慎投递';
  return '不建议';
}

export function normalizeAnalysis(raw: unknown): JobAnalysis {
  const root = isRecord(raw) && isRecord(raw.analysis) ? raw.analysis : asRecord(raw);
  const scoreRaw = pick(root, ['score', 'matchScore', '匹配度']);
  const parsedScore =
    typeof scoreRaw === 'number' ? scoreRaw : Number.parseFloat(String(scoreRaw ?? '').replace(/[^\d.]/g, ''));
  const score = Number.isFinite(parsedScore) ? Math.min(100, Math.max(0, Math.round(parsedScore))) : 0;
  const verdictRaw = asString(pick(root, ['verdict', 'recommendation', '建议']), 20) as Verdict;
  const verdict = VERDICTS.includes(verdictRaw) ? verdictRaw : verdictFromScore(score);

  return {
    score,
    verdict,
    summary: asString(pick(root, ['summary', 'overall', 'conclusion', '总体评价']), 1000),
    reasons: asStringArray(pick(root, ['reasons', 'matchReasons', '匹配理由']), 8, 300),
    matched: asStringArray(pick(root, ['matched', 'strengths', 'matchedSkills', '匹配点']), 12, 200),
    gaps: asStringArray(pick(root, ['gaps', 'weaknesses', 'missingSkills', '短板']), 12, 200),
    risks: asStringArray(pick(root, ['risks', 'concerns', '风险']), 8, 300),
    keywords: unique(asStringArray(pick(root, ['keywords', 'keySkills', '关键词']), 25, 60)),
    suggestedAngle: asString(pick(root, ['suggestedAngle', 'suggestion', '投递建议']), 1000),
    questionsToAsk: asStringArray(pick(root, ['questionsToAsk', 'questions', '建议追问']), 8, 300),
    salaryComment: asString(pick(root, ['salaryComment', 'salaryAnalysis', '薪资分析']), 500),
    createdAt: new Date().toISOString(),
  };
}

export function normalizeResumeDoc(raw: unknown): ResumeDoc {
  const root = isRecord(raw) && isRecord(raw.resume) ? raw.resume : asRecord(raw);
  const experienceRaw = pick(root, ['experience', 'workExperience']);
  const projectRaw = pick(root, ['projects', 'projectExperience']);
  const educationRaw = pick(root, ['education']);

  return {
    headline: asString(pick(root, ['headline', 'title']), 200),
    jobIntention: asString(pick(root, ['jobIntention', 'intention', 'objective']), 300),
    summary: asString(pick(root, ['summary', 'profile', 'about']), 1500),
    skills: unique(asStringArray(pick(root, ['skills']), 30, 80)),
    experience: Array.isArray(experienceRaw)
      ? experienceRaw
          .map((item) => {
            const entry = asRecord(item);
            return {
              company: asString(pick(entry, ['company']), 200),
              title: asString(pick(entry, ['title', 'position', 'role']), 120),
              start: asString(pick(entry, ['start']), 40),
              end: asString(pick(entry, ['end']), 40),
              city: asString(pick(entry, ['city', 'location']), 60),
              bullets: asStringArray(pick(entry, ['bullets', 'achievements', 'highlights']), 6, 400),
            };
          })
          .filter((entry) => entry.company)
          .slice(0, 10)
      : [],
    projects: Array.isArray(projectRaw)
      ? projectRaw
          .map((item) => {
            const entry = asRecord(item);
            return {
              name: asString(pick(entry, ['name']), 200),
              role: asString(pick(entry, ['role']), 100),
              start: asString(pick(entry, ['start']), 40),
              end: asString(pick(entry, ['end']), 40),
              tech: asStringArray(pick(entry, ['tech', 'technologies']), 20, 40),
              bullets: asStringArray(pick(entry, ['bullets', 'achievements', 'highlights']), 6, 400),
            };
          })
          .filter((entry) => entry.name)
          .slice(0, 8)
      : [],
    education: Array.isArray(educationRaw)
      ? educationRaw
          .map((item) => {
            const entry = asRecord(item);
            return {
              school: asString(pick(entry, ['school']), 200),
              degree: asString(pick(entry, ['degree']), 60),
              major: asString(pick(entry, ['major']), 100),
              start: asString(pick(entry, ['start']), 40),
              end: asString(pick(entry, ['end']), 40),
            };
          })
          .filter((entry) => entry.school)
          .slice(0, 5)
      : [],
    certificates: unique(asStringArray(pick(root, ['certificates', 'certifications']), 15, 200)),
  };
}

function normalizedKey(value: string): string {
  return value.replace(/[\s（）()·.,，、\-]/g, '').toLowerCase();
}

function pickTaggedNumbers(text: string): string[] {
  return (text.match(/\d+(?:\.\d+)?/g) || []).map((value) => String(Number(value)));
}

function isGrounded(text: string, allowedNumbers: Set<string>): boolean {
  return pickTaggedNumbers(text).every((value) => allowedNumbers.has(value));
}

export interface ResumeGroundingResult {
  doc: ResumeDoc;
  notes: string[];
}

export function groundResumeDoc(doc: ResumeDoc, profile: Profile): ResumeGroundingResult {
  const notes: string[] = [];
  const profileText = JSON.stringify(profile);
  const allowedNumbers = new Set(pickTaggedNumbers(profileText));

  const experience = doc.experience
    .map((entry) => {
      const source = profile.experience.find(
        (item) =>
          normalizedKey(item.company) === normalizedKey(entry.company) ||
          (entry.company && normalizedKey(item.company).includes(normalizedKey(entry.company))),
      );
      if (!source) {
        notes.push(`移除了档案中不存在的经历：${entry.company || '未命名'}`);
        return null;
      }
      let bullets = entry.bullets.filter((bullet) => isGrounded(bullet, allowedNumbers));
      if (bullets.length < entry.bullets.length) {
        notes.push(`移除了 ${entry.company} 中无法从档案核实的量化表述`);
      }
      if (!bullets.length) {
        bullets = (source.achievements.length ? source.achievements : [source.description || '']).filter(Boolean);
      }
      return {
        company: source.company,
        title: source.title || entry.title,
        start: source.start,
        end: source.end,
        city: source.city || entry.city,
        bullets: bullets.slice(0, 5),
      };
    })
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));

  const projects = doc.projects
    .map((entry) => {
      const source = profile.projects.find(
        (item) =>
          normalizedKey(item.name) === normalizedKey(entry.name) ||
          (entry.name && normalizedKey(item.name).includes(normalizedKey(entry.name))),
      );
      if (!source) {
        notes.push(`移除了档案中不存在的项目：${entry.name || '未命名'}`);
        return null;
      }
      let bullets = entry.bullets.filter((bullet) => isGrounded(bullet, allowedNumbers));
      if (bullets.length < entry.bullets.length) {
        notes.push(`移除了 ${entry.name} 中无法从档案核实的量化表述`);
      }
      if (!bullets.length) {
        bullets = (source.achievements.length ? source.achievements : [source.description || '']).filter(Boolean);
      }
      return {
        name: source.name,
        role: source.role || entry.role,
        start: source.start,
        end: source.end,
        tech: (source.tech.length ? source.tech : entry.tech).slice(0, 12),
        bullets: bullets.slice(0, 5),
      };
    })
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));

  let summary = doc.summary;
  if (summary && !isGrounded(summary, allowedNumbers)) {
    summary = profile.summary;
    notes.push('个人简介中出现无法核实的数字，已改用档案中的自我介绍');
  }

  const education = profile.education.slice(0, 4).map((item) => ({
    school: item.school,
    degree: item.degree,
    major: item.major,
    start: item.start,
    end: item.end,
  }));

  const allowedCerts = new Set(profile.certificates.map(normalizedKey));
  let certificates = doc.certificates.filter((cert) => allowedCerts.has(normalizedKey(cert)));
  if (!certificates.length) certificates = profile.certificates.slice(0, 8);

  const result: ResumeDoc = {
    headline: doc.headline || profile.headline,
    jobIntention:
      doc.jobIntention ||
      [profile.expectations.roles.join(' / '), profile.expectations.cities.join(' / ')]
        .filter(Boolean)
        .join(' · '),
    summary: summary || profile.summary,
    skills: (doc.skills.length ? doc.skills : profile.skills).slice(0, 24),
    experience,
    projects,
    education,
    certificates,
  };

  return { doc: result, notes: unique(notes).slice(0, 8) };
}

export function normalizeResumeResult(raw: unknown): {
  doc: ResumeDoc;
  matchedKeywords: string[];
  missingKeywords: string[];
  changeNotes: string[];
} {
  const root = isRecord(raw) && isRecord(raw.resume) ? { ...raw, ...raw.resume } : asRecord(raw);
  const doc = normalizeResumeDoc(root);
  return {
    doc,
    matchedKeywords: unique(
      asStringArray(pick(root, ['matchedKeywords', 'coverage', 'matched']), 25, 60),
    ),
    missingKeywords: unique(
      asStringArray(pick(root, ['missingKeywords', 'gaps', 'missing']), 25, 60),
    ),
    changeNotes: unique(asStringArray(pick(root, ['changeNotes', 'notes', 'changes']), 10, 300)),
  };
}

export function normalizeGreeting(raw: unknown): { text: string; rationale: string } {
  const root = isRecord(raw) && isRecord(raw.greeting) ? raw.greeting : asRecord(raw);
  let text = asString(
    typeof raw === 'string' ? raw : pick(root, ['text', 'message', 'greeting', 'content']),
    400,
  );
  text = text
    .replace(/^["'“”]+|["'“”]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!text) throw new HttpError(502, '模型没有返回招呼语，请重试');
  return {
    text: text.slice(0, 220),
    rationale: asString(pick(root, ['rationale', 'reason', 'why']), 500),
  };
}

export interface ChatDraftResult {
  intent: string;
  sentiment: string;
  reply: string;
  riskFlags: string[];
  nextAction: string;
}

export function normalizeChatResult(raw: unknown): ChatDraftResult {
  const root = isRecord(raw) && isRecord(raw.reply) ? { ...raw, ...raw.reply } : asRecord(raw);
  let reply = asString(pick(root, ['reply', 'text', 'suggestedReply', 'message']), 500);
  reply = reply.replace(/^["'“”]+|["'“”]+$/g, '').replace(/\s+/g, ' ').trim();
  if (!reply) throw new HttpError(502, '模型没有返回回复内容，请重试');
  return {
    intent: asString(pick(root, ['intent', 'category', '意图']), 80) || '其他',
    sentiment: asString(pick(root, ['sentiment', '情绪']), 40) || '中性',
    reply: reply.slice(0, 300),
    riskFlags: asStringArray(pick(root, ['riskFlags', 'risks', '注意事项']), 5, 200),
    nextAction: asString(pick(root, ['nextAction', 'suggestion', '下一步']), 300),
  };
}

export function normalizeChatMessages(raw: unknown): ChatMessage[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      const entry = asRecord(item);
      const role = asString(entry.role, 10);
      if (!['hr', 'me', 'system'].includes(role)) return null;
      const text = asString(entry.text, 1000);
      if (!text) return null;
      return { role: role as ChatMessage['role'], text, at: asString(entry.at, 40) } as ChatMessage;
    })
    .filter((item): item is ChatMessage => Boolean(item))
    .slice(-30);
}
