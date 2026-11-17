import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  KeyRound,
  Loader2,
  LogOut,
  RotateCcw,
  ShieldCheck,
  Smartphone,
  Trash2,
  UserCheck,
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
  const [authMode, setAuthMode] = useState<'login' | 'register'>('register');

  // Auth form fields
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [migrateGuestData, setMigrateGuestData] = useState(true);

  // Change / Set Password fields
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');

  // Full reset verification field
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
      setConfirmRollback(false);
    }
  }, [isOpen, initialTab]);

  if (!isOpen) return null;

  async function handleLoginOrRegister(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
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
      setSuccessMsg(
        authMode === 'register'
          ? '账号与密码设置完成，当前练习记录已关联并同步。'
          : '登录成功，已加载云端保存的练习与模考记录。'
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
      setSuccessMsg('密码已更新生效，可用于后续重要数据重置验证。');
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
      setErrorMsg('请输入账号密码完成验证后再清空全部历史记录。');
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-label="账号设置与练习记录重置"
    >
      <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-xl">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              账号密码管理与练习记录重置
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              支持单次试做记录无损回退、密码验证清空全部历史记录，并预留微信小程序 wx.login 账号对接
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            aria-label="关闭弹窗"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Segmented Tab Switcher */}
        <div className="border-b border-slate-100 px-6 py-3">
          <div className="inline-flex rounded-lg bg-slate-100 p-1">
            <button
              onClick={() => {
                setTab('reset');
                setErrorMsg(null);
                setSuccessMsg(null);
              }}
              className={`rounded-md px-3.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                tab === 'reset'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              练习记录重置与回退
            </button>
            <button
              onClick={() => {
                setTab('account');
                setErrorMsg(null);
                setSuccessMsg(null);
              }}
              className={`rounded-md px-3.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                tab === 'account'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              账号密码与微信小程序登录
            </button>
          </div>
        </div>

        <div className="space-y-5 p-6">
          {errorMsg && (
            <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs text-red-800">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-xs text-emerald-800">
              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {tab === 'reset' ? (
            <div className="space-y-5">
              {/* Section A: Rollback Latest/Current Session */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                      <RotateCcw className="h-4 w-4 text-[#1D4ED8]" />
                      回退本次 / 最近一次练习记录
                    </div>
                    <p className="mt-1 text-xs leading-relaxed text-slate-600">
                      如果只是随便试做了几题、没有认真作答，可一键撤回该次练习产生的所有对错统计与模考记录，保留此前真实历史进度。
                    </p>
                  </div>
                </div>

                {latestSnapshot && latestSnapshot.recordedAttemptsCount > 0 ? (
                  <div className="mt-4 flex flex-col justify-between gap-3 rounded-lg border border-slate-200 bg-white p-3.5 sm:flex-row sm:items-center">
                    <div className="text-xs">
                      <div className="font-semibold text-slate-800">
                        {latestSnapshot.sessionTitle}
                      </div>
                      <div className="mt-0.5 font-mono text-slate-500 tabular-nums">
                        本次累计提交 {latestSnapshot.recordedAttemptsCount} 条作答记录
                      </div>
                    </div>

                    {!confirmRollback ? (
                      <button
                        onClick={() => setConfirmRollback(true)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-800 hover:border-[#1D4ED8] hover:text-[#1D4ED8] whitespace-nowrap shrink-0"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                        回退本次记录
                      </button>
                    ) : (
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={executeRollback}
                          className="rounded-lg bg-[#1D4ED8] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#1E40AF] whitespace-nowrap"
                        >
                          确认撤回本次记录
                        </button>
                        <button
                          onClick={() => setConfirmRollback(false)}
                          className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-600 hover:bg-slate-50 whitespace-nowrap"
                        >
                          取消
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="mt-3 rounded-lg border border-dashed border-slate-200 bg-white px-4 py-3 text-xs text-slate-500">
                    当前或最近一次练习暂无可回退的作答记录。进入任意练习提交答案后，此处即可一键回退该次试做。
                  </div>
                )}
              </div>

              {/* Section B: Password-Protected Full Progress Reset */}
              <div className="rounded-xl border border-red-200 bg-red-50/30 p-5">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <Trash2 className="h-4 w-4 text-red-600" />
                  重置此前所有练习记录（需验证账号密码）
                </div>
                <p className="mt-1 text-xs leading-relaxed text-slate-600">
                  将永久清空累计 <span className="font-mono font-semibold text-slate-900">{totalRecordedAttempts}</span> 次答题统计、
                  <span className="font-mono font-semibold text-slate-900">{totalMockHistory}</span> 次模拟考成绩单、高频错题档案及当前复习计划。为防止误删，必须验证密码后方可执行。
                </p>

                {!currentUser || !currentUser.hasPassword ? (
                  <div className="mt-4 flex flex-col justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 sm:flex-row sm:items-center">
                    <div className="text-xs text-amber-900">
                      {currentUser
                        ? '当前账号尚未设置密码（例如仅通过微信登录），请先设置安全密码后再重置全部历史记录。'
                        : '当前为本地访客模式，尚未绑定账号密码。请先创建或登录账号密码，系统会自动迁移当前本地进度。'}
                    </div>
                    <button
                      onClick={() => {
                        setErrorMsg(null);
                        setSuccessMsg(null);
                        setTab('account');
                      }}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-medium text-white hover:bg-slate-800 whitespace-nowrap shrink-0"
                    >
                      <KeyRound className="h-3.5 w-3.5" />
                      去设置账号密码
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleVerifiedFullReset} className="mt-4 space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-700">
                        验证账号 <span className="font-mono">{currentUser.username}</span> 的登录密码
                      </label>
                      <input
                        type="password"
                        value={resetPassword}
                        onChange={(e) => setResetPassword(e.target.value)}
                        placeholder="请输入账号密码以确认清空全部练习记录..."
                        className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 focus:border-red-600 focus:outline-none"
                      />
                    </div>
                    <div className="flex justify-end">
                      <button
                        type="submit"
                        disabled={loading || !resetPassword.trim()}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-4 py-2 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50 whitespace-nowrap shrink-0"
                      >
                        {loading ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <ShieldCheck className="h-3.5 w-3.5" />
                        )}
                        验证密码并清空全部练习记录
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              {!currentUser ? (
                <form onSubmit={handleLoginOrRegister} className="space-y-4 rounded-xl border border-slate-200 p-5">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div className="inline-flex rounded-lg bg-slate-100 p-1">
                      <button
                        type="button"
                        onClick={() => {
                          setAuthMode('register');
                          setErrorMsg(null);
                        }}
                        className={`rounded-md px-3 py-1 text-xs font-medium whitespace-nowrap ${
                          authMode === 'register'
                            ? 'bg-white text-slate-900 shadow-xs'
                            : 'text-slate-600'
                        }`}
                      >
                        注册并设置密码
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setAuthMode('login');
                          setErrorMsg(null);
                        }}
                        className={`rounded-md px-3 py-1 text-xs font-medium whitespace-nowrap ${
                          authMode === 'login'
                            ? 'bg-white text-slate-900 shadow-xs'
                            : 'text-slate-600'
                        }`}
                      >
                        已有账号登录
                      </button>
                    </div>
                    <span className="text-xs text-slate-500">支持全平台记录同步</span>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <label className="block text-xs font-medium text-slate-700">
                        账号名 (3–32 位字母/数字/中文)
                      </label>
                      <input
                        type="text"
                        required
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder="如 student9701"
                        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-[#1D4ED8] focus:outline-none"
                      />
                    </div>
                    {authMode === 'register' && (
                      <div>
                        <label className="block text-xs font-medium text-slate-700">
                          显示昵称（选填）
                        </label>
                        <input
                          type="text"
                          value={displayName}
                          onChange={(e) => setDisplayName(e.target.value)}
                          placeholder="如 A2 化学冲刺"
                          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-[#1D4ED8] focus:outline-none"
                        />
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700">
                      密码 (至少 6 位，用于登录及重置全部记录验证)
                    </label>
                    <input
                      type="password"
                      required
                      minLength={6}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="请输入 6 位以上密码"
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-[#1D4ED8] focus:outline-none"
                    />
                  </div>

                  {authMode === 'register' && (totalRecordedAttempts > 0 || totalMockHistory > 0) && (
                    <label className="flex items-center gap-2 text-xs text-slate-700">
                      <input
                        type="checkbox"
                        checked={migrateGuestData}
                        onChange={(e) => setMigrateGuestData(e.target.checked)}
                        className="rounded border-slate-300"
                      />
                      <span>
                        将当前浏览器访客记录（{totalRecordedAttempts} 次答题 · {totalMockHistory} 次模考）自动合并到新账号
                      </span>
                    </label>
                  )}

                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={loading}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-[#1D4ED8] px-4 py-2 text-xs font-medium text-white hover:bg-[#1E40AF] disabled:opacity-50 whitespace-nowrap"
                    >
                      {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                      {authMode === 'register' ? '创建账号并启用密码保护' : '立即登录'}
                    </button>
                  </div>
                </form>
              ) : (
                <div className="space-y-4">
                  <div className="flex flex-col justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50/70 p-4 sm:flex-row sm:items-center">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-[#1D4ED8]">
                        <UserCheck className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-slate-900">
                          {currentUser.displayName}{' '}
                          <span className="font-mono text-xs font-normal text-slate-500">
                            (@{currentUser.username})
                          </span>
                        </div>
                        <div className="mt-0.5 text-xs text-slate-600">
                          密码保护：{currentUser.hasPassword ? '已设置' : '未设置'} · 微信绑定：
                          {currentUser.wechatBound
                            ? `已绑定 (${currentUser.wechatOpenIdMasked ?? 'OpenID'})`
                            : '待发布微信小程序后绑定'}
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={onLogout}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
                    >
                      <LogOut className="h-3.5 w-3.5" />
                      退出登录
                    </button>
                  </div>

                  {/* Set or Update Password */}
                  <form onSubmit={handleSetPassword} className="space-y-3 rounded-xl border border-slate-200 p-4">
                    <div className="flex items-center gap-2 text-xs font-semibold text-slate-800">
                      <KeyRound className="h-3.5 w-3.5 text-[#1D4ED8]" />
                      {currentUser.hasPassword ? '修改账号密码' : '为当前账号设置重置密码'}
                    </div>
                    {currentUser.hasPassword && (
                      <input
                        type="password"
                        required
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        placeholder="请输入当前密码"
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-[#1D4ED8] focus:outline-none"
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
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-[#1D4ED8] focus:outline-none"
                      />
                      <input
                        type="password"
                        required
                        minLength={6}
                        value={confirmNewPassword}
                        onChange={(e) => setConfirmNewPassword(e.target.value)}
                        placeholder="再次确认新密码"
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-[#1D4ED8] focus:outline-none"
                      />
                    </div>
                    <div className="flex justify-end">
                      <button
                        type="submit"
                        disabled={loading}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-1.5 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50 whitespace-nowrap"
                      >
                        {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                        保存密码
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* WeChat Mini Program Login Integration Architecture Card */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-800">
                  <Smartphone className="h-4 w-4 text-emerald-700" />
                  微信小程序账号直接登录接口已就绪
                </div>
                <p className="mt-1.5 text-xs leading-relaxed text-slate-600">
                  后端已内置 <span className="font-mono font-medium text-slate-800">POST /api/auth/wechat-miniprogram</span>（调用微信官方{' '}
                  <span className="font-mono">jscode2session</span> 接口自动抓取用户 OpenID/UnionID）及{' '}
                  <span className="font-mono font-medium text-slate-800">POST /api/auth/bind-wechat</span>。
                  后续发布微信小程序时，只需在服务端环境变量配置 <span className="font-mono">WECHAT_APPID</span> 与{' '}
                  <span className="font-mono">WECHAT_SECRET</span>，小程序端调用 <span className="font-mono">wx.login()</span> 上传{' '}
                  <span className="font-mono">code</span> 即可自动建号并跨端共享错题记录与密码验证策略。
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
