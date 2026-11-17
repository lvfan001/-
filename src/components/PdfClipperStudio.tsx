import React, { useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Crop,
  FileUp,
  Loader2,
  Plus,
  Scissors,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import type { ExamSession, Question } from '../types/chemistry.ts';
import { CHAPTERS, getModuleById, resolveModuleForChapters } from '../data/syllabus.ts';
import { saveClippedImage } from '../utils/imageStore.ts';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

interface DetectedRegion {
  id: string;
  box: [number, number, number, number];
  questionNumber: number;
  type: 'mcq' | 'structured';
  marks: number;
  chapters: number[];
  promptEn: string;
  promptZh: string;
  correctOption: 'A' | 'B' | 'C' | 'D';
  explanationEn: string;
  explanationZh: string;
}

interface PdfClipperStudioProps {
  initialPaper?: {
    paperId?: string;
    paperCode: string;
    year: number;
    session: ExamSession;
    paperNumber: 1 | 2 | 4;
  } | null;
  onClose: () => void;
  onSaveClippedQuestion: (question: Question) => void;
}

export function PdfClipperStudio({
  initialPaper,
  onClose,
  onSaveClippedQuestion,
}: PdfClipperStudioProps) {
  const [activeDocMode, setActiveDocMode] = useState<'qp' | 'ms'>('qp');
  const [qpPdfDoc, setQpPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [msPdfDoc, setMsPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [pageNum, setPageNum] = useState(1);
  const [scale, setScale] = useState(1.5);
  const [loadingPdf, setLoadingPdf] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);

  const [regions, setRegions] = useState<DetectedRegion[]>([]);
  const [selectedRegionId, setSelectedRegionId] = useState<string | null>(null);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [dragCurrent, setDragCurrent] = useState<{ x: number; y: number } | null>(null);

  const [qpPreviewUrl, setQpPreviewUrl] = useState<string | null>(null);
  const [msPreviewUrl, setMsPreviewUrl] = useState<string | null>(null);

  const [paperCode, setPaperCode] = useState(initialPaper?.paperCode ?? '9701/12/M/J/24');
  const [year, setYear] = useState(initialPaper?.year ?? 2024);
  const [session, setSession] = useState<ExamSession>(initialPaper?.session ?? 'M/J');
  const [paperNumber, setPaperNumber] = useState<1 | 2 | 4>(initialPaper?.paperNumber ?? 1);

  const [qNumber, setQNumber] = useState(1);
  const [qType, setQType] = useState<'mcq' | 'structured'>('mcq');
  const [qMarks, setQMarks] = useState(1);
  const [selectedChapters, setSelectedChapters] = useState<number[]>([6]);
  const [correctOpt, setCorrectOpt] = useState<'A' | 'B' | 'C' | 'D'>('A');
  const [promptEn, setPromptEn] = useState('');
  const [promptZh, setPromptZh] = useState('');
  const [explanationEn, setExplanationEn] = useState('');
  const [explanationZh, setExplanationZh] = useState('');

  const [aiDetecting, setAiDetecting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const activeDoc = activeDocMode === 'qp' ? qpPdfDoc : msPdfDoc;
  const totalPages = activeDoc?.numPages ?? 0;

  useEffect(() => {
    if (!initialPaper?.paperId) return;
    let mounted = true;
    setLoadingPdf(true);
    fetch(`/api/papers/pdf/${initialPaper.paperId}?inline=1`)
      .then((r) => {
        if (!r.ok) throw new Error('未能读取服务器缓存 PDF');
        return r.arrayBuffer();
      })
      .then((buf) => pdfjsLib.getDocument({ data: buf }).promise)
      .then((doc) => {
        if (mounted) {
          setQpPdfDoc(doc);
          setPageNum(1);
        }
      })
      .catch((err) => {
        if (mounted) {
          setNotice({
            type: 'err',
            text: `无法自动加载 PDF（${err instanceof Error ? err.message : ''}），请在下方选择本地 PDF 文件打开。`,
          });
        }
      })
      .finally(() => {
        if (mounted) setLoadingPdf(false);
      });
    return () => {
      mounted = false;
    };
  }, [initialPaper?.paperId]);

  useEffect(() => {
    if (!activeDoc || !canvasRef.current) return;
    let cancelled = false;
    const renderPage = async () => {
      const page = await activeDoc.getPage(pageNum);
      if (cancelled || !canvasRef.current) return;
      const viewport = page.getViewport({ scale });
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      await page.render({ canvasContext: ctx, viewport, canvas }).promise;
    };
    renderPage().catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [activeDoc, pageNum, scale]);

  async function handleFileSelect(mode: 'qp' | 'ms', file: File | null) {
    if (!file) return;
    setLoadingPdf(true);
    setNotice(null);
    try {
      const buf = await file.arrayBuffer();
      const doc = await pdfjsLib.getDocument({ data: buf }).promise;
      if (mode === 'qp') {
        setQpPdfDoc(doc);
        setActiveDocMode('qp');
      } else {
        setMsPdfDoc(doc);
        setActiveDocMode('ms');
      }
      setPageNum(1);
      setRegions([]);
    } catch (err) {
      setNotice({
        type: 'err',
        text: `PDF 打开失败：${err instanceof Error ? err.message : '文件可能已损坏'}`,
      });
    } finally {
      setLoadingPdf(false);
    }
  }

  function extractCropDataUrl(box: [number, number, number, number]): string | null {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const [ymin, xmin, ymax, xmax] = box;
    const sx = Math.max(0, Math.floor((xmin / 1000) * canvas.width));
    const sy = Math.max(0, Math.floor((ymin / 1000) * canvas.height));
    const sw = Math.max(10, Math.floor(((xmax - xmin) / 1000) * canvas.width));
    const sh = Math.max(10, Math.floor(((ymax - ymin) / 1000) * canvas.height));

    const off = document.createElement('canvas');
    off.width = sw;
    off.height = sh;
    const ctx = off.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(canvas, sx, sy, sw, sh, 0, 0, sw, sh);
    return off.toDataURL('image/png');
  }

  function applyRegionToForm(reg: DetectedRegion) {
    setSelectedRegionId(reg.id);
    setQNumber(reg.questionNumber);
    setQType(reg.type);
    setQMarks(reg.marks);
    setSelectedChapters(reg.chapters);
    if (['A', 'B', 'C', 'D'].includes(reg.correctOption)) {
      setCorrectOpt(reg.correctOption);
    }
    if (reg.promptEn) setPromptEn(reg.promptEn);
    if (reg.promptZh) setPromptZh(reg.promptZh);
    if (reg.explanationEn) setExplanationEn(reg.explanationEn);
    if (reg.explanationZh) setExplanationZh(reg.explanationZh);

    const dataUrl = extractCropDataUrl(reg.box);
    if (dataUrl) {
      if (activeDocMode === 'qp') setQpPreviewUrl(dataUrl);
      else setMsPreviewUrl(dataUrl);
    }
  }

  async function handleAiDetectPage() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setAiDetecting(true);
    setNotice(null);
    try {
      const pagePng = canvas.toDataURL('image/png');
      const resp = await fetch('/api/papers/detect-crops', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: pagePng,
          paperCode,
          pageNumber: pageNum,
        }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        setNotice({ type: 'err', text: data.error || 'AI 框选失败，请使用鼠标拖拽手动截图。' });
        return;
      }
      const list = (data.regions ?? []) as DetectedRegion[];
      setRegions(list);
      if (list.length > 0) {
        applyRegionToForm(list[0]);
        setNotice({
          type: 'ok',
          text: `AI 已在本页识别 ${list.length} 个题目/图表区域，点击任意框即可微调并截图入库。`,
        });
      } else {
        setNotice({ type: 'err', text: '本页未检测到题目区域，可直接使用鼠标拖拽框选。' });
      }
    } catch (err) {
      setNotice({
        type: 'err',
        text: `请求失败：${err instanceof Error ? err.message : '网络异常'}`,
      });
    } finally {
      setAiDetecting(false);
    }
  }

  function toNormalizedPoint(clientX: number, clientY: number): { x: number; y: number } | null {
    const el = overlayRef.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    const x = Math.max(0, Math.min(1000, Math.round(((clientX - rect.left) / rect.width) * 1000)));
    const y = Math.max(0, Math.min(1000, Math.round(((clientY - rect.top) / rect.height) * 1000)));
    return { x, y };
  }

  function handleMouseDown(e: React.MouseEvent<HTMLDivElement>) {
    if (!activeDoc) return;
    const pt = toNormalizedPoint(e.clientX, e.clientY);
    if (!pt) return;
    setDragStart(pt);
    setDragCurrent(pt);
  }

  function handleMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    if (!dragStart) return;
    const pt = toNormalizedPoint(e.clientX, e.clientY);
    if (pt) setDragCurrent(pt);
  }

  function handleMouseUp() {
    if (!dragStart || !dragCurrent) {
      setDragStart(null);
      setDragCurrent(null);
      return;
    }
    const xmin = Math.min(dragStart.x, dragCurrent.x);
    const xmax = Math.max(dragStart.x, dragCurrent.x);
    const ymin = Math.min(dragStart.y, dragCurrent.y);
    const ymax = Math.max(dragStart.y, dragCurrent.y);
    setDragStart(null);
    setDragCurrent(null);

    if (xmax - xmin < 30 || ymax - ymin < 25) return;

    const newRegion: DetectedRegion = {
      id: `manual-${Date.now()}`,
      box: [ymin, xmin, ymax, xmax],
      questionNumber: qNumber,
      type: qType,
      marks: qMarks,
      chapters: selectedChapters,
      promptEn: promptEn || `Refer to the clipped diagram/question from ${paperCode} Q${qNumber}.`,
      promptZh: promptZh || `请结合真题原卷截图作答（${paperCode} 第 ${qNumber} 题）。`,
      correctOption: correctOpt,
      explanationEn,
      explanationZh,
    };

    setRegions((prev) => [...prev, newRegion]);
    applyRegionToForm(newRegion);
  }

  function toggleChapter(chId: number) {
    setSelectedChapters((prev) => {
      if (prev.includes(chId)) {
        return prev.length > 1 ? prev.filter((c) => c !== chId) : prev;
      }
      return [...prev, chId].sort((a, b) => a - b);
    });
  }

  async function handleSaveClippedQuestion() {
    if (!qpPreviewUrl) {
      setNotice({ type: 'err', text: '请先框选或点击 AI 识别框生成真题截图预览。' });
      return;
    }
    setSaving(true);
    try {
      const qpImgId = `clip-qp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      await saveClippedImage(qpImgId, qpPreviewUrl);

      let msImgId: string | undefined;
      if (msPreviewUrl) {
        msImgId = `clip-ms-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        await saveClippedImage(msImgId, msPreviewUrl);
      }

      const activeRegion = regions.find((r) => r.id === selectedRegionId);
      const moduleId = resolveModuleForChapters(selectedChapters);

      const newQ: Question = {
        id: `q-clip-${paperCode.replace(/[^a-zA-Z0-9]/g, '')}-${qNumber}-${Date.now()}`,
        paperCode,
        year,
        session,
        paperNumber,
        questionNumber: qNumber,
        source: 'pdf-clipped',
        chapters: selectedChapters,
        moduleId,
        type: qType,
        marks: qMarks,
        promptEn:
          promptEn.trim() ||
          `Refer to the official exam question image (${paperCode} Q${qNumber}).`,
        promptZh:
          promptZh.trim() ||
          `请参考上方真题原卷截图进行作答（${paperCode} Q${qNumber}）。`,
        clippedImageId: qpImgId,
        msImageId: msImgId,
        cropSourceMeta: activeRegion
          ? { paperCode, pageNumber: pageNum, box: activeRegion.box }
          : undefined,
        options:
          qType === 'mcq'
            ? [
                { label: 'A', text: 'Option A (see question image)' },
                { label: 'B', text: 'Option B (see question image)' },
                { label: 'C', text: 'Option C (see question image)' },
                { label: 'D', text: 'Option D (see question image)' },
              ]
            : undefined,
        correctOption: qType === 'mcq' ? correctOpt : undefined,
        markSchemePoints:
          qType === 'structured'
            ? [
                explanationEn.trim() ||
                  'Check your working against the cropped official Mark Scheme / model answer.',
              ]
            : undefined,
        modelAnswer:
          qType === 'structured'
            ? explanationEn.trim() || 'Refer to clipped Mark Scheme image.'
            : undefined,
        explanationEn:
          explanationEn.trim() ||
          `Official CAIE 9701 past paper question (${paperCode} Q${qNumber}).`,
        explanationZh:
          explanationZh.trim() ||
          `来自 ${paperCode} 第 ${qNumber} 题原卷截图切题，已自动归类至对应章节与模块。`,
        difficulty: 'Standard',
      };

      onSaveClippedQuestion(newQ);
      setNotice({
        type: 'ok',
        text: `已保存 ${paperCode} Q${qNumber} 原卷截图到${
          moduleId ? `跨章模块 ${getModuleById(moduleId)?.code}` : `Ch ${selectedChapters[0]} 单章题库`
        }！`,
      });
      setQNumber((n) => n + 1);
      setQpPreviewUrl(null);
      setPromptEn('');
      setPromptZh('');
    } finally {
      setSaving(false);
    }
  }

  const routedModuleId = resolveModuleForChapters(selectedChapters);
  const routedModule = routedModuleId ? getModuleById(routedModuleId) : null;

  const liveDragBox =
    dragStart && dragCurrent
      ? {
          top: `${Math.min(dragStart.y, dragCurrent.y) / 10}%`,
          left: `${Math.min(dragStart.x, dragCurrent.x) / 10}%`,
          height: `${Math.abs(dragCurrent.y - dragStart.y) / 10}%`,
          width: `${Math.abs(dragCurrent.x - dragStart.x) / 10}%`,
        }
      : null;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-[#18181A] px-3 py-1.5 text-xs font-medium text-[#F8F7F4]/85 hover:border-[#E0A458] hover:text-[#E0A458]"
          >
            <X className="h-3.5 w-3.5" />
            关闭工作室
          </button>
          <div>
            <h1 className="flex items-center gap-2 text-lg font-semibold text-[#F8F7F4]">
              <Scissors className="h-4 w-4 text-[#E0A458]" />
              PDF 原卷截图切题工作室（AI 框选 + 手动裁剪）
            </h1>
            <p className="text-xs text-[#F8F7F4]/55">
              载入 2021–2026 真题 PDF，通过 AI 自动识别框选或鼠标拖拽精确截取图表题与原题画面，自动路由至 30 章节或跨章模块。
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-white/15 bg-[#18181A] px-3 py-1.5 text-xs font-medium text-[#F8F7F4]/85 hover:border-[#E0A458]">
            <FileUp className="h-3.5 w-3.5 text-[#E0A458]" />
            打开 QP PDF
            <input
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={(e) => handleFileSelect('qp', e.target.files?.[0] ?? null)}
            />
          </label>
          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-white/15 bg-[#18181A] px-3 py-1.5 text-xs font-medium text-[#F8F7F4]/85 hover:border-emerald-400">
            <FileUp className="h-3.5 w-3.5 text-emerald-400" />
            打开 MS PDF (可选)
            <input
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={(e) => handleFileSelect('ms', e.target.files?.[0] ?? null)}
            />
          </label>
        </div>
      </div>

      {notice && (
        <div
          className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 text-xs ${
            notice.type === 'ok'
              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
              : 'border-red-500/30 bg-red-500/10 text-red-300'
          }`}
        >
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{notice.text}</span>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="flex flex-col rounded-xl border border-white/10 bg-[#18181A] lg:col-span-8">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.06] px-4 py-3">
            <div className="flex items-center gap-2">
              <div className="inline-flex rounded-lg border border-white/10 bg-[#111113] p-0.5 text-xs">
                <button
                  onClick={() => {
                    setActiveDocMode('qp');
                    setPageNum(1);
                    setRegions([]);
                  }}
                  className={`rounded-md px-2.5 py-1 font-medium ${
                    activeDocMode === 'qp'
                      ? 'bg-[#E0A458] text-[#111113] font-semibold'
                      : 'text-[#F8F7F4]/60'
                  }`}
                >
                  试题卷 QP
                </button>
                <button
                  onClick={() => {
                    setActiveDocMode('ms');
                    setPageNum(1);
                    setRegions([]);
                  }}
                  disabled={!msPdfDoc}
                  className={`rounded-md px-2.5 py-1 font-medium disabled:opacity-35 ${
                    activeDocMode === 'ms'
                      ? 'bg-[#E0A458] text-[#111113] font-semibold'
                      : 'text-[#F8F7F4]/60'
                  }`}
                >
                  评分标准 MS
                </button>
              </div>

              {activeDoc && (
                <div className="flex items-center gap-1 text-xs text-[#F8F7F4]/70">
                  <button
                    onClick={() => {
                      setPageNum((p) => Math.max(1, p - 1));
                      setRegions([]);
                    }}
                    disabled={pageNum <= 1}
                    className="rounded border border-white/12 bg-[#111113] p-1 hover:border-[#E0A458] disabled:opacity-35"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </button>
                  <span className="px-2 font-mono tabular-nums">
                    {pageNum} / {totalPages}
                  </span>
                  <button
                    onClick={() => {
                      setPageNum((p) => Math.min(totalPages, p + 1));
                      setRegions([]);
                    }}
                    disabled={pageNum >= totalPages}
                    className="rounded border border-white/12 bg-[#111113] p-1 hover:border-[#E0A458] disabled:opacity-35"
                  >
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              <select
                value={scale}
                onChange={(e) => setScale(Number(e.target.value))}
                className="rounded-lg border border-white/12 bg-[#111113] px-2 py-1 font-mono text-xs text-[#F8F7F4]/85"
              >
                <option value={1.1}>110%</option>
                <option value={1.5}>150%</option>
                <option value={2.0}>200% 高清</option>
              </select>

              <button
                onClick={handleAiDetectPage}
                disabled={!activeDoc || aiDetecting}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#E0A458] px-3 py-1.5 text-xs font-semibold text-[#111113] hover:bg-[#EBB66E] disabled:opacity-35 whitespace-nowrap shrink-0"
              >
                {aiDetecting ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Sparkles className="h-3.5 w-3.5" />
                )}
                AI 智能框选本页题目
              </button>
            </div>
          </div>

          <div className="max-h-[75vh] overflow-auto bg-[#0D0D0F] p-4">
            {loadingPdf ? (
              <div className="flex h-96 items-center justify-center text-sm text-[#F8F7F4]/55">
                <Loader2 className="mr-2 h-4 w-4 animate-spin text-[#E0A458]" />
                正在渲染 PDF 页面...
              </div>
            ) : !activeDoc ? (
              <div className="flex h-96 flex-col items-center justify-center rounded-xl border border-dashed border-white/15 bg-[#141416] p-8 text-center">
                <Crop className="h-8 w-8 text-[#E0A458]/70" />
                <p className="mt-3 text-sm font-medium text-[#F8F7F4]">
                  请点击右上角「打开 QP PDF」选择任意 2021–2026 CAIE 9701 真题 PDF
                </p>
                <p className="mt-1 text-xs text-[#F8F7F4]/55">
                  载入后可使用「AI 智能框选」或直接用鼠标在试卷上拖拽框选图表题截图。
                </p>
              </div>
            ) : (
              <div className="relative mx-auto inline-block shadow-lg">
                <canvas ref={canvasRef} className="block bg-white" />
                <div
                  ref={overlayRef}
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  className="absolute inset-0 cursor-crosshair select-none"
                >
                  {regions.map((reg) => {
                    const [ymin, xmin, ymax, xmax] = reg.box;
                    const isSel = selectedRegionId === reg.id;
                    return (
                      <div
                        key={reg.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          applyRegionToForm(reg);
                        }}
                        style={{
                          top: `${ymin / 10}%`,
                          left: `${xmin / 10}%`,
                          height: `${(ymax - ymin) / 10}%`,
                          width: `${(xmax - xmin) / 10}%`,
                        }}
                        className={`absolute border-2 transition-colors ${
                          isSel
                            ? 'border-[#1D4ED8] bg-[#1D4ED8]/15'
                            : 'border-[#E0A458] bg-[#E0A458]/15 hover:border-[#1D4ED8]'
                        }`}
                      >
                        <span className="inline-block bg-[#111113] px-1.5 py-0.5 font-mono text-[10px] font-semibold text-[#E0A458]">
                          Q{reg.questionNumber}
                        </span>
                      </div>
                    );
                  })}

                  {liveDragBox && (
                    <div
                      style={liveDragBox}
                      className="absolute border-2 border-dashed border-[#E0A458] bg-[#E0A458]/20"
                    />
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4 rounded-xl border border-white/10 bg-[#18181A] p-5 lg:col-span-4">
          <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
            <span className="text-sm font-semibold text-[#F8F7F4]">截图预览与章节归类</span>
            {regions.length > 0 && (
              <button
                onClick={() => setRegions([])}
                className="inline-flex items-center gap-1 text-xs text-[#F8F7F4]/45 hover:text-red-300"
              >
                <Trash2 className="h-3.5 w-3.5" />
                清空选框
              </button>
            )}
          </div>

          {qpPreviewUrl ? (
            <div className="rounded-lg border border-white/15 bg-white p-2">
              <img
                src={qpPreviewUrl}
                alt="Cropped QP preview"
                className="max-h-48 w-full object-contain"
              />
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-white/15 bg-[#141416] p-5 text-center text-xs text-[#F8F7F4]/50">
              在左侧画布拖拽框选一道完整真题（含配图与选项），截图将显示在此处
            </div>
          )}

          {msPreviewUrl && (
            <div className="rounded-lg border border-emerald-500/35 bg-white p-2">
              <div className="mb-1 text-[11px] font-medium text-emerald-800">
                已关联评分标准 MS 截图：
              </div>
              <img
                src={msPreviewUrl}
                alt="Cropped MS preview"
                className="max-h-24 w-full object-contain"
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-2.5 text-xs">
            <div>
              <label className="font-medium text-[#F8F7F4]/70">试卷编号</label>
              <input
                type="text"
                value={paperCode}
                onChange={(e) => setPaperCode(e.target.value)}
                className="mt-1 w-full rounded-lg border border-white/12 bg-[#111113] px-2.5 py-1.5 font-mono text-xs text-[#F8F7F4] focus:border-[#E0A458] focus:outline-none"
              />
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              <div>
                <label className="font-medium text-[#F8F7F4]/70">年份</label>
                <input
                  type="number"
                  value={year}
                  min={2021}
                  max={2026}
                  onChange={(e) => setYear(Number(e.target.value))}
                  className="mt-1 w-full rounded-lg border border-white/12 bg-[#111113] px-2 py-1.5 font-mono text-xs text-[#F8F7F4] focus:border-[#E0A458] focus:outline-none"
                />
              </div>
              <div>
                <label className="font-medium text-[#F8F7F4]/70">题号</label>
                <input
                  type="number"
                  value={qNumber}
                  min={1}
                  onChange={(e) => setQNumber(Number(e.target.value))}
                  className="mt-1 w-full rounded-lg border border-white/12 bg-[#111113] px-2 py-1.5 font-mono text-xs text-[#F8F7F4] focus:border-[#E0A458] focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="font-medium text-[#F8F7F4]/70">题型</label>
              <select
                value={qType}
                onChange={(e) => setQType(e.target.value as 'mcq' | 'structured')}
                className="mt-1 w-full rounded-lg border border-white/12 bg-[#111113] px-2 py-1.5 text-xs text-[#F8F7F4]"
              >
                <option value="mcq">选择题 (Paper 1 MCQ)</option>
                <option value="structured">简答题 (Paper 2/4)</option>
              </select>
            </div>

            {qType === 'mcq' ? (
              <div>
                <label className="font-medium text-[#F8F7F4]/70">正确选项</label>
                <select
                  value={correctOpt}
                  onChange={(e) => setCorrectOpt(e.target.value as 'A' | 'B' | 'C' | 'D')}
                  className="mt-1 w-full rounded-lg border border-white/12 bg-[#111113] px-2 py-1.5 font-mono text-xs text-[#F8F7F4]"
                >
                  <option value="A">A</option>
                  <option value="B">B</option>
                  <option value="C">C</option>
                  <option value="D">D</option>
                </select>
              </div>
            ) : (
              <div>
                <label className="font-medium text-[#F8F7F4]/70">分值 (Marks)</label>
                <input
                  type="number"
                  min={1}
                  max={15}
                  value={qMarks}
                  onChange={(e) => setQMarks(Number(e.target.value))}
                  className="mt-1 w-full rounded-lg border border-white/12 bg-[#111113] px-2 py-1.5 font-mono text-xs text-[#F8F7F4]"
                />
              </div>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-[#F8F7F4]/75">涉及章节（多选 ≥2 章自动归入模块）</span>
              <span className="font-mono text-[11px] font-semibold text-[#E0A458]">
                {routedModule ? `→ ${routedModule.code}` : `→ 单章 Ch ${selectedChapters[0]}`}
              </span>
            </div>
            <div className="mt-1.5 grid max-h-32 grid-cols-6 gap-1 overflow-y-auto rounded-lg border border-white/12 bg-[#111113] p-2">
              {CHAPTERS.map((ch) => {
                const active = selectedChapters.includes(ch.id);
                return (
                  <button
                    key={ch.id}
                    type="button"
                    onClick={() => toggleChapter(ch.id)}
                    title={`${ch.code} ${ch.titleZh}`}
                    className={`rounded py-1 font-mono text-[11px] font-medium transition-colors ${
                      active
                        ? 'bg-[#E0A458] text-[#111113] font-semibold'
                        : 'bg-[#18181A] text-[#F8F7F4]/70 hover:bg-white/10'
                    }`}
                  >
                    {String(ch.id).padStart(2, '0')}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-2 text-xs">
            <div>
              <label className="font-medium text-[#F8F7F4]/70">补充解析 / Mark Scheme 要点（英文）</label>
              <textarea
                rows={2}
                value={explanationEn}
                onChange={(e) => setExplanationEn(e.target.value)}
                placeholder="可选：填写英文解答要点，若已关联 MS 截图可留空"
                className="mt-1 w-full rounded-lg border border-white/12 bg-[#111113] px-2.5 py-1.5 text-xs text-[#F8F7F4] placeholder:text-[#F8F7F4]/30 focus:border-[#E0A458] focus:outline-none"
              />
            </div>
            <div>
              <label className="font-medium text-[#F8F7F4]/70">中文解析备注（可选，默认做题隐藏）</label>
              <textarea
                rows={2}
                value={explanationZh}
                onChange={(e) => setExplanationZh(e.target.value)}
                placeholder="可选：填写中文核心提示"
                className="mt-1 w-full rounded-lg border border-white/12 bg-[#111113] px-2.5 py-1.5 text-xs text-[#F8F7F4] placeholder:text-[#F8F7F4]/30 focus:border-[#E0A458] focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <select
              value={session}
              onChange={(e) => setSession(e.target.value as ExamSession)}
              className="rounded-lg border border-white/12 bg-[#111113] px-2 py-1.5 text-xs text-[#F8F7F4]"
            >
              <option value="F/M">Feb/Mar</option>
              <option value="M/J">May/June</option>
              <option value="O/N">Oct/Nov</option>
            </select>
            <select
              value={paperNumber}
              onChange={(e) => setPaperNumber(Number(e.target.value) as 1 | 2 | 4)}
              className="rounded-lg border border-white/12 bg-[#111113] px-2 py-1.5 text-xs text-[#F8F7F4]"
            >
              <option value={1}>Paper 1</option>
              <option value={2}>Paper 2</option>
              <option value={4}>Paper 4</option>
            </select>
          </div>

          <button
            type="button"
            onClick={handleSaveClippedQuestion}
            disabled={!qpPreviewUrl || saving}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#E0A458] px-4 py-2.5 text-xs font-semibold text-[#111113] hover:bg-[#EBB66E] disabled:opacity-35"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            保存原卷截图真题到题库
          </button>
        </div>
      </div>
    </div>
  );
}
