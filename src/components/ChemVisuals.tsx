import React, { useEffect, useState } from 'react';
import { Maximize2, X } from 'lucide-react';
import type { DiagramSpec, DiagramType } from '../types/chemistry.ts';
import { getClippedImage } from '../utils/imageStore.ts';

/**
 * Renders chemical formulas and scientific notation cleanly:
 * - Converts patterns like H2O, SO4^2-, Fe3+, 10^-5, mol^-1, dm^-3 into proper sub/superscripts
 * - Preserves normal prose untouched
 */
export function ChemText({ text, className = '' }: { text: string; className?: string }) {
  const tokens = text.split(/(\s+)/);

  const renderToken = (token: string, idx: number) => {
    if (token.includes('^')) {
      const parts = token.split(/(\^[+-]?\d*[+-]?)/g);
      return (
        <React.Fragment key={idx}>
          {parts.map((p, i) => {
            if (p.startsWith('^')) {
              return (
                <sup key={i} className="text-[0.72em] leading-none">
                  {p.slice(1)}
                </sup>
              );
            }
            return renderFormulaSubscripts(p, i);
          })}
        </React.Fragment>
      );
    }
    return <React.Fragment key={idx}>{renderFormulaSubscripts(token, idx)}</React.Fragment>;
  };

  return <span className={className}>{tokens.map(renderToken)}</span>;
}

function renderFormulaSubscripts(segment: string, keyPrefix: number) {
  if (
    /^\d/.test(segment) ||
    segment.includes('.') ||
    segment.startsWith('Ch') ||
    segment.startsWith('9701') ||
    segment.includes('/') ||
    segment.includes(':') ||
    (segment.includes('-') && !/[A-Za-z]\d/.test(segment))
  ) {
    return <React.Fragment key={keyPrefix}>{segment}</React.Fragment>;
  }

  const parts = segment.split(/([A-Za-z\)]\d+)/g);
  return (
    <React.Fragment key={keyPrefix}>
      {parts.map((part, i) => {
        const m = part.match(/^([A-Za-z\)])(\d+)$/);
        if (m) {
          if (/^[spdf]$/.test(m[1]) && Number(m[2]) <= 14 && segment.length <= 4) {
            return (
              <React.Fragment key={i}>
                {m[1]}
                <sup className="text-[0.72em] leading-none">{m[2]}</sup>
              </React.Fragment>
            );
          }
          return (
            <React.Fragment key={i}>
              {m[1]}
              <sub className="text-[0.72em] leading-none">{m[2]}</sub>
            </React.Fragment>
          );
        }
        return <React.Fragment key={i}>{part}</React.Fragment>;
      })}
    </React.Fragment>
  );
}

/**
 * Loads and renders a real cropped PDF question or mark-scheme screenshot from IndexedDB,
 * with click-to-zoom lightbox inspection.
 */
export function ClippedQuestionImage({
  imageId,
  imageUrl,
  alt = 'CAIE 9701 Past Paper Diagram',
  caption,
  maxWidthClass = 'max-w-[920px]',
}: {
  imageId?: string;
  imageUrl?: string;
  alt?: string;
  caption?: string;
  maxWidthClass?: string;
}) {
  const [src, setSrc] = useState<string | null>(imageUrl ?? null);
  const [imgError, setImgError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [zoomed, setZoomed] = useState(false);
  const [scaleMode, setScaleMode] = useState<'fit' | 'large'>('fit');

  useEffect(() => {
    setImgError(false);
    setRetryCount(0);
    setScaleMode('fit');
    if (imageUrl) {
      setSrc(imageUrl);
      return;
    }
    if (!imageId) {
      setSrc(null);
      return;
    }
    let mounted = true;
    getClippedImage(imageId).then((url) => {
      if (mounted) setSrc(url);
    });
    return () => {
      mounted = false;
    };
  }, [imageId, imageUrl]);

  const handleImageError = () => {
    if (imageUrl && retryCount < 1) {
      setRetryCount((c) => c + 1);
      const sep = imageUrl.includes('?') ? '&' : '?';
      setSrc(`${imageUrl}${sep}r=${Date.now()}`);
      return;
    }
    setImgError(true);
  };

  if (!src) {
    return (
      <div className="my-4 rounded-xl border border-white/10 bg-[#18181A] p-6 text-center text-xs text-[#F8F7F4]/55">
        Loading clipped exam paper image...
      </div>
    );
  }

  if (imgError) {
    return (
      <div className="my-4 flex items-center justify-between gap-3 rounded-xl border border-[#E0A458]/35 bg-[#E0A458]/10 p-4 text-xs text-[#E0A458]">
        <span>原卷截图加载失败（{caption ?? alt}）</span>
        {imageUrl && (
          <button
            type="button"
            onClick={() => {
              setImgError(false);
              const sep = imageUrl.includes('?') ? '&' : '?';
              setSrc(`${imageUrl}${sep}r=${Date.now()}`);
            }}
            className="shrink-0 rounded-md border border-[#E0A458]/40 bg-[#18181A] px-2.5 py-1 font-medium text-[#E0A458] hover:bg-[#E0A458]/20"
          >
            重新加载
          </button>
        )}
      </div>
    );
  }

  return (
    <>
      <figure className="my-4 rounded-xl border border-white/15 bg-[#141416] p-3 sm:p-4">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-[11px]">
          <span className="font-mono text-[#F8F7F4]/60">
            {caption ?? alt}
          </span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setScaleMode((m) => (m === 'fit' ? 'large' : 'fit'))}
              className={`rounded-md border px-2 py-0.5 font-mono text-[11px] transition-colors ${
                scaleMode === 'large'
                  ? 'border-[#E0A458] bg-[#E0A458]/15 text-[#E0A458]'
                  : 'border-white/12 bg-[#18181A] text-[#F8F7F4]/70 hover:border-white/30 hover:text-[#F8F7F4]'
              }`}
            >
              {scaleMode === 'large' ? '恢复适宽' : '125% 放大'}
            </button>
            <button
              type="button"
              onClick={() => setZoomed(true)}
              className="inline-flex items-center gap-1 rounded-md border border-white/12 bg-[#18181A] px-2 py-0.5 text-[11px] font-medium text-[#F8F7F4]/80 hover:border-[#E0A458] hover:text-[#E0A458]"
            >
              <Maximize2 className="h-3 w-3" />
              全屏审图
            </button>
          </div>
        </div>
        <div className="overflow-x-auto rounded-lg bg-white p-3 sm:p-4 shadow-inner">
          <img
            src={src}
            alt={alt}
            referrerPolicy="no-referrer"
            onError={handleImageError}
            onClick={() => setZoomed(true)}
            className={`mx-auto block h-auto cursor-zoom-in ${
              scaleMode === 'large' ? 'w-[125%] max-w-none min-w-[760px]' : `w-full ${maxWidthClass}`
            }`}
          />
        </div>
      </figure>

      {zoomed && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/88 p-4"
          onClick={() => setZoomed(false)}
        >
          <div
            className="relative max-h-[94vh] max-w-6xl overflow-auto rounded-xl border border-white/15 bg-white p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setZoomed(false)}
              className="sticky float-right right-1 top-1 rounded-lg border border-slate-200 bg-white p-1.5 text-slate-800 shadow-xs hover:bg-slate-100"
              aria-label="关闭放大视图"
            >
              <X className="h-4 w-4" />
            </button>
            <img
              src={src}
              alt={alt}
              referrerPolicy="no-referrer"
              className="w-full max-w-5xl object-contain"
            />
          </div>
        </div>
      )}
    </>
  );
}

/**
 * Renders 14+ parametric A-Level Chemistry vector diagrams
 */
export function ChemDiagram({
  type,
  spec,
  caption,
}: {
  type?: DiagramType;
  spec?: DiagramSpec;
  caption?: string;
}) {
  const kind = spec?.kind ?? type;
  const p = spec?.params ?? {};
  if (!kind) return null;

  return (
    <figure className="my-4 rounded-xl border border-white/12 bg-[#141416] p-4">
      <div className="overflow-x-auto rounded-lg bg-white p-3">
        {kind === 'enthalpy' && <EnthalpySvg p={p} />}
        {kind === 'maxwell' && <MaxwellSvg p={p} />}
        {kind === 'born-haber' && <BornHaberSvg p={p} />}
        {kind === 'titration' && <TitrationSvg p={p} />}
        {kind === 'nmr' && <NmrSvg p={p} />}
        {kind === 'organic-scheme' && <OrganicSchemeSvg p={p} />}
        {kind === 'ionisation' && <IonisationSvg p={p} />}
        {kind === 'period3-mp' && <Period3MpSvg p={p} />}
        {kind === 'mass-spec' && <MassSpecSvg p={p} />}
        {kind === 'ir-spec' && <IrSpecSvg p={p} />}
        {kind === 'kinetics-curve' && <KineticsSvg p={p} />}
        {kind === 'electrochem-cell' && <ElectrochemCellSvg p={p} />}
        {kind === 'skeletal' && <SkeletalSvg p={p} />}
        {kind === 'paper5-graph' && <Paper5GraphSvg p={p} />}
      </div>
      {caption && (
        <figcaption className="mt-2.5 text-center font-mono text-[11px] text-[#F8F7F4]/55">
          {caption}
        </figcaption>
      )}
    </figure>
  );
}

function EnthalpySvg({ p }: { p: Record<string, unknown> }) {
  const topLeft = String(p.topLeft ?? '3C(s) + 4H₂(g)');
  const topRight = String(p.topRight ?? 'C₃H₈(g)');
  const bottom = String(p.bottom ?? '3CO₂(g) + 4H₂O(l)');
  const topLabel = String(p.topLabel ?? 'ΔHf°[C₃H₈(g)] = ?');
  const leftLabel = String(p.leftLabel ?? '3ΔHc°[C] + 4ΔHc°[H₂]');
  const rightLabel = String(p.rightLabel ?? 'ΔHc°[C₃H₈] = −2220');

  return (
    <svg viewBox="0 0 560 220" className="mx-auto h-48 w-full max-w-xl text-slate-800">
      <defs>
        <marker id="arrowBlue" markerWidth="8" markerHeight="8" refX="7" refY="3.5" orient="auto">
          <polygon points="0 0, 8 3.5, 0 7" fill="#1D4ED8" />
        </marker>
        <marker id="arrowSlate" markerWidth="8" markerHeight="8" refX="7" refY="3.5" orient="auto">
          <polygon points="0 0, 8 3.5, 0 7" fill="#334155" />
        </marker>
      </defs>
      <rect x="30" y="24" width="185" height="44" rx="8" fill="#FFFFFF" stroke="#CBD5E1" strokeWidth="1.5" />
      <text x="122" y="51" textAnchor="middle" fontSize="12.5" fontWeight="600" fill="#0F172A">
        {topLeft}
      </text>
      <rect x="345" y="24" width="185" height="44" rx="8" fill="#FFFFFF" stroke="#CBD5E1" strokeWidth="1.5" />
      <text x="437" y="51" textAnchor="middle" fontSize="12.5" fontWeight="600" fill="#0F172A">
        {topRight}
      </text>
      <line x1="218" y1="46" x2="338" y2="46" stroke="#1D4ED8" strokeWidth="2" markerEnd="url(#arrowBlue)" />
      <text x="278" y="34" textAnchor="middle" fontSize="11.5" fontWeight="600" fill="#1D4ED8">
        {topLabel}
      </text>
      <rect x="165" y="156" width="230" height="44" rx="8" fill="#FFFFFF" stroke="#CBD5E1" strokeWidth="1.5" />
      <text x="280" y="183" textAnchor="middle" fontSize="12.5" fontWeight="600" fill="#0F172A">
        {bottom}
      </text>
      <line x1="135" y1="70" x2="225" y2="152" stroke="#334155" strokeWidth="1.8" markerEnd="url(#arrowSlate)" />
      <text x="102" y="122" textAnchor="middle" fontSize="11" fill="#334155">
        {leftLabel}
      </text>
      <line x1="425" y1="70" x2="335" y2="152" stroke="#334155" strokeWidth="1.8" markerEnd="url(#arrowSlate)" />
      <text x="454" y="122" textAnchor="middle" fontSize="11" fill="#334155">
        {rightLabel}
      </text>
    </svg>
  );
}

function MaxwellSvg({ p }: { p: Record<string, unknown> }) {
  const showCatalyst = Boolean(p.showCatalyst);
  const t1Label = String(p.t1Label ?? 'T₁ (lower T)');
  const t2Label = String(p.t2Label ?? 'T₂ (higher T)');
  return (
    <svg viewBox="0 0 560 230" className="mx-auto h-48 w-full max-w-xl">
      <line x1="56" y1="190" x2="520" y2="190" stroke="#334155" strokeWidth="1.8" />
      <line x1="56" y1="190" x2="56" y2="24" stroke="#334155" strokeWidth="1.8" />
      <text x="290" y="216" textAnchor="middle" fontSize="12" fill="#334155">
        Molecular Kinetic Energy (E)
      </text>
      <text x="20" y="110" textAnchor="middle" fontSize="11.5" fill="#334155" transform="rotate(-90 20 110)">
        Number of Molecules
      </text>
      <path d="M 56 190 Q 115 32 185 88 T 360 175 T 500 189" fill="none" stroke="#1D4ED8" strokeWidth="2.4" />
      <text x="148" y="46" fontSize="12" fontWeight="600" fill="#1D4ED8">
        {t1Label}
      </text>
      {!showCatalyst && (
        <>
          <path d="M 56 190 Q 150 68 235 106 T 410 166 T 515 186" fill="none" stroke="#D97706" strokeWidth="2.4" strokeDasharray="6 3" />
          <text x="255" y="92" fontSize="12" fontWeight="600" fill="#D97706">
            {t2Label}
          </text>
        </>
      )}
      {showCatalyst && (
        <>
          <line x1="280" y1="54" x2="280" y2="190" stroke="#059669" strokeWidth="2" strokeDasharray="4 3" />
          <text x="285" y="66" fontSize="11.5" fontWeight="600" fill="#059669">
            Eₐ(cat)
          </text>
        </>
      )}
      <line x1="355" y1="36" x2="355" y2="190" stroke="#DC2626" strokeWidth="1.8" strokeDasharray="4 3" />
      <text x="362" y="52" fontSize="12" fontWeight="600" fill="#DC2626">
        Eₐ(uncat)
      </text>
    </svg>
  );
}

function BornHaberSvg({ p }: { p: Record<string, unknown> }) {
  const ions = String(p.ions ?? 'Mg²⁺(g) + 2Cl⁻(g)');
  const solid = String(p.solid ?? 'MgCl₂(s)');
  const aq = String(p.aq ?? 'Mg²⁺(aq) + 2Cl⁻(aq)');
  const latt = String(p.latt ?? 'ΔHlatt° = −2526');
  const sol = String(p.sol ?? 'ΔHsol° = ?');
  const hyd = String(p.hyd ?? 'ΔHhyd°(Mg²⁺) + 2ΔHhyd°(Cl⁻)');
  return (
    <svg viewBox="0 0 560 220" className="mx-auto h-48 w-full max-w-xl">
      <defs>
        <marker id="arrowBh" markerWidth="8" markerHeight="8" refX="7" refY="3.5" orient="auto">
          <polygon points="0 0, 8 3.5, 0 7" fill="#1D4ED8" />
        </marker>
      </defs>
      <rect x="42" y="24" width="180" height="42" rx="8" fill="#FFFFFF" stroke="#CBD5E1" strokeWidth="1.5" />
      <text x="132" y="50" textAnchor="middle" fontSize="12.5" fontWeight="600" fill="#0F172A">{ions}</text>
      <rect x="42" y="152" width="180" height="42" rx="8" fill="#FFFFFF" stroke="#CBD5E1" strokeWidth="1.5" />
      <text x="132" y="178" textAnchor="middle" fontSize="12.5" fontWeight="600" fill="#0F172A">{solid}</text>
      <rect x="330" y="152" width="190" height="42" rx="8" fill="#FFFFFF" stroke="#CBD5E1" strokeWidth="1.5" />
      <text x="425" y="178" textAnchor="middle" fontSize="12.5" fontWeight="600" fill="#0F172A">{aq}</text>
      <line x1="132" y1="68" x2="132" y2="146" stroke="#1D4ED8" strokeWidth="2" markerEnd="url(#arrowBh)" />
      <text x="142" y="112" fontSize="11.5" fontWeight="600" fill="#1D4ED8">{latt}</text>
      <line x1="224" y1="173" x2="324" y2="173" stroke="#059669" strokeWidth="2" markerEnd="url(#arrowBh)" />
      <text x="274" y="163" textAnchor="middle" fontSize="11.5" fontWeight="600" fill="#059669">{sol}</text>
      <line x1="224" y1="54" x2="405" y2="148" stroke="#334155" strokeWidth="1.8" markerEnd="url(#arrowBh)" />
      <text x="368" y="92" textAnchor="middle" fontSize="11" fill="#334155">{hyd}</text>
    </svg>
  );
}

function TitrationSvg({ p }: { p: Record<string, unknown> }) {
  const mode = String(p.mode ?? 'weak-acid-strong-base');
  const eqVol = String(p.eqVol ?? '25.0');
  const halfVol = String(p.halfVol ?? '12.5');
  const eqPh = String(p.eqPh ?? 'pH = 8.7');
  const xAxis = String(p.xAxis ?? 'Volume of NaOH added (cm³)');
  const isStrongStrong = mode === 'strong-strong';
  const isWeakBaseStrongAcid = mode === 'weak-base-strong-acid';

  return (
    <svg viewBox="0 0 560 220" className="mx-auto h-48 w-full max-w-xl">
      <line x1="56" y1="190" x2="510" y2="190" stroke="#334155" strokeWidth="1.8" />
      <line x1="56" y1="190" x2="56" y2="24" stroke="#334155" strokeWidth="1.8" />
      <text x="280" y="213" textAnchor="middle" fontSize="12" fill="#334155">{xAxis}</text>
      <text x="22" y="108" textAnchor="middle" fontSize="12" fill="#334155" transform="rotate(-90 22 108)">pH</text>
      <text x="44" y="164" textAnchor="end" fontSize="10.5" fill="#64748B">2</text>
      <text x="44" y="114" textAnchor="end" fontSize="10.5" fill="#64748B">7</text>
      <text x="44" y="48" textAnchor="end" fontSize="10.5" fill="#64748B">13</text>
      <text x="176" y="204" textAnchor="middle" fontSize="10.5" fill="#64748B">{halfVol}</text>
      <text x="295" y="204" textAnchor="middle" fontSize="10.5" fill="#64748B">{eqVol}</text>

      {!isStrongStrong && !isWeakBaseStrongAcid && (
        <>
          <rect x="110" y="128" width="135" height="24" rx="4" fill="#DBEAFE" opacity="0.7" />
          <text x="178" y="122" textAnchor="middle" fontSize="11" fontWeight="600" fill="#1D4ED8">
            Buffer Region (pH ≈ pKa)
          </text>
          <path d="M 56 164 C 95 145, 210 138, 265 128 C 288 122, 292 78, 300 62 C 312 46, 400 44, 500 43" fill="none" stroke="#0F172A" strokeWidth="2.4" />
          <circle cx="295" cy="92" r="4" fill="#DC2626" />
          <text x="312" y="96" fontSize="11" fontWeight="600" fill="#DC2626">Equivalence ({eqPh})</text>
        </>
      )}

      {isStrongStrong && (
        <>
          <path d="M 56 176 L 260 166 C 288 164, 292 64, 300 48 L 500 42" fill="none" stroke="#0F172A" strokeWidth="2.4" />
          <circle cx="295" cy="110" r="4" fill="#DC2626" />
          <text x="312" y="114" fontSize="11" fontWeight="600" fill="#DC2626">Equivalence (pH = 7.0)</text>
        </>
      )}

      {isWeakBaseStrongAcid && (
        <>
          <path d="M 56 58 C 110 68, 210 74, 270 84 C 288 92, 292 145, 302 162 C 325 174, 420 176, 500 178" fill="none" stroke="#0F172A" strokeWidth="2.4" />
          <circle cx="295" cy="128" r="4" fill="#DC2626" />
          <text x="312" y="132" fontSize="11" fontWeight="600" fill="#DC2626">Equivalence (pH ≈ 5.1)</text>
        </>
      )}
    </svg>
  );
}

function NmrSvg({ p }: { p: Record<string, unknown> }) {
  const peaks = (Array.isArray(p.peaks) ? p.peaks : [
    { delta: '4.12', mult: 'q', h: '2H', x: 148, count: 4, color: '#1D4ED8' },
    { delta: '2.05', mult: 's', h: '3H', x: 305, count: 1, color: '#059669' },
    { delta: '1.25', mult: 't', h: '3H', x: 425, count: 3, color: '#D97706' },
  ]) as Array<{ delta: string; mult: string; h: string; x: number; count: number; color?: string }>;

  return (
    <svg viewBox="0 0 560 200" className="mx-auto h-44 w-full max-w-xl">
      <line x1="40" y1="165" x2="520" y2="165" stroke="#334155" strokeWidth="1.8" />
      <text x="280" y="190" textAnchor="middle" fontSize="12" fill="#334155">
        Chemical Shift δ (ppm) ← downfield
      </text>
      {peaks.map((pk, idx) => {
        const col = pk.color ?? '#1D4ED8';
        const n = Math.max(1, Math.min(4, pk.count));
        const offsets = n === 1 ? [0] : n === 2 ? [-4, 4] : n === 3 ? [-7, 0, 7] : [-10, -3, 4, 11];
        return (
          <g key={idx}>
            {offsets.map((off, j) => {
              const isOuter = n >= 3 && (j === 0 || j === n - 1);
              const topY = isOuter ? 112 : 55;
              return (
                <line key={j} x1={pk.x + off} y1={165} x2={pk.x + off} y2={topY} stroke={col} strokeWidth="2.2" />
              );
            })}
            <text x={pk.x} y="42" textAnchor="middle" fontSize="11" fontWeight="600" fill={col}>
              δ {pk.delta} ({pk.mult}, {pk.h})
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function OrganicSchemeSvg({ p }: { p: Record<string, unknown> }) {
  const n1 = String(p.n1 ?? 'But-1-ene');
  const n2 = String(p.n2 ?? 'P (major)');
  const n3 = String(p.n3 ?? 'Alcohol R');
  const n4 = String(p.n4 ?? 'Product S');
  const r1 = String(p.r1 ?? 'HBr');
  const r2 = String(p.r2 ?? 'NaOH(aq)');
  const r3 = String(p.r3 ?? 'Cr₂O₇²⁻/H⁺');
  const ret = String(p.ret ?? '(b) Reagent & Conditions ?');

  return (
    <svg viewBox="0 0 560 155" className="mx-auto h-36 w-full max-w-xl">
      <defs>
        <marker id="arrowOrg" markerWidth="8" markerHeight="8" refX="7" refY="3.5" orient="auto">
          <polygon points="0 0, 8 3.5, 0 7" fill="#1D4ED8" />
        </marker>
      </defs>
      <rect x="14" y="46" width="112" height="44" rx="8" fill="#FFFFFF" stroke="#CBD5E1" strokeWidth="1.5" />
      <text x="70" y="72" textAnchor="middle" fontSize="11.5" fontWeight="600" fill="#0F172A">{n1}</text>

      <rect x="170" y="46" width="96" height="44" rx="8" fill="#EFF6FF" stroke="#93C5FD" strokeWidth="1.5" />
      <text x="218" y="72" textAnchor="middle" fontSize="11.5" fontWeight="600" fill="#1E40AF">{n2}</text>

      <rect x="310" y="46" width="96" height="44" rx="8" fill="#FFFFFF" stroke="#CBD5E1" strokeWidth="1.5" />
      <text x="358" y="72" textAnchor="middle" fontSize="11.5" fontWeight="600" fill="#0F172A">{n3}</text>

      <rect x="450" y="46" width="96" height="44" rx="8" fill="#FFFFFF" stroke="#CBD5E1" strokeWidth="1.5" />
      <text x="498" y="72" textAnchor="middle" fontSize="11.5" fontWeight="600" fill="#0F172A">{n4}</text>

      <line x1="128" y1="68" x2="166" y2="68" stroke="#1D4ED8" strokeWidth="1.8" markerEnd="url(#arrowOrg)" />
      <text x="147" y="57" textAnchor="middle" fontSize="10" fill="#334155">{r1}</text>

      <line x1="268" y1="68" x2="306" y2="68" stroke="#1D4ED8" strokeWidth="1.8" markerEnd="url(#arrowOrg)" />
      <text x="287" y="57" textAnchor="middle" fontSize="10" fill="#334155">{r2}</text>

      <line x1="408" y1="68" x2="446" y2="68" stroke="#1D4ED8" strokeWidth="1.8" markerEnd="url(#arrowOrg)" />
      <text x="427" y="57" textAnchor="middle" fontSize="10" fill="#334155">{r3}</text>

      <path d="M 218 92 C 218 128, 70 128, 70 95" fill="none" stroke="#D97706" strokeWidth="1.6" strokeDasharray="4 3" markerEnd="url(#arrowOrg)" />
      <text x="144" y="138" textAnchor="middle" fontSize="10.5" fontWeight="600" fill="#D97706">{ret}</text>
    </svg>
  );
}

function IonisationSvg({ p }: { p: Record<string, unknown> }) {
  const mode = String(p.mode ?? 'period3');
  const highlight = String(p.highlight ?? 'Mg → Al & P → S dips');
  return (
    <svg viewBox="0 0 560 220" className="mx-auto h-48 w-full max-w-xl">
      <line x1="56" y1="185" x2="510" y2="185" stroke="#334155" strokeWidth="1.8" />
      <line x1="56" y1="185" x2="56" y2="24" stroke="#334155" strokeWidth="1.8" />
      {mode === 'period3' ? (
        <>
          <text x="280" y="210" textAnchor="middle" fontSize="11.5" fill="#334155">Period 3 Elements (Na → Ar)</text>
          <text x="20" y="105" textAnchor="middle" fontSize="11.5" fill="#334155" transform="rotate(-90 20 105)">First IE (kJ mol⁻¹)</text>
          <polyline
            fill="none"
            stroke="#1D4ED8"
            strokeWidth="2.4"
            points="90,158 145,128 200,140 255,112 310,82 365,94 420,66 475,38"
          />
          {[
            ['Na', 90, 158],
            ['Mg', 145, 128],
            ['Al', 200, 140],
            ['Si', 255, 112],
            ['P', 310, 82],
            ['S', 365, 94],
            ['Cl', 420, 66],
            ['Ar', 475, 38],
          ].map(([el, x, y]) => (
            <g key={String(el)}>
              <circle cx={Number(x)} cy={Number(y)} r="4" fill="#1D4ED8" />
              <text x={Number(x)} y={Number(y) - 10} textAnchor="middle" fontSize="11" fontWeight="600" fill="#0F172A">
                {el}
              </text>
            </g>
          ))}
          <text x="335" y="168" fontSize="11" fontWeight="600" fill="#DC2626">{highlight}</text>
        </>
      ) : (
        <>
          <text x="280" y="210" textAnchor="middle" fontSize="11.5" fill="#334155">Ionisation Number (1st → 8th)</text>
          <text x="20" y="105" textAnchor="middle" fontSize="11.5" fill="#334155" transform="rotate(-90 20 105)">log₁₀(IE)</text>
          <polyline
            fill="none"
            stroke="#1D4ED8"
            strokeWidth="2.4"
            points="90,164 145,148 200,136 255,92 310,78 365,68 420,58 475,46"
          />
          {[1, 2, 3, 4, 5, 6, 7, 8].map((n, i) => {
            const x = 90 + i * 55;
            const y = [164, 148, 136, 92, 78, 68, 58, 46][i];
            return (
              <g key={n}>
                <circle cx={x} cy={y} r="4" fill={n === 4 ? '#DC2626' : '#1D4ED8'} />
                <text x={x} y="198" textAnchor="middle" fontSize="10.5" fill="#475569">{n}</text>
              </g>
            );
          })}
          <text x="255" y="118" textAnchor="middle" fontSize="11" fontWeight="600" fill="#DC2626">
            Large jump (3 → 4)
          </text>
        </>
      )}
    </svg>
  );
}

function Period3MpSvg({ p }: { p: Record<string, unknown> }) {
  const title = String(p.title ?? 'Period 3 Melting Points (K)');
  const heights = [37, 92, 93, 168, 32, 39, 17, 8];
  const labels = ['Na', 'Mg', 'Al', 'Si', 'P₄', 'S₈', 'Cl₂', 'Ar'];
  return (
    <svg viewBox="0 0 560 220" className="mx-auto h-48 w-full max-w-xl">
      <line x1="50" y1="185" x2="520" y2="185" stroke="#334155" strokeWidth="1.8" />
      <line x1="50" y1="185" x2="50" y2="26" stroke="#334155" strokeWidth="1.8" />
      <text x="285" y="22" textAnchor="middle" fontSize="12" fontWeight="600" fill="#0F172A">{title}</text>
      {labels.map((el, i) => {
        const x = 75 + i * 55;
        const h = heights[i] * 0.85;
        const fill = i <= 2 ? '#1D4ED8' : i === 3 ? '#DC2626' : '#059669';
        return (
          <g key={el}>
            <rect x={x} y={185 - h} width="30" height={h} rx="3" fill={fill} opacity="0.85" />
            <text x={x + 15} y="202" textAnchor="middle" fontSize="11" fontWeight="600" fill="#0F172A">{el}</text>
          </g>
        );
      })}
      <text x="150" y="54" fontSize="10.5" fill="#1D4ED8">Metallic</text>
      <text x="260" y="34" fontSize="10.5" fontWeight="600" fill="#DC2626">Giant Covalent (Si)</text>
      <text x="410" y="88" fontSize="10.5" fill="#059669">Simple Molecular (S₈ &gt; P₄ &gt; Cl₂)</text>
    </svg>
  );
}

function MassSpecSvg({ p }: { p: Record<string, unknown> }) {
  const peaks = (Array.isArray(p.peaks) ? p.peaks : [
    { mz: '29', h: 55, label: '29 (C₂H₅⁺)' },
    { mz: '43', h: 100, label: '43 (CH₃CO⁺)' },
    { mz: '58', h: 32, label: '58 (M⁺)' },
    { mz: '59', h: 3, label: '59 (M+1)' },
  ]) as Array<{ mz: string; h: number; label: string }>;
  return (
    <svg viewBox="0 0 560 210" className="mx-auto h-44 w-full max-w-xl">
      <line x1="56" y1="175" x2="510" y2="175" stroke="#334155" strokeWidth="1.8" />
      <line x1="56" y1="175" x2="56" y2="24" stroke="#334155" strokeWidth="1.8" />
      <text x="285" y="198" textAnchor="middle" fontSize="11.5" fill="#334155">m/z ratio</text>
      <text x="22" y="100" textAnchor="middle" fontSize="11.5" fill="#334155" transform="rotate(-90 22 100)">Relative Intensity (%)</text>
      {peaks.map((pk, idx) => {
        const x = 110 + idx * 105;
        const barH = pk.h * 1.25;
        return (
          <g key={idx}>
            <line x1={x} y1="175" x2={x} y2={175 - barH} stroke="#1D4ED8" strokeWidth="5" />
            <text x={x} y={168 - barH} textAnchor="middle" fontSize="10.5" fontWeight="600" fill="#0F172A">
              {pk.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function IrSpecSvg({ p }: { p: Record<string, unknown> }) {
  const hasBroadOh = p.hasBroadOh !== false;
  const hasSharpCo = p.hasSharpCo !== false;
  return (
    <svg viewBox="0 0 560 200" className="mx-auto h-44 w-full max-w-xl">
      <line x1="56" y1="30" x2="515" y2="30" stroke="#CBD5E1" strokeWidth="1" />
      <line x1="56" y1="170" x2="515" y2="170" stroke="#334155" strokeWidth="1.8" />
      <line x1="56" y1="170" x2="56" y2="24" stroke="#334155" strokeWidth="1.8" />
      <text x="285" y="192" textAnchor="middle" fontSize="11.5" fill="#334155">Wavenumber (cm⁻¹) — 4000 → 500</text>
      <text x="20" y="100" textAnchor="middle" fontSize="11" fill="#334155" transform="rotate(-90 20 100)">Transmittance %</text>
      <text x="90" y="183" fontSize="10" fill="#64748B">3500</text>
      <text x="200" y="183" fontSize="10" fill="#64748B">2500</text>
      <text x="315" y="183" fontSize="10" fill="#64748B">1700</text>
      <text x="440" y="183" fontSize="10" fill="#64748B">1000</text>
      <path
        d={`M 60 36 ${
          hasBroadOh ? 'Q 115 135 165 38' : 'L 165 36'
        } L 295 36 ${hasSharpCo ? 'L 315 152 L 330 38' : 'L 330 38'} L 395 40 L 415 110 L 435 42 L 505 38`}
        fill="none"
        stroke="#0F172A"
        strokeWidth="2.2"
      />
      {hasBroadOh && (
        <text x="120" y="150" textAnchor="middle" fontSize="10.5" fontWeight="600" fill="#1D4ED8">
          Broad O–H (3200–3600)
        </text>
      )}
      {hasSharpCo && (
        <text x="320" y="164" textAnchor="middle" fontSize="10.5" fontWeight="600" fill="#DC2626">
          Sharp C=O (~1720)
        </text>
      )}
    </svg>
  );
}

function KineticsSvg({ p }: { p: Record<string, unknown> }) {
  const mode = String(p.mode ?? 'first-order-conc-time');
  return (
    <svg viewBox="0 0 560 210" className="mx-auto h-44 w-full max-w-xl">
      <line x1="56" y1="175" x2="510" y2="175" stroke="#334155" strokeWidth="1.8" />
      <line x1="56" y1="175" x2="56" y2="24" stroke="#334155" strokeWidth="1.8" />
      {mode === 'first-order-conc-time' ? (
        <>
          <text x="285" y="198" textAnchor="middle" fontSize="11.5" fill="#334155">Time t (s)</text>
          <text x="22" y="100" textAnchor="middle" fontSize="11.5" fill="#334155" transform="rotate(-90 22 100)">[Reactant]</text>
          <path d="M 56 36 Q 150 135 480 171" fill="none" stroke="#1D4ED8" strokeWidth="2.5" />
          <line x1="56" y1="105" x2="152" y2="105" stroke="#DC2626" strokeDasharray="4 3" />
          <line x1="152" y1="105" x2="152" y2="175" stroke="#DC2626" strokeDasharray="4 3" />
          <line x1="56" y1="140" x2="248" y2="140" stroke="#059669" strokeDasharray="4 3" />
          <line x1="248" y1="140" x2="248" y2="175" stroke="#059669" strokeDasharray="4 3" />
          <text x="152" y="190" textAnchor="middle" fontSize="10" fontWeight="600" fill="#DC2626">t½ = 40 s</text>
          <text x="248" y="190" textAnchor="middle" fontSize="10" fontWeight="600" fill="#059669">2t½ = 80 s</text>
        </>
      ) : (
        <>
          <text x="285" y="198" textAnchor="middle" fontSize="11.5" fill="#334155">[Reactant]</text>
          <text x="22" y="100" textAnchor="middle" fontSize="11.5" fill="#334155" transform="rotate(-90 22 100)">Initial Rate</text>
          <path d="M 56 175 Q 240 160 460 36" fill="none" stroke="#1D4ED8" strokeWidth="2.5" />
          <text x="330" y="92" fontSize="11.5" fontWeight="600" fill="#1D4ED8">Rate ∝ [X]² (2nd Order)</text>
        </>
      )}
    </svg>
  );
}

function ElectrochemCellSvg({ p }: { p: Record<string, unknown> }) {
  const leftElec = String(p.leftElec ?? 'Zn(s) / Zn²⁺(1.0 mol dm⁻³)');
  const rightElec = String(p.rightElec ?? 'Cu(s) / Cu²⁺(1.0 mol dm⁻³)');
  return (
    <svg viewBox="0 0 560 205" className="mx-auto h-44 w-full max-w-xl">
      <rect x="65" y="80" width="140" height="105" rx="6" fill="#EFF6FF" stroke="#64748B" strokeWidth="1.5" />
      <rect x="355" y="80" width="140" height="105" rx="6" fill="#EFF6FF" stroke="#64748B" strokeWidth="1.5" />
      {/* Electrodes */}
      <rect x="112" y="54" width="16" height="96" fill="#94A3B8" stroke="#334155" />
      <rect x="432" y="54" width="16" height="96" fill="#D97706" stroke="#334155" />
      {/* Salt bridge */}
      <path d="M 180 112 L 180 56 L 380 56 L 380 112" fill="none" stroke="#CBD5E1" strokeWidth="14" />
      <text x="280" y="60" textAnchor="middle" fontSize="10.5" fontWeight="600" fill="#334155">KNO₃(aq) Salt Bridge</text>
      {/* Wire & Voltmeter */}
      <polyline points="120,54 120,24 440,24 440,54" fill="none" stroke="#0F172A" strokeWidth="1.8" />
      <circle cx="280" cy="24" r="16" fill="#FFFFFF" stroke="#1D4ED8" strokeWidth="2" />
      <text x="280" y="29" textAnchor="middle" fontSize="12" fontWeight="700" fill="#1D4ED8">V</text>
      <text x="135" y="198" textAnchor="middle" fontSize="10.5" fill="#0F172A">{leftElec}</text>
      <text x="425" y="198" textAnchor="middle" fontSize="10.5" fill="#0F172A">{rightElec}</text>
    </svg>
  );
}

function SkeletalSvg({ p }: { p: Record<string, unknown> }) {
  const title = String(p.title ?? 'Skeletal Structure & Functional Groups');
  const labelA = String(p.labelA ?? 'OH');
  const labelB = String(p.labelB ?? 'O');
  return (
    <svg viewBox="0 0 560 150" className="mx-auto h-36 w-full max-w-xl">
      <text x="280" y="22" textAnchor="middle" fontSize="11.5" fontWeight="600" fill="#475569">{title}</text>
      <polyline
        fill="none"
        stroke="#0F172A"
        strokeWidth="2.4"
        points="110,95 160,65 210,95 260,65 310,95 360,65 410,95"
      />
      {/* C=O double bond */}
      <line x1="257" y1="65" x2="257" y2="36" stroke="#0F172A" strokeWidth="2" />
      <line x1="263" y1="65" x2="263" y2="36" stroke="#0F172A" strokeWidth="2" />
      <text x="260" y="31" textAnchor="middle" fontSize="12" fontWeight="700" fill="#DC2626">{labelB}</text>
      {/* OH / substituent */}
      <line x1="360" y1="65" x2="360" y2="36" stroke="#0F172A" strokeWidth="2" />
      <text x="360" y="31" textAnchor="middle" fontSize="12" fontWeight="700" fill="#1D4ED8">{labelA}</text>
    </svg>
  );
}

function Paper5GraphSvg({ p }: { p: Record<string, unknown> }) {
  const xLabel = String(p.xLabel ?? 'Mass of reactant / g');
  const yLabel = String(p.yLabel ?? 'Volume of gas / cm³');
  return (
    <svg viewBox="0 0 560 220" className="mx-auto h-48 w-full max-w-xl">
      <line x1="60" y1="185" x2="510" y2="185" stroke="#334155" strokeWidth="1.8" />
      <line x1="60" y1="185" x2="60" y2="24" stroke="#334155" strokeWidth="1.8" />
      <text x="285" y="208" textAnchor="middle" fontSize="11.5" fill="#334155">{xLabel}</text>
      <text x="22" y="105" textAnchor="middle" fontSize="11.5" fill="#334155" transform="rotate(-90 22 105)">{yLabel}</text>
      <line x1="60" y1="185" x2="480" y2="42" stroke="#1D4ED8" strokeWidth="2.2" />
      {[
        [120, 165],
        [185, 142],
        [255, 118],
        [330, 93],
        [410, 66],
      ].map(([x, y], i) => (
        <g key={i} stroke="#0F172A" strokeWidth="1.8">
          <line x1={x - 5} y1={y - 5} x2={x + 5} y2={y + 5} />
          <line x1={x - 5} y1={y + 5} x2={x + 5} y2={y - 5} />
        </g>
      ))}
      {/* Anomalous point */}
      <g stroke="#DC2626" strokeWidth="2">
        <circle cx="300" cy="148" r="9" fill="none" strokeDasharray="3 2" />
        <line x1="295" y1="143" x2="305" y2="153" />
        <line x1="295" y1="153" x2="305" y2="143" />
      </g>
      <text x="315" y="152" fontSize="10.5" fontWeight="600" fill="#DC2626">Anomalous result</text>
    </svg>
  );
}
