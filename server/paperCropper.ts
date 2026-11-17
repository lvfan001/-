import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

const execFileAsync = promisify(execFile);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const PDF_CACHE_DIR = '/tmp/pc_pdf_cache';
const RENDER_CACHE_DIR = '/tmp/pc_render_cache';

const inFlightFileJobs = new Map<string, Promise<string | null>>();
const inFlightPdfDownloads = new Map<string, Promise<string | null>>();
const inFlightPdfRenders = new Map<string, Promise<string[]>>();

function ensureFontmap() {
  if (fs.existsSync('/tmp/Fontmap')) return;
  const fontmap = [
    '/Helvetica (/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf) ;',
    '/Helvetica-Bold (/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf) ;',
    '/Helvetica-Oblique (/usr/share/fonts/truetype/liberation/LiberationSans-Italic.ttf) ;',
    '/Helvetica-BoldOblique (/usr/share/fonts/truetype/liberation/LiberationSans-BoldItalic.ttf) ;',
    '/ArialMT (/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf) ;',
    '/Arial-BoldMT (/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf) ;',
    '/Times-Roman (/usr/share/fonts/truetype/liberation/LiberationSerif-Regular.ttf) ;',
    '/Times-Bold (/usr/share/fonts/truetype/liberation/LiberationSerif-Bold.ttf) ;',
    '/Courier (/usr/share/fonts/truetype/liberation/LiberationMono-Regular.ttf) ;',
  ].join('\n');
  fs.writeFileSync('/tmp/Fontmap', fontmap);
}

export async function downloadExamPdf(pdfFileName: string): Promise<string | null> {
  fs.mkdirSync(PDF_CACHE_DIR, { recursive: true });
  const targetPath = path.join(PDF_CACHE_DIR, pdfFileName);
  if (fs.existsSync(targetPath) && fs.statSync(targetPath).size > 10000) {
    return targetPath;
  }
  const existing = inFlightPdfDownloads.get(pdfFileName);
  if (existing) return existing;

  const job = (async () => {
    const m = pdfFileName.match(/^9701_[msw](\d{2})_(?:qp|ms)_\d\d\.pdf$/);
    const year = m ? 2000 + Number(m[1]) : 2024;
    const urls = [
      `https://pastpapers.papacambridge.com/directories/CAIE/CAIE-pastpapers/upload/${pdfFileName}`,
      `https://papers.gceguide.cc/a-levels/chemistry-(9701)/${year}/${pdfFileName}`,
      `https://bestexamhelp.com/exam/cambridge-international-a-level/chemistry-9701/${year}/${pdfFileName}`,
    ];
    for (const url of urls) {
      try {
        const res = await fetch(url, {
          headers: { 'User-Agent': 'Mozilla/5.0' },
          signal: AbortSignal.timeout(30000),
        });
        if (!res.ok) continue;
        const buf = Buffer.from(await res.arrayBuffer());
        if (buf.length > 10000 && buf.subarray(0, 4).toString() === '%PDF') {
          fs.writeFileSync(targetPath, buf);
          return targetPath;
        }
      } catch {
        // try next mirror
      }
    }
    return null;
  })();

  inFlightPdfDownloads.set(pdfFileName, job);
  try {
    return await job;
  } finally {
    inFlightPdfDownloads.delete(pdfFileName);
  }
}

interface TextItem {
  str: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

interface PageText {
  pageNum: number;
  width: number;
  height: number;
  items: TextItem[];
}

interface TextRow {
  y: number;
  items: TextItem[];
  text: string;
}

async function getPagesText(pdfPath: string): Promise<PageText[]> {
  const data = new Uint8Array(fs.readFileSync(pdfPath));
  const doc = await pdfjsLib.getDocument({ data, verbosity: 0 }).promise;
  const pages: PageText[] = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const vp = page.getViewport({ scale: 1 });
    const tc = await page.getTextContent();
    const items: TextItem[] = [];
    for (const it of tc.items as Array<{ str?: string; transform?: number[]; width?: number; height?: number }>) {
      if (!it.str || !it.str.trim() || !it.transform) continue;
      const m = pdfjsLib.Util.transform(vp.transform, it.transform);
      items.push({ str: it.str, x: m[4], y: m[5], w: it.width || 0, h: it.height || 10 });
    }
    pages.push({ pageNum: p, width: vp.width, height: vp.height, items });
  }
  return pages;
}

function groupRows(items: TextItem[]): TextRow[] {
  const sorted = [...items].sort((a, b) => a.y - b.y || a.x - b.x);
  const rows: TextRow[] = [];
  for (const it of sorted) {
    const last = rows[rows.length - 1];
    if (last && Math.abs(last.y - it.y) <= 4.5) {
      last.items.push(it);
      last.y = (last.y + it.y) / 2;
    } else {
      rows.push({ y: it.y, items: [it], text: '' });
    }
  }
  for (const r of rows) {
    r.items.sort((a, b) => a.x - b.x);
    r.text = r.items.map((i) => i.str).join(' ').replace(/\s+/g, ' ').trim();
  }
  return rows;
}

async function ensureRenderedPdf(pdfPath: string): Promise<string[]> {
  const active = inFlightPdfRenders.get(pdfPath);
  if (active) return active;

  const stem = path.basename(pdfPath, '.pdf');
  const outDir = path.join(RENDER_CACHE_DIR, stem);
  const doneMarker = path.join(outDir, '.done');
  fs.mkdirSync(outDir, { recursive: true });
  if (fs.existsSync(doneMarker)) {
    const existing = fs.readdirSync(outDir).filter((f) => f.endsWith('.png')).sort();
    if (existing.length > 0) {
      return existing.map((f) => path.join(outDir, f));
    }
  }

  const job = (async () => {
    ensureFontmap();
    for (const f of fs.readdirSync(outDir)) {
      if (f.endsWith('.png') || f === '.done') {
        fs.rmSync(path.join(outDir, f), { force: true });
      }
    }
    await execFileAsync('gs', [
      '-I/tmp',
      '-q',
      '-dNOPAUSE',
      '-dBATCH',
      '-sDEVICE=png16m',
      '-r180',
      `-sOutputFile=${outDir}/page_%03d.png`,
      pdfPath,
    ]);
    fs.writeFileSync(doneMarker, 'ok');
    return fs
      .readdirSync(outDir)
      .filter((f) => f.endsWith('.png'))
      .sort()
      .map((f) => path.join(outDir, f));
  })();

  inFlightPdfRenders.set(pdfPath, job);
  try {
    return await job;
  } finally {
    inFlightPdfRenders.delete(pdfPath);
  }
}

async function getPngDims(pngPath: string): Promise<{ w: number; h: number }> {
  const { stdout } = await execFileAsync('identify', ['-format', '%w %h', pngPath]);
  const [w, h] = stdout.trim().split(/\s+/).map(Number);
  return { w, h };
}

async function cropBandToPng(
  pdfPath: string,
  pageNum: number,
  yTopPt: number,
  yBotPt: number,
  pdfWidth: number,
  pdfHeight: number,
  outPngPath: string,
  marginPt = 36
) {
  const pagePngs = await ensureRenderedPdf(pdfPath);
  const srcPng = pagePngs[pageNum - 1];
  if (!srcPng || !fs.existsSync(srcPng)) {
    throw new Error(`Missing rendered page ${pageNum} of ${pdfPath}`);
  }
  const { w: pxW, h: pxH } = await getPngDims(srcPng);
  const sx = pxW / pdfWidth;
  const sy = pxH / pdfHeight;
  const x0 = Math.max(0, Math.round(marginPt * sx));
  const x1 = Math.min(pxW, Math.round((pdfWidth - marginPt) * sx));
  const y0 = Math.max(0, Math.round(yTopPt * sy));
  const y1 = Math.min(pxH, Math.round(yBotPt * sy));
  const cw = Math.max(100, x1 - x0);
  const ch = Math.max(24, y1 - y0);
  const rawPng = `${outPngPath}.raw.png`;
  await execFileAsync('convert', [
    srcPng,
    '-crop',
    `${cw}x${ch}+${x0}+${y0}`,
    '+repage',
    '-background',
    'white',
    '-alpha',
    'remove',
    rawPng,
  ]);
  try {
    await normalizeVerticalBlankGaps(rawPng, outPngPath);
  } finally {
    fs.rmSync(rawPng, { force: true });
  }
}

async function normalizeVerticalBlankGaps(srcPng: string, outPng: string) {
  const { w, h } = await getPngDims(srcPng);
  if (w < 20 || h < 30) {
    fs.copyFileSync(srcPng, outPng);
    return;
  }
  const { stdout: grayBuf } = await execFileAsync(
    'convert',
    [srcPng, '-colorspace', 'Gray', '-depth', '8', 'gray:-'],
    { encoding: 'buffer', maxBuffer: Math.max(4 * 1024 * 1024, w * h + 4096) }
  );

  if (grayBuf.length < w * h) {
    fs.copyFileSync(srcPng, outPng);
    return;
  }

  const isBlank = new Uint8Array(h);
  const xStart = Math.min(4, w - 1);
  const xEnd = Math.max(xStart + 1, w - 4);
  for (let y = 0; y < h; y++) {
    const off = y * w;
    let blank = true;
    for (let x = xStart; x < xEnd; x++) {
      if (grayBuf[off + x] < 246) {
        blank = false;
        break;
      }
    }
    isBlank[y] = blank ? 1 : 0;
  }

  let firstInk = -1;
  let lastInk = -1;
  for (let y = 0; y < h; y++) {
    if (!isBlank[y]) {
      if (firstInk < 0) firstInk = y;
      lastInk = y;
    }
  }
  if (firstInk < 0) {
    fs.copyFileSync(srcPng, outPng);
    return;
  }

  const pad = 16;
  const clipTop = Math.max(0, firstInk - pad);
  const clipBot = Math.min(h - 1, lastInk + pad);

  // Collapse internal pure-white bands taller than 76px (~30pt) down to 28px
  const segments: Array<{ y0: number; y1: number }> = [];
  let segStart = clipTop;
  let y = firstInk;
  while (y <= lastInk) {
    if (isBlank[y]) {
      let runEnd = y;
      while (runEnd + 1 <= lastInk && isBlank[runEnd + 1]) runEnd++;
      const runLen = runEnd - y + 1;
      if (runLen > 76) {
        const keepBefore = y + 14;
        if (keepBefore >= segStart) {
          segments.push({ y0: segStart, y1: keepBefore });
        }
        segStart = runEnd - 13;
      }
      y = runEnd + 1;
    } else {
      y++;
    }
  }
  if (clipBot >= segStart) {
    segments.push({ y0: segStart, y1: clipBot });
  }

  if (segments.length <= 1) {
    const s = segments[0] ?? { y0: clipTop, y1: clipBot };
    const ch = Math.max(12, s.y1 - s.y0 + 1);
    await execFileAsync('convert', [
      srcPng,
      '-crop',
      `${w}x${ch}+0+${s.y0}`,
      '+repage',
      outPng,
    ]);
    return;
  }

  const segArgs: string[] = [];
  for (const s of segments) {
    const ch = Math.max(8, s.y1 - s.y0 + 1);
    segArgs.push('(', srcPng, '-crop', `${w}x${ch}+0+${s.y0}`, '+repage', ')');
  }
  segArgs.push('-background', 'white', '-append', outPng);
  await execFileAsync('convert', segArgs);
}

async function stackPngsToWebp(pngPaths: string[], webpPath: string, opts: { isMs?: boolean } = {}) {
  fs.mkdirSync(path.dirname(webpPath), { recursive: true });
  const tmpWebp = `${webpPath}.tmp.${process.pid}.${Date.now()}.webp`;
  if (pngPaths.length === 1) {
    await execFileAsync('convert', [
      pngPaths[0],
      '-background',
      'white',
      '-bordercolor',
      'white',
      '-border',
      '14x14',
      '-quality',
      '82',
      tmpWebp,
    ]);
    fs.renameSync(tmpWebp, webpPath);
    return;
  }

  const { w } = await getPngDims(pngPaths[0]);
  const whiteGap = `${pngPaths[0]}_wgap_${Date.now()}.png`;
  const divPng = `${pngPaths[0]}_div_${Date.now()}.png`;
  await execFileAsync('convert', ['-size', `${w}x8`, 'xc:white', whiteGap]);
  await execFileAsync('convert', ['-size', `${w}x2`, 'xc:#E2E8F0', divPng]);

  const args: string[] = [];
  pngPaths.forEach((p, idx) => {
    if (idx > 0) {
      if (opts.isMs && idx === 1) {
        args.push(whiteGap);
      } else {
        args.push(whiteGap, divPng, whiteGap);
      }
    }
    args.push(p);
  });
  args.push('-background', 'white', '-append', '-bordercolor', 'white', '-border', '14x14', '-quality', '82', tmpWebp);
  await execFileAsync('convert', args);
  fs.rmSync(whiteGap, { force: true });
  fs.rmSync(divPng, { force: true });
  fs.renameSync(tmpWebp, webpPath);
}

function isNoiseRowText(text: string): boolean {
  return /BLANK PAGE|Additional Page|Permission to reproduce|©\s*U\s*C\s*L\s*E\s*S|©\s*Cambridge|Turn over|9701\/|Question \d+ starts on page|DO NOT WRITE IN THIS MARGIN|Periodic Table of Elements|Important values, constants|^DFD$|^\*\s*\d{6,}\s*\*$/i.test(
    text
  );
}

function filterCleanQpRows(pg: PageText): { skipPage: boolean; rows: TextRow[]; topBound: number; botBound: number } {
  const fullText = pg.items.map((i) => i.str).join(' ');
  if (/BLANK PAGE|Periodic Table of Elements|Important values, constants/i.test(fullText)) {
    return { skipPage: true, rows: [], topBound: 50, botBound: pg.height - 52 };
  }
  const hasTopFiducial = pg.items.some((it) => it.y >= 48 && it.y <= 62 && /[\u0000-\u001f]/.test(it.str));
  const botBarcode = pg.items.find((it) => /[Ĭĥ]/.test(it.str) && it.y > pg.height - 80);
  const topBound = hasTopFiducial ? 59.5 : 46;
  const botBound = botBarcode ? Math.min(pg.height - 52, botBarcode.y - 11.5) : pg.height - 46;

  const cleanItems = pg.items
    .map((it) => ({ ...it, str: it.str.replace(/[\u0000-\u001f]/g, '') }))
    .filter((it) => {
      const s = it.str.trim();
      if (!s) return false;
      if (it.x < 36 || it.x > pg.width - 36) return false;
      if (it.y < topBound || it.y > botBound) return false;
      if (/[Ĭĥ]|^\*\s*\d{6,}\s*\*$/.test(s)) return false;
      if (it.y < 64 && /^[,.\s]+$/.test(s)) return false;
      return true;
    });
  const rows = groupRows(cleanItems).filter((r) => {
    if (isNoiseRowText(r.text)) return false;
    if (r.y < 64 && /^[,.\s]+$/.test(r.text)) return false;
    return true;
  });
  if (rows.length === 0) {
    return { skipPage: true, rows: [], topBound, botBound };
  }
  return { skipPage: false, rows, topBound, botBound };
}

function parseStructuredMarkScheme(msPages: PageText[]) {
  const headerByPage = new Map<number, { pg: PageText; yTop: number; yBot: number }>();
  const blocks = new Map<string, Array<{ pg: PageText; row: TextRow }>>();
  let currentKey: string | null = null;
  let lastQNum = 0;
  let lastHdr: { pg: PageText; yTop: number; yBot: number } | null = null;

  for (const pg of msPages) {
    if (pg.pageNum === 1) continue;
    const rows = groupRows(pg.items).filter(
      (r) =>
        r.y > 42 &&
        r.y < pg.height - 44 &&
        !/©\s*U\s*C\s*L\s*E\s*S|©\s*Cambridge|PUBLISHED|Page \d+|Generic Marking Principles|Science-Specific Marking/i.test(
          r.text
        )
    );
    for (const r of rows) {
      if (/\bQuestion\b/.test(r.text) && /\bAnswer\b/.test(r.text)) {
        if (!headerByPage.has(pg.pageNum)) {
          const hdr = { pg, yTop: Math.max(36, r.y - 10), yBot: r.y + 10 };
          headerByPage.set(pg.pageNum, hdr);
          lastHdr = hdr;
        }
        continue;
      }
      const first = r.items[0];
      if (first && first.x < 120) {
        const s = first.str.trim();
        const mSub = s.match(/^(\d{1,2})\s*\(([a-f])\)(?:\s*\(([ivx]+)\))?$/);
        const mBareSub = s.match(/^\(([a-f])\)(?:\s*\(([ivx]+)\))?$/);
        const mWhole = s.match(/^(\d{1,2})$/);
        if (mSub) {
          lastQNum = Number(mSub[1]);
          currentKey = `${lastQNum}(${mSub[2]})`;
        } else if (mBareSub && lastQNum > 0) {
          currentKey = `${lastQNum}(${mBareSub[1]})`;
        } else if (mWhole && Number(mWhole[1]) >= lastQNum && Number(mWhole[1]) <= 12) {
          lastQNum = Number(mWhole[1]);
          currentKey = `${lastQNum}(full)`;
        }
      }
      if (currentKey) {
        if (!blocks.has(currentKey)) blocks.set(currentKey, []);
        blocks.get(currentKey)!.push({ pg, row: r });
      }
    }
    if (!headerByPage.has(pg.pageNum) && lastHdr) {
      headerByPage.set(pg.pageNum, lastHdr);
    }
  }
  return { headerByPage, blocks };
}

async function generateCropFile(kind: 'qp' | 'ms', filename: string, outFile: string): Promise<string | null> {
  const m = filename.match(/^([msw]\d{2})_(\d{2})_q(\d{1,2})(?:_([a-f]))?(?:_ms)?\.webp$/);
  if (!m) return null;
  const [, sessYr, pv, qNumStr, letter] = m;
  const qNum = Number(qNumStr);
  const paperNumber = Number(pv[0]);
  const pdfFileName = `9701_${sessYr}_${kind}_${pv}.pdf`;
  const pdfPath = await downloadExamPdf(pdfFileName);
  if (!pdfPath) return null;

  const pages = await getPagesText(pdfPath);
  const tempFiles: string[] = [];
  const uid = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

  try {
    if (paperNumber === 1) {
      if (kind === 'qp') {
        for (const pg of pages) {
          if (pg.pageNum === 1) continue;
          const { skipPage, rows, topBound, botBound } = filterCleanQpRows(pg);
          if (skipPage) continue;
          const starts: Array<{ qNum: number; idx: number; yTop: number }> = [];
          for (let i = 0; i < rows.length; i++) {
            const first = rows[i].items[0];
            if (first && first.x < 64 && /^([1-9]|[1-3]\d|40)$/.test(first.str.trim())) {
              starts.push({ qNum: Number(first.str.trim()), idx: i, yTop: rows[i].y });
            }
          }
          const sIdx = starts.findIndex((s) => s.qNum === qNum);
          if (sIdx >= 0) {
            const cur = starts[sIdx];
            const nextIdx = sIdx + 1 < starts.length ? starts[sIdx + 1].idx : rows.length;
            const slice = rows.slice(cur.idx, nextIdx);
            const yTop = Math.max(topBound, cur.yTop - 13);
            const yBot =
              sIdx + 1 < starts.length
                ? Math.min(botBound, starts[sIdx + 1].yTop - 13)
                : Math.min(botBound, Math.max(...slice.map((r) => r.y)) + 20);
            const tmp = path.join(RENDER_CACHE_DIR, `tmp_od_${uid}.png`);
            tempFiles.push(tmp);
            await cropBandToPng(pdfPath, pg.pageNum, yTop, yBot, pg.width, pg.height, tmp, 36);
            await stackPngsToWebp([tmp], outFile);
            return outFile;
          }
        }
      } else {
        let hdrBox: { pg: PageText; yTop: number; yBot: number } | null = null;
        let ansBox: { pg: PageText; yTop: number; yBot: number } | null = null;
        for (const pg of pages) {
          if (pg.pageNum === 1) continue;
          const rows = groupRows(pg.items);
          for (const r of rows) {
            if (!hdrBox && /\bQuestion\b/.test(r.text) && /\bAnswer\b/.test(r.text)) {
              hdrBox = { pg, yTop: Math.max(36, r.y - 10), yBot: r.y + 10 };
            }
            const am = r.text.match(/^(\d{1,2})\s+([ABCD])\b/);
            if (am && Number(am[1]) === qNum) {
              ansBox = { pg, yTop: Math.max(36, r.y - 10), yBot: r.y + 12 };
            }
          }
        }
        if (ansBox) {
          const pngs: string[] = [];
          if (hdrBox) {
            const hdrPng = path.join(RENDER_CACHE_DIR, `tmp_od_h_${uid}.png`);
            tempFiles.push(hdrPng);
            await cropBandToPng(pdfPath, hdrBox.pg.pageNum, hdrBox.yTop, hdrBox.yBot, hdrBox.pg.width, hdrBox.pg.height, hdrPng, 40);
            pngs.push(hdrPng);
          }
          const ansPng = path.join(RENDER_CACHE_DIR, `tmp_od_a_${uid}.png`);
          tempFiles.push(ansPng);
          await cropBandToPng(pdfPath, ansBox.pg.pageNum, ansBox.yTop, ansBox.yBot, ansBox.pg.width, ansBox.pg.height, ansPng, 40);
          pngs.push(ansPng);
          await stackPngsToWebp(pngs, outFile, { isMs: true });
          return outFile;
        }
      }
      return null;
    }

    // Structured Paper 2 / 4 / 5
    if (kind === 'qp') {
      const qMap = new Map<number, Array<{ pg: PageText; row: TextRow; topBound: number; botBound: number }>>();
      let curQ = 0;
      for (const pg of pages) {
        if (pg.pageNum === 1) continue;
        const { skipPage, rows, topBound, botBound } = filterCleanQpRows(pg);
        if (skipPage) continue;
        for (const r of rows) {
          const first = r.items[0];
          const qMatch = first && first.x < 68 && first.str.trim().match(/^([1-9]|1[0-2])(?:\s|$)/);
          if (qMatch) {
            const n = Number(qMatch[1]);
            if ((curQ === 0 && n === 1) || (curQ > 0 && n >= curQ + 1 && n <= curQ + 2)) {
              curQ = n;
            }
          }
          if (curQ > 0) {
            if (!qMap.has(curQ)) qMap.set(curQ, []);
            qMap.get(curQ)!.push({ pg, row: r, topBound, botBound });
          }
        }
      }
      const entries = qMap.get(qNum);
      if (!entries || entries.length === 0) return null;

      const partIndices: Array<{ idx: number; letter: string }> = [];
      for (let i = 0; i < entries.length; i++) {
        const fItem = entries[i].row.items[0];
        const mPart = entries[i].row.text.match(/^(?:\d{1,2}\s+)?\(([a-f])\)/);
        if (fItem && fItem.x < 92 && mPart) {
          partIndices.push({ idx: i, letter: mPart[1] });
        }
      }

      const nextQFirst = qMap.get(qNum + 1)?.[0];

      // Build ordered blocks so intro & part slices don't bleed into each other on the same page
      const sections: Array<{
        rows: Array<{ pg: PageText; row: TextRow; topBound: number; botBound: number }>;
        limitOnLastPageY?: number;
      }> = [];

      if (!letter || partIndices.length === 0) {
        const lastPg = entries[entries.length - 1].pg.pageNum;
        sections.push({
          rows: entries,
          limitOnLastPageY: nextQFirst && nextQFirst.pg.pageNum === lastPg ? nextQFirst.row.y : undefined,
        });
      } else {
        const p = partIndices.findIndex((x) => x.letter === letter);
        if (p < 0) return null;
        const firstPartRow = entries[partIndices[0].idx];
        const introEntries = entries.slice(0, partIndices[0].idx);
        const start = partIndices[p].idx;
        const end = p + 1 < partIndices.length ? partIndices[p + 1].idx : entries.length;
        const partEntries = entries.slice(start, end);

        const nextBoundaryRow =
          p + 1 < partIndices.length ? entries[partIndices[p + 1].idx] : nextQFirst;
        const partLastPg = partEntries[partEntries.length - 1].pg.pageNum;
        const limitY =
          nextBoundaryRow && nextBoundaryRow.pg.pageNum === partLastPg
            ? nextBoundaryRow.row.y
            : undefined;

        if (introEntries.length > 0 && introEntries.length <= 32) {
          const introLastPg = introEntries[introEntries.length - 1].pg.pageNum;
          const partFirstPg = partEntries[0].pg.pageNum;
          if (p === 0 && introLastPg === partFirstPg) {
            // Part (a) already sits directly under the intro stem on the same page: keep as 1 unified slice
            sections.push({
              rows: [...introEntries, ...partEntries],
              limitOnLastPageY: limitY,
            });
          } else {
            sections.push({
              rows: introEntries,
              limitOnLastPageY:
                introLastPg === firstPartRow.pg.pageNum ? firstPartRow.row.y : undefined,
            });
            sections.push({
              rows: partEntries,
              limitOnLastPageY: limitY,
            });
          }
        } else {
          sections.push({
            rows: partEntries,
            limitOnLastPageY: limitY,
          });
        }
      }

      const pngs: string[] = [];
      let sliceIdx = 0;
      for (const sec of sections) {
        const byPage = new Map<number, { pg: PageText; topBound: number; botBound: number; rows: TextRow[] }>();
        for (const e of sec.rows) {
          if (!byPage.has(e.pg.pageNum)) {
            byPage.set(e.pg.pageNum, { pg: e.pg, topBound: e.topBound, botBound: e.botBound, rows: [] });
          }
          byPage.get(e.pg.pageNum)!.rows.push(e.row);
        }
        const pageEntries = [...byPage.entries()];
        for (let idx = 0; idx < pageEntries.length; idx++) {
          sliceIdx++;
          const [, { pg, topBound, botBound, rows }] = pageEntries[idx];
          const minY = Math.max(topBound, Math.min(...rows.map((r) => r.y)) - 13);
          const lastRow = rows.reduce((a, b) => (a.y > b.y ? a : b));
          let maxY = Math.min(botBound, lastRow.y + 20);
          if (idx === pageEntries.length - 1 && sec.limitOnLastPageY !== undefined) {
            const hardCap = sec.limitOnLastPageY - 14;
            const gap = sec.limitOnLastPageY - lastRow.y;
            if (gap > 36 && gap < 220 && !/\[(\d+)\]|^\.{4,}|\[Total:/i.test(lastRow.text)) {
              maxY = Math.min(botBound, hardCap);
            } else {
              maxY = Math.min(maxY, hardCap);
            }
          }
          if (maxY <= minY + 8) continue;
          const pPath = path.join(RENDER_CACHE_DIR, `tmp_od_qp_${uid}_${sliceIdx}.png`);
          tempFiles.push(pPath);
          await cropBandToPng(pdfPath, pg.pageNum, minY, maxY, pg.width, pg.height, pPath, 36);
          pngs.push(pPath);
        }
      }
      if (pngs.length === 0) return null;
      await stackPngsToWebp(pngs, outFile);
      return outFile;
    } else {
      const { headerByPage, blocks } = parseStructuredMarkScheme(pages);
      const msKey = `${qNum}(${letter ?? 'full'})`;
      const msRows = blocks.get(msKey);
      if (!msRows || msRows.length === 0) return null;

      const byPage = new Map<number, { pg: PageText; rows: TextRow[] }>();
      for (const e of msRows) {
        if (!byPage.has(e.pg.pageNum)) byPage.set(e.pg.pageNum, { pg: e.pg, rows: [] });
        byPage.get(e.pg.pageNum)!.rows.push(e.row);
      }
      const pngs: string[] = [];
      let mIdx = 0;
      for (const [pno, { pg, rows }] of byPage.entries()) {
        mIdx++;
        if (mIdx === 1) {
          const hdr = headerByPage.get(pno);
          if (hdr) {
            const hPath = path.join(RENDER_CACHE_DIR, `tmp_od_msh_${uid}.png`);
            tempFiles.push(hPath);
            await cropBandToPng(pdfPath, hdr.pg.pageNum, hdr.yTop, hdr.yBot, hdr.pg.width, hdr.pg.height, hPath, 40);
            pngs.push(hPath);
          }
        }
        const minY = Math.max(38, Math.min(...rows.map((r) => r.y)) - 10);
        const maxY = Math.min(pg.height - 42, Math.max(...rows.map((r) => r.y)) + 14);
        const rPath = path.join(RENDER_CACHE_DIR, `tmp_od_ms_${uid}_${mIdx}.png`);
        tempFiles.push(rPath);
        await cropBandToPng(pdfPath, pno, minY, maxY, pg.width, pg.height, rPath, 40);
        pngs.push(rPath);
      }
      await stackPngsToWebp(pngs, outFile, { isMs: true });
      return outFile;
    }
  } finally {
    for (const f of tempFiles) {
      fs.rmSync(f, { force: true });
    }
  }
}

export async function ensureClippedImageOnDisk(kind: 'qp' | 'ms', filename: string): Promise<string | null> {
  if (!/^[a-z0-9_]+\.webp$/.test(filename)) return null;
  const outFile = path.join(ROOT_DIR, 'public', 'clipped-papers', kind, filename);
  if (fs.existsSync(outFile) && fs.statSync(outFile).size > 250) {
    return outFile;
  }
  const jobKey = `${kind}/${filename}`;
  const existing = inFlightFileJobs.get(jobKey);
  if (existing) return existing;

  const job = generateCropFile(kind, filename, outFile).catch((err) => {
    console.error(`[paperCropper] Failed to generate ${jobKey}:`, err);
    return null;
  });

  inFlightFileJobs.set(jobKey, job);
  try {
    return await job;
  } finally {
    inFlightFileJobs.delete(jobKey);
  }
}
