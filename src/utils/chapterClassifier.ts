import type { Question } from '../types/chemistry.ts';
import { resolveModuleForChapters } from '../data/syllabus.ts';

export interface ClassifyOptions {
  isSubPart?: boolean;
  partOnlyText?: string;
}

/**
 * Syllabus-audited chapter assignments for CAIE 9701 (Coursebook 3rd Ed., Ch 01–30).
 * Enforces two strict invariants for single-chapter Basic Practice:
 * 1. On-topic: the question genuinely assesses a syllabus objective of Ch N.
 * 2. Zero forward-dependency: solving Ch N requires ONLY Ch 1..N (AS 1–18 for P1/P2;
 *    A2 19–30 + AS prerequisites for P4/P5). Any question integrating >=2 chapters or
 *    requiring a later chapter is moved to the target chapter or routed to cross-chapter
 *    Mock Exam synthesis (chapters.length >= 2).
 */
export const CURATED_CHAPTER_OVERRIDES: Record<string, number[]> = {
  // --- Rescued clean single-chapter questions (previously over-tagged as multi-chapter) ---
  'pc-s21_13-q3': [1], // Electron count of NH4+ (Ch 1 Atomic Structure)
  'pc-s25_11-q14': [2], // 3p orbital properties (Ch 2 Electrons in Atoms)
  'pc-w23_12-q2': [2], // 2nd IE of oxygen vs fluorine (Ch 2)
  'pc-m23_22-q1a': [4], // Define electronegativity (Ch 4)
  'pc-s25_12-q17': [12], // Volatility trend down Group 17 (uses earlier Ch 4 IMF)
  'pc-m25_12-q39': [14], // sp3 hybridised orbitals in but-2-ene (Ch 14)
  'pc-s25_12-q33': [16], // Hydrolysis rates of 1-halo-butanes with AgNO3(aq) (Ch 16)
  'pc-s24_12-q28': [16], // SN2 first step of 1-bromopropane + NaOH(aq) (Ch 16)
  'pc-m25_12-q27': [18], // Nucleophilic addition of HCN to propanone (Ch 18)

  // --- Ch 02 fixes (removed Period 3 & Hess cycle forward leaks) ---
  'pc-s23_11-q19': [10], // Period 3 oxide shaken with water -> pH (Ch 10 Periodicity)
  'pc-m21_12-q13': [2, 10], // Compares IE, melting point, radius of P vs Mg
  'pc-s22_12-q1': [2, 6], // Enthalpy cycle ΔH = W, X, Y, Z to find 2nd IE (needs Ch 6)

  // --- Ch 03 fixes (removed Ch 5/8/11/13/14/15/17/18 forward leaks) ---
  'pc-s25_11-q6': [3, 17], // Empirical formula + Na2CO3 effervescence (Ch 17 acid)
  'pc-s25_11-q12': [3, 11], // Barium dithionate decomposition -> BaSO4 ppt (Ch 11)
  'pc-s25_12-q15': [3, 14], // Skeletal formulae of arginine & lysine -> empirical formula
  'pc-m25_12-q25': [3, 13], // Nitrate decomposition + NO2 absorption in NaOH(aq) (Ch 13)
  'pc-m25_12-q40': [18], // M+1 peak carbon count (Ch 18.7 AS Organic MS)
  'pc-w23_12-q9': [5], // Sulfur vapour ideal gas pV = nRT (Ch 5)
  'pc-s23_12-q25': [14], // Molecular formula C6H10O from skeletal structures (Ch 14)
  'pc-s21_12-q32': [3, 15], // Straight-chain hydrocarbon Mr=84 -> C=C check (Ch 15)
  'pc-m26_22-q4a': [8], // Define weak acid + weak acid titration curve (Ch 8)
  'pc-m25_22-q1d': [18], // M / M+2 3:1 Cl isotope mass spectrum of organic D (Ch 18)

  // --- Ch 04 fixes (removed Ch 5/10/12/13/14 forward leaks) ---
  'pc-s26_12-q24': [4, 13], // NH4Cl + KOH(aq) -> NH3 & bond angle change (Ch 13)
  'pc-s25_11-q18': [12], // Group 17 halogens & H-X bond strength/stability (Ch 12)
  'pc-s21_12-q3': [4, 14], // Boiling points from skeletal formulae of organic salts/esters
  'pc-m23_22-q1e': [4, 5], // Dipole moments (Ch 4) + pV = nRT in part (e)(ii) (Ch 5)
  'pc-w21_22-q2c': [10], // Mendeleev Group 13 periodicity table trends (Ch 10)

  // --- Ch 05 fixes (removed Ch 10 Periodicity leaks) ---
  'pc-m25_12-q7': [10], // Conductivity + vigorous reaction with water -> pH (Ch 10)
  'pc-w23_22-q1a': [10], // Si->S atomic radius + melting point trend (Ch 10)

  // --- Ch 06 fixes (removed Ch 9/15/16 forward leaks) ---
  'pc-w25_12-q15': [6, 9], // Two-step reaction pathway + faster second step (Ch 9 Ea)
  'pc-s25_22-q3c': [6, 15], // Alkene diene hydrogenation + bond energy ΔH (Ch 15)
  'pc-w25_22-q3e': [6, 15], // Hexane cracking scheme + Hess cycle (Ch 15)
  'pc-w24_22-q4b': [6, 16], // 1,2-dibromoethane reaction scheme ΔH (Ch 16)
  'pc-s23_22-q4a': [6, 15], // Ethene + steam -> ethanol bond energy calculation

  // --- Ch 07 fixes (removed Ch 12 Group 17 & Ch 2/4 leaks) ---
  'pc-s26_12-q23': [12], // Strongest oxidising agent Cl2/Cl-/I2/I- (Ch 12)
  'pc-m26_12-q22': [12], // Halogen displacement 2NaX + Y2 -> 2NaY + X2 (Ch 12)
  'pc-s24_12-q19': [12], // Cl2 + cold NaOH(aq) (Ch 12)
  'pc-w23_12-q12': [12], // Cl2 + NaBr displacement & redox (Ch 12)
  'pc-m21_22-q2d': [12], // Cl2 + NaOH disproportionation equation (Ch 12)
  'pc-s22_12-q6': [2, 4], // Group 15 hydrides, H-bonding & outer electron config

  // --- Ch 08 fixes (removed Ch 17 esterification forward leak) ---
  'pc-m25_12-q6': [8, 17], // Organic acid + alcohol ⇌ ester + water Kc (Ch 17)

  // --- Ch 09 fixes (removed Ch 8 equilibrium rate graph) ---
  'pc-w23_22-q2a': [8], // Reverse reaction rate reaching dynamic equilibrium (Ch 8)

  // --- Ch 10 fixes (removed Ch 11 Group 2 leaks) ---
  'pc-s22_12-q17': [10, 11], // NH3(aq) with NaCl, MgCl2, BaCl2, SiCl4 (Ch 10 + Ch 11)
  'pc-s21_12-q35': [10, 11], // pH change of CaO (Group 2), Al2O3, SiO2 in water

  // --- Ch 11 fixes (removed Ch 1/10/13 unrelated & forward leaks) ---
  'pc-m25_12-q21': [11, 13], // River water NH4+/CO3^2- treated with Ca(OH)2
  'pc-s22_12-q25': [10, 13], // Period 3 oxide + NH4NO3 heated -> alkaline gas
  'pc-w23_12-q20': [10], // Period 3 oxides/chlorides mixtures in water -> highest pH
  'pc-m25_22-q2c': [1], // Distribution of mass in 9_4 Be atom (Ch 1)
  'pc-m23_22-q1d': [10], // SO2 + H2O & SO2 + NaOH (Ch 10 Periodicity)
  'pc-m23_22-q2a': [10], // Metallic bonding + Mg vs Na electrical conductivity (Ch 10)

  // --- Ch 12 fixes (removed Ch 13 ammonium forward leak) ---
  'pc-s23_12-q22': [12, 13], // AgNO3 white ppt (Cl-) + KOH heat -> alkaline gas (NH4+)

  // --- Ch 13 fixes (removed Ch 8 equilibrium leak) ---
  'pc-w24_12-q13': [8, 13], // Ca5(PO4)3OH(s) equilibrium shift with NH3/NH4Cl/CH3CO2H

  // --- Ch 14 fixes (removed Ch 15/16/17/18 forward leaks & inorganic bonding) ---
  'pc-s24_12-q37': [14, 15, 17, 18], // Reactions forming chiral products across Ch 15/17/18
  'pc-s23_12-q27': [14, 17], // Chiral centre + Na vs Na2CO3 functional group test
  'pc-s24_12-q4': [2, 14], // Unpaired electrons / free radical species (Cl, O-, etc.)
  'pc-s23_12-q2': [2, 14], // Free radical species among He, Be, O-, Zn
  'pc-s23_12-q6': [4, 14], // Cl-N=O σ/π bonds, polarity & sp2 hybridisation
  'pc-m24_22-q3d': [4, 14], // N2F2 dot-and-cross, sp2 & π orbital
  'pc-s24_22-q4e': [14, 16], // Hybridisation of E, F, G from bromoalkane elimination

  // --- Ch 15 fixes (removed Ch 16/17 forward leaks & Ch 4/14 π-bond) ---
  'pc-m25_12-q16': [4, 14], // π bonds in propene, HCN and CO2
  'pc-s23_12-q29': [15, 16], // Bromoethane + hot ethanolic NaOH -> gas decolourising Br2
  'pc-s21_22-q4c': [17], // Dehydration of propan-1-ol with conc. H2SO4 (Ch 17)
  'pc-m24_22-q2d': [15, 16], // Propene + Cl2 -> 1,2-dichloropropane + ethanolic NaOH (Ch 16)

  // --- Ch 16 fixes (removed Ch 15 alkane/alkene & Ch 17 nitrile hydrolysis leaks) ---
  'pc-m26_12-q28': [15], // Electrophilic addition of HCl/Br2 to propene (Ch 15)
  'pc-s25_12-q35': [15], // CH3Cl + Cl2 UV free-radical termination (Ch 15)
  'pc-m26_22-q3c': [15], // Butane + Cl2 free-radical substitution mechanism (Ch 15)
  'pc-w24_12-q30': [16, 17], // 1-bromopropane -> butanenitrile -> butanoic acid (Ch 17)
  'pc-m24_12-q37': [16, 17], // CH3CH2Br -> KCN/EtOH -> dilute HCl reflux -> propanoic acid
  'pc-w24_12-q31': [15, 16, 17], // Routes to 2-chloro-2-methylpropane (Ch 15 + 16 + 17)
  'pc-s25_22-q4b': [16, 17], // Propan-1-ol + SOCl2 -> E -> butanenitrile -> NaOH(aq)

  // --- Ch 17 fixes (removed Ch 18 ketone forward leaks) ---
  'pc-s25_12-q31': [18], // Butan-2-one + alkaline I2(aq) (Ch 18 carbonyl iodoform)
  'pc-s24_12-q27': [17, 18], // Alcohol oxidised to methyl ketone giving iodoform ppt

  // --- Ch 18 fixes (separated multi-chapter AS organic schemes into Modules) ---
  'pc-m21_12-q24': [17], // 2° alcohol oxidation to ketone with acidified K2Cr2O7 (Ch 17)
  'pc-s21_13-q28': [17, 18], // Comparing ketone/alcohol/nitrile conversion to 2-methylbutanoic acid
  'pc-w25_22-q4d': [17, 18], // Esterification condensation (Ch 17) + IR absorption (Ch 18)
  'pc-m23_22-q4d': [16, 18], // 2-bromobutane scheme (Ch 16) + IR & Br M+2 MS (Ch 18)
  'pc-s23_22-q5d': [17, 18], // Ester condensation (Ch 17) + IR differences (Ch 18)
  'pc-w23_22-q3c': [15, 17, 18], // Propene hydration + oxidation/esterification + IR
  'pc-w23_22-q3d': [17, 18], // H3PO4 + CH3OH esterification (Ch 17) + M+1 MS (Ch 18)
  'pc-w21_22-q3d': [15, 18], // Alkene + cold dilute KMnO4 (Ch 15) + 2,4-DNPH test (Ch 18)

  // --- A2 Ch 19–30 fixes (removed solvent/P5/forward leaks & cross-chapter synthesis) ---
  'pc-s25_52-q2b': [19, 23], // P5 pure calorimetry q = mcΔT (not Ch 19 Lattice Energy)
  'pc-s23_41-q1b': [19], // Cu(NO3)2 thermal decomposition analogous to Group 2 nitrates
  'pc-s24_52-q2d': [21, 24], // P5 FeSCN2+ equilibrium constant K1 (Ch 21 + Ch 24)
  'pc-s25_41-q3c': [21], // Kpc calculation with benzene solely as solvent (pure Ch 21)
  'pc-s26_42-q4c': [21], // Comparing Kpc of ethanedioic vs butanedioic acid (pure Ch 21)
  'pc-s21_41-q3d': [22, 24], // S2O8^2- + tartrate homogeneous catalysis by Fe3+ (Ch 22 + 24)
  'pc-m25_42-q6b': [24, 29], // Tartaric acid condensation + bidentate ligand (Ch 24 + 29)
  'pc-s25_42-q6d': [25, 26, 27], // 2-nitrophenol Sn/HCl reduction (Ch 27) + add-elim (Ch 26)
  'pc-w25_42-q9f': [25, 27, 29], // 4-nitrobenzoic acid + Sn/HCl (Ch 27) + step ordering (Ch 29)
  'pc-w24_41-q6e': [25, 26], // Benzene-1,2-dioic acid dehydration to cyclic anhydride
  'pc-s23_52-q1a': [21, 26], // P5 methyl benzoate density/burette practical prep
  'pc-s26_42-q8c': [25, 26], // Alkaline hydrolysis of aromatic phenol-ester K at pH 10

  // --- 2018-2020 syllabus-audited overrides (zero forward-dependency leaks) ---
  'pc-s20_12-q17': [11], // Mg -> Ba trends (Group 2 hydroxides/sulfates solubility)
  'pc-s20_12-q23': [17], // Ester X alkaline hydrolysis product formula (Ch 17)
  'pc-s20_12-q27': [14, 17], // Isomeric esters C4H8O2 count (Ch 14 + Ch 17)
  'pc-s19_22-q5c': [14, 17], // Esters X, Y, Z same molecular formula isomerism (Ch 14 + 17)
  'pc-w18_12-q1': [6], // Standard enthalpy definitions (Ch 6)
  'pc-w20_12-q4': [4, 14], // Organic compound A tetrahedral carbon geometry (Ch 4 + 14)
  'pc-w20_22-q2d': [10], // Period 3 P4O10 vs MgO melting points (Ch 10)
  'pc-s19_12-q29': [4, 17], // Ester R naming + boiling point vs butanoic acid (Ch 4 + 17)
  'pc-s19_22-q2a': [12], // Group 17 volatility trend down group (Ch 12)
  'pc-s18_12-q12': [10], // Period 3 oxides reaction with cold dilute NaOH (Ch 10)
  'pc-s18_12-q10': [8], // Reversible reaction yield shift with T and P (Ch 8)
  'pc-w19_12-q17': [12], // Solid NaI + conc H2SO4 lowest S oxidation number (Ch 12)
  'pc-s19_22-q3b': [12], // Cl2(g) + cold water disproportionation (Ch 12)
  'pc-w18_12-q17': [12], // Cl2 + hot/cold NaOH chlorate(I)/(V) (Ch 12)
  'pc-s18_22-q1a': [10], // Period 3 Na and Mg reactions with cold water (Ch 10)
  'pc-s20_12-q30': [14, 15], // Buta-1,3-diene + 2 HBr isomers (Ch 14 + 15)
  'pc-s18_12-q24': [14, 16], // Optical isomer C5H11Cl reactions (Ch 14 + 16)
  'pc-w18_12-q24': [14, 15], // Alkene Q addition polymerisation & isomerism (Ch 14 + 15)
  'pc-s18_22-q4b': [14, 18], // Structural carbonyl isomers of butanone (Ch 14 + 18)
  'pc-w18_22-q4b': [17, 18], // Ethanal -> hydroxynitrile -> hydroxy acid sequence (Ch 17 + 18)
  'pc-s20_12-q6': [3], // Minimum volume of air (21% O2) for butane combustion (Ch 3)
  'pc-w20_12-q24': [15, 16, 17], // Ethanol -> ethene & ethanol -> bromoethane catalysts
  'pc-s19_12-q25': [16], // Bromoethane elimination product (Ch 16)
  'pc-s19_22-q1b': [8, 15], // Butane isomerisation dynamic equilibrium (Ch 8 + 15)
  'pc-s19_22-q4c': [3, 15], // Ethene complete combustion gas volume stoichiometry (Ch 3 + 15)
  'pc-s20_22-q5a': [15, 16, 17], // Multi-step reaction sequence from ethene (Ch 15 + 16 + 17)
  'pc-w20_22-q4a': [17, 18], // Reactions of G with Tollens', Na, H2SO4 reflux (Ch 17 + 18)
  'pc-w18_12-q29': [15, 16, 17], // Comparing alkene/nitrile/alcohol routes to propanoic acid
  'pc-s19_12-q28': [16, 17, 18], // Carboxylic acid P from alcohol X, aldehyde Y, nitrile Z
  'pc-s18_12-q26': [17, 18], // Secondary alcohol oxidised to 6-carbon ketone (Ch 17 + 18)
  'pc-s20_42-q2c': [19], // Thermal decomposition of Group 2 iodate Mg(IO3)2 (Ch 19)
  'pc-s20_42-q4d': [25, 26], // Phenolphthalein phenol + ester hydrolysis & bromination
  'pc-s19_42-q8c': [25, 26, 27], // Phenol + Na, CH3COCl, Br2(aq), diazonium salt
  'pc-w20_42-q6e': [27, 30], // Mass spectrum fragment ion m/e = 58 of amide (Ch 27 + 30)
  'pc-s18_42-q7d': [21, 27], // Valine amino acid acting as buffer solution (Ch 21 + 27)
  'pc-s20_42-q4f': [25, 27], // Methyl orange azo dye indicator + Sn/HCl synthesis (Ch 25 + 27)
  'pc-w18_42-q3a': [24], // [Co(H2O)6]2+ ligand substitution & precipitation scheme (Ch 24)
};

export function normalizeChemistryOcr(raw: string): string {
  if (!raw) return '';
  let s = String(raw)
    .replace(/[\u0000-\u0009\u000b-\u001f\u007f-\u009f]/g, ' ')
    .replace(/[\uf044\u2206]/g, 'Δ')
    .replace(/[\uf0ae\u2192]/g, '->')
    .replace(/\uf073/g, 'σ')
    .replace(/\uf070/g, 'π')
    .replace(/\u2013|\u2014/g, '-');

  s = s
    .replace(/(?<=[A-Za-z0-9])C\s+l\b/g, 'Cl')
    .replace(/\bC\s+l(?=\s*[0-9(\-+]|$|\s+(?:ion|atom|gas|molecule))/g, 'Cl')
    .replace(/(?<=[A-Za-z0-9])A\s+l\b/g, 'Al')
    .replace(/\bA\s+l(?=\s*[0-9(\-+H]|\b)/g, 'Al')
    .replace(/(?<=[A-Za-z0-9])B\s+r\b/g, 'Br')
    .replace(/\bB\s+r(?=\s*[0-9(\-+])/g, 'Br')
    .replace(/(?<=[0-9\s(]|^)K\s+I\b/g, 'KI')
    .replace(/\bH\s+I\b/g, 'HI')
    .replace(/\bAg\s+I\b/g, 'AgI')
    .replace(/Δ\s*H/g, 'ΔH')
    .replace(/LiAl\s*H\s*4/g, 'LiAlH4')
    .replace(/\bNaBH\s*4/g, 'NaBH4')
    .replace(/\bsp\s+([23])\b/g, 'sp$1')
    .replace(/\bS\s+N\s+([12])\b/g, 'SN$1')
    .replace(/\bAl\s+2O3\b/g, 'Al2O3')
    .replace(/\bA\s+l\s*2\s*O\s*3\b/g, 'Al2O3')
    .replace(/Δ\s*H\s*(latt|hyd|sol|at|neut|c|f)\b/gi, 'ΔH$1')
    .replace(/Δ\s*([SG])\b/g, 'Δ$1')
    .replace(/\bE\s*[⦵°]\s*(cell)?\b/g, 'E°$1');

  for (let i = 0; i < 4; i++) {
    s = s
      .replace(
        /(?<![a-z]{2})([A-Z][a-z]?|\))\s+(\d+)(?!\s*(?:protons?|neutrons?|electrons?|marks?|steps?|peaks?|mol|g|cm|dm|kJ|°C|K|Pa|kPa|min|s\b))/g,
        '$1$2'
      )
      .replace(/([A-Z][a-z]?\d+)\s+([A-Z])/g, '$1$2');
  }

  s = s.replace(/LiAl\s+H4/g, 'LiAlH4').replace(/\bNaBH\s+4\b/g, 'NaBH4');
  return s.replace(/\s+/g, ' ').trim();
}

/**
 * Strict CAIE Chemistry 9701 (Ryan & Norris 3rd Edition) 30-Chapter Classifier.
 * Order: Ch 1-18 (AS), Ch 19-28 (A2), Ch 29 Organic Synthesis, Ch 30 Analytical Chemistry.
 * Enforces strict forward-dependency isolation ("后修不超前"):
 * - AS papers (Paper 1/2) never route to A2 chapters 19-30.
 * - Any question testing concepts from >=2 chapters returns all involved chapters
 *   so resolveModuleForChapters() routes it strictly to Module 01-06.
 */
export function classifyQuestionByTextbook(
  q: {
    paperNumber?: number;
    promptEn?: string;
    options?: Array<{ label: string; text: string }>;
    markSchemePoints?: string[];
  },
  optsArg: ClassifyOptions = {}
): number[] {
  const isSubPart = Boolean(optsArg.isSubPart);
  const stem = normalizeChemistryOcr(q.promptEn || '');
  const partOnly = normalizeChemistryOcr(optsArg.partOnlyText || q.promptEn || '');
  const opts = normalizeChemistryOcr((q.options || []).map((o) => o.text).join(' '));
  const ms = normalizeChemistryOcr((q.markSchemePoints || []).join(' '));
  const full = stem + '\n' + opts + '\n' + ms;
  const focus = isSubPart ? partOnly + '\n' + ms : full;

  const pNum = q.paperNumber ?? 1;
  const isASPaper = pNum === 1 || pNum === 2;
  const isA2 = pNum === 4 || pNum === 5;

  const has = (re: RegExp, txt = focus) => re.test(txt);
  const hits = new Set<number>();

  // =========================================================================
  // AS CHAPTERS (Ch 1 - 18) — STRICTLY FOR PAPER 1 & PAPER 2 ONLY
  // =========================================================================
  if (isASPaper) {
    // --- CH 1: Atomic structure ONLY ---
    const ch1Text = isSubPart ? partOnly + ' ' + ms : stem + ' ' + opts;
    if (
      has(
        /\b(proton number|nucleon number|mass number|atomic number|sub-?atomic|\d+\s*protons?.*\d+\s*neutrons?|neutrons?\s*(?:and|or|,)?\s*electrons?|protons?\s*(?:and|or|,)?\s*neutrons?|number of electrons|number of neutrons|numbers? of protons|uniform electric field|deflect.*electric field|angle of deflection|beams? of .*charged|isotopes?\b|different number of electrons|same number of electrons|isoelectronic)\b/i,
        ch1Text
      ) &&
      !has(
        /\b(relative atomic mass|relative isotopic mass|relative molecular mass|mass spectr\w*|peaks? (?:associated|in the mass)|tribromomethane|ionisation\w*|ionization\w*|orbital\w*|sub-?shells?|electronic\b.*\bconfiguration|1s\s*2s|2p6|Avogadro|moles?\b|titrat\w*|enthalp\w*|dm-3|oxidat\w*|ionic radi\w*|atomic radi\w*|radii|radius|boiling point|melting point|Period 3|Group 2|Group II|Group 17|electrolysis|electrolysed|Faraday|current of|number of electrons transferred|NMR|chemical shift|adjacent carbon|aluminium carbide|transition element)\b/i,
        full
      )
    ) {
      hits.add(1);
    }

    // --- CH 2: Electrons in atoms ---
    if (
      has(
        /\b(ionisation energ(?:y|ies)|ionization energ(?:y|ies)|successive ionisation|atomic orbital|[spd]\s*orbitals?|\borbitals?\b|principal quantum|quantum shell|electrons in boxes|unpaired electrons?|ground state|sub-?shells?|1s2|2s2|2p6|1s\s*2s\s*2p|spin-pair|electronic\b.*\bconfiguration|emission spectr(?:um|a)|atomic radi(?:us|i)|ionic radi(?:us|i)|radius of the most common ion)\b/i,
        focus
      )
    ) {
      const pureP3 =
        has(/\b(Period 3|across Period 3|Na2S|sodium and sulfur|elements in Period 3)\b/i, focus) &&
        has(/\b(atomic radi(?:us|i)|ionic radi(?:us|i))\b/i, focus) &&
        !has(/\b(ionisation|orbital|electronic\b.*\bconfiguration)\b/i, focus);
      const pureOrgOrBond =
        has(
          /\b(halogenoalkanes?|SN1|SN2|planar intermediate|carbocation|free[\s-]radicals?|overlap of two .* orbitals?|sp hybrid orbitals?|covalent bonds?)\b/i,
          focus
        ) && !has(/\b(ionisation|ionization|electrons in boxes|principal quantum|emission spectr)\b/i, focus);
      if (!pureP3 && !pureOrgOrBond) hits.add(2);
    }

    // --- CH 3: Atoms, Molecules and Stoichiometry ---
    if (
      has(
        /\b(Avogadro|empirical formula|molecular formula|relative atomic mass|relative molecular mass|relative isotopic mass|relative formula mass|mass spectr\w*.*(?:m\s*\/\s*e|abundance|peaks?|isotop\w*)|peaks? associated with O2|(?<!\[)\bAr\b\s*[=,]|(?<!\[)\bMr\b\s*[=,]|titrat\w*|titre|neutralis\w*|neutraliz\w*|hydrated|water of crystallisation|anhydrous|percentage yield|atom economy|excess.*react\w*|limiting reagent|completely combusted|completely burnt|combusts in an excess|burns in an excess of oxygen.*contains|mass of .* needed|which volume of .*mol|volume of gas is produced|which sample contains the most|releases the largest amount|how many molecules|moles? of .*react|moles? of products are formed|pair of formulae|correct formula|formula of malachite|formula Pb3O4|formula of aluminium carbide|formula unit|metal M combines with sulfur to form a metal sulfide|What is the formula of aluminium ethanedioate|standard solution|volumetric flask|pipette.*burette)\b/i,
        focus
      )
    ) {
      const pureOther = has(
        /\b(behaves ideally|ideal gas|pV\s*=\s*nRT|mcΔT|heats \d+\s*g of water|enthalpy change|bond energ(?:y|ies)|Hess|alkaline I2|hydrocarbon Q is completely combusted|decomposes.*volume of oxygen|thermal decomposition.*carbonate|1 mole of each of the following four compounds|compounds when separately heated|molecular ion peak|M\s*\+\s*1|M\s*\+\s*2|isomeric dicarboxylic|organic ion with a charge|halogenoalkanes?|2-bromo-2-methylbutane|hydrocarbon X|mass spectrum of CH3Cl|mass spectrum of tribromomethane|which compound has the molecular formula C\d+H\d+)\b/i,
        focus
      );
      const strongCh3 = has(
        /\b(empirical formula|Avogadro|relative atomic mass|relative isotopic mass|relative molecular mass|relative formula mass|water of crystallisation|percentage yield|atom economy|titrat\w*.*titre|how many molecules|which sample contains the most|formula of aluminium carbide|moles? of products are formed|volume of gas is produced|metal M combines with sulfur to form a metal sulfide)\b/i,
        focus
      );
      if (
        !pureOther ||
        (strongCh3 &&
          !has(
            /\b(molecular ion peak|M\s*\+\s*1|M\s*\+\s*2|isomeric dicarboxylic|organic ion with a charge|which compound has the molecular formula C\d+H\d+)\b/i,
            focus
          ))
      ) {
        hits.add(3);
      }
    }

    // --- CH 4: Chemical bonding ---
    if (
      has(
        /\b(dot-and-cross|dative|coordinate bond|co-ordinate bond|VSEPR|bond angles?|trigonal planar|tetrahedral|pyramidal|octahedral|bent|non-linear|electronegativity|dipole|hydrogen bond|van der Waals|instantaneous dipole|induced dipole|intermolecular forces?|covalent bond|ionic bond|metallic bond(?:ing)?|overlap of two .*orbital|lone pair|incomplete outer shell|boiling point|same shape|types of bonding|one S and two P bonds|simple covalent molecules, NH3|σ and \d*π|sigma and pi|sp hybrid orbitals?)\b/i,
        focus
      )
    ) {
      const pureOrganic =
        has(
          /\b(hybridis\w*|hybridiz\w*|sp2|sp3|alkene|methanal|ethen|benzene|delocalised.*ring|amine|amide|amino acid|DNA|polymer|NMR|hept-1,4,5-triene|hydrocarbon molecule Q|every nucleophile)\b/i,
          focus
        ) && !has(/\b(bond angles?|boiling point|overlap of two p orbitals)\b/i, focus);
      const pureCh5 =
        has(/\b(giant ionic lattice of Al|solid SiO2|each silicon atom is bonded)\b/i, focus) &&
        !has(/\b(bond angles?|electronegativity|hydrogen bond)\b/i, focus);
      if (!pureOrganic && !pureCh5) hits.add(4);
    }

    // --- CH 5: States of matter ---
    if (
      has(
        /\b(ideal gas|behaves ideally|pV\s*=\s*nRT|kinetic theory|states of matter|solid,\s*liquid and gas|two containers of methane|flask Q contains|connected at constant temperature|giant covalent|giant molecular|macromolecular|giant lattice|giant ionic lattice|lattice structure|graphite|diamond|buckminsterfullerene|silicon dioxide|silicon\(IV\) oxide|SiO2|simple molecular|ceramic|sodium chloride lattice)\b/i,
        focus
      )
    ) {
      if (
        !has(
          /\b(Period 3|across Period 3|Na2O|MgO|Al2O3|P4O10|SiCl4 is added|change in pH|phosphorus\(\s*V\s*\)\s*chloride|silicon chloride)\b/i,
          focus
        )
      ) {
        hits.add(5);
      }
    }

    // --- CH 6: Enthalpy changes ---
    if (
      /(?:ΔH|\b(?:enthalpy change|standard enthalpy|Hess.?s law|enthalpy cycle|energy cycle|calorimetr\w*|mcΔT|heats \d+\s*g of water|temperature of each.*solution|specific heat capacity|bond energ(?:y|ies)|endothermic|exothermic|temperature rises?.*mixing.*NaOH)\b)/i.test(
        focus
      )
    ) {
      const pureIE =
        has(/\b(first|second|third)\s+ionisation energ/i, focus) &&
        !has(/\b(combustion|formation|neutralis\w*|Hess|bond energ|mcΔT)\b/i, focus);
      const ch8_9 =
        has(/\b(greatest yield.*at equilibrium|increases.*yield|equilibrium|measured.*experiment 1|CO2\(g\) \+ 3H2\(g\))\b/i, focus) &&
        !has(/\b(Hess|enthalpy cycle|bond energ|mcΔT|enthalpy change)\b/i, focus);
      const ch10_or_4 =
        has(/\b(metallic bonding is stronger)\b/i, focus) && !has(/\b(Hess|enthalpy cycle|bond energ)\b/i, focus);
      if (!pureIE && !ch8_9 && !ch10_or_4) hits.add(6);
    }

    // --- CH 7: Redox reactions ---
    if (
      has(
        /\b(oxidation numbers?|oxidation states?|disproportionat\w*|oxidising agents?|reducing agents?|half-equation|redox|oxidised and reduced|concentrated nitric acid.*oxide of nitrogen|2CuSO4.*4KI|CuSO4.*KI|S2O32-.*VO2\+|S2O3.*VO2|a\s*H2SO4\s*\+\s*b\s*P)\b/i,
        focus
      )
    ) {
      const pureGr17 = has(
        /\b(Group 17|chlorine.*NaOH|hot aqueous sodium hydroxide|halide.*H2SO4|concentrated sulfuric acid.*bromide|chlorine is added to water)\b/i,
        focus
      );
      if (!pureGr17) hits.add(7);
    }

    // --- CH 8: Equilibria (AS) ---
    if (
      has(
        /\b(dynamic equilibrium|Le Chatelier|equilibrium.*container|equilibrium is reached|equilibrium constant|equilibrium can be represented|equilibrium yield|greatest yield.*at equilibrium|increase in pressure.*yield|yield of .* at equilibrium|CO2\(g\) \+ 3H2\(g\)|H2\(g\) \+ I2\(g\)|reaction vessel.*sealed.*constant|Kc\b|Kp\b|partial pressure|mole fraction|Haber process|Contact process|Brønsted|Bronsted-Lowry|position of equilibrium|weak acid.*HQ|gas syringe.*hydrogen iodide|ethanoic acid dissociates in water)\b/i,
        focus
      )
    ) {
      hits.add(8);
    }

    // --- CH 9: Rates of reaction (AS) ---
    if (
      has(
        /\b(Boltzmann|Maxwell-Boltzmann|collision theory|molecules collide|effective collision|activation energy|average kinetic energy of the reacting|heterogeneous catalyst|homogeneous catalyst|suitable catalyst|average rate of the reaction|rate of formation.*measured|volume of ammonia produced against time|decomposition of .*hydrogen peroxide|2H2O2.*2H2O \+ O2.*total volume|initial rate of production of CO2)\b/i,
        focus
      ) ||
      (has(/\brate of reaction\b/i, focus) && !has(/\b(ethanol reacts with sodium|ethoxide)\b/i, focus))
    ) {
      const pureCh13 = has(/\b(catalytic converter)\b/i, focus) && !has(/\b(Boltzmann|activation energy)\b/i, focus);
      const pureOrgSynth =
        has(/\b(butanenitrile|butylamine|nitrile|ethanol reacts with sodium|ethoxide)\b/i, focus) &&
        !has(/\b(Boltzmann|activation energy)\b/i, focus);
      if (!pureCh13 && !pureOrgSynth) hits.add(9);
    }

    // --- CH 10: Periodicity ---
    if (
      has(
        /\b(Period 3|across Period 3|third period|Na2O|MgO|Al2O3|P4O10|P4O6|SiCl4|AlCl3|Al2Cl6|PCl5|oxides? of Period 3|chlorides? of Period 3|sodium and sulfur|atomic radius and ionic radius of sodium|Na2S|oxide and chloride of an element|chloride of element.*oxide of element|MgCl2.*Al2Cl6|NaCl\(aq\), MgCl2\(aq\), BaCl2\(aq\) and SiCl4|Sodium is added to water to form solution Y|oxides will cause a change in pH|phosphorus\(\s*V\s*\)\s*chloride.*added to water)\b/i,
        focus
      )
    ) {
      hits.add(10);
    }

    // --- CH 11: Group 2 ---
    if (
      has(
        /\b(Group 2|Group II|alkaline earth|thermal decomposition.*(carbonate|nitrate)|carbonate.*decompose in the heat|solubility.*(hydroxide|sulfate|sulphate)|Sr\(NO3\)2|BaSO4|Mg\(OH\)2|Ca\(OH\)2|Ba\(OH\)2|Group 2 ion.*Mg2\+|BaCl2\s*\(aq\)\s*MgCl2)\b/i,
        focus
      ) ||
      (has(/\b(magnesium|calcium|strontium|barium)\b/i, focus) &&
        has(/\b(carbonate|nitrate|hydroxide|sulfate|sulphate|water|steam|acid)\b/i, focus) &&
        !has(/\b(Period 3|calcium carbide|lattice energy|SiCl4|dithionate|change in pH)\b/i, focus))
    ) {
      hits.add(11);
    }

    // --- CH 12: Group 17 ---
    if (
      has(
        /\b(Group 17|Group VII|volatility of the halogens|halogens? decreases down|different halogens.*aqueous solutions|halide ion|silver nitrate|AgNO3|silver halides?|concentrated sulfuric acid.*(halide|NaCl|NaBr|NaI|KI|KBr|bromide|iodide|chloride)|sodium bromide.*sulfuric acid|chlorine.*NaOH|hot aqueous sodium hydroxide|chlorine is added to water|disproportionat.*chlorine|bleach|displacement.*halide)\b/i,
        focus
      )
    ) {
      const pureCh16Org =
        has(
          /\b(halogen in an organic compound|by an SN1|by an SN2|halogenoalkanes?|chloroalkanes?|bromoalkanes?|iodoalkanes?|methylpropane)\b/i,
          focus
        ) && !has(/\b(Group 17|concentrated sulfuric acid|ammonia solution|dissolves in dilute)\b/i, focus);
      if (!pureCh16Org) hits.add(12);
    }

    // --- CH 13: Nitrogen and sulfur ---
    if (
      /NH4\s*\+|\(NH4\)2SO4/.test(focus) ||
      has(
        /\b(photochemical smog|PAN\b|peroxyacetyl nitrate|acid rain|oxides of nitrogen|NOx\b|catalytic converter|ammonium ions?|ammonium.*NaOH|lack of reactivity of nitrogen|triple bond.*nitrogen|sulfur.*oxygen.*NO|SO2.*NO|flue gas|Mohr\s*['\u2019]?\s*s\s+salt|NH4Cl|too much NH4NO3 is applied to crops|used as fertilisers.*nitrogen|percentages by mass of nitrogen|Methylamine reacts with hydrogen chloride)\b/i,
        focus
      )
    ) {
      hits.add(13);
    }

    // --- CH 14: Introduction to Organic Chemistry ---
    if (
      /\bthree σ\b|three σ\s*bonds/i.test(focus) ||
      has(
        /\b(skeletal formula|displayed formula|structural isomers?|positional isomers?|chain isomers?|functional group isomers?|stereoisomer\w*|geometrical isomer\w*|cis[\-/]trans|E\/Z|chiral (?:cent(?:re|er)s?|carbon)|optical isomer\w*|enantiomer\w*|hybridis\w*|hybridiz\w*|sp2|sp3|sp hybrid orbitals?|σ bonds|π bonds|methanal.*planar|planar.*methanal|free[\s-]radicals?|homolytic|heterolytic|IUPAC|systematic name|isomers?.*C\d+H\d+|which compound has the molecular formula C\d+H\d+|isomeric hydrocarbon|ratio of hydrogen atoms to carbon atoms|alcohols of each type with the formula C5H12O|hydrocarbon molecule Q|hept-1,4,5-triene|every nucleophile|isomeric dicarboxylic)\b/i,
        focus
      )
    ) {
      const pureCh15 = has(
        /\b(methane and bromine react by free radical|methane with chlorine|free radical substitution)\b/i,
        focus
      );
      if (!pureCh15) hits.add(14);
    }

    // --- CH 15: Hydrocarbons ---
    if (
      has(
        /\b(alkane|alkene|ethane|ethene|propane|propene|butane|butene|pent-2-ene|methylpropene|2-methylpent-2-ene|limonene|cracking|free[\s-]radical substitution|propagation step|initiation.*propagation|electrophilic addition|carbocation|organic intermediate|Markovnikov|cold.*dilute.*MnO4|hot.*concentrated.*MnO4|bromine water|decolouris\w*.*bromine|addition polymer\w*|polymer chain of PVC|prop-2-en-1-ol.*polymer|repeat unit of a polymer|excess of hydrogen gas in the presence of a nickel catalyst|hydrocarbon Q is completely combusted|reacts completely with two moles of hydrogen bromide)\b/i,
        focus
      )
    ) {
      if (
        !has(
          /\b(halogenoalkanes?|bromoalkanes?|iodoalkanes?|ethanol.*major|dehydration of hexan|benzene|phenol|amide|polyester|nylon)\b/i,
          focus
        )
      ) {
        hits.add(15);
      }
    }

    // --- CH 16: Halogenoalkanes ---
    if (
      has(
        /\b(halogenoalkanes?|bromoalkanes?|chloroalkanes?|iodoalkanes?|1-bromopropane|2-chloropropane|2-chloro-2-methylpropane|2-bromomethylpropane|2-bromo-2-methylbutane|2-chloro-2-methylbutane|bromomethylpropane|chloromethylpropane|dibromo compound|SN1|SN2|nucleophilic substitution|ethanolic.*NaOH|concentrated NaOH in ethanol|ethanolic.*KOH|KCN in ethanol|elimination.*alkene|CFC|chlorofluorocarbon|ozone|irradiated with ultraviolet light|halogen in an organic compound|nitrile.*hydroxynitrile|butanenitrile)\b/i,
        focus
      )
    ) {
      hits.add(16);
    }

    // --- CH 17: Alcohols, Esters and Carboxylic Acids ---
    if (
      has(
        /\b(primary alcohol|secondary alcohol|tertiary alcohol|react with ethanol|added to ethanol|ethanol and sodium|ethanol reacts with sodium|ethoxide|dehydration of .*ol\b|butan-\d-ol|propan-\d-ol|2-methylbutan-1-ol|3-methylbutan-2-ol|hexan-2-ol|esterification|ethyl ethanoate|ethyl butanoate|propyl ethanoate|ethyl propanoate|hydrolysis of .*ester|diagrams? show the structures of two esters|ester\. It is heated under reflux|CH3CO2CH2CH2CO2H|C2H5COOCH3|ester.*R'CO2R|CH3CO2CH3|CH3CO2CH2|lactide|alkaline aqueous iodine|alkaline I2|iodoform|tri-iodomethane|acidified K2Cr2O7|acidified potassium dichromate|propanoic acid|ethanoic acid.*(?:LiAlH4|sodium carbonate)|CH3COOH \+ MgCO3|CH3CO2H.*LiAlH4|LiAlH4.*CH3CO2H|pure ethanoic acid|1 mole of each of the following four compounds.*excess of sodium carbonate|excess of NaOH.*excess of sodium|hexadecanoic acid|reagent for stage 1 is concentrated H2SO4|mixtures form a carboxylic acid|CH3CH\(OH\)CH2COOH|\(CH2COOH\)2|dicarboxylic acids?|organic ion with a charge|SOCl2.*PCl5.*alcohol|liquid SOCl2|solid PCl5)\b/i,
        focus
      )
    ) {
      hits.add(17);
    }

    // --- CH 18: Carbonyl Compounds (+ Section 18.7 AS IR & Organic MS) ---
    if (
      has(
        /\b(aldehyde|ketone|ethanal|propanal|propanone|butanone|pentan-2-one|carbonyl compound|Tollens|Fehling|2,4-DNPH|2,4-dinitrophenylhydrazine|nucleophilic addition.*(HCN|CN|RLi|pentan-2-one)|cyanohydrin|NaBH4|LiAlH4.*(aldehyde|ketone)|converted into compound Y in a single step)\b/i,
        focus
      ) ||
      /C2H5CH\(OH\)\(CN\)/.test(focus) ||
      has(
        /(infrared|infra-red|wavenumber|molecular ion peak|M\s*\+\s*1|M\s*\+\s*2|\bm\s*\/\s*e value of \d+.*relative abundance|mass spectrum of (?:CH3Cl|vitamin C|hydrocarbon|compound|tribromomethane))/i,
        focus
      )
    ) {
      hits.add(18);
    }
  }

  // =========================================================================
  // A2 CHAPTERS (Ch 19 - 30) — STRICTLY FOR PAPER 4 & PAPER 5 ONLY
  // =========================================================================
  if (isA2) {
    // --- CH 19: Lattice energy, Born-Haber, Solution Enthalpy & A2 Group 2 Polarisation ---
    if (
      /(?:Δ|∆)\s*H\s*(?:latt|hyd|sol|at)\b/i.test(focus) ||
      has(
        /\b(lattice energy|Born-Haber|electron affinity|enthalpy.*atomisation|enthalpy.*hydration|enthalpy.*solution|polarising power|charge density.*(?:cation|ion)|polarisation.*(?:nitrate|carbonate|hydroxide|anion)|distortion of.*(?:nitrate|carbonate|hydroxide|anion)|thermal stability of.*(?:Group 2|nitrates?|carbonates?|hydroxides?)|similar to the thermal decomposition of Group 2|(?:magnesium|calcium|strontium|barium)\s+nitrate|MgSO4.*7H2O|hydration of .*anhydrous)\b/i,
        focus
      ) ||
      (pNum === 5 &&
        /q\s*=\s*mc(?:Δ|∆)T/i.test(focus) &&
        !has(/\b(entropy|Gibbs|rate|equilibrium|pH)\b/i, focus)) ||
      (pNum === 5 &&
        has(/\b(enthalpy change.*(?:positive or negative|neutralisation|reaction between))\b/i, focus))
    ) {
      hits.add(19);
    }

    // --- CH 20: Electrochemistry ---
    if (
      /\bE\s*(?:cell\s*)?(?:°|⦵|o\s*(?:[–-]|=))\s*(?:[Cc]ell)?/.test(focus) ||
      has(
        /\b(electrode potentials?|standard hydrogen electrode|half-cell|Ecell|Nernst|Faraday|Q\s*=\s*It|current of .* A.*passed|electrolys(?:e|ed|is).*(?:mass|charge|current|mol|passed|cathode|anode)|cell potentials?|electrochemical cell|(?:positive|negative) electrode.*half-?equation|iodates?|sodium iodate)\b/i,
        focus
      ) ||
      /I\s*O3\s*[–-]/i.test(focus) ||
      (has(/\b(electrolys(?:e|ed|is)|current of .* A|cathode|anode|electrode potential)\b/i, full) &&
        has(
          /\b(electrons transferred|Faraday|Q\s*=\s*It|current|charge|coulombs?|mass of .* deposited|disproportionat)\b/i,
          focus
        ))
    ) {
      hits.add(20);
    }

    // --- CH 21: Further aspects of equilibria ---
    if (
      has(
        /\b(Ka\b|pKa\b|Kw\b|buffer|titration curve|equivalence point|solubility product|Ksp\b|common ion|partition coefficient|Kpc\b|calculate.*pH|define pH|pH of|conjugate acid-base|weak acid.*dissociat|dissociation of ethanoic acid)\b/i,
        focus
      ) ||
      (pNum === 5 &&
        has(
          /\b(equilibrium constant|concentration of solution Y|titrat\w*.*conical flask|indicator.*methyl orange|FeSCN2\+)\b/i,
          focus
        ))
    ) {
      hits.add(21);
    }

    // --- CH 22: Reaction kinetics (A2) & Catalysis ---
    if (
      has(
        /\b(rate equation|rate constant|order of reaction|(?:zero|first|second)[\s-]order|half-life|rate-determining step|initial rate|homogeneous catalys\w*|heterogeneous catalys\w*|type of catalysis|mode of action of a .* catalyst|catalyses the decomposition|adsorb(?:ed|s)? .*surface of .*catalyst|catalytic converter)\b/i,
        focus
      )
    ) {
      hits.add(22);
    }

    // --- CH 23: Entropy & Gibbs ---
    if (
      /(?:Δ|∆)\s*[SG]\b/.test(focus) ||
      has(/\b(entropy|Gibbs|feasibility of this reaction|less feasible|more feasible|spontaneous)\b/i, focus)
    ) {
      hits.add(23);
    }

    // --- CH 24: Transition elements ---
    if (
      /\[(?:Cu|Fe|Cr|Co|Ni|Mn|Ag|Pt|Ti|V|Ru)\([^)]+(?:\)[^)]*)*\)\]/i.test(focus) ||
      /(?:VO3|VO2|MnO4)\s*[–-]/i.test(focus) ||
      has(
        /\b(transition elements?|transition metals?|vanadium|ligands?|monodentate|bidentate|polydentate|EDTA|complex(?:es| ions?)?|coordination number|co-ordination number|degenerate d orbitals?|3d\s*(?:z2|x2-y2|xy|xz|yz|orbitals?)|d-orbital|d orbital|Kstab|stability constant|ligand exchange|variable oxidation states?|Tollens|AgNO3.*NH3|Ag2O.*NH3|Cu\(NO3\)2|Cu\(OH\)2|FeSCN2\+|VO2\+|V2\+|MnO4\s*[–-].*(?:Fe2\+|C2O4|V2\+)|S2O8\s*2[–-].*(?:Fe2\+|Fe3\+|tartrate)|catalytic converter|Pt,\s*Pd,\s*Rh|platinum,\s*palladium)\b/i,
        focus
      ) ||
      (has(
        /\b(transition elements?|complex(?:es| ions?)?|ligands?|cobalt|chromium|vanadium|copper\(II\)|\[(?:Cu|Fe|Cr|Co|Ni|Mn|Ag|Pt|Ti|V|Ru)\([^)]+(?:\)[^)]*)*\)\])\b/i,
        full
      ) &&
        has(
          /\b(octahedral|tetrahedral|square planar|isomeric forms|stereoisomers|precipitate|colour|oxidation state|electronic configuration|Co2\+|Cr2\+|Cr3\+|Cu2\+|Cu\+|V2\+)\b/i,
          focus
        ))
    ) {
      hits.add(24);
    }

    // --- CH 25: Benzene and Its Compounds ---
    if (
      has(
        /\b(benzene|arene|methylbenzene|diethylbenzene|nitrobenzoic|cumene|phenol|nitrophenol|phenoxide|electrophilic substitution|Friedel-Crafts|2,4-directing|3-directing|delocalised.*ring)\b/i,
        focus
      ) ||
      (isSubPart &&
        has(/\b(benzene|chlorobenzene|methylbenzene|phenol|cumene|arene|phenyl)\b/i, full) &&
        has(/\b(hybridis\w*|sp2|sp3|σ|π|delocalised|electrophil|curly arrow|directing|mechanism|systematic name)\b/i, focus)) ||
      (has(/\bpH 10\b/i, focus) && has(/-ONa|phenoxide/i, focus))
    ) {
      const pureCh29Synth =
        isSubPart &&
        has(/\b(multi-step|two-step|three-step|synthetic route|reaction scheme|reagents and conditions for step)\b/i, full) &&
        !has(/\b(electrophilic substitution|nitration|mechanism|acidity of phenol|weak acid|bromine water|cumene|systematic name)\b/i, focus);
      const benzeneOnlyAsKpcSolvent =
        has(/\b(Kpc|partition coefficient|shaken with .*benzene)\b/i, focus) &&
        !has(/\b(electrophilic substitution|nitration|Friedel-Crafts|phenol|delocalised)\b/i, focus);
      if (!pureCh29Synth && !benzeneOnlyAsKpcSolvent) hits.add(25);
    }

    // --- CH 26: Carboxylic acids & their derivatives (A2) ---
    if (
      /COCl\b/.test(focus) ||
      has(
        /\b(acyl chlorides?|[a-z]+oyl chloride|SOCl2|PCl3.*COOH|PCl5.*COOH|addition-elimination|relative acidit\w*|acid strength|(?:stronger|weaker) acid.*ethanoic|(?:chloro|dichloro|trichloro|bromo|dibromo|fluoro)ethanoic|2-chloropropanoic|ethanedioic acid|BaC2O4|HOOCCOOH|HO2CCO2H|(?:HCOOH|methanoic acid).*(?:oxid|MnO4|KMnO4|Tollens|Fehling)|propanoic acid.*chlorine|relative (?:ease|rate)s? of hydrolysis|ease of hydrolysis of|alkaline hydrolysis|methyl benzoate|systematic name of ester)\b/i,
        focus
      ) ||
      (has(/\b(ethanedioate|C2O4)\b/i, focus) &&
        has(/\b(decompos\w*|MnO4|KMnO4|oxid\w*|titrat\w*)\b/i, focus) &&
        !has(/\b(complex|ligand|d-orbital|d orbital|splitting|coloured)\b/i, focus))
    ) {
      const pureCh28 =
        isSubPart &&
        has(/\b(condensation polymer|polyester|polyamide|repeat unit)\b/i, focus) &&
        !has(/\b(addition-elimination|relative ease of hydrolysis|SOCl2)\b/i, focus);
      const pureCh21Kpc =
        has(/\b(Kpc|partition coefficient)\b/i, focus) &&
        !has(/\b(addition-elimination|acyl chloride|SOCl2|relative acidit|oxid)\b/i, focus);
      if (!pureCh28 && !pureCh21Kpc) hits.add(26);
    }

    // --- CH 27: Organic nitrogen compounds ---
    if (
      has(
        /\b(phenylamine|trimethylphenylamine|ethylamine|methylamine|propylamine|benzylamine|basicit\w*.*amines?|weaker base.*amines?|relative basicit\w*|diazonium|azo dye|dye molecule|N2\s*\+\s*Cl|amides?|propanamide|amino acids?|zwitterions?|isoelectric point|peptides?|electrophoresis)\b/i,
        focus
      ) ||
      (has(/\bamine\b/i, focus) && has(/\bcarboxylic acid\b/i, focus))
    ) {
      const pureCh28 =
        isSubPart &&
        has(/\b(polyamide|polypeptide|poly\([a-z]+\)|repeat unit|condensation polymer|biodegrad\w*)\b/i, focus) &&
        !has(/\b(isoelectric|zwitterion|electrophoresis|basicit\w*|diazonium|azo dye|dye molecule)\b/i, focus);
      const pureCh29Synth =
        isSubPart &&
        has(/\b(two-step|multi-step|three-step|synthetic route|reaction scheme)\b/i, full) &&
        !has(/\b(basicit\w*|isoelectric|zwitterion|electrophoresis|amino acid|phenylamine|diazonium|azo dye|dye molecule|N2\s*\+\s*Cl)\b/i, focus);
      if (!pureCh28 && !pureCh29Synth) hits.add(27);
    }

    // --- CH 28: Polymerisation (Coursebook 3rd Ed. Ch 28) ---
    if (
      has(
        /\b(condensation polymer|polyamide|polypeptide|nylon|Kevlar|polyester|Terylene|biodegrad\w*|photodegrad\w*|degradable polymer|repeat unit|polylactic|PLA\b|poly\([a-z]+\)|hydrolysis of .*polymer|monomer.*polymer|addition polymer.*condensation|condensation polymer.*addition|polymer chain|two repeat units)\b/i,
        focus
      )
    ) {
      hits.add(28);
    }

    // --- CH 29: Organic synthesis (Coursebook 3rd Ed. Ch 29) ---
    if (
      has(
        /\b(synthetic route|multi-step|multi-stage|two-step synthesis|three-step synthesis|two-step reaction|design a synthesis|three different syntheses|steps? 1 to \d|reagents and conditions for (?:each of )?steps?|chiral drug|single enantiomer|pure enantiomer|racemic mixture|biological activity.*enantiomer|step 1 and (?:step )?2|define enantiomers|two enantiomers|enantiomers?\b|chiral (?:carbon|cent(?:re|er))|three-dimensional diagrams of the two stereoisomers|Diels.?Alder)\b/i,
        focus
      ) ||
      (isSubPart &&
        has(/\b(synthetic route|two-step synthesis|three-step synthesis|multi-step|reaction scheme)\b/i, full) &&
        has(/\b(reagents and conditions|step 1|step 2|reaction 1|reaction 2|intermediate|boxes in Fig)\b/i, focus))
    ) {
      const pureCh30Analyt = has(/(NMR|chromatography|infrared|wavenumber)/i, focus);
      const pureCh28 = has(/\b(polymer|repeat unit|polyamide|polyester)\b/i, focus);
      const pureCh22 = has(/\b(rate equation|rate-determining|mechanism.*NO)\b/i, focus);
      const pureInorg = has(/\b(Tollens|ligand|ZnS|ZnO)\b/i, focus);
      if (!pureCh30Analyt && !pureCh28 && !pureCh22 && !pureInorg) hits.add(29);
    }

    // --- CH 30: Analytical chemistry (Coursebook 3rd Ed. Ch 30) ---
    if (
      has(
        /(NMR|chemical shift|TMS|tetramethylsilane|splitting pattern|D2O|chromatography|\bTLC\b|\bGLC\b|\bRf value\b|retention time|infrared|infra-red|wavenumber|17\d0\s*cm|32\d0\s*cm|M\s*\+\s*1|M\s*\+\s*2|molecular ion peak)/i,
        focus
      )
    ) {
      hits.add(30);
    }
  }

  return Array.from(hits).sort((a, b) => a - b);
}

/**
 * Forward-dependency guard ("后修不超前") + Paper-level Syllabus Boundary:
 * - Paper 1 & Paper 2 (AS): strictly Chapters 1-18 only.
 * - Paper 4 & Paper 5 (A2): strictly Chapters 19-30 only.
 * - Any question spanning >=2 chapters within its syllabus tier routes to STUDY_MODULES.
 */
export function enforceForwardDependencyIsolation(q: Question): Question {
  const isASPaper = q.paperNumber === 1 || q.paperNumber === 2;
  const isA2Paper = q.paperNumber === 4 || q.paperNumber === 5;

  const curated = CURATED_CHAPTER_OVERRIDES[q.id];
  if (curated && curated.length > 0) {
    const cleanCurated = Array.from(
      new Set(
        curated.filter((c) => {
          if (!Number.isInteger(c) || c < 1 || c > 30) return false;
          if (isASPaper) return c <= 18;
          if (isA2Paper) return c >= 19;
          return true;
        })
      )
    ).sort((a, b) => a - b);

    if (cleanCurated.length > 0) {
      return {
        ...q,
        chapters: cleanCurated,
        moduleId: resolveModuleForChapters(cleanCurated),
      };
    }
  }

  const validStored = Array.from(
    new Set(q.chapters.filter((c) => Number.isInteger(c) && c >= 1 && c <= 30))
  ).sort((a, b) => a - b);

  const isSubPart = q.paperNumber !== 1 && /-q\d+[a-f]$/.test(q.id);
  let partOnlyText: string | undefined;
  if (isSubPart && q.subPart && q.promptEn) {
    const escaped = q.subPart.replace(/[()]/g, '\\$&');
    const idx = q.promptEn.search(new RegExp(`(?:^|\\n)\\s*${escaped}`));
    if (idx >= 0) {
      partOnlyText = q.promptEn.slice(idx).trim();
    }
  }
  const detected = classifyQuestionByTextbook(q, { isSubPart, partOnlyText });

  const base = (
    isASPaper
      ? validStored.filter((c) => c <= 18)
      : isA2Paper
        ? validStored.filter((c) => c >= 19)
        : validStored
  ).sort((a, b) => a - b);

  let chapters: number[];
  if (detected.length > 0) {
    const baseCoversDetected = base.length >= 2 && detected.every((c) => base.includes(c));
    chapters = baseCoversDetected ? base : detected;
  } else {
    chapters = base.length > 0 ? base : isA2Paper ? [19] : [1];
  }

  if (isASPaper) {
    const asOnly = chapters.filter((c) => c <= 18);
    chapters = asOnly.length > 0 ? asOnly : [1];
  } else if (isA2Paper) {
    const a2Only = chapters.filter((c) => c >= 19);
    chapters = a2Only.length > 0 ? a2Only : [19];
  }

  return {
    ...q,
    chapters,
    moduleId: resolveModuleForChapters(chapters),
  };
}
