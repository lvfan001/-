import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GoogleGenAI, Type } from '@google/genai';
import { createServer as createViteServer } from 'vite';
import type {
  ChapterErrorSummary,
  DownloadedPaper,
  ExamSession,
  ModuleErrorSummary,
  Question,
  RevisionTask,
} from './src/types/chemistry.ts';
import { CHAPTERS, STUDY_MODULES, resolveModuleForChapters } from './src/data/syllabus.ts';
import { enforceForwardDependencyIsolation } from './src/utils/chapterClassifier.ts';
import { registerAuthRoutes } from './server/auth.ts';
import { ensureClippedImageOnDisk } from './server/paperCropper.ts';
import {
  downloadAndCache9701Pdf,
  isValid9701PdfFilename,
  scrapeAvailableSessions,
  scrapeSessionFiles,
} from './server/paperScraper.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json({ limit: '25mb' }));
registerAuthRoutes(app);

// In-memory store for fetched/uploaded PDF binaries so users can download them locally
const pdfStore = new Map<string, { buffer: Buffer; filename: string }>();

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function buildMirrorCandidates(
  year: number,
  session: ExamSession,
  paperNumber: 1 | 2 | 4,
  variant: 1 | 2 | 3
): string[] {
  const yy = String(year).slice(-2);
  const sessCode = session === 'F/M' ? 'm' : session === 'M/J' ? 's' : 'w';
  const fileName = `9701_${sessCode}${yy}_qp_${paperNumber}${variant}.pdf`;
  const sessionFolder =
    session === 'F/M' ? 'Feb-Mar' : session === 'M/J' ? 'May-June' : 'Oct-Nov';

  return [
    `https://pastpapers.papacambridge.com/directories/CAIE/CAIE-pastpapers/upload/${fileName}`,
    `https://papers.gceguide.cc/a-levels/chemistry-(9701)/${year}/${fileName}`,
    `https://bestexamhelp.com/exam/cambridge-international-a-level/chemistry-9701/${year}/${fileName}`,
    `https://dynamicpapers.com/wp-content/uploads/${year}/${sessionFolder}/${fileName}`,
  ];
}

function parseJsonSafe<T>(raw: string | undefined, fallback: T): T {
  if (!raw) return fallback;
  const trimmed = raw.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1].trim() : trimmed;
  try {
    return JSON.parse(candidate) as T;
  } catch {
    return fallback;
  }
}

const QUESTION_EXTRACTION_SCHEMA = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      questionNumber: { type: Type.INTEGER },
      type: { type: Type.STRING, description: "Either 'mcq' or 'structured'" },
      marks: { type: Type.INTEGER },
      chapters: {
        type: Type.ARRAY,
        items: { type: Type.INTEGER },
        description: 'Array of 1-30 CAIE 9701 chapter numbers involved in this question',
      },
      promptEn: { type: Type.STRING },
      promptZh: { type: Type.STRING },
      options: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            label: { type: Type.STRING },
            text: { type: Type.STRING },
          },
          required: ['label', 'text'],
        },
      },
      correctOption: { type: Type.STRING },
      markSchemePoints: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
      },
      modelAnswer: { type: Type.STRING },
      explanationEn: { type: Type.STRING },
      explanationZh: { type: Type.STRING },
      difficulty: { type: Type.STRING, description: "'Core', 'Standard', or 'Challenging'" },
    },
    required: [
      'questionNumber',
      'type',
      'marks',
      'chapters',
      'promptEn',
      'promptZh',
      'explanationEn',
      'explanationZh',
      'difficulty',
    ],
  },
};

const SYLLABUS_BRIEF = CHAPTERS.map(
  (c) => `${c.id}: ${c.titleEn} (${c.titleZh}) — Topics: ${c.keyTopics.join(', ')}`
).join('\n');

function normalizeExtractedQuestions(
  rawList: Array<Record<string, unknown>>,
  meta: {
    paperCode: string;
    year: number;
    session: ExamSession;
    paperNumber: 1 | 2 | 4;
    source: 'web-downloaded' | 'pdf-uploaded';
    sourceUrl?: string;
  }
): Question[] {
  return rawList.map((item, idx) => {
    const rawChapters = Array.isArray(item.chapters)
      ? item.chapters.map((n) => Number(n)).filter((n) => Number.isInteger(n) && n >= 1 && n <= 30)
      : [];
    const chapters = rawChapters.length > 0 ? Array.from(new Set(rawChapters)) : [meta.paperNumber >= 4 ? 19 : 1];
    const qType = item.type === 'mcq' ? 'mcq' : 'structured';
    const rawOptions = Array.isArray(item.options) ? item.options : undefined;
    const cleanOptions =
      qType === 'mcq' && rawOptions && rawOptions.length === 4
        ? rawOptions.map((o, i) => ({
            label: (['A', 'B', 'C', 'D'][i] ?? 'A') as 'A' | 'B' | 'C' | 'D',
            text: String((o as { text?: unknown }).text ?? ''),
          }))
        : undefined;

    const rawCorrect = String(item.correctOption ?? 'A').trim().toUpperCase();
    const correctOption = (['A', 'B', 'C', 'D'].includes(rawCorrect) ? rawCorrect : 'A') as
      | 'A'
      | 'B'
      | 'C'
      | 'D';

    const difficultyRaw = String(item.difficulty ?? 'Standard');
    const difficulty = (
      difficultyRaw === 'Core' || difficultyRaw === 'Challenging' ? difficultyRaw : 'Standard'
    ) as 'Core' | 'Standard' | 'Challenging';

    const rawQuestion: Question = {
      id: `q-${meta.paperCode.replace(/[^a-zA-Z0-9]/g, '')}-${idx + 1}-${Date.now()}`,
      paperCode: meta.paperCode,
      year: meta.year,
      session: meta.session,
      paperNumber: meta.paperNumber,
      questionNumber: Number(item.questionNumber) || idx + 1,
      source: meta.source,
      sourceUrl: meta.sourceUrl,
      chapters,
      moduleId: resolveModuleForChapters(chapters),
      type: qType,
      marks: Math.max(1, Number(item.marks) || (qType === 'mcq' ? 1 : 3)),
      promptEn: String(item.promptEn ?? ''),
      promptZh: String(item.promptZh ?? ''),
      options: cleanOptions,
      correctOption: qType === 'mcq' ? correctOption : undefined,
      markSchemePoints: Array.isArray(item.markSchemePoints)
        ? item.markSchemePoints.map(String)
        : undefined,
      modelAnswer: item.modelAnswer ? String(item.modelAnswer) : undefined,
      explanationEn: String(item.explanationEn ?? ''),
      explanationZh: String(item.explanationZh ?? ''),
      difficulty,
    };
    return enforceForwardDependencyIsolation(rawQuestion);
  });
}

// 1. Health Check
app.get('/api/health', (_req, res) => {
  res.json({ ok: true, geminiConfigured: Boolean(getGeminiClient()) });
});

// 2. 2021-2026 CAIE 9701 Past Paper Catalog
app.get('/api/papers/catalog', (req, res) => {
  const yearFilter = req.query.year ? Number(req.query.year) : null;
  const sessionFilter = req.query.session ? String(req.query.session) : null;
  const paperFilter = req.query.paperNumber ? Number(req.query.paperNumber) : null;

  const years = [2026, 2025, 2024, 2023, 2022, 2021];
  const sessions: { code: ExamSession; label: string; variants: (1 | 2 | 3)[] }[] = [
    { code: 'F/M', label: 'Feb / Mar', variants: [2] },
    { code: 'M/J', label: 'May / June', variants: [1, 2, 3] },
    { code: 'O/N', label: 'Oct / Nov', variants: [1, 2, 3] },
  ];
  const papers: (1 | 2 | 4)[] = [1, 2, 4];

  const items: Array<{
    paperCode: string;
    year: number;
    session: ExamSession;
    sessionLabel: string;
    paperNumber: 1 | 2 | 4;
    variant: 1 | 2 | 3;
    paperTypeLabel: string;
    defaultMirrorUrl: string;
    alternateSearchUrl: string;
  }> = [];

  for (const year of years) {
    if (yearFilter && year !== yearFilter) continue;
    for (const sess of sessions) {
      if (sessionFilter && sess.code !== sessionFilter) continue;
      // 2026 O/N has not occurred or is just concluding Nov 2026; include F/M and M/J 2026 plus O/N 2026 preview
      for (const pNum of papers) {
        if (paperFilter && pNum !== paperFilter) continue;
        for (const variant of sess.variants) {
          const yy = String(year).slice(-2);
          const paperCode = `9701/${pNum}${variant}/${sess.code}/${yy}`;
          const candidates = buildMirrorCandidates(year, sess.code, pNum, variant);
          const sessSlug =
            sess.code === 'F/M'
              ? 'march'
              : sess.code === 'M/J'
                ? 'may-june'
                : 'oct-nov';
          items.push({
            paperCode,
            year,
            session: sess.code,
            sessionLabel: sess.label,
            paperNumber: pNum,
            variant,
            paperTypeLabel:
              pNum === 1
                ? 'Paper 1 · AS Multiple Choice'
                : pNum === 2
                  ? 'Paper 2 · AS Structured'
                  : 'Paper 4 · A2 Structured',
            defaultMirrorUrl: candidates[0],
            alternateSearchUrl: `https://pastpapers.papacambridge.com/papers/caie/as-and-a-level-chemistry-9701-${year}-${sessSlug}`,
          });
        }
      }
    }
  }

  res.json({ items });
});

// 2b. Live Scraped CAIE 9701 Years & Sessions Index
app.get('/api/papers/sessions', async (req, res) => {
  try {
    const refresh = req.query.refresh === '1';
    const years = await scrapeAvailableSessions(refresh);
    res.json({ years });
  } catch (err) {
    res.status(500).json({
      error: `抓取真题年份列表失败：${err instanceof Error ? err.message : '未知错误'}`,
    });
  }
});

// 2c. Live Scraped Session Papers (P1-P5, Variants, QP & MS)
app.get('/api/papers/session-files', async (req, res) => {
  const slug = typeof req.query.slug === 'string' ? req.query.slug.trim() : '';
  const refresh = req.query.refresh === '1';
  if (!slug) {
    res.status(400).json({ error: '缺少考季目录标识 slug' });
    return;
  }
  try {
    const data = await scrapeSessionFiles(slug, refresh);
    res.json(data);
  } catch (err) {
    res.status(500).json({
      error: `抓取网页真题列表失败：${err instanceof Error ? err.message : '未知错误'}`,
    });
  }
});

// 2d. Direct 1-click PDF Download Proxy (QP / MS / CI / ER / GT)
app.get('/api/papers/download-file', async (req, res) => {
  const file = typeof req.query.file === 'string' ? req.query.file.trim() : '';
  if (!isValid9701PdfFilename(file)) {
    res.status(400).json({ error: '非法的文件名格式' });
    return;
  }
  try {
    const filePath = await downloadAndCache9701Pdf(file);
    if (!filePath) {
      res.status(404).json({ error: `未能在源站找到文件 ${file}` });
      return;
    }
    const disposition = req.query.inline === '1' ? 'inline' : 'attachment';
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `${disposition}; filename="${file}"`);
    res.sendFile(filePath);
  } catch (err) {
    res.status(500).json({
      error: `下载 PDF 失败：${err instanceof Error ? err.message : '未知错误'}`,
    });
  }
});

// 3. Download or stream PDF Binary stored on server
app.get('/api/papers/pdf/:paperId', (req, res) => {
  const entry = pdfStore.get(req.params.paperId);
  if (!entry) {
    res.status(404).json({ error: 'PDF binary not cached for this paper.' });
    return;
  }
  res.setHeader('Content-Type', 'application/pdf');
  const disposition = req.query.inline === '1' ? 'inline' : 'attachment';
  res.setHeader('Content-Disposition', `${disposition}; filename="${entry.filename}"`);
  res.send(entry.buffer);
});

// 4. Web Downloader & Parser (Direct PDF Fetch + Gemini PDF / Web-Grounded Extraction)
app.post('/api/papers/download-url', async (req, res) => {
  const {
    url,
    paperCode,
    year,
    session,
    paperNumber,
    variant,
  } = req.body as {
    url?: string;
    paperCode: string;
    year: number;
    session: ExamSession;
    paperNumber: 1 | 2 | 4;
    variant: 1 | 2 | 3;
  };

  const ai = getGeminiClient();
  const paperId = `paper-${paperCode.replace(/[^a-zA-Z0-9]/g, '')}-${Date.now()}`;
  const candidateUrls = url?.trim()
    ? [url.trim()]
    : buildMirrorCandidates(year, session, paperNumber, variant);

  let fetchedPdfBuffer: Buffer | null = null;
  let fetchedUrlUsed: string | undefined;

  for (const candidate of candidateUrls) {
    try {
      const response = await fetch(candidate, {
        signal: AbortSignal.timeout(8000),
        headers: {
          'User-Agent':
            'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
          Accept: 'application/pdf,*/*',
        },
      });
      if (!response.ok) continue;
      const contentType = response.headers.get('content-type') ?? '';
      const arrBuf = await response.arrayBuffer();
      const buf = Buffer.from(arrBuf);
      const isPdfMagic = buf.subarray(0, 4).toString('utf8') === '%PDF';
      if (isPdfMagic || contentType.includes('application/pdf')) {
        fetchedPdfBuffer = buf;
        fetchedUrlUsed = candidate;
        break;
      }
    } catch {
      // Try next mirror candidate
    }
  }

  // Case A: Real PDF downloaded from web URL!
  if (fetchedPdfBuffer) {
    const safeFilename = `${paperCode.replace(/\//g, '_')}.pdf`;
    pdfStore.set(paperId, { buffer: fetchedPdfBuffer, filename: safeFilename });

    if (!ai) {
      res.status(200).json({
        paper: {
          id: paperId,
          paperCode,
          year,
          session,
          paperNumber,
          variant,
          title: `CAIE 9701 ${paperCode} (${year} ${session})`,
          downloadedAt: new Date().toISOString(),
          sourceMethod: 'url-pdf',
          sourceUrl: fetchedUrlUsed,
          hasPdfBlob: true,
          questionCount: 0,
          chaptersCovered: [],
          note: 'PDF 已成功下载到本地缓存（点击下载原卷），但服务端未检测到 GEMINI_API_KEY，未能自动解析题干。',
        } satisfies DownloadedPaper,
        questions: [],
      });
      return;
    }

    try {
      const pdfBase64 = fetchedPdfBuffer.toString('base64');
      const extractResp = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: {
          parts: [
            {
              inlineData: {
                mimeType: 'application/pdf',
                data: pdfBase64,
              },
            },
            {
              text:
                `Extract up to 10 self-contained exam items from this CAIE A-Level Chemistry 9701 past paper (${paperCode}). ` +
                `For Paper 2/4 structured questions, SPLIT by lettered sub-part (a), (b), (c) — keeping nested (i), (ii), (iii) grouped together with shared context inside each lettered part rather than returning whole unsplit questions. ` +
                `Strictly enforce forward-dependency isolation: only assign single chapter [N] if 100% solvable using Chapters 1..N; if any later-chapter concept is required, list ALL involved chapters so it routes to Module Practice. Paper 1/2 must stay strictly within AS Chapters 1-18, and Paper 4/5 must stay strictly within A2 Chapters 19-30.\n\n` +
                `Syllabus Chapters (1-30):\n${SYLLABUS_BRIEF}`,
            },
          ],
        },
        config: {
          responseMimeType: 'application/json',
          responseSchema: QUESTION_EXTRACTION_SCHEMA,
        },
      });

      const parsed = parseJsonSafe<Array<Record<string, unknown>>>(extractResp.text, []);
      const questions = normalizeExtractedQuestions(parsed, {
        paperCode,
        year,
        session,
        paperNumber,
        source: 'web-downloaded',
        sourceUrl: fetchedUrlUsed,
      });

      const chaptersCovered = Array.from(
        new Set(questions.flatMap((q) => q.chapters))
      ).sort((a, b) => a - b);

      res.json({
        paper: {
          id: paperId,
          paperCode,
          year,
          session,
          paperNumber,
          variant,
          title: `CAIE 9701 ${paperCode}`,
          downloadedAt: new Date().toISOString(),
          sourceMethod: 'url-pdf',
          sourceUrl: fetchedUrlUsed,
          hasPdfBlob: true,
          questionCount: questions.length,
          chaptersCovered,
          note: '已从网页直连抓取 PDF 原卷并完成 30 章节与模块智能划分。',
        } satisfies DownloadedPaper,
        questions,
      });
      return;
    } catch (err) {
      res.status(500).json({
        error: `PDF downloaded, but Gemini parsing failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
      });
      return;
    }
  }

  // Case B: Mirror blocked automated PDF fetch or custom URL was HTML/unavailable -> Use Gemini Web Grounding!
  if (!ai) {
    res.status(400).json({
      error:
        '未能直接下载该 URL 的 PDF（可能受站点防盗链/Cloudflare 限制或链接无效），且未配置 GEMINI_API_KEY 进行网页检索解析。您可以从浏览器手动下载 PDF 后使用「本地 PDF 上传解析」。',
    });
    return;
  }

  try {
    const searchResp = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents:
        `Search for Cambridge International AS & A Level Chemistry 9701 past paper ${paperCode} (${year} ${session}, Paper ${paperNumber} Variant ${variant}). ` +
        `Retrieve 4 authentic exam questions (or representative syllabus-matched 9701 Paper ${paperNumber} questions from ${year} ${session} if full paper text is behind a PDF mirror) ` +
        `with exact numbers, chemical equations, options (if Paper 1 MCQ) or mark-scheme points (if Paper 2/4), and official answers.`,
      config: {
        tools: [{ googleSearch: {} }],
      },
    });

    const groundingChunks = searchResp.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];
    const groundingUrls = groundingChunks
      .map((chunk) => chunk.web)
      .filter((w): w is { uri: string; title?: string } => Boolean(w?.uri))
      .slice(0, 5)
      .map((w) => ({ uri: w.uri, title: w.title ?? w.uri }));

    const structureResp = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents:
        `Convert the retrieved CAIE 9701 Paper ${paperNumber} (${paperCode}, ${year} ${session}) chemistry questions below into structured JSON matching the schema. ` +
        `Ensure every question has accurate chemical stoichiometry/mechanisms, bilingual promptZh & explanationZh, and exact chapter tags (Paper 1/2 strictly AS Chapters 1-18; Paper 4/5 strictly A2 Chapters 19-30). ` +
        `Include at least 1 multi-chapter question (2+ chapter IDs in 'chapters') if appropriate for Paper ${paperNumber}.\n\n` +
        `Syllabus Chapters (1-30):\n${SYLLABUS_BRIEF}\n\nRetrieved content:\n${searchResp.text ?? ''}`,
      config: {
        responseMimeType: 'application/json',
        responseSchema: QUESTION_EXTRACTION_SCHEMA,
      },
    });

    const parsed = parseJsonSafe<Array<Record<string, unknown>>>(structureResp.text, []);
    const questions = normalizeExtractedQuestions(parsed, {
      paperCode,
      year,
      session,
      paperNumber,
      source: 'web-downloaded',
      sourceUrl: groundingUrls[0]?.uri ?? url,
    });

    const chaptersCovered = Array.from(
      new Set(questions.flatMap((q) => q.chapters))
    ).sort((a, b) => a - b);

    res.json({
      paper: {
        id: paperId,
        paperCode,
        year,
        session,
        paperNumber,
        variant,
        title: `CAIE 9701 ${paperCode}`,
        downloadedAt: new Date().toISOString(),
        sourceMethod: 'web-grounded',
        sourceUrl: url || groundingUrls[0]?.uri,
        groundingUrls,
        hasPdfBlob: false,
        questionCount: questions.length,
        chaptersCovered,
        note: '镜像站点开启了 PDF 防爬虫保护，已通过实时网页检索（Google Search Grounding）提取该场次真题考点并完成章节/模块归类。如需原卷 PDF，可点击外部镜像链接下载后上传解析。',
      } satisfies DownloadedPaper,
      questions,
    });
  } catch (err) {
    res.status(500).json({
      error: `网页检索解析失败：${err instanceof Error ? err.message : '请检查网络或尝试上传本地 PDF'}`,
    });
  }
});

// 5. Upload Local Past Paper PDF (QP + optional MS) & Parse with Gemini
app.post('/api/papers/upload-pdf', async (req, res) => {
  const {
    fileName,
    paperCode,
    year,
    session,
    paperNumber,
    variant,
    qpBase64,
    msBase64,
  } = req.body as {
    fileName: string;
    paperCode: string;
    year: number;
    session: ExamSession;
    paperNumber: 1 | 2 | 4;
    variant: 1 | 2 | 3;
    qpBase64: string;
    msBase64?: string;
  };

  if (!qpBase64) {
    res.status(400).json({ error: '缺少 Question Paper PDF 文件内容。' });
    return;
  }

  const cleanQpBase64 = qpBase64.replace(/^data:application\/pdf;base64,/, '');
  const pdfBuffer = Buffer.from(cleanQpBase64, 'base64');
  const paperId = `upload-${paperCode.replace(/[^a-zA-Z0-9]/g, '')}-${Date.now()}`;
  pdfStore.set(paperId, { buffer: pdfBuffer, filename: fileName || `${paperCode.replace(/\//g, '_')}.pdf` });

  const ai = getGeminiClient();
  if (!ai) {
    res.status(400).json({
      error: '未检测到 GEMINI_API_KEY，无法解析 PDF 试题内容。',
    });
    return;
  }

  try {
    const parts: Array<
      | { inlineData: { mimeType: string; data: string } }
      | { text: string }
    > = [
      {
        inlineData: {
          mimeType: 'application/pdf',
          data: cleanQpBase64,
        },
      },
    ];

    if (msBase64) {
      parts.push({
        inlineData: {
          mimeType: 'application/pdf',
          data: msBase64.replace(/^data:application\/pdf;base64,/, ''),
        },
      });
    }

    parts.push({
      text:
        `Parse up to 12 self-contained items from the attached CAIE A-Level Chemistry 9701 Question Paper PDF` +
        `${msBase64 ? ' (using the second attached PDF as the official Mark Scheme)' : ''}. ` +
        `For structured Paper 2/4 questions, split by parent lettered part (a)/(b)/(c) keeping coupled (i)/(ii)/(iii) sub-parts together with any shared stem. ` +
        `Classify strictly against Chapters 1–30 enforcing forward-dependency isolation and paper boundaries (Paper 1/2 strictly AS Chapters 1–18; Paper 4/5 strictly A2 Chapters 19–30): never assign an earlier chapter alone if any later chapter topic is tested (list all involved chapters so it routes to Module Practice).\n\n` +
        `Syllabus Chapters (1-30):\n${SYLLABUS_BRIEF}`,
    });

    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: { parts },
      config: {
        responseMimeType: 'application/json',
        responseSchema: QUESTION_EXTRACTION_SCHEMA,
      },
    });

    const parsed = parseJsonSafe<Array<Record<string, unknown>>>(response.text, []);
    const questions = normalizeExtractedQuestions(parsed, {
      paperCode,
      year,
      session,
      paperNumber,
      source: 'pdf-uploaded',
    });

    const chaptersCovered = Array.from(
      new Set(questions.flatMap((q) => q.chapters))
    ).sort((a, b) => a - b);

    res.json({
      paper: {
        id: paperId,
        paperCode,
        year,
        session,
        paperNumber,
        variant,
        title: `CAIE 9701 ${paperCode} (本地上传)`,
        downloadedAt: new Date().toISOString(),
        sourceMethod: 'local-upload',
        hasPdfBlob: true,
        questionCount: questions.length,
        chaptersCovered,
        note: msBase64
          ? '已结合 QP 原卷与 MS 评分标准完成解析并自动归类章节/模块。'
          : '已解析 QP 原卷并自动生成解析与章节/模块归类。',
      } satisfies DownloadedPaper,
      questions,
    });
  } catch (err) {
    res.status(500).json({
      error: `PDF 解析失败：${err instanceof Error ? err.message : '未知错误'}`,
    });
  }
});

// 6. Targeted Revision Plan Generator (Gemini + Deterministic Fallback)
app.post('/api/plan/generate', async (req, res) => {
  const {
    targetExamDate,
    dailyMinutes,
    planDays,
    chapterStats,
    moduleStats,
    wrongQuestionIds,
  } = req.body as {
    targetExamDate: string;
    dailyMinutes: number;
    planDays: number;
    chapterStats: ChapterErrorSummary[];
    moduleStats: ModuleErrorSummary[];
    wrongQuestionIds: string[];
  };

  const sortedWeakChapters = [...(chapterStats ?? [])]
    .sort((a, b) => b.priorityScore - a.priorityScore)
    .slice(0, 8);

  const sortedWeakModules = [...(moduleStats ?? [])]
    .sort((a, b) => b.errorRate - a.errorRate)
    .slice(0, 4);

  const days = Math.min(14, Math.max(3, Number(planDays) || 7));
  const mins = Math.min(240, Math.max(20, Number(dailyMinutes) || 45));

  const ai = getGeminiClient();
  if (ai) {
    try {
      const statsSummary = sortedWeakChapters
        .map(
          (c) =>
            `${c.chapter.code} ${c.chapter.titleZh} (${c.chapter.titleEn}): 错误率 ${Math.round(c.errorRate * 100)}%, 错题 ${c.wrongCount}/${c.attempts}`
        )
        .join('\n');

      const modSummary = sortedWeakModules
        .map(
          (m) =>
            `${m.module.code} ${m.module.titleZh}: 错误率 ${Math.round(m.errorRate * 100)}%, 错题 ${m.wrongCount}/${m.attempts}`
        )
        .join('\n');

      const planResp = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents:
          `You are an expert CAIE A-Level Chemistry (9701) tutor. Generate a concrete ${days}-day targeted revision plan ` +
          `(${mins} min/day) leading toward exam date ${targetExamDate}.\n\n` +
          `Student's Weakest Chapters:\n${statsSummary || 'No attempts yet — build a balanced diagnostic foundation starting with core stoichiometry, energetics, and Ch 14-18 AS Organic Chemistry.'}\n\n` +
          `Module Performance:\n${modSummary}\n\n` +
          `Total active mistake question IDs: ${wrongQuestionIds?.length ?? 0}.\n` +
          `Return JSON with 'aiSummaryZh' (a sharp, practical 2-3 sentence Chinese diagnostic summary) and 'tasks' (1–2 concrete tasks per day across ${days} days, targeting specific chapter IDs 1-30 or module IDs like 'mod-as-organic').`,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              aiSummaryZh: { type: Type.STRING },
              tasks: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    dayIndex: { type: Type.INTEGER },
                    titleZh: { type: Type.STRING },
                    titleEn: { type: Type.STRING },
                    focusType: {
                      type: Type.STRING,
                      description: "'chapter', 'module', 'mistakes', or 'mock'",
                    },
                    targetChapterIds: {
                      type: Type.ARRAY,
                      items: { type: Type.INTEGER },
                    },
                    targetModuleId: { type: Type.STRING },
                    reasonZh: { type: Type.STRING },
                    estimatedMinutes: { type: Type.INTEGER },
                  },
                  required: [
                    'dayIndex',
                    'titleZh',
                    'titleEn',
                    'focusType',
                    'targetChapterIds',
                    'reasonZh',
                    'estimatedMinutes',
                  ],
                },
              },
            },
            required: ['aiSummaryZh', 'tasks'],
          },
        },
      });

      const parsed = parseJsonSafe<{
        aiSummaryZh?: string;
        tasks?: Array<Record<string, unknown>>;
      }>(planResp.text, {});

      if (parsed.tasks && parsed.tasks.length > 0) {
        const now = new Date();
        const tasks: RevisionTask[] = parsed.tasks.map((t, idx) => {
          const dayIdx = Math.max(1, Math.min(days, Number(t.dayIndex) || (idx % days) + 1));
          const taskDate = new Date(now.getTime() + (dayIdx - 1) * 86400000);
          const dateLabel = `${taskDate.getMonth() + 1}/${taskDate.getDate()}`;
          const focusRaw = String(t.focusType ?? 'chapter');
          const focusType = (
            ['chapter', 'module', 'mistakes', 'mock'].includes(focusRaw) ? focusRaw : 'chapter'
          ) as RevisionTask['focusType'];
          const rawCh = Array.isArray(t.targetChapterIds)
            ? t.targetChapterIds.map(Number).filter((n) => n >= 1 && n <= 30)
            : [];

          return {
            id: `task-${dayIdx}-${idx}-${Date.now()}`,
            dayIndex: dayIdx,
            dateLabel,
            titleZh: String(t.titleZh ?? '章节专项突破'),
            titleEn: String(t.titleEn ?? 'Chapter Targeted Drill'),
            focusType,
            targetChapterIds: rawCh,
            targetModuleId: t.targetModuleId ? String(t.targetModuleId) : undefined,
            targetQuestionIds: focusType === 'mistakes' ? wrongQuestionIds : undefined,
            reasonZh: String(t.reasonZh ?? ''),
            estimatedMinutes: Number(t.estimatedMinutes) || mins,
            completed: false,
          };
        });

        res.json({
          id: `plan-${Date.now()}`,
          createdAt: new Date().toISOString(),
          targetExamDate,
          dailyMinutes: mins,
          planDays: days,
          aiSummaryZh:
            parsed.aiSummaryZh ??
            '已结合您的错题频率与薄弱章节生成针对性复习路径。',
          generatedBy: 'gemini',
          tasks,
        });
        return;
      }
    } catch {
      // Fall through cleanly to deterministic algorithmic generator
    }
  }

  // Deterministic Algorithmic Revision Plan Fallback
  const now = new Date();
  const tasks: RevisionTask[] = [];
  const defaultChapters = [14, 16, 6, 8, 19, 21, 25, 30];
  const chaptersToUse =
    sortedWeakChapters.filter((c) => c.wrongCount > 0).length > 0
      ? sortedWeakChapters.filter((c) => c.wrongCount > 0).map((c) => c.chapter)
      : defaultChapters.map((id) => CHAPTERS.find((c) => c.id === id)!);

  for (let d = 1; d <= days; d++) {
    const taskDate = new Date(now.getTime() + (d - 1) * 86400000);
    const dateLabel = `${taskDate.getMonth() + 1}/${taskDate.getDate()}`;

    if (d === days) {
      tasks.push({
        id: `task-${d}-mock`,
        dayIndex: d,
        dateLabel,
        titleZh: '全真模拟考验收测评',
        titleEn: 'Full Timed Diagnostic Mock Assessment',
        focusType: 'mock',
        targetChapterIds: chaptersToUse.slice(0, 4).map((c) => c.id),
        reasonZh: '检验本周期针对性复习效果，重新校准各章节错误率与 CAIE 等级预估。',
        estimatedMinutes: mins,
        completed: false,
      });
    } else if (d % 3 === 0) {
      const mod = sortedWeakModules[0]?.module ?? STUDY_MODULES[2];
      tasks.push({
        id: `task-${d}-mod`,
        dayIndex: d,
        dateLabel,
        titleZh: `跨章模块强化：${mod.titleZh}`,
        titleEn: mod.titleEn,
        focusType: 'module',
        targetChapterIds: mod.chapterIds,
        targetModuleId: mod.id,
        reasonZh: '针对涉及 2 个以上章节的综合大题进行串联训练，打通机理与推断逻辑。',
        estimatedMinutes: mins,
        completed: false,
      });
    } else if (d === 1 && wrongQuestionIds && wrongQuestionIds.length > 0) {
      tasks.push({
        id: `task-${d}-mistakes`,
        dayIndex: d,
        dateLabel,
        titleZh: `高频错题清零专练（${wrongQuestionIds.length} 题）`,
        titleEn: 'High-Frequency Mistakes Re-Drill',
        focusType: 'mistakes',
        targetChapterIds: chaptersToUse.slice(0, 3).map((c) => c.id),
        targetQuestionIds: wrongQuestionIds,
        reasonZh: '优先攻克近期重复出错的真题，消除固定知识盲区与审题失分点。',
        estimatedMinutes: mins,
        completed: false,
      });
    } else {
      const ch = chaptersToUse[(d - 1) % chaptersToUse.length];
      const errSummary = sortedWeakChapters.find((s) => s.chapter.id === ch.id);
      const rateText =
        errSummary && errSummary.attempts > 0
          ? `当前错误率 ${Math.round(errSummary.errorRate * 100)}%（错 ${errSummary.wrongCount}/${errSummary.attempts} 题）`
          : '高权重核心考点章节';

      tasks.push({
        id: `task-${d}-ch-${ch.id}`,
        dayIndex: d,
        dateLabel,
        titleZh: `${ch.code} 专项突破：${ch.titleZh}`,
        titleEn: ch.titleEn,
        focusType: 'chapter',
        targetChapterIds: [ch.id],
        reasonZh: `${rateText}，重点梳理 ${ch.keyTopics.slice(0, 2).join('、')} 与得分关键词。`,
        estimatedMinutes: mins,
        completed: false,
      });
    }
  }

  res.json({
    id: `plan-${Date.now()}`,
    createdAt: new Date().toISOString(),
    targetExamDate,
    dailyMinutes: mins,
    planDays: days,
    aiSummaryZh:
      wrongQuestionIds && wrongQuestionIds.length > 0
        ? `已根据您在 ${chaptersToUse[0].code} 等章节的错题频率，生成 ${days} 天（每日 ${mins} 分钟）阶梯复习路径，先清零高频错题，再突破跨章模块与全真模考。`
        : `尚未积累错题记录，已为您配置覆盖核心物理化学与 Ch 14–18 有机模块的 ${days} 天诊断复习计划，建议先完成一次模考定位薄弱项。`,
    generatedBy: 'algorithmic',
    tasks,
  });
});

// 7. Structured Answer AI Mark-Scheme Grader (Paper 2 / Paper 4)
app.post('/api/questions/grade-structured', async (req, res) => {
  const { promptEn, markSchemePoints, maxMarks, studentAnswer } = req.body as {
    promptEn: string;
    markSchemePoints: string[];
    maxMarks: number;
    studentAnswer: string;
  };

  if (!studentAnswer?.trim()) {
    res.status(400).json({ error: '请输入您的作答内容后再进行评分。' });
    return;
  }

  const ai = getGeminiClient();
  if (!ai) {
    res.json({
      awardedMarks: 0,
      feedbackZh: '当前未配置 GEMINI_API_KEY，请对照下方官方 Mark Scheme 要点自评勾选得分点。',
      matchedPoints: [],
      missedPoints: markSchemePoints ?? [],
    });
    return;
  }

  try {
    const resp = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents:
        `You are a strict CAIE A-Level Chemistry 9701 examiner.\n` +
        `Question: ${promptEn}\n` +
        `Maximum Marks: ${maxMarks}\n` +
        `Official Mark Scheme Points:\n${(markSchemePoints ?? []).join('\n')}\n\n` +
        `Student Answer:\n${studentAnswer}\n\n` +
        `Award marks strictly based on the mark scheme points (0 to ${maxMarks}) and provide concise Chinese feedback explaining which points were earned and what phrasing/units were missed.`,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            awardedMarks: { type: Type.INTEGER },
            feedbackZh: { type: Type.STRING },
            matchedPoints: { type: Type.ARRAY, items: { type: Type.STRING } },
            missedPoints: { type: Type.ARRAY, items: { type: Type.STRING } },
          },
          required: ['awardedMarks', 'feedbackZh', 'matchedPoints', 'missedPoints'],
        },
      },
    });

    const parsed = parseJsonSafe<{
      awardedMarks: number;
      feedbackZh: string;
      matchedPoints: string[];
      missedPoints: string[];
    }>(resp.text, {
      awardedMarks: 0,
      feedbackZh: '评分解析返回格式异常，请对照 Mark Scheme 自评。',
      matchedPoints: [],
      missedPoints: markSchemePoints ?? [],
    });

    res.json({
      awardedMarks: Math.max(0, Math.min(maxMarks, parsed.awardedMarks)),
      feedbackZh: parsed.feedbackZh,
      matchedPoints: parsed.matchedPoints ?? [],
      missedPoints: parsed.missedPoints ?? [],
    });
  } catch (err) {
    res.status(500).json({
      error: `AI 阅卷失败：${err instanceof Error ? err.message : '未知错误'}`,
    });
  }
});

app.get('/clipped-papers/:kind/:filename', async (req, res, next) => {
  const { kind, filename } = req.params;
  if (kind !== 'qp' && kind !== 'ms') {
    return next();
  }
  const filePath = await ensureClippedImageOnDisk(kind, filename);
  if (filePath) {
    res.setHeader('Cache-Control', 'public, max-age=60, must-revalidate');
    return res.sendFile(filePath);
  }
  return res.status(404).send('Clipped exam image not found');
});

async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const port = Number(process.env.PORT) || 3000;
  app.listen(port, '0.0.0.0', () => {
    console.log(`Chem9701 Studio server listening on http://0.0.0.0:${port}`);
  });
}

startServer();
