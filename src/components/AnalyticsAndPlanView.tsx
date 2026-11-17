import React, { useState } from 'react';
import {
  AlertTriangle,
  Calendar,
  CheckSquare,
  Flame,
  Loader2,
  Play,
  Sparkles,
  Square,
} from 'lucide-react';
import type {
  ChapterErrorSummary,
  ModuleErrorSummary,
  Question,
  QuestionStat,
  RevisionPlan,
  RevisionTask,
} from '../types/chemistry.ts';
import { getChapterById, getModuleById } from '../data/syllabus.ts';
import { getHighFrequencyMistakeQuestions } from '../utils/analytics.ts';
import { ChemText } from './ChemVisuals.tsx';

interface AnalyticsAndPlanViewProps {
  questions: Question[];
  statsMap: Record<string, QuestionStat>;
  chapterSummaries: ChapterErrorSummary[];
  moduleSummaries: ModuleErrorSummary[];
  revisionPlan: RevisionPlan | null;
  targetExamDate: string;
  onChangeTargetDate: (date: string) => void;
  onPlanGenerated: (plan: RevisionPlan) => void;
  onToggleTask: (taskId: string) => void;
  onStartMistakesQuiz: () => void;
  onStartTaskQuiz: (task: RevisionTask) => void;
}

export function AnalyticsAndPlanView({
  questions,
  statsMap,
  chapterSummaries,
  moduleSummaries,
  revisionPlan,
  targetExamDate,
  onChangeTargetDate,
  onPlanGenerated,
  onToggleTask,
  onStartMistakesQuiz,
  onStartTaskQuiz,
}: AnalyticsAndPlanViewProps) {
  const [dailyMinutes, setDailyMinutes] = useState(45);
  const [planDays, setPlanDays] = useState(7);
  const [generating, setGenerating] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const mistakes = getHighFrequencyMistakeQuestions(questions, statsMap);
  const attemptedChapters = chapterSummaries
    .filter((c) => c.attempts > 0)
    .sort((a, b) => b.errorRate - a.errorRate || b.wrongCount - a.wrongCount);

  async function handleGeneratePlan() {
    setGenerating(true);
    setErrorMsg(null);
    try {
      const resp = await fetch('/api/plan/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetExamDate,
          dailyMinutes,
          planDays,
          chapterStats: chapterSummaries,
          moduleStats: moduleSummaries,
          wrongQuestionIds: mistakes.map((m) => m.question.id),
        }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        setErrorMsg(data.error || '生成复习计划失败，请重试。');
        return;
      }
      onPlanGenerated(data as RevisionPlan);
    } catch (err) {
      setErrorMsg(`网络异常：${err instanceof Error ? err.message : '未知错误'}`);
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col justify-between gap-4 border-b border-white/10 pb-5 sm:flex-row sm:items-end">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-[#F8F7F4]/50">
            MODULE 05 · ERROR FREQUENCY ANALYTICS &amp; ADAPTIVE REVISION PLANNER
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-[#F8F7F4]">
            错题频率统计与针对性复习计划
          </h1>
          <p className="mt-1.5 text-sm text-[#F8F7F4]/65">
            每次练习或模考后自动累计单章（Ch 1–30）与跨章模块错题频率，一键生成每日靶向复习日程。
          </p>
        </div>

        {mistakes.length > 0 && (
          <button
            onClick={onStartMistakesQuiz}
            className="inline-flex items-center gap-2 rounded-lg bg-red-600/90 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-600 whitespace-nowrap shrink-0"
          >
            <Flame className="h-4 w-4" />
            重做全部高频错题 ({mistakes.length} 题)
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-white/10 bg-[#18181A] p-6">
          <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
            <h2 className="text-base font-semibold text-[#F8F7F4]">
              30 章节错题频率排行
            </h2>
            <span className="font-mono text-xs text-[#F8F7F4]/50 tabular-nums">
              已记录 {attemptedChapters.length} / 30 章
            </span>
          </div>

          {attemptedChapters.length === 0 ? (
            <div className="py-10 text-center text-sm text-[#F8F7F4]/45">
              暂无作答统计数据。完成任意章节练习或模拟考后，此处将自动展示各章节错误率与失误次数排行。
            </div>
          ) : (
            <div className="mt-4 space-y-3.5">
              {attemptedChapters.slice(0, 10).map((item) => {
                const pct = Math.round(item.errorRate * 100);
                const statusText =
                  pct >= 50 ? '高频错题' : pct >= 20 ? '待巩固' : '掌握良好';
                const barColor =
                  pct >= 50
                    ? 'bg-red-500'
                    : pct >= 20
                      ? 'bg-[#E0A458]'
                      : 'bg-emerald-500';
                const textColor =
                  pct >= 50
                    ? 'text-red-300'
                    : pct >= 20
                      ? 'text-[#E0A458]'
                      : 'text-emerald-300';

                return (
                  <div key={item.chapter.id} className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="truncate font-medium text-[#F8F7F4]/85">
                        <span className="font-mono font-semibold text-[#F8F7F4]">
                          {item.chapter.code}
                        </span>{' '}
                        {item.chapter.titleZh}
                      </span>
                      <span className={`shrink-0 font-mono font-medium tabular-nums ${textColor}`}>
                        {statusText} · {pct}% ({item.wrongCount}/{item.attempts})
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
                      <div
                        className={`h-full rounded-full ${barColor}`}
                        style={{ width: `${Math.max(4, pct)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="rounded-xl border border-white/10 bg-[#18181A] p-6">
          <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
            <h2 className="text-base font-semibold text-[#F8F7F4]">
              跨章节模块错误率对比 (≥2 章节)
            </h2>
            <span className="font-mono text-xs text-[#F8F7F4]/50">Modules 01–06</span>
          </div>

          <div className="mt-4 divide-y divide-white/[0.06]">
            {moduleSummaries.map((m) => {
              const pct = Math.round(m.errorRate * 100);
              return (
                <div
                  key={m.module.id}
                  className="flex items-center justify-between gap-4 py-3 text-sm"
                >
                  <div className="min-w-0">
                    <div className="truncate font-medium text-[#F8F7F4]">
                      <span className="font-mono text-xs text-[#E0A458]">{m.module.code}</span>{' '}
                      {m.module.titleZh}
                    </div>
                    <div className="mt-0.5 text-xs text-[#F8F7F4]/50">
                      收录 {m.questionCount} 道跨章真题
                    </div>
                  </div>
                  <div className="shrink-0 text-right font-mono text-xs tabular-nums">
                    {m.attempts > 0 ? (
                      <span
                        className={
                          pct >= 50
                            ? 'font-semibold text-red-300'
                            : pct >= 20
                              ? 'font-semibold text-[#E0A458]'
                              : 'font-semibold text-emerald-300'
                        }
                      >
                        错率 {pct}% ({m.wrongCount}/{m.attempts})
                      </span>
                    ) : (
                      <span className="text-[#F8F7F4]/40">未测评</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      <section className="rounded-xl border border-white/10 bg-[#18181A] p-6">
        <div className="flex flex-col justify-between gap-4 border-b border-white/[0.06] pb-5 lg:flex-row lg:items-end">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-semibold text-[#F8F7F4]">
              <Sparkles className="h-4 w-4 text-[#E0A458]" />
              针对性复习计划生成器
            </h2>
            <p className="mt-1 text-xs text-[#F8F7F4]/55">
              基于当前 30 章节错题频率权重自动编排每日任务，支持一键直达对应真题训练。
            </p>
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="block text-xs font-medium text-[#F8F7F4]/65">目标考试日期</label>
              <div className="relative mt-1">
                <Calendar className="pointer-events-none absolute left-2.5 top-2 h-3.5 w-3.5 text-[#F8F7F4]/45" />
                <input
                  type="date"
                  value={targetExamDate}
                  onChange={(e) => onChangeTargetDate(e.target.value)}
                  className="rounded-lg border border-white/12 bg-[#111113] py-1.5 pl-8 pr-2.5 font-mono text-xs text-[#F8F7F4] focus:border-[#E0A458] focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-[#F8F7F4]/65">每日学习时长</label>
              <select
                value={dailyMinutes}
                onChange={(e) => setDailyMinutes(Number(e.target.value))}
                className="mt-1 rounded-lg border border-white/12 bg-[#111113] px-2.5 py-1.5 text-xs text-[#F8F7F4] focus:border-[#E0A458] focus:outline-none"
              >
                <option value={30}>30 分钟/天</option>
                <option value={45}>45 分钟/天</option>
                <option value={60}>60 分钟/天</option>
                <option value={90}>90 分钟/天</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-[#F8F7F4]/65">计划周期</label>
              <select
                value={planDays}
                onChange={(e) => setPlanDays(Number(e.target.value))}
                className="mt-1 rounded-lg border border-white/12 bg-[#111113] px-2.5 py-1.5 text-xs text-[#F8F7F4] focus:border-[#E0A458] focus:outline-none"
              >
                <option value={7}>7 天冲刺计划</option>
                <option value={14}>14 天强化计划</option>
              </select>
            </div>

            <button
              onClick={handleGeneratePlan}
              disabled={generating}
              className="inline-flex items-center gap-2 rounded-lg bg-[#E0A458] px-4 py-2 text-xs font-semibold text-[#111113] transition-colors hover:bg-[#EBB66E] disabled:opacity-50 whitespace-nowrap shrink-0"
            >
              {generating ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Sparkles className="h-3.5 w-3.5" />
              )}
              生成针对性复习计划
            </button>
          </div>
        </div>

        {errorMsg && (
          <div className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-xs text-red-300">
            {errorMsg}
          </div>
        )}

        {!revisionPlan ? (
          <div className="py-10 text-center text-sm text-[#F8F7F4]/45">
            设定目标考期与每日时长后，点击「生成针对性复习计划」获取为您定制的每日练习日程。
          </div>
        ) : (
          <div className="mt-5 space-y-5">
            <div className="rounded-lg border border-[#E0A458]/30 bg-[#E0A458]/10 p-4 text-sm text-[#F8F7F4]">
              <div className="font-mono text-xs font-semibold text-[#E0A458]">
                诊断策略总览 · {revisionPlan.planDays} 天（{revisionPlan.dailyMinutes} 分钟/天）
              </div>
              <p className="mt-1 leading-relaxed text-[#F8F7F4]/85">{revisionPlan.aiSummaryZh}</p>
            </div>

            <div className="divide-y divide-white/[0.06]">
              {revisionPlan.tasks.map((task) => {
                const mod = task.targetModuleId ? getModuleById(task.targetModuleId) : null;
                return (
                  <div
                    key={task.id}
                    className="flex flex-col justify-between gap-3 py-3.5 sm:flex-row sm:items-center"
                  >
                    <div className="flex items-start gap-3">
                      <button
                        onClick={() => onToggleTask(task.id)}
                        className="mt-0.5 text-[#F8F7F4]/45 hover:text-[#E0A458]"
                        aria-label="切换任务完成状态"
                      >
                        {task.completed ? (
                          <CheckSquare className="h-5 w-5 text-emerald-400" />
                        ) : (
                          <Square className="h-5 w-5" />
                        )}
                      </button>

                      <div>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-[#F8F7F4]/50">
                          <span className="font-mono font-semibold text-[#F8F7F4]/80 tabular-nums">
                            Day {task.dayIndex} ({task.dateLabel})
                          </span>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono tabular-nums">{task.estimatedMinutes} min</span>
                          {mod && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="font-mono text-[#E0A458]">{mod.code}</span>
                            </>
                          )}
                        </div>
                        <div
                          className={`mt-1 text-sm font-semibold ${
                            task.completed ? 'text-[#F8F7F4]/40 line-through' : 'text-[#F8F7F4]'
                          }`}
                        >
                          {task.titleZh}
                        </div>
                        <p className="mt-0.5 text-xs text-[#F8F7F4]/60">{task.reasonZh}</p>
                      </div>
                    </div>

                    <button
                      onClick={() => onStartTaskQuiz(task)}
                      className="inline-flex items-center gap-1.5 self-start rounded-lg border border-white/12 bg-[#141416] px-3 py-1.5 text-xs font-medium text-[#F8F7F4]/85 hover:border-[#E0A458] hover:text-[#E0A458] sm:self-center whitespace-nowrap shrink-0"
                    >
                      <Play className="h-3.5 w-3.5" />
                      去执行练习
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>

      <section className="rounded-xl border border-white/10 bg-[#18181A] p-6">
        <div className="flex items-center gap-2 border-b border-white/[0.06] pb-3">
          <AlertTriangle className="h-4 w-4 text-[#E0A458]" />
          <h2 className="text-base font-semibold text-[#F8F7F4]">
            错题档案明细 ({mistakes.length})
          </h2>
        </div>

        {mistakes.length === 0 ? (
          <div className="py-8 text-center text-sm text-[#F8F7F4]/45">
            目前暂无错题记录，保持良好的正确率！
          </div>
        ) : (
          <div className="mt-4 divide-y divide-white/[0.06]">
            {mistakes.map(({ question, stat }) => {
              const rate = Math.round((stat.wrongCount / Math.max(1, stat.attempts)) * 100);
              return (
                <div key={question.id} className="py-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#F8F7F4]/50">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono font-semibold text-[#F8F7F4]">
                        {question.paperCode} Q{question.questionNumber}
                        {question.subPart ?? ''}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono text-[#E0A458]">
                        {question.chapters
                          .map((id) => getChapterById(id)?.code ?? `Ch ${id}`)
                          .join(' + ')}
                      </span>
                    </div>
                    <span className="font-mono font-semibold text-red-300 tabular-nums">
                      错 {stat.wrongCount} 次 / 共 {stat.attempts} 次 ({rate}%)
                    </span>
                  </div>
                  <p className="mt-1.5 text-sm text-[#F8F7F4]/85">
                    <ChemText text={question.promptZh || question.promptEn} />
                  </p>
                  {stat.wrongHistory[0] && (
                    <p className="mt-1 text-xs text-[#F8F7F4]/55">
                      最近误选/作答：<span className="font-mono text-red-300">{stat.wrongHistory[0].userAnswer}</span>
                      {question.correctOption && (
                        <>
                          {' · '}正确选项：<span className="font-mono font-semibold text-emerald-300">{question.correctOption}</span>
                        </>
                      )}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
