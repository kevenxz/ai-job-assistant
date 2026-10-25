import fs from 'node:fs';
import path from 'node:path';
import { chromium, type Browser } from 'playwright-core';
import mammoth from 'mammoth';
import { extractText, getDocumentProxy } from 'unpdf';
import type { Profile, ResumeDoc, Settings } from '../../../src/shared/types';
import { envChromePath } from './config';
import { HttpError } from './errors';

export function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function contactItems(profile: Profile): string[] {
  const basics = profile.basics;
  return [
    basics.phone,
    basics.email,
    basics.city,
    basics.workYears ? `${basics.workYears}经验` : '',
    basics.github ? basics.github.replace(/^https?:\/\//, '') : '',
    basics.portfolio ? basics.portfolio.replace(/^https?:\/\//, '') : '',
  ].filter(Boolean);
}

export function buildResumeHtml(
  doc: ResumeDoc,
  profile: Profile,
  settings: Settings,
  fontScale = 1,
): string {
  const accent = /^#[0-9a-fA-F]{6}$/.test(settings.resume.accentColor)
    ? settings.resume.accentColor
    : '#1f5eff';
  const scale = Math.min(1.15, Math.max(0.75, fontScale));
  const contacts = contactItems(profile);
  const name = escapeHtml(profile.basics.name || '未命名');

  const experienceHtml = doc.experience
    .map((entry) => {
      const meta = [
        entry.city,
        entry.start && entry.end ? `${entry.start} – ${entry.end}` : entry.start || entry.end,
      ]
        .filter((item): item is string => Boolean(item))
        .map(escapeHtml)
        .join(' · ');
      return `<div class="entry">
        <div class="entry-head">
          <div><span class="entry-title">${escapeHtml(entry.company)}</span><span class="entry-role">${escapeHtml(entry.title)}</span></div>
          <div class="entry-date">${meta}</div>
        </div>
        ${entry.bullets.length ? `<ul class="bullets">${entry.bullets.map((bullet) => `<li>${escapeHtml(bullet)}</li>`).join('')}</ul>` : ''}
      </div>`;
    })
    .join('');

  const projectsHtml = doc.projects
    .map((entry) => {
      const meta = [
        entry.role,
        entry.start && entry.end ? `${entry.start} – ${entry.end}` : entry.start || entry.end,
      ]
        .filter((item): item is string => Boolean(item))
        .map(escapeHtml)
        .join(' · ');
      const tech = entry.tech.length
        ? `<div class="entry-tech">技术栈：${entry.tech.map(escapeHtml).join(' / ')}</div>`
        : '';
      return `<div class="entry">
        <div class="entry-head">
          <div><span class="entry-title">${escapeHtml(entry.name)}</span>${meta ? `<span class="entry-role">${meta}</span>` : ''}</div>
        </div>
        ${tech}
        ${entry.bullets.length ? `<ul class="bullets">${entry.bullets.map((bullet) => `<li>${escapeHtml(bullet)}</li>`).join('')}</ul>` : ''}
      </div>`;
    })
    .join('');

  const educationHtml = doc.education
    .map((entry) => {
      const date = [entry.start, entry.end].filter(Boolean).map(escapeHtml).join(' – ');
      return `<div class="edu-row">
        <div><span class="entry-title">${escapeHtml(entry.school)}</span><span class="entry-role">${escapeHtml([entry.major, entry.degree].filter(Boolean).join(' · '))}</span></div>
        <div class="entry-date">${date}</div>
      </div>`;
    })
    .join('');

  const certificatesHtml = doc.certificates.length
    ? `<section class="section">
        <h2 class="section-title">证书 / 其他</h2>
        <div class="inline-list">${doc.certificates.map(escapeHtml).join('　·　')}</div>
      </section>`
    : '';

  const skillsHtml = doc.skills.length
    ? `<section class="section">
        <h2 class="section-title">专业技能</h2>
        <div class="skills">${doc.skills.map(escapeHtml).join('　·　')}</div>
      </section>`
    : '';

  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${name} - 简历</title>
<style>
  @page { size: A4; }
  * { box-sizing: border-box; }
  html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body {
    margin: 0;
    color: #23262b;
    font-family: "Microsoft YaHei", "PingFang SC", "Noto Sans CJK SC", "Source Han Sans SC", "Hiragino Sans GB", Arial, sans-serif;
    font-size: ${(10.2 * scale).toFixed(2)}pt;
    line-height: 1.55;
    background: #fff;
  }
  .header { border-bottom: 2.5px solid ${accent}; padding-bottom: 10px; }
  .name { font-size: ${(23 * scale).toFixed(2)}pt; font-weight: 800; letter-spacing: 1.5px; line-height: 1.15; }
  .headline { color: ${accent}; font-size: ${(11.5 * scale).toFixed(2)}pt; font-weight: 600; margin-top: 3px; }
  .contact { display: flex; flex-wrap: wrap; gap: 4px 16px; margin-top: 7px; color: #555c66; font-size: ${(9.4 * scale).toFixed(2)}pt; }
  .intention { margin-top: 6px; color: #4a505a; font-size: ${(9.8 * scale).toFixed(2)}pt; }
  .intention b { color: ${accent}; font-weight: 600; }
  .section { margin-top: 13px; }
  .section-title {
    font-size: ${(11.6 * scale).toFixed(2)}pt; font-weight: 700; color: ${accent};
    margin: 0 0 6px; padding-left: 8px; border-left: 4px solid ${accent}; line-height: 1.2;
  }
  .entry { break-inside: avoid; margin-bottom: 9px; }
  .entry:last-child { margin-bottom: 0; }
  .entry-head { display: flex; justify-content: space-between; align-items: baseline; gap: 14px; }
  .entry-title { font-weight: 700; font-size: ${(10.6 * scale).toFixed(2)}pt; }
  .entry-role { color: #555c66; margin-left: 8px; font-size: ${(9.8 * scale).toFixed(2)}pt; }
  .entry-date { color: #6d737d; white-space: nowrap; font-size: ${(9.2 * scale).toFixed(2)}pt; }
  .entry-tech { color: #666d77; font-size: ${(9.2 * scale).toFixed(2)}pt; margin-top: 2px; }
  .bullets { margin: 4px 0 0; padding-left: 18px; }
  .bullets li { margin: 2px 0; padding-left: 1px; }
  .skills, .inline-list { color: #333941; }
  .summary { color: #333941; text-align: justify; }
  .edu-row { display: flex; justify-content: space-between; align-items: baseline; gap: 14px; break-inside: avoid; margin-bottom: 5px; }
  .footer-note { margin-top: 14px; color: #9aa0a8; font-size: 8pt; text-align: right; }
  @media print { body { background: #fff; } .entry, .edu-row { break-inside: avoid; } }
</style>
</head>
<body>
  <header class="header">
    <div class="name">${name}</div>
    ${doc.headline ? `<div class="headline">${escapeHtml(doc.headline)}</div>` : ''}
    ${contacts.length ? `<div class="contact">${contacts.map((item) => `<span>${escapeHtml(item)}</span>`).join('')}</div>` : ''}
    ${doc.jobIntention ? `<div class="intention">求职意向：<b>${escapeHtml(doc.jobIntention)}</b></div>` : ''}
  </header>

  ${doc.summary ? `<section class="section"><h2 class="section-title">个人简介</h2><div class="summary">${escapeHtml(doc.summary)}</div></section>` : ''}
  ${skillsHtml}
  ${experienceHtml ? `<section class="section"><h2 class="section-title">工作经历</h2>${experienceHtml}</section>` : ''}
  ${projectsHtml ? `<section class="section"><h2 class="section-title">项目经历</h2>${projectsHtml}</section>` : ''}
  ${educationHtml ? `<section class="section"><h2 class="section-title">教育背景</h2>${educationHtml}</section>` : ''}
  ${certificatesHtml}
</body>
</html>`;
}

export function detectChromePath(settings: Settings): string | null {
  const candidates = [
    settings.chromePath,
    envChromePath,
    process.platform === 'win32'
      ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
      : '',
    process.platform === 'win32'
      ? 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'
      : '',
    process.platform === 'win32' && process.env.LOCALAPPDATA
      ? path.join(process.env.LOCALAPPDATA, 'Google/Chrome/Application/chrome.exe')
      : '',
    process.platform === 'win32'
      ? 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
      : '',
    process.platform === 'win32'
      ? 'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'
      : '',
    process.platform === 'darwin'
      ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
      : '',
    process.platform === 'darwin' ? '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge' : '',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/usr/bin/microsoft-edge',
  ].filter(Boolean);

  return candidates.find((candidate) => fs.existsSync(candidate)) || null;
}

export async function countPdfPages(pdf: Buffer): Promise<number> {
  try {
    const document = await getDocumentProxy(new Uint8Array(pdf));
    return document.numPages;
  } catch {
    return 0;
  }
}

export interface RenderResult {
  pdf: Buffer;
  pages: number;
  warnings: string[];
}

export async function renderResumePdf(
  doc: ResumeDoc,
  profile: Profile,
  settings: Settings,
): Promise<RenderResult> {
  const chromePath = detectChromePath(settings);
  if (!chromePath) {
    throw new HttpError(
      400,
      '未找到 Chrome/Edge，无法生成 PDF。请安装 Chrome，或在管理后台设置中填写浏览器可执行文件路径。',
    );
  }

  let browser: Browser | undefined;
  const warnings: string[] = [];
  const baseScale = settings.resume.fontScale;
  const attempts = [baseScale, baseScale * 0.95, baseScale * 0.9];
  let lastPdf: Buffer | null = null;
  let lastPages = 0;

  try {
    browser = await chromium.launch({
      executablePath: chromePath,
      headless: true,
      args: ['--no-sandbox', '--disable-gpu', '--font-render-hinting=none'],
    });

    for (let index = 0; index < attempts.length; index += 1) {
      const html = buildResumeHtml(doc, profile, settings, attempts[index]);
      const page = await browser.newPage();
      try {
        await page.setContent(html, { waitUntil: 'load' });
        await page.evaluate('document.fonts.ready');
        const pdf = await page.pdf({
          format: 'A4',
          printBackground: true,
          displayHeaderFooter: false,
          margin: { top: '13mm', bottom: '13mm', left: '14mm', right: '14mm' },
        });
        lastPdf = Buffer.from(pdf);
        lastPages = await countPdfPages(lastPdf);
        if (lastPages <= settings.resume.pageLimit) break;
        if (index < attempts.length - 1) {
          warnings.push(
            `内容超过 ${settings.resume.pageLimit} 页（${lastPages} 页），已自动缩小字号重排。`,
          );
        }
      } finally {
        await page.close();
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new HttpError(500, `PDF 渲染失败：${message}`);
  } finally {
    await browser?.close();
  }

  if (!lastPdf) throw new HttpError(500, 'PDF 渲染失败：没有生成文件');
  if (lastPages > settings.resume.pageLimit) {
    warnings.push(
      `最终简历仍有 ${lastPages} 页，超过设定的 ${settings.resume.pageLimit} 页。建议删减经历或在后台调大页数上限。`,
    );
  }
  return { pdf: lastPdf, pages: lastPages, warnings };
}

export function sanitizeFileName(value: string): string {
  return (
    value
      .replace(/[\\/:*?"<>|\r\n]/g, '')
      .replace(/\s+/g, '_')
      .slice(0, 80) || 'resume'
  );
}

export interface ExtractedResumeText {
  text: string;
  pages?: number;
}

export async function extractResumeText(
  fileName: string,
  buffer: Buffer,
): Promise<ExtractedResumeText> {
  const extension = path.extname(fileName).toLowerCase();
  const isPdf = extension === '.pdf' || buffer.subarray(0, 5).toString() === '%PDF-';

  if (isPdf) {
    try {
      const document = await getDocumentProxy(new Uint8Array(buffer));
      const result = await extractText(document, { mergePages: true });
      const text = (Array.isArray(result.text) ? result.text.join('\n') : result.text) || '';
      if (text.trim().length < 30) {
        throw new HttpError(400, '未能从 PDF 中提取到有效文字，可能是扫描件。请直接粘贴简历文本。');
      }
      return { text: text.trim().slice(0, 60_000), pages: result.totalPages };
    } catch (error) {
      if (error instanceof HttpError) throw error;
      throw new HttpError(400, 'PDF 解析失败，请确认文件未加密，或直接粘贴简历文本。');
    }
  }

  if (extension === '.docx' || extension === '.doc') {
    try {
      const result = await mammoth.extractRawText({ buffer });
      const text = result.value.trim();
      if (!text) throw new Error('empty');
      return { text: text.slice(0, 60_000) };
    } catch {
      throw new HttpError(400, 'DOCX 解析失败，请尝试上传 PDF，或直接粘贴简历文本。');
    }
  }

  if (extension === '.txt' || extension === '.md' || extension === '') {
    const text = buffer.toString('utf8').replace(/^\uFEFF/, '').trim();
    if (!text) throw new HttpError(400, '文件内容为空');
    return { text: text.slice(0, 60_000) };
  }

  throw new HttpError(400, '仅支持 PDF、DOCX、TXT、MD 格式的简历文件');
}
