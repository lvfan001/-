// Portable study utilities: chapter filtering/resume, Ebbinghaus spaced repetition,
// lightweight teacher assignment codes, and print-ready worksheet HTML generation.

import type { DifficultyLevel, Question, QuestionStat } from '../types/chemistry.ts';
import type { MockPresetId } from './mockPaperBuilder.ts';
import { sortChapterQuestionsByDifficulty } from './mockPaperBuilder.ts';
import { getChapterById } from '../data/syllabus.ts';

export interface ChapterPracticeFilter {
  status: 'all' | 'unattempted' | 'mistakes';
  difficulty: 'all' | DifficultyLevel;
  qType: 'all' | 'mcq' | 'structured';
  limit: 0 | 10 | 15;
}

export const DEFAULT_CHAPTER_FILTER: ChapterPracticeFilter = {
  status: 'all',
  difficulty: 'all',
  qType: 'all',
  limit: 0,
};

export interface ChapterResumeEntry {
  lastIndex: number;
  lastQuestionId: string;
  totalQuestions: number;
  updatedAt: string;
}

export type ChapterResumeMap = Record<number, ChapterResumeEntry>;

export function filterChapterQuestions(
  allQuestions: Question[],
  chapterId: number,
  filter: ChapterPracticeFilter,
  statsMap: Record<string, QuestionStat>
): Question[] {
  const base = sortChapterQuestionsByDifficulty(
    allQuestions.filter((q) => q.chapters.length === 1 && q.chapters[0] === chapterId)
  );

  let filtered = base.filter((q) => {
    const st = statsMap[q.id];
    if (filter.status === 'unattempted' && st && st.attempts > 0) return false;
    if (
      filter.status === 'mistakes' &&
      (!st || st.wrongCount === 0 || (st.consecutiveCorrect ?? 0) >= 2)
    ) {
      return false;
    }
    if (filter.difficulty !== 'all' && q.difficulty !== filter.difficulty) return false;
    if (filter.qType !== 'all' && q.type !== filter.qType) return false;
    return true;
  });

  if (filter.limit > 0 && filtered.length > filter.limit) {
    // Keep proportional tier order when taking a micro-set
    filtered = filtered.slice(0, filter.limit);
  }

  return filtered;
}

export interface SpacedReviewItem {
  question: Question;
  stat: QuestionStat;
  stageLabel: string;
  daysSinceWrong: number;
  dueNow: boolean;
  nextDueInDays: number;
}

/**
 * Ebbinghaus spaced repetition schedule (1 / 3 / 7 days):
 * - Last wrong & consecutiveCorrect === 0 -> due immediately or 1 day after wrong
 * - consecutiveCorrect === 1 -> due 3 days after last attempt (2nd consecutive correct clears!)
 * - consecutiveCorrect >= 2 -> mastered, automatically cleared from active review
 */
export function getSpacedReviewSchedule(
  questions: Question[],
  statsMap: Record<string, QuestionStat>,
  nowMs = Date.now()
): { dueToday: SpacedReviewItem[]; upcoming: SpacedReviewItem[]; clearedCount: number } {
  const dueToday: SpacedReviewItem[] = [];
  const upcoming: SpacedReviewItem[] = [];
  let clearedCount = 0;

  for (const q of questions) {
    const st = statsMap[q.id];
    if (!st || st.wrongCount === 0) continue;

    const streak = st.consecutiveCorrect ?? 0;
    if (streak >= 2) {
      clearedCount++;
      continue;
    }

    const refTime = new Date(st.lastWrongAt ?? st.lastAttemptAt).getTime();
    const lastAttemptTime = new Date(st.lastAttemptAt).getTime();
    const daysSinceWrong = Math.max(0, (nowMs - refTime) / 86400000);
    const daysSinceAttempt = Math.max(0, (nowMs - lastAttemptTime) / 86400000);

    // Stage logic:
    // - streak === 0: First回炉 (Day 1 if >0.5d ago, or immediate urgent if wrong >=2 times)
    // - streak === 1: Consolidation回炉 (Day 3 since last attempt; 1 more correct clears it)
    const targetDays = streak === 0 ? (st.wrongCount >= 2 ? 0 : 1) : 3;
    const elapsed = streak === 0 ? daysSinceWrong : daysSinceAttempt;
    const dueNow = elapsed >= targetDays;
    const nextDueInDays = dueNow ? 0 : Math.max(1, Math.ceil(targetDays - elapsed));
    const stageLabel =
      streak === 0
        ? st.wrongCount >= 2
          ? '高频紧急回炉 (需连对2次)'
          : '1天遗忘回炉 (0/2 连对)'
        : '3天巩固回炉 (再对1次清零)';

    const item: SpacedReviewItem = {
      question: q,
      stat: st,
      stageLabel,
      daysSinceWrong: Math.floor(daysSinceWrong),
      dueNow,
      nextDueInDays,
    };

    if (dueNow) dueToday.push(item);
    else upcoming.push(item);
  }

  dueToday.sort(
    (a, b) => b.stat.wrongCount - a.stat.wrongCount || b.daysSinceWrong - a.daysSinceWrong
  );
  upcoming.sort((a, b) => a.nextDueInDays - b.nextDueInDays);

  return { dueToday, upcoming, clearedCount };
}

export interface AssignmentPayload {
  v: 1;
  title: string;
  teacherNote?: string;
  kind: 'chapter' | 'mock-preset' | 'question-ids';
  chapterId?: number;
  filter?: ChapterPracticeFilter;
  presetId?: MockPresetId;
  questionIds?: string[];
  createdAt: string;
}

const CODE_PREFIX = 'CHEM9701-';

function toBase64Url(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(b64: string): string {
  const padded = b64.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((b64.length + 3) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

export function encodeAssignmentCode(payload: AssignmentPayload): string {
  return `${CODE_PREFIX}${toBase64Url(JSON.stringify(payload))}`;
}

export function decodeAssignmentCode(raw: string): AssignmentPayload | null {
  const trimmed = raw.trim();
  const match = trimmed.match(/CHEM9701-[A-Za-z0-9_-]+/);
  const token = match ? match[0].slice(CODE_PREFIX.length) : trimmed;
  try {
    const parsed = JSON.parse(fromBase64Url(token)) as AssignmentPayload;
    if (!parsed || parsed.v !== 1 || !parsed.title || !parsed.kind) return null;
    return parsed;
  } catch {
    return null;
  }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function buildPrintableWorksheetHtml(
  title: string,
  subtitle: string,
  questions: Question[],
  options: { includeMs: boolean; separateMsPage: boolean; originUrl: string }
): string {
  const totalMarks = questions.reduce((sum, q) => sum + q.marks, 0);
  const absUrl = (u: string) =>
    u.startsWith('http://') || u.startsWith('https://')
      ? u
      : `${options.originUrl}${u.startsWith('/') ? '' : '/'}${u}`;

  const qBlocks = questions
    .map((q, idx) => {
      const chLabel = q.chapters
        .map((id) => getChapterById(id)?.code ?? `Ch ${id}`)
        .join(' + ');
      const imgs = (q.clippedImageUrls ?? [])
        .map(
          (url) =>
            `<img src="${escapeHtml(absUrl(url))}" alt="Q${idx + 1}" class="q-img" />`
        )
        .join('');
      const fallbackText =
        !imgs && q.promptEn
          ? `<div class="q-text">${escapeHtml(q.promptEn)}</div>`
          : '';
      const answerLines =
        q.type === 'structured'
          ? `<div class="answer-lines">${Array.from({ length: Math.min(6, Math.max(2, q.marks + 1)) })
              .map(() => '<div class="line"></div>')
              .join('')}</div>`
          : `<div class="mcq-box">Answer: &nbsp; [ A ] &nbsp;&nbsp; [ B ] &nbsp;&nbsp; [ C ] &nbsp;&nbsp; [ D ]</div>`;
      return `
        <div class="q-card">
          <div class="q-meta">
            <span><strong>Q${idx + 1}.</strong> ${escapeHtml(q.paperCode)} Q${q.questionNumber}${escapeHtml(q.subPart ?? '')}</span>
            <span>${escapeHtml(chLabel)} &middot; [${q.marks} mark${q.marks > 1 ? 's' : ''}]</span>
          </div>
          ${imgs}${fallbackText}${answerLines}
        </div>
      `;
    })
    .join('\n');

  const msSection = options.includeMs
    ? `
      <div class="${options.separateMsPage ? 'page-break' : ''} ms-section">
        <div class="header">
          <div class="eyebrow">CAIE A-LEVEL CHEMISTRY (9701) &middot; OFFICIAL MARK SCHEME</div>
          <h1>${escapeHtml(title)} — 评分标准答案卷</h1>
          <div class="meta">共 ${questions.length} 题 &middot; 满分 ${totalMarks} 分</div>
        </div>
        ${questions
          .map((q, idx) => {
            const msImgs = (q.msImageUrls ?? [])
              .map(
                (url) =>
                  `<img src="${escapeHtml(absUrl(url))}" alt="MS ${idx + 1}" class="q-img" />`
              )
              .join('');
            const keyText =
              q.type === 'mcq'
                ? `<div class="ms-key">Official Key: <strong>${escapeHtml(q.correctOption ?? '')}</strong></div>`
                : '';
            const pointsHtml =
              !msImgs && q.markSchemePoints?.length
                ? `<ul class="ms-list">${q.markSchemePoints
                    .map((p) => `<li>${escapeHtml(p)}</li>`)
                    .join('')}</ul>`
                : '';
            return `
              <div class="q-card ms-card">
                <div class="q-meta">
                  <span><strong>Q${idx + 1} MS:</strong> ${escapeHtml(q.paperCode)} Q${q.questionNumber}${escapeHtml(q.subPart ?? '')}</span>
                  <span>[${q.marks} mark${q.marks > 1 ? 's' : ''}]</span>
                </div>
                ${keyText}${msImgs}${pointsHtml}
              </div>
            `;
          })
          .join('\n')}
      </div>
    `
    : '';

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8" />
<title>${escapeHtml(title)}</title>
<style>
  * { box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", sans-serif;
    color: #111;
    background: #fff;
    margin: 0;
    padding: 24px 28px;
    line-height: 1.5;
  }
  .header {
    border-bottom: 2px solid #111;
    padding-bottom: 12px;
    margin-bottom: 18px;
  }
  .eyebrow {
    font-family: monospace;
    font-size: 11px;
    letter-spacing: 0.12em;
    color: #555;
  }
  h1 { margin: 4px 0; font-size: 20px; }
  .meta { font-size: 12px; color: #444; }
  .student-bar {
    display: flex;
    gap: 24px;
    font-size: 12px;
    margin-top: 10px;
    padding-top: 8px;
    border-top: 1px dashed #ccc;
  }
  .q-card {
    border: 1px solid #ddd;
    border-radius: 6px;
    padding: 12px 14px;
    margin-bottom: 14px;
    page-break-inside: avoid;
  }
  .q-meta {
    display: flex;
    justify-content: space-between;
    font-size: 12px;
    font-family: monospace;
    color: #222;
    border-bottom: 1px solid #eee;
    padding-bottom: 6px;
    margin-bottom: 8px;
  }
  .q-img {
    display: block;
    max-width: 100%;
    height: auto;
    margin: 6px auto;
  }
  .q-text { white-space: pre-line; font-size: 13px; margin: 6px 0; }
  .mcq-box {
    margin-top: 8px;
    font-family: monospace;
    font-size: 12px;
    color: #333;
  }
  .answer-lines { margin-top: 10px; }
  .answer-lines .line {
    border-bottom: 1px dotted #999;
    height: 22px;
  }
  .ms-key { font-family: monospace; font-size: 13px; margin-bottom: 6px; }
  .ms-list { margin: 4px 0; padding-left: 18px; font-size: 12px; }
  .page-break { page-break-before: always; margin-top: 24px; }
  @media print {
    body { padding: 10px; }
    .q-card { border-color: #bbb; }
  }
</style>
</head>
<body>
  <div class="header">
    <div class="eyebrow">CAIE A-LEVEL CHEMISTRY (9701) &middot; PRINTABLE WORKSHEET</div>
    <h1>${escapeHtml(title)}</h1>
    <div class="meta">${escapeHtml(subtitle)} &middot; 共 ${questions.length} 题 &middot; 满分 ${totalMarks} 分</div>
    <div class="student-bar">
      <span>Name / 姓名: ______________________</span>
      <span>Date / 日期: ______________</span>
      <span>Score / 得分: ______ / ${totalMarks}</span>
    </div>
  </div>
  ${qBlocks}
  ${msSection}
</body>
</html>`;
}
