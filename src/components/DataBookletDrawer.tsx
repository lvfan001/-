import React, { useMemo, useState } from 'react';
import { BookOpen, Search, X } from 'lucide-react';
import {
  CNMR_SHIFTS,
  ELECTRODE_POTENTIALS,
  HNMR_SHIFTS,
  IR_ABSORPTION_TABLE,
  PERIODIC_ELEMENTS,
} from '../data/dataBooklet.ts';

interface DataBookletDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

type BookletTab = 'periodic' | 'ir' | 'nmr' | 'electrode';

export function DataBookletDrawer({ isOpen, onClose }: DataBookletDrawerProps) {
  const [tab, setTab] = useState<BookletTab>('periodic');
  const [query, setQuery] = useState('');

  const filteredElements = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return PERIODIC_ELEMENTS;
    return PERIODIC_ELEMENTS.filter(
      (el) =>
        el.symbol.toLowerCase().includes(q) ||
        el.name.toLowerCase().includes(q) ||
        String(el.z) === q ||
        el.ar.includes(q)
    );
  }, [query]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/75 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        className="flex h-full w-full max-w-2xl flex-col border-l border-white/15 bg-[#141416] text-[#F8F7F4] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-white/10 px-5 py-4">
          <div className="flex items-center gap-2.5">
            <BookOpen className="h-4 w-4 text-[#E0A458]" />
            <div>
              <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#E0A458]">
                CAIE 9701 DATA BOOKLET
              </div>
              <h2 className="text-sm font-semibold text-[#F8F7F4]">
                考纲高频速查手册（周期表 / IR / NMR / 电极电势）
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-1 rounded-lg border border-white/15 bg-[#18181A] px-2.5 py-1.5 text-xs text-[#F8F7F4]/80 hover:border-[#E0A458] hover:text-[#E0A458]"
          >
            <X className="h-3.5 w-3.5" />
            关闭
          </button>
        </div>

        <div className="flex flex-wrap gap-1.5 border-b border-white/10 bg-[#111113] px-5 py-2.5">
          {(
            [
              { id: 'periodic', label: '周期表 & Ar' },
              { id: 'ir', label: 'IR 红外波数' },
              { id: 'nmr', label: '¹H / ¹³C NMR' },
              { id: 'electrode', label: '标准电极电势 E°' },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={`rounded-lg px-3 py-1.5 font-mono text-xs font-medium transition-colors ${
                tab === item.id
                  ? 'bg-[#E0A458] font-semibold text-[#111113]'
                  : 'border border-white/10 bg-[#18181A] text-[#F8F7F4]/70 hover:text-[#F8F7F4]'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {tab === 'periodic' && (
            <div className="space-y-4">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-2.5 h-3.5 w-3.5 text-[#F8F7F4]/40" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="快速搜索元素符号、英文名或原子序数（如 Cl、Cu、26、35.5）..."
                  className="w-full rounded-lg border border-white/15 bg-[#18181A] py-2 pl-9 pr-3 text-xs text-[#F8F7F4] placeholder:text-[#F8F7F4]/35 focus:border-[#E0A458] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
                {filteredElements.map((el) => (
                  <div
                    key={el.z}
                    className="rounded-lg border border-white/10 bg-[#18181A] p-2.5 text-center"
                  >
                    <div className="flex items-center justify-between font-mono text-[10px] text-[#F8F7F4]/45">
                      <span>{el.z}</span>
                      <span>G{el.group}</span>
                    </div>
                    <div className="mt-0.5 font-mono text-lg font-bold text-[#F8F7F4]">
                      {el.symbol}
                    </div>
                    <div className="truncate text-[10px] text-[#F8F7F4]/55">{el.name}</div>
                    <div className="mt-1 font-mono text-xs font-semibold text-[#E0A458] tabular-nums">
                      Ar {el.ar}
                    </div>
                  </div>
                ))}
              </div>
              <p className="font-mono text-[11px] text-[#F8F7F4]/45">
                注：CAIE 9701 计算题相对原子质量统一采用官方 1 位小数标准（如 Cl = 35.5，Cu = 63.5，Fe = 55.8）。
              </p>
            </div>
          )}

          {tab === 'ir' && (
            <div className="space-y-3">
              <p className="text-xs text-[#F8F7F4]/60">
                Characteristic infrared absorption frequencies (CAIE 9701 Syllabus)：
              </p>
              <div className="overflow-hidden rounded-xl border border-white/10 bg-[#18181A]">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-white/10 bg-[#111113] font-mono text-[11px] text-[#F8F7F4]/55">
                    <tr>
                      <th className="px-3.5 py-2.5">化学键</th>
                      <th className="px-3.5 py-2.5">官能团</th>
                      <th className="px-3.5 py-2.5">波数范围</th>
                      <th className="px-3.5 py-2.5">峰形特征</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.06]">
                    {IR_ABSORPTION_TABLE.map((row, idx) => (
                      <tr key={idx} className="hover:bg-white/[0.02]">
                        <td className="px-3.5 py-2.5 font-mono font-semibold text-[#E0A458]">
                          {row.bond}
                        </td>
                        <td className="px-3.5 py-2.5 text-[#F8F7F4]/85">{row.groupZh}</td>
                        <td className="px-3.5 py-2.5 font-mono text-[#F8F7F4] tabular-nums">
                          {row.range}
                        </td>
                        <td className="px-3.5 py-2.5 text-[#F8F7F4]/65">{row.appearance}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {tab === 'nmr' && (
            <div className="space-y-5">
              <div>
                <h3 className="mb-2 font-mono text-xs font-semibold text-[#E0A458]">
                  ¹H NMR 化学位移 δ (ppm)
                </h3>
                <div className="overflow-hidden rounded-xl border border-white/10 bg-[#18181A]">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-white/10 bg-[#111113] font-mono text-[11px] text-[#F8F7F4]/55">
                      <tr>
                        <th className="px-3 py-2">氢环境</th>
                        <th className="px-3 py-2">δ (ppm)</th>
                        <th className="px-3 py-2">考场提示</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.06]">
                      {HNMR_SHIFTS.map((row, idx) => (
                        <tr key={idx}>
                          <td className="px-3 py-2 font-mono text-[#F8F7F4]">{row.env}</td>
                          <td className="px-3 py-2 font-mono font-semibold text-[#E0A458] tabular-nums whitespace-nowrap">
                            {row.shiftPpm}
                          </td>
                          <td className="px-3 py-2 text-[#F8F7F4]/65">{row.noteZh}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div>
                <h3 className="mb-2 font-mono text-xs font-semibold text-emerald-300">
                  ¹³C NMR 化学位移 δ (ppm)
                </h3>
                <div className="overflow-hidden rounded-xl border border-white/10 bg-[#18181A]">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-white/10 bg-[#111113] font-mono text-[11px] text-[#F8F7F4]/55">
                      <tr>
                        <th className="px-3 py-2">碳环境</th>
                        <th className="px-3 py-2">δ (ppm)</th>
                        <th className="px-3 py-2">说明</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.06]">
                      {CNMR_SHIFTS.map((row, idx) => (
                        <tr key={idx}>
                          <td className="px-3 py-2 font-mono text-[#F8F7F4]">{row.env}</td>
                          <td className="px-3 py-2 font-mono font-semibold text-emerald-300 tabular-nums whitespace-nowrap">
                            {row.shiftPpm}
                          </td>
                          <td className="px-3 py-2 text-[#F8F7F4]/65">{row.noteZh}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {tab === 'electrode' && (
            <div className="space-y-3">
              <p className="text-xs text-[#F8F7F4]/60">
                高频标准电极电势 E° (298 K, 1 mol dm⁻³)，越靠下氧化性越强（更容易发生还原反应）：
              </p>
              <div className="overflow-hidden rounded-xl border border-white/10 bg-[#18181A]">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-white/10 bg-[#111113] font-mono text-[11px] text-[#F8F7F4]/55">
                    <tr>
                      <th className="px-3.5 py-2.5">电极半反应 (Reduction)</th>
                      <th className="px-3.5 py-2.5 text-right">E° / V</th>
                      <th className="px-3.5 py-2.5">高频场景</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.06]">
                    {ELECTRODE_POTENTIALS.map((row, idx) => (
                      <tr key={idx} className="hover:bg-white/[0.02]">
                        <td className="px-3.5 py-2 font-mono text-[#F8F7F4]">{row.halfEquation}</td>
                        <td
                          className={`px-3.5 py-2 text-right font-mono font-semibold tabular-nums ${
                            row.eTheta.startsWith('-')
                              ? 'text-sky-300'
                              : row.eTheta === '0.00'
                                ? 'text-[#F8F7F4]'
                                : 'text-[#E0A458]'
                          }`}
                        >
                          {row.eTheta}
                        </td>
                        <td className="px-3.5 py-2 text-[#F8F7F4]/60">{row.noteZh || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
