import type {
  ChapterErrorSummary,
  MockExamResult,
  ModuleErrorSummary,
  Question,
  QuestionStat,
} from '../types/chemistry.ts';
import { CHAPTERS, STUDY_MODULES } from '../data/syllabus.ts';

export function computeChapterErrorSummaries(
  questions: Question[],
  statsMap: Record<string, QuestionStat>
): ChapterErrorSummary[] {
  return CHAPTERS.map((chapter) => {
    const chQuestions = questions.filter((q) => q.chapters.includes(chapter.id));
    let attempts = 0;
    let wrongCount = 0;
    let recentWeight = 0;
    const now = Date.now();

    for (const q of chQuestions) {
      const st = statsMap[q.id];
      if (!st) continue;
      attempts += st.attempts;
      wrongCount += st.wrongCount;
      if (st.wrongCount > 0 && st.lastWrongAt) {
        const daysAgo = Math.max(
          0,
          (now - new Date(st.lastWrongAt).getTime()) / (1000 * 60 * 60 * 24)
        );
        recentWeight += st.wrongCount * Math.max(0.3, 1.5 - daysAgo * 0.1);
      }
    }

    const errorRate = attempts > 0 ? wrongCount / attempts : 0;
    const priorityScore = Math.round((errorRate * 65 + Math.min(35, recentWeight * 12)) * 10) / 10;

    return {
      chapter,
      attempts,
      wrongCount,
      errorRate,
      priorityScore,
      questionCount: chQuestions.length,
    };
  });
}

export function computeModuleErrorSummaries(
  questions: Question[],
  statsMap: Record<string, QuestionStat>
): ModuleErrorSummary[] {
  return STUDY_MODULES.map((mod) => {
    const modQuestions = questions.filter(
      (q) => q.chapters.length >= 2 && q.moduleId === mod.id
    );
    let attempts = 0;
    let wrongCount = 0;

    for (const q of modQuestions) {
      const st = statsMap[q.id];
      if (!st) continue;
      attempts += st.attempts;
      wrongCount += st.wrongCount;
    }

    return {
      module: mod,
      attempts,
      wrongCount,
      errorRate: attempts > 0 ? wrongCount / attempts : 0,
      questionCount: modQuestions.length,
    };
  });
}

export function getHighFrequencyMistakeQuestions(
  questions: Question[],
  statsMap: Record<string, QuestionStat>
): Array<{ question: Question; stat: QuestionStat }> {
  return questions
    .map((q) => ({ question: q, stat: statsMap[q.id] }))
    .filter((entry): entry is { question: Question; stat: QuestionStat } =>
      Boolean(entry.stat && entry.stat.wrongCount > 0)
    )
    .sort((a, b) => {
      if (b.stat.wrongCount !== a.stat.wrongCount) {
        return b.stat.wrongCount - a.stat.wrongCount;
      }
      const rateB = b.stat.wrongCount / Math.max(1, b.stat.attempts);
      const rateA = a.stat.wrongCount / Math.max(1, a.stat.attempts);
      return rateB - rateA;
    });
}

export function recordQuestionAttempt(
  prev: Record<string, QuestionStat>,
  questionId: string,
  isCorrect: boolean,
  userAnswer: string
): Record<string, QuestionStat> {
  const existing = prev[questionId];
  const now = new Date().toISOString();
  const nextWrongCount = (existing?.wrongCount ?? 0) + (isCorrect ? 0 : 1);
  const nextHistory = existing?.wrongHistory ? [...existing.wrongHistory] : [];
  if (!isCorrect) {
    nextHistory.unshift({ at: now, userAnswer });
  }

  return {
    ...prev,
    [questionId]: {
      questionId,
      attempts: (existing?.attempts ?? 0) + 1,
      wrongCount: nextWrongCount,
      lastAttemptAt: now,
      lastWrongAt: isCorrect ? existing?.lastWrongAt : now,
      lastCorrect: isCorrect,
      wrongHistory: nextHistory.slice(0, 10),
    },
  };
}

export function getDaysUntilExam(targetExamDate: string): number {
  const target = new Date(targetExamDate);
  const today = new Date();
  const diffMs = target.getTime() - today.getTime();
  return Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
}

export function computeOverallAccuracy(statsMap: Record<string, QuestionStat>): {
  totalAttempts: number;
  totalWrong: number;
  accuracyPercent: number | null;
} {
  let totalAttempts = 0;
  let totalWrong = 0;
  for (const st of Object.values(statsMap)) {
    totalAttempts += st.attempts;
    totalWrong += st.wrongCount;
  }
  if (totalAttempts === 0) {
    return { totalAttempts: 0, totalWrong: 0, accuracyPercent: null };
  }
  return {
    totalAttempts,
    totalWrong,
    accuracyPercent: Math.round(((totalAttempts - totalWrong) / totalAttempts) * 100),
  };
}

export function getLatestMockSummary(mocks: MockExamResult[]): MockExamResult | null {
  if (mocks.length === 0) return null;
  return mocks[0];
}
