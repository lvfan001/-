import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Award,
  BarChart3,
  BookOpen,
  DownloadCloud,
  FlaskConical,
  LayoutDashboard,
  LogIn,
  Menu,
  Play,
  RotateCcw,
  UserCheck,
  X,
} from 'lucide-react';
import type {
  ActiveQuizSession,
  AppView,
  AuthUser,
  DownloadedPaper,
  MockExamResult,
  Question,
  QuestionStat,
  RevisionPlan,
  RevisionTask,
  SessionSnapshot,
} from './types/chemistry.ts';
import { BUILTIN_QUESTIONS, normalizeQuestionClassification } from './data/questionBank.ts';
import { getChapterById, getModuleById, resolveModuleForChapters } from './data/syllabus.ts';
import {
  computeChapterErrorSummaries,
  computeModuleErrorSummaries,
  getHighFrequencyMistakeQuestions,
  recordQuestionAttempt,
} from './utils/analytics.ts';
import {
  MOCK_PRESETS,
  buildPresetMockPaper,
  sortChapterQuestionsByDifficulty,
} from './utils/mockPaperBuilder.ts';
import { OverviewView } from './components/OverviewView.tsx';
import { PaperDownloaderView } from './components/PaperDownloaderView.tsx';
import { ChapterModuleView } from './components/ChapterModuleView.tsx';
import { MockExamSetupView } from './components/MockExamSetupView.tsx';
import { AnalyticsAndPlanView } from './components/AnalyticsAndPlanView.tsx';
import { QuizWorkspace } from './components/QuizWorkspace.tsx';
import { AccountResetModal, type SyncProgressData } from './components/AccountResetModal.tsx';

const STORAGE_KEYS = {
  customQuestions: 'chem9701_custom_questions_v1',
  downloadedPapers: 'chem9701_downloaded_papers_v1',
  statsMap: 'chem9701_question_stats_v1',
  mockHistory: 'chem9701_mock_history_v1',
  revisionPlan: 'chem9701_revision_plan_v1',
  targetExamDate: 'chem9701_target_date_v1',
  authToken: 'chem9701_auth_token_v1',
  sessionSnapshot: 'chem9701_latest_snapshot_v1',
};

function loadJsonStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function deepClone<T>(val: T): T {
  return JSON.parse(JSON.stringify(val)) as T;
}

export default function App() {
  const [activeView, setActiveView] = useState<AppView>('overview');
  const [focusMockModules, setFocusMockModules] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [customQuestions, setCustomQuestions] = useState<Question[]>(() =>
    loadJsonStorage<Question[]>(STORAGE_KEYS.customQuestions, [])
  );
  const [downloadedPapers, setDownloadedPapers] = useState<DownloadedPaper[]>(() =>
    loadJsonStorage<DownloadedPaper[]>(STORAGE_KEYS.downloadedPapers, [])
  );
  const [statsMap, setStatsMap] = useState<Record<string, QuestionStat>>(() =>
    loadJsonStorage<Record<string, QuestionStat>>(STORAGE_KEYS.statsMap, {})
  );
  const [mockHistory, setMockHistory] = useState<MockExamResult[]>(() =>
    loadJsonStorage<MockExamResult[]>(STORAGE_KEYS.mockHistory, [])
  );
  const [revisionPlan, setRevisionPlan] = useState<RevisionPlan | null>(() =>
    loadJsonStorage<RevisionPlan | null>(STORAGE_KEYS.revisionPlan, null)
  );
  const [targetExamDate, setTargetExamDate] = useState<string>(() =>
    loadJsonStorage<string>(STORAGE_KEYS.targetExamDate, '2027-05-15')
  );

  const [authToken, setAuthToken] = useState<string | null>(() =>
    localStorage.getItem(STORAGE_KEYS.authToken)
  );
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [sessionSnapshot, setSessionSnapshot] = useState<SessionSnapshot | null>(() =>
    loadJsonStorage<SessionSnapshot | null>(STORAGE_KEYS.sessionSnapshot, null)
  );

  const [accountModalOpen, setAccountModalOpen] = useState(false);
  const [accountModalTab, setAccountModalTab] = useState<'account' | 'reset'>('reset');
  const [activeQuiz, setActiveQuiz] = useState<ActiveQuizSession | null>(null);
  const skipNextSyncRef = useRef(false);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.customQuestions, JSON.stringify(customQuestions));
  }, [customQuestions]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.downloadedPapers, JSON.stringify(downloadedPapers));
  }, [downloadedPapers]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.statsMap, JSON.stringify(statsMap));
  }, [statsMap]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.mockHistory, JSON.stringify(mockHistory));
  }, [mockHistory]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.revisionPlan, JSON.stringify(revisionPlan));
  }, [revisionPlan]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.targetExamDate, JSON.stringify(targetExamDate));
  }, [targetExamDate]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.sessionSnapshot, JSON.stringify(sessionSnapshot));
  }, [sessionSnapshot]);

  // Hydrate authenticated user & progress on initial mount
  useEffect(() => {
    if (!authToken) {
      setCurrentUser(null);
      return;
    }
    let cancelled = false;
    fetch('/api/auth/me', {
      headers: { Authorization: `Bearer ${authToken}` },
    })
      .then(async (res) => {
        if (!res.ok) throw new Error('SESSION_EXPIRED');
        return (await res.json()) as { user: AuthUser; progress: SyncProgressData };
      })
      .then((data) => {
        if (cancelled) return;
        skipNextSyncRef.current = true;
        setCurrentUser(data.user);
        setStatsMap(data.progress.statsMap ?? {});
        setMockHistory(data.progress.mockHistory ?? []);
        setRevisionPlan(data.progress.revisionPlan ?? null);
        if (data.progress.targetExamDate) {
          setTargetExamDate(data.progress.targetExamDate);
        }
      })
      .catch(() => {
        if (cancelled) return;
        localStorage.removeItem(STORAGE_KEYS.authToken);
        setAuthToken(null);
        setCurrentUser(null);
      });
    return () => {
      cancelled = true;
    };
  }, [authToken]);

  // Debounced server progress sync when signed in
  useEffect(() => {
    if (!authToken || !currentUser) return;
    if (skipNextSyncRef.current) {
      skipNextSyncRef.current = false;
      return;
    }
    const timer = window.setTimeout(() => {
      fetch('/api/user/progress', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          statsMap,
          mockHistory,
          revisionPlan,
          targetExamDate,
        }),
      }).catch(() => {});
    }, 500);
    return () => window.clearTimeout(timer);
  }, [authToken, currentUser, statsMap, mockHistory, revisionPlan, targetExamDate]);

  const allQuestions = useMemo(
    () => [...customQuestions, ...BUILTIN_QUESTIONS],
    [customQuestions]
  );

  const chapterSummaries = useMemo(
    () => computeChapterErrorSummaries(allQuestions, statsMap),
    [allQuestions, statsMap]
  );

  const moduleSummaries = useMemo(
    () => computeModuleErrorSummaries(allQuestions, statsMap),
    [allQuestions, statsMap]
  );

  function startQuizSession(sessionConfig: ActiveQuizSession) {
    setSessionSnapshot({
      sessionId: sessionConfig.id,
      sessionTitle: sessionConfig.title,
      startedAt: new Date().toISOString(),
      recordedAttemptsCount: 0,
      preStatsMap: deepClone(statsMap),
      preMockHistory: deepClone(mockHistory),
    });
    setActiveQuiz(sessionConfig);
  }

  function handleRecordAttempt(questionId: string, isCorrect: boolean, userAnswer: string) {
    setStatsMap((prev) => recordQuestionAttempt(prev, questionId, isCorrect, userAnswer));
    setSessionSnapshot((prev) =>
      prev ? { ...prev, recordedAttemptsCount: prev.recordedAttemptsCount + 1 } : prev
    );
  }

  function handleMockCompleted(result: MockExamResult) {
    setMockHistory((prev) => [result, ...prev]);
  }

  function handleRollbackLatestSession() {
    if (!sessionSnapshot) return;
    setStatsMap(deepClone(sessionSnapshot.preStatsMap));
    setMockHistory(deepClone(sessionSnapshot.preMockHistory));
    setSessionSnapshot((prev) => (prev ? { ...prev, recordedAttemptsCount: 0 } : null));
  }

  function handleStartChapterQuiz(chapterId: number) {
    const ch = getChapterById(chapterId);
    // Strict textbook single-chapter isolation, sorted Core (front-loaded) -> Standard -> Challenging (back-loaded)
    const single = sortChapterQuestionsByDifficulty(
      allQuestions.filter((q) => q.chapters.length === 1 && q.chapters[0] === chapterId)
    );

    startQuizSession({
      id: `quiz-ch-${chapterId}-${Date.now()}`,
      title: `${ch?.code ?? `Ch ${chapterId}`} · ${ch?.titleEn ?? ''}`,
      subtitle: `单章阶梯练习（基础前置 → 标准真题 → 拔高后置 · 严格无超前考点）`,
      mode: 'practice',
      questions: single,
    });
  }

  function handleStartModuleQuiz(moduleId: string, timedMock = false) {
    const mod = getModuleById(moduleId);
    const list = allQuestions.filter(
      (q) => q.chapters.length >= 2 && q.moduleId === moduleId
    );
    if (list.length === 0) return;

    if (timedMock) {
      const pool = [...list];
      for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
      }
      const chosen = pool.slice(0, Math.min(12, pool.length));
      const durationSeconds = Math.max(
        600,
        chosen.reduce((acc, q) => acc + (q.type === 'mcq' ? 110 : q.marks * 95), 0)
      );
      startQuizSession({
        id: `mock-mod-${moduleId}-${Date.now()}`,
        title: `${mod?.code ?? ''} · ${mod?.titleZh ?? ''}`,
        subtitle: `${mod?.titleEn ?? ''} · 跨章模块限时模考 (随机抽 ${chosen.length} 题)`,
        mode: 'mock',
        paperModeLabel: 'Cross-Chapter Synthesis',
        questions: chosen,
        durationSeconds,
      });
      return;
    }

    startQuizSession({
      id: `quiz-mod-${moduleId}-${Date.now()}`,
      title: `${mod?.code ?? ''} · ${mod?.titleZh ?? ''}`,
      subtitle: `${mod?.titleEn ?? ''} · 跨章综合专项练习 (≥2 章节)`,
      mode: 'practice',
      questions: list,
    });
  }

  function handleStartMistakesQuiz() {
    const mistakeEntries = getHighFrequencyMistakeQuestions(allQuestions, statsMap);
    const list = mistakeEntries.map((m) => m.question);
    startQuizSession({
      id: `quiz-mistakes-${Date.now()}`,
      title: '高频错题靶向重练',
      subtitle: `按错题次数从高到低排序 · 共 ${list.length} 题`,
      mode: 'practice',
      questions: list,
    });
  }

  function handleStartQuickMock() {
    const preset = MOCK_PRESETS[0]; // AS 小模考 (10 选择 + ~15 分简答小问)
    const built = buildPresetMockPaper(preset, allQuestions, {
      yearRange: 'all',
    });
    startQuizSession({
      id: `mock-quick-${Date.now()}`,
      title: `${preset.titleZh} · 快速诊断`,
      subtitle: `${built.mcqCount} 道选择 + ${built.structuredCount} 道简答小问 (${built.structuredMarks} 分) · 总计 ${built.totalMarks} 分`,
      mode: 'mock',
      paperModeLabel: preset.paperMode,
      questions: built.questions,
      durationSeconds: preset.durationMinutes * 60,
    });
  }

  function handleStartTaskQuiz(task: RevisionTask) {
    if (task.focusType === 'mock') {
      handleStartQuickMock();
      return;
    }
    if (task.focusType === 'mistakes') {
      const mistakes = getHighFrequencyMistakeQuestions(allQuestions, statsMap);
      if (mistakes.length > 0) {
        handleStartMistakesQuiz();
        return;
      }
    }
    if (task.focusType === 'module' && task.targetModuleId) {
      handleStartModuleQuiz(task.targetModuleId);
      return;
    }
    if (task.targetChapterIds.length === 1) {
      const single = sortChapterQuestionsByDifficulty(
        allQuestions.filter(
          (q) => q.chapters.length === 1 && q.chapters[0] === task.targetChapterIds[0]
        )
      );
      if (single.length > 0) {
        startQuizSession({
          id: `quiz-task-${task.id}-${Date.now()}`,
          title: task.titleZh,
          subtitle: `Day ${task.dayIndex} 复习任务 · ${task.estimatedMinutes} 分钟 · 基础前置 → 拔高后置`,
          mode: 'practice',
          questions: single,
        });
        return;
      }
    }
    if (task.targetChapterIds.length >= 2) {
      const modId = resolveModuleForChapters(task.targetChapterIds);
      const list = allQuestions.filter(
        (q) =>
          q.chapters.length >= 2 &&
          (modId ? q.moduleId === modId : q.chapters.some((c) => task.targetChapterIds.includes(c)))
      );
      if (list.length > 0) {
        startQuizSession({
          id: `quiz-task-${task.id}-${Date.now()}`,
          title: task.titleZh,
          subtitle: `Day ${task.dayIndex} 跨章复习任务 · ${task.estimatedMinutes} 分钟`,
          mode: 'practice',
          questions: list,
        });
        return;
      }
    }
    handleStartQuickMock();
  }

  function handleToggleRevisionTask(taskId: string) {
    setRevisionPlan((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        tasks: prev.tasks.map((t) =>
          t.id === taskId ? { ...t, completed: !t.completed } : t
        ),
      };
    });
  }

  const navItems: Array<{ id: AppView; label: string; icon: React.ReactNode }> = [
    { id: 'overview', label: '总览工作台', icon: <LayoutDashboard className="h-4 w-4" /> },
    { id: 'practice', label: '30 章节基础练习', icon: <BookOpen className="h-4 w-4" /> },
    { id: 'mock', label: '模拟考与跨章练习', icon: <Award className="h-4 w-4" /> },
    { id: 'analytics', label: '错题频率与复习计划', icon: <BarChart3 className="h-4 w-4" /> },
    { id: 'papers', label: '历年真题下载', icon: <DownloadCloud className="h-4 w-4" /> },
  ];

  const currentNavLabel = navItems.find((n) => n.id === activeView)?.label ?? '工作台';

  return (
    <div className="min-h-screen bg-[#111113] text-[#F8F7F4] lg:flex">
      {/* Desktop Left Sidebar (272px) */}
      <aside className="hidden w-[272px] shrink-0 flex-col justify-between border-r border-white/10 bg-[#141416] lg:flex">
        <div>
          <div className="flex h-16 items-center gap-2.5 border-b border-white/10 px-6">
            <FlaskConical className="h-5 w-5 text-[#E0A458]" />
            <span className="font-mono text-base font-bold tracking-tight text-[#F8F7F4] whitespace-nowrap">
              CHEM9701
            </span>
          </div>

          <nav className="space-y-1 p-4" aria-label="主导航">
            {navItems.map((item) => {
              const active = !activeQuiz && activeView === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveQuiz(null);
                    setFocusMockModules(false);
                    setActiveView(item.id);
                  }}
                  className={`flex w-full items-center gap-3 rounded-lg px-3.5 py-2.5 text-left text-sm font-medium transition-colors whitespace-nowrap ${
                    active
                      ? 'bg-[#E0A458]/12 text-[#E0A458]'
                      : 'text-[#F8F7F4]/65 hover:bg-white/[0.04] hover:text-[#F8F7F4]'
                  }`}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        <div className="space-y-3 border-t border-white/10 p-4 text-xs text-[#F8F7F4]/60">
          <div className="space-y-2">
            <button
              onClick={() => {
                setAccountModalTab('account');
                setAccountModalOpen(true);
              }}
              className="flex w-full items-center justify-between rounded-lg border border-white/10 bg-[#18181A] px-3 py-2 text-left text-xs font-medium text-[#F8F7F4]/90 transition-colors hover:border-[#E0A458]/60 hover:text-[#E0A458]"
            >
              <span className="inline-flex items-center gap-1.5 truncate">
                {currentUser ? (
                  <UserCheck className="h-3.5 w-3.5 shrink-0 text-[#E0A458]" />
                ) : (
                  <LogIn className="h-3.5 w-3.5 shrink-0" />
                )}
                <span className="truncate">
                  {currentUser ? `${currentUser.displayName}` : '登录 / 注册'}
                </span>
              </span>
              <span className="font-mono text-[11px] text-[#F8F7F4]/45 shrink-0">
                {currentUser ? '已登录' : '未登录'}
              </span>
            </button>
            <button
              onClick={() => {
                setAccountModalTab('reset');
                setAccountModalOpen(true);
              }}
              className="flex w-full items-center gap-1.5 rounded-lg border border-white/10 bg-[#18181A] px-3 py-2 text-left text-xs font-medium text-[#F8F7F4]/80 transition-colors hover:border-red-400/50 hover:text-red-300"
            >
              <RotateCcw className="h-3.5 w-3.5 shrink-0" />
              <span>重置 / 回退练习记录</span>
            </button>
          </div>

          <div className="border-t border-white/10 pt-3">
            <div className="font-mono text-[10px] tracking-[0.14em] uppercase text-[#F8F7F4]/45">
              CAIE 9701 Syllabus
            </div>
            <div className="mt-1 font-mono text-xs text-[#F8F7F4]/75 tabular-nums">
              30 Chapters · 6 Modules
            </div>
            <div className="mt-0.5 font-mono text-[11px] text-[#F8F7F4]/50 tabular-nums">
              2018–2026 Past Papers
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top Header */}
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-4 border-b border-white/10 bg-[#111113]/95 px-4 backdrop-blur-xs sm:px-8">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => setMobileMenuOpen((v) => !v)}
              className="rounded-lg border border-white/15 p-2 text-[#F8F7F4]/75 hover:text-[#E0A458] lg:hidden"
              aria-label="切换导航菜单"
            >
              {mobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>
            <div className="flex items-center gap-2 text-sm text-[#F8F7F4]/55 min-w-0">
              <span className="font-mono text-xs font-bold tracking-tight text-[#F8F7F4] whitespace-nowrap">
                Chem9701
              </span>
              <span aria-hidden="true">/</span>
              <span className="truncate text-[#F8F7F4]/85">
                {activeQuiz ? activeQuiz.title : currentNavLabel}
              </span>
            </div>
          </div>

          {!activeQuiz && (
            <div className="flex items-center gap-2.5 shrink-0">
              <button
                onClick={() => {
                  setAccountModalTab('reset');
                  setAccountModalOpen(true);
                }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/12 bg-[#18181A] px-3 py-2 text-xs font-medium text-[#F8F7F4]/85 transition-colors hover:border-white/25 hover:text-[#F8F7F4] whitespace-nowrap shrink-0"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                记录重置
              </button>
              <button
                onClick={() => {
                  setAccountModalTab('account');
                  setAccountModalOpen(true);
                }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/12 bg-[#18181A] px-3 py-2 text-xs font-medium text-[#F8F7F4]/85 transition-colors hover:border-[#E0A458]/60 hover:text-[#E0A458] whitespace-nowrap shrink-0"
              >
                {currentUser ? (
                  <UserCheck className="h-3.5 w-3.5 text-[#E0A458]" />
                ) : (
                  <LogIn className="h-3.5 w-3.5" />
                )}
                {currentUser ? currentUser.displayName : '登录 / 注册'}
              </button>
              <button
                onClick={handleStartQuickMock}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#E0A458] px-3.5 py-2 text-xs font-bold text-[#111113] transition-colors hover:bg-[#EBB66E] whitespace-nowrap shrink-0"
              >
                <Play className="h-3.5 w-3.5" />
                快速诊断模考
              </button>
            </div>
          )}
        </header>

        {/* Mobile Drawer Nav */}
        {mobileMenuOpen && (
          <div className="border-b border-white/10 bg-[#141416] p-3 lg:hidden">
            <nav className="space-y-1">
              {navItems.map((item) => {
                const active = !activeQuiz && activeView === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      setActiveQuiz(null);
                      setFocusMockModules(false);
                      setActiveView(item.id);
                      setMobileMenuOpen(false);
                    }}
                    className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium ${
                      active ? 'bg-[#E0A458]/15 text-[#E0A458]' : 'text-[#F8F7F4]/75'
                    }`}
                  >
                    {item.icon}
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>
        )}

        {/* Viewport Body */}
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-8 sm:py-8">
          {activeQuiz ? (
            <QuizWorkspace
              session={activeQuiz}
              sessionAttemptCount={
                sessionSnapshot?.sessionId === activeQuiz.id
                  ? sessionSnapshot.recordedAttemptsCount
                  : 0
              }
              onExit={() => setActiveQuiz(null)}
              onRecordAttempt={handleRecordAttempt}
              onMockCompleted={handleMockCompleted}
              onRollbackCurrentSession={handleRollbackLatestSession}
            />
          ) : activeView === 'overview' ? (
            <OverviewView
              questions={allQuestions}
              statsMap={statsMap}
              chapterSummaries={chapterSummaries}
              mockHistory={mockHistory}
              targetExamDate={targetExamDate}
              downloadedPaperCount={downloadedPapers.length}
              onNavigate={setActiveView}
              onStartChapterQuiz={handleStartChapterQuiz}
              onOpenModulesPage={() => {
                setFocusMockModules(true);
                setActiveView('mock');
              }}
              onStartMistakesQuiz={handleStartMistakesQuiz}
              onStartQuickMock={handleStartQuickMock}
            />
          ) : activeView === 'papers' ? (
            <PaperDownloaderView />
          ) : activeView === 'practice' ? (
            <ChapterModuleView
              questions={allQuestions}
              chapterSummaries={chapterSummaries}
              onStartChapterQuiz={handleStartChapterQuiz}
              onGoToMockExam={() => {
                setFocusMockModules(true);
                setActiveView('mock');
              }}
            />
          ) : activeView === 'mock' ? (
            <MockExamSetupView
              questions={allQuestions}
              moduleSummaries={moduleSummaries}
              mockHistory={mockHistory}
              focusCrossChapter={focusMockModules}
              onStartMock={(config) =>
                startQuizSession({
                  id: `mock-${Date.now()}`,
                  title: config.title,
                  subtitle: config.subtitle ?? 'CAIE 9701 限时模拟测评',
                  mode: 'mock',
                  paperModeLabel: config.paperModeLabel,
                  questions: config.questions,
                  durationSeconds: config.durationSeconds,
                  realPaperFiles: config.realPaperFiles,
                })
              }
              onStartModuleQuiz={handleStartModuleQuiz}
            />
          ) : (
            <AnalyticsAndPlanView
              questions={allQuestions}
              statsMap={statsMap}
              chapterSummaries={chapterSummaries}
              moduleSummaries={moduleSummaries}
              revisionPlan={revisionPlan}
              targetExamDate={targetExamDate}
              onChangeTargetDate={setTargetExamDate}
              onPlanGenerated={setRevisionPlan}
              onToggleTask={handleToggleRevisionTask}
              onStartMistakesQuiz={handleStartMistakesQuiz}
              onStartTaskQuiz={handleStartTaskQuiz}
            />
          )}
        </main>
      </div>

      <AccountResetModal
        isOpen={accountModalOpen}
        initialTab={accountModalTab}
        onClose={() => setAccountModalOpen(false)}
        authToken={authToken}
        currentUser={currentUser}
        latestSnapshot={sessionSnapshot}
        totalRecordedAttempts={Object.values(statsMap).reduce((s, x) => s + x.attempts, 0)}
        totalMockHistory={mockHistory.length}
        currentProgressPayload={{
          statsMap,
          mockHistory,
          revisionPlan,
          targetExamDate,
        }}
        onAuthSuccess={(token, user, progress) => {
          localStorage.setItem(STORAGE_KEYS.authToken, token);
          skipNextSyncRef.current = true;
          setAuthToken(token);
          setCurrentUser(user);
          setStatsMap(progress.statsMap ?? {});
          setMockHistory(progress.mockHistory ?? []);
          setRevisionPlan(progress.revisionPlan ?? null);
          if (progress.targetExamDate) setTargetExamDate(progress.targetExamDate);
        }}
        onUserUpdated={(user) => setCurrentUser(user)}
        onLogout={() => {
          localStorage.removeItem(STORAGE_KEYS.authToken);
          setAuthToken(null);
          setCurrentUser(null);
        }}
        onRollbackLastSession={handleRollbackLatestSession}
        onFullResetConfirmed={(clearedProgress) => {
          skipNextSyncRef.current = true;
          setStatsMap(clearedProgress.statsMap ?? {});
          setMockHistory(clearedProgress.mockHistory ?? []);
          setRevisionPlan(clearedProgress.revisionPlan ?? null);
          setSessionSnapshot(null);
        }}
      />
    </div>
  );
}
