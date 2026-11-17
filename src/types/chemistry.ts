export type ChemLevel = 'AS' | 'A2';
export type ChemBranch = 'Physical' | 'Inorganic' | 'Organic' | 'Analytical';
export type ExamSession = 'F/M' | 'M/J' | 'O/N';
export type QuestionType = 'mcq' | 'structured';
export type DifficultyLevel = 'Core' | 'Standard' | 'Challenging';

export type DiagramType =
  | 'enthalpy'
  | 'maxwell'
  | 'titration'
  | 'born-haber'
  | 'nmr'
  | 'organic-scheme'
  | 'ionisation'
  | 'period3-mp'
  | 'mass-spec'
  | 'ir-spec'
  | 'kinetics-curve'
  | 'electrochem-cell'
  | 'skeletal'
  | 'paper5-graph';

export interface DiagramSpec {
  kind: DiagramType;
  params?: Record<string, unknown>;
}

export interface CropSourceMeta {
  paperCode: string;
  pageNumber: number;
  box: [number, number, number, number]; // [ymin, xmin, ymax, xmax] normalized 0-1000
}

export interface Chapter {
  id: number; // 1 to 30
  code: string; // e.g., "Ch 14"
  titleEn: string;
  titleZh: string;
  level: ChemLevel;
  branch: ChemBranch;
  keyTopics: string[];
}

export interface StudyModule {
  id: string;
  code: string;
  titleEn: string;
  titleZh: string;
  chapterIds: number[];
  level: ChemLevel | 'Cross-Level';
  descriptionZh: string;
}

export interface McqOption {
  label: 'A' | 'B' | 'C' | 'D';
  text: string;
}

export interface Question {
  id: string;
  paperCode: string; // e.g., "9701/12/M/J/24"
  year: number; // 2021 - 2026
  session: ExamSession;
  paperNumber: 1 | 2 | 4 | 5;
  questionNumber: number;
  source: 'builtin' | 'web-downloaded' | 'pdf-uploaded' | 'pdf-clipped';
  sourceUrl?: string;
  chapters: number[]; // length 1 -> single chapter; length >= 2 -> module practice
  moduleId?: string;
  type: QuestionType;
  marks: number;
  promptEn: string;
  promptZh: string;
  diagramType?: DiagramType;
  diagramSpec?: DiagramSpec;
  diagramCaption?: string;
  clippedImageId?: string;
  clippedImageUrls?: string[];
  msImageId?: string;
  msImageUrls?: string[];
  cropSourceMeta?: CropSourceMeta;
  options?: McqOption[];
  correctOption?: 'A' | 'B' | 'C' | 'D';
  markSchemePoints?: string[];
  modelAnswer?: string;
  explanationEn: string;
  explanationZh: string;
  difficulty: DifficultyLevel;
  subPart?: string;
}

export interface AuthUser {
  id: string;
  username: string;
  displayName: string;
  authProvider: 'password' | 'wechat-miniprogram';
  hasPassword: boolean;
  wechatBound: boolean;
  wechatOpenIdMasked?: string;
  createdAt: string;
}

export interface SessionSnapshot {
  sessionId: string;
  sessionTitle: string;
  startedAt: string;
  recordedAttemptsCount: number;
  preStatsMap: Record<string, QuestionStat>;
  preMockHistory: MockExamResult[];
}

export interface DownloadedPaper {
  id: string;
  paperCode: string;
  year: number;
  session: ExamSession;
  paperNumber: 1 | 2 | 4;
  variant: 1 | 2 | 3;
  title: string;
  downloadedAt: string;
  sourceMethod: 'url-pdf' | 'web-grounded' | 'local-upload';
  sourceUrl?: string;
  groundingUrls?: { title: string; uri: string }[];
  hasPdfBlob: boolean;
  questionCount: number;
  chaptersCovered: number[];
  note?: string;
}

export interface WrongAttemptEntry {
  at: string;
  userAnswer: string;
}

export interface QuestionStat {
  questionId: string;
  attempts: number;
  wrongCount: number;
  lastAttemptAt: string;
  lastWrongAt?: string;
  lastCorrect: boolean;
  wrongHistory: WrongAttemptEntry[];
}

export interface ChapterErrorSummary {
  chapter: Chapter;
  attempts: number;
  wrongCount: number;
  errorRate: number; // 0 to 1
  priorityScore: number;
  questionCount: number;
}

export interface ModuleErrorSummary {
  module: StudyModule;
  attempts: number;
  wrongCount: number;
  errorRate: number;
  questionCount: number;
}

export interface MockExamResult {
  id: string;
  title: string;
  paperMode: 'Paper 1 (MCQ)' | 'Paper 2/4 (Structured)' | 'Full Diagnostic Mock';
  completedAt: string;
  durationSeconds: number;
  totalMarks: number;
  earnedMarks: number;
  percentage: number;
  estimatedGrade: 'A*' | 'A' | 'B' | 'C' | 'D' | 'E' | 'U';
  chapterBreakdown: { chapterId: number; attempts: number; wrong: number }[];
  questionIds: string[];
  wrongQuestionIds: string[];
}

export interface RevisionTask {
  id: string;
  dayIndex: number;
  dateLabel: string;
  titleZh: string;
  titleEn: string;
  focusType: 'chapter' | 'module' | 'mistakes' | 'mock';
  targetChapterIds: number[];
  targetModuleId?: string;
  targetQuestionIds?: string[];
  reasonZh: string;
  estimatedMinutes: number;
  completed: boolean;
}

export interface RevisionPlan {
  id: string;
  createdAt: string;
  targetExamDate: string;
  dailyMinutes: number;
  planDays: number;
  aiSummaryZh: string;
  generatedBy: 'gemini' | 'algorithmic';
  tasks: RevisionTask[];
}

export type AppView =
  | 'overview'
  | 'papers'
  | 'practice'
  | 'mock'
  | 'analytics';

export interface ActiveQuizSession {
  id: string;
  title: string;
  subtitle: string;
  mode: 'practice' | 'mock';
  paperModeLabel?: 'Paper 1 (MCQ)' | 'Paper 2/4 (Structured)' | 'Full Diagnostic Mock';
  questions: Question[];
  durationSeconds?: number; // for mock mode
}
