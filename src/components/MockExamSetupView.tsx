import React, { useEffect, useMemo, useState } from 'react';
import {
  Award,
  Clock,
  FileCheck2,
  Layers,
  Play,
  Shuffle,
} from 'lucide-react';
import type {
  MockExamResult,
  MockPaperMode,
  ModuleErrorSummary,
  Question,
  RealPaperFileRef,
} from '../types/chemistry.ts';
import { getChapterById } from '../data/syllabus.ts';
import {
  MOCK_PRESETS,
  buildPresetMockPaper,
  drawRandomRealPaperBundle,
  getAvailableRealPaperBundles,
  type MockPresetId,
  type RealPaperBundle,
} from '../utils/mockPaperBuilder.ts';

interface MockExamSetupViewProps {
  questions: Question[];
  moduleSummaries: ModuleErrorSummary[];
  mockHistory: MockExamResult[];
  focusCrossChapter?: boolean;
  onStartMock: (config: {
    title: string;
    subtitle?: string;
    paperModeLabel: MockPaperMode;
    questions: Question[];
    durationSeconds: number;
    realPaperFiles?: RealPaperFileRef[];
  }) => void;
  onStartModuleQuiz: (moduleId: string, timedMock?: boolean) => void;
}

export function MockExamSetupView({
  questions,
  moduleSummaries,
  mockHistory,
  focusCrossChapter = false,
  onStartMock,
  onStartModuleQuiz,
}: MockExamSetupViewProps) {
  const [selectedPresetId, setSelectedPresetId] = useState<MockPresetId>('as-mini');
  const [yearRange, setYearRange] = useState<'all' | '2021-2026' | '2018-2020'>('all');
  const [crossChapterOnly, setCrossChapterOnly] = useState(false);

  const [lastAsRealKey, setLastAsRealKey] = useState<string | undefined>(undefined);
  const [lastA2RealKey, setLastA2RealKey] = useState<string | undefined>(undefined);
  const [previewRealAs, setPreviewRealAs] = useState<RealPaperBundle | null>(null);
  const [previewRealA2, setPreviewRealA2] = useState<RealPaperBundle | null>(null);

  useEffect(() => {
    if (focusCrossChapter) {
      const el = document.getElementById('cross-chapter-modules');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  }, [focusCrossChapter]);

  const selectedPreset = useMemo(
    () => MOCK_PRESETS.find((p) => p.id === selectedPresetId) ?? MOCK_PRESETS[0],
    [selectedPresetId]
  );

  const crossChapterCount = useMemo(
    () => questions.filter((q) => q.chapters.length >= 2).length,
    [questions]
  );

  const availableAsRealPapers = useMemo(
    () => getAvailableRealPaperBundles(questions, 'AS'),
    [questions]
  );
  const availableA2RealPapers = useMemo(
    () => getAvailableRealPaperBundles(questions, 'A2'),
    [questions]
  );

  // Pool availability preview for selected preset
  const poolStats = useMemo(() => {
    const filtered = questions.filter((q) => {
      if (yearRange === '2021-2026' && q.year < 2021) return false;
      if (yearRange === '2018-2020' && (q.year < 2018 || q.year > 2020)) return false;
      if (crossChapterOnly && q.chapters.length < 2) return false;
      if (selectedPreset.level === 'AS') {
        return (q.paperNumber === 1 || q.paperNumber === 2) && q.chapters.every((c) => c <= 18);
      }
      return (q.paperNumber === 4 || q.paperNumber === 5) && q.chapters.every((c) => c >= 19);
    });
    const mcqPool = filtered.filter((q) => q.type === 'mcq').length;
    const structList = filtered.filter((q) => q.type === 'structured');
    const structMarks = structList.reduce((s, q) => s + q.marks, 0);
    return {
      mcqPool,
      structCount: structList.length,
      structMarks,
    };
  }, [questions, yearRange, crossChapterOnly, selectedPreset.level]);

  function launchPresetMock() {
    const built = buildPresetMockPaper(selectedPreset, questions, {
      yearRange,
      crossChapterOnly,
    });
    if (built.questions.length === 0) return;

    const yearTag =
      yearRange === 'all'
        ? '2018–2026'
        : yearRange === '2021-2026'
          ? '2021–2026'
          : '2018–2020';

    const compLabel =
      built.mcqCount > 0
        ? `${built.mcqCount} 选择 + ${built.structuredCount} 简答小问 (${built.structuredMarks} 分)`
        : `${built.structuredCount} 简答小问 (共 ${built.structuredMarks} 分)`;

    onStartMock({
      title: `${selectedPreset.titleZh} · ${selectedPreset.titleEn} (${yearTag})`,
      subtitle: `${compLabel} · 总分 ${built.totalMarks} 分 · 简答题按小问独立呈现`,
      paperModeLabel: selectedPreset.paperMode,
      questions: built.questions,
      durationSeconds: built.durationSeconds,
    });
  }

  function launchRandomRealPaper(level: 'AS' | 'A2', preselected?: RealPaperBundle | null) {
    const bundle =
      preselected ??
      drawRandomRealPaperBundle(
        questions,
        level,
        level === 'AS' ? lastAsRealKey : lastA2RealKey
      );
    if (!bundle) return;

    if (level === 'AS') {
      setLastAsRealKey(bundle.key);
      setPreviewRealAs(bundle);
    } else {
      setLastA2RealKey(bundle.key);
      setPreviewRealA2(bundle);
    }

    onStartMock({
      title: `${level} 实测模考 · ${bundle.paperCodes.join(' + ')}`,
      subtitle: `${bundle.year} ${bundle.sessionLabel} ${bundle.variantLabel} 真实整卷 · ${
        bundle.mcqCount > 0 ? `${bundle.mcqCount} 选择 + ` : ''
      }${bundle.structuredCount} 简答小问 · 共 ${bundle.totalMarks} 分`,
      paperModeLabel: level === 'AS' ? 'AS Real Paper Mock' : 'A2 Real Paper Mock',
      questions: bundle.questions,
      durationSeconds: bundle.durationSeconds,
      realPaperFiles: bundle.files,
    });
  }

  function shufflePreviewRealPaper(level: 'AS' | 'A2') {
    const currentKey = level === 'AS' ? previewRealAs?.key ?? lastAsRealKey : previewRealA2?.key ?? lastA2RealKey;
    const next = drawRandomRealPaperBundle(questions, level, currentKey);
    if (!next) return;
    if (level === 'AS') {
      setPreviewRealAs(next);
      setLastAsRealKey(next.key);
    } else {
      setPreviewRealA2(next);
      setLastA2RealKey(next.key);
    }
  }

  const canLaunchPreset =
    (selectedPreset.mcqCount === 0 || poolStats.mcqPool > 0) && poolStats.structCount > 0;

  return (
    <div className="space-y-9">
      <div className="border-b border-white/10 pb-6">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-[#F8F7F4]/50">
          MODULE 03 · MINI / FULL MOCKS, REAL PAST PAPERS &amp; CROSS-CHAPTER SYNTHESIS
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-[#F8F7F4] sm:text-3xl">
          模拟考测评与跨章综合练习
        </h1>
        <p className="mt-2 max-w-3xl text-sm text-[#F8F7F4]/65">
          提供标准化「小模考 / 大模考」智能按分值组卷、一键随机发放 AS / A2 真实套卷「实测模考」，以及全部 {crossChapterCount} 道跨章节综合题（Modules 01–06）。所有简答题均按小问高清独立呈现，交卷自动评定 CAIE 9701 等级（A*–U）。
        </p>
      </div>

      {/* SECTION 01: Mini / Full Standardized Mocks */}
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-[#E0A458]">
              01 · STANDARDIZED MOCKS · 小模考 / 大模考精准配分
            </div>
            <span className="font-mono text-[11px] text-[#F8F7F4]/45">
              简答题全部按小问形式自动凑分
            </span>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {MOCK_PRESETS.map((preset) => {
              const active = selectedPresetId === preset.id;
              const estTotal = preset.mcqCount + preset.structuredTargetMarks;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => setSelectedPresetId(preset.id)}
                  className={`flex flex-col justify-between rounded-xl border p-4 text-left transition-colors ${
                    active
                      ? 'border-[#E0A458] bg-[#E0A458]/10'
                      : 'border-white/10 bg-[#18181A] hover:border-white/25'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`font-mono text-xs font-semibold ${
                          active ? 'text-[#E0A458]' : 'text-[#F8F7F4]/60'
                        }`}
                      >
                        {preset.level} · {preset.scale === 'mini' ? 'MINI MOCK' : 'FULL MOCK'}
                      </span>
                      <span className="font-mono text-[11px] text-[#F8F7F4]/55 tabular-nums">
                        ~{estTotal} 分 · {preset.durationMinutes} min
                      </span>
                    </div>
                    <div className="mt-1.5 text-base font-semibold text-[#F8F7F4]">
                      {preset.titleZh}
                    </div>
                    <p className="mt-1.5 text-xs leading-relaxed text-[#F8F7F4]/65">
                      {preset.descriptionZh}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="rounded-xl border border-white/10 bg-[#18181A] p-5">
            <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-[#F8F7F4]/55">
              组卷范围筛选（2018–2026 历年真题库）
            </div>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block font-mono text-[11px] uppercase tracking-[0.14em] text-[#F8F7F4]/55">
                  真题年份范围
                </label>
                <select
                  value={yearRange}
                  onChange={(e) =>
                    setYearRange(e.target.value as 'all' | '2021-2026' | '2018-2020')
                  }
                  className="mt-2 w-full rounded-lg border border-white/12 bg-[#111113] px-3 py-2.5 text-sm text-[#F8F7F4] focus:border-[#E0A458] focus:outline-none"
                >
                  <option value="all">2018–2026 全部年份（推荐）</option>
                  <option value="2021-2026">2021–2026 新考纲真题</option>
                  <option value="2018-2020">2018–2020 经典扩充真题</option>
                </select>
              </div>
              <div>
                <label className="block font-mono text-[11px] uppercase tracking-[0.14em] text-[#F8F7F4]/55">
                  考点范围模式
                </label>
                <select
                  value={crossChapterOnly ? 'cross' : 'mixed'}
                  onChange={(e) => setCrossChapterOnly(e.target.value === 'cross')}
                  className="mt-2 w-full rounded-lg border border-white/12 bg-[#111113] px-3 py-2.5 text-sm text-[#F8F7F4] focus:border-[#E0A458] focus:outline-none"
                >
                  <option value="mixed">全题库综合抽取（单章 + 跨章混合）</option>
                  <option value="cross">仅抽取跨章节综合题（≥2 章高难）</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col justify-between rounded-xl border border-white/10 bg-[#18181A] p-6">
          <div>
            <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-[#F8F7F4]/50">
              Preview · 组卷配分预览
            </div>
            <h2 className="mt-2 text-lg font-semibold text-[#F8F7F4]">
              {selectedPreset.titleZh} ({selectedPreset.titleEn})
            </h2>
            <dl className="mt-5 space-y-3 border-t border-white/[0.06] pt-4 text-sm">
              <div className="flex justify-between">
                <dt className="text-[#F8F7F4]/55">选择题 (Paper 1)</dt>
                <dd className="font-mono font-semibold text-[#F8F7F4] tabular-nums">
                  {selectedPreset.mcqCount > 0
                    ? `${Math.min(selectedPreset.mcqCount, poolStats.mcqPool)} 题 (${Math.min(
                        selectedPreset.mcqCount,
                        poolStats.mcqPool
                      )} 分)`
                    : '无（纯简答）'}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-[#F8F7F4]/55">简答小问 ({selectedPreset.level === 'AS' ? 'Paper 2' : 'Paper 4/5'})</dt>
                <dd className="font-mono font-semibold text-[#E0A458] tabular-nums">
                  ~{selectedPreset.structuredTargetMarks} 分
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-[#F8F7F4]/55">预计卷面总分</dt>
                <dd className="font-mono font-semibold text-[#F8F7F4] tabular-nums">
                  ~{selectedPreset.mcqCount + selectedPreset.structuredTargetMarks} 分
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-[#F8F7F4]/55">限时倒计时</dt>
                <dd className="font-mono text-xs text-[#F8F7F4]/75 tabular-nums">
                  {selectedPreset.durationMinutes} 分钟
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-[#F8F7F4]/55">可用题池储备</dt>
                <dd className="font-mono text-xs text-[#F8F7F4]/65 tabular-nums">
                  {selectedPreset.mcqCount > 0 ? `${poolStats.mcqPool} 选择 · ` : ''}
                  {poolStats.structCount} 简答小问 ({poolStats.structMarks} 分)
                </dd>
              </div>
            </dl>
          </div>

          <button
            type="button"
            onClick={launchPresetMock}
            disabled={!canLaunchPreset}
            className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#E0A458] px-4 py-3 text-xs font-bold uppercase tracking-[0.12em] text-[#111113] transition-colors hover:bg-[#EBB66E] disabled:opacity-40 whitespace-nowrap shrink-0"
          >
            <Play className="h-4 w-4" />
            开始 {selectedPreset.titleZh}
          </button>
        </div>
      </section>

      {/* SECTION 02: Real Past Paper Mock (Random AS / A2 Paper Distribution) */}
      <section className="space-y-4">
        <div className="flex flex-col justify-between gap-2 border-b border-white/10 pb-3 sm:flex-row sm:items-end">
          <div>
            <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-[#E0A458]">
              02 · REAL PAST PAPER MOCK · 实测模考（随机发放真实套卷）
            </div>
            <h2 className="mt-1 text-lg font-semibold text-[#F8F7F4]">
              一键随机发放 AS / A2 历年实测真题卷
            </h2>
          </div>
          <span className="font-mono text-xs text-[#F8F7F4]/50 tabular-nums">
            AS 可发 {availableAsRealPapers.length} 套真实考季卷 · A2 可发 {availableA2RealPapers.length} 套真实 Paper 4
          </span>
        </div>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          {/* AS Real Paper Card */}
          <div className="flex flex-col justify-between rounded-xl border border-white/10 bg-[#18181A] p-6">
            <div>
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-xs font-semibold text-[#E0A458]">
                  AS REAL PAPER · 9701 P1 + P2 实测套卷
                </span>
                <span className="font-mono text-[11px] text-[#F8F7F4]/45 tabular-nums">
                  {availableAsRealPapers.length} 套可选
                </span>
              </div>
              <h3 className="mt-2 text-lg font-semibold text-[#F8F7F4]">
                随机发放 AS 实测真题卷
              </h3>
              <p className="mt-1.5 text-xs leading-relaxed text-[#F8F7F4]/65">
                系统自动从 2018–2026 真实考季中随机抽取一套完整 AS 卷（按原卷真实题号 Q1–Q40 选择题 + Paper 2 各大题小问顺序编排），考场内同步支持查阅原卷 PDF 与官方 Mark Scheme。
              </p>

              {previewRealAs && (
                <div className="mt-4 rounded-lg border border-[#E0A458]/30 bg-[#141416] p-3 text-xs">
                  <div className="font-mono font-semibold text-[#E0A458]">
                    当前已抽中：{previewRealAs.paperCodes.join(' + ')}
                  </div>
                  <div className="mt-1 font-mono text-[11px] text-[#F8F7F4]/65 tabular-nums">
                    {previewRealAs.year} {previewRealAs.sessionLabel} · {previewRealAs.mcqCount} 选择 + {previewRealAs.structuredCount} 简答小问 · 共 {previewRealAs.totalMarks} 分
                  </div>
                </div>
              )}
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-2.5 border-t border-white/[0.06] pt-4">
              <button
                type="button"
                onClick={() => launchRandomRealPaper('AS', previewRealAs)}
                disabled={availableAsRealPapers.length === 0}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-[#E0A458] px-4 py-2.5 text-xs font-bold text-[#111113] transition-colors hover:bg-[#EBB66E] disabled:opacity-40 whitespace-nowrap"
              >
                <Play className="h-3.5 w-3.5" />
                {previewRealAs ? '开考当前抽中 AS 卷' : '随机发放 AS 卷并开考'}
              </button>
              <button
                type="button"
                onClick={() => shufflePreviewRealPaper('AS')}
                disabled={availableAsRealPapers.length === 0}
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/12 bg-[#141416] px-3 py-2.5 text-xs font-medium text-[#F8F7F4]/80 transition-colors hover:border-[#E0A458]/60 hover:text-[#E0A458] disabled:opacity-40 whitespace-nowrap"
              >
                <Shuffle className="h-3.5 w-3.5" />
                换一套 AS 卷
              </button>
            </div>
          </div>

          {/* A2 Real Paper Card */}
          <div className="flex flex-col justify-between rounded-xl border border-white/10 bg-[#18181A] p-6">
            <div>
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-xs font-semibold text-[#E0A458]">
                  A2 REAL PAPER · 9701 P4 实测套卷
                </span>
                <span className="font-mono text-[11px] text-[#F8F7F4]/45 tabular-nums">
                  {availableA2RealPapers.length} 套可选
                </span>
              </div>
              <h3 className="mt-2 text-lg font-semibold text-[#F8F7F4]">
                随机发放 A2 实测真题卷
              </h3>
              <p className="mt-1.5 text-xs leading-relaxed text-[#F8F7F4]/65">
                系统自动从 2018–2026 真实考季中随机发放一套完整 A2 Paper 4 结构化试卷，按原卷大题与小问 (a)/(b)/(c) 顺序高清呈现，考场内同步附原卷 QP 与 MS 快捷通道。
              </p>

              {previewRealA2 && (
                <div className="mt-4 rounded-lg border border-[#E0A458]/30 bg-[#141416] p-3 text-xs">
                  <div className="font-mono font-semibold text-[#E0A458]">
                    当前已抽中：{previewRealA2.paperCodes.join(' + ')}
                  </div>
                  <div className="mt-1 font-mono text-[11px] text-[#F8F7F4]/65 tabular-nums">
                    {previewRealA2.year} {previewRealA2.sessionLabel} · {previewRealA2.structuredCount} 个简答小问 · 共 {previewRealA2.totalMarks} 分
                  </div>
                </div>
              )}
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-2.5 border-t border-white/[0.06] pt-4">
              <button
                type="button"
                onClick={() => launchRandomRealPaper('A2', previewRealA2)}
                disabled={availableA2RealPapers.length === 0}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-[#E0A458] px-4 py-2.5 text-xs font-bold text-[#111113] transition-colors hover:bg-[#EBB66E] disabled:opacity-40 whitespace-nowrap"
              >
                <Play className="h-3.5 w-3.5" />
                {previewRealA2 ? '开考当前抽中 A2 卷' : '随机发放 A2 卷并开考'}
              </button>
              <button
                type="button"
                onClick={() => shufflePreviewRealPaper('A2')}
                disabled={availableA2RealPapers.length === 0}
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/12 bg-[#141416] px-3 py-2.5 text-xs font-medium text-[#F8F7F4]/80 transition-colors hover:border-[#E0A458]/60 hover:text-[#E0A458] disabled:opacity-40 whitespace-nowrap"
              >
                <Shuffle className="h-3.5 w-3.5" />
                换一套 A2 卷
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 03: Cross-Chapter Synthesis Modules */}
      <section id="cross-chapter-modules" className="space-y-4">
        <div className="flex flex-col justify-between gap-2 border-b border-white/10 pb-3 sm:flex-row sm:items-end">
          <div>
            <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-[#E0A458]">
              03 · CROSS-CHAPTER SYNTHESIS MODULES (≥2 CHAPTERS)
            </div>
            <h2 className="mt-1 text-lg font-semibold text-[#F8F7F4]">
              跨章综合模块模考与专题突破 (Modules 01–06)
            </h2>
          </div>
          <span className="font-mono text-xs text-[#F8F7F4]/50 tabular-nums">
            共 {crossChapterCount} 道跨章综合真题（含 2018–2026）· 仅在此模考区呈现
          </span>
        </div>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          {moduleSummaries.map((item) => {
            const mod = item.module;
            const modQuestions = questions.filter(
              (q) => q.chapters.length >= 2 && q.moduleId === mod.id
            );
            const pct = Math.round(item.errorRate * 100);
            const isAsOrganic = mod.id === 'mod-as-organic';

            return (
              <div
                key={mod.id}
                className={`flex flex-col justify-between rounded-xl border bg-[#18181A] p-6 ${
                  isAsOrganic ? 'border-[#E0A458]/45' : 'border-white/10'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2 text-xs text-[#F8F7F4]/50">
                    <span className="inline-flex items-center gap-1.5 font-mono font-semibold text-[#E0A458]">
                      <Layers className="h-3.5 w-3.5" />
                      {mod.code} · {mod.level}
                    </span>
                    <span className="font-mono tabular-nums">
                      {item.attempts > 0
                        ? `模块错误率 ${pct}% (${item.wrongCount}/${item.attempts})`
                        : '待测评'}
                    </span>
                  </div>

                  <h3 className="mt-2 text-lg font-semibold text-[#F8F7F4]">
                    {mod.titleZh}
                  </h3>
                  <p className="text-xs text-[#F8F7F4]/50">{mod.titleEn}</p>
                  <p className="mt-2.5 text-sm leading-relaxed text-[#F8F7F4]/65">
                    {mod.descriptionZh}
                  </p>

                  {modQuestions.length > 0 && (
                    <div className="mt-3.5 border-t border-white/[0.06] pt-3">
                      <div className="text-xs font-medium text-[#F8F7F4]/70">
                        已收录跨章真题覆盖组合：
                      </div>
                      <ul className="mt-1.5 space-y-1 text-xs text-[#F8F7F4]/55">
                        {modQuestions.slice(0, 3).map((q) => (
                          <li key={q.id} className="flex items-center justify-between gap-2">
                            <span className="truncate font-mono text-[#F8F7F4]/80">
                              {q.paperCode} Q{q.questionNumber}
                              {q.subPart ?? ''}
                            </span>
                            <span className="shrink-0 font-mono text-[#F8F7F4]/50">
                              {q.chapters
                                .map((id) => getChapterById(id)?.code ?? `Ch ${id}`)
                                .join(' + ')}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.06] pt-4">
                  <span className="font-mono text-xs text-[#F8F7F4]/50 tabular-nums">
                    共 {modQuestions.length} 道跨章综合真题
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onStartModuleQuiz(mod.id, false)}
                      disabled={modQuestions.length === 0}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-white/12 bg-[#141416] px-3 py-2 text-xs font-medium text-[#F8F7F4]/85 transition-colors hover:border-[#E0A458]/60 hover:text-[#E0A458] disabled:opacity-35 whitespace-nowrap shrink-0"
                    >
                      逐题刷题
                    </button>
                    <button
                      type="button"
                      onClick={() => onStartModuleQuiz(mod.id, true)}
                      disabled={modQuestions.length === 0}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-[#E0A458] px-3.5 py-2 text-xs font-semibold text-[#111113] transition-colors hover:bg-[#EBB66E] disabled:opacity-35 whitespace-nowrap shrink-0"
                    >
                      <Play className="h-3.5 w-3.5" />
                      模块限时模考
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* SECTION 04: Historical Mock Records */}
      <section className="rounded-xl border border-white/10 bg-[#18181A] p-6">
        <div className="flex items-center justify-between border-b border-white/[0.06] pb-4">
          <div className="flex items-center gap-2">
            <Award className="h-4 w-4 text-[#E0A458]" />
            <h2 className="text-base font-semibold text-[#F8F7F4]">
              Historical Records · 历史模拟考测评记录 ({mockHistory.length})
            </h2>
          </div>
        </div>

        {mockHistory.length === 0 ? (
          <div className="py-12 text-center text-sm text-[#F8F7F4]/45">
            尚未完成过模拟考测评。点击上方「小模考 / 大模考」或「实测模考」生成您的第一份成绩与等级报告。
          </div>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 font-mono text-[11px] uppercase tracking-[0.1em] text-[#F8F7F4]/50">
                  <th className="py-2.5 pr-4">测评名称</th>
                  <th className="py-2.5 pr-4">完成时间</th>
                  <th className="py-2.5 pr-4 text-right">用时</th>
                  <th className="py-2.5 pr-4 text-right">得分 / 正确率</th>
                  <th className="py-2.5 pr-4 text-center">CAIE 预估等级</th>
                  <th className="py-2.5">本次主要失分章节</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06]">
                {mockHistory.map((m) => {
                  const weakChs = m.chapterBreakdown
                    .filter((b) => b.wrong > 0)
                    .sort((a, b) => b.wrong - a.wrong)
                    .slice(0, 3)
                    .map((b) => getChapterById(b.chapterId)?.code ?? `Ch ${b.chapterId}`);
                  const mins = Math.floor(m.durationSeconds / 60);
                  const secs = m.durationSeconds % 60;

                  return (
                    <tr key={m.id} className="hover:bg-white/[0.03]">
                      <td className="py-3 pr-4 font-medium text-[#F8F7F4]">
                        <div className="flex items-center gap-2">
                          <FileCheck2 className="h-4 w-4 text-[#F8F7F4]/45 shrink-0" />
                          <span>{m.title}</span>
                        </div>
                      </td>
                      <td className="py-3 pr-4 font-mono text-xs text-[#F8F7F4]/55 tabular-nums">
                        {new Date(m.completedAt).toLocaleString('zh-CN', {
                          month: '2-digit',
                          day: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td className="py-3 pr-4 text-right font-mono text-xs text-[#F8F7F4]/65 tabular-nums">
                        <span className="inline-flex items-center gap-1">
                          <Clock className="h-3 w-3 text-[#F8F7F4]/45" />
                          {mins}m {secs}s
                        </span>
                      </td>
                      <td className="py-3 pr-4 text-right font-mono text-xs font-semibold text-[#F8F7F4] tabular-nums">
                        {m.earnedMarks}/{m.totalMarks} ({m.percentage}%)
                      </td>
                      <td className="py-3 pr-4 text-center font-mono text-sm font-bold text-[#E0A458]">
                        {m.estimatedGrade}
                      </td>
                      <td className="py-3 font-mono text-xs text-[#F8F7F4]/65">
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
