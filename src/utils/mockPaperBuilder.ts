import type {
  DifficultyLevel,
  ExamSession,
  MockPaperMode,
  Question,
  RealPaperFileRef,
} from '../types/chemistry.ts';

const DIFFICULTY_ORDER: Record<DifficultyLevel, number> = {
  Core: 0,
  Standard: 1,
  Challenging: 2,
};

/**
 * Orders single-chapter basic practice questions progressively:
 * 1. Core (前置基础 / 偏简单)
 * 2. Standard (标准真题)
 * 3. Challenging (后置拔高 / 偏难)
 * Within each tier: MCQ before Structured, lower marks before higher marks.
 */
export function sortChapterQuestionsByDifficulty(questions: Question[]): Question[] {
  return [...questions].sort((a, b) => {
    const diffDelta = DIFFICULTY_ORDER[a.difficulty] - DIFFICULTY_ORDER[b.difficulty];
    if (diffDelta !== 0) return diffDelta;
    if (a.type !== b.type) return a.type === 'mcq' ? -1 : 1;
    if (a.marks !== b.marks) return a.marks - b.marks;
    return b.year - a.year;
  });
}

export type MockPresetId = 'as-mini' | 'as-full' | 'a2-mini' | 'a2-full';

export interface MockPresetSpec {
  id: MockPresetId;
  level: 'AS' | 'A2';
  scale: 'mini' | 'full';
  paperMode: MockPaperMode;
  titleZh: string;
  titleEn: string;
  mcqCount: number;
  structuredTargetMarks: number;
  durationMinutes: number;
  descriptionZh: string;
}

export const MOCK_PRESETS: MockPresetSpec[] = [
  {
    id: 'as-mini',
    level: 'AS',
    scale: 'mini',
    paperMode: 'AS Mini Mock',
    titleZh: 'AS 小模考',
    titleEn: 'AS Mini Mock',
    mcqCount: 10,
    structuredTargetMarks: 15,
    durationMinutes: 35,
    descriptionZh: '10 道 Paper 1 选择题（10 分）+ 约 15 分 Paper 2 小问简答，总分约 25 分',
  },
  {
    id: 'as-full',
    level: 'AS',
    scale: 'full',
    paperMode: 'AS Full Mock',
    titleZh: 'AS 大模考',
    titleEn: 'AS Full Mock',
    mcqCount: 20,
    structuredTargetMarks: 30,
    durationMinutes: 70,
    descriptionZh: '20 道 Paper 1 选择题（20 分）+ 约 30 分 Paper 2 小问简答，总分约 50 分',
  },
  {
    id: 'a2-mini',
    level: 'A2',
    scale: 'mini',
    paperMode: 'A2 Mini Mock',
    titleZh: 'A2 小模考',
    titleEn: 'A2 Mini Mock',
    mcqCount: 0,
    structuredTargetMarks: 25,
    durationMinutes: 35,
    descriptionZh: '约 25 分 Paper 4/5 小问简答（按小问独立呈现，支持 AI 按 MS 批改）',
  },
  {
    id: 'a2-full',
    level: 'A2',
    scale: 'full',
    paperMode: 'A2 Full Mock',
    titleZh: 'A2 大模考',
    titleEn: 'A2 Full Mock',
    mcqCount: 0,
    structuredTargetMarks: 50,
    durationMinutes: 70,
    descriptionZh: '约 50 分 Paper 4/5 小问简答（涵盖 A2 物化、过渡金属、合成与波谱）',
  },
];

function shuffle<T>(list: T[]): T[] {
  const arr = [...list];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Selects structured sub-part questions whose marks sum as closely as possible
 * to `targetMarks` (within ±1 mark whenever available), avoiding duplicate parent
 * questions unless needed and balancing chapters.
 */
function packStructuredToTargetMarks(pool: Question[], targetMarks: number): Question[] {
  // Prefer sub-part structured questions with clear clipped images
  const subParts = pool.filter((q) => q.type === 'structured' && Boolean(q.subPart));
  const candidates = subParts.length > 0 ? subParts : pool.filter((q) => q.type === 'structured');
  if (candidates.length === 0) return [];

  let bestSet: Question[] = [];
  let bestDiff = Infinity;

  // Run 24 randomized trials and pick the closest mark total (with chapter diversity tie-break)
  for (let trial = 0; trial < 24; trial++) {
    const shuffled = shuffle(candidates);
    const picked: Question[] = [];
    const usedParent = new Set<string>();
    let total = 0;

    // Pass 1: unique parent questions first
    for (const q of shuffled) {
      if (total >= targetMarks) break;
      const parentKey = `${q.paperCode}-Q${q.questionNumber}`;
      if (usedParent.has(parentKey)) continue;
      if (total + q.marks <= targetMarks + 1) {
        picked.push(q);
        usedParent.add(parentKey);
        total += q.marks;
      }
    }

    // Pass 2: if still short by >=2 marks, allow any remaining sub-part to hit target tightly
    if (targetMarks - total >= 2) {
      const pickedIds = new Set(picked.map((p) => p.id));
      for (const q of shuffled) {
        if (pickedIds.has(q.id)) continue;
        if (total + q.marks <= targetMarks + 1) {
          picked.push(q);
          pickedIds.add(q.id);
          total += q.marks;
          if (Math.abs(total - targetMarks) <= 1) break;
        }
      }
    }

    // Local 1-swap refinement if not exact
    if (total !== targetMarks) {
      const pickedIds = new Set(picked.map((p) => p.id));
      const remaining = shuffled.filter((q) => !pickedIds.has(q.id));
      for (let i = 0; i < picked.length && total !== targetMarks; i++) {
        const needed = targetMarks - (total - picked[i].marks);
        const exact = remaining.find((r) => r.marks === needed);
        if (exact) {
          total = total - picked[i].marks + exact.marks;
          picked[i] = exact;
          break;
        }
      }
    }

    const diff = Math.abs(total - targetMarks);
    if (diff < bestDiff) {
      bestDiff = diff;
      bestSet = picked;
      if (diff === 0) break;
    }
  }

  return bestSet;
}

export function buildPresetMockPaper(
  preset: MockPresetSpec,
  allQuestions: Question[],
  options: {
    yearRange?: 'all' | '2021-2026' | '2018-2020';
    crossChapterOnly?: boolean;
  } = {}
): {
  questions: Question[];
  mcqCount: number;
  structuredCount: number;
  structuredMarks: number;
  totalMarks: number;
  durationSeconds: number;
} {
  const { yearRange = 'all', crossChapterOnly = false } = options;

  const filtered = allQuestions.filter((q) => {
    if (yearRange === '2021-2026' && q.year < 2021) return false;
    if (yearRange === '2018-2020' && (q.year < 2018 || q.year > 2020)) return false;
    if (crossChapterOnly && q.chapters.length < 2) return false;
    if (preset.level === 'AS') {
      return (q.paperNumber === 1 || q.paperNumber === 2) && q.chapters.every((c) => c <= 18);
    }
    return (q.paperNumber === 4 || q.paperNumber === 5) && q.chapters.every((c) => c >= 19);
  });

  const mcqPool = filtered.filter((q) => q.type === 'mcq');
  const structuredPool = filtered.filter((q) => q.type === 'structured');

  const pickedMcq = preset.mcqCount > 0 ? shuffle(mcqPool).slice(0, preset.mcqCount) : [];
  const pickedStructured = packStructuredToTargetMarks(
    structuredPool,
    preset.structuredTargetMarks
  );

  // Order cleanly: Section A (MCQs) first, Section B (Structured sub-parts) second
  const questions = [...pickedMcq, ...pickedStructured];
  const structuredMarks = pickedStructured.reduce((sum, q) => sum + q.marks, 0);
  const totalMarks = pickedMcq.length + structuredMarks;

  return {
    questions,
    mcqCount: pickedMcq.length,
    structuredCount: pickedStructured.length,
    structuredMarks,
    totalMarks,
    durationSeconds: preset.durationMinutes * 60,
  };
}

export interface RealPaperBundle {
  key: string;
  level: 'AS' | 'A2';
  year: number;
  session: ExamSession;
  sessionLabel: string;
  variantLabel: string;
  titleZh: string;
  paperCodes: string[];
  questions: Question[];
  mcqCount: number;
  structuredCount: number;
  totalMarks: number;
  durationSeconds: number;
  files: RealPaperFileRef[];
}

function paperCodeToPdfNames(paperCode: string): RealPaperFileRef | null {
  // e.g. "9701/12/M/J/24" -> 9701_s24_qp_12.pdf / 9701_s24_ms_12.pdf
  const m = paperCode.match(/^9701\/(\d{2})\/(F\/M|M\/J|O\/N)\/(\d{2})$/);
  if (!m) return null;
  const [, comp, sess, yy] = m;
  const sc = sess === 'F/M' ? 'm' : sess === 'M/J' ? 's' : 'w';
  return {
    paperCode,
    qpFileName: `9701_${sc}${yy}_qp_${comp}.pdf`,
    msFileName: `9701_${sc}${yy}_ms_${comp}.pdf`,
  };
}

function sortByOriginalOrder(list: Question[]): Question[] {
  return [...list].sort((a, b) => {
    if (a.paperNumber !== b.paperNumber) return a.paperNumber - b.paperNumber;
    if (a.questionNumber !== b.questionNumber) return a.questionNumber - b.questionNumber;
    return (a.subPart ?? '').localeCompare(b.subPart ?? '');
  });
}

function sessionLabelOf(s: ExamSession): string {
  return s === 'F/M' ? 'Feb/Mar' : s === 'M/J' ? 'May/June' : 'Oct/Nov';
}

/**
 * Discovers authentic full/substantial AS & A2 past paper sittings available
 * in the question bank for "实测模考" (Random Real Past Paper Mock).
 */
export function getAvailableRealPaperBundles(
  allQuestions: Question[],
  level: 'AS' | 'A2'
): RealPaperBundle[] {
  if (level === 'AS') {
    // Group AS papers by (year, session, variant) so P1 + P2 from the same sitting pair together
    const sittingMap = new Map<string, Question[]>();
    for (const q of allQuestions) {
      if (q.paperNumber !== 1 && q.paperNumber !== 2) continue;
      const m = q.paperCode.match(/^9701\/\d(\d)\/(F\/M|M\/J|O\/N)\/(\d{2})$/);
      if (!m) continue;
      const variant = m[1];
      const key = `AS-${q.year}-${q.session}-v${variant}`;
      const list = sittingMap.get(key) ?? [];
      list.push(q);
      sittingMap.set(key, list);
    }

    const bundles: RealPaperBundle[] = [];
    for (const [key, list] of sittingMap.entries()) {
      const sorted = sortByOriginalOrder(list);
      const mcqCount = sorted.filter((q) => q.type === 'mcq').length;
      const structuredCount = sorted.filter((q) => q.type === 'structured').length;
      const totalMarks = sorted.reduce((s, q) => s + q.marks, 0);
      // Require substantial real exam coverage (at least 25 marks total, ideally both P1 + P2)
      if (totalMarks < 25) continue;
      const sample = sorted[0];
      const paperCodes = Array.from(new Set(sorted.map((q) => q.paperCode)));
      const variant = key.split('-v')[1] ?? '2';
      const files = paperCodes
        .map(paperCodeToPdfNames)
        .filter((f): f is RealPaperFileRef => Boolean(f));
      const durationSeconds = Math.max(
        1800,
        mcqCount * 105 + sorted.filter((q) => q.type === 'structured').reduce((s, q) => s + q.marks * 75, 0)
      );

      bundles.push({
        key,
        level: 'AS',
        year: sample.year,
        session: sample.session,
        sessionLabel: sessionLabelOf(sample.session),
        variantLabel: `Variant ${variant}`,
        titleZh: `${sample.year} ${sessionLabelOf(sample.session)} AS 实测卷 (${paperCodes.join(' + ')})`,
        paperCodes,
        questions: sorted,
        mcqCount,
        structuredCount,
        totalMarks,
        durationSeconds,
        files,
      });
    }

    // Prefer sittings with BOTH Paper 1 and Paper 2 if available
    const completePairs = bundles.filter((b) => b.mcqCount >= 15 && b.structuredCount >= 4);
    const chosen = completePairs.length >= 3 ? completePairs : bundles;
    return chosen.sort((a, b) => b.year - a.year || b.totalMarks - a.totalMarks);
  }

  // A2: group by individual Paper 4 sitting (real CAIE Paper 4 exam)
  const p4Map = new Map<string, Question[]>();
  for (const q of allQuestions) {
    if (q.paperNumber !== 4) continue;
    const list = p4Map.get(q.paperCode) ?? [];
    list.push(q);
    p4Map.set(q.paperCode, list);
  }

  const bundles: RealPaperBundle[] = [];
  for (const [paperCode, list] of p4Map.entries()) {
    const sorted = sortByOriginalOrder(list);
    const totalMarks = sorted.reduce((s, q) => s + q.marks, 0);
    if (totalMarks < 32) continue; // Only issue substantial real A2 papers
    const sample = sorted[0];
    const m = paperCode.match(/^9701\/4(\d)\//);
    const variant = m?.[1] ?? '2';
    const fileRef = paperCodeToPdfNames(paperCode);
    bundles.push({
      key: `A2-${paperCode}`,
      level: 'A2',
      year: sample.year,
      session: sample.session,
      sessionLabel: sessionLabelOf(sample.session),
      variantLabel: `Variant ${variant}`,
      titleZh: `${sample.year} ${sessionLabelOf(sample.session)} A2 实测卷 (${paperCode})`,
      paperCodes: [paperCode],
      questions: sorted,
      mcqCount: 0,
      structuredCount: sorted.length,
      totalMarks,
      durationSeconds: Math.max(2400, totalMarks * 75),
      files: fileRef ? [fileRef] : [],
    });
  }

  return bundles.sort((a, b) => b.year - a.year || b.totalMarks - a.totalMarks);
}

export function drawRandomRealPaperBundle(
  allQuestions: Question[],
  level: 'AS' | 'A2',
  excludeKey?: string
): RealPaperBundle | null {
  const bundles = getAvailableRealPaperBundles(allQuestions, level);
  if (bundles.length === 0) return null;
  const pool =
    excludeKey && bundles.length > 1
      ? bundles.filter((b) => b.key !== excludeKey)
      : bundles;
  return pool[Math.floor(Math.random() * pool.length)] ?? null;
}
