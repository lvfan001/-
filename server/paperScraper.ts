import fs from 'node:fs';
import path from 'node:path';
import type { ExamSession } from '../src/types/chemistry.ts';

const PDF_CACHE_DIR = '/tmp/pc_pdf_cache';
const PAPACAMBRIDGE_BASE = 'https://pastpapers.papacambridge.com';
const PAPACAMBRIDGE_INDEX_URL = `${PAPACAMBRIDGE_BASE}/papers/caie/as-and-a-level-chemistry-9701`;
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

export interface ScrapedSessionEntry {
  year: number;
  sessionCode: ExamSession;
  sessionLabel: string;
  slug: string;
  pageUrl: string;
}

export interface ScrapedYearGroup {
  year: number;
  sessions: ScrapedSessionEntry[];
}

export interface ScrapedPdfFile {
  fileName: string;
  remoteUrl: string;
  kind: 'qp' | 'ms' | 'ci' | 'er' | 'gt' | 'other';
}

export interface ScrapedPaperVariant {
  paperNumber: 1 | 2 | 3 | 4 | 5;
  variant: number;
  componentCode: string; // e.g., "42"
  paperCode: string; // e.g., "9701/42/M/J/26"
  qp?: ScrapedPdfFile;
  ms?: ScrapedPdfFile;
  ci?: ScrapedPdfFile;
}

export interface ScrapedPaperGroup {
  paperNumber: 1 | 2 | 3 | 4 | 5;
  paperLabel: string;
  paperLabelZh: string;
  variants: ScrapedPaperVariant[];
}

export interface ScrapedSessionData {
  year: number;
  sessionCode: ExamSession;
  sessionLabel: string;
  slug: string;
  pageUrl: string;
  scrapedAt: string;
  totalPdfCount: number;
  papers: ScrapedPaperGroup[];
  extras: ScrapedPdfFile[];
}

const PAPER_META: Record<1 | 2 | 3 | 4 | 5, { label: string; labelZh: string }> = {
  1: { label: 'Paper 1 · Multiple Choice', labelZh: 'AS 选择题' },
  2: { label: 'Paper 2 · AS Level Structured Questions', labelZh: 'AS 结构化简答题' },
  3: { label: 'Paper 3 · Advanced Practical Skills', labelZh: 'AS 实验操作卷' },
  4: { label: 'Paper 4 · A Level Structured Questions', labelZh: 'A2 结构化简答题' },
  5: { label: 'Paper 5 · Planning, Analysis & Evaluation', labelZh: 'A2 实验设计与数据分析' },
};

let sessionsCache: { fetchedAt: number; years: ScrapedYearGroup[] } | null = null;
const sessionFilesCache = new Map<string, { fetchedAt: number; data: ScrapedSessionData }>();
const inFlightDownloads = new Map<string, Promise<string | null>>();

function parseSlugMeta(slug: string): {
  year: number;
  sessionCode: ExamSession;
  sessionLabel: string;
} | null {
  const m = slug.match(/as-and-a-level-chemistry-9701-(\d{4})-(.+)$/i);
  if (!m) return null;
  const year = Number(m[1]);
  if (!Number.isInteger(year) || year < 2016 || year > 2030) return null;
  const rawSess = m[2].toLowerCase();

  let sessionCode: ExamSession;
  let sessionLabel: string;
  if (rawSess.includes('mar')) {
    sessionCode = 'F/M';
    sessionLabel = 'Feb / March';
  } else if (rawSess.includes('may') || rawSess.includes('jun')) {
    sessionCode = 'M/J';
    sessionLabel = 'May / June';
  } else if (rawSess.includes('oct') || rawSess.includes('nov')) {
    sessionCode = 'O/N';
    sessionLabel = 'Oct / Nov';
  } else {
    return null;
  }

  return { year, sessionCode, sessionLabel };
}

function buildFallbackYears(): ScrapedYearGroup[] {
  const years = [2026, 2025, 2024, 2023, 2022, 2021];
  return years.map((year) => {
    const sessions: ScrapedSessionEntry[] = [];
    if (year < 2026) {
      sessions.push({
        year,
        sessionCode: 'O/N',
        sessionLabel: 'Oct / Nov',
        slug: `as-and-a-level-chemistry-9701-${year}-oct-nov`,
        pageUrl: `${PAPACAMBRIDGE_BASE}/papers/caie/as-and-a-level-chemistry-9701-${year}-oct-nov`,
      });
    }
    sessions.push({
      year,
      sessionCode: 'M/J',
      sessionLabel: 'May / June',
      slug: `as-and-a-level-chemistry-9701-${year}-may-june`,
      pageUrl: `${PAPACAMBRIDGE_BASE}/papers/caie/as-and-a-level-chemistry-9701-${year}-may-june`,
    });
    sessions.push({
      year,
      sessionCode: 'F/M',
      sessionLabel: 'Feb / March',
      slug: `as-and-a-level-chemistry-9701-${year}-${year === 2022 ? 'feb-march' : 'march'}`,
      pageUrl: `${PAPACAMBRIDGE_BASE}/papers/caie/as-and-a-level-chemistry-9701-${year}-${year === 2022 ? 'feb-march' : 'march'}`,
    });
    return { year, sessions };
  });
}

export async function scrapeAvailableSessions(forceRefresh = false): Promise<ScrapedYearGroup[]> {
  if (!forceRefresh && sessionsCache && Date.now() - sessionsCache.fetchedAt < CACHE_TTL_MS) {
    return sessionsCache.years;
  }

  try {
    const resp = await fetch(PAPACAMBRIDGE_INDEX_URL, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml',
      },
      signal: AbortSignal.timeout(15000),
    });
    if (!resp.ok) {
      throw new Error(`HTTP ${resp.status}`);
    }
    const html = await resp.text();
    const rawMatches = [
      ...html.matchAll(
        /href=["'](?:https?:\/\/pastpapers\.papacambridge\.com\/)?\/?(papers\/caie\/as-and-a-level-chemistry-9701-20\d{2}-[a-z-]+)["']/gi
      ),
    ];

    const seenSlugs = new Set<string>();
    const entries: ScrapedSessionEntry[] = [];
    for (const match of rawMatches) {
      const relPath = match[1].replace(/^\/+/, '');
      const slug = relPath.replace(/^papers\/caie\//i, '');
      if (seenSlugs.has(slug)) continue;
      seenSlugs.add(slug);

      const meta = parseSlugMeta(slug);
      if (!meta) continue;
      entries.push({
        year: meta.year,
        sessionCode: meta.sessionCode,
        sessionLabel: meta.sessionLabel,
        slug,
        pageUrl: `${PAPACAMBRIDGE_BASE}/papers/caie/${slug}`,
      });
    }

    if (entries.length === 0) {
      return buildFallbackYears();
    }

    const byYear = new Map<number, ScrapedSessionEntry[]>();
    for (const e of entries) {
      const list = byYear.get(e.year) ?? [];
      list.push(e);
      byYear.set(e.year, list);
    }

    const sessionOrder: Record<ExamSession, number> = { 'O/N': 0, 'M/J': 1, 'F/M': 2 };
    const years: ScrapedYearGroup[] = Array.from(byYear.entries())
      .sort((a, b) => b[0] - a[0])
      .map(([year, sessions]) => ({
        year,
        sessions: sessions.sort((a, b) => sessionOrder[a.sessionCode] - sessionOrder[b.sessionCode]),
      }));

    sessionsCache = { fetchedAt: Date.now(), years };
    return years;
  } catch {
    return buildFallbackYears();
  }
}

export async function scrapeSessionFiles(
  slug: string,
  forceRefresh = false
): Promise<ScrapedSessionData> {
  if (!/^as-and-a-level-chemistry-9701-\d{4}-[a-z-]+$/i.test(slug)) {
    throw new Error('非法的考季目录标识');
  }

  const cached = sessionFilesCache.get(slug);
  if (!forceRefresh && cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.data;
  }

  const meta = parseSlugMeta(slug) ?? {
    year: 2026,
    sessionCode: 'M/J' as ExamSession,
    sessionLabel: 'May / June',
  };
  const pageUrl = `${PAPACAMBRIDGE_BASE}/papers/caie/${slug}`;

  const resp = await fetch(pageUrl, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml',
    },
    signal: AbortSignal.timeout(15000),
  });

  if (!resp.ok) {
    throw new Error(`抓取真题网页失败 (HTTP ${resp.status})`);
  }

  const html = await resp.text();
  const pdfUrls = Array.from(
    new Set(
      [
        ...html.matchAll(
          /files=(https:\/\/pastpapers\.papacambridge\.com\/directories\/CAIE\/CAIE-pastpapers\/upload\/[^"'&\s]+\.pdf)/gi
        ),
      ].map((m) => m[1])
    )
  );

  // Also check direct upload hrefs in case page structure varies
  for (const m of html.matchAll(
    /(https:\/\/pastpapers\.papacambridge\.com\/directories\/CAIE\/CAIE-pastpapers\/upload\/9701_[^"'&\s]+\.pdf)/gi
  )) {
    if (!pdfUrls.includes(m[1])) {
      pdfUrls.push(m[1]);
    }
  }

  const variantMaps: Record<1 | 2 | 3 | 4 | 5, Map<string, ScrapedPaperVariant>> = {
    1: new Map(),
    2: new Map(),
    3: new Map(),
    4: new Map(),
    5: new Map(),
  };
  const extras: ScrapedPdfFile[] = [];

  for (const remoteUrl of pdfUrls) {
    const fileName = decodeURIComponent(remoteUrl.split('/').pop() ?? '');
    const compMatch = fileName.match(/^9701_([msw])(\d{2})_(qp|ms|ci)_(\d)(\d)\.pdf$/i);

    if (compMatch) {
      const sessChar = compMatch[1].toLowerCase();
      const yy = compMatch[2];
      const kind = compMatch[3].toLowerCase() as 'qp' | 'ms' | 'ci';
      const pNum = Number(compMatch[4]) as 1 | 2 | 3 | 4 | 5;
      const variant = Number(compMatch[5]);

      if (![1, 2, 3, 4, 5].includes(pNum)) continue;

      const componentCode = `${pNum}${variant}`;
      const sessCode: ExamSession = sessChar === 'm' ? 'F/M' : sessChar === 's' ? 'M/J' : 'O/N';
      const paperCode = `9701/${componentCode}/${sessCode}/${yy}`;

      let entry = variantMaps[pNum].get(componentCode);
      if (!entry) {
        entry = {
          paperNumber: pNum,
          variant,
          componentCode,
          paperCode,
        };
        variantMaps[pNum].set(componentCode, entry);
      }
      entry[kind] = { fileName, remoteUrl, kind };
      continue;
    }

    const extraMatch = fileName.match(/^9701_[msw]\d{2}_(er|gt|in|tn)\.pdf$/i);
    if (extraMatch) {
      const k = extraMatch[1].toLowerCase();
      extras.push({
        fileName,
        remoteUrl,
        kind: k === 'er' ? 'er' : k === 'gt' ? 'gt' : 'other',
      });
    }
  }

  const papers: ScrapedPaperGroup[] = ([1, 2, 3, 4, 5] as const).map((pNum) => ({
    paperNumber: pNum,
    paperLabel: PAPER_META[pNum].label,
    paperLabelZh: PAPER_META[pNum].labelZh,
    variants: Array.from(variantMaps[pNum].values()).sort(
      (a, b) => a.variant - b.variant || a.componentCode.localeCompare(b.componentCode)
    ),
  }));

  extras.sort((a, b) => a.fileName.localeCompare(b.fileName));

  const data: ScrapedSessionData = {
    year: meta.year,
    sessionCode: meta.sessionCode,
    sessionLabel: meta.sessionLabel,
    slug,
    pageUrl,
    scrapedAt: new Date().toISOString(),
    totalPdfCount: pdfUrls.length,
    papers,
    extras,
  };

  sessionFilesCache.set(slug, { fetchedAt: Date.now(), data });
  return data;
}

export function isValid9701PdfFilename(fileName: string): boolean {
  return /^9701_[msw]\d{2}_[a-z0-9_]+\.pdf$/i.test(fileName);
}

export async function downloadAndCache9701Pdf(fileName: string): Promise<string | null> {
  if (!isValid9701PdfFilename(fileName)) {
    return null;
  }

  fs.mkdirSync(PDF_CACHE_DIR, { recursive: true });
  const targetPath = path.join(PDF_CACHE_DIR, fileName);
  if (fs.existsSync(targetPath) && fs.statSync(targetPath).size > 2000) {
    return targetPath;
  }

  const existing = inFlightDownloads.get(fileName);
  if (existing) return existing;

  const job = (async () => {
    const m = fileName.match(/^9701_[msw](\d{2})_/i);
    const year = m ? 2000 + Number(m[1]) : 2025;
    const candidateUrls = [
      `${PAPACAMBRIDGE_BASE}/directories/CAIE/CAIE-pastpapers/upload/${fileName}`,
      `https://bestexamhelp.com/exam/cambridge-international-a-level/chemistry-9701/${year}/${fileName}`,
    ];

    for (const url of candidateUrls) {
      try {
        const res = await fetch(url, {
          headers: {
            'User-Agent':
              'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
            Accept: 'application/pdf,*/*',
          },
          signal: AbortSignal.timeout(30000),
        });
        if (!res.ok) continue;
        const buf = Buffer.from(await res.arrayBuffer());
        if (buf.length > 2000 && buf.subarray(0, 4).toString('utf8') === '%PDF') {
          fs.writeFileSync(targetPath, buf);
          return targetPath;
        }
      } catch {
        // try next candidate
      }
    }
    return null;
  })();

  inFlightDownloads.set(fileName, job);
  try {
    return await job;
  } finally {
    inFlightDownloads.delete(fileName);
  }
}
