import React, { useState } from 'react';
import { Layers, Play } from 'lucide-react';
import type {
  ChapterErrorSummary,
  ChemBranch,
  ChemLevel,
  ModuleErrorSummary,
  Question,
} from '../types/chemistry.ts';
import { getChapterById } from '../data/syllabus.ts';

interface ChapterModuleViewProps {
  questions: Question[];
  chapterSummaries: ChapterErrorSummary[];
  moduleSummaries: ModuleErrorSummary[];
  onStartChapterQuiz: (chapterId: number) => void;
  onStartModuleQuiz: (moduleId: string) => void;
}

export function ChapterModuleView({
  questions,
  chapterSummaries,
  moduleSummaries,
  onStartChapterQuiz,
  onStartModuleQuiz,
}: ChapterModuleViewProps) {
  const [activeTab, setActiveTab] = useState<'chapters' | 'modules'>('chapters');
  const [levelFilter, setLevelFilter] = useState<ChemLevel | 'ALL'>('ALL');
  const [branchFilter, setBranchFilter] = useState<ChemBranch | 'ALL'>('ALL');

  const filteredChapters = chapterSummaries.filter((item) => {
    if (levelFilter !== 'ALL' && item.chapter.level !== levelFilter) return false;
    if (branchFilter !== 'ALL' && item.chapter.branch !== branchFilter) return false;
    return true;
  });

  const singleChapterQuestionsCount = (chapterId: number) =>
    questions.filter((q) => q.chapters.length === 1 && q.chapters[0] === chapterId).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-medium tracking-wide text-slate-500">
            30 CHAPTERS &amp; MULTI-CHAPTER MODULE ROUTING
          </p>
          <h1 className="mt-1.5 text-2xl font-semibold tracking-tight text-slate-900">
            30 章节单章精练与跨章模块练习
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            严格按 Cambridge Coursebook (3rd Ed.) Ch 01–30 划分：单章练习仅包含该章独立可解的真题；涉及 2 个及以上章节的综合真题严格归入右侧「模块练习」。
          </p>
        </div>

        {/* Clean Segmented Switcher */}
        <div className="inline-flex rounded-lg bg-slate-100 p-1 shrink-0">
          <button
            onClick={() => setActiveTab('chapters')}
            className={`rounded-md px-3.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'chapters'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            30 章节单章练习
          </button>
          <button
            onClick={() => setActiveTab('modules')}
            className={`rounded-md px-3.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'modules'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            跨章模块练习 (≥2 章)
          </button>
        </div>
      </div>

      {activeTab === 'chapters' ? (
        <div className="space-y-5">
          {/* Filters */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-1 rounded-lg bg-slate-100 p-1">
              {(['ALL', 'AS', 'A2'] as const).map((lvl) => (
                <button
                  key={lvl}
                  onClick={() => setLevelFilter(lvl)}
                  className={`rounded-md px-3 py-1 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                    levelFilter === lvl
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {lvl === 'ALL' ? '全部 (Ch 1–30)' : lvl === 'AS' ? 'AS (Ch 1–18)' : 'A2 (Ch 19–30)'}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-1 rounded-lg bg-slate-100 p-1">
              {(['ALL', 'Physical', 'Inorganic', 'Organic', 'Analytical'] as const).map((br) => (
                <button
                  key={br}
                  onClick={() => setBranchFilter(br)}
                  className={`rounded-md px-3 py-1 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                    branchFilter === br
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
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

          {/* 30 Chapters List */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {filteredChapters.map((item) => {
              const ch = item.chapter;
              const singleCount = singleChapterQuestionsCount(ch.id);
              const pct = Math.round(item.errorRate * 100);
              return (
                <div
                  key={ch.id}
                  className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-5"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
                      <span className="font-mono font-semibold text-[#1D4ED8] tabular-nums">
                        {ch.code} · {ch.level} · {ch.branch}
                      </span>
                      <span className="font-mono tabular-nums">
                        {item.attempts > 0
                          ? `错误率 ${pct}% (${item.wrongCount}/${item.attempts})`
                          : '尚未作答'}
                      </span>
                    </div>
                    <h3 className="mt-1.5 text-base font-semibold text-slate-900">
                      {ch.titleZh}
                    </h3>
                    <p className="text-xs text-slate-500">{ch.titleEn}</p>
                    <p className="mt-2.5 text-xs leading-relaxed text-slate-600">
                      核心考点：{ch.keyTopics.join(' · ')}
                    </p>
                  </div>

                  <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3.5">
                    <span className="font-mono text-xs text-slate-500 tabular-nums">
                      单章可解 {singleCount} 题
                      {item.questionCount > singleCount
                        ? ` · 另 ${item.questionCount - singleCount} 题在模块练习`
                        : ''}
                    </span>
                    <button
                      onClick={() => onStartChapterQuiz(ch.id)}
                      disabled={singleCount === 0}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-1.5 text-xs font-medium text-white transition-colors hover:bg-[#1D4ED8] disabled:opacity-40 whitespace-nowrap shrink-0"
                    >
                      <Play className="h-3.5 w-3.5" />
                      章节练习
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
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
                className={`flex flex-col justify-between rounded-xl border bg-white p-6 ${
                  isAsOrganic ? 'border-blue-300' : 'border-slate-200'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
                    <span className="inline-flex items-center gap-1.5 font-mono font-semibold text-[#1D4ED8]">
                      <Layers className="h-3.5 w-3.5" />
                      {mod.code} · {mod.level}
                    </span>
                    <span className="font-mono tabular-nums">
                      {item.attempts > 0
                        ? `模块错误率 ${pct}% (${item.wrongCount}/${item.attempts})`
                        : '待测评'}
                    </span>
                  </div>

                  <h3 className="mt-2 text-lg font-semibold text-slate-900">
                    {mod.titleZh}
                  </h3>
                  <p className="text-xs text-slate-500">{mod.titleEn}</p>
                  <p className="mt-2.5 text-sm leading-relaxed text-slate-600">
                    {mod.descriptionZh}
                  </p>

                  {modQuestions.length > 0 && (
                    <div className="mt-3.5 border-t border-slate-100 pt-3">
                      <div className="text-xs font-medium text-slate-700">
                        已收录跨章真题覆盖组合：
                      </div>
                      <ul className="mt-1.5 space-y-1 text-xs text-slate-600">
                        {modQuestions.slice(0, 3).map((q) => (
                          <li key={q.id} className="flex items-center justify-between gap-2">
                            <span className="truncate font-mono text-slate-700">
                              {q.paperCode} Q{q.questionNumber}{q.subPart ?? ''}
                            </span>
                            <span className="shrink-0 font-mono text-slate-500">
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

                <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4">
                  <span className="font-mono text-xs text-slate-500 tabular-nums">
                    共 {modQuestions.length} 道跨章综合真题
                  </span>
                  <button
                    onClick={() => onStartModuleQuiz(mod.id)}
                    disabled={modQuestions.length === 0}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-[#1D4ED8] px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-[#1E40AF] disabled:opacity-40 whitespace-nowrap shrink-0"
                  >
                    <Play className="h-3.5 w-3.5" />
                    开始模块练习
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
