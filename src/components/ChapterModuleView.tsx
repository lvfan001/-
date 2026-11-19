import React, { useState } from 'react';
import { ArrowRight, Play } from 'lucide-react';
import type {
  ChapterErrorSummary,
  ChemBranch,
  ChemLevel,
  Question,
} from '../types/chemistry.ts';

interface ChapterModuleViewProps {
  questions: Question[];
  chapterSummaries: ChapterErrorSummary[];
  onStartChapterQuiz: (chapterId: number) => void;
  onGoToMockExam: () => void;
}

export function ChapterModuleView({
  questions,
  chapterSummaries,
  onStartChapterQuiz,
  onGoToMockExam,
}: ChapterModuleViewProps) {
  const [levelFilter, setLevelFilter] = useState<ChemLevel | 'ALL'>('ALL');
  const [branchFilter, setBranchFilter] = useState<ChemBranch | 'ALL'>('ALL');

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
    for (const q of list) {
      if (q.difficulty === 'Core') core++;
      else if (q.difficulty === 'Challenging') challenging++;
      else standard++;
    }
    return { total: list.length, core, standard, challenging };
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
            严格依据 CAIE 9701 考纲顺序划分：每章仅收录单章可解真题（含 2018–2026 历年扩充，无超前考点），并自动按「基础前置 → 标准真题 → 拔高后置」梯次排题；全部跨章节综合题（共 {crossChapterTotal} 题）已统一移至「模拟考与跨章练习」。
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
                      基础单章 {stats.total} 题 · 无超前考点
                    </div>
                    <div className="font-mono text-[11px] text-[#F8F7F4]/45 tabular-nums">
                      前置基础 {stats.core} · 标准 {stats.standard} · 拔高后置 {stats.challenging}
                    </div>
                  </div>
                  <button
                    onClick={() => onStartChapterQuiz(ch.id)}
                    disabled={stats.total === 0}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-white/12 bg-[#141416] px-3.5 py-1.5 text-xs font-medium text-[#F8F7F4] transition-colors hover:border-[#E0A458] hover:bg-[#E0A458] hover:text-[#111113] disabled:opacity-35 whitespace-nowrap shrink-0"
                  >
                    <Play className="h-3.5 w-3.5" />
                    开始阶梯练习
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
