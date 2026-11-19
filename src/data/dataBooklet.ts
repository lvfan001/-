// Portable CAIE A-Level Chemistry (9701) Official Data Booklet Reference Data
// Designed as pure TypeScript data so it can be shared 1:1 with WeChat Mini Program.

export interface PeriodicElement {
  z: number;
  symbol: string;
  name: string;
  ar: string; // Official CAIE 9701 1 d.p. relative atomic mass
  period: number;
  group: number; // 1-18 standard IUPAC column (for grid placement; 0 for lanthanides/actinides)
  category: 'alkali' | 'alkaline' | 'transition' | 'post-transition' | 'metalloid' | 'nonmetal' | 'halogen' | 'noble';
}

export interface IrEntry {
  bond: string;
  groupZh: string;
  range: string;
  appearance: string;
}

export interface NmrEntry {
  env: string;
  example: string;
  shiftPpm: string;
  noteZh: string;
}

export interface ElectrodePotentialEntry {
  halfEquation: string;
  eTheta: string; // Volts
  noteZh: string;
}

export const CHEM_QUICK_SYMBOLS: Array<{ label: string; insert: string; title: string }> = [
  { label: '⇌', insert: ' ⇌ ', title: '可逆反应符号' },
  { label: '→', insert: ' → ', title: '反应箭头' },
  { label: 'ΔH', insert: 'ΔH', title: '焓变' },
  { label: 'E°', insert: 'E°', title: '标准电极电势' },
  { label: 'δ⁺', insert: 'δ⁺', title: '部分正电荷' },
  { label: 'δ⁻', insert: 'δ⁻', title: '部分负电荷' },
  { label: '⁺', insert: '⁺', title: '正电荷上标' },
  { label: '⁻', insert: '⁻', title: '负电荷上标' },
  { label: '²', insert: '²', title: '上标 2' },
  { label: '³', insert: '³', title: '上标 3' },
  { label: '₂', insert: '₂', title: '下标 2' },
  { label: '₃', insert: '₃', title: '下标 3' },
  { label: '°C', insert: '°C', title: '摄氏度' },
  { label: 'mol dm⁻³', insert: ' mol dm⁻³', title: '浓度单位' },
  { label: 'kJ mol⁻¹', insert: ' kJ mol⁻¹', title: '焓变单位' },
];

export const PERIODIC_ELEMENTS: PeriodicElement[] = [
  // Period 1
  { z: 1, symbol: 'H', name: 'Hydrogen', ar: '1.0', period: 1, group: 1, category: 'nonmetal' },
  { z: 2, symbol: 'He', name: 'Helium', ar: '4.0', period: 1, group: 18, category: 'noble' },
  // Period 2
  { z: 3, symbol: 'Li', name: 'Lithium', ar: '6.9', period: 2, group: 1, category: 'alkali' },
  { z: 4, symbol: 'Be', name: 'Beryllium', ar: '9.0', period: 2, group: 2, category: 'alkaline' },
  { z: 5, symbol: 'B', name: 'Boron', ar: '10.8', period: 2, group: 13, category: 'metalloid' },
  { z: 6, symbol: 'C', name: 'Carbon', ar: '12.0', period: 2, group: 14, category: 'nonmetal' },
  { z: 7, symbol: 'N', name: 'Nitrogen', ar: '14.0', period: 2, group: 15, category: 'nonmetal' },
  { z: 8, symbol: 'O', name: 'Oxygen', ar: '16.0', period: 2, group: 16, category: 'nonmetal' },
  { z: 9, symbol: 'F', name: 'Fluorine', ar: '19.0', period: 2, group: 17, category: 'halogen' },
  { z: 10, symbol: 'Ne', name: 'Neon', ar: '20.2', period: 2, group: 18, category: 'noble' },
  // Period 3
  { z: 11, symbol: 'Na', name: 'Sodium', ar: '23.0', period: 3, group: 1, category: 'alkali' },
  { z: 12, symbol: 'Mg', name: 'Magnesium', ar: '24.3', period: 3, group: 2, category: 'alkaline' },
  { z: 13, symbol: 'Al', name: 'Aluminium', ar: '27.0', period: 3, group: 13, category: 'post-transition' },
  { z: 14, symbol: 'Si', name: 'Silicon', ar: '28.1', period: 3, group: 14, category: 'metalloid' },
  { z: 15, symbol: 'P', name: 'Phosphorus', ar: '31.0', period: 3, group: 15, category: 'nonmetal' },
  { z: 16, symbol: 'S', name: 'Sulfur', ar: '32.1', period: 3, group: 16, category: 'nonmetal' },
  { z: 17, symbol: 'Cl', name: 'Chlorine', ar: '35.5', period: 3, group: 17, category: 'halogen' },
  { z: 18, symbol: 'Ar', name: 'Argon', ar: '39.9', period: 3, group: 18, category: 'noble' },
  // Period 4
  { z: 19, symbol: 'K', name: 'Potassium', ar: '39.1', period: 4, group: 1, category: 'alkali' },
  { z: 20, symbol: 'Ca', name: 'Calcium', ar: '40.1', period: 4, group: 2, category: 'alkaline' },
  { z: 21, symbol: 'Sc', name: 'Scandium', ar: '45.0', period: 4, group: 3, category: 'transition' },
  { z: 22, symbol: 'Ti', name: 'Titanium', ar: '47.9', period: 4, group: 4, category: 'transition' },
  { z: 23, symbol: 'V', name: 'Vanadium', ar: '50.9', period: 4, group: 5, category: 'transition' },
  { z: 24, symbol: 'Cr', name: 'Chromium', ar: '52.0', period: 4, group: 6, category: 'transition' },
  { z: 25, symbol: 'Mn', name: 'Manganese', ar: '54.9', period: 4, group: 7, category: 'transition' },
  { z: 26, symbol: 'Fe', name: 'Iron', ar: '55.8', period: 4, group: 8, category: 'transition' },
  { z: 27, symbol: 'Co', name: 'Cobalt', ar: '58.9', period: 4, group: 9, category: 'transition' },
  { z: 28, symbol: 'Ni', name: 'Nickel', ar: '58.7', period: 4, group: 10, category: 'transition' },
  { z: 29, symbol: 'Cu', name: 'Copper', ar: '63.5', period: 4, group: 11, category: 'transition' },
  { z: 30, symbol: 'Zn', name: 'Zinc', ar: '65.4', period: 4, group: 12, category: 'transition' },
  { z: 31, symbol: 'Ga', name: 'Gallium', ar: '69.7', period: 4, group: 13, category: 'post-transition' },
  { z: 32, symbol: 'Ge', name: 'Germanium', ar: '72.6', period: 4, group: 14, category: 'metalloid' },
  { z: 33, symbol: 'As', name: 'Arsenic', ar: '74.9', period: 4, group: 15, category: 'metalloid' },
  { z: 34, symbol: 'Se', name: 'Selenium', ar: '79.0', period: 4, group: 16, category: 'nonmetal' },
  { z: 35, symbol: 'Br', name: 'Bromine', ar: '79.9', period: 4, group: 17, category: 'halogen' },
  { z: 36, symbol: 'Kr', name: 'Krypton', ar: '83.8', period: 4, group: 18, category: 'noble' },
  // Key Period 5 & 6 exam elements
  { z: 37, symbol: 'Rb', name: 'Rubidium', ar: '85.5', period: 5, group: 1, category: 'alkali' },
  { z: 38, symbol: 'Sr', name: 'Strontium', ar: '87.6', period: 5, group: 2, category: 'alkaline' },
  { z: 42, symbol: 'Mo', name: 'Molybdenum', ar: '95.9', period: 5, group: 6, category: 'transition' },
  { z: 46, symbol: 'Pd', name: 'Palladium', ar: '106.4', period: 5, group: 10, category: 'transition' },
  { z: 47, symbol: 'Ag', name: 'Silver', ar: '107.9', period: 5, group: 11, category: 'transition' },
  { z: 48, symbol: 'Cd', name: 'Cadmium', ar: '112.4', period: 5, group: 12, category: 'transition' },
  { z: 50, symbol: 'Sn', name: 'Tin', ar: '118.7', period: 5, group: 14, category: 'post-transition' },
  { z: 51, symbol: 'Sb', name: 'Antimony', ar: '121.8', period: 5, group: 15, category: 'metalloid' },
  { z: 53, symbol: 'I', name: 'Iodine', ar: '126.9', period: 5, group: 17, category: 'halogen' },
  { z: 54, symbol: 'Xe', name: 'Xenon', ar: '131.3', period: 5, group: 18, category: 'noble' },
  { z: 55, symbol: 'Cs', name: 'Caesium', ar: '132.9', period: 6, group: 1, category: 'alkali' },
  { z: 56, symbol: 'Ba', name: 'Barium', ar: '137.3', period: 6, group: 2, category: 'alkaline' },
  { z: 78, symbol: 'Pt', name: 'Platinum', ar: '195.1', period: 6, group: 10, category: 'transition' },
  { z: 79, symbol: 'Au', name: 'Gold', ar: '197.0', period: 6, group: 11, category: 'transition' },
  { z: 80, symbol: 'Hg', name: 'Mercury', ar: '200.6', period: 6, group: 12, category: 'transition' },
  { z: 82, symbol: 'Pb', name: 'Lead', ar: '207.2', period: 6, group: 14, category: 'post-transition' },
  { z: 85, symbol: 'At', name: 'Astatine', ar: '210', period: 6, group: 17, category: 'halogen' },
  { z: 88, symbol: 'Ra', name: 'Radium', ar: '226', period: 7, group: 2, category: 'alkaline' },
];

export const IR_ABSORPTION_TABLE: IrEntry[] = [
  { bond: 'C–O', groupZh: '醇、醚、酯、羧酸', range: '1040 – 1300 cm⁻¹', appearance: '强峰 (strong)' },
  { bond: 'C=C', groupZh: '芳香环 / 烯烃', range: '1500 – 1680 cm⁻¹', appearance: '弱至强 (除非对称)' },
  { bond: 'C=O', groupZh: '酰胺', range: '1640 – 1690 cm⁻¹', appearance: '强峰 (strong)' },
  { bond: 'C=O', groupZh: '醛、酮、羧酸、酯', range: '1670 – 1740 cm⁻¹', appearance: '强尖峰 (strong, sharp)' },
  { bond: 'C≡N', groupZh: '腈 (Nitriles)', range: '2200 – 2250 cm⁻¹', appearance: '弱峰 (weak)' },
  { bond: 'C–H', groupZh: '烷烃 / 烯烃 / 芳环', range: '2850 – 3100 cm⁻¹', appearance: '强峰 (strong)' },
  { bond: 'O–H', groupZh: '羧酸 (Carboxylic acids)', range: '2500 – 3000 cm⁻¹', appearance: '极宽强峰 (very broad)' },
  { bond: 'O–H', groupZh: '醇、酚 (氢键缔合)', range: '3200 – 3600 cm⁻¹', appearance: '宽强峰 (broad)' },
  { bond: 'N–H', groupZh: '胺、酰胺', range: '3300 – 3500 cm⁻¹', appearance: '弱峰 (weak)' },
];

export const HNMR_SHIFTS: NmrEntry[] = [
  { env: 'R–CH₃ / R–CH₂–R / R₃CH', example: '烷基氢', shiftPpm: '0.9 – 1.7', noteZh: '饱和烷基环境' },
  { env: 'CH₃–C=O / CH₃–Ar / CH₂–C=O', example: '羰基或苯环α位氢', shiftPpm: '1.8 – 3.1', noteZh: '邻接 C=O 或芳环' },
  { env: 'R–O–CH₃ / R–CH₂–Cl / R–CH₂–N', example: '连电负性原子碳上氢', shiftPpm: '3.2 – 4.0', noteZh: '邻接 O、N、卤素' },
  { env: 'R–OH / R–NH₂ / R–NH–', example: '活泼氢 (羟基/氨基)', shiftPpm: '0.5 – 6.0', noteZh: '加 D₂O 峰消失，通常不裂分' },
  { env: 'R₂C=CH–R', example: '烯烃氢', shiftPpm: '4.5 – 6.0', noteZh: '双键碳上氢' },
  { env: 'Ar–OH', example: '酚羟基氢', shiftPpm: '4.5 – 7.0', noteZh: '加 D₂O 峰消失' },
  { env: 'Ar–H', example: '苯环芳香氢', shiftPpm: '6.0 – 9.0', noteZh: '常见 7.0 – 8.0 ppm' },
  { env: 'R–CHO', example: '醛基氢', shiftPpm: '9.3 – 10.5', noteZh: '特征低场峰' },
  { env: 'R–CO₂H', example: '羧基氢', shiftPpm: '9.0 – 13.0', noteZh: '加 D₂O 峰消失' },
];

export const CNMR_SHIFTS: NmrEntry[] = [
  { env: 'C–C (烷烃碳)', example: 'CH₃–, –CH₂–', shiftPpm: '0 – 50', noteZh: '高场区' },
  { env: 'C–O / C–N / C–Hal', example: '醇、醚、卤代烃、胺', shiftPpm: '50 – 75', noteZh: '连电负性原子' },
  { env: 'C=C / 苯环碳', example: '烯烃、芳香环', shiftPpm: '110 – 160', noteZh: '苯环常见 125–145' },
  { env: 'R–C≡N', example: '腈基碳', shiftPpm: '115 – 125', noteZh: '三键碳' },
  { env: 'R–CO₂R / R–CO₂H / R–CONH₂', example: '酯、羧酸、酰胺羰基', shiftPpm: '160 – 185', noteZh: '酸衍生物羰基' },
  { env: 'R–CHO / R₂C=O', example: '醛、酮羰基碳', shiftPpm: '190 – 220', noteZh: '最特征低场羰基' },
];

export const ELECTRODE_POTENTIALS: ElectrodePotentialEntry[] = [
  { halfEquation: 'K⁺ + e⁻ ⇌ K', eTheta: '-2.92', noteZh: '极强还原剂' },
  { halfEquation: 'Mg²⁺ + 2e⁻ ⇌ Mg', eTheta: '-2.38', noteZh: '活泼金属' },
  { halfEquation: 'Al³⁺ + 3e⁻ ⇌ Al', eTheta: '-1.66', noteZh: '' },
  { halfEquation: 'Zn²⁺ + 2e⁻ ⇌ Zn', eTheta: '-0.76', noteZh: '高频原电池负极' },
  { halfEquation: 'Fe²⁺ + 2e⁻ ⇌ Fe', eTheta: '-0.44', noteZh: '' },
  { halfEquation: '2H⁺ + 2e⁻ ⇌ H₂', eTheta: '0.00', noteZh: '标准氢电极 (SHE)' },
  { halfEquation: 'S₄O₆²⁻ + 2e⁻ ⇌ 2S₂O₃²⁻', eTheta: '+0.09', noteZh: '碘量滴定' },
  { halfEquation: 'Cu²⁺ + 2e⁻ ⇌ Cu', eTheta: '+0.34', noteZh: '高频原电池正极' },
  { halfEquation: 'I₂ + 2e⁻ ⇌ 2I⁻', eTheta: '+0.54', noteZh: '卤素氧化性对比' },
  { halfEquation: 'Fe³⁺ + e⁻ ⇌ Fe²⁺', eTheta: '+0.77', noteZh: '高频过渡金属氧化还原' },
  { halfEquation: 'Ag⁺ + e⁻ ⇌ Ag', eTheta: '+0.80', noteZh: '' },
  { halfEquation: 'Br₂ + 2e⁻ ⇌ 2Br⁻', eTheta: '+1.07', noteZh: '卤素氧化性对比' },
  { halfEquation: 'O₂ + 4H⁺ + 4e⁻ ⇌ 2H₂O', eTheta: '+1.23', noteZh: '酸性氧电极' },
  { halfEquation: 'Cr₂O₇²⁻ + 14H⁺ + 6e⁻ ⇌ 2Cr³⁺ + 7H₂O', eTheta: '+1.33', noteZh: '重铬酸钾氧化剂' },
  { halfEquation: 'Cl₂ + 2e⁻ ⇌ 2Cl⁻', eTheta: '+1.36', noteZh: '卤素氧化性对比' },
  { halfEquation: 'MnO₄⁻ + 8H⁺ + 5e⁻ ⇌ Mn²⁺ + 4H₂O', eTheta: '+1.52', noteZh: '高锰酸钾滴定' },
  { halfEquation: 'H₂O₂ + 2H⁺ + 2e⁻ ⇌ 2H₂O', eTheta: '+1.77', noteZh: '过氧化氢氧化性' },
  { halfEquation: 'S₂O₈²⁻ + 2e⁻ ⇌ 2SO₄²⁻', eTheta: '+2.01', noteZh: '过二硫酸根 (均相催化高频)' },
  { halfEquation: 'F₂ + 2e⁻ ⇌ 2F⁻', eTheta: '+2.87', noteZh: '最强氧化剂' },
];
