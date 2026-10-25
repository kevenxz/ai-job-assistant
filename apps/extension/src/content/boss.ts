import type { CapturedJobInput, ChatMessage } from '../../../../src/shared/types';

const JOB_TITLE = [
  '.job-banner .name h1',
  '.job-banner .name',
  '.job-name',
  '.job-info h1',
  '.job-detail-box .name',
  '.info-primary .name',
  '.job-title',
  '[class*="job-name"]',
  '[class*="job-title"]',
  '[class*="position-name"]',
  'h1',
];

const JOB_SALARY = [
  '.job-banner .salary',
  '.job-info .salary',
  '.salary',
  '.job-salary',
  '[class*="salary"]',
];
const JOB_COMPANY = [
  '.job-banner .company-info .name',
  '.company-info .name',
  '.company-name',
  '.company-title',
  '.sider-company .name',
  '.job-company .name',
  '[class*="company-name"]',
  '[class*="company-title"]',
  '[class*="brand-name"]',
];
const JOB_AREA = [
  '.job-area',
  '.location-address',
  '.job-location',
  '.location',
  '.job-address',
  '[class*="job-area"]',
  '[class*="job-location"]',
  '[class*="location-address"]',
];
const JOB_TAGS = [
  '.job-keyword-list li',
  '.job-tags span',
  '.tag-list li',
  '.job-labels span',
  '.job-label-list li',
  '.job-card-tags span',
  '[class*="job-keyword"] li',
];
const JOB_JD = [
  '.job-sec-text',
  '.job-detail-section .text',
  '.job-detail .text',
  '.job-sec .text',
  '[class*="job-desc"]',
  '[class*="job-description"]',
  '[class*="job-sec"]',
  '[class*="position-desc"]',
];
const JOB_JD_FALLBACK = [
  '.job-desc',
  '.job-description',
  '.job-detail',
  '[class*="job-detail"]',
  '[class*="job-content"]',
];
const JOB_LIMIT = [
  '.job-limit .text',
  '.job-limit',
  '.job-require',
  '.job-requirements',
  '.job-info .text',
  '[class*="job-limit"]',
  '[class*="job-require"]',
];
const JOB_HR = [
  '.job-boss-info .info .name',
  '.job-boss-info .name',
  '.boss-info .name',
  '.boss-name',
  '.job-boss .name',
  '.chat-user-name',
  '[class*="boss-name"]',
];
const JOB_HR_TITLE = ['.job-boss-info .info .gray', '.boss-info .gray', '.boss-title', '.job-boss .title'];
const JOB_COMPANY_INFO = [
  '.company-info',
  '.company-intro',
  '.job-company-info',
  '.company-detail',
  '[class*="company-intro"]',
];

const JOB_CARD_SELECTORS = [
  '.job-card-wrapper',
  '.job-card-box',
  '.job-card',
  '[class*="job-card-wrapper"]',
  '[class*="job-card-box"]',
];
const CARD_TITLE = [
  '.job-name',
  '.job-title',
  '[class*="job-name"]',
  '[class*="job-title"]',
  'h3',
  'h2',
  '.name',
];
const CARD_SALARY = ['.salary', '.job-salary', '[class*="salary"]'];
const CARD_COMPANY = [
  '.company-name',
  '.company-title',
  '.company-info .name',
  '[class*="company-name"]',
  '[class*="company-title"]',
];
const CARD_AREA = ['.job-area', '.job-location', '[class*="job-area"]', '[class*="job-location"]'];
const CARD_TAGS = ['.tag-list li', '.job-tags span', '[class*="tag"] li', '[class*="tag"] span'];

const CHAT_ROOTS = [
  '.chat-conversation',
  '.chat-record',
  '.chat-message-list',
  '.message-list',
  '.chat-content',
  '.chat-panel',
];
const MESSAGE_ITEMS = [
  '.message-item',
  '.chat-message-item',
  '.item-message',
  '.chat-message',
  '.message',
];
const MESSAGE_TEXT = [
  '.text',
  '.message-text',
  '.text-content',
  '.msg-text',
  '.chat-text',
  '.content',
  '.word',
];
const CHAT_INPUT = [
  '.chat-input [contenteditable="true"]',
  '.chat-editor [contenteditable="true"]',
  '.chat-input textarea',
  '.chat-editor textarea',
  '.chat-input',
  '[contenteditable="true"]',
];

export type PageKind = 'job' | 'chat' | 'other';

export interface ExtractedJob {
  input: CapturedJobInput;
  issues: string[];
}

export interface ChatContext {
  conversationKey: string;
  hrName: string;
  company: string;
  jobTitle: string;
  jobUrl: string;
  messages: ChatMessage[];
}

export interface SendResult {
  ok: boolean;
  filled: boolean;
  sent: boolean;
  uncertain?: boolean;
  error?: string;
}

function clean(value: string, max = 5000): string {
  return value
    .replace(/\u00a0/g, ' ')
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, max);
}

function isVisible(element: Element): boolean {
  if (!(element instanceof HTMLElement)) return false;
  const style = window.getComputedStyle(element);
  if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;
  return element.getClientRects().length > 0;
}

function firstText(selectors: string[], minLength = 1, root: ParentNode = document): string {
  for (const selector of selectors) {
    const elements = root.querySelectorAll<HTMLElement>(selector);
    for (const element of elements) {
      const text = clean(element.innerText || element.textContent || '');
      if (text.length >= minLength && isVisible(element)) return text;
    }
  }
  return '';
}

function longestText(selectors: string[], minLength = 20, root: ParentNode = document): string {
  let best = '';
  for (const selector of selectors) {
    const elements = root.querySelectorAll<HTMLElement>(selector);
    for (const element of elements) {
      if (!isVisible(element)) continue;
      const text = clean(element.innerText || element.textContent || '', 30_000);
      if (text.length >= minLength && text.length > best.length) best = text;
    }
  }
  return best;
}

function uniqueStrings(values: string[], max = 20): string[] {
  return [...new Set(values.map((value) => clean(value, 120)).filter(Boolean))].slice(0, max);
}

function collectText(selectors: string[], minLength = 20): string {
  const texts: string[] = [];
  for (const selector of selectors) {
    for (const element of document.querySelectorAll<HTMLElement>(selector)) {
      if (!isVisible(element)) continue;
      const text = clean(element.innerText || element.textContent || '', 30_000);
      if (text.length >= minLength && !texts.includes(text)) texts.push(text);
    }
  }
  return texts.join('\n\n');
}

function genericJdText(): string {
  if (!document.body) return '';
  const text = clean(document.body.innerText || '', 40_000);
  const startMarkers = ['职位描述', '岗位职责', '工作职责', '工作内容', '职位详情'];
  let start = -1;
  for (const marker of startMarkers) {
    const index = text.indexOf(marker);
    if (index >= 0 && (start < 0 || index < start)) start = index;
  }
  if (start >= 0) {
    const tail = text.slice(start);
    const endMarkers = [
      '公司介绍',
      '公司简介',
      '工作地址',
      '相似职位',
      '推荐职位',
      '竞争力分析',
      '工商信息',
      '公司信息',
    ];
    let end = tail.length;
    for (const marker of endMarkers) {
      const index = tail.indexOf(marker, 80);
      if (index > 0 && index < end) end = index;
    }
    const slice = tail.slice(0, Math.min(end, 12_000)).trim();
    if (slice.length >= 40) return slice;
  }

  const blocks = [...document.querySelectorAll<HTMLElement>('article, section, div')]
    .filter(isVisible)
    .map((element) => ({ text: clean(element.innerText || element.textContent || '', 12_000) }))
    .filter(
      (item) =>
        item.text.length >= 120 &&
        /岗位职责|任职要求|职位描述|工作内容/.test(item.text),
    )
    .sort((a, b) => a.text.length - b.text.length);
  return blocks[0]?.text || '';
}

function stripHtml(html: string): string {
  const document = new DOMParser().parseFromString(html, 'text/html');
  document.querySelectorAll('br,p,li,div,h1,h2,h3,h4').forEach((node) => {
    node.insertAdjacentText('afterend', '\n');
  });
  return clean(document.body.textContent || '', 30_000);
}

function findJsonLdJob(): Record<string, unknown> | null {
  const scripts = document.querySelectorAll<HTMLScriptElement>('script[type="application/ld+json"]');
  for (const script of scripts) {
    try {
      const data = JSON.parse(script.textContent || 'null') as unknown;
      const queue: unknown[] = [data];
      while (queue.length) {
        const item = queue.shift();
        if (Array.isArray(item)) {
          queue.push(...item);
          continue;
        }
        if (!item || typeof item !== 'object') continue;
        const record = item as Record<string, unknown>;
        const type = record['@type'];
        if (
          type === 'JobPosting' ||
          (Array.isArray(type) && type.includes('JobPosting'))
        ) {
          return record;
        }
        if (record['@graph']) queue.push(record['@graph']);
      }
    } catch {
      // 忽略无法解析的 JSON-LD
    }
  }
  return null;
}

function jsonLdText(value: unknown): string {
  return typeof value === 'string' ? clean(value, 30_000) : '';
}

function jsonLdCity(job: Record<string, unknown>): string {
  const location = job.jobLocation;
  const first = Array.isArray(location) ? location[0] : location;
  if (!first || typeof first !== 'object') return '';
  const address = (first as Record<string, unknown>).address;
  if (!address || typeof address !== 'object') return '';
  const record = address as Record<string, unknown>;
  return [jsonLdText(record.addressLocality), jsonLdText(record.addressRegion)]
    .filter(Boolean)
    .join(' · ');
}

function jsonLdSalary(job: Record<string, unknown>): string {
  const salary = job.baseSalary;
  if (!salary || typeof salary !== 'object') return '';
  const record = salary as Record<string, unknown>;
  const value = record.value;
  if (value && typeof value === 'object') {
    const v = value as Record<string, unknown>;
    const min = v.minValue ?? v.value;
    const max = v.maxValue;
    const unit = v.unitText;
    if (min && max) return `${min}-${max}${unit ? ` ${unit}` : ''}`;
    if (min) return `${min}${unit ? ` ${unit}` : ''}`;
  }
  if (typeof value === 'number' || typeof value === 'string') return String(value);
  return '';
}

const CITY_NAMES =
  '北京|上海|广州|深圳|杭州|成都|武汉|南京|苏州|西安|长沙|重庆|厦门|天津|东莞|佛山|合肥|郑州|青岛|济南|宁波|无锡|珠海|中山|福州|大连|沈阳|昆明|南昌|贵阳|石家庄|哈尔滨|长春|太原|南宁|海口|兰州|乌鲁木齐|呼和浩特|银川|西宁|拉萨';

function titleKey(value: string): string {
  return value
    .replace(/[\s·•.。…\-—_|/\\()（）[\]【】:：]/g, '')
    .toLowerCase();
}

function firstTextOutsideCards(
  selectors: string[],
  cards: HTMLElement[],
  minLength = 1,
): string {
  for (const selector of selectors) {
    for (const element of document.querySelectorAll<HTMLElement>(selector)) {
      if (!isVisible(element)) continue;
      if (cards.some((card) => card.contains(element))) continue;
      const text = clean(element.innerText || element.textContent || '');
      if (text.length >= minLength) return text;
    }
  }
  return '';
}

function longestTextOutsideCards(
  selectors: string[],
  cards: HTMLElement[],
  minLength = 30,
): string {
  let best = '';
  for (const selector of selectors) {
    for (const element of document.querySelectorAll<HTMLElement>(selector)) {
      if (!isVisible(element)) continue;
      if (cards.some((card) => card.contains(element))) continue;
      const text = clean(element.innerText || element.textContent || '', 30_000);
      if (text.length >= minLength && text.length > best.length) best = text;
    }
  }
  return best;
}

function looksLikeJobCard(element: HTMLElement): boolean {
  if (!isVisible(element)) return false;
  const text = clean(element.innerText || element.textContent || '', 2000);
  if (text.length < 10 || text.length > 1200) return false;
  if (
    element.querySelector(
      '.job-sec-text, .job-detail-section, .job-detail .text, .job-sec .text',
    )
  ) {
    return false;
  }
  return (
    /\d{1,3}\s*-\s*\d{1,3}\s*K/i.test(text) ||
    Boolean(
      element.querySelector(
        '.job-name, .job-title, [class*="job-name"], [class*="job-title"]',
      ),
    )
  );
}

function getJobCards(): HTMLElement[] {
  const set = new Set<HTMLElement>();
  for (const selector of JOB_CARD_SELECTORS) {
    for (const element of document.querySelectorAll<HTMLElement>(selector)) {
      if (looksLikeJobCard(element)) set.add(element);
    }
  }
  for (const anchor of document.querySelectorAll<HTMLAnchorElement>('a[href*="job_detail"]')) {
    if (!isVisible(anchor)) continue;
    const card =
      anchor.closest<HTMLElement>('.job-card-wrapper, .job-card-box, .job-card') ||
      anchor.closest<HTMLElement>('li, article');
    if (card && looksLikeJobCard(card)) set.add(card);
  }
  const all = [...set];
  return all.filter(
    (element) => !all.some((other) => other !== element && other.contains(element)),
  );
}

function stableHash(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}

interface CardLineData {
  title: string;
  salary: string;
  company: string;
  area: string;
  tags: string[];
  experience: string;
  education: string;
}

function parseCardLines(card: HTMLElement): CardLineData {
  const lines = clean(card.innerText || card.textContent || '', 3000)
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  const salaryLine = lines.find((line) => /\d{1,3}\s*-\s*\d{1,3}\s*K/i.test(line)) || '';
  const salary =
    salaryLine.match(/\d{1,3}\s*-\s*\d{1,3}\s*K(?:\s*[·x×*]\s*\d{1,2}薪)?/i)?.[0]?.trim() || '';
  const cityPattern = new RegExp(CITY_NAMES);

  const areaIndex = lines.findIndex(
    (line) =>
      cityPattern.test(line) &&
      (line.includes('·') || /市|区|县/.test(line)),
  );
  let company = '';
  let area = '';
  if (areaIndex >= 0) {
    const line = lines[areaIndex];
    const match = line.match(new RegExp(`^(.*?)(${CITY_NAMES}.*)$`));
    if (match && match[1].trim()) {
      company = clean(match[1], 100);
      area = clean(match[2], 200);
    } else {
      area = line;
      const previous = lines[areaIndex - 1] || '';
      if (
        previous &&
        !/\d{1,3}\s*-\s*\d{1,3}\s*K/i.test(previous) &&
        !/(年|本科|硕士|博士|大专|Java|Python|Go|React|Vue|SQL|Spring|Node)/i.test(previous)
      ) {
        company = previous;
      }
    }
  }

  const salaryIndex = lines.findIndex((line) => /\d{1,3}\s*-\s*\d{1,3}\s*K/i.test(line));
  const title = lines.find(
    (line, index) =>
      index <= Math.max(1, salaryIndex) &&
      line.length >= 2 &&
      !/^(推荐|广告|急聘|新|置顶|hot)$/i.test(line) &&
      !/\d{1,3}\s*-\s*\d{1,3}\s*K/i.test(line) &&
      line !== company &&
      line !== area,
  ) || '';

  const tags = lines
    .filter(
      (line) =>
        line !== salaryLine &&
        line !== area &&
        line !== company &&
        /\d+\s*-\s*\d+\s*年|\d+\s*年以上|经验不限|本科|硕士|博士|大专|Java|Python|Go|React|Vue|SQL|Spring|Node|C\+\+|PHP|前端|后端|算法/i.test(
          line,
        ),
    )
    .slice(0, 10);

  return {
    title,
    salary,
    company,
    area,
    tags,
    experience:
      (card.innerText || '').match(/\d+\s*-\s*\d+\s*年|\d+\s*年以上|\d+\s*年以内|经验不限|应届|在校/)?.[0] || '',
    education:
      (card.innerText || '').match(/本科|硕士|博士|大专|中专|高中|学历不限/)?.[0] || '',
  };
}

function cardTitle(card: HTMLElement): string {
  const explicit = firstText(CARD_TITLE, 2, card);
  if (explicit) return explicit;
  return parseCardLines(card).title;
}

function findMatchingDetailTitle(card: HTMLElement, cards: HTMLElement[]): string {
  const cardTitleText = cardTitle(card);
  const cardKey = titleKey(cardTitleText);
  if (!cardKey) return '';
  const nodes = document.querySelectorAll<HTMLElement>(
    'h1, h2, h3, [class*="job-name"], [class*="job-title"], [class*="job-detail"] [class*="name"], [class*="job-detail"] [class*="title"]',
  );
  for (const node of nodes) {
    if (!isVisible(node)) continue;
    if (cards.some((candidate) => candidate.contains(node))) continue;
    const text = clean(node.innerText || node.textContent || '', 120);
    if (text.length < 2 || text.length > 100) continue;
    const key = titleKey(text);
    if (!key) continue;
    if (key === cardKey) return text;
    const compareLength = Math.min(6, cardKey.length, key.length);
    if (
      compareLength >= 4 &&
      (key.includes(cardKey.slice(0, compareLength)) ||
        cardKey.includes(key.slice(0, compareLength)))
    ) {
      return text;
    }
  }

  const fallbackCandidates: Array<{ text: string; size: number }> = [];
  for (const element of document.querySelectorAll<HTMLElement>('div, span, h1, h2, h3, h4, a')) {
    if (!isVisible(element) || element.children.length > 0) continue;
    if (cards.some((candidate) => candidate.contains(element))) continue;
    const text = clean(element.textContent || '', 100);
    if (text.length < 2 || text.length > 100) continue;
    const key = titleKey(text);
    if (!key) continue;
    const compareLength = Math.min(6, cardKey.length, key.length);
    if (compareLength < 4) continue;
    if (
      !key.includes(cardKey.slice(0, compareLength)) &&
      !cardKey.includes(key.slice(0, compareLength))
    ) {
      continue;
    }
    const size = Number.parseFloat(window.getComputedStyle(element).fontSize) || 0;
    fallbackCandidates.push({ text, size });
  }
  if (fallbackCandidates.length) {
    fallbackCandidates.sort((a, b) => b.size - a.size);
    return fallbackCandidates[0].text;
  }
  return '';
}

function companyFromDetailText(): string {
  const lines = (document.body?.innerText || '')
    .split('\n')
    .map((line) => clean(line, 300))
    .filter(Boolean);
  for (const line of lines) {
    const match = line.match(
      /^(.{2,40}?)\s*[·•]\s*(招聘|人力资源|人事|HRBP|HR|经理|总监|主管|招聘者)/,
    );
    if (match) return clean(match[1], 100);
  }
  for (const line of lines) {
    const match = line.match(/(?:公司|企业)\s*[:：]\s*([^\n]{2,40})/);
    if (match) return clean(match[1], 100);
  }
  return '';
}

let lastClickedCard: {
  element: HTMLElement;
  url: string;
  title: string;
  at: number;
} | null = null;

export function rememberClickedJobCard(card: HTMLElement): void {
  if (!looksLikeJobCard(card)) return;
  const anchor = card.querySelector<HTMLAnchorElement>('a[href*="job_detail"]');
  lastClickedCard = {
    element: card,
    url: anchor?.href || '',
    title: cardTitle(card),
    at: Date.now(),
  };
}

function findSelectedCard(cards: HTMLElement[]): HTMLElement | null {
  if (!cards.length) return null;

  const clicked = lastClickedCard;
  if (clicked && Date.now() - clicked.at < 30 * 60 * 1000) {
    if (document.contains(clicked.element) && looksLikeJobCard(clicked.element)) {
      return clicked.element;
    }
    if (clicked.url) {
      const byUrl = cards.find(
        (card) =>
          (card.querySelector<HTMLAnchorElement>('a[href*="job_detail"]')?.href || '') ===
          clicked.url,
      );
      if (byUrl) return byUrl;
    }
    const clickedKey = titleKey(clicked.title || '');
    if (clickedKey) {
      const byTitle = cards.find((card) => {
        const key = titleKey(cardTitle(card));
        if (!key) return false;
        const compareLength = Math.min(6, key.length, clickedKey.length);
        return (
          key === clickedKey ||
          (compareLength >= 4 &&
            (key.includes(clickedKey.slice(0, compareLength)) ||
              clickedKey.includes(key.slice(0, compareLength))))
        );
      });
      if (byTitle) return byTitle;
    }
  }

  const active = cards.find((card) => {
    const className = typeof card.className === 'string' ? card.className : '';
    return (
      /(^|\s)(active|selected|current|checked|is-active)(\s|$)/i.test(className) ||
      card.getAttribute('aria-selected') === 'true' ||
      Boolean(
        card.querySelector(
          '[class*="job-name"][class*="active"], [class*="job-title"][class*="active"]',
        ),
      )
    );
  });
  if (active) return active;

  const focused = document.activeElement as HTMLElement | null;
  if (focused) {
    let node: HTMLElement | null = focused;
    while (node) {
      if (cards.includes(node)) return node;
      node = node.parentElement;
    }
  }

  const urlJobId = new URLSearchParams(location.search).get('jobId');
  if (urlJobId) {
    const byUrl = cards.find((card) =>
      (card.querySelector<HTMLAnchorElement>('a[href*="job_detail"]')?.href || '').includes(
        urlJobId,
      ),
    );
    if (byUrl) return byUrl;
  }

  for (const card of cards) {
    if (findMatchingDetailTitle(card, cards)) return card;
  }

  return cards.find((card) => card.matches(':hover')) || null;
}

export function extractJobFromPage(): ExtractedJob {
  const cards = getJobCards();
  const isListPage =
    /\/web\/geek\/jobs/.test(location.pathname) ||
    (cards.length >= 3 && !/job_detail\//.test(location.pathname));
  const selectedCard = isListPage ? findSelectedCard(cards) : null;

  let url = location.href;
  if (selectedCard) {
    const anchor = selectedCard.querySelector<HTMLAnchorElement>('a[href*="job_detail"]');
    if (anchor?.href) url = anchor.href;
  }
  if (!/job_detail\//.test(url)) {
    const anchors = [
      ...document.querySelectorAll<HTMLAnchorElement>(
        '.job-detail-box a[href*="job_detail"], .job-banner a[href*="job_detail"], .job-card-wrapper.active a[href*="job_detail"], .job-card-wrapper.selected a[href*="job_detail"]',
      ),
    ];
    const anchor = anchors.find(isVisible) || anchors[0];
    if (anchor) url = anchor.href;
  }
  const jsonJob = findJsonLdJob();
  let platformJobId =
    url.match(/job_detail\/([^./?]+)\.html/)?.[1] ||
    new URLSearchParams(url.split('?')[1] || '').get('jobId') ||
    '';

  let title = firstText(JOB_TITLE, 2);
  if (!title) {
    title = clean(document.title, 120)
      .replace(/\s*[-_|–—]\s*BOSS直聘.*$/i, '')
      .replace(/\s*[-_|–—]\s*招聘.*$/i, '')
      .replace(/招聘$/, '')
      .trim();
  }

  let jdText = collectText(JOB_JD, 20);
  if (!jdText) jdText = longestText(JOB_JD_FALLBACK, 30);
  if (!jdText && jsonJob) jdText = stripHtml(jsonLdText(jsonJob.description));
  if (!jdText) {
    const meta = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    if (meta?.content) jdText = clean(meta.content, 30_000);
  }
  let usedGenericJd = false;
  if (jdText.trim().length < 30) {
    const fallback = genericJdText();
    if (fallback.length > jdText.length) {
      jdText = fallback;
      usedGenericJd = true;
    }
  }

  let salary = firstText(JOB_SALARY, 1);
  if (!salary && jsonJob) salary = jsonLdSalary(jsonJob);
  if (!salary) {
    const header = document.querySelector<HTMLElement>('.job-banner, .job-info, .job-detail-header');
    const match = (header?.innerText || '').match(/\d{1,3}-\d{1,3}K(?:\s*[·x×*]\s*\d{1,2}薪)?/i);
    salary = match?.[0] || '';
  }

  const areaText = firstText(JOB_AREA, 1) || (jsonJob ? jsonLdCity(jsonJob) : '');
  const [cityPart, ...areaParts] = areaText.split(/\s*[·•|]\s*|\n+/);
  let city = (cityPart || '').trim();
  let area = areaParts.map((item) => item.trim()).filter(Boolean).join(' · ');

  const limitText = firstText(JOB_LIMIT, 1);
  let experience =
    limitText.match(/\d+\s*-\s*\d+\s*年|\d+\s*年以上|\d+\s*年以内|经验不限|应届|在校/)?.[0] || '';
  let education =
    limitText.match(/本科|硕士|博士|大专|中专|高中|学历不限/)?.[0] || '';

  let tags = uniqueStrings(
    JOB_TAGS.flatMap((selector) =>
      [...document.querySelectorAll<HTMLElement>(selector)].map(
        (element) => element.innerText || element.textContent || '',
      ),
    ),
    15,
  );

  let company = firstText(JOB_COMPANY, 1);
  if (!company && jsonJob) {
    const org = jsonJob.hiringOrganization;
    if (org && typeof org === 'object') company = jsonLdText((org as Record<string, unknown>).name);
    else if (typeof org === 'string') company = clean(org, 200);
  }

  let companyInfo = longestText(JOB_COMPANY_INFO, 10);
  let hrName = firstText(JOB_HR, 1);
  let hrTitle = firstText(JOB_HR_TITLE, 1);

  if (isListPage) {
    if (!selectedCard) {
      title = '';
      salary = '';
      company = '';
      city = '';
      area = '';
      tags = [];
      jdText = '';
      companyInfo = '';
      hrName = '';
      hrTitle = '';
      experience = '';
      education = '';
      platformJobId = '';
      usedGenericJd = false;
    } else {
      const parsed = parseCardLines(selectedCard);
      const selectedAnchor = selectedCard.querySelector<HTMLAnchorElement>(
        'a[href*="job_detail"]',
      );
      url = selectedAnchor?.href || location.href;

      const detailTitle = findMatchingDetailTitle(selectedCard, cards);
      title = detailTitle || cardTitle(selectedCard) || parsed.title || '';
      salary =
        firstText(CARD_SALARY, 1, selectedCard) ||
        parsed.salary ||
        firstTextOutsideCards(JOB_SALARY, cards, 1) ||
        '';
      company =
        firstText(CARD_COMPANY, 1, selectedCard) ||
        parsed.company ||
        companyFromDetailText() ||
        '';
      const selectedArea = firstText(CARD_AREA, 1, selectedCard) || parsed.area;
      if (selectedArea) {
        const [nextCity, ...rest] = selectedArea.split(/\s*[·•|]\s*|\n+/);
        city = (nextCity || '').trim();
        area = rest.map((item) => item.trim()).filter(Boolean).join(' · ');
      } else {
        const detailArea = firstTextOutsideCards(JOB_AREA, cards, 1);
        if (detailArea) {
          const [nextCity, ...rest] = detailArea.split(/\s*[·•|]\s*|\n+/);
          city = (nextCity || '').trim();
          area = rest.map((item) => item.trim()).filter(Boolean).join(' · ');
        }
      }
      const cardTags = uniqueStrings(
        CARD_TAGS.flatMap((selector) =>
          [...selectedCard.querySelectorAll<HTMLElement>(selector)].map(
            (element) => element.innerText || element.textContent || '',
          ),
        ),
        15,
      );
      tags = cardTags.length ? cardTags : parsed.tags;
      const jdOutside = longestTextOutsideCards(JOB_JD, cards, 30);
      if (jdOutside) {
        jdText = jdOutside;
        usedGenericJd = false;
      }
      if (parsed.experience) experience = parsed.experience;
      if (parsed.education) education = parsed.education;
      companyInfo = longestTextOutsideCards(JOB_COMPANY_INFO, cards, 10);
      hrName = firstTextOutsideCards(JOB_HR, cards, 1) || hrName;
      hrTitle = firstTextOutsideCards(JOB_HR_TITLE, cards, 1) || hrTitle;
      const dataId =
        selectedCard.getAttribute('data-jobid') ||
        selectedCard.getAttribute('data-job-id') ||
        selectedCard.getAttribute('data-lid') ||
        '';
      platformJobId =
        url.match(/job_detail\/([^./?]+)\.html/)?.[1] ||
        new URLSearchParams(url.split('?')[1] || '').get('jobId') ||
        dataId ||
        `card_${stableHash(`${title}|${company}|${salary}`)}`;
    }
  }

  const issues: string[] = [];
  if (isListPage && !selectedCard) {
    issues.push('未识别当前选中的岗位，请先点击左侧职位卡片，或打开职位详情');
  }
  if (!title) issues.push('未读取到岗位名称');
  if (jdText.length < 30) issues.push('未读取到完整 JD，请展开职位详情或手动粘贴');
  if (usedGenericJd) issues.push('页面结构未完全匹配，已使用全文兜底识别 JD，请核对');
  if (!company) issues.push('未读取到公司名称');
  if (!platformJobId) issues.push('未识别到岗位 ID，重开页面可能会重复记录');

  const input: CapturedJobInput = {
    platform: 'boss',
    platformJobId,
    url,
    title,
    company,
    salary,
    city,
    area,
    experience,
    education,
    tags,
    jdText,
    hrName,
    hrTitle,
    companyInfo: companyInfo.slice(0, 4000),
    source: 'page',
  };

  return { input, issues };
}

export function collectPageDiagnostics(): string {
  const classes = [
    ...new Set(
      [...document.querySelectorAll<HTMLElement>('[class]')]
        .flatMap((element) =>
          typeof element.className === 'string' ? element.className.split(/\s+/) : [],
        )
        .filter((value) =>
          /job|salary|company|detail|desc|position|boss|chat|report|verify|captcha/i.test(value),
        ),
    ),
  ].slice(0, 80);
  let extensionVersion = 'unknown';
  try {
    extensionVersion = chrome.runtime.getManifest().version;
  } catch {
    // 非扩展环境
  }
  let extracted: ExtractedJob | null = null;
  try {
    extracted = extractJobFromPage();
  } catch {
    extracted = null;
  }
  return JSON.stringify(
    {
      extensionVersion,
      url: location.href,
      title: document.title,
      pageKind: getPageKind(),
      pathname: location.pathname,
      hasJobDetailPath: /job_detail\//.test(location.pathname),
      detected: {
        title: extracted?.input.title || '',
        salary: extracted?.input.salary || '',
        company: extracted?.input.company || '',
        jdLength: extracted?.input.jdText.length || 0,
        jdPreview: (extracted?.input.jdText || '').slice(0, 300),
        issues: extracted?.issues || [],
      },
      classes,
      textPreview: clean(document.body?.innerText || '', 800),
    },
    null,
    2,
  );
}

export function getPageKind(): PageKind {
  const path = location.pathname.toLowerCase();
  if (path.includes('/chat')) return 'chat';
  if (
    path.includes('job_detail') ||
    document.querySelector('.job-sec-text, .job-detail, .job-banner, .job-card-wrapper')
  ) {
    return 'job';
  }
  return 'other';
}

export function findChatInput(): HTMLElement | null {
  const candidates: HTMLElement[] = [];
  for (const selector of CHAT_INPUT) {
    for (const element of document.querySelectorAll<HTMLElement>(selector)) {
      if (!isVisible(element)) continue;
      if (element.tagName === 'TEXTAREA' || element.isContentEditable) {
        candidates.push(element);
      } else {
        const editable = element.querySelector<HTMLElement>('[contenteditable="true"], textarea');
        if (editable && isVisible(editable)) candidates.push(editable);
      }
    }
  }
  const unique = [...new Set(candidates)];
  return unique.sort((a, b) => {
    const rectA = a.getBoundingClientRect();
    const rectB = b.getBoundingClientRect();
    return rectB.bottom - rectA.bottom;
  })[0] || null;
}

export function hasChatInput(): boolean {
  return Boolean(findChatInput());
}

function editorText(element: HTMLElement): string {
  if (element instanceof HTMLTextAreaElement || element instanceof HTMLInputElement) {
    return element.value;
  }
  return element.innerText || element.textContent || '';
}

function setEditorText(element: HTMLElement, text: string): void {
  element.focus();
  if (element instanceof HTMLTextAreaElement || element instanceof HTMLInputElement) {
    const prototype = Object.getPrototypeOf(element);
    const descriptor = Object.getOwnPropertyDescriptor(prototype, 'value');
    descriptor?.set?.call(element, text);
    element.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: text }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
    return;
  }

  const selection = window.getSelection();
  const range = document.createRange();
  range.selectNodeContents(element);
  selection?.removeAllRanges();
  selection?.addRange(range);
  document.execCommand('insertText', false, text);
  if (!editorText(element).trim()) {
    element.textContent = text;
    element.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: text }));
  }
}

function findSendButton(input: HTMLElement): HTMLElement | null {
  const scope =
    input.closest('.chat-input, .chat-editor, .chat-form, .chat-bottom, .chat-footer') ||
    input.parentElement ||
    document;
  const all = [
    ...(scope as HTMLElement).querySelectorAll<HTMLElement>('button, [role="button"], a, div, span'),
  ];
  const candidates = all.filter((element) => {
    if (!isVisible(element)) return false;
    if (element === input || element.contains(input)) return false;
    const text = clean(element.innerText || element.textContent || '', 20);
    const className = typeof element.className === 'string' ? element.className : '';
    return text === '发送' || /send/i.test(className);
  });
  if (!candidates.length) {
    const globalCandidates = [
      ...document.querySelectorAll<HTMLElement>(
        'button, a, [role="button"], .send-message, .btn-send, .send-btn, [class*="send"]',
      ),
    ].filter((element) => {
      if (!isVisible(element)) return false;
      const text = clean(element.innerText || element.textContent || '', 20);
      return text === '发送' || element.matches('.send-message, .btn-send, .send-btn');
    });
    candidates.push(...globalCandidates);
  }
  const inputRect = input.getBoundingClientRect();
  candidates.sort((a, b) => {
    const rectA = a.getBoundingClientRect();
    const rectB = b.getBoundingClientRect();
    const distanceA = Math.abs(rectA.bottom - inputRect.bottom) + Math.abs(rectA.right - inputRect.right);
    const distanceB = Math.abs(rectB.bottom - inputRect.bottom) + Math.abs(rectB.right - inputRect.right);
    return distanceA - distanceB;
  });
  return candidates[0] || null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

async function waitForInput(timeoutMs = 8000): Promise<HTMLElement | null> {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const input = findChatInput();
    if (input) return input;
    await sleep(300);
  }
  return null;
}

export async function openChatForJob(): Promise<{ clicked: boolean; hasInput: boolean; message?: string }> {
  if (findChatInput()) return { clicked: false, hasInput: true };
  const wanted = ['立即沟通', '继续沟通', '打招呼', '沟通'];
  const candidates = [
    ...document.querySelectorAll<HTMLElement>('button, a, [role="button"], .btn, .op-btn, span'),
  ].filter((element) => {
    if (!isVisible(element)) return false;
    const text = clean(element.innerText || element.textContent || '', 20);
    return wanted.includes(text);
  });
  if (!candidates.length) {
    return { clicked: false, hasInput: false, message: '页面中没有找到「立即沟通」按钮，请手动打开聊天窗口' };
  }
  candidates.sort((a, b) => {
    const score = (element: HTMLElement) => {
      let value = 0;
      if (element.closest('.job-detail, .job-banner, .job-card-wrapper, .job-info, .job-detail-box')) value += 2;
      if (element.matches('button, a, .btn, .op-btn') || element.closest('button, a')) value += 1;
      return value;
    };
    return score(b) - score(a);
  });
  const button = candidates[0];
  const clickable = (button.closest('button, a') as HTMLElement) || button;
  clickable.click();
  await sleep(500);
  const dialog = [...document.querySelectorAll<HTMLElement>('.dialog, .modal, .boss-dialog, [role="dialog"]')]
    .filter(isVisible)
    .map((element) => clean(element.innerText || '', 300))
    .join(' ');
  if (/完善简历|先完善|无法沟通|账号异常|验证码|安全验证/.test(dialog)) {
    return { clicked: true, hasInput: false, message: dialog.slice(0, 200) };
  }
  const input = await waitForInput(8000);
  return {
    clicked: true,
    hasInput: Boolean(input),
    message: input ? undefined : '已点击沟通，但没有找到聊天输入框，请手动打开聊天窗口',
  };
}

export async function sendChatMessage(text: string, send = true): Promise<SendResult> {
  const input = await waitForInput(8000);
  if (!input) {
    return {
      ok: false,
      filled: false,
      sent: false,
      error: '未找到聊天输入框。请先打开与该 HR 的聊天窗口，再重试。',
    };
  }
  setEditorText(input, text);
  await sleep(250);
  if (!editorText(input).trim()) {
    return { ok: false, filled: false, sent: false, error: '内容未能填入聊天框，请手动复制发送。' };
  }
  if (!send) return { ok: true, filled: true, sent: false };

  const button = findSendButton(input);
  if (button) button.click();
  else {
    for (const type of ['keydown', 'keypress', 'keyup']) {
      input.dispatchEvent(
        new KeyboardEvent(type, {
          key: 'Enter',
          code: 'Enter',
          keyCode: 13,
          which: 13,
          bubbles: true,
          cancelable: true,
        }),
      );
    }
  }
  await sleep(700);
  const remaining = editorText(input).trim();
  if (remaining.length > Math.max(3, text.length * 0.8)) {
    return {
      ok: true,
      filled: true,
      sent: false,
      uncertain: true,
      error: '已尝试点击发送，但输入框仍有内容。请到聊天窗口确认是否发出。',
    };
  }
  return { ok: true, filled: true, sent: true };
}

function hashKey(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function selectedConversationText(): string {
  const selectors = [
    '.chat-user-list .active',
    '.user-list .active',
    '.chat-user-item.active',
    '.conversation-item.active',
    '.chat-list-item.active',
    '.chat-user.active',
  ];
  for (const selector of selectors) {
    const element = document.querySelector<HTMLElement>(selector);
    if (element && isVisible(element)) return clean(element.innerText || '', 300);
  }
  return '';
}

function elementRole(element: HTMLElement, root: HTMLElement): 'me' | 'hr' | 'system' {
  const classes: string[] = [];
  let node: HTMLElement | null = element;
  while (node && node !== root.parentElement) {
    if (typeof node.className === 'string') classes.push(node.className);
    node = node.parentElement;
    if (classes.length > 4) break;
  }
  const chain = classes.join(' ');
  if (/system|notice|tip|divider|time/i.test(chain)) return 'system';
  if (/(^|\s)(item-myself|myself|message-myself|message-me|chat-me|is-me|self|right)(\s|$)/i.test(chain)) {
    return 'me';
  }
  if (/(^|\s)(item-friend|friend|message-other|message-him|is-other|other|left|boss)(\s|$)/i.test(chain)) {
    return 'hr';
  }
  const rootRect = root.getBoundingClientRect();
  const rect = element.getBoundingClientRect();
  if (rect.width && rootRect.width) {
    const center = rect.left + rect.width / 2;
    if (center > rootRect.left + rootRect.width * 0.62) return 'me';
    if (center < rootRect.left + rootRect.width * 0.38) return 'hr';
  }
  return 'hr';
}

function textInside(element: HTMLElement): string {
  for (const selector of MESSAGE_TEXT) {
    const node = element.querySelector<HTMLElement>(selector);
    if (node) {
      const text = clean(node.innerText || node.textContent || '', 2000);
      if (text && !/^\d{1,2}:\d{2}$/.test(text)) return text;
    }
  }
  const lines = (element.innerText || element.textContent || '')
    .split('\n')
    .map((line) => clean(line, 500))
    .filter((line) => line && !/^\d{1,2}:\d{2}$/.test(line) && !/^(已读|送达|发送失败)$/.test(line));
  return lines.join('\n').slice(0, 2000);
}

export function extractChatContext(): ChatContext | null {
  const roots = [...new Set(CHAT_ROOTS.flatMap((selector) => [
    ...document.querySelectorAll<HTMLElement>(selector),
  ]))].filter(isVisible);

  let root: HTMLElement | null = null;
  let bestCount = 0;
  for (const candidate of roots) {
    const count = candidate.querySelectorAll('.message-item, .chat-message-item, .item-message, .chat-message').length;
    if (count > bestCount) {
      bestCount = count;
      root = candidate;
    }
  }
  if (!root) root = roots[0] || null;
  if (!root) return null;

  const rawItems = [...new Set(MESSAGE_ITEMS.flatMap((selector) => [
    ...root!.querySelectorAll<HTMLElement>(selector),
  ]))].filter(isVisible);
  const withoutWrappers = rawItems.filter(
    (element) => rawItems.filter((other) => other !== element && element.contains(other)).length <= 1,
  );
  const topLevel = withoutWrappers.filter(
    (element) =>
      !withoutWrappers.some((other) => other !== element && other.contains(element)),
  );
  topLevel.sort((a, b) =>
    a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1,
  );

  const hrName =
    firstText(
      [
        '.chat-user-name',
        '.chat-header .name',
        '.chat-conversation-header .name',
        '.chat-title .name',
        '.chat-top .name',
      ],
      1,
      root,
    ) ||
    clean(selectedConversationText().split('\n')[0] || '', 50) ||
    'HR';

  const jobTitle = firstText(
    ['.chat-job-name', '.chat-job .name', '.job-name', '.chat-position', '.job-title'],
    1,
    root,
  );
  const company = firstText(
    ['.chat-company', '.company-name', '.job-company', '.chat-job .company', '.company'],
    1,
    root,
  );
  const jobLink = root.querySelector<HTMLAnchorElement>('a[href*="job_detail"]');
  const jobUrl = jobLink?.href || '';

  const messages: ChatMessage[] = [];
  for (const item of topLevel) {
    const role = elementRole(item, root);
    if (role === 'system') continue;
    const text = textInside(item);
    if (!text) continue;
    if (/撤回了一条消息|对方正在输入|已读|系统消息/.test(text)) continue;
    const previous = messages[messages.length - 1];
    if (previous && previous.role === role && previous.text === text) continue;
    messages.push({ role, text });
  }

  if (!messages.length) return null;
  const limited = messages.slice(-20);
  const conversationKey = `boss_${hashKey(
    `${hrName}|${company}|${jobTitle}|${jobUrl || location.pathname}`,
  )}`;

  return {
    conversationKey,
    hrName,
    company,
    jobTitle,
    jobUrl,
    messages: limited,
  };
}

function decodeBase64(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

export async function attachResumePdf(
  base64: string,
  filename: string,
  mime = 'application/pdf',
): Promise<{ ok: boolean; message: string }> {
  const findFileInput = (): HTMLInputElement | null => {
    const inputs = [...document.querySelectorAll<HTMLInputElement>('input[type="file"]')];
    return (
      inputs.find((input) => {
        const accept = (input.accept || '').toLowerCase();
        return !accept || accept.includes('pdf') || accept.includes('*') || accept.includes('application');
      }) || null
    );
  };

  let input = findFileInput();
  if (!input) {
    const trigger = [
      ...document.querySelectorAll<HTMLElement>('button, [role="button"], i, span, div'),
    ].find((element) => {
      if (!isVisible(element)) return false;
      const text = clean(element.innerText || element.textContent || '', 20);
      const className = typeof element.className === 'string' ? element.className : '';
      if (text !== '+' && !/plus|upload|file|attach/i.test(className)) return false;
      return Boolean(element.closest('.chat-input, .chat-editor, .chat-tool, .chat-operate, .chat-footer'));
    });
    if (trigger) {
      trigger.click();
      await sleep(500);
      const menuItem = [...document.querySelectorAll<HTMLElement>('li, button, div, span, a')].find(
        (element) => {
          if (!isVisible(element)) return false;
          const text = clean(element.innerText || element.textContent || '', 20);
          return text === '发送文件' || text === '文件' || text === '上传文件';
        },
      );
      menuItem?.click();
      await sleep(600);
      input = findFileInput();
    }
  }

  if (!input) {
    return {
      ok: false,
      message: '没有找到聊天文件上传入口。本轮未自动发送，请用「下载 PDF」后手动添加附件。',
    };
  }

  try {
    const bytes = decodeBase64(base64);
    const buffer = new ArrayBuffer(bytes.byteLength);
    new Uint8Array(buffer).set(bytes);
    const file = new File([buffer], filename || '简历.pdf', { type: mime });
    const transfer = new DataTransfer();
    transfer.items.add(file);
    input.files = transfer.files;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    return {
      ok: true,
      message: '已选择 PDF 文件。请在 BOSS 弹窗或聊天框中确认发送；平台可能要求你手动点击发送。',
    };
  } catch (error) {
    return {
      ok: false,
      message: `自动选择文件失败：${error instanceof Error ? error.message : String(error)}。请手动添加附件。`,
    };
  }
}
