import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { Express, Request, Response } from 'express';
import type {
  MockExamResult,
  QuestionStat,
  RevisionPlan,
} from '../src/types/chemistry.ts';

export interface UserProgressPayload {
  statsMap: Record<string, QuestionStat>;
  mockHistory: MockExamResult[];
  revisionPlan: RevisionPlan | null;
  targetExamDate: string;
}

export interface StoredUser {
  id: string;
  username: string;
  displayName: string;
  passwordHash?: string;
  createdAt: string;
  progress: UserProgressPayload;
}

interface AuthStoreData {
  tokenSecret: string;
  users: StoredUser[];
}

export interface PublicUser {
  id: string;
  username: string;
  displayName: string;
  hasPassword: boolean;
  createdAt: string;
}

const DATA_DIR = path.resolve(process.cwd(), '.data');
const STORE_PATH = path.join(DATA_DIR, 'auth-store.json');

function defaultProgress(targetExamDate = '2027-05-15'): UserProgressPayload {
  return {
    statsMap: {},
    mockHistory: [],
    revisionPlan: null,
    targetExamDate,
  };
}

function readStore(): AuthStoreData {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(STORE_PATH)) {
    const initial: AuthStoreData = {
      tokenSecret:
        process.env.AUTH_TOKEN_SECRET &&
        process.env.AUTH_TOKEN_SECRET !== 'CHANGE_ME_SESSION_SECRET'
          ? process.env.AUTH_TOKEN_SECRET
          : crypto.randomBytes(32).toString('hex'),
      users: [],
    };
    fs.writeFileSync(STORE_PATH, JSON.stringify(initial, null, 2), 'utf8');
    return initial;
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(STORE_PATH, 'utf8')) as AuthStoreData;
    if (!parsed.tokenSecret) {
      parsed.tokenSecret = crypto.randomBytes(32).toString('hex');
    }
    if (!Array.isArray(parsed.users)) parsed.users = [];
    return parsed;
  } catch {
    return {
      tokenSecret: crypto.randomBytes(32).toString('hex'),
      users: [],
    };
  }
}

function writeStore(store: AuthStoreData): void {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2), 'utf8');
}

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

function verifyPasswordHash(password: string, storedHash?: string): boolean {
  if (!storedHash || !storedHash.includes(':')) return false;
  const [salt, keyHex] = storedHash.split(':');
  if (!salt || !keyHex) return false;
  const keyBuf = Buffer.from(keyHex, 'hex');
  const derivedBuf = crypto.scryptSync(password, salt, 64);
  if (keyBuf.length !== derivedBuf.length) return false;
  return crypto.timingSafeEqual(keyBuf, derivedBuf);
}

function getSecret(store: AuthStoreData): string {
  if (
    process.env.AUTH_TOKEN_SECRET &&
    process.env.AUTH_TOKEN_SECRET !== 'CHANGE_ME_SESSION_SECRET'
  ) {
    return process.env.AUTH_TOKEN_SECRET;
  }
  return store.tokenSecret;
}

function signToken(userId: string, secret: string): string {
  const payload = Buffer.from(
    JSON.stringify({ uid: userId, iat: Date.now() }),
    'utf8'
  ).toString('base64url');
  const sig = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('base64url');
  return `${payload}.${sig}`;
}

function verifyToken(token: string, secret: string): string | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [payload, sig] = parts;
  const expected = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('base64url');
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }
  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as {
      uid?: string;
    };
    return parsed.uid ?? null;
  } catch {
    return null;
  }
}

function toPublicUser(u: StoredUser): PublicUser {
  return {
    id: u.id,
    username: u.username,
    displayName: u.displayName,
    hasPassword: Boolean(u.passwordHash),
    createdAt: u.createdAt,
  };
}

function extractBearer(req: Request): string | null {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) return null;
  return auth.slice(7).trim() || null;
}

function resolveAuthenticatedUser(
  req: Request,
  store: AuthStoreData
): StoredUser | null {
  const token = extractBearer(req);
  if (!token) return null;
  const uid = verifyToken(token, getSecret(store));
  if (!uid) return null;
  return store.users.find((u) => u.id === uid) ?? null;
}

function sanitizeProgress(raw: unknown): UserProgressPayload {
  const obj = (raw && typeof raw === 'object' ? raw : {}) as Partial<UserProgressPayload>;
  return {
    statsMap:
      obj.statsMap && typeof obj.statsMap === 'object' ? obj.statsMap : {},
    mockHistory: Array.isArray(obj.mockHistory) ? obj.mockHistory : [],
    revisionPlan: obj.revisionPlan ?? null,
    targetExamDate:
      typeof obj.targetExamDate === 'string' && obj.targetExamDate
        ? obj.targetExamDate
        : '2027-05-15',
  };
}

export function registerAuthRoutes(app: Express): void {
  // Get current authenticated session & synced progress
  app.get('/api/auth/me', (req: Request, res: Response) => {
    const store = readStore();
    const user = resolveAuthenticatedUser(req, store);
    if (!user) {
      res.status(401).json({ error: '未登录或会话已过期' });
      return;
    }
    res.json({
      user: toPublicUser(user),
      progress: user.progress ?? defaultProgress(),
    });
  });

  // Register account with username + password
  app.post('/api/auth/register', (req: Request, res: Response) => {
    const { username, password, displayName, initialProgress } = req.body as {
      username?: string;
      password?: string;
      displayName?: string;
      initialProgress?: UserProgressPayload;
    };

    const cleanUsername = (username ?? '').trim().toLowerCase();
    if (!/^[a-zA-Z0-9_\u4e00-\u9fa5]{3,32}$/.test(cleanUsername)) {
      res.status(400).json({
        error: '账号名需为 3–32 位字母、数字、下划线或中文字符。',
      });
      return;
    }
    if (!password || password.length < 6) {
      res.status(400).json({ error: '密码长度至少为 6 位。' });
      return;
    }

    const store = readStore();
    if (store.users.some((u) => u.username.toLowerCase() === cleanUsername)) {
      res.status(409).json({ error: '该账号名已存在，请直接登录或更换用户名。' });
      return;
    }

    const user: StoredUser = {
      id: `usr_${crypto.randomBytes(8).toString('hex')}`,
      username: cleanUsername,
      displayName: (displayName ?? username ?? cleanUsername).trim().slice(0, 32),
      passwordHash: hashPassword(password),
      createdAt: new Date().toISOString(),
      progress: initialProgress ? sanitizeProgress(initialProgress) : defaultProgress(),
    };

    store.users.push(user);
    writeStore(store);

    const token = signToken(user.id, getSecret(store));
    res.json({
      token,
      user: toPublicUser(user),
      progress: user.progress,
    });
  });

  // Login with username + password
  app.post('/api/auth/login', (req: Request, res: Response) => {
    const { username, password } = req.body as {
      username?: string;
      password?: string;
    };
    const cleanUsername = (username ?? '').trim().toLowerCase();
    if (!cleanUsername || !password) {
      res.status(400).json({ error: '请输入账号和密码。' });
      return;
    }

    const store = readStore();
    const user = store.users.find((u) => u.username.toLowerCase() === cleanUsername);
    if (!user || !verifyPasswordHash(password, user.passwordHash)) {
      res.status(401).json({ error: '账号或密码不正确。' });
      return;
    }

    const token = signToken(user.id, getSecret(store));
    res.json({
      token,
      user: toPublicUser(user),
      progress: user.progress ?? defaultProgress(),
    });
  });

  // Set or change password for authenticated user (including WeChat users adding a reset password)
  app.post('/api/auth/set-password', (req: Request, res: Response) => {
    const store = readStore();
    const user = resolveAuthenticatedUser(req, store);
    if (!user) {
      res.status(401).json({ error: '请先登录账号。' });
      return;
    }

    const { currentPassword, newPassword } = req.body as {
      currentPassword?: string;
      newPassword?: string;
    };

    if (!newPassword || newPassword.length < 6) {
      res.status(400).json({ error: '新密码长度至少为 6 位。' });
      return;
    }
    if (user.passwordHash && !verifyPasswordHash(currentPassword ?? '', user.passwordHash)) {
      res.status(403).json({ error: '原密码验证未通过，无法修改密码。' });
      return;
    }

    user.passwordHash = hashPassword(newPassword);
    writeStore(store);
    res.json({ ok: true, user: toPublicUser(user) });
  });

  // Verify password (used before destructive operations)
  app.post('/api/auth/verify-password', (req: Request, res: Response) => {
    const store = readStore();
    const user = resolveAuthenticatedUser(req, store);
    if (!user) {
      res.status(401).json({ error: '请先登录账号并设置密码。' });
      return;
    }
    const { password } = req.body as { password?: string };
    if (!user.passwordHash) {
      res.status(400).json({ error: '当前账号尚未设置密码，请先设置密码。' });
      return;
    }
    if (!verifyPasswordHash(password ?? '', user.passwordHash)) {
      res.status(403).json({ error: '密码验证失败，请核对后重试。' });
      return;
    }
    res.json({ verified: true });
  });

  // Password-verified full progress reset
  app.post('/api/auth/reset-progress', (req: Request, res: Response) => {
    const store = readStore();
    const user = resolveAuthenticatedUser(req, store);
    if (!user) {
      res.status(401).json({ error: '请先登录或注册账号密码，再执行全部记录重置。' });
      return;
    }
    const { password } = req.body as { password?: string };
    if (!user.passwordHash) {
      res.status(400).json({ error: '当前账号尚未设置密码，请先设置密码后再重置。' });
      return;
    }
    if (!verifyPasswordHash(password ?? '', user.passwordHash)) {
      res.status(403).json({ error: '密码错误：重置全部历史练习记录失败。' });
      return;
    }

    const keepExamDate = user.progress?.targetExamDate ?? '2027-05-15';
    user.progress = defaultProgress(keepExamDate);
    writeStore(store);
    res.json({ ok: true, progress: user.progress });
  });

  // Sync user progress
  app.put('/api/user/progress', (req: Request, res: Response) => {
    const store = readStore();
    const user = resolveAuthenticatedUser(req, store);
    if (!user) {
      res.status(401).json({ error: '未登录' });
      return;
    }
    user.progress = sanitizeProgress(req.body);
    writeStore(store);
    res.json({ ok: true });
  });
}
