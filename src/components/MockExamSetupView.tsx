import React, { useState } from 'react';
import { Award, Clock, FileCheck2, Play } from 'lucide-react';
import type { ChemLevel, MockExamResult, Question } from '../types/chemistry.ts';
import { getChapterById } from '../data/syllabus.ts';

interface MockExamSetupViewProps {
  questions: Question[];
  mockHistory: MockExamResult[];
  onStartMock: (config: {
    title: string;
    paperModeLabel: MockExamResult['paperMode'];
    questions: Question[];
    durationSeconds: number;
  }) => void;
}

export function MockExamSetupView({
  questions,
  mockHistory,
  onStartMock,
}: MockExamSetupViewProps) {
  const [selectedMode, setSelectedMode] = useState<
    'Paper 1 (MCQ)' | 'Paper 2/4 (Structured)' | 'Full Diagnostic Mock'
  >('Full Diagnostic Mock');
  const [levelScope, setLevelScope] = useState<ChemLevel | 'ALL'>('ALL');
  const [yearMin, setYearMin] = useState<number>(2021);
  const [questionLimit, setQuestionLimit] = useState<number>(12);

  const eligibleQuestions = questions.filter((q) => {
    if (q.year < yearMin) return false;
    if (selectedMode === 'Paper 1 (MCQ)' && q.type !== 'mcq') return false;
    if (selectedMode === 'Paper 2/4 (Structured)' && q.type !== 'structured') return false;
    if (levelScope === 'AS' && q.chapters.some((c) => c > 18)) return false;
    if (levelScope === 'A2' && q.chapters.every((c) => c <= 18)) return false;
    return true;
  });

  function launchMock() {
    const pool = [...eligibleQuestions];
    // Deterministic-friendly shuffle for varied mock papers
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    const chosen = pool.slice(0, Math.min(questionLimit, pool.length));
    if (chosen.length === 0) return;

    const totalMarks = chosen.reduce((acc, q) => acc + q.marks, 0);
    // Authentic CAIE pacing: ~1.5 min per mark for structured, ~1.9 min per MCQ
    const durationSeconds = Math.max(
      600,
      chosen.reduce((acc, q) => acc + (q.type === 'mcq' ? 110 : q.marks * 95), 0)
    );

    onStartMock({
      title: `${selectedMode} · ${levelScope === 'ALL' ? 'AS+A2' : levelScope} (${yearMin}–2026)`,
      paperModeLabel: selectedMode,
      questions: chosen,
      durationSeconds,
    });
    void totalMarks;
  }

  return (
    <div className="space-y-8">
      <div className="border-b border-slate-200 pb-5">
        <p className="text-xs font-medium tracking-wide text-slate-500">
          TIMED ASSESSMENT &amp; CAIE GRADE THRESHOLD ESTIMATOR
        </p>
        <h1 className="mt-1.5 text-2xl font-semibold tracking-tight text-slate-900">
          模拟考测评与成绩等级评估
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          选择试卷模式与年份范围进行全真限时测评，交卷后自动判定错题并计入错题频率统计，同时估算 CAIE 9701 等级（A*–U）。
        </p>
      </div>

      {/* Mode Selection + Configuration */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-3 lg:col-span-2">
          <div className="text-xs font-semibold text-slate-700">1. 选择模拟考卷类型</div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {(
              [
                {
                  id: 'Full Diagnostic Mock',
                  title: '全纲诊断模拟考',
                  sub: 'MCQ + 简答综合 · 覆盖单章与跨章模块',
                },
                {
                  id: 'Paper 1 (MCQ)',
                  title: 'Paper 1 选择题模考',
                  sub: '客观题自动阅卷 · 考察概念与快速计算',
                },
                {
                  id: 'Paper 2/4 (Structured)',
                  title: 'Paper 2/4 简答测评',
                  sub: '机理、合成路线与计算 · 支持 AI 按 MS 批改',
                },
              ] as const
            ).map((mode) => {
              const active = selectedMode === mode.id;
              return (
                <button
                  key={mode.id}
                  onClick={() => setSelectedMode(mode.id)}
                  className={`flex flex-col justify-between rounded-xl border p-4 text-left transition-colors ${
                    active
                      ? 'border-[#1D4ED8] bg-blue-50/40'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <div>
                    <div className="font-mono text-xs font-semibold text-[#1D4ED8]">
                      {mode.id}
                    </div>
                    <div className="mt-1 text-sm font-semibold text-slate-900">
                      {mode.title}
                    </div>
                    <p className="mt-1.5 text-xs leading-relaxed text-slate-600">
                      {mode.sub}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Scope & Question Count Controls */}
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="text-xs font-semibold text-slate-700">2. 考纲范围与题量设置</div>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <label className="block text-xs font-medium text-slate-600">考纲层级</label>
                <select
                  value={levelScope}
                  onChange={(e) => setLevelScope(e.target.value as ChemLevel | 'ALL')}
                  className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900"
                >
                  <option value="ALL">AS + A2 全纲 (Ch 1–30)</option>
                  <option value="AS">仅 AS Level (Ch 1–18)</option>
                  <option value="A2">仅 A2 Level (Ch 19–30)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600">真题起始年份</label>
                <select
                  value={yearMin}
                  onChange={(e) => setYearMin(Number(e.target.value))}
                  className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900"
                >
                  <option value={2021}>2021–2026 全部年份</option>
                  <option value={2023}>2023–2026 近四年</option>
                  <option value={2025}>2025–2026 最新真题</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600">
                  抽题数量 (可选上限 {eligibleQuestions.length} 题)
                </label>
                <select
                  value={questionLimit}
                  onChange={(e) => setQuestionLimit(Number(e.target.value))}
                  className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900"
                >
                  <option value={8}>8 题 · 快速测验</option>
                  <option value={12}>12 题 · 标准诊断</option>
                  <option value={20}>20 题 · 深度模考</option>
                  <option value={40}>40 题 · 完整大考</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Summary & Launch Box */}
        <div className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-6">
          <div>
            <div className="text-xs font-medium text-slate-500">本次组卷预览</div>
            <h2 className="mt-1 text-lg font-semibold text-slate-900">{selectedMode}</h2>
            <dl className="mt-4 space-y-2.5 border-t border-slate-100 pt-4 text-sm">
              <div className="flex justify-between">
                <dt className="text-slate-500">符合条件真题池</dt>
                <dd className="font-mono font-semibold text-slate-900 tabular-nums">
                  {eligibleQuestions.length} 题
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">实际抽取题数</dt>
                <dd className="font-mono font-semibold text-slate-900 tabular-nums">
                  {Math.min(questionLimit, eligibleQuestions.length)} 题
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">计时规则</dt>
                <dd className="font-mono text-slate-700 tabular-nums">按 CAIE 分值倒计时</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">交卷自动处理</dt>
                <dd className="text-right text-slate-700">统计错题频率 + 等级评定</dd>
              </div>
            </dl>
          </div>

          <button
            onClick={launchMock}
            disabled={eligibleQuestions.length === 0}
            className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#1D4ED8] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#1E40AF] disabled:opacity-40 whitespace-nowrap shrink-0"
          >
            <Play className="h-4 w-4" />
            开始限时模拟考
          </button>
        </div>
      </div>

      {/* Mock History Table */}
      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2">
            <Award className="h-4 w-4 text-slate-500" />
            <h2 className="text-base font-semibold text-slate-900">
              历史模拟考测评记录 ({mockHistory.length})
            </h2>
          </div>
        </div>

        {mockHistory.length === 0 ? (
          <div className="py-10 text-center text-sm text-slate-500">
            尚未完成过模拟考测评。点击上方「开始限时模拟考」生成您的第一份成绩与等级报告。
          </div>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs font-medium text-slate-500">
                  <th className="py-2.5 pr-4">测评名称</th>
                  <th className="py-2.5 pr-4">完成时间</th>
                  <th className="py-2.5 pr-4 text-right">用时</th>
                  <th className="py-2.5 pr-4 text-right">得分 / 正确率</th>
                  <th className="py-2.5 pr-4 text-center">CAIE 预估等级</th>
                  <th className="py-2.5">本次主要失分章节</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {mockHistory.map((m) => {
                  const weakChs = m.chapterBreakdown
                    .filter((b) => b.wrong > 0)
                    .sort((a, b) => b.wrong - a.wrong)
                    .slice(0, 3)
                    .map((b) => getChapterById(b.chapterId)?.code ?? `Ch ${b.chapterId}`);
                  const mins = Math.floor(m.durationSeconds / 60);
                  const secs = m.durationSeconds % 60;

                  return (
                    <tr key={m.id} className="hover:bg-slate-50/70">
                      <td className="py-3 pr-4 font-medium text-slate-900">
                        <div className="flex items-center gap-2">
                          <FileCheck2 className="h-4 w-4 text-slate-400 shrink-0" />
                          <span>{m.title}</span>
                        </div>
                      </td>
                      <td className="py-3 pr-4 font-mono text-xs text-slate-500 tabular-nums">
                        {new Date(m.completedAt).toLocaleString('zh-CN', {
                          month: '2-digit',
                          day: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td className="py-3 pr-4 text-right font-mono text-xs text-slate-600 tabular-nums">
                        <span className="inline-flex items-center gap-1">
                          <Clock className="h-3 w-3 text-slate-400" />
                          {mins}m {secs}s
                        </span>
                      </td>
                      <td className="py-3 pr-4 text-right font-mono text-xs font-semibold text-slate-900 tabular-nums">
                        {m.earnedMarks}/{m.totalMarks} ({m.percentage}%)
                      </td>
                      <td className="py-3 pr-4 text-center font-mono text-sm font-bold text-[#1D4ED8]">
                        {m.estimatedGrade}
                      </td>
                      <td className="py-3 font-mono text-xs text-slate-600">
                        {weakChs.length > 0 ? weakChs.join(' · ') : '全对无失分'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
