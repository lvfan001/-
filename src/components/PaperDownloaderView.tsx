import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  Download,
  ExternalLink,
  Eye,
  FileText,
  FolderDown,
  Loader2,
  RefreshCw,
  X,
} from 'lucide-react';
import type { ExamSession } from '../types/chemistry.ts';

interface ScrapedSessionEntry {
  year: number;
  sessionCode: ExamSession;
  sessionLabel: string;
  slug: string;
  pageUrl: string;
}

interface ScrapedYearGroup {
  year: number;
  sessions: ScrapedSessionEntry[];
}

interface ScrapedPdfFile {
  fileName: string;
  remoteUrl: string;
  kind: 'qp' | 'ms' | 'ci' | 'er' | 'gt' | 'other';
}

interface ScrapedPaperVariant {
  paperNumber: 1 | 2 | 3 | 4 | 5;
  variant: number;
  componentCode: string;
  paperCode: string;
  qp?: ScrapedPdfFile;
  ms?: ScrapedPdfFile;
  ci?: ScrapedPdfFile;
}

interface ScrapedPaperGroup {
  paperNumber: 1 | 2 | 3 | 4 | 5;
  paperLabel: string;
  paperLabelZh: string;
  variants: ScrapedPaperVariant[];
}

interface ScrapedSessionData {
  year: number;
  sessionCode: ExamSession;
  sessionLabel: string;
  slug: string;
  pageUrl: string;
  scrapedAt: string;
  totalPdfCount: number;
  papers: ScrapedPaperGroup[];
  extras: ScrapedPdfFile[];
}

const EXTRA_LABEL_MAP: Record<string, string> = {
  gt: 'Grade Thresholds (分数线)',
  er: 'Examiner Report (考官报告)',
  other: 'Session Document (考季附件)',
};

export function PaperDownloaderView() {
  const [yearGroups, setYearGroups] = useState<ScrapedYearGroup[]>([]);
  const [loadingYears, setLoadingYears] = useState(true);
  const [showAllYears, setShowAllYears] = useState(false);

  const [selectedYear, setSelectedYear] = useState<number>(2026);
  const [selectedSlug, setSelectedSlug] = useState<string>('');
  const [selectedPaper, setSelectedPaper] = useState<1 | 2 | 3 | 4 | 5 | 'ALL'>(4);
  const [selectedComponent, setSelectedComponent] = useState<string | 'ALL'>('ALL');

  const [sessionData, setSessionData] = useState<ScrapedSessionData | null>(null);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [downloadingFiles, setDownloadingFiles] = useState<Record<string, boolean>>({});
  const [previewFile, setPreviewFile] = useState<string | null>(null);
  const [statusBanner, setStatusBanner] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  async function loadYears(refresh = false) {
    setLoadingYears(true);
    setStatusBanner(null);
    try {
      const resp = await fetch(`/api/papers/sessions${refresh ? '?refresh=1' : ''}`);
      const data = await resp.json();
      if (!resp.ok) {
        throw new Error(data.error || '无法加载真题年份目录');
      }
      const groups = (data.years ?? []) as ScrapedYearGroup[];
      setYearGroups(groups);

      if (groups.length > 0) {
        const preferredYear = groups.find((g) => g.year === selectedYear) ?? groups[0];
        setSelectedYear(preferredYear.year);
        const preferredSess =
          preferredYear.sessions.find((s) => s.sessionCode === 'M/J') ??
          preferredYear.sessions[0];
        if (preferredSess) {
          setSelectedSlug(preferredSess.slug);
        }
      }
    } catch (err) {
      setStatusBanner({
        type: 'error',
        text: err instanceof Error ? err.message : '抓取年份列表失败，请稍后重试。',
      });
    } finally {
      setLoadingYears(false);
    }
  }

  useEffect(() => {
    loadYears(false);
  }, []);

  const visibleYearGroups = useMemo(() => {
    if (showAllYears) return yearGroups;
    const recent = yearGroups.filter((g) => g.year >= 2021);
    return recent.length > 0 ? recent : yearGroups;
  }, [yearGroups, showAllYears]);

  const currentYearGroup = useMemo(
    () => yearGroups.find((g) => g.year === selectedYear) ?? yearGroups[0],
    [yearGroups, selectedYear]
  );

  const currentSessions = currentYearGroup?.sessions ?? [];

  async function loadSessionFiles(slug: string, refresh = false) {
    if (!slug) return;
    setLoadingFiles(true);
    setStatusBanner(null);
    try {
      const resp = await fetch(
        `/api/papers/session-files?slug=${encodeURIComponent(slug)}${refresh ? '&refresh=1' : ''}`
      );
      const data = await resp.json();
      if (!resp.ok) {
        throw new Error(data.error || '抓取该考季试卷列表失败');
      }
      setSessionData(data as ScrapedSessionData);
      setSelectedComponent('ALL');
    } catch (err) {
      setSessionData(null);
      setStatusBanner({
        type: 'error',
        text: err instanceof Error ? err.message : '抓取试卷列表失败，请刷新重试。',
      });
    } finally {
      setLoadingFiles(false);
    }
  }

  useEffect(() => {
    if (selectedSlug) {
      loadSessionFiles(selectedSlug, false);
    }
  }, [selectedSlug]);

  function handleSelectYear(year: number) {
    setSelectedYear(year);
    const grp = yearGroups.find((g) => g.year === year);
    if (grp && grp.sessions.length > 0) {
      const currentSessCode = currentSessions.find((s) => s.slug === selectedSlug)?.sessionCode;
      const nextSess =
        grp.sessions.find((s) => s.sessionCode === currentSessCode) ??
        grp.sessions.find((s) => s.sessionCode === 'M/J') ??
        grp.sessions[0];
      setSelectedSlug(nextSess.slug);
    }
    setSelectedComponent('ALL');
  }

  function handleSelectSession(slug: string) {
    setSelectedSlug(slug);
    setSelectedComponent('ALL');
  }

  function handleSelectPaper(p: 1 | 2 | 3 | 4 | 5 | 'ALL') {
    setSelectedPaper(p);
    setSelectedComponent('ALL');
  }

  const activePaperGroup = useMemo(() => {
    if (!sessionData || selectedPaper === 'ALL') return null;
    return sessionData.papers.find((p) => p.paperNumber === selectedPaper) ?? null;
  }, [sessionData, selectedPaper]);

  const displayedGroups = useMemo(() => {
    if (!sessionData) return [];
    const groups =
      selectedPaper === 'ALL'
        ? sessionData.papers.filter((p) => p.variants.length > 0)
        : sessionData.papers.filter((p) => p.paperNumber === selectedPaper);

    if (selectedPaper !== 'ALL' && selectedComponent !== 'ALL') {
      return groups.map((g) => ({
        ...g,
        variants: g.variants.filter((v) => v.componentCode === selectedComponent),
      }));
    }
    return groups;
  }, [sessionData, selectedPaper, selectedComponent]);

  async function triggerSingleDownload(fileName: string): Promise<boolean> {
    setDownloadingFiles((prev) => ({ ...prev, [fileName]: true }));
    try {
      const resp = await fetch(`/api/papers/download-file?file=${encodeURIComponent(fileName)}`);
      if (!resp.ok) {
        let errMsg = `下载失败 (${resp.status})`;
        try {
          const data = await resp.json();
          if (data.error) errMsg = data.error;
        } catch {
          // ignore
        }
        throw new Error(errMsg);
      }
      const blob = await resp.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(blobUrl), 15000);
      return true;
    } catch (err) {
      setStatusBanner({
        type: 'error',
        text: `${fileName} 下载失败：${err instanceof Error ? err.message : '未知错误'}`,
      });
      return false;
    } finally {
      setDownloadingFiles((prev) => ({ ...prev, [fileName]: false }));
    }
  }

  async function handleDownloadPair(variant: ScrapedPaperVariant) {
    setStatusBanner(null);
    const files = [variant.qp?.fileName, variant.ms?.fileName].filter((f): f is string => Boolean(f));
    if (files.length === 0) return;

    let okCount = 0;
    for (const fileName of files) {
      const ok = await triggerSingleDownload(fileName);
      if (ok) okCount += 1;
    }
    if (okCount === files.length) {
      setStatusBanner({
        type: 'success',
        text: `已成功下载 ${variant.paperCode} 的 ${files.join(' 与 ')}。`,
      });
    }
  }

  const activeSessionMeta = currentSessions.find((s) => s.slug === selectedSlug);

  return (
    <div className="space-y-7">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 border-b border-white/10 pb-5 sm:flex-row sm:items-end">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-[#F8F7F4]/50">
            MODULE 05 · LIVE PAST PAPER SCRAPER &amp; PDF DOWNLOADER
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-[#F8F7F4]">
            CAIE 9701 历年真题与评分标准下载
          </h1>
          <p className="mt-1.5 text-sm text-[#F8F7F4]/65">
            按「年份 → 考季 → Paper 1–5 → 对应套卷」层级实时抓取真题网页，支持一键下载原卷 Question Paper (QP) 与评分标准 Mark Scheme (MS) PDF。
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          {sessionData?.pageUrl && (
            <a
              href={sessionData.pageUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-[#18181A] px-3.5 py-2 text-xs font-medium text-[#F8F7F4]/85 transition-colors hover:border-[#E0A458]/60 hover:text-[#E0A458] whitespace-nowrap shrink-0"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              来源网页
            </a>
          )}
          <button
            type="button"
            onClick={() => {
              if (selectedSlug) loadSessionFiles(selectedSlug, true);
              else loadYears(true);
            }}
            disabled={loadingYears || loadingFiles}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-[#18181A] px-3.5 py-2 text-xs font-medium text-[#F8F7F4]/85 transition-colors hover:border-[#E0A458]/60 hover:text-[#E0A458] disabled:opacity-45 whitespace-nowrap shrink-0"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loadingFiles ? 'animate-spin' : ''}`} />
            重新抓取当前网页
          </button>
        </div>
      </div>

      {statusBanner && (
        <div
          className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-sm ${
            statusBanner.type === 'success'
              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
              : 'border-red-500/30 bg-red-500/10 text-red-300'
          }`}
        >
          {statusBanner.type === 'success' ? (
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          ) : (
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          )}
          <span>{statusBanner.text}</span>
        </div>
      )}

      {/* 4-Level Hierarchical Selector */}
      <section className="rounded-xl border border-white/10 bg-[#18181A] p-5 sm:p-6 space-y-5">
        {/* Live Breadcrumb */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.07] pb-4">
          <div className="flex flex-wrap items-center gap-1.5 font-mono text-xs text-[#F8F7F4]/70">
            <span className="text-[#F8F7F4]/45 uppercase tracking-wider">当前层级：</span>
            <span className="rounded bg-[#111113] px-2 py-0.5 font-semibold text-[#E0A458]">
              {selectedYear}
            </span>
            <ChevronRight className="h-3.5 w-3.5 text-[#F8F7F4]/35" />
            <span className="rounded bg-[#111113] px-2 py-0.5 font-semibold text-[#F8F7F4]">
              {activeSessionMeta?.sessionLabel ?? '—'}
            </span>
            <ChevronRight className="h-3.5 w-3.5 text-[#F8F7F4]/35" />
            <span className="rounded bg-[#111113] px-2 py-0.5 font-semibold text-[#F8F7F4]">
              {selectedPaper === 'ALL' ? '全部 Paper (P1–P5)' : `Paper ${selectedPaper}`}
            </span>
            {selectedPaper !== 'ALL' && (
              <>
                <ChevronRight className="h-3.5 w-3.5 text-[#F8F7F4]/35" />
                <span className="rounded bg-[#111113] px-2 py-0.5 font-semibold text-[#F8F7F4]/85">
                  {selectedComponent === 'ALL'
                    ? `全部套卷 (${activePaperGroup?.variants.length ?? 0})`
                    : `套卷 ${selectedComponent.slice(-1)} (${selectedComponent})`}
                </span>
              </>
            )}
          </div>

          {sessionData && (
            <span className="font-mono text-[11px] text-[#F8F7F4]/45 tabular-nums">
              已抓取 {sessionData.totalPdfCount} 个原卷 PDF 链接
            </span>
          )}
        </div>

        {loadingYears ? (
          <div className="flex items-center gap-2 py-6 text-sm text-[#F8F7F4]/55">
            <Loader2 className="h-4 w-4 animate-spin text-[#E0A458]" />
            正在从真题网页抓取年份与考季索引...
          </div>
        ) : (
          <div className="space-y-4">
            {/* Level 1: Year */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-[#F8F7F4]/50">
                  1 · 选择年份 (Year)
                </span>
                {yearGroups.some((g) => g.year < 2021) && (
                  <button
                    type="button"
                    onClick={() => setShowAllYears((v) => !v)}
                    className="font-mono text-[11px] text-[#E0A458] hover:underline"
                  >
                    {showAllYears ? '仅显示 2021–2026' : '展开更早年份 (2016–2020)'}
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {visibleYearGroups.map((grp) => {
                  const active = grp.year === selectedYear;
                  return (
                    <button
                      key={grp.year}
                      type="button"
                      onClick={() => handleSelectYear(grp.year)}
                      className={`rounded-lg border px-3.5 py-2 font-mono text-xs font-semibold transition-colors tabular-nums ${
                        active
                          ? 'border-[#E0A458] bg-[#E0A458] text-[#111113]'
                          : 'border-white/12 bg-[#111113] text-[#F8F7F4]/80 hover:border-white/30 hover:text-[#F8F7F4]'
                      }`}
                    >
                      {grp.year}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Level 2: Session */}
            <div>
              <div className="mb-2 font-mono text-[11px] uppercase tracking-[0.14em] text-[#F8F7F4]/50">
                2 · 选择考季 (Session)
              </div>
              <div className="flex flex-wrap gap-2">
                {currentSessions.map((sess) => {
                  const active = sess.slug === selectedSlug;
                  return (
                    <button
                      key={sess.slug}
                      type="button"
                      onClick={() => handleSelectSession(sess.slug)}
                      className={`inline-flex items-center gap-2 rounded-lg border px-3.5 py-2 text-xs font-medium transition-colors ${
                        active
                          ? 'border-[#E0A458] bg-[#E0A458]/15 text-[#E0A458] font-semibold'
                          : 'border-white/12 bg-[#111113] text-[#F8F7F4]/75 hover:border-white/30 hover:text-[#F8F7F4]'
                      }`}
                    >
                      <span>{sess.sessionLabel}</span>
                      <span className="font-mono text-[11px] opacity-65">({sess.sessionCode})</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Level 3: Paper 1-5 */}
            <div>
              <div className="mb-2 font-mono text-[11px] uppercase tracking-[0.14em] text-[#F8F7F4]/50">
                3 · 选择卷别 (Paper 1 / 2 / 3 / 4 / 5)
              </div>
              <div className="flex flex-wrap gap-2">
                {([1, 2, 3, 4, 5] as const).map((pNum) => {
                  const group = sessionData?.papers.find((g) => g.paperNumber === pNum);
                  const count = group?.variants.length ?? 0;
                  const active = selectedPaper === pNum;
                  return (
                    <button
                      key={pNum}
                      type="button"
                      onClick={() => handleSelectPaper(pNum)}
                      className={`inline-flex items-center gap-2 rounded-lg border px-3.5 py-2 text-xs font-medium transition-colors ${
                        active
                          ? 'border-[#E0A458] bg-[#E0A458]/15 text-[#E0A458] font-semibold'
                          : 'border-white/12 bg-[#111113] text-[#F8F7F4]/75 hover:border-white/30 hover:text-[#F8F7F4]'
                      }`}
                    >
                      <span className="font-mono font-bold">P{pNum}</span>
                      <span className="text-[#F8F7F4]/60">
                        {pNum === 1
                          ? 'AS 选择'
                          : pNum === 2
                            ? 'AS 简答'
                            : pNum === 3
                              ? '实验操作'
                              : pNum === 4
                                ? 'A2 简答'
                                : 'A2 实验设计'}
                      </span>
                      {sessionData && (
                        <span className="rounded bg-white/[0.06] px-1.5 py-0.5 font-mono text-[10px] text-[#F8F7F4]/65 tabular-nums">
                          {count} 套
                        </span>
                      )}
                    </button>
                  );
                })}

                <button
                  type="button"
                  onClick={() => handleSelectPaper('ALL')}
                  className={`inline-flex items-center gap-1.5 rounded-lg border px-3.5 py-2 text-xs font-medium transition-colors ${
                    selectedPaper === 'ALL'
                      ? 'border-[#E0A458] bg-[#E0A458]/15 text-[#E0A458] font-semibold'
                      : 'border-white/12 bg-[#111113] text-[#F8F7F4]/75 hover:border-white/30 hover:text-[#F8F7F4]'
                  }`}
                >
                  <span>查看全部 P1–P5</span>
                </button>
              </div>
            </div>

            {/* Level 4: Specific Variant (套卷 1/2/3/4...) */}
            {selectedPaper !== 'ALL' && activePaperGroup && activePaperGroup.variants.length > 0 && (
              <div>
                <div className="mb-2 font-mono text-[11px] uppercase tracking-[0.14em] text-[#F8F7F4]/50">
                  4 · 选择对应套卷 (Variant / 套卷)
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedComponent('ALL')}
                    className={`rounded-lg border px-3 py-1.5 font-mono text-xs font-medium transition-colors ${
                      selectedComponent === 'ALL'
                        ? 'border-[#E0A458] bg-[#E0A458] text-[#111113] font-semibold'
                        : 'border-white/12 bg-[#111113] text-[#F8F7F4]/75 hover:border-white/30'
                    }`}
                  >
                    全部套卷 ({activePaperGroup.variants.length})
                  </button>
                  {activePaperGroup.variants.map((v) => {
                    const active = selectedComponent === v.componentCode;
                    return (
                      <button
                        key={v.componentCode}
                        type="button"
                        onClick={() => setSelectedComponent(v.componentCode)}
                        className={`rounded-lg border px-3 py-1.5 font-mono text-xs font-medium transition-colors tabular-nums ${
                          active
                            ? 'border-[#E0A458] bg-[#E0A458] text-[#111113] font-semibold'
                            : 'border-white/12 bg-[#111113] text-[#F8F7F4]/80 hover:border-white/30'
                        }`}
                      >
                        套卷 {v.variant} ({v.componentCode})
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      {/* Scraped Paper Variants & 1-Click QP / MS Download Cards */}
      <section className="space-y-5">
        {loadingFiles ? (
          <div className="flex items-center justify-center gap-2.5 rounded-xl border border-white/10 bg-[#18181A] py-16 text-sm text-[#F8F7F4]/60">
            <Loader2 className="h-5 w-5 animate-spin text-[#E0A458]" />
            正在实时抓取 {selectedYear} · {activeSessionMeta?.sessionLabel} 真题网页目录...
          </div>
        ) : displayedGroups.length === 0 || displayedGroups.every((g) => g.variants.length === 0) ? (
          <div className="rounded-xl border border-white/10 bg-[#18181A] p-10 text-center text-sm text-[#F8F7F4]/55">
            当前考季的 Paper {selectedPaper === 'ALL' ? '1–5' : selectedPaper} 暂无可抓取的 PDF 套卷，请切换其他考季或 Paper。
          </div>
        ) : (
          displayedGroups.map((group) => {
            if (group.variants.length === 0) return null;
            return (
              <div
                key={group.paperNumber}
                className="rounded-xl border border-white/10 bg-[#18181A] overflow-hidden"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.08] bg-[#141416] px-5 py-3.5">
                  <div className="flex items-center gap-2.5">
                    <span className="rounded bg-[#E0A458]/15 px-2 py-0.5 font-mono text-xs font-bold text-[#E0A458]">
                      Paper {group.paperNumber}
                    </span>
                    <span className="text-sm font-semibold text-[#F8F7F4]">
                      {group.paperLabel}
                    </span>
                    <span className="text-xs text-[#F8F7F4]/50">· {group.paperLabelZh}</span>
                  </div>
                  <span className="font-mono text-xs text-[#F8F7F4]/45 tabular-nums">
                    共 {group.variants.length} 套真题
                  </span>
                </div>

                <div className="divide-y divide-white/[0.06]">
                  {group.variants.map((variant) => {
                    const qpBusy = variant.qp ? Boolean(downloadingFiles[variant.qp.fileName]) : false;
                    const msBusy = variant.ms ? Boolean(downloadingFiles[variant.ms.fileName]) : false;
                    const ciBusy = variant.ci ? Boolean(downloadingFiles[variant.ci.fileName]) : false;
                    const pairBusy = qpBusy || msBusy;

                    return (
                      <div
                        key={variant.componentCode}
                        className="flex flex-col justify-between gap-4 px-5 py-4 transition-colors hover:bg-white/[0.02] md:flex-row md:items-center"
                      >
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2.5">
                            <span className="font-mono text-sm font-bold text-[#F8F7F4] tabular-nums">
                              {variant.paperCode}
                            </span>
                            <span className="rounded border border-white/12 bg-[#111113] px-2 py-0.5 font-mono text-[11px] text-[#E0A458] tabular-nums">
                              套卷 {variant.variant} · {variant.componentCode}
                            </span>
                          </div>
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[11px] text-[#F8F7F4]/50">
                            <span>QP: {variant.qp ? variant.qp.fileName : '未发布'}</span>
                            <span>MS: {variant.ms ? variant.ms.fileName : '未发布'}</span>
                            {variant.ci && <span>CI: {variant.ci.fileName}</span>}
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 shrink-0">
                          {variant.qp && (
                            <>
                              <button
                                type="button"
                                onClick={() => setPreviewFile(variant.qp!.fileName)}
                                className="inline-flex items-center gap-1.5 rounded-lg border border-white/12 bg-[#111113] px-2.5 py-2 text-xs font-medium text-[#F8F7F4]/75 transition-colors hover:border-white/30 hover:text-[#F8F7F4]"
                                title="在线预览 QP 原卷"
                              >
                                <Eye className="h-3.5 w-3.5" />
                                预览
                              </button>
                              <button
                                type="button"
                                disabled={qpBusy}
                                onClick={() => triggerSingleDownload(variant.qp!.fileName)}
                                className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-[#111113] px-3 py-2 text-xs font-semibold text-[#F8F7F4] transition-colors hover:border-[#E0A458] hover:text-[#E0A458] disabled:opacity-50 whitespace-nowrap"
                              >
                                {qpBusy ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <Download className="h-3.5 w-3.5" />
                                )}
                                下载 QP
                              </button>
                            </>
                          )}

                          {variant.ms && (
                            <button
                              type="button"
                              disabled={msBusy}
                              onClick={() => triggerSingleDownload(variant.ms!.fileName)}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-[#111113] px-3 py-2 text-xs font-semibold text-[#F8F7F4] transition-colors hover:border-emerald-400 hover:text-emerald-300 disabled:opacity-50 whitespace-nowrap"
                            >
                              {msBusy ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <FileText className="h-3.5 w-3.5" />
                              )}
                              下载 MS
                            </button>
                          )}

                          {variant.ci && (
                            <button
                              type="button"
                              disabled={ciBusy}
                              onClick={() => triggerSingleDownload(variant.ci!.fileName)}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-[#111113] px-3 py-2 text-xs font-medium text-[#F8F7F4]/85 transition-colors hover:border-white/35 disabled:opacity-50 whitespace-nowrap"
                            >
                              {ciBusy ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Download className="h-3.5 w-3.5" />
                              )}
                              下载 CI
                            </button>
                          )}

                          {variant.qp && variant.ms && (
                            <button
                              type="button"
                              disabled={pairBusy}
                              onClick={() => handleDownloadPair(variant)}
                              className="inline-flex items-center gap-1.5 rounded-lg bg-[#E0A458] px-3.5 py-2 text-xs font-bold text-[#111113] transition-colors hover:bg-[#EBB66E] disabled:opacity-50 whitespace-nowrap"
                            >
                              {pairBusy ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <FolderDown className="h-3.5 w-3.5" />
                              )}
                              一键下载 QP + MS
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}

        {/* Session Extras (Grade Thresholds / Examiner Report) */}
        {sessionData && sessionData.extras.length > 0 && (
          <div className="rounded-xl border border-white/10 bg-[#18181A] p-5">
            <div className="mb-3 font-mono text-[11px] uppercase tracking-[0.14em] text-[#F8F7F4]/50">
              同考季官方参考文件 (Grade Thresholds &amp; Examiner Report)
            </div>
            <div className="flex flex-wrap gap-2.5">
              {sessionData.extras.map((extra) => {
                const busy = Boolean(downloadingFiles[extra.fileName]);
                return (
                  <button
                    key={extra.fileName}
                    type="button"
                    disabled={busy}
                    onClick={() => triggerSingleDownload(extra.fileName)}
                    className="inline-flex items-center gap-2 rounded-lg border border-white/12 bg-[#111113] px-3.5 py-2 text-xs font-medium text-[#F8F7F4]/85 transition-colors hover:border-[#E0A458] hover:text-[#E0A458] disabled:opacity-50"
                  >
                    {busy ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Download className="h-3.5 w-3.5" />
                    )}
                    <span>{EXTRA_LABEL_MAP[extra.kind] ?? extra.fileName}</span>
                    <span className="font-mono text-[11px] text-[#F8F7F4]/45">
                      {extra.fileName}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </section>

      {/* Inline PDF Preview Modal */}
      {previewFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-xs">
          <div className="flex h-[88vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-white/15 bg-[#141416]">
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
              <div className="flex items-center gap-3">
                <span className="font-mono text-xs font-bold text-[#E0A458]">{previewFile}</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => triggerSingleDownload(previewFile)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#E0A458] px-3 py-1.5 text-xs font-semibold text-[#111113] hover:bg-[#EBB66E]"
                >
                  <Download className="h-3.5 w-3.5" />
                  下载该 PDF
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewFile(null)}
                  className="rounded-lg border border-white/12 p-1.5 text-[#F8F7F4]/70 hover:text-[#F8F7F4]"
                  aria-label="关闭预览"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
            <iframe
              title={previewFile}
              src={`/api/papers/download-file?file=${encodeURIComponent(previewFile)}&inline=1`}
              className="h-full w-full flex-1 bg-white"
            />
          </div>
        </div>
      )}
    </div>
  );
}
