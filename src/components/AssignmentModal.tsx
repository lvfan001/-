import React, { useMemo, useState } from 'react';
import { Check, ClipboardCopy, Play, Send, Share2, X } from 'lucide-react';
import type { Question, QuestionStat } from '../types/chemistry.ts';
import { CHAPTERS } from '../data/syllabus.ts';
import { MOCK_PRESETS, type MockPresetId } from '../utils/mockPaperBuilder.ts';
import { getHighFrequencyMistakeQuestions } from '../utils/analytics.ts';
import {
  DEFAULT_CHAPTER_FILTER,
  decodeAssignmentCode,
  encodeAssignmentCode,
  type AssignmentPayload,
  type ChapterPracticeFilter,
} from '../utils/studyTools.ts';

interface AssignmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  questions: Question[];
  statsMap: Record<string, QuestionStat>;
  onLaunchAssignment: (payload: AssignmentPayload) => void;
}

export function AssignmentModal({
  isOpen,
  onClose,
  questions,
  statsMap,
  onLaunchAssignment,
}: AssignmentModalProps) {
  const [tab, setTab] = useState<'student' | 'teacher'>('student');
  const [inputCode, setInputCode] = useState('');

  // Teacher generator state
  const [kind, setKind] = useState<'chapter' | 'mock-preset' | 'question-ids'>('chapter');
  const [chapterId, setChapterId] = useState<number>(1);
  const [difficulty, setDifficulty] = useState<ChapterPracticeFilter['difficulty']>('all');
  const [limit, setLimit] = useState<0 | 10 | 15>(10);
  const [presetId, setPresetId] = useState<MockPresetId>('as-mini');
  const [customTitle, setCustomTitle] = useState('');
  const [teacherNote, setTeacherNote] = useState('');
  const [copied, setCopied] = useState(false);

  const topMistakes = useMemo(
    () => getHighFrequencyMistakeQuestions(questions, statsMap).slice(0, 10),
    [questions, statsMap]
  );

  const decodedPreview = useMemo(() => {
    if (!inputCode.trim()) return null;
    return decodeAssignmentCode(inputCode);
  }, [inputCode]);

  const generatedPayload = useMemo<AssignmentPayload>(() => {
    const ch = CHAPTERS.find((c) => c.id === chapterId);
    const preset = MOCK_PRESETS.find((p) => p.id === presetId) ?? MOCK_PRESETS[0];

    if (kind === 'chapter') {
      const diffLabel =
        difficulty === 'Core'
          ? '基础前置'
          : difficulty === 'Challenging'
            ? '拔高后置'
            : difficulty === 'Standard'
              ? '标准真题'
              : '全梯次';
      return {
        v: 1,
        title:
          customTitle.trim() ||
          `${ch?.code ?? `Ch ${chapterId}`} 专项作业（${diffLabel}${limit ? ` · ${limit}题` : ''}）`,
        teacherNote: teacherNote.trim() || undefined,
        kind: 'chapter',
        chapterId,
        filter: { ...DEFAULT_CHAPTER_FILTER, difficulty, limit },
        createdAt: new Date().toISOString(),
      };
    }

    if (kind === 'mock-preset') {
      return {
        v: 1,
        title: customTitle.trim() || `${preset.titleZh} 限时测评作业`,
        teacherNote: teacherNote.trim() || undefined,
        kind: 'mock-preset',
        presetId,
        createdAt: new Date().toISOString(),
      };
    }

    return {
      v: 1,
      title: customTitle.trim() || `高频错题 Top ${topMistakes.length} 讲评作业`,
      teacherNote: teacherNote.trim() || undefined,
      kind: 'question-ids',
      questionIds: topMistakes.map((m) => m.question.id),
      createdAt: new Date().toISOString(),
    };
  }, [kind, chapterId, difficulty, limit, presetId, customTitle, teacherNote, topMistakes]);

  const generatedCode = useMemo(
    () => encodeAssignmentCode(generatedPayload),
    [generatedPayload]
  );

  if (!isOpen) return null;

  function handleCopyCode() {
    const shareText = `【Chem9701 化学作业】${generatedPayload.title}\n${
      generatedPayload.teacherNote ? `老师说明：${generatedPayload.teacherNote}\n` : ''
    }打开 Chem9701 小程序或网页，点击「作业码」粘贴下方口令即可开始：\n${generatedCode}`;
    navigator.clipboard?.writeText(shareText).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl overflow-hidden rounded-xl border border-white/15 bg-[#18181A] text-[#F8F7F4] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <div className="flex items-center gap-2">
            <Share2 className="h-4 w-4 text-[#E0A458]" />
            <h2 className="text-sm font-semibold">师生作业口令 · 一键分发与直达练习</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-white/10 p-1.5 text-[#F8F7F4]/60 hover:text-[#F8F7F4]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex border-b border-white/10 bg-[#141416] px-5 pt-2">
          <button
            type="button"
            onClick={() => setTab('student')}
            className={`border-b-2 px-4 py-2 text-xs font-semibold transition-colors ${
              tab === 'student'
                ? 'border-[#E0A458] text-[#E0A458]'
                : 'border-transparent text-[#F8F7F4]/55 hover:text-[#F8F7F4]'
            }`}
          >
            学生：输入作业码开始
          </button>
          <button
            type="button"
            onClick={() => setTab('teacher')}
            className={`border-b-2 px-4 py-2 text-xs font-semibold transition-colors ${
              tab === 'teacher'
                ? 'border-[#E0A458] text-[#E0A458]'
                : 'border-transparent text-[#F8F7F4]/55 hover:text-[#F8F7F4]'
            }`}
          >
            教师：生成作业码发群
          </button>
        </div>

        <div className="space-y-4 p-5">
          {tab === 'student' ? (
            <>
              <div>
                <label className="block text-xs font-medium text-[#F8F7F4]/75">
                  粘贴老师发的作业消息或 `CHEM9701-...` 口令：
                </label>
                <textarea
                  rows={3}
                  value={inputCode}
                  onChange={(e) => setInputCode(e.target.value)}
                  placeholder="直接整段粘贴微信群里的作业消息即可自动识别..."
                  className="mt-1.5 w-full rounded-lg border border-white/15 bg-[#111113] p-3 font-mono text-xs text-[#F8F7F4] placeholder:text-[#F8F7F4]/35 focus:border-[#E0A458] focus:outline-none"
                />
              </div>

              {decodedPreview ? (
                <div className="rounded-xl border border-emerald-500/35 bg-emerald-500/10 p-4 space-y-2">
                  <div className="font-mono text-[10px] uppercase tracking-wider text-emerald-300">
                    已识别有效作业口令
                  </div>
                  <div className="text-sm font-semibold text-[#F8F7F4]">
                    {decodedPreview.title}
                  </div>
                  {decodedPreview.teacherNote && (
                    <div className="text-xs text-[#F8F7F4]/75">
                      说明：{decodedPreview.teacherNote}
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      onLaunchAssignment(decodedPreview);
                      onClose();
                    }}
                    className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-[#E0A458] px-4 py-2 text-xs font-semibold text-[#111113] hover:bg-[#EBB66E]"
                  >
                    <Play className="h-3.5 w-3.5" />
                    立即开始本次作业
                  </button>
                </div>
              ) : inputCode.trim() ? (
                <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3.5 py-2.5 text-xs text-red-300">
                  未识别到有效的 `CHEM9701-...` 作业口令，请检查是否粘贴完整。
                </div>
              ) : null}
            </>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-2">
                {(
                  [
                    { id: 'chapter', label: '章节阶梯作业' },
                    { id: 'mock-preset', label: '小/大模考测评' },
                    { id: 'question-ids', label: `错题热力 Top ${topMistakes.length}` },
                  ] as const
                ).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    disabled={item.id === 'question-ids' && topMistakes.length === 0}
                    onClick={() => setKind(item.id)}
                    className={`rounded-lg border px-3 py-2 text-xs font-medium transition-colors disabled:opacity-35 ${
                      kind === item.id
                        ? 'border-[#E0A458] bg-[#E0A458]/15 text-[#E0A458]'
                        : 'border-white/10 bg-[#141416] text-[#F8F7F4]/70 hover:text-[#F8F7F4]'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              {kind === 'chapter' && (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div className="sm:col-span-3">
                    <label className="block text-[11px] text-[#F8F7F4]/60">选择章节</label>
                    <select
                      value={chapterId}
                      onChange={(e) => setChapterId(Number(e.target.value))}
                      className="mt-1 w-full rounded-lg border border-white/12 bg-[#111113] px-3 py-2 text-xs text-[#F8F7F4]"
                    >
                      {CHAPTERS.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.code} · {c.titleEn} ({c.level})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] text-[#F8F7F4]/60">难度筛选</label>
                    <select
                      value={difficulty}
                      onChange={(e) =>
                        setDifficulty(e.target.value as ChapterPracticeFilter['difficulty'])
                      }
                      className="mt-1 w-full rounded-lg border border-white/12 bg-[#111113] px-2.5 py-2 text-xs text-[#F8F7F4]"
                    >
                      <option value="all">全部梯次</option>
                      <option value="Core">仅基础前置</option>
                      <option value="Standard">仅标准真题</option>
                      <option value="Challenging">仅拔高后置</option>
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] text-[#F8F7F4]/60">题量上限</label>
                    <select
                      value={limit}
                      onChange={(e) => setLimit(Number(e.target.value) as 0 | 10 | 15)}
                      className="mt-1 w-full rounded-lg border border-white/12 bg-[#111113] px-2.5 py-2 text-xs text-[#F8F7F4]"
                    >
                      <option value={10}>快刷 10 题</option>
                      <option value={15}>强化 15 题</option>
                      <option value={0}>整章全部</option>
                    </select>
                  </div>
                </div>
              )}

              {kind === 'mock-preset' && (
                <div>
                  <label className="block text-[11px] text-[#F8F7F4]/60">选择模考规格</label>
                  <select
                    value={presetId}
                    onChange={(e) => setPresetId(e.target.value as MockPresetId)}
                    className="mt-1 w-full rounded-lg border border-white/12 bg-[#111113] px-3 py-2 text-xs text-[#F8F7F4]"
                  >
                    {MOCK_PRESETS.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.titleZh} — {p.descriptionZh}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-[11px] text-[#F8F7F4]/60">作业名称（可选）</label>
                  <input
                    type="text"
                    value={customTitle}
                    onChange={(e) => setCustomTitle(e.target.value)}
                    placeholder="如：第 6 周周末作业"
                    className="mt-1 w-full rounded-lg border border-white/12 bg-[#111113] px-3 py-2 text-xs text-[#F8F7F4]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-[#F8F7F4]/60">给学生的提示（可选）</label>
                  <input
                    type="text"
                    value={teacherNote}
                    onChange={(e) => setTeacherNote(e.target.value)}
                    placeholder="如：周日晚 9 点前完成并拍照自评"
                    className="mt-1 w-full rounded-lg border border-white/12 bg-[#111113] px-3 py-2 text-xs text-[#F8F7F4]"
                  />
                </div>
              </div>

              <div className="rounded-xl border border-[#E0A458]/30 bg-[#141416] p-3.5 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-[#E0A458]">
                    {generatedPayload.title}
                  </span>
                  <span className="font-mono text-[10px] text-[#F8F7F4]/45">
                    Web + 小程序通用口令
                  </span>
                </div>
                <div className="break-all rounded bg-[#111113] p-2 font-mono text-[11px] text-[#F8F7F4]/75">
                  {generatedCode}
                </div>
                <div className="flex flex-wrap gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleCopyCode}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-[#E0A458] px-3.5 py-2 text-xs font-semibold text-[#111113] hover:bg-[#EBB66E]"
                  >
                    {copied ? <Check className="h-3.5 w-3.5" /> : <ClipboardCopy className="h-3.5 w-3.5" />}
                    {copied ? '已复制分享消息（可直接发微信群）' : '复制作业口令发群'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onLaunchAssignment(generatedPayload);
                      onClose();
                    }}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-[#18181A] px-3.5 py-2 text-xs font-medium text-[#F8F7F4]/85 hover:border-[#E0A458] hover:text-[#E0A458]"
                  >
                    <Send className="h-3.5 w-3.5" />
                    预览试做
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
