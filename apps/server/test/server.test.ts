import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { parseJsonFromText } from '../src/llm';
import { buildResumeHtml, extractResumeText, renderResumePdf } from '../src/resume';
import { groundResumeDoc, normalizeProfile } from '../src/normalize';
import { Store } from '../src/store';
import { DEFAULT_SETTINGS, EMPTY_PROFILE, type Profile, type ResumeDoc } from '../../../src/shared/types';

const profile: Profile = {
  ...structuredClone(EMPTY_PROFILE),
  basics: {
    ...structuredClone(EMPTY_PROFILE.basics),
    name: '张三',
    phone: '13800000000',
    email: 'zhangsan@example.com',
    city: '上海',
    workYears: '5年',
  },
  headline: '前端工程师',
  summary: '5 年前端开发经验，负责过 B 端数据产品。',
  expectations: {
    roles: ['前端工程师'],
    cities: ['上海'],
    salary: '25-35K',
    jobType: '全职',
    industries: ['互联网'],
    availability: '两周内到岗',
  },
  skills: ['TypeScript', 'React', 'Node.js'],
  experience: [
    {
      company: '示例科技',
      title: '高级前端工程师',
      start: '2021-03',
      end: '至今',
      city: '上海',
      achievements: ['主导数据看板重构，页面加载时间从 4s 降到 1.5s', '搭建组件库，覆盖 12 个业务线'],
    },
  ],
  projects: [
    {
      name: '数据看板',
      role: '前端负责人',
      start: '2022-01',
      end: '2022-08',
      achievements: ['使用 Web Worker 优化大数据量渲染'],
      tech: ['React', 'TypeScript', 'ECharts'],
    },
  ],
  education: [
    { school: '示例大学', degree: '本科', major: '计算机科学', start: '2014-09', end: '2018-06' },
  ],
  certificates: [],
  extras: '',
};

const doc: ResumeDoc = {
  headline: '前端工程师',
  jobIntention: '高级前端工程师 · 上海',
  summary: '5 年前端经验，擅长复杂数据产品与性能优化。',
  skills: ['TypeScript', 'React', 'Node.js'],
  experience: [
    {
      company: '示例科技',
      title: '高级前端工程师',
      start: '2021-03',
      end: '至今',
      city: '上海',
      bullets: ['主导数据看板重构，将页面加载时间从 4s 降到 1.5s', '搭建组件库，覆盖 12 个业务线'],
    },
  ],
  projects: [
    {
      name: '数据看板',
      role: '前端负责人',
      start: '2022-01',
      end: '2022-08',
      tech: ['React', 'ECharts'],
      bullets: ['使用 Web Worker 优化大数据量渲染'],
    },
  ],
  education: [
    { school: '示例大学', degree: '本科', major: '计算机科学', start: '2014-09', end: '2018-06' },
  ],
  certificates: [],
};

test('parseJsonFromText parses fenced and noisy output', () => {
  assert.deepEqual(parseJsonFromText('```json\n{"a":1}\n```'), { a: 1 });
  assert.deepEqual(parseJsonFromText('结果如下：{"a":1,}'), { a: 1 });
  assert.throws(() => parseJsonFromText('不是 JSON'));
});

test('buildResumeHtml escapes user content', () => {
  const html = buildResumeHtml(
    { ...doc, summary: '<script>alert(1)</script>' },
    { ...profile, basics: { ...profile.basics, name: '<b>张三</b>' } },
    DEFAULT_SETTINGS,
  );
  assert.ok(!html.includes('<script>alert(1)</script>'));
  assert.ok(html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
  assert.ok(html.includes('&lt;b&gt;张三&lt;/b&gt;'));
});

test('groundResumeDoc removes invented numbers and unknown companies', () => {
  const result = groundResumeDoc(
    {
      ...doc,
      experience: [
        ...doc.experience,
        {
          company: '不存在的公司',
          title: 'CEO',
          start: '2020-01',
          end: '2021-01',
          bullets: ['管理 100 人团队'],
        },
      ],
      summary: '帮助公司提升 300% 营收',
    },
    profile,
  );
  assert.equal(result.doc.experience.length, 1);
  assert.equal(result.doc.experience[0].company, '示例科技');
  assert.ok(!result.doc.experience[0].bullets.some((bullet) => bullet.includes('100')));
  assert.equal(result.doc.summary, profile.summary);
  assert.ok(result.notes.length > 0);
});

test('normalizeProfile handles empty model output', () => {
  const normalized = normalizeProfile({});
  assert.equal(normalized.basics.name, '');
  assert.deepEqual(normalized.experience, []);
});

test('renders a PDF with the local Chrome and extracts its text', async () => {
  const result = await renderResumePdf(doc, profile, DEFAULT_SETTINGS);
  assert.ok(result.pdf.subarray(0, 5).toString() === '%PDF-');
  assert.ok(result.pages >= 1 && result.pages <= 2);
  const extracted = await extractResumeText('resume.pdf', result.pdf);
  assert.match(extracted.text, /张三/);
  assert.match(extracted.text, /示例科技/);
  assert.match(extracted.text, /TypeScript/);
});

test('application guard enforces daily limit and interval', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aijob-store-'));
  try {
    const store = new Store(dir);
    const { job } = store.upsertJob({
      platform: 'boss',
      platformJobId: 'guard-1',
      url: 'https://www.zhipin.com/job_detail/guard-1.html',
      title: '测试岗位',
      company: '测试公司',
      salary: '20-30K',
      city: '上海',
      tags: [],
      jdText: '负责前端开发工作，要求熟悉 React 和 TypeScript，有五年以上经验。',
      source: 'manual',
    });
    const { job: job2 } = store.upsertJob({
      platform: 'boss',
      platformJobId: 'guard-2',
      url: 'https://www.zhipin.com/job_detail/guard-2.html',
      title: '测试岗位 2',
      company: '测试公司',
      salary: '20-30K',
      city: '上海',
      tags: [],
      jdText: '负责前端开发工作，要求熟悉 React 和 TypeScript，有五年以上经验。',
      source: 'manual',
    });

    store.updateSettings({ automation: { maxPerDay: 1, minIntervalSeconds: 0 } });
    const precheck = store.precheckApplication(job.id);
    assert.equal(precheck.duplicate, false);
    store.submitApplication(job.id, '你好，想了解一下这个岗位。');
    assert.equal(store.precheckApplication(job.id).duplicate, true);
    assert.throws(() => store.precheckApplication(job2.id), /今日投递上限/);

    store.updateSettings({ automation: { maxPerDay: 5, minIntervalSeconds: 600 } });
    assert.throws(() => store.precheckApplication(job2.id), /投递间隔过短/);

    store.updateSettings({ autoGreet: { enabled: true, minScore: 150, countdownSeconds: 1 } });
    const autoGreet = store.getSettings().autoGreet;
    assert.equal(autoGreet.enabled, true);
    assert.equal(autoGreet.minScore, 100);
    assert.equal(autoGreet.countdownSeconds, 3);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
