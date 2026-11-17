import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  KeyRound,
  Loader2,
  LogIn,
  LogOut,
  RotateCcw,
  ShieldCheck,
  Trash2,
  UserCheck,
  UserPlus,
  X,
} from 'lucide-react';
import type {
  AuthUser,
  MockExamResult,
  QuestionStat,
  RevisionPlan,
  SessionSnapshot,
} from '../types/chemistry.ts';

export interface SyncProgressData {
  statsMap: Record<string, QuestionStat>;
  mockHistory: MockExamResult[];
  revisionPlan: RevisionPlan | null;
  targetExamDate: string;
}

interface AccountResetModalProps {
  isOpen: boolean;
  initialTab: 'account' | 'reset';
  onClose: () => void;
  authToken: string | null;
  currentUser: AuthUser | null;
  latestSnapshot: SessionSnapshot | null;
  totalRecordedAttempts: number;
  totalMockHistory: number;
  currentProgressPayload: SyncProgressData;
  onAuthSuccess: (token: string, user: AuthUser, progress: SyncProgressData) => void;
  onUserUpdated: (user: AuthUser) => void;
  onLogout: () => void;
  onRollbackLastSession: () => void;
  onFullResetConfirmed: (clearedProgress: SyncProgressData) => void;
}

export function AccountResetModal({
  isOpen,
  initialTab,
  onClose,
  authToken,
  currentUser,
  latestSnapshot,
  totalRecordedAttempts,
  totalMockHistory,
  currentProgressPayload,
  onAuthSuccess,
  onUserUpdated,
  onLogout,
  onRollbackLastSession,
  onFullResetConfirmed,
}: AccountResetModalProps) {
  const [tab, setTab] = useState<'account' | 'reset'>(initialTab);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');

  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [migrateGuestData, setMigrateGuestData] = useState(true);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');

  const [resetPassword, setResetPassword] = useState('');
  const [confirmRollback, setConfirmRollback] = useState(false);

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setTab(initialTab);
      setErrorMsg(null);
      setSuccessMsg(null);
      setResetPassword('');
      setConfirmPassword('');
      setConfirmRollback(false);
    }
  }, [isOpen, initialTab]);

  if (!isOpen) return null;

  async function handleLoginOrRegister(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (authMode === 'register' && password !== confirmPassword) {
      setErrorMsg('两次输入的登录密码不一致，请核对后重试。');
      return;
    }

    setLoading(true);
    try {
      const endpoint = authMode === 'register' ? '/api/auth/register' : '/api/auth/login';
      const body =
        authMode === 'register'
          ? {
              username,
              password,
              displayName: displayName.trim() || undefined,
              initialProgress: migrateGuestData ? currentProgressPayload : undefined,
            }
          : { username, password };

      const resp = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await resp.json();
      if (!resp.ok) {
        setErrorMsg(data.error || '操作失败，请检查账号或密码。');
        return;
      }
      onAuthSuccess(data.token, data.user as AuthUser, data.progress as SyncProgressData);
      setPassword('');
      setConfirmPassword('');
      setSuccessMsg(
        authMode === 'register'
          ? '注册成功！当前登录密码将同步用于重置练习记录的安全验证。'
          : '登录成功，已加载账号保存的练习与模考记录。'
      );
    } catch (err) {
      setErrorMsg(`网络请求失败：${err instanceof Error ? err.message : '未知错误'}`);
    } finally {
      setLoading(false);
    }
  }

  async function handleSetPassword(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    if (newPassword.length < 6) {
      setErrorMsg('新密码长度至少为 6 位。');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setErrorMsg('两次输入的新密码不一致。');
      return;
    }
    setLoading(true);
    try {
      const resp = await fetch('/api/auth/set-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken ?? ''}`,
        },
        body: JSON.stringify({
          currentPassword: currentUser?.hasPassword ? currentPassword : '',
          newPassword,
        }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        setErrorMsg(data.error || '密码更新失败。');
        return;
      }
      onUserUpdated(data.user as AuthUser);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
      setSuccessMsg('登录密码已更新生效，重置全部记录时将沿用该密码进行验证。');
    } catch (err) {
      setErrorMsg(`网络异常：${err instanceof Error ? err.message : '未知错误'}`);
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifiedFullReset(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    if (!resetPassword.trim()) {
      setErrorMsg('请输入当前账号的登录密码后再清空全部历史记录。');
      return;
    }
    setLoading(true);
    try {
      const resp = await fetch('/api/auth/reset-progress', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken ?? ''}`,
        },
        body: JSON.stringify({ password: resetPassword }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        setErrorMsg(data.error || '密码验证未通过，未清除任何记录。');
        return;
      }
      setResetPassword('');
      onFullResetConfirmed(data.progress as SyncProgressData);
      setSuccessMsg('密码验证通过：此前所有练习记录、错题统计与模考档案已全部清空。');
    } catch (err) {
      setErrorMsg(`网络异常：${err instanceof Error ? err.message : '未知错误'}`);
    } finally {
      setLoading(false);
    }
  }

  function executeRollback() {
    onRollbackLastSession();
    setConfirmRollback(false);
    setErrorMsg(null);
    setSuccessMsg('已回退该次练习记录，题库错题频率与正确率已恢复至本次开始前的状态。');
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-label="账号登录注册与练习记录重置"
    >
      <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-white/12 bg-[#18181A] shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
          <div>
            <h2 className="text-base font-semibold text-[#F8F7F4]">
              账号登录 / 注册与练习记录管理
            </h2>
            <p className="mt-0.5 text-xs text-[#F8F7F4]/55">
              登录或注册账号即可保存学习进度，重置全部记录时直接沿用登录所设置的密码进行验证
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-[#F8F7F4]/55 hover:bg-white/10 hover:text-[#F8F7F4]"
            aria-label="关闭弹窗"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="border-b border-white/[0.06] px-6 py-3">
          <div className="inline-flex rounded-lg border border-white/10 bg-[#111113] p-1">
            <button
              onClick={() => {
                setTab('account');
                setErrorMsg(null);
                setSuccessMsg(null);
              }}
              className={`rounded-md px-3.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                tab === 'account'
                  ? 'bg-[#E0A458] text-[#111113] font-semibold'
                  : 'text-[#F8F7F4]/60 hover:text-[#F8F7F4]'
              }`}
            >
              {currentUser ? '账号信息与修改密码' : '账号登录 / 注册'}
            </button>
            <button
              onClick={() => {
                setTab('reset');
                setErrorMsg(null);
                setSuccessMsg(null);
              }}
              className={`rounded-md px-3.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                tab === 'reset'
                  ? 'bg-[#E0A458] text-[#111113] font-semibold'
                  : 'text-[#F8F7F4]/60 hover:text-[#F8F7F4]'
              }`}
            >
              练习记录重置与回退
            </button>
          </div>
        </div>

        <div className="space-y-5 p-6">
          {errorMsg && (
            <div className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3.5 py-2.5 text-xs text-red-300">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="flex items-start gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-2.5 text-xs text-emerald-300">
              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {tab === 'reset' ? (
            <div className="space-y-5">
              <div className="rounded-xl border border-white/10 bg-[#141416] p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 text-sm font-semibold text-[#F8F7F4]">
                      <RotateCcw className="h-4 w-4 text-[#E0A458]" />
                      回退本次 / 最近一次练习记录
                    </div>
                    <p className="mt-1 text-xs leading-relaxed text-[#F8F7F4]/60">
                      如果只是随便试做了几题、没有认真作答，可一键撤回该次练习产生的所有对错统计与模考记录，保留此前真实历史进度。
                    </p>
                  </div>
                </div>

                {latestSnapshot && latestSnapshot.recordedAttemptsCount > 0 ? (
                  <div className="mt-4 flex flex-col justify-between gap-3 rounded-lg border border-white/10 bg-[#18181A] p-3.5 sm:flex-row sm:items-center">
                    <div className="text-xs">
                      <div className="font-semibold text-[#F8F7F4]">
                        {latestSnapshot.sessionTitle}
                      </div>
                      <div className="mt-0.5 font-mono text-[#F8F7F4]/55 tabular-nums">
                        本次累计提交 {latestSnapshot.recordedAttemptsCount} 条作答记录
                      </div>
                    </div>

                    {!confirmRollback ? (
                      <button
                        onClick={() => setConfirmRollback(true)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-[#111113] px-3.5 py-2 text-xs font-medium text-[#F8F7F4]/85 hover:border-[#E0A458] hover:text-[#E0A458] whitespace-nowrap shrink-0"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                        回退本次记录
                      </button>
                    ) : (
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={executeRollback}
                          className="rounded-lg bg-[#E0A458] px-3 py-1.5 text-xs font-semibold text-[#111113] hover:bg-[#EBB66E] whitespace-nowrap"
                        >
                          确认撤回本次记录
                        </button>
                        <button
                          onClick={() => setConfirmRollback(false)}
                          className="rounded-lg border border-white/15 px-2.5 py-1.5 text-xs text-[#F8F7F4]/70 hover:bg-white/5 whitespace-nowrap"
                        >
                          取消
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="mt-3 rounded-lg border border-dashed border-white/12 bg-[#18181A] px-4 py-3 text-xs text-[#F8F7F4]/50">
                    当前或最近一次练习暂无可回退的作答记录。进入任意练习提交答案后，此处即可一键回退该次试做。
                  </div>
                )}
              </div>

              <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-5">
                <div className="flex items-center gap-2 text-sm font-semibold text-[#F8F7F4]">
                  <Trash2 className="h-4 w-4 text-red-400" />
                  重置此前所有练习记录（沿用登录密码验证）
                </div>
                <p className="mt-1 text-xs leading-relaxed text-[#F8F7F4]/60">
                  将永久清空累计 <span className="font-mono font-semibold text-[#F8F7F4]">{totalRecordedAttempts}</span> 次答题统计、
                  <span className="font-mono font-semibold text-[#F8F7F4]">{totalMockHistory}</span> 次模拟考成绩单、高频错题档案及当前复习计划。为防止误删，需验证您的账号登录密码。
                </p>

                {!currentUser ? (
                  <div className="mt-4 flex flex-col justify-between gap-3 rounded-lg border border-[#E0A458]/35 bg-[#E0A458]/10 p-4 sm:flex-row sm:items-center">
                    <div className="text-xs text-[#E0A458]">
                      当前尚未登录账号。请先登录或注册账号（注册时设置的密码即作为重置验证密码），系统会自动保留并关联当前本地记录。
                    </div>
                    <button
                      onClick={() => {
                        setErrorMsg(null);
                        setSuccessMsg(null);
                        setTab('account');
                      }}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-[#E0A458] px-3.5 py-2 text-xs font-semibold text-[#111113] hover:bg-[#EBB66E] whitespace-nowrap shrink-0"
                    >
                      <LogIn className="h-3.5 w-3.5" />
                      去登录 / 注册
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleVerifiedFullReset} className="mt-4 space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-[#F8F7F4]/75">
                        请输入账号 <span className="font-mono text-[#E0A458]">{currentUser.username}</span> 的登录密码
                      </label>
                      <input
                        type="password"
                        value={resetPassword}
                        onChange={(e) => setResetPassword(e.target.value)}
                        placeholder="请输入登录时设置的密码..."
                        className="mt-1.5 w-full rounded-lg border border-white/15 bg-[#111113] px-3.5 py-2 text-sm text-[#F8F7F4] placeholder:text-[#F8F7F4]/35 focus:border-red-500 focus:outline-none"
                      />
                    </div>
                    <div className="flex justify-end">
                      <button
                        type="submit"
                        disabled={loading || !resetPassword.trim()}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-4 py-2 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-45 whitespace-nowrap shrink-0"
                      >
                        {loading ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <ShieldCheck className="h-3.5 w-3.5" />
                        )}
                        验证登录密码并清空全部记录
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              {!currentUser ? (
                <form
                  onSubmit={handleLoginOrRegister}
                  className="space-y-4 rounded-xl border border-white/10 bg-[#141416] p-5"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.06] pb-3">
                    <div className="inline-flex rounded-lg border border-white/10 bg-[#111113] p-1">
                      <button
                        type="button"
                        onClick={() => {
                          setAuthMode('login');
                          setErrorMsg(null);
                          setSuccessMsg(null);
                        }}
                        className={`inline-flex items-center gap-1.5 rounded-md px-3.5 py-1.5 text-xs font-medium whitespace-nowrap ${
                          authMode === 'login'
                            ? 'bg-[#E0A458] text-[#111113] font-semibold'
                            : 'text-[#F8F7F4]/65 hover:text-[#F8F7F4]'
                        }`}
                      >
                        <LogIn className="h-3.5 w-3.5" />
                        账号登录
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setAuthMode('register');
                          setErrorMsg(null);
                          setSuccessMsg(null);
                        }}
                        className={`inline-flex items-center gap-1.5 rounded-md px-3.5 py-1.5 text-xs font-medium whitespace-nowrap ${
                          authMode === 'register'
                            ? 'bg-[#E0A458] text-[#111113] font-semibold'
                            : 'text-[#F8F7F4]/65 hover:text-[#F8F7F4]'
                        }`}
                      >
                        <UserPlus className="h-3.5 w-3.5" />
                        新用户注册
                      </button>
                    </div>
                    <span className="text-xs text-[#F8F7F4]/50">
                      登录密码同时用于重置记录验证
                    </span>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className={authMode === 'login' ? 'sm:col-span-2' : ''}>
                      <label className="block text-xs font-medium text-[#F8F7F4]/75">
                        账号名 (3–32 位字母、数字或中文)
                      </label>
                      <input
                        type="text"
                        required
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder="如 student9701"
                        className="mt-1 w-full rounded-lg border border-white/12 bg-[#111113] px-3 py-2 text-sm text-[#F8F7F4] placeholder:text-[#F8F7F4]/30 focus:border-[#E0A458] focus:outline-none"
                      />
                    </div>
                    {authMode === 'register' && (
                      <div>
                        <label className="block text-xs font-medium text-[#F8F7F4]/75">
                          显示昵称（选填）
                        </label>
                        <input
                          type="text"
                          value={displayName}
                          onChange={(e) => setDisplayName(e.target.value)}
                          placeholder="如 A2 化学冲刺"
                          className="mt-1 w-full rounded-lg border border-white/12 bg-[#111113] px-3 py-2 text-sm text-[#F8F7F4] placeholder:text-[#F8F7F4]/30 focus:border-[#E0A458] focus:outline-none"
                        />
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className={authMode === 'login' ? 'sm:col-span-2' : ''}>
                      <label className="block text-xs font-medium text-[#F8F7F4]/75">
                        登录密码（至少 6 位，重置记录时沿用此密码）
                      </label>
                      <input
                        type="password"
                        required
                        minLength={6}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="请输入 6 位以上密码"
                        className="mt-1 w-full rounded-lg border border-white/12 bg-[#111113] px-3 py-2 text-sm text-[#F8F7F4] placeholder:text-[#F8F7F4]/30 focus:border-[#E0A458] focus:outline-none"
                      />
                    </div>
                    {authMode === 'register' && (
                      <div>
                        <label className="block text-xs font-medium text-[#F8F7F4]/75">
                          确认登录密码
                        </label>
                        <input
                          type="password"
                          required
                          minLength={6}
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          placeholder="请再次输入密码"
                          className="mt-1 w-full rounded-lg border border-white/12 bg-[#111113] px-3 py-2 text-sm text-[#F8F7F4] placeholder:text-[#F8F7F4]/30 focus:border-[#E0A458] focus:outline-none"
                        />
                      </div>
                    )}
                  </div>

                  {authMode === 'register' && (totalRecordedAttempts > 0 || totalMockHistory > 0) && (
                    <label className="flex items-center gap-2 text-xs text-[#F8F7F4]/75">
                      <input
                        type="checkbox"
                        checked={migrateGuestData}
                        onChange={(e) => setMigrateGuestData(e.target.checked)}
                        className="accent-[#E0A458]"
                      />
                      <span>
                        将当前浏览器本地记录（{totalRecordedAttempts} 次答题 · {totalMockHistory} 次模考）自动关联到新账号
                      </span>
                    </label>
                  )}

                  <div className="flex items-center justify-between pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setAuthMode(authMode === 'login' ? 'register' : 'login');
                        setErrorMsg(null);
                      }}
                      className="text-xs text-[#F8F7F4]/60 hover:text-[#E0A458]"
                    >
                      {authMode === 'login' ? '还没有账号？点击注册' : '已有账号？直接登录'}
                    </button>
                    <button
                      type="submit"
                      disabled={loading}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-[#E0A458] px-4 py-2 text-xs font-semibold text-[#111113] hover:bg-[#EBB66E] disabled:opacity-45 whitespace-nowrap"
                    >
                      {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                      {authMode === 'register' ? '完成注册并登录' : '立即登录'}
                    </button>
                  </div>
                </form>
              ) : (
                <div className="space-y-4">
                  <div className="flex flex-col justify-between gap-3 rounded-xl border border-white/10 bg-[#141416] p-4 sm:flex-row sm:items-center">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#E0A458]/15 text-[#E0A458]">
                        <UserCheck className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-[#F8F7F4]">
                          {currentUser.displayName}{' '}
                          <span className="font-mono text-xs font-normal text-[#F8F7F4]/55">
                            (@{currentUser.username})
                          </span>
                        </div>
                        <div className="mt-0.5 text-xs text-[#F8F7F4]/60">
                          已登录 · 重置练习记录将直接验证该账号的登录密码
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={onLogout}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-[#18181A] px-3 py-1.5 text-xs font-medium text-[#F8F7F4]/80 hover:border-[#E0A458] hover:text-[#E0A458] whitespace-nowrap shrink-0"
                    >
                      <LogOut className="h-3.5 w-3.5" />
                      退出登录
                    </button>
                  </div>

                  <form
                    onSubmit={handleSetPassword}
                    className="space-y-3 rounded-xl border border-white/10 bg-[#141416] p-4"
                  >
                    <div className="flex items-center gap-2 text-xs font-semibold text-[#F8F7F4]">
                      <KeyRound className="h-3.5 w-3.5 text-[#E0A458]" />
                      修改登录密码（同步更新重置验证密码）
                    </div>
                    {currentUser.hasPassword && (
                      <input
                        type="password"
                        required
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        placeholder="请输入当前登录密码"
                        className="w-full rounded-lg border border-white/12 bg-[#111113] px-3 py-2 text-sm text-[#F8F7F4] placeholder:text-[#F8F7F4]/30 focus:border-[#E0A458] focus:outline-none"
                      />
                    )}
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <input
                        type="password"
                        required
                        minLength={6}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="新密码（至少 6 位）"
                        className="w-full rounded-lg border border-white/12 bg-[#111113] px-3 py-2 text-sm text-[#F8F7F4] placeholder:text-[#F8F7F4]/30 focus:border-[#E0A458] focus:outline-none"
                      />
                      <input
                        type="password"
                        required
                        minLength={6}
                        value={confirmNewPassword}
                        onChange={(e) => setConfirmNewPassword(e.target.value)}
                        placeholder="再次确认新密码"
                        className="w-full rounded-lg border border-white/12 bg-[#111113] px-3 py-2 text-sm text-[#F8F7F4] placeholder:text-[#F8F7F4]/30 focus:border-[#E0A458] focus:outline-none"
                      />
                    </div>
                    <div className="flex justify-end">
                      <button
                        type="submit"
                        disabled={loading}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-[#E0A458] px-3.5 py-1.5 text-xs font-semibold text-[#111113] hover:bg-[#EBB66E] disabled:opacity-45 whitespace-nowrap"
                      >
                        {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                        保存新密码
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
