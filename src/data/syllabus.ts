import type { Chapter, StudyModule } from '../types/chemistry.ts';

export const CHAPTERS: Chapter[] = [
  // AS Physical Chemistry (Ch 1 - 9)
  {
    id: 1,
    code: 'Ch 01',
    titleEn: 'Atomic Structure',
    titleZh: '原子结构（亚原子粒子与同位素）',
    level: 'AS',
    branch: 'Physical',
    keyTopics: ['Subatomic particles (p, n, e)', 'Behaviour in electric field', 'Proton & nucleon numbers', 'Isotopes'],
  },
  {
    id: 2,
    code: 'Ch 02',
    titleEn: 'Electrons in Atoms',
    titleZh: '原子中的电子排布与电离能',
    level: 'AS',
    branch: 'Physical',
    keyTopics: ['Emission spectra & shells', 's, p, d, f orbitals & configurations', 'Atomic & ionic radii trends', 'Ionisation energy patterns'],
  },
  {
    id: 3,
    code: 'Ch 03',
    titleEn: 'Atoms, Molecules and Stoichiometry',
    titleZh: '化学计量学、质谱相对质量与摩尔计算',
    level: 'AS',
    branch: 'Physical',
    keyTopics: ['Ar, Mr & mass spectrometry', 'Mole & Avogadro constant', 'Empirical & molecular formulae', 'Titration & gas volumes'],
  },
  {
    id: 4,
    code: 'Ch 04',
    titleEn: 'Chemical Bonding',
    titleZh: '化学键、分子构型与分子间作用力',
    level: 'AS',
    branch: 'Physical',
    keyTopics: ['Ionic, covalent & dative bonding', 'VSEPR shapes & bond angles', 'Metallic bonding & electronegativity', 'Intermolecular forces & H-bonding'],
  },
  {
    id: 5,
    code: 'Ch 05',
    titleEn: 'States of Matter',
    titleZh: '物质状态、理想气体与晶体结构',
    level: 'AS',
    branch: 'Physical',
    keyTopics: ['Ideal gas equation pV = nRT', 'Giant ionic & metallic lattices', 'Giant covalent (diamond/graphite/SiO2)', 'Simple molecular solids & ceramics'],
  },
  {
    id: 6,
    code: 'Ch 06',
    titleEn: 'Enthalpy Changes',
    titleZh: '焓变、量热法与赫斯定律',
    level: 'AS',
    branch: 'Physical',
    keyTopics: ['Standard enthalpy definitions', 'Calorimetry q = mcΔT', 'Hess’s Law cycles', 'Average bond energies'],
  },
  {
    id: 7,
    code: 'Ch 07',
    titleEn: 'Redox Reactions',
    titleZh: '氧化还原反应与氧化数',
    level: 'AS',
    branch: 'Physical',
    keyTopics: ['Electron transfer & redox', 'Oxidation numbers & naming', 'Balancing redox half-equations', 'Electrolysis redox intro'],
  },
  {
    id: 8,
    code: 'Ch 08',
    titleEn: 'Equilibria',
    titleZh: '化学平衡与酸碱基础',
    level: 'AS',
    branch: 'Physical',
    keyTopics: ['Dynamic equilibrium & Le Chatelier', 'Kc & Kp expressions', 'Haber & Contact process', 'Brønsted–Lowry acids/bases'],
  },
  {
    id: 9,
    code: 'Ch 09',
    titleEn: 'Rates of Reaction',
    titleZh: '反应速率与玻尔兹曼分布',
    level: 'AS',
    branch: 'Physical',
    keyTopics: ['Collision theory & concentration', 'Boltzmann distribution & temperature', 'Activation energy Ea', 'Homogeneous & heterogeneous catalysts'],
  },

  // AS Inorganic Chemistry (Ch 10 - 13)
  {
    id: 10,
    code: 'Ch 10',
    titleEn: 'Periodicity',
    titleZh: '第三周期元素周期性',
    level: 'AS',
    branch: 'Inorganic',
    keyTopics: ['Period 3 melting point & conductivity', 'Reactions with O2, Cl2, H2O', 'Period 3 oxides & acid-base behaviour', 'Period 3 chlorides hydrolysis'],
  },
  {
    id: 11,
    code: 'Ch 11',
    titleEn: 'Group 2',
    titleZh: '第 2 族（碱土金属）化学',
    level: 'AS',
    branch: 'Inorganic',
    keyTopics: ['Reactions with O2, H2O, dilute acids', 'Thermal decomposition of carbonates/nitrates', 'Solubility of hydroxides & sulfates'],
  },
  {
    id: 12,
    code: 'Ch 12',
    titleEn: 'Group 17',
    titleZh: '第 17 族（卤素）化学',
    level: 'AS',
    branch: 'Inorganic',
    keyTopics: ['Volatility & oxidising power', 'Halide ions + conc. H2SO4', 'AgNO3 / NH3 halide tests', 'Cl2 + water & cold/hot NaOH'],
  },
  {
    id: 13,
    code: 'Ch 13',
    titleEn: 'Nitrogen and Sulfur',
    titleZh: '氮与硫及其环境化学',
    level: 'AS',
    branch: 'Inorganic',
    keyTopics: ['N2 unreactivity & NH3 / NH4+ tests', 'Oxides of nitrogen & catalytic converters', 'SO2, Contact process & acid rain', 'Photochemical smog & PAN'],
  },

  // AS Organic Chemistry (Ch 14 - 18)
  {
    id: 14,
    code: 'Ch 14',
    titleEn: 'Introduction to Organic Chemistry',
    titleZh: '有机化学导论与同分异构',
    level: 'AS',
    branch: 'Organic',
    keyTopics: ['Formulae & IUPAC nomenclature', 'Reaction types & fission mechanisms', 'σ / π bonds & sp/sp2/sp3 hybridisation', 'Structural, E/Z & optical isomerism'],
  },
  {
    id: 15,
    code: 'Ch 15',
    titleEn: 'Hydrocarbons',
    titleZh: '烃类：烷烃与烯烃反应机理',
    level: 'AS',
    branch: 'Organic',
    keyTopics: ['Alkanes & free-radical substitution', 'Alkenes & electrophilic addition', 'Markovnikov carbocation stability', 'KMnO4 oxidation & addition polymers'],
  },
  {
    id: 16,
    code: 'Ch 16',
    titleEn: 'Halogenoalkanes',
    titleZh: '卤代烃：SN1/SN2 取代与消去',
    level: 'AS',
    branch: 'Organic',
    keyTopics: ['SN1 vs SN2 mechanisms', 'Hydrolysis rates (C–X bond)', 'Elimination with ethanolic NaOH', 'Nitrile/amine formation & CFCs'],
  },
  {
    id: 17,
    code: 'Ch 17',
    titleEn: 'Alcohols, Esters and Carboxylic Acids',
    titleZh: '醇、酯与羧酸的性质与反应',
    level: 'AS',
    branch: 'Organic',
    keyTopics: ['1°/2°/3° alcohols & oxidation', 'Dehydration & halogenation (PCl5/SOCl2)', 'Esterification & hydrolysis', 'Carboxylic acid reactions & iodoform'],
  },
  {
    id: 18,
    code: 'Ch 18',
    titleEn: 'Carbonyl Compounds',
    titleZh: '羰基化合物：醛与酮的鉴别及加成',
    level: 'AS',
    branch: 'Organic',
    keyTopics: ['Tollens’ & Fehling’s oxidation tests', '2,4-DNPH & nucleophilic addition (HCN)', 'Reduction with NaBH4 / LiAlH4', 'AS Mass spectrometry & IR spectroscopy'],
  },

  // A2 Physical Chemistry (Ch 19 - 23)
  {
    id: 19,
    code: 'Ch 19',
    titleEn: 'Lattice Energy',
    titleZh: '晶格能、玻恩-哈伯循环与溶解焓',
    level: 'A2',
    branch: 'Physical',
    keyTopics: ['Lattice energy & electron affinity', 'Born-Haber cycles', 'Enthalpy of hydration & solution', 'Charge density & ion polarisation'],
  },
  {
    id: 20,
    code: 'Ch 20',
    titleEn: 'Electrochemistry',
    titleZh: '电化学、电极电势与电解定量',
    level: 'A2',
    branch: 'Physical',
    keyTopics: ['Quantitative electrolysis (Q = It = zFn)', 'Standard electrode potentials E° & SHE', 'Feasibility predictions', 'Nernst equation'],
  },
  {
    id: 21,
    code: 'Ch 21',
    titleEn: 'Further Aspects of Equilibria',
    titleZh: '高阶平衡：pH、缓冲溶液与溶度积',
    level: 'A2',
    branch: 'Physical',
    keyTopics: ['Kw, Ka, pKa & pH calculations', 'Titration curves & indicators', 'Buffer solutions', 'Solubility product Ksp & partition Kpc'],
  },
  {
    id: 22,
    code: 'Ch 22',
    titleEn: 'Reaction Kinetics',
    titleZh: 'A2 反应动力学：速率方程与机理',
    level: 'A2',
    branch: 'Physical',
    keyTopics: ['Rate equations & reaction orders', 'Rate constant k & half-life t1/2', 'Initial-rate & graph deductions', 'Rate-determining step & catalysis'],
  },
  {
    id: 23,
    code: 'Ch 23',
    titleEn: 'Entropy and Gibbs Free Energy',
    titleZh: '熵变 ΔS 与吉布斯自由能 ΔG',
    level: 'A2',
    branch: 'Physical',
    keyTopics: ['Entropy & disorder ΔS°', 'Calculating ΔS° of reactions', 'ΔG° = ΔH° − TΔS°', 'Spontaneity & threshold temperature'],
  },

  // A2 Inorganic Chemistry (Ch 24)
  {
    id: 24,
    code: 'Ch 24',
    titleEn: 'Transition Elements',
    titleZh: '过渡金属元素与配合物化学',
    level: 'A2',
    branch: 'Inorganic',
    keyTopics: ['d-block configs & variable oxidation states', 'Ligands & complex geometry', 'Isomerism & ligand exchange (Kstab)', 'd-orbital splitting & colour'],
  },

  // A2 Organic & Analytical Chemistry (Ch 25 - 30, Coursebook 3rd Ed. order)
  {
    id: 25,
    code: 'Ch 25',
    titleEn: 'Benzene and Its Compounds',
    titleZh: '苯、芳香烃与苯酚的反应',
    level: 'A2',
    branch: 'Organic',
    keyTopics: ['Delocalised π ring stability', 'Electrophilic substitution & Friedel-Crafts', 'Directing effects (2,4 vs 3)', 'Phenol acidity & bromination'],
  },
  {
    id: 26,
    code: 'Ch 26',
    titleEn: 'Carboxylic Acids and Their Derivatives',
    titleZh: '羧酸进阶与酰氯的加成-消除反应',
    level: 'A2',
    branch: 'Organic',
    keyTopics: ['Relative acidities (chloroethanoic, phenol)', 'Oxidation of HCOOH & (COOH)2', 'Acyl chlorides (addition-elimination)', 'Hydrolysis reactivity (RCOCl vs RCl vs ArCl)'],
  },
  {
    id: 27,
    code: 'Ch 27',
    titleEn: 'Organic Nitrogen Compounds',
    titleZh: '含氮有机物：胺、酰胺、氨基酸与偶氮染料',
    level: 'A2',
    branch: 'Organic',
    keyTopics: ['Basicity of amines', 'Phenylamine, diazonium & azo dyes', 'Amides formation & hydrolysis', 'Amino acids, zwitterions & electrophoresis'],
  },
  {
    id: 28,
    code: 'Ch 28',
    titleEn: 'Polymerisation',
    titleZh: '缩聚反应、功能高分子与降解',
    level: 'A2',
    branch: 'Organic',
    keyTopics: ['Polyesters (Terylene) & polyamides', 'Repeat units & monomer deduction', 'Protein & DNA hydrogen bonding', 'Degradable & photodegradable polymers'],
  },
  {
    id: 29,
    code: 'Ch 29',
    titleEn: 'Organic Synthesis',
    titleZh: '多步有机合成路线与手性药物设计',
    level: 'A2',
    branch: 'Organic',
    keyTopics: ['Multi-step synthetic routes', 'Functional group interconversions', 'Carbon-chain lengthening', 'Stereoisomerism & chiral single-enantiomer drugs'],
  },
  {
    id: 30,
    code: 'Ch 30',
    titleEn: 'Analytical Chemistry',
    titleZh: '现代波谱与色谱分析（色谱 / IR / NMR / 质谱）',
    level: 'A2',
    branch: 'Analytical',
    keyTopics: ['TLC (Rf) & GLC chromatography', 'Proton (1H) NMR (TMS, δ, n+1, D2O)', 'Carbon-13 (13C) NMR spectroscopy', 'Integrated MS / IR / NMR elucidation'],
  },
];

export const STUDY_MODULES: StudyModule[] = [
  {
    id: 'mod-as-physical',
    code: 'Module 01',
    titleEn: 'AS Physical Chemistry Integration',
    titleZh: 'AS 物理化学综合模块 (Ch 1–9)',
    chapterIds: [1, 2, 3, 4, 5, 6, 7, 8, 9],
    level: 'AS',
    descriptionZh: '汇集跨越多章节的定量化学计量、分子间作用力、焓变计算与化学平衡综合真题。',
  },
  {
    id: 'mod-as-inorganic',
    code: 'Module 02',
    titleEn: 'AS Inorganic & Environmental Trends',
    titleZh: 'AS 无机元素与周期律模块 (Ch 10–13)',
    chapterIds: [10, 11, 12, 13],
    level: 'AS',
    descriptionZh: '整合第 3 周期、第 2 族、第 17 族卤素及氮硫化合物的跨族对比与氧化还原综合题。',
  },
  {
    id: 'mod-as-organic',
    code: 'Module 03',
    titleEn: 'AS Organic Chemistry',
    titleZh: 'AS 有机化学综合模块 (Ch 14–18)',
    chapterIds: [14, 15, 16, 17, 18],
    level: 'AS',
    descriptionZh: '涵盖 Ch 14–18 烃类、卤代烃、醇酯羧酸与羰基化合物的跨官能团机理、鉴别与转化路径。',
  },
  {
    id: 'mod-a2-physical',
    code: 'Module 04',
    titleEn: 'A2 Physical & Electrochemistry',
    titleZh: 'A2 高阶物理化学模块 (Ch 19–23)',
    chapterIds: [19, 20, 21, 22, 23],
    level: 'A2',
    descriptionZh: '融合晶格能、电极电势 E°、缓冲溶液 Ksp、速率方程及吉布斯自由能 ΔG 的多步计算题。',
  },
  {
    id: 'mod-a2-organic-analytical',
    code: 'Module 05',
    titleEn: 'A2 Transition Metals, Synthesis & Analysis',
    titleZh: 'A2 过渡金属、有机合成与波谱分析综合 (Ch 24–30)',
    chapterIds: [24, 25, 26, 27, 28, 29, 30],
    level: 'A2',
    descriptionZh: '结合过渡金属配位、芳香族、含氮有机物、高分子聚合、多步合成与波谱解析的综合大题。',
  },
  {
    id: 'mod-cross-syllabus',
    code: 'Module 06',
    titleEn: 'Cross-Branch Interdisciplinary Synthesis',
    titleZh: '跨分支综合压轴模块 (物理 × 无机 × 有机)',
    chapterIds: Array.from({ length: 30 }, (_, i) => i + 1),
    level: 'Cross-Level',
    descriptionZh: '汇集同一考纲层级内跨物理、无机、有机与分析多分支交叉（如 AS 物化 + 无机/有机，或 A2 电化学/动力学 + 过渡金属/有机合成）的综合压轴真题。',
  },
];

export function getChapterById(id: number): Chapter | undefined {
  return CHAPTERS.find((c) => c.id === id);
}

export function getModuleById(id: string): StudyModule | undefined {
  return STUDY_MODULES.find((m) => m.id === id);
}

/**
 * Any question spanning 2 or more chapters is routed into the matching Module Practice.
 * Questions with only 1 chapter belong strictly to Single-Chapter Practice.
 */
export function resolveModuleForChapters(chapters: number[]): string | undefined {
  const unique = Array.from(new Set(chapters)).filter((c) => c >= 1 && c <= 30);
  if (unique.length < 2) return undefined;

  const specificModules = STUDY_MODULES.filter((m) => m.id !== 'mod-cross-syllabus');
  for (const mod of specificModules) {
    if (unique.every((c) => mod.chapterIds.includes(c))) {
      return mod.id;
    }
  }
  return 'mod-cross-syllabus';
}

export function estimateCaieGrade(percentage: number): 'A*' | 'A' | 'B' | 'C' | 'D' | 'E' | 'U' {
  if (percentage >= 84) return 'A*';
  if (percentage >= 73) return 'A';
  if (percentage >= 63) return 'B';
  if (percentage >= 53) return 'C';
  if (percentage >= 43) return 'D';
  if (percentage >= 35) return 'E';
  return 'U';
}
