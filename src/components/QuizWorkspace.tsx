import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Award,
  CheckCircle2,
  Clock,
  Flag,
  Languages,
  Loader2,
  RotateCcw,
  Sparkles,
  XCircle,
} from 'lucide-react';
import type {
  ActiveQuizSession,
  MockExamResult,
  Question,
} from '../types/chemistry.ts';
import {
  estimateCaieGrade,
  getChapterById,
  getModuleById,
} from '../data/syllabus.ts';
import { ChemDiagram, ChemText, ClippedQuestionImage } from './ChemVisuals.tsx';

interface QuizWorkspaceProps {
  session: ActiveQuizSession;
  sessionAttemptCount?: number;
  onExit: () => void;
  onRecordAttempt: (questionId: string, isCorrect: boolean, userAnswer: string) => void;
  onMockCompleted: (result: MockExamResult) => void;
  onRollbackCurrentSession?: () => void;
}

interface AnswerState {
  selectedOption?: 'A' | 'B' | 'C' | 'D';
  writtenText?: string;
  checkedPointIndices?: number[];
  msRevealed?: boolean;
  selfScore?: number;
  aiGrade?: {
    awardedMarks: number;
    feedbackZh: string;
    matchedPoints: string[];
    missedPoints: string[];
  };
  submittedInPractice?: boolean;
  isCorrect?: boolean;
  earnedMarks?: number;
}

export function QuizWorkspace({
  session,
  sessionAttemptCount = 0,
  onExit,
  onRecordAttempt,
  onMockCompleted,
  onRollbackCurrentSession,
}: QuizWorkspaceProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showChinese, setShowChinese] = useState(false);
  const [answers, setAnswers] = useState<Record<string, AnswerState>>({});
  const [flagged, setFlagged] = useState<Record<string, boolean>>({});
  const [secondsLeft, setSecondsLeft] = useState(session.durationSeconds ?? 0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [mockReport, setMockReport] = useState<MockExamResult | null>(null);
  const [gradingAi, setGradingAi] = useState(false);
  const [confirmRollback, setConfirmRollback] = useState(false);
  const [rolledBackNotice, setRolledBackNotice] = useState(false);

  const questions = session.questions;
  const currentQ: Question | undefined = questions[currentIndex];
  const currentAns: AnswerState = currentQ ? answers[currentQ.id] ?? {} : {};

  useEffect(() => {
    if (mockReport) return;
    const timer = window.setInterval(() => {
      setElapsedSeconds((s) => s + 1);
      if (session.mode === 'mock' && session.durationSeconds) {
        setSecondsLeft((prev) => {
          if (prev <= 1) {
            return 0;
          }
          return prev - 1;
        });
      }
    }, 1000);
    return () => window.clearInterval(timer);
  }, [mockReport, session.mode, session.durationSeconds]);

  useEffect(() => {
    if (session.mode === 'mock' && session.durationSeconds && secondsLeft === 0 && !mockReport) {
      handleSubmitMock();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secondsLeft]);

  if (!currentQ) {
    return (
      <div className="rounded-xl border border-white/10 bg-[#18181A] p-10 text-center">
        <p className="text-sm text-[#F8F7F4]/65">当前分组暂无可练习的真题。</p>
        <button
          onClick={onExit}
          className="mt-4 rounded-lg bg-[#E0A458] px-4 py-2 text-sm font-semibold text-[#111113]"
        >
          返回
        </button>
      </div>
    );
  }

  function updateAnswer(qId: string, patch: Partial<AnswerState>) {
    setAnswers((prev) => ({
      ...prev,
      [qId]: { ...(prev[qId] ?? {}), ...patch },
    }));
  }

  function handleExecuteRollback() {
    onRollbackCurrentSession?.();
    setAnswers({});
    setFlagged({});
    setMockReport(null);
    setCurrentIndex(0);
    setElapsedSeconds(0);
    setSecondsLeft(session.durationSeconds ?? 0);
    setConfirmRollback(false);
    setRolledBackNotice(true);
  }

  function handleSelectMcq(label: 'A' | 'B' | 'C' | 'D') {
    if (!currentQ) return;
    if (session.mode === 'practice' && currentAns.submittedInPractice) return;
    setRolledBackNotice(false);
    if (session.mode === 'mock') {
      updateAnswer(currentQ.id, { selectedOption: label });
      return;
    }
    const isCorrect = label === currentQ.correctOption;
    updateAnswer(currentQ.id, {
      selectedOption: label,
      submittedInPractice: true,
      isCorrect,
      earnedMarks: isCorrect ? currentQ.marks : 0,
    });
    onRecordAttempt(currentQ.id, isCorrect, label);
  }

  function handleToggleMarkPoint(idx: number) {
    if (!currentQ) return;
    const existing = currentAns.checkedPointIndices ?? [];
    const next = existing.includes(idx)
      ? existing.filter((i) => i !== idx)
      : [...existing, idx];
    const totalPoints = currentQ.markSchemePoints?.length ?? currentQ.marks;
    const suggestedScore = Math.min(
      currentQ.marks,
      Math.round((next.length / Math.max(1, totalPoints)) * currentQ.marks)
    );
    updateAnswer(currentQ.id, {
      checkedPointIndices: next,
      ...(!currentAns.submittedInPractice ? { selfScore: suggestedScore } : {}),
    });
  }

  function handleRevealStructuredMs() {
    if (!currentQ) return;
    const suggested =
      currentAns.selfScore !== undefined
        ? currentAns.selfScore
        : currentAns.aiGrade?.awardedMarks;
    updateAnswer(currentQ.id, {
      msRevealed: true,
      ...(suggested !== undefined ? { selfScore: suggested } : {}),
    });
  }

  function handleConfirmSelfScore(overrideScore?: number) {
    if (!currentQ || currentAns.submittedInPractice) return;
    const rawScore = overrideScore ?? currentAns.selfScore;
    if (rawScore === undefined) return;
    const earned = Math.max(0, Math.min(currentQ.marks, Math.round(rawScore)));
    const isCorrect = earned >= Math.ceil(currentQ.marks * 0.6);
    setRolledBackNotice(false);
    updateAnswer(currentQ.id, {
      msRevealed: true,
      selfScore: earned,
      submittedInPractice: true,
      isCorrect,
      earnedMarks: earned,
    });
    onRecordAttempt(
      currentQ.id,
      isCorrect,
      currentAns.writtenText?.trim() || `自评 ${earned}/${currentQ.marks} 分`
    );
  }

  async function handleAiGradeStructured() {
    if (!currentQ || !currentAns.writtenText?.trim()) return;
    const targetQ = currentQ;
    setGradingAi(true);
    try {
      const resp = await fetch('/api/questions/grade-structured', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          promptEn: targetQ.promptEn,
          markSchemePoints: targetQ.markSchemePoints ?? [],
          maxMarks: targetQ.marks,
          studentAnswer: currentAns.writtenText,
        }),
      });
      const data = await resp.json();
      if (resp.ok) {
        updateAnswer(targetQ.id, {
          aiGrade: data,
          msRevealed: true,
          ...(typeof data.awardedMarks === 'number' ? { selfScore: data.awardedMarks } : {}),
        });
      }
    } finally {
      setGradingAi(false);
    }
  }

  function handleSubmitMock() {
    let totalMarks = 0;
    let earnedMarks = 0;
    const chapterMap = new Map<number, { attempts: number; wrong: number }>();
    const wrongIds: string[] = [];

    for (const q of questions) {
      totalMarks += q.marks;
      const ans = answers[q.id] ?? {};
      let qCorrect = false;
      let qEarned = 0;
      let userAnsSummary = '未作答';

      if (q.type === 'mcq') {
        qCorrect = ans.selectedOption === q.correctOption;
        qEarned = qCorrect ? q.marks : 0;
        userAnsSummary = ans.selectedOption ?? '未选择';
      } else {
        const pts = q.markSchemePoints?.length ?? q.marks;
        const checked = ans.checkedPointIndices?.length ?? 0;
        qEarned =
          ans.aiGrade?.awardedMarks !== undefined
            ? ans.aiGrade.awardedMarks
            : Math.min(q.marks, Math.round((checked / Math.max(1, pts)) * q.marks));
        qCorrect = qEarned >= Math.ceil(q.marks * 0.6);
        userAnsSummary = ans.writtenText?.trim() || '未填写';
      }

      earnedMarks += qEarned;
      if (!qCorrect) wrongIds.push(q.id);
      onRecordAttempt(q.id, qCorrect, userAnsSummary);

      for (const chId of q.chapters) {
        const prev = chapterMap.get(chId) ?? { attempts: 0, wrong: 0 };
        chapterMap.set(chId, {
          attempts: prev.attempts + 1,
          wrong: prev.wrong + (qCorrect ? 0 : 1),
        });
      }
    }

    const percentage = totalMarks > 0 ? Math.round((earnedMarks / totalMarks) * 100) : 0;
    const result: MockExamResult = {
      id: `mock-${Date.now()}`,
      title: session.title,
      paperMode: session.paperModeLabel ?? 'Full Diagnostic Mock',
      completedAt: new Date().toISOString(),
      durationSeconds: elapsedSeconds,
      totalMarks,
      earnedMarks,
      percentage,
      estimatedGrade: estimateCaieGrade(percentage),
      chapterBreakdown: Array.from(chapterMap.entries()).map(([chapterId, val]) => ({
        chapterId,
        attempts: val.attempts,
        wrong: val.wrong,
      })),
      questionIds: questions.map((q) => q.id),
      wrongQuestionIds: wrongIds,
    };

    setMockReport(result);
    onMockCompleted(result);
  }

  function formatTimer(sec: number): string {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  if (mockReport) {
    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-4">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-[#F8F7F4]/50">
              MOCK ASSESSMENT REPORT
            </p>
            <h1 className="mt-1.5 text-2xl font-semibold text-[#F8F7F4]">
              模拟考测评成绩单 · {mockReport.title}
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            {onRollbackCurrentSession &&
              (!confirmRollback ? (
                <button
                  onClick={() => setConfirmRollback(true)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[#E0A458]/35 bg-[#E0A458]/10 px-3 py-2 text-xs font-medium text-[#E0A458] hover:bg-[#E0A458]/20 whitespace-nowrap shrink-0"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  回退本次模考记录
                </button>
              ) : (
                <div className="inline-flex items-center gap-1.5">
                  <button
                    onClick={handleExecuteRollback}
                    className="rounded-lg bg-[#E0A458] px-3 py-2 text-xs font-semibold text-[#111113] hover:bg-[#EBB66E] whitespace-nowrap"
                  >
                    确认撤回本次模考
                  </button>
                  <button
                    onClick={() => setConfirmRollback(false)}
                    className="rounded-lg border border-white/15 bg-[#18181A] px-2.5 py-2 text-xs text-[#F8F7F4]/70 whitespace-nowrap"
                  >
                    取消
                  </button>
                </div>
              ))}
            <button
              onClick={() => setShowChinese((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-[#18181A] px-3 py-2 text-xs font-medium text-[#F8F7F4]/85 hover:border-[#E0A458]/50 hover:text-[#E0A458] whitespace-nowrap shrink-0"
            >
              <Languages className="h-3.5 w-3.5" />
              {showChinese ? '隐藏中文翻译' : '显示中文翻译'}
            </button>
            <button
              onClick={onExit}
              className="inline-flex items-center gap-2 rounded-lg bg-[#E0A458] px-4 py-2 text-sm font-semibold text-[#111113] hover:bg-[#EBB66E] whitespace-nowrap shrink-0"
            >
              <ArrowLeft className="h-4 w-4" />
              返回工作台
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 divide-y divide-white/10 rounded-xl border border-white/10 bg-[#18181A] sm:grid-cols-4 sm:divide-x sm:divide-y-0">
          <div className="p-5">
            <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-[#F8F7F4]/50">
              总得分
            </div>
            <div className="mt-1.5 font-mono text-2xl font-semibold text-[#F8F7F4] tabular-nums">
              {mockReport.earnedMarks} / {mockReport.totalMarks}
            </div>
          </div>
          <div className="p-5">
            <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-[#F8F7F4]/50">
              得分率
            </div>
            <div className="mt-1.5 font-mono text-2xl font-semibold text-[#F8F7F4] tabular-nums">
              {mockReport.percentage}%
            </div>
          </div>
          <div className="p-5">
            <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-[#F8F7F4]/50">
              CAIE 9701 预估等级
            </div>
            <div className="mt-1.5 flex items-center gap-2 font-mono text-2xl font-bold text-[#E0A458]">
              <Award className="h-5 w-5" />
              {mockReport.estimatedGrade}
            </div>
          </div>
          <div className="p-5">
            <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-[#F8F7F4]/50">
              本次错题数
            </div>
            <div className="mt-1.5 font-mono text-2xl font-semibold text-red-300 tabular-nums">
              {mockReport.wrongQuestionIds.length} 题
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <h2 className="text-base font-semibold text-[#F8F7F4]">
            逐题解析与评分标准复盘（错题已自动同步至错题频率统计）
          </h2>
          {questions.map((q, idx) => {
            const ans = answers[q.id] ?? {};
            const isWrong = mockReport.wrongQuestionIds.includes(q.id);
            return (
              <div key={q.id} className="rounded-xl border border-white/10 bg-[#18181A] p-5">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="font-mono font-semibold text-[#F8F7F4]">
                    第 {idx + 1} 题 · {q.paperCode} ·{' '}
                    {q.chapters.map((c) => getChapterById(c)?.code ?? `Ch ${c}`).join(' + ')}
                  </span>
                  <span
                    className={`inline-flex items-center gap-1 font-medium ${
                      isWrong ? 'text-red-300' : 'text-emerald-300'
                    }`}
                  >
                    {isWrong ? (
                      <>
                        <XCircle className="h-3.5 w-3.5" /> 需巩固
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="h-3.5 w-3.5" /> 达标
                      </>
                    )}
                  </span>
                </div>
                {!(q.clippedImageUrls && q.clippedImageUrls.length > 0) && (
                  <p className="mt-2 text-sm text-[#F8F7F4]">
                    <ChemText text={q.promptEn} />
                  </p>
                )}
                {showChinese && q.promptZh && (
                  <p className="mt-1.5 rounded-lg border border-white/10 bg-[#141416] px-3 py-2 text-xs text-[#F8F7F4]/80">
                    <ChemText text={q.promptZh} />
                  </p>
                )}
                {q.clippedImageUrls?.map((url, imgIdx) => (
                  <ClippedQuestionImage
                    key={url}
                    imageUrl={url}
                    alt={`${q.paperCode} Q${q.questionNumber} Page ${imgIdx + 1}`}
                    caption={
                      q.clippedImageUrls!.length > 1
                        ? `${q.paperCode} Q${q.questionNumber}${q.subPart ?? ''} 原卷截图（第 ${imgIdx + 1}/${q.clippedImageUrls!.length} 页）`
                        : `${q.paperCode} Q${q.questionNumber}${q.subPart ?? ''} 原卷截图`
                    }
                  />
                ))}
                {q.clippedImageId && (
                  <ClippedQuestionImage
                    imageId={q.clippedImageId}
                    alt={`${q.paperCode} Q${q.questionNumber}`}
                  />
                )}
                {(q.diagramSpec || q.diagramType) && (
                  <ChemDiagram
                    type={q.diagramType}
                    spec={q.diagramSpec}
                    caption={q.diagramCaption}
                  />
                )}
                {q.type === 'mcq' && (
                  <p className="mt-2 font-mono text-xs text-[#F8F7F4]/70">
                    你的选择：{ans.selectedOption ?? '未选'} · 正确答案：{q.correctOption}
                  </p>
                )}
                {q.type === 'structured' && q.markSchemePoints && !q.msImageUrls?.length && (
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-[#F8F7F4]/75">
                    {q.markSchemePoints.map((pt, i) => (
                      <li key={i}>
                        <ChemText text={pt} />
                      </li>
                    ))}
                  </ul>
                )}
                {q.msImageUrls?.map((url, msIdx) => (
                  <ClippedQuestionImage
                    key={url}
                    imageUrl={url}
                    alt={`${q.paperCode} Q${q.questionNumber} Mark Scheme ${msIdx + 1}`}
                    caption={
                      q.msImageUrls!.length > 1
                        ? `Official Mark Scheme 原卷评分标准截图（${msIdx + 1}/${q.msImageUrls!.length}）`
                        : 'Official Mark Scheme 原卷评分标准截图'
                    }
                  />
                ))}
                {q.msImageId && (
                  <ClippedQuestionImage
                    imageId={q.msImageId}
                    alt={`${q.paperCode} Mark Scheme`}
                    caption="Official Mark Scheme 原卷评分标准截图"
                  />
                )}
                <p className="mt-2.5 border-t border-white/[0.06] pt-2.5 text-xs leading-relaxed text-[#F8F7F4]/65">
                  Examiner Note: <ChemText text={q.explanationEn} />
                </p>
                {showChinese && q.explanationZh && (
                  <p className="mt-1 text-xs leading-relaxed text-[#F8F7F4]/75">
                    中文精析：<ChemText text={q.explanationZh} />
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  const modObj = currentQ.moduleId ? getModuleById(currentQ.moduleId) : undefined;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onExit}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-[#18181A] px-3 py-1.5 text-xs font-medium text-[#F8F7F4]/85 hover:border-[#E0A458]/50 hover:text-[#E0A458] whitespace-nowrap shrink-0"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            退出
          </button>
          <div>
            <h1 className="text-base font-semibold text-[#F8F7F4]">{session.title}</h1>
            <p className="text-xs text-[#F8F7F4]/55">{session.subtitle}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {onRollbackCurrentSession &&
            sessionAttemptCount > 0 &&
            (!confirmRollback ? (
              <button
                onClick={() => setConfirmRollback(true)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[#E0A458]/35 bg-[#E0A458]/10 px-3 py-1.5 text-xs font-medium text-[#E0A458] hover:bg-[#E0A458]/20 whitespace-nowrap shrink-0"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                回退本次记录 ({sessionAttemptCount})
              </button>
            ) : (
              <div className="inline-flex items-center gap-1.5">
                <button
                  onClick={handleExecuteRollback}
                  className="rounded-lg bg-[#E0A458] px-3 py-1.5 text-xs font-semibold text-[#111113] hover:bg-[#EBB66E] whitespace-nowrap"
                >
                  确认回退本次记录
                </button>
                <button
                  onClick={() => setConfirmRollback(false)}
                  className="rounded-lg border border-white/15 bg-[#18181A] px-2.5 py-1.5 text-xs text-[#F8F7F4]/70 whitespace-nowrap"
                >
                  取消
                </button>
              </div>
            ))}

          <button
            onClick={() => setShowChinese((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-[#18181A] px-3 py-1.5 text-xs font-medium text-[#F8F7F4]/85 hover:border-[#E0A458]/50 hover:text-[#E0A458] whitespace-nowrap shrink-0"
          >
            <Languages className="h-3.5 w-3.5" />
            {showChinese ? '隐藏中文翻译' : '显示中文翻译'}
          </button>

          <div className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-[#18181A] px-3 py-1.5 font-mono text-xs font-semibold text-[#E0A458] tabular-nums">
            <Clock className="h-3.5 w-3.5 text-[#E0A458]/80" />
            {session.mode === 'mock'
              ? `剩余 ${formatTimer(secondsLeft)}`
              : formatTimer(elapsedSeconds)}
          </div>

          {session.mode === 'mock' && (
            <button
              onClick={handleSubmitMock}
              className="rounded-lg bg-[#E0A458] px-4 py-1.5 text-xs font-semibold text-[#111113] hover:bg-[#EBB66E] whitespace-nowrap shrink-0"
            >
              交卷并评分
            </button>
          )}
        </div>
      </div>

      {rolledBackNotice && (
        <div className="flex items-center justify-between rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-xs text-emerald-300">
          <span>已无损回退本次练习记录，题库错题统计与正确率已还原至练习前状态。</span>
          <button
            onClick={() => setRolledBackNotice(false)}
            className="font-medium text-emerald-200 hover:underline"
          >
            知道了
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="rounded-xl border border-white/10 bg-[#18181A] p-6 lg:col-span-9">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.06] pb-3 text-xs text-[#F8F7F4]/55">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono font-semibold text-[#F8F7F4]">
                第 {currentIndex + 1} / {questions.length} 题
              </span>
              <span aria-hidden="true">·</span>
              <span className="font-mono">
                {currentQ.paperCode} Q{currentQ.questionNumber}
                {currentQ.subPart ?? ''}
              </span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums">
                {currentQ.marks} mark{currentQ.marks > 1 ? 's' : ''}
              </span>
              <span aria-hidden="true">·</span>
              <span className="font-mono text-[#E0A458]">
                {currentQ.chapters.map((id) => getChapterById(id)?.code ?? `Ch ${id}`).join(' + ')}
              </span>
              {modObj && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono">{modObj.code}</span>
                </>
              )}
            </div>

            <button
              onClick={() =>
                setFlagged((prev) => ({ ...prev, [currentQ.id]: !prev[currentQ.id] }))
              }
              className={`inline-flex items-center gap-1 text-xs font-medium transition-colors ${
                flagged[currentQ.id]
                  ? 'text-[#E0A458]'
                  : 'text-[#F8F7F4]/45 hover:text-[#F8F7F4]'
              }`}
            >
              <Flag className="h-3.5 w-3.5" />
              {flagged[currentQ.id] ? '已标记疑难' : '标记'}
            </button>
          </div>

          <div className="mt-4 space-y-3">
            {!(currentQ.clippedImageUrls && currentQ.clippedImageUrls.length > 0) && (
              <p className="whitespace-pre-line text-base leading-relaxed text-[#F8F7F4]">
                <ChemText text={currentQ.promptEn} />
              </p>
            )}
            {showChinese && currentQ.promptZh && (
              <p className="whitespace-pre-line rounded-lg border border-white/10 bg-[#141416] px-4 py-3 text-sm leading-relaxed text-[#F8F7F4]/80">
                <ChemText text={currentQ.promptZh} />
              </p>
            )}
          </div>

          {currentQ.clippedImageUrls?.map((url, imgIdx) => (
            <ClippedQuestionImage
              key={url}
              imageUrl={url}
              alt={`${currentQ.paperCode} Q${currentQ.questionNumber} Page ${imgIdx + 1}`}
              caption={
                currentQ.clippedImageUrls!.length > 1
                  ? `${currentQ.paperCode} Q${currentQ.questionNumber}${currentQ.subPart ?? ''} 原卷截图（第 ${imgIdx + 1}/${currentQ.clippedImageUrls!.length} 页 · 点击放大）`
                  : `${currentQ.paperCode} Q${currentQ.questionNumber}${currentQ.subPart ?? ''} 原卷截图（点击放大）`
              }
            />
          ))}

          {currentQ.clippedImageId && (
            <ClippedQuestionImage
              imageId={currentQ.clippedImageId}
              alt={`${currentQ.paperCode} Q${currentQ.questionNumber}`}
              caption={
                currentQ.diagramCaption ?? `${currentQ.paperCode} Q${currentQ.questionNumber} 原卷截图`
              }
            />
          )}

          {(currentQ.diagramSpec || currentQ.diagramType) && (
            <ChemDiagram
              type={currentQ.diagramType}
              spec={currentQ.diagramSpec}
              caption={currentQ.diagramCaption}
            />
          )}

          {currentQ.type === 'mcq' && currentQ.options ? (
            currentQ.clippedImageUrls?.length &&
            currentQ.options.every((o) => o.text.includes('见原卷截图')) ? (
              <div className="mt-5">
                <div className="mb-2 text-xs font-medium text-[#F8F7F4]/55">
                  请对照原卷截图选择答案：
                </div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {currentQ.options.map((opt) => {
                    const isSelected = currentAns.selectedOption === opt.label;
                    const isRevealed =
                      session.mode === 'practice' && currentAns.submittedInPractice;
                    const isCorrectOpt = currentQ.correctOption === opt.label;

                    let btnClass =
                      'border-white/12 bg-[#141416] hover:border-[#E0A458]/60 text-[#F8F7F4]';
                    if (isRevealed) {
                      if (isCorrectOpt) {
                        btnClass = 'border-emerald-500/60 bg-emerald-500/15 text-emerald-200';
                      } else if (isSelected && !isCorrectOpt) {
                        btnClass = 'border-red-500/60 bg-red-500/15 text-red-200';
                      }
                    } else if (isSelected) {
                      btnClass = 'border-[#E0A458] bg-[#E0A458]/15 text-[#E0A458]';
                    }

                    return (
                      <button
                        key={opt.label}
                        onClick={() => handleSelectMcq(opt.label)}
                        className={`flex items-center justify-center gap-2 rounded-xl border px-4 py-3 font-mono text-sm font-semibold transition-colors ${btnClass}`}
                      >
                        <span>{opt.label}</span>
                        {isRevealed && isCorrectOpt && (
                          <span className="text-xs font-medium text-emerald-300">✓ 正确</span>
                        )}
                        {isRevealed && isSelected && !isCorrectOpt && (
                          <span className="text-xs font-medium text-red-300">✗ 误选</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="mt-6 space-y-2.5">
                {currentQ.options.map((opt) => {
                  const isSelected = currentAns.selectedOption === opt.label;
                  const isRevealed =
                    session.mode === 'practice' && currentAns.submittedInPractice;
                  const isCorrectOpt = currentQ.correctOption === opt.label;

                  let btnClass =
                    'border-white/12 bg-[#141416] hover:border-[#E0A458]/50 text-[#F8F7F4]';
                  if (isRevealed) {
                    if (isCorrectOpt) {
                      btnClass = 'border-emerald-500/60 bg-emerald-500/15 text-emerald-200';
                    } else if (isSelected && !isCorrectOpt) {
                      btnClass = 'border-red-500/60 bg-red-500/15 text-red-200';
                    }
                  } else if (isSelected) {
                    btnClass = 'border-[#E0A458] bg-[#E0A458]/15 text-[#E0A458]';
                  }

                  return (
                    <button
                      key={opt.label}
                      onClick={() => handleSelectMcq(opt.label)}
                      className={`flex w-full items-center gap-3.5 rounded-xl border px-4 py-3 text-left text-sm transition-colors ${btnClass}`}
                    >
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-current/25 font-mono text-xs font-semibold">
                        {opt.label}
                      </span>
                      <span className="flex-1">
                        <ChemText text={opt.text} />
                      </span>
                      {isRevealed && isCorrectOpt && (
                        <span className="text-xs font-semibold text-emerald-300">正确</span>
                      )}
                      {isRevealed && isSelected && !isCorrectOpt && (
                        <span className="text-xs font-semibold text-red-300">误选</span>
                      )}
                    </button>
                  );
                })}
              </div>
            )
          ) : (
            <div className="mt-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-[#F8F7F4]/70">
                  作答区（支持输入反应方程式、计算过程与关键词）
                </label>
                <textarea
                  rows={4}
                  value={currentAns.writtenText ?? ''}
                  onChange={(e) =>
                    updateAnswer(currentQ.id, { writtenText: e.target.value })
                  }
                  placeholder="在此输入你的解题步骤与结论..."
                  className="mt-1.5 w-full rounded-xl border border-white/15 bg-[#111113] px-3.5 py-2.5 text-sm text-[#F8F7F4] placeholder:text-[#F8F7F4]/35 focus:border-[#E0A458] focus:outline-none"
                />
              </div>

              {session.mode === 'practice' && (
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    onClick={handleAiGradeStructured}
                    disabled={!currentAns.writtenText?.trim() || gradingAi}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-[#141416] px-3.5 py-2 text-xs font-medium text-[#F8F7F4]/85 hover:border-[#E0A458] hover:text-[#E0A458] disabled:opacity-35 whitespace-nowrap shrink-0"
                  >
                    {gradingAi ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="h-3.5 w-3.5 text-[#E0A458]" />
                    )}
                    AI 按评分标准批改
                  </button>

                  {!currentAns.msRevealed && !currentAns.submittedInPractice && (
                    <button
                      onClick={handleRevealStructuredMs}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-[#E0A458] px-4 py-2 text-xs font-semibold text-[#111113] hover:bg-[#EBB66E] whitespace-nowrap shrink-0"
                    >
                      查看官方答案 (MS) 并自评得分
                    </button>
                  )}
                </div>
              )}

              {currentAns.aiGrade && (
                <div className="rounded-xl border border-[#E0A458]/30 bg-[#E0A458]/10 p-4 text-xs text-[#F8F7F4]/85">
                  <div className="font-mono font-semibold text-[#E0A458]">
                    AI 建议得分：{currentAns.aiGrade.awardedMarks} / {currentQ.marks} 分
                  </div>
                  <p className="mt-1 leading-relaxed">{currentAns.aiGrade.feedbackZh}</p>
                </div>
              )}
            </div>
          )}

          {session.mode === 'practice' &&
            currentQ.type === 'structured' &&
            (currentAns.msRevealed || currentAns.submittedInPractice) && (
              <div className="mt-6 space-y-4 rounded-xl border border-white/10 bg-[#141416] p-4 sm:p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-sm font-semibold text-[#F8F7F4]">
                    Official Mark Scheme 官方评分标准
                  </div>
                  <span className="font-mono text-xs text-[#E0A458]">
                    本题满分 {currentQ.marks} 分
                  </span>
                </div>

                {currentQ.msImageUrls?.map((url, msIdx) => (
                  <ClippedQuestionImage
                    key={url}
                    imageUrl={url}
                    alt={`${currentQ.paperCode} Q${currentQ.questionNumber} Mark Scheme ${msIdx + 1}`}
                    caption={
                      currentQ.msImageUrls!.length > 1
                        ? `Official Mark Scheme 原卷评分标准截图（${msIdx + 1}/${currentQ.msImageUrls!.length}）`
                        : 'Official Mark Scheme 原卷评分标准截图'
                    }
                  />
                ))}
                {currentQ.msImageId && (
                  <ClippedQuestionImage
                    imageId={currentQ.msImageId}
                    alt={`${currentQ.paperCode} Mark Scheme`}
                    caption="Official Mark Scheme 原卷评分标准截图"
                  />
                )}

                {!currentQ.msImageUrls?.length && currentQ.markSchemePoints?.length ? (
                  <div className="rounded-lg border border-white/10 bg-[#18181A] p-3.5">
                    <div className="text-xs font-semibold text-[#F8F7F4]/90">
                      得分点核对（勾选后可自动计算建议得分）：
                    </div>
                    <div className="mt-2 space-y-2">
                      {currentQ.markSchemePoints.map((pt, idx) => {
                        const checked = (currentAns.checkedPointIndices ?? []).includes(idx);
                        return (
                          <label
                            key={idx}
                            className="flex cursor-pointer items-start gap-2.5 text-xs text-[#F8F7F4]/80"
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              disabled={currentAns.submittedInPractice}
                              onChange={() => handleToggleMarkPoint(idx)}
                              className="mt-0.5 accent-[#E0A458]"
                            />
                            <span>
                              <ChemText text={pt} />
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ) : null}

                {currentQ.modelAnswer && (
                  <p className="text-xs font-medium text-[#F8F7F4]/90">
                    Model Answer: <ChemText text={currentQ.modelAnswer} />
                  </p>
                )}
                <p className="text-xs leading-relaxed text-[#F8F7F4]/65">
                  Examiner Note: <ChemText text={currentQ.explanationEn} />
                </p>
                {showChinese && currentQ.explanationZh && (
                  <p className="rounded-lg border border-white/10 bg-[#18181A] px-3 py-2 text-xs leading-relaxed text-[#F8F7F4]/80">
                    中文精析：<ChemText text={currentQ.explanationZh} />
                  </p>
                )}

                {!currentAns.submittedInPractice ? (
                  <div className="rounded-xl border border-[#E0A458]/35 bg-[#18181A] p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="text-xs font-semibold text-[#F8F7F4]">
                        请对照上方 Mark Scheme 自行批改本题得分：
                      </div>
                      <span className="font-mono text-xs text-[#E0A458]">
                        {currentAns.selfScore !== undefined
                          ? `已选 ${currentAns.selfScore} / ${currentQ.marks} 分`
                          : '尚未选择得分'}
                      </span>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      {currentQ.marks <= 10 ? (
                        Array.from({ length: currentQ.marks + 1 }, (_, s) => {
                          const selected = currentAns.selfScore === s;
                          return (
                            <button
                              key={s}
                              type="button"
                              onClick={() => updateAnswer(currentQ.id, { selfScore: s })}
                              className={`rounded-lg border px-3 py-1.5 font-mono text-xs font-semibold transition-colors ${
                                selected
                                  ? 'border-[#E0A458] bg-[#E0A458] text-[#111113]'
                                  : 'border-white/12 bg-[#141416] text-[#F8F7F4]/85 hover:border-[#E0A458] hover:text-[#E0A458]'
                              }`}
                            >
                              {s} 分{s === currentQ.marks ? '（满分）' : s === 0 ? '（全错）' : ''}
                            </button>
                          );
                        })
                      ) : (
                        <div className="flex flex-wrap items-center gap-2">
                          {[0, Math.floor(currentQ.marks / 2), currentQ.marks].map((s) => (
                            <button
                              key={s}
                              type="button"
                              onClick={() => updateAnswer(currentQ.id, { selfScore: s })}
                              className={`rounded-lg border px-3 py-1.5 font-mono text-xs font-semibold ${
                                currentAns.selfScore === s
                                  ? 'border-[#E0A458] bg-[#E0A458] text-[#111113]'
                                  : 'border-white/12 bg-[#141416] text-[#F8F7F4]/85'
                              }`}
                            >
                              {s} 分
                            </button>
                          ))}
                          <input
                            type="number"
                            min={0}
                            max={currentQ.marks}
                            value={currentAns.selfScore ?? ''}
                            onChange={(e) =>
                              updateAnswer(currentQ.id, {
                                selfScore: Math.max(
                                  0,
                                  Math.min(currentQ.marks, Number(e.target.value) || 0)
                                ),
                              })
                            }
                            placeholder="输入分数"
                            className="w-24 rounded-lg border border-white/15 bg-[#111113] px-2.5 py-1.5 font-mono text-xs text-[#F8F7F4]"
                          />
                        </div>
                      )}
                    </div>

                    <div className="mt-3.5 flex flex-wrap items-center gap-2.5 border-t border-white/[0.06] pt-3">
                      <button
                        type="button"
                        onClick={() => handleConfirmSelfScore()}
                        disabled={currentAns.selfScore === undefined}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-[#E0A458] px-4 py-2 text-xs font-semibold text-[#111113] hover:bg-[#EBB66E] disabled:opacity-35 whitespace-nowrap"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        {currentAns.selfScore !== undefined
                          ? `确认自评得分（${currentAns.selfScore} / ${currentQ.marks} 分）并记录`
                          : '请先点选上方得分'}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleConfirmSelfScore(currentQ.marks)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/35 bg-emerald-500/10 px-3.5 py-2 text-xs font-medium text-emerald-300 hover:bg-emerald-500/20 whitespace-nowrap"
                      >
                        全部写对 · 记满分 ({currentQ.marks}分)
                      </button>
                      <button
                        type="button"
                        onClick={() => handleConfirmSelfScore(0)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/35 bg-red-500/10 px-3.5 py-2 text-xs font-medium text-red-300 hover:bg-red-500/20 whitespace-nowrap"
                      >
                        未做对 · 记 0 分
                      </button>
                    </div>
                  </div>
                ) : (
                  <div
                    className={`rounded-xl border p-3.5 ${
                      currentAns.isCorrect
                        ? 'border-emerald-500/30 bg-emerald-500/10'
                        : 'border-[#E0A458]/35 bg-[#E0A458]/10'
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-semibold">
                      <span className="inline-flex items-center gap-1.5">
                        {currentAns.isCorrect ? (
                          <>
                            <CheckCircle2 className="h-4 w-4 text-emerald-300" />
                            <span className="text-emerald-200">
                              自评得分 {currentAns.earnedMarks ?? 0} / {currentQ.marks} 分 · 作答达标，已更新掌握记录
                            </span>
                          </>
                        ) : (
                          <>
                            <XCircle className="h-4 w-4 text-[#E0A458]" />
                            <span className="text-[#E0A458]">
                              自评得分 {currentAns.earnedMarks ?? 0} / {currentQ.marks} 分 · 需巩固（
                              {currentQ.chapters
                                .map((id) => getChapterById(id)?.code ?? `Ch ${id}`)
                                .join(' / ')}
                              ）
                            </span>
                          </>
                        )}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}

          {session.mode === 'practice' &&
            currentQ.type === 'mcq' &&
            currentAns.submittedInPractice && (
              <div
                className={`mt-6 rounded-xl border p-4 ${
                  currentAns.isCorrect
                    ? 'border-emerald-500/30 bg-emerald-500/10'
                    : 'border-red-500/30 bg-red-500/10'
                }`}
              >
                <div className="flex items-center gap-2 text-sm font-semibold">
                  {currentAns.isCorrect ? (
                    <>
                      <CheckCircle2 className="h-4 w-4 text-emerald-300" />
                      <span className="text-emerald-200">作答达标 · 已更新章节掌握记录</span>
                    </>
                  ) : (
                    <>
                      <XCircle className="h-4 w-4 text-red-300" />
                      <span className="text-red-200">
                        未达标 · 已自动计入错题频率（
                        {currentQ.chapters
                          .map((id) => getChapterById(id)?.code ?? `Ch ${id}`)
                          .join(' / ')}
                        ）
                      </span>
                    </>
                  )}
                </div>
                {currentQ.msImageUrls?.map((url, msIdx) => (
                  <ClippedQuestionImage
                    key={url}
                    imageUrl={url}
                    alt={`${currentQ.paperCode} Q${currentQ.questionNumber} Mark Scheme ${msIdx + 1}`}
                    caption={
                      currentQ.msImageUrls!.length > 1
                        ? `Official Mark Scheme 原卷评分标准截图（${msIdx + 1}/${currentQ.msImageUrls!.length}）`
                        : 'Official Mark Scheme 原卷评分标准截图'
                    }
                  />
                ))}
                {currentQ.msImageId && (
                  <ClippedQuestionImage
                    imageId={currentQ.msImageId}
                    alt={`${currentQ.paperCode} Mark Scheme`}
                    caption="Official Mark Scheme 原卷评分标准截图"
                  />
                )}
                {currentQ.modelAnswer && (
                  <p className="mt-2 text-xs font-medium text-[#F8F7F4]/90">
                    Model Answer: <ChemText text={currentQ.modelAnswer} />
                  </p>
                )}
                <p className="mt-2 text-xs leading-relaxed text-[#F8F7F4]/75">
                  Examiner Note: <ChemText text={currentQ.explanationEn} />
                </p>
                {showChinese && currentQ.explanationZh && (
                  <p className="mt-1.5 rounded-lg border border-white/10 bg-[#141416] px-3 py-2 text-xs leading-relaxed text-[#F8F7F4]/80">
                    中文精析：<ChemText text={currentQ.explanationZh} />
                  </p>
                )}
              </div>
            )}

          <div className="mt-8 flex items-center justify-between border-t border-white/[0.06] pt-4">
            <button
              onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
              disabled={currentIndex === 0}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/12 bg-[#141416] px-3.5 py-2 text-xs font-medium text-[#F8F7F4]/80 hover:border-white/30 disabled:opacity-35"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              上一题
            </button>

            <button
              onClick={() =>
                currentIndex < questions.length - 1
                  ? setCurrentIndex((i) => i + 1)
                  : session.mode === 'mock'
                    ? handleSubmitMock()
                    : onExit()
              }
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#E0A458] px-4 py-2 text-xs font-semibold text-[#111113] hover:bg-[#EBB66E]"
            >
              {currentIndex < questions.length - 1
                ? '下一题'
                : session.mode === 'mock'
                  ? '完成并交卷'
                  : '完成本组练习'}
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        <aside className="rounded-xl border border-white/10 bg-[#18181A] p-5 lg:col-span-3">
          <div className="font-mono text-xs font-semibold uppercase tracking-[0.12em] text-[#F8F7F4]/75">
            答题进度导航
          </div>
          <div className="mt-3 grid grid-cols-5 gap-2">
            {questions.map((q, idx) => {
              const ans = answers[q.id];
              const isCurrent = idx === currentIndex;
              const isFlagged = flagged[q.id];
              const hasAnswer = Boolean(
                ans?.selectedOption ||
                  ans?.writtenText?.trim() ||
                  ans?.msRevealed ||
                  ans?.submittedInPractice
              );

              let cellStyle = 'border-white/12 bg-[#141416] text-[#F8F7F4]/75';
              if (session.mode === 'practice' && ans?.submittedInPractice) {
                cellStyle = ans.isCorrect
                  ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300'
                  : 'border-red-500/40 bg-red-500/15 text-red-300';
              } else if (hasAnswer) {
                cellStyle = 'border-[#E0A458]/40 bg-[#E0A458]/15 text-[#E0A458]';
              }
              if (isCurrent) {
                cellStyle += ' ring-2 ring-[#E0A458] ring-offset-2 ring-offset-[#18181A]';
              }

              return (
                <button
                  key={q.id}
                  onClick={() => setCurrentIndex(idx)}
                  className={`relative flex h-9 items-center justify-center rounded-lg border font-mono text-xs font-semibold tabular-nums transition-colors ${cellStyle}`}
                >
                  {idx + 1}
                  {isFlagged && (
                    <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-[#E0A458]" />
                  )}
                </button>
              );
            })}
          </div>
          <div className="mt-4 space-y-1.5 border-t border-white/[0.06] pt-3 text-xs text-[#F8F7F4]/55">
            <div className="font-mono tabular-nums">
              共 {questions.length} 题 · 总分 {questions.reduce((a, b) => a + b.marks, 0)} 分
            </div>
            <div>涉及 2 个以上章节的题目已标注所属 Module</div>
          </div>
        </aside>
      </div>
    </div>
  );
}
