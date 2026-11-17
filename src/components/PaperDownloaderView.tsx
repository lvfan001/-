import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  Download,
  ExternalLink,
  FileDown,
  FileUp,
  Globe,
  Loader2,
  Play,
  Scissors,
  Search,
} from 'lucide-react';
import type { DownloadedPaper, ExamSession, Question } from '../types/chemistry.ts';
import { getChapterById, resolveModuleForChapters, getModuleById } from '../data/syllabus.ts';
import { PdfClipperStudio } from './PdfClipperStudio.tsx';

interface CatalogPaper {
  paperCode: string;
  year: number;
  session: ExamSession;
  sessionLabel: string;
  paperNumber: 1 | 2 | 4;
  variant: 1 | 2 | 3;
  paperTypeLabel: string;
  defaultMirrorUrl: string;
  alternateSearchUrl: string;
}

interface PaperDownloaderViewProps {
  downloadedPapers: DownloadedPaper[];
  customQuestions: Question[];
  onPaperIngested: (paper: DownloadedPaper, questions: Question[]) => void;
  onSaveClippedQuestion: (question: Question) => void;
  onPracticeQuestions: (title: string, subtitle: string, questions: Question[]) => void;
}

export function PaperDownloaderView({
  downloadedPapers,
  customQuestions,
  onPaperIngested,
  onSaveClippedQuestion,
  onPracticeQuestions,
}: PaperDownloaderViewProps) {
  const [catalog, setCatalog] = useState<CatalogPaper[]>([]);
  const [loadingCatalog, setLoadingCatalog] = useState(true);

  const [yearFilter, setYearFilter] = useState<number | 'all'>(2025);
  const [sessionFilter, setSessionFilter] = useState<ExamSession | 'all'>('all');
  const [paperFilter, setPaperFilter] = useState<1 | 2 | 4 | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const [customUrl, setCustomUrl] = useState('');
  const [customPaperCode, setCustomPaperCode] = useState('9701/12/M/J/25');
  const [busyCode, setBusyCode] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  // Local PDF upload state
  const [uploadCode, setUploadCode] = useState('9701/22/M/J/24');
  const [uploadYear, setUploadYear] = useState(2024);
  const [uploadSession, setUploadSession] = useState<ExamSession>('M/J');
  const [uploadPaperNum, setUploadPaperNum] = useState<1 | 2 | 4>(2);
  const [qpFile, setQpFile] = useState<File | null>(null);
  const [msFile, setMsFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const [clipperTarget, setClipperTarget] = useState<
    | 'blank'
    | {
        paperId?: string;
        paperCode: string;
        year: number;
        session: ExamSession;
        paperNumber: 1 | 2 | 4;
      }
    | null
  >(null);

  useEffect(() => {
    let active = true;
    fetch('/api/papers/catalog')
      .then((r) => r.json())
      .then((data) => {
        if (active && Array.isArray(data.items)) {
          setCatalog(data.items);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoadingCatalog(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const filteredCatalog = catalog.filter((item) => {
    if (yearFilter !== 'all' && item.year !== yearFilter) return false;
    if (sessionFilter !== 'all' && item.session !== sessionFilter) return false;
    if (paperFilter !== 'all' && item.paperNumber !== paperFilter) return false;
    if (
      searchQuery.trim() &&
      !item.paperCode.toLowerCase().includes(searchQuery.trim().toLowerCase())
    ) {
      return false;
    }
    return true;
  });

  async function handleDownloadFromWeb(item: {
    url?: string;
    paperCode: string;
    year: number;
    session: ExamSession;
    paperNumber: 1 | 2 | 4;
    variant: 1 | 2 | 3;
  }) {
    setBusyCode(item.paperCode);
    setStatusMessage(null);
    try {
      const resp = await fetch('/api/papers/download-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item),
      });
      const data = await resp.json();
      if (!resp.ok) {
        setStatusMessage({
          type: 'error',
          text: data.error || '下载或解析真题失败，请尝试粘贴有效 PDF 链接或本地上传。',
        });
        return;
      }
      onPaperIngested(data.paper, data.questions ?? []);
      setStatusMessage({
        type: 'success',
        text: `${data.paper.paperCode} 已成功入库（提取 ${data.questions?.length ?? 0} 道真题并按 30 章节/模块归类）。`,
      });
    } catch (err) {
      setStatusMessage({
        type: 'error',
        text: `网络请求失败：${err instanceof Error ? err.message : '未知错误'}`,
      });
    } finally {
      setBusyCode(null);
    }
  }

  async function handleCustomUrlDownload(e: React.FormEvent) {
    e.preventDefault();
    if (!customUrl.trim()) return;
    const match = customPaperCode.match(/9701\/(\d)(\d)\/([A-Z/]+)\/(\d{2})/);
    const paperNum = (match ? Number(match[1]) : 1) as 1 | 2 | 4;
    const variant = (match ? Number(match[2]) : 2) as 1 | 2 | 3;
    const session = (match ? match[3] : 'M/J') as ExamSession;
    const year = match ? 2000 + Number(match[4]) : 2025;

    await handleDownloadFromWeb({
      url: customUrl.trim(),
      paperCode: customPaperCode.trim() || '9701/12/M/J/25',
      year,
      session,
      paperNumber: [1, 2, 4].includes(paperNum) ? paperNum : 1,
      variant: [1, 2, 3].includes(variant) ? variant : 2,
    });
  }

  function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error('文件读取失败'));
      reader.readAsDataURL(file);
    });
  }

  async function handleLocalPdfUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!qpFile) return;
    setUploading(true);
    setStatusMessage(null);
    try {
      const qpBase64 = await fileToBase64(qpFile);
      const msBase64 = msFile ? await fileToBase64(msFile) : undefined;
      const resp = await fetch('/api/papers/upload-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: qpFile.name,
          paperCode: uploadCode.trim(),
          year: uploadYear,
          session: uploadSession,
          paperNumber: uploadPaperNum,
          variant: 2,
          qpBase64,
          msBase64,
        }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        setStatusMessage({
          type: 'error',
          text: data.error || 'PDF 解析失败。',
        });
        return;
      }
      onPaperIngested(data.paper, data.questions ?? []);
      setQpFile(null);
      setMsFile(null);
      setStatusMessage({
        type: 'success',
        text: `本地真题 ${data.paper.paperCode} 解析完成，新增 ${data.questions?.length ?? 0} 道题目到章节与模块题库。`,
      });
    } catch (err) {
      setStatusMessage({
        type: 'error',
        text: `上传失败：${err instanceof Error ? err.message : '未知错误'}`,
      });
    } finally {
      setUploading(false);
    }
  }

  if (clipperTarget !== null) {
    return (
      <PdfClipperStudio
        initialPaper={clipperTarget === 'blank' ? null : clipperTarget}
        onClose={() => setClipperTarget(null)}
        onSaveClippedQuestion={onSaveClippedQuestion}
      />
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col justify-between gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-medium tracking-wide text-slate-500">
            2021–2026 CAIE 9701 PAST PAPER DOWNLOADER &amp; PARSER
          </p>
          <h1 className="mt-1.5 text-2xl font-semibold tracking-tight text-slate-900">
            网页端 A-Level 真题下载与截图切题中心
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            支持直连抓取 2021–2026 年真题 PDF 链接、AI 自动框选 + 手动截图切题（保留真实图表画面），或上传本地 QP/MS PDF 自动划分为 30 章节与模块练习。
          </p>
        </div>

        <button
          type="button"
          onClick={() => setClipperTarget('blank')}
          className="inline-flex items-center gap-2 rounded-lg bg-[#1D4ED8] px-4 py-2.5 text-xs font-medium text-white transition-colors hover:bg-[#1E40AF] whitespace-nowrap shrink-0"
        >
          <Scissors className="h-4 w-4" />
          打开 PDF 截图切题工作室
        </button>
      </div>

      {statusMessage && (
        <div
          className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-sm ${
            statusMessage.type === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
              : 'border-red-200 bg-red-50 text-red-900'
          }`}
        >
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{statusMessage.text}</span>
        </div>
      )}

      {/* Two-Column Top Input: Direct PDF URL Fetch + Local PDF Upload */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <form
          onSubmit={handleCustomUrlDownload}
          className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-6"
        >
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <Globe className="h-4 w-4 text-[#1D4ED8]" />
              方式一：输入真题网页 PDF 直链下载并解析
            </div>
            <p className="mt-1 text-xs text-slate-500">
              粘贴 PapaCambridge、GCE Guide 或学校资源库的 9701 PDF 链接，服务端将拉取原卷并自动按 30 章节归类。
            </p>
            <div className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-700">
                  真题试卷编号 (Paper Code)
                </label>
                <input
                  type="text"
                  value={customPaperCode}
                  onChange={(e) => setCustomPaperCode(e.target.value)}
                  placeholder="例如 9701/12/M/J/25"
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm text-slate-900 focus:border-[#1D4ED8] focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700">
                  真题 PDF 网址 (URL)
                </label>
                <input
                  type="url"
                  required
                  value={customUrl}
                  onChange={(e) => setCustomUrl(e.target.value)}
                  placeholder="https://.../9701_s25_qp_12.pdf"
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-[#1D4ED8] focus:outline-none"
                />
              </div>
            </div>
          </div>

          <div className="mt-5 flex items-center justify-end">
            <button
              type="submit"
              disabled={busyCode !== null}
              className="inline-flex items-center gap-2 rounded-lg bg-[#1D4ED8] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#1E40AF] disabled:opacity-50 whitespace-nowrap shrink-0"
            >
              {busyCode === customPaperCode ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              抓取并解析真题
            </button>
          </div>
        </form>

        <form
          onSubmit={handleLocalPdfUpload}
          className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-6"
        >
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <FileUp className="h-4 w-4 text-[#1D4ED8]" />
              方式二：导入本地真题 PDF（Question Paper + Mark Scheme）
            </div>
            <p className="mt-1 text-xs text-slate-500">
              若目标网站需要浏览器人机验证，可先下载 PDF 到本地再上传，系统自动提取题干与官方评分标准并归类章节。
            </p>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="col-span-2 sm:col-span-2">
                <label className="block text-xs font-medium text-slate-700">试卷编号</label>
                <input
                  type="text"
                  value={uploadCode}
                  onChange={(e) => setUploadCode(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-1.5 font-mono text-xs text-slate-900"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700">年份</label>
                <select
                  value={uploadYear}
                  onChange={(e) => setUploadYear(Number(e.target.value))}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs text-slate-900"
                >
                  {[2026, 2025, 2024, 2023, 2022, 2021].map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700">场次 / 卷别</label>
                <div className="mt-1 flex gap-1">
                  <select
                    value={uploadSession}
                    onChange={(e) => setUploadSession(e.target.value as ExamSession)}
                    className="w-1/2 rounded-lg border border-slate-200 px-1 py-1.5 text-xs text-slate-900"
                  >
                    <option value="F/M">F/M</option>
                    <option value="M/J">M/J</option>
                    <option value="O/N">O/N</option>
                  </select>
                  <select
                    value={uploadPaperNum}
                    onChange={(e) => setUploadPaperNum(Number(e.target.value) as 1 | 2 | 4)}
                    className="w-1/2 rounded-lg border border-slate-200 px-1 py-1.5 text-xs text-slate-900"
                  >
                    <option value={1}>P1</option>
                    <option value={2}>P2</option>
                    <option value={4}>P4</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="flex cursor-pointer flex-col rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-2.5 text-xs hover:border-[#1D4ED8]">
                <span className="font-medium text-slate-700">
                  {qpFile ? qpFile.name : '选择试题卷 (QP .pdf) *'}
                </span>
                <span className="mt-0.5 text-[11px] text-slate-400">必选，最大 20MB</span>
                <input
                  type="file"
                  accept="application/pdf"
                  className="hidden"
                  onChange={(e) => setQpFile(e.target.files?.[0] ?? null)}
                />
              </label>
              <label className="flex cursor-pointer flex-col rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-2.5 text-xs hover:border-[#1D4ED8]">
                <span className="font-medium text-slate-700">
                  {msFile ? msFile.name : '选择评分标准 (MS .pdf, 可选)'}
                </span>
                <span className="mt-0.5 text-[11px] text-slate-400">上传可提升答案精度</span>
                <input
                  type="file"
                  accept="application/pdf"
                  className="hidden"
                  onChange={(e) => setMsFile(e.target.files?.[0] ?? null)}
                />
              </label>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-end">
            <button
              type="submit"
              disabled={!qpFile || uploading}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-slate-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-800 disabled:opacity-40 whitespace-nowrap shrink-0"
            >
              {uploading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <FileUp className="h-4 w-4" />
              )}
              解析上传 PDF
            </button>
          </div>
        </form>
      </div>

      {/* Downloaded & Parsed Papers Library */}
      {downloadedPapers.length > 0 && (
        <section className="rounded-xl border border-slate-200 bg-white p-6">
          <h2 className="text-base font-semibold text-slate-900">
            已下载并入库的真题试卷 ({downloadedPapers.length})
          </h2>
          <div className="mt-4 divide-y divide-slate-100">
            {downloadedPapers.map((p) => {
              const paperQuestions = customQuestions.filter((q) => q.paperCode === p.paperCode);
              return (
                <div
                  key={p.id}
                  className="flex flex-col justify-between gap-3 py-3.5 sm:flex-row sm:items-center"
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-900">
                      <span className="font-mono">{p.paperCode}</span>
                      <span aria-hidden="true" className="text-slate-300">
                        ·
                      </span>
                      <span className="text-xs font-normal text-slate-500">
                        {p.sourceMethod === 'url-pdf'
                          ? '原卷 PDF 已抓取'
                          : p.sourceMethod === 'local-upload'
                            ? '本地 PDF 解析'
                            : '网页检索提取'}
                      </span>
                      <span aria-hidden="true" className="text-slate-300">
                        ·
                      </span>
                      <span className="font-mono text-xs font-normal text-slate-500 tabular-nums">
                        {p.questionCount} 道题
                      </span>
                    </div>
                    {p.note && <p className="mt-1 text-xs text-slate-600">{p.note}</p>}
                    {p.chaptersCovered.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap gap-x-2 gap-y-1 text-xs text-slate-500">
                        <span>覆盖章节：</span>
                        {p.chaptersCovered.map((chId) => {
                          const ch = getChapterById(chId);
                          return (
                            <span key={chId} className="font-mono text-slate-700">
                              {ch?.code ?? `Ch ${chId}`}
                            </span>
                          );
                        })}
                        {paperQuestions.some((q) => q.chapters.length >= 2) && (
                          <span className="text-[#1D4ED8]">
                            · 含跨章题（已自动归入{' '}
                            {getModuleById(
                              resolveModuleForChapters(
                                paperQuestions.find((q) => q.chapters.length >= 2)!.chapters
                              ) ?? ''
                            )?.code ?? '模块练习'}
                            ）
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    {p.hasPdfBlob && (
                      <>
                        <button
                          type="button"
                          onClick={() =>
                            setClipperTarget({
                              paperId: p.id,
                              paperCode: p.paperCode,
                              year: p.year,
                              session: p.session,
                              paperNumber: p.paperNumber,
                            })
                          }
                          className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50/70 px-3 py-1.5 text-xs font-medium text-[#1D4ED8] hover:bg-blue-100 whitespace-nowrap shrink-0"
                        >
                          <Scissors className="h-3.5 w-3.5" />
                          截图切题
                        </button>
                        <a
                          href={`/api/papers/pdf/${p.id}`}
                          download
                          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
                        >
                          <FileDown className="h-3.5 w-3.5" />
                          下载原卷 PDF
                        </a>
                      </>
                    )}
                    {p.groundingUrls?.[0] && (
                      <a
                        href={p.groundingUrls[0].uri}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        来源网页
                      </a>
                    )}
                    {paperQuestions.length > 0 && (
                      <button
                        onClick={() =>
                          onPracticeQuestions(
                            `${p.paperCode} 真题测验`,
                            `${p.year} ${p.session} · Paper ${p.paperNumber}`,
                            paperQuestions
                          )
                        }
                        className="inline-flex items-center gap-1.5 rounded-lg bg-[#1D4ED8] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#1E40AF] whitespace-nowrap shrink-0"
                      >
                        <Play className="h-3.5 w-3.5" />
                        开始做题
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* 2021-2026 Official CAIE 9701 Catalog Explorer */}
      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="flex flex-col justify-between gap-4 border-b border-slate-100 pb-4 lg:flex-row lg:items-center">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              2021–2026 CAIE 9701 历年真题目录索引
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              选择年份、考季与试卷类型，点击「网页抓取解析」即可尝试直连下载原卷或实时检索入库。
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="搜索卷号如 9701/12"
                className="w-40 rounded-lg border border-slate-200 py-1.5 pl-8 pr-2.5 text-xs text-slate-900 focus:border-[#1D4ED8] focus:outline-none"
              />
            </div>

            <select
              value={yearFilter}
              onChange={(e) =>
                setYearFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))
              }
              className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700"
            >
              <option value="all">2021–2026 全部年份</option>
              {[2026, 2025, 2024, 2023, 2022, 2021].map((y) => (
                <option key={y} value={y}>
                  {y} 年
                </option>
              ))}
            </select>

            <select
              value={sessionFilter}
              onChange={(e) =>
                setSessionFilter(e.target.value as ExamSession | 'all')
              }
              className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700"
            >
              <option value="all">全部考季</option>
              <option value="F/M">Feb / Mar</option>
              <option value="M/J">May / June</option>
              <option value="O/N">Oct / Nov</option>
            </select>

            <select
              value={paperFilter}
              onChange={(e) =>
                setPaperFilter(
                  e.target.value === 'all'
                    ? 'all'
                    : (Number(e.target.value) as 1 | 2 | 4)
                )
              }
              className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700"
            >
              <option value="all">全部 Paper</option>
              <option value={1}>Paper 1 (AS 选择)</option>
              <option value={2}>Paper 2 (AS 简答)</option>
              <option value={4}>Paper 4 (A2 简答)</option>
            </select>
          </div>
        </div>

        <div className="mt-4 overflow-x-auto">
          {loadingCatalog ? (
            <div className="py-10 text-center text-sm text-slate-500">
              正在加载 2021–2026 试卷目录...
            </div>
          ) : (
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs font-medium text-slate-500">
                  <th className="py-2.5 pr-4">试卷代码</th>
                  <th className="py-2.5 pr-4">年份 / 考季</th>
                  <th className="py-2.5 pr-4">试卷类型</th>
                  <th className="py-2.5 pr-4">外部镜像参考</th>
                  <th className="py-2.5 text-right">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredCatalog.slice(0, 36).map((item) => {
                  const isBusy = busyCode === item.paperCode;
                  const alreadyDownloaded = downloadedPapers.some(
                    (d) => d.paperCode === item.paperCode
                  );
                  return (
                    <tr key={item.paperCode} className="hover:bg-slate-50/70">
                      <td className="py-3 pr-4 font-mono text-xs font-semibold text-slate-900 tabular-nums">
                        {item.paperCode}
                      </td>
                      <td className="py-3 pr-4 text-xs text-slate-600 tabular-nums">
                        {item.year} · {item.sessionLabel}
                      </td>
                      <td className="py-3 pr-4 text-xs text-slate-700">
                        {item.paperTypeLabel}
                      </td>
                      <td className="py-3 pr-4">
                        <a
                          href={item.alternateSearchUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-[#1D4ED8]"
                        >
                          PapaCambridge
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </td>
                      <td className="py-3 text-right">
                        <button
                          onClick={() =>
                            handleDownloadFromWeb({
                              paperCode: item.paperCode,
                              year: item.year,
                              session: item.session,
                              paperNumber: item.paperNumber,
                              variant: item.variant,
                            })
                          }
                          disabled={busyCode !== null}
                          className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                            alreadyDownloaded
                              ? 'border border-emerald-200 bg-emerald-50 text-emerald-700'
                              : 'border border-slate-200 bg-white text-slate-800 hover:border-[#1D4ED8] hover:text-[#1D4ED8]'
                          }`}
                        >
                          {isBusy ? (
                            <>
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              下载解析中...
                            </>
                          ) : alreadyDownloaded ? (
                            <>
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              重新抓取更新
                            </>
                          ) : (
                            <>
                              <Download className="h-3.5 w-3.5" />
                              网页抓取解析
                            </>
                          )}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  );
}
