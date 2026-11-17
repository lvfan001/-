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
  onStartModuleQuiz: (moduleId: string) => void;
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
  onStartModuleQuiz,
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
      {/* Hero / Focal Header Row */}
      <div className="flex flex-col justify-between gap-4 border-b border-slate-200 pb-6 lg:flex-row lg:items-end">
        <div>
          <p className="text-xs font-medium tracking-wide text-slate-500">
            CAIE 9701 SYLLABUS · 2021–2026 PAST PAPER WORKBENCH
          </p>
          <h1 className="mt-1.5 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
            A-Level 化学真题精练与错题诊断中心
          </h1>
          <p className="mt-1.5 max-w-2xl text-sm text-slate-600">
            已内置来自 PapaCambridge 的 2021–2026 原卷与官方 Mark Scheme 截图题库，按 30 个考纲章节精准归类，涉及 2 个以上章节的综合真题自动路由至模块练习。
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <button
            onClick={() => onNavigate('papers')}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 whitespace-nowrap shrink-0"
          >
            <DownloadCloud className="h-4 w-4 text-slate-500" />
            下载 2021–2026 真题
          </button>
          <button
            onClick={onStartQuickMock}
            className="inline-flex items-center gap-2 rounded-lg bg-[#1D4ED8] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#1E40AF] whitespace-nowrap shrink-0"
          >
            <Play className="h-4 w-4" />
            开始诊断模拟考
          </button>
        </div>
      </div>

      {/* 4-Column Tabular KPI Strip (Single surface, hairline dividers) */}
      <div className="grid grid-cols-2 divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white sm:grid-cols-4 sm:divide-x sm:divide-y-0">
        <div className="p-5">
          <div className="text-xs font-medium text-slate-500">原卷截图真题库</div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-mono text-2xl font-semibold text-slate-900 tabular-nums">
              {questions.length}
            </span>
            <span className="text-xs text-slate-500 tabular-nums">
              题 · {uniquePaperCount} 套真题{downloadedPaperCount > 0 ? ` (+${downloadedPaperCount} 自导入)` : ''}
            </span>
          </div>
        </div>

        <div className="p-5">
          <div className="text-xs font-medium text-slate-500">累计作答正确率</div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-mono text-2xl font-semibold text-slate-900 tabular-nums">
              {accuracy.accuracyPercent !== null ? `${accuracy.accuracyPercent}%` : '—'}
            </span>
            <span className="text-xs text-slate-500 tabular-nums">
              {accuracy.totalAttempts > 0
                ? `${accuracy.totalAttempts} 次作答`
                : '尚未开始作答'}
            </span>
          </div>
        </div>

        <div className="p-5">
          <div className="text-xs font-medium text-slate-500">待清零高频错题</div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-mono text-2xl font-semibold text-slate-900 tabular-nums">
              {mistakes.length}
            </span>
            <span className="text-xs text-slate-500 tabular-nums">
              道错题 · {accuracy.totalWrong} 次失误
            </span>
          </div>
        </div>

        <div className="p-5">
          <div className="text-xs font-medium text-slate-500">最近模考等级 / 考期</div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-mono text-2xl font-semibold text-slate-900 tabular-nums">
              {latestMock ? latestMock.estimatedGrade : `${daysLeft}d`}
            </span>
            <span className="text-xs text-slate-500 tabular-nums">
              {latestMock
                ? `${latestMock.percentage}% · 距考 ${daysLeft} 天`
                : `距离目标考期 ${daysLeft} 天`}
            </span>
          </div>
        </div>
      </div>

      {/* Three Actionable Pathways (No nested cards, clean hairline borders) */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-6">
          <div>
            <div className="text-xs font-medium text-[#1D4ED8]">
              跨章模块重点 · {asOrganicModule.code}
            </div>
            <h2 className="mt-1.5 text-lg font-semibold text-slate-900">
              {asOrganicModule.titleZh}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              {asOrganicModule.descriptionZh}
            </p>
          </div>
          <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4">
            <span className="font-mono text-xs text-slate-500 tabular-nums">
              Ch 14–18 · {asOrganicQuestionCount} 道跨章综合题
            </span>
            <button
              onClick={() => onStartModuleQuiz('mod-as-organic')}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-[#1D4ED8] hover:text-[#1E40AF] whitespace-nowrap shrink-0"
            >
              进入模块练习
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-6">
          <div>
            <div className="flex items-center gap-1.5 text-xs font-medium text-amber-700">
              <Flame className="h-3.5 w-3.5" />
              自动错题频率追踪
            </div>
            <h2 className="mt-1.5 text-lg font-semibold text-slate-900">
              {mistakes.length > 0 ? '高频错题靶向重练' : '开启错题频率定位'}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
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
          <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4">
            <span className="font-mono text-xs text-slate-500 tabular-nums">
              {mistakes.length > 0
                ? `${mistakes.length} 道错题待巩固`
                : '支持实时统计与重练'}
            </span>
            <button
              onClick={() =>
                mistakes.length > 0 ? onStartMistakesQuiz() : onNavigate('analytics')
              }
              className="inline-flex items-center gap-1.5 text-sm font-medium text-[#1D4ED8] hover:text-[#1E40AF] whitespace-nowrap shrink-0"
            >
              {mistakes.length > 0 ? '立即重练错题' : '查看分析与计划'}
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-6">
          <div>
            <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-700">
              <Target className="h-3.5 w-3.5" />
              模拟考评估 · CAIE 等级预测
            </div>
            <h2 className="mt-1.5 text-lg font-semibold text-slate-900">
              限时模考与分数线评估
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              支持 Paper 1 选择题限时考、Paper 2/4 简答批改与全纲诊断测试，交卷后自动生成 A*–U 等级评定与章节失分分布。
            </p>
          </div>
          <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4">
            <span className="font-mono text-xs text-slate-500 tabular-nums">
              已完成 {mockHistory.length} 次模拟考
            </span>
            <button
              onClick={() => onNavigate('mock')}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-[#1D4ED8] hover:text-[#1E40AF] whitespace-nowrap shrink-0"
            >
              配置模拟考试
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* 30-Chapter Error Frequency Heatmap Matrix */}
      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="flex flex-col justify-between gap-3 border-b border-slate-100 pb-4 sm:flex-row sm:items-center">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
              <BookOpen className="h-4 w-4 text-slate-500" />
              30 章节错题频率与掌握度矩阵
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              点击任意章节卡片直接开始该章节真题练习 · Ch 01–18 为 AS，Ch 19–30 为 A2
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-slate-200" />
              未作答
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-emerald-500" />
              已掌握 (&lt;20% 错)
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-amber-500" />
              待巩固 (20–49% 错)
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-red-600" />
              高频错题 (≥50% 错)
            </span>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-6">
          {chapterSummaries.map((item) => {
            const pct = Math.round(item.errorRate * 100);
            let statusStyle = 'border-slate-200 bg-slate-50/50 hover:border-slate-300';
            let statusLabel = '未练习';
            let statusTextColor = 'text-slate-500';

            if (item.attempts > 0) {
              if (pct >= 50) {
                statusStyle = 'border-red-200 bg-red-50/60 hover:border-red-300';
                statusLabel = `高频 ${pct}%`;
                statusTextColor = 'text-red-700';
              } else if (pct >= 20) {
                statusStyle = 'border-amber-200 bg-amber-50/60 hover:border-amber-300';
                statusLabel = `待巩固 ${pct}%`;
                statusTextColor = 'text-amber-700';
              } else {
                statusStyle = 'border-emerald-200 bg-emerald-50/50 hover:border-emerald-300';
                statusLabel = `良好 ${pct}%`;
                statusTextColor = 'text-emerald-700';
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
                  <span className="font-mono text-xs font-semibold text-slate-700 tabular-nums">
                    {item.chapter.code}
                  </span>
                  <span className="text-[11px] text-slate-400">
                    {item.chapter.level}
                  </span>
                </div>
                <div className="mt-1.5 line-clamp-2 text-xs font-medium text-slate-900 group-hover:text-[#1D4ED8]">
                  {item.chapter.titleZh}
                </div>
                <div className="mt-2 flex items-center justify-between text-[11px] tabular-nums">
                  <span className={`font-medium ${statusTextColor}`}>{statusLabel}</span>
                  <span className="font-mono text-slate-400">单章 {singleCount}题</span>
                </div>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}
