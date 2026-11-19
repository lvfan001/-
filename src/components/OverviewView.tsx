import React from 'react';
import {
  ArrowRight,
  BookOpen,
  DownloadCloud,
  Flame,
  Play,
  Target,
} from 'lucide-react';
import type {
  AppView,
  ChapterErrorSummary,
  MockExamResult,
  Question,
  QuestionStat,
} from '../types/chemistry.ts';
import { STUDY_MODULES } from '../data/syllabus.ts';
import {
  computeOverallAccuracy,
  getDaysUntilExam,
  getHighFrequencyMistakeQuestions,
} from '../utils/analytics.ts';

interface OverviewViewProps {
  questions: Question[];
  statsMap: Record<string, QuestionStat>;
  chapterSummaries: ChapterErrorSummary[];
  mockHistory: MockExamResult[];
  targetExamDate: string;
  downloadedPaperCount: number;
  onNavigate: (view: AppView) => void;
  onStartChapterQuiz: (chapterId: number) => void;
  onOpenModulesPage: () => void;
  onStartMistakesQuiz: () => void;
  onStartQuickMock: () => void;
}

export function OverviewView({
  questions,
  statsMap,
  chapterSummaries,
  mockHistory,
  targetExamDate,
  downloadedPaperCount,
  onNavigate,
  onStartChapterQuiz,
  onOpenModulesPage,
  onStartMistakesQuiz,
  onStartQuickMock,
}: OverviewViewProps) {
  const accuracy = computeOverallAccuracy(statsMap);
  const mistakes = getHighFrequencyMistakeQuestions(questions, statsMap);
  const daysLeft = getDaysUntilExam(targetExamDate);
  const latestMock = mockHistory[0];
  const uniquePaperCount = new Set(questions.map((q) => q.paperCode)).size;

  const topWeakChapters = [...chapterSummaries]
    .filter((c) => c.attempts > 0 && c.wrongCount > 0)
    .sort((a, b) => b.priorityScore - a.priorityScore)
    .slice(0, 4);

  const asOrganicModule = STUDY_MODULES.find((m) => m.id === 'mod-as-organic')!;
  const asOrganicQuestionCount = questions.filter(
    (q) => q.chapters.length >= 2 && q.moduleId === 'mod-as-organic'
  ).length;

  return (
    <div className="space-y-8">
      <div className="flex flex-col justify-between gap-4 border-b border-white/10 pb-6 lg:flex-row lg:items-end">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-[#F8F7F4]/50">
            CAIE 9701 SYLLABUS · 2018–2026 PAST PAPER WORKBENCH
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-[#F8F7F4] sm:text-3xl">
            A-Level 化学真题精练与错题诊断中心
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-[#F8F7F4]/65">
            已内置来自 PapaCambridge 的 2018–2026 原卷与官方 Mark Scheme 截图题库。30 章节基础练习严格单章隔离并按「基础前置 → 拔高后置」排题，跨章综合与小模考 / 大模考 / 实测套卷统一归入「模拟考与跨章练习」。
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <button
            onClick={() => onNavigate('papers')}
            className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-[#18181A] px-4 py-2.5 text-sm font-medium text-[#F8F7F4]/85 transition-colors hover:border-[#E0A458]/50 hover:text-[#E0A458] whitespace-nowrap shrink-0"
          >
            <DownloadCloud className="h-4 w-4 text-[#F8F7F4]/60" />
            下载 2018–2026 真题
          </button>
          <button
            onClick={onStartQuickMock}
            className="inline-flex items-center gap-2 rounded-lg bg-[#E0A458] px-4 py-2.5 text-sm font-semibold text-[#111113] transition-colors hover:bg-[#EBB66E] whitespace-nowrap shrink-0"
          >
            <Play className="h-4 w-4" />
            开始 AS 小模考
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 divide-y divide-white/10 rounded-xl border border-white/10 bg-[#18181A] sm:grid-cols-4 sm:divide-x sm:divide-y-0">
        <div className="p-5">
          <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-[#F8F7F4]/50">
            原卷截图真题库
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-mono text-2xl font-semibold text-[#F8F7F4] tabular-nums">
              {questions.length}
            </span>
            <span className="text-xs text-[#F8F7F4]/50 tabular-nums">
              题 · {uniquePaperCount} 套真题{downloadedPaperCount > 0 ? ` (+${downloadedPaperCount})` : ''}
            </span>
          </div>
        </div>

        <div className="p-5">
          <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-[#F8F7F4]/50">
            累计作答正确率
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-mono text-2xl font-semibold text-[#F8F7F4] tabular-nums">
              {accuracy.accuracyPercent !== null ? `${accuracy.accuracyPercent}%` : '—'}
            </span>
            <span className="text-xs text-[#F8F7F4]/50 tabular-nums">
              {accuracy.totalAttempts > 0
                ? `${accuracy.totalAttempts} 次作答`
                : '尚未开始作答'}
            </span>
          </div>
        </div>

        <div className="p-5">
          <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-[#F8F7F4]/50">
            待清零高频错题
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-mono text-2xl font-semibold text-[#F8F7F4] tabular-nums">
              {mistakes.length}
            </span>
            <span className="text-xs text-[#F8F7F4]/50 tabular-nums">
              道错题 · {accuracy.totalWrong} 次失误
            </span>
          </div>
        </div>

        <div className="p-5">
          <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-[#F8F7F4]/50">
            最近模考等级 / 考期
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-mono text-2xl font-semibold text-[#E0A458] tabular-nums">
              {latestMock ? latestMock.estimatedGrade : `${daysLeft}d`}
            </span>
            <span className="text-xs text-[#F8F7F4]/50 tabular-nums">
              {latestMock
                ? `${latestMock.percentage}% · 距考 ${daysLeft} 天`
                : `距离目标考期 ${daysLeft} 天`}
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="flex flex-col justify-between rounded-xl border border-white/10 bg-[#18181A] p-6">
          <div>
            <div className="font-mono text-xs font-medium text-[#E0A458]">
              跨章模块重点 · {asOrganicModule.code}
            </div>
            <h2 className="mt-1.5 text-lg font-semibold text-[#F8F7F4]">
              {asOrganicModule.titleZh}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-[#F8F7F4]/65">
              {asOrganicModule.descriptionZh}
            </p>
          </div>
          <div className="mt-5 flex items-center justify-between border-t border-white/[0.06] pt-4">
            <span className="font-mono text-xs text-[#F8F7F4]/50 tabular-nums">
              Ch 14–18 · {asOrganicQuestionCount} 道跨章综合题
            </span>
            <button
              onClick={onOpenModulesPage}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-[#E0A458] transition-colors hover:text-[#EBB66E] whitespace-nowrap shrink-0"
            >
              前往模考跨章模块
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="flex flex-col justify-between rounded-xl border border-white/10 bg-[#18181A] p-6">
          <div>
            <div className="flex items-center gap-1.5 font-mono text-xs font-medium text-[#E0A458]">
              <Flame className="h-3.5 w-3.5" />
              自动错题频率追踪
            </div>
            <h2 className="mt-1.5 text-lg font-semibold text-[#F8F7F4]">
              {mistakes.length > 0 ? '高频错题靶向重练' : '开启错题频率定位'}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-[#F8F7F4]/65">
              {topWeakChapters.length > 0
                ? `当前最需巩固：${topWeakChapters
                    .slice(0, 2)
                    .map(
                      (c) =>
                        `${c.chapter.code} (${Math.round(c.errorRate * 100)}% 错误率)`
                    )
                    .join('、')}。`
                : '完成任意章节练习或模拟考后，系统将自动按 30 个章节统计错题频率并生成针对性复习计划。'}
            </p>
          </div>
          <div className="mt-5 flex items-center justify-between border-t border-white/[0.06] pt-4">
            <span className="font-mono text-xs text-[#F8F7F4]/50 tabular-nums">
              {mistakes.length > 0
                ? `${mistakes.length} 道错题待巩固`
                : '支持实时统计与重练'}
            </span>
            <button
              onClick={() =>
                mistakes.length > 0 ? onStartMistakesQuiz() : onNavigate('analytics')
              }
              className="inline-flex items-center gap-1.5 text-sm font-medium text-[#E0A458] transition-colors hover:text-[#EBB66E] whitespace-nowrap shrink-0"
            >
              {mistakes.length > 0 ? '立即重练错题' : '查看分析与计划'}
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="flex flex-col justify-between rounded-xl border border-white/10 bg-[#18181A] p-6">
          <div>
            <div className="flex items-center gap-1.5 font-mono text-xs font-medium text-emerald-400">
              <Target className="h-3.5 w-3.5" />
              模拟考评估 · CAIE 等级预测
            </div>
            <h2 className="mt-1.5 text-lg font-semibold text-[#F8F7F4]">
              小模考 / 大模考 / 实测随机发卷
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-[#F8F7F4]/65">
              支持 AS 小模考 (10选+15分简答)、AS 大模考 (20选+30分简答)、A2 小/大模考 (25/50分简答小问) 与实测随机真题套卷，交卷自动评定 CAIE A*–U 等级。
            </p>
          </div>
          <div className="mt-5 flex items-center justify-between border-t border-white/[0.06] pt-4">
            <span className="font-mono text-xs text-[#F8F7F4]/50 tabular-nums">
              已完成 {mockHistory.length} 次模拟考
            </span>
            <button
              onClick={() => onNavigate('mock')}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-[#E0A458] transition-colors hover:text-[#EBB66E] whitespace-nowrap shrink-0"
            >
              配置模拟考试
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      <section className="rounded-xl border border-white/10 bg-[#18181A] p-6">
        <div className="flex flex-col justify-between gap-3 border-b border-white/[0.06] pb-4 sm:flex-row sm:items-center">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-semibold text-[#F8F7F4]">
              <BookOpen className="h-4 w-4 text-[#E0A458]" />
              30 章节错题频率与掌握度矩阵
            </h2>
            <p className="mt-0.5 text-xs text-[#F8F7F4]/55">
              点击任意章节卡片直接开始该章节真题练习 · Ch 01–18 为 AS，Ch 19–30 为 A2
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-4 text-xs text-[#F8F7F4]/65">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-white/20" />
              未作答
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-emerald-400" />
              已掌握 (&lt;20% 错)
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-[#E0A458]" />
              待巩固 (20–49% 错)
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-red-500" />
              高频错题 (≥50% 错)
            </span>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-6">
          {chapterSummaries.map((item) => {
            const pct = Math.round(item.errorRate * 100);
            let statusStyle =
              'border-white/10 bg-[#141416] hover:border-white/25';
            let statusLabel = '未练习';
            let statusTextColor = 'text-[#F8F7F4]/45';

            if (item.attempts > 0) {
              if (pct >= 50) {
                statusStyle =
                  'border-red-500/35 bg-red-500/10 hover:border-red-400/60';
                statusLabel = `高频 ${pct}%`;
                statusTextColor = 'text-red-300';
              } else if (pct >= 20) {
                statusStyle =
                  'border-[#E0A458]/35 bg-[#E0A458]/10 hover:border-[#E0A458]/60';
                statusLabel = `待巩固 ${pct}%`;
                statusTextColor = 'text-[#E0A458]';
              } else {
                statusStyle =
                  'border-emerald-500/30 bg-emerald-500/10 hover:border-emerald-400/50';
                statusLabel = `良好 ${pct}%`;
                statusTextColor = 'text-emerald-300';
              }
            }

            const singleCount = questions.filter(
              (q) => q.chapters.length === 1 && q.chapters[0] === item.chapter.id
            ).length;

            return (
              <button
                key={item.chapter.id}
                onClick={() => onStartChapterQuiz(item.chapter.id)}
                className={`group flex flex-col justify-between rounded-lg border p-3 text-left transition-colors ${statusStyle}`}
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="font-mono text-xs font-semibold text-[#F8F7F4]/80 tabular-nums">
                    {item.chapter.code}
                  </span>
                  <span className="font-mono text-[11px] text-[#F8F7F4]/40">
                    {item.chapter.level}
                  </span>
                </div>
                <div className="mt-1.5 line-clamp-2 text-xs font-medium text-[#F8F7F4] group-hover:text-[#E0A458]">
                  {item.chapter.titleEn}
                </div>
                <div className="mt-2 flex items-center justify-between text-[11px] tabular-nums">
                  <span className={`font-medium ${statusTextColor}`}>{statusLabel}</span>
                  <span className="font-mono text-[#F8F7F4]/40">单章 {singleCount}题</span>
                </div>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}
