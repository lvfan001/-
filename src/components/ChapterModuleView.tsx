import React, { useState } from 'react';
import { ArrowRight, Filter, Play, RotateCw } from 'lucide-react';
import type {
  ChapterErrorSummary,
  ChemBranch,
  ChemLevel,
  Question,
  QuestionStat,
} from '../types/chemistry.ts';
import {
  DEFAULT_CHAPTER_FILTER,
  filterChapterQuestions,
  type ChapterPracticeFilter,
  type ChapterResumeMap,
} from '../utils/studyTools.ts';

interface ChapterModuleViewProps {
  questions: Question[];
  statsMap: Record<string, QuestionStat>;
  chapterSummaries: ChapterErrorSummary[];
  chapterResumeMap: ChapterResumeMap;
  onStartChapterQuiz: (
    chapterId: number,
    options?: { filter?: ChapterPracticeFilter; resume?: boolean }
  ) => void;
  onGoToMockExam: () => void;
}

export function ChapterModuleView({
  questions,
  statsMap,
  chapterSummaries,
  chapterResumeMap,
  onStartChapterQuiz,
  onGoToMockExam,
}: ChapterModuleViewProps) {
  const [levelFilter, setLevelFilter] = useState<ChemLevel | 'ALL'>('ALL');
  const [branchFilter, setBranchFilter] = useState<ChemBranch | 'ALL'>('ALL');
  const [practiceFilter, setPracticeFilter] = useState<ChapterPracticeFilter>(
    DEFAULT_CHAPTER_FILTER
  );

  const isDefaultFilter =
    practiceFilter.status === 'all' &&
    practiceFilter.difficulty === 'all' &&
    practiceFilter.qType === 'all' &&
    practiceFilter.limit === 0;

  const filteredChapters = chapterSummaries.filter((item) => {
    if (levelFilter !== 'ALL' && item.chapter.level !== levelFilter) return false;
    if (branchFilter !== 'ALL' && item.chapter.branch !== branchFilter) return false;
    return true;
  });

  const getSingleChapterStats = (chapterId: number) => {
    const list = questions.filter((q) => q.chapters.length === 1 && q.chapters[0] === chapterId);
    let core = 0;
    let standard = 0;
    let challenging = 0;
    let attempted = 0;
    for (const q of list) {
      if (q.difficulty === 'Core') core++;
      else if (q.difficulty === 'Challenging') challenging++;
      else standard++;
      if ((statsMap[q.id]?.attempts ?? 0) > 0) attempted++;
    }
    const matched = filterChapterQuestions(questions, chapterId, practiceFilter, statsMap);
    return {
      total: list.length,
      core,
      standard,
      challenging,
      attempted,
      matchedCount: matched.length,
    };
  };

  const crossChapterTotal = questions.filter((q) => q.chapters.length >= 2).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 border-b border-white/10 pb-5 sm:flex-row sm:items-end">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-[#F8F7F4]/50">
            MODULE 02 · 30 CHAPTERS BASIC PRACTICE (2018–2026 · CH 01–30)
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-[#F8F7F4]">
            30 章节基础练习
          </h1>
          <p className="mt-1.5 max-w-3xl text-sm text-[#F8F7F4]/65">
            严格依据 CAIE 9701 考纲顺序划分：每章仅收录单章可解真题（含 2018–2026 历年扩充，无超前考点），自动按「基础前置 → 标准真题 → 拔高后置」排题，并支持断点续做与微组卷筛选；跨章节综合题（共 {crossChapterTotal} 题）归入「模拟考与跨章练习」。
          </p>
        </div>

        <button
          onClick={onGoToMockExam}
          className="inline-flex items-center gap-1.5 rounded-lg border border-[#E0A458]/40 bg-[#E0A458]/10 px-3.5 py-2 text-xs font-medium text-[#E0A458] transition-colors hover:bg-[#E0A458] hover:text-[#111113] whitespace-nowrap shrink-0"
        >
          跨章综合题去模拟考 ({crossChapterTotal} 题)
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Practice Filter & Micro-Set Bar */}
      <section className="rounded-xl border border-white/10 bg-[#18181A] p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-[#F8F7F4]/85">
            <Filter className="h-3.5 w-3.5 text-[#E0A458]" />
            刷题筛选与碎片快刷模式
          </div>
          {!isDefaultFilter && (
            <button
              type="button"
              onClick={() => setPracticeFilter(DEFAULT_CHAPTER_FILTER)}
              className="font-mono text-[11px] text-[#E0A458] hover:underline"
            >
              重置筛选条件
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          <div>
            <label className="block font-mono text-[10px] uppercase text-[#F8F7F4]/45">
              作答状态
            </label>
            <select
              value={practiceFilter.status}
              onChange={(e) =>
                setPracticeFilter((prev) => ({
                  ...prev,
                  status: e.target.value as ChapterPracticeFilter['status'],
                }))
              }
              className="mt-1 w-full rounded-lg border border-white/12 bg-[#111113] px-2.5 py-1.5 text-xs text-[#F8F7F4] focus:border-[#E0A458] focus:outline-none"
            >
              <option value="all">全部题目</option>
              <option value="unattempted">只刷未做题</option>
              <option value="mistakes">只刷待清零错题</option>
            </select>
          </div>

          <div>
            <label className="block font-mono text-[10px] uppercase text-[#F8F7F4]/45">
              难易梯次
            </label>
            <select
              value={practiceFilter.difficulty}
              onChange={(e) =>
                setPracticeFilter((prev) => ({
                  ...prev,
                  difficulty: e.target.value as ChapterPracticeFilter['difficulty'],
                }))
              }
              className="mt-1 w-full rounded-lg border border-white/12 bg-[#111113] px-2.5 py-1.5 text-xs text-[#F8F7F4] focus:border-[#E0A458] focus:outline-none"
            >
              <option value="all">全梯次（前置→后置）</option>
              <option value="Core">仅基础前置 (Core)</option>
              <option value="Standard">仅标准真题</option>
              <option value="Challenging">仅拔高后置 (Challenging)</option>
            </select>
          </div>

          <div>
            <label className="block font-mono text-[10px] uppercase text-[#F8F7F4]/45">
              题型
            </label>
            <select
              value={practiceFilter.qType}
              onChange={(e) =>
                setPracticeFilter((prev) => ({
                  ...prev,
                  qType: e.target.value as ChapterPracticeFilter['qType'],
                }))
              }
              className="mt-1 w-full rounded-lg border border-white/12 bg-[#111113] px-2.5 py-1.5 text-xs text-[#F8F7F4] focus:border-[#E0A458] focus:outline-none"
            >
              <option value="all">选择 + 简答小问</option>
              <option value="mcq">仅选择题 (P1)</option>
              <option value="structured">仅简答小问 (P2/P4)</option>
            </select>
          </div>

          <div>
            <label className="block font-mono text-[10px] uppercase text-[#F8F7F4]/45">
              单次题量
            </label>
            <select
              value={practiceFilter.limit}
              onChange={(e) =>
                setPracticeFilter((prev) => ({
                  ...prev,
                  limit: Number(e.target.value) as 0 | 10 | 15,
                }))
              }
              className="mt-1 w-full rounded-lg border border-white/12 bg-[#111113] px-2.5 py-1.5 text-xs text-[#F8F7F4] focus:border-[#E0A458] focus:outline-none"
            >
              <option value={0}>整章全部</option>
              <option value={10}>碎片快刷 10 题</option>
              <option value={15}>课后强化 15 题</option>
            </select>
          </div>
        </div>
      </section>

      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1 rounded-lg border border-white/10 bg-[#18181A] p-1">
            {(['ALL', 'AS', 'A2'] as const).map((lvl) => (
              <button
                key={lvl}
                onClick={() => setLevelFilter(lvl)}
                className={`rounded-md px-3 py-1 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  levelFilter === lvl
                    ? 'bg-[#27272B] text-[#F8F7F4]'
                    : 'text-[#F8F7F4]/55 hover:text-[#F8F7F4]'
                }`}
              >
                {lvl === 'ALL' ? '全部 (Ch 1–30)' : lvl === 'AS' ? 'AS (Ch 1–18)' : 'A2 (Ch 19–30)'}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-1 rounded-lg border border-white/10 bg-[#18181A] p-1">
            {(['ALL', 'Physical', 'Inorganic', 'Organic', 'Analytical'] as const).map((br) => (
              <button
                key={br}
                onClick={() => setBranchFilter(br)}
                className={`rounded-md px-3 py-1 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  branchFilter === br
                    ? 'bg-[#27272B] text-[#F8F7F4]'
                    : 'text-[#F8F7F4]/55 hover:text-[#F8F7F4]'
                }`}
              >
                {br === 'ALL'
                  ? '全部分支'
                  : br === 'Physical'
                    ? '物理化学'
                    : br === 'Inorganic'
                      ? '无机化学'
                      : br === 'Organic'
                        ? '有机化学'
                        : '波谱分析'}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {filteredChapters.map((item) => {
            const ch = item.chapter;
            const stats = getSingleChapterStats(ch.id);
            const pct = Math.round(item.errorRate * 100);
            const resumeEntry = chapterResumeMap[ch.id];
            const canResume =
              isDefaultFilter &&
              Boolean(resumeEntry) &&
              resumeEntry.lastIndex > 0 &&
              resumeEntry.lastIndex < stats.total;

            return (
              <div
                key={ch.id}
                className="flex flex-col justify-between rounded-xl border border-white/10 bg-[#18181A] p-5 transition-colors hover:border-white/20"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 text-xs text-[#F8F7F4]/50">
                    <span className="font-mono font-semibold text-[#E0A458] tabular-nums">
                      {ch.code} · {ch.level} · {ch.branch}
                    </span>
                    <span className="font-mono tabular-nums">
                      {item.attempts > 0
                        ? `错误率 ${pct}% (${item.wrongCount}/${item.attempts})`
                        : '尚未作答'}
                    </span>
                  </div>
                  <h3 className="mt-1.5 text-base font-semibold text-[#F8F7F4]">
                    {ch.titleEn}
                  </h3>
                  <p className="mt-2.5 text-xs leading-relaxed text-[#F8F7F4]/65">
                    核心考点：{ch.keyTopics.join(' · ')}
                  </p>
                </div>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.06] pt-3.5">
                  <div className="space-y-0.5">
                    <div className="font-mono text-xs text-[#F8F7F4]/75 tabular-nums">
                      {isDefaultFilter
                        ? `基础单章 ${stats.total} 题 · 已练 ${stats.attempted}/${stats.total}`
                        : `符合筛选 ${stats.matchedCount} 题（共 ${stats.total} 题）`}
                    </div>
                    <div className="font-mono text-[11px] text-[#F8F7F4]/45 tabular-nums">
                      前置基础 {stats.core} · 标准 {stats.standard} · 拔高后置 {stats.challenging}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {canResume && (
                      <button
                        type="button"
                        onClick={() => onStartChapterQuiz(ch.id, { resume: true })}
                        className="inline-flex items-center gap-1 rounded-lg border border-[#E0A458]/45 bg-[#E0A458]/12 px-3 py-1.5 text-xs font-semibold text-[#E0A458] transition-colors hover:bg-[#E0A458] hover:text-[#111113] whitespace-nowrap shrink-0"
                      >
                        <RotateCw className="h-3.5 w-3.5" />
                        续做第 {resumeEntry.lastIndex + 1} 题
                      </button>
                    )}
                    <button
                      onClick={() =>
                        onStartChapterQuiz(ch.id, {
                          filter: isDefaultFilter ? undefined : practiceFilter,
                          resume: false,
                        })
                      }
                      disabled={stats.matchedCount === 0}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-white/12 bg-[#141416] px-3.5 py-1.5 text-xs font-medium text-[#F8F7F4] transition-colors hover:border-[#E0A458] hover:bg-[#E0A458] hover:text-[#111113] disabled:opacity-35 whitespace-nowrap shrink-0"
                    >
                      <Play className="h-3.5 w-3.5" />
                      {isDefaultFilter ? '开始阶梯练习' : `刷这 ${stats.matchedCount} 题`}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
