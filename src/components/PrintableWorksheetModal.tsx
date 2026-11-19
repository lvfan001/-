import React, { useMemo, useRef, useState } from 'react';
import { Download, Printer, X } from 'lucide-react';
import type { Question } from '../types/chemistry.ts';
import { buildPrintableWorksheetHtml } from '../utils/studyTools.ts';

interface PrintableWorksheetModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle: string;
  questions: Question[];
}

export function PrintableWorksheetModal({
  isOpen,
  onClose,
  title,
  subtitle,
  questions,
}: PrintableWorksheetModalProps) {
  const [includeMs, setIncludeMs] = useState(true);
  const [separateMsPage, setSeparateMsPage] = useState(true);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  const htmlDoc = useMemo(() => {
    if (!isOpen) return '';
    const originUrl = typeof window !== 'undefined' ? window.location.origin : '';
    return buildPrintableWorksheetHtml(title, subtitle, questions, {
      includeMs,
      separateMsPage,
      originUrl,
    });
  }, [isOpen, title, subtitle, questions, includeMs, separateMsPage]);

  if (!isOpen) return null;

  function handlePrint() {
    iframeRef.current?.contentWindow?.focus();
    iframeRef.current?.contentWindow?.print();
  }

  function handleDownloadHtml() {
    const blob = new Blob([htmlDoc], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title.replace(/[^\w\u4e00-\u9fa5-]+/g, '_')}.html`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 10000);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-black/90 p-3 backdrop-blur-xs sm:p-6"
      onClick={onClose}
    >
      <div
        className="mx-auto flex h-full w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-white/15 bg-[#18181A]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#E0A458]">
              PRINTABLE WORKSHEET / PDF EXPORT
            </div>
            <div className="text-sm font-semibold text-[#F8F7F4]">
              {title}（共 {questions.length} 题）
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs text-[#F8F7F4]/80">
              <input
                type="checkbox"
                checked={includeMs}
                onChange={(e) => setIncludeMs(e.target.checked)}
                className="accent-[#E0A458]"
              />
              附带官方 MS 答案卷
            </label>
            {includeMs && (
              <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs text-[#F8F7F4]/70">
                <input
                  type="checkbox"
                  checked={separateMsPage}
                  onChange={(e) => setSeparateMsPage(e.target.checked)}
                  className="accent-[#E0A458]"
                />
                答案另起一页
              </label>
            )}
            <button
              type="button"
              onClick={handleDownloadHtml}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-[#141416] px-3 py-1.5 text-xs font-medium text-[#F8F7F4]/85 hover:border-[#E0A458] hover:text-[#E0A458]"
            >
              <Download className="h-3.5 w-3.5" />
              导出离线试卷
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#E0A458] px-3.5 py-1.5 text-xs font-semibold text-[#111113] hover:bg-[#EBB66E]"
            >
              <Printer className="h-3.5 w-3.5" />
              打印 / 另存为 PDF
            </button>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center gap-1 rounded-lg border border-white/15 bg-[#141416] px-2.5 py-1.5 text-xs text-[#F8F7F4]/75 hover:text-[#F8F7F4]"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        <iframe
          ref={iframeRef}
          srcDoc={htmlDoc}
          title={title}
          className="h-full w-full bg-white"
        />
      </div>
    </div>
  );
}
