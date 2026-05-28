const express = require('express');
const compression = require('compression');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');

const app = express();
// Gzip compression: critical for /api/state (3.79 MB → ~300 KB)
app.use(compression({ level: 6, threshold: 1024 }));
app.use(express.json({ limit: '50mb' }));

// No-store for every response (server is the single source of truth)
app.use((req, res, next) => {
  res.set('Cache-Control', 'no-store');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  next();
});

const DATA_DIR = process.env.DATA_DIR || '/data';
const STATE_FILE = path.join(DATA_DIR, 'state.json');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const SESSIONS_FILE = path.join(DATA_DIR, 'sessions.json');
const SESSION_COOKIE = process.env.SESSION_COOKIE || 'hfc_session';
const SESSION_TTL_MS = Number(process.env.SESSION_TTL_MS || (7 * 24 * 60 * 60 * 1000)); // 7 days
const COOKIE_SECURE = String(process.env.COOKIE_SECURE || '').toLowerCase() === 'true';
const BCRYPT_ROUNDS = Number(process.env.BCRYPT_ROUNDS || 10);

function normalizeState(obj) {
  const payload = obj && obj.payload && typeof obj.payload === 'object' ? obj.payload : {};
  let rev = 0;
  if (obj && Number.isFinite(obj.rev)) rev = obj.rev;
  else if (obj && Number.isFinite(obj.version)) rev = obj.version; // backward-compat
  else rev = 0;
  const updatedAt = obj && obj.updatedAt ? String(obj.updatedAt) : null;
  return { rev: Number(rev) || 0, updatedAt, payload };
}

function readStateFile() {
  try {
    const raw = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    return normalizeState(raw);
  } catch (e) {
    return { rev: 0, updatedAt: null, payload: {} };
  }
}

function stableStringify(x) {
  try {
    return JSON.stringify(x);
  } catch (e) {
    return null;
  }
}

function writeStateFileAtomic(state) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const tmp = `${STATE_FILE}.tmp.${process.pid}.${Date.now()}`;
  const data = JSON.stringify({ rev: state.rev, updatedAt: state.updatedAt, payload: state.payload }, null, 2);

  const fd = fs.openSync(tmp, 'w');
  try {
    fs.writeFileSync(fd, data, 'utf8');
    fs.fsyncSync(fd);
  } finally {
    try { fs.closeSync(fd); } catch (_) { }
  }

  fs.renameSync(tmp, STATE_FILE);

  // Best-effort fsync the directory to ensure rename durability.
  try {
    const dfd = fs.openSync(DATA_DIR, 'r');
    try { fs.fsyncSync(dfd); } finally { fs.closeSync(dfd); }
  } catch (_) { }

  return Buffer.byteLength(data);
}

function readJsonFileSafe(filePath, fallback) {
  try {
    const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return raw;
  } catch (e) {
    return fallback;
  }
}

function writeJsonFileAtomic(filePath, dataObj) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const tmp = `${filePath}.tmp.${process.pid}.${Date.now()}`;
  const data = JSON.stringify(dataObj, null, 2);

  const fd = fs.openSync(tmp, 'w');
  try {
    fs.writeFileSync(fd, data, 'utf8');
    fs.fsyncSync(fd);
  } finally {
    try { fs.closeSync(fd); } catch (_) { }
  }

  fs.renameSync(tmp, filePath);

  try {
    const dfd = fs.openSync(DATA_DIR, 'r');
    try { fs.fsyncSync(dfd); } finally { fs.closeSync(dfd); }
  } catch (_) { }

  return Buffer.byteLength(data);
}

function nowIso() {
  return new Date().toISOString();
}

function genId() {
  try { return crypto.randomUUID(); } catch (_) { return crypto.randomBytes(16).toString('hex'); }
}

function readUsers() {
  const list = readJsonFileSafe(USERS_FILE, []);
  return Array.isArray(list) ? list : [];
}

function saveUsers(list) {
  return writeJsonFileAtomic(USERS_FILE, Array.isArray(list) ? list : []);
}

function readSessions() {
  const obj = readJsonFileSafe(SESSIONS_FILE, {});
  return (obj && typeof obj === 'object') ? obj : {};
}

function saveSessions(obj) {
  return writeJsonFileAtomic(SESSIONS_FILE, (obj && typeof obj === 'object') ? obj : {});
}

function sanitizeUser(u) {
  if (!u || typeof u !== 'object') return null;
  return { id: u.id, username: u.username, role: u.role };
}

function parseCookies(req) {
  const header = (req && req.headers && req.headers.cookie) ? String(req.headers.cookie) : '';
  const out = {};
  header.split(';').forEach(part => {
    const idx = part.indexOf('=');
    if (idx === -1) return;
    const k = part.slice(0, idx).trim();
    const v = part.slice(idx + 1).trim();
    if (k) out[k] = v;
  });
  return out;
}

function setSessionCookie(res, sid, maxAgeMs) {
  const maxAge = Math.max(0, Math.floor((Number(maxAgeMs) || 0) / 1000));
  // Auto-detect HTTPS via X-Forwarded-Proto (Cloudflare/Nginx) or explicit env
  const isSecure = COOKIE_SECURE || (res.req && (
    res.req.headers['x-forwarded-proto'] === 'https' ||
    res.req.secure
  ));
  const parts = [
    `${SESSION_COOKIE}=${sid || ''}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${maxAge}`,
  ];
  if (isSecure) parts.push('Secure');
  res.setHeader('Set-Cookie', parts.join('; '));
}

function pruneExpiredSessions(sessions) {
  const now = Date.now();
  let changed = false;
  Object.keys(sessions || {}).forEach((sid) => {
    const s = sessions[sid];
    if (!s || !s.expiresAt) return;
    const exp = Date.parse(s.expiresAt);
    if (Number.isFinite(exp) && exp <= now) {
      delete sessions[sid];
      changed = true;
    }
  });
  return changed;
}

function getAuthFromRequest(req) {
  const cookies = parseCookies(req);
  const sid = cookies[SESSION_COOKIE];
  if (!sid) {
    return { user: null, role: 'guest', sessionId: null, isAuthenticated: false };
  }

  const sessions = readSessions();
  let changed = pruneExpiredSessions(sessions);
  const s = sessions[sid];
  if (!s || !s.userId) {
    if (changed) saveSessions(sessions);
    return { user: null, role: 'guest', sessionId: null, isAuthenticated: false };
  }

  const users = readUsers();
  const user = users.find(u => u && u.id === s.userId);
  if (!user) {
    delete sessions[sid];
    saveSessions(sessions);
    return { user: null, role: 'guest', sessionId: null, isAuthenticated: false };
  }

  if (changed) saveSessions(sessions);
  return { user, role: user.role, sessionId: sid, isAuthenticated: true };
}

function requireRole(roles) {
  const allowed = Array.isArray(roles) ? roles : [];
  return (req, res, next) => {
    const auth = getAuthFromRequest(req);
    if (!auth.isAuthenticated) {
      return res.status(401).json({ ok: false, error: 'unauthorized' });
    }
    if (!allowed.includes(auth.role)) {
      return res.status(403).json({ ok: false, error: 'forbidden' });
    }
    req.auth = auth;
    return next();
  };
}

function ensureAdminSeed() {
  const users = readUsers();
  if (users.length) return;
  const now = nowIso();
  const hash = bcrypt.hashSync('admin', BCRYPT_ROUNDS);
  const admin = {
    id: genId(),
    username: 'admin',
    usernameLower: 'admin',
    password_hash: hash,
    role: 'admin',
    created_at: now,
    updated_at: now
  };
  saveUsers([admin]);
  console.log('[state-api] seeded admin user');
}

app.get('/api/state/meta', (req, res) => {
  const cur = readStateFile();
  let sizeBytes = 0;
  try {
    sizeBytes = fs.statSync(STATE_FILE).size;
  } catch (_) {
    sizeBytes = Buffer.byteLength(stableStringify(cur) || '');
  }
  res.json({ ok: true, rev: cur.rev, updatedAt: cur.updatedAt, sizeBytes });
});

app.get('/api/state', (req, res) => {
  const cur = readStateFile();
  res.json({ ok: true, rev: cur.rev, updatedAt: cur.updatedAt, payload: cur.payload });
});

// ALWAYS last-write-wins: no conflict detection, no 409 responses
// Server is the single source of truth; clients always overwrite
function handleSave(req, res) {
  const body = req.body || {};
  const incomingPayload = body && body.payload && typeof body.payload === 'object' ? body.payload : {};
  const cur = readStateFile();

  // Idempotency: do not churn rev if payload identical.
  const curStr = stableStringify(cur.payload);
  const incStr = stableStringify(incomingPayload);
  if (curStr !== null && incStr !== null && curStr === incStr) {
    return res.json({ ok: true, rev: cur.rev, updatedAt: cur.updatedAt });
  }

  const next = { rev: cur.rev + 1, updatedAt: new Date().toISOString(), payload: incomingPayload };
  const bytes = writeStateFileAtomic(next);
  console.log(`[state-api] saved rev=${next.rev} bytes=${bytes} path=${STATE_FILE} updatedAt=${next.updatedAt}`);
  res.json({ ok: true, rev: next.rev, updatedAt: next.updatedAt });
}

// All POST endpoints now use last-write-wins (no conflict)
const requireWriter = requireRole(['admin', 'user']);
app.post('/api/state', requireWriter, (req, res) => handleSave(req, res));
app.post('/api/state/force', requireWriter, (req, res) => handleSave(req, res));
app.post('/api/state/save', requireWriter, (req, res) => handleSave(req, res));

// ==================== AUTH API ====================

app.get(['/auth/me', '/api/auth/me'], (req, res) => {
  const auth = getAuthFromRequest(req);
  if (!auth.isAuthenticated) {
    return res.json({ ok: true, user: { id: null, username: 'guest', role: 'guest', anonymous: true } });
  }
  return res.json({ ok: true, user: sanitizeUser(auth.user) });
});

app.post(['/auth/login', '/api/auth/login'], async (req, res) => {
  const body = req.body || {};
  const username = String(body.username || '').trim();
  const password = String(body.password || '');
  if (!username || !password) {
    return res.status(400).json({ ok: false, error: 'missing_credentials' });
  }

  const users = readUsers();
  const u = users.find(x => x && (String(x.usernameLower || '').toLowerCase() === username.toLowerCase()));
  if (!u) {
    return res.status(401).json({ ok: false, error: 'invalid_credentials' });
  }

  const ok = await bcrypt.compare(password, String(u.password_hash || ''));
  if (!ok) {
    return res.status(401).json({ ok: false, error: 'invalid_credentials' });
  }

  const sid = genId();
  const sessions = readSessions();
  const exp = new Date(Date.now() + SESSION_TTL_MS).toISOString();
  sessions[sid] = { userId: u.id, createdAt: nowIso(), expiresAt: exp };
  saveSessions(sessions);
  setSessionCookie(res, sid, SESSION_TTL_MS);
  return res.json({ ok: true, user: sanitizeUser(u) });
});

app.post(['/auth/logout', '/api/auth/logout'], (req, res) => {
  const cookies = parseCookies(req);
  const sid = cookies[SESSION_COOKIE];
  if (sid) {
    const sessions = readSessions();
    if (sessions && sessions[sid]) {
      delete sessions[sid];
      saveSessions(sessions);
    }
  }
  setSessionCookie(res, '', 0);
  return res.json({ ok: true });
});

app.post(['/auth/signup', '/api/auth/signup'], async (req, res) => {
  const body = req.body || {};
  const username = String(body.username || '').trim();
  const password = String(body.password || '');
  if (!username || !password) {
    return res.status(400).json({ ok: false, error: 'missing_credentials' });
  }
  if (username.length < 3 || username.length > 32) {
    return res.status(400).json({ ok: false, error: 'invalid_username_length' });
  }
  if (!/^[a-zA-Z0-9._-]+$/.test(username)) {
    return res.status(400).json({ ok: false, error: 'invalid_username_chars' });
  }
  if (password.length < 8) {
    return res.status(400).json({ ok: false, error: 'weak_password' });
  }

  const users = readUsers();
  const unameLower = username.toLowerCase();
  const exists = users.some(x => x && String(x.usernameLower || '').toLowerCase() === unameLower);
  if (exists) {
    return res.status(409).json({ ok: false, error: 'username_exists' });
  }

  const now = nowIso();
  const hash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const user = {
    id: genId(),
    username,
    usernameLower: unameLower,
    password_hash: hash,
    role: 'user',
    created_at: now,
    updated_at: now
  };
  users.push(user);
  saveUsers(users);

  // Auto-login after signup
  const sid = genId();
  const sessions = readSessions();
  const exp = new Date(Date.now() + SESSION_TTL_MS).toISOString();
  sessions[sid] = { userId: user.id, createdAt: nowIso(), expiresAt: exp };
  saveSessions(sessions);
  setSessionCookie(res, sid, SESSION_TTL_MS);
  return res.json({ ok: true, user: sanitizeUser(user) });
});

app.post(['/auth/change-password', '/api/auth/change-password'], async (req, res) => {
  const auth = getAuthFromRequest(req);
  if (!auth.isAuthenticated || !auth.user) {
    return res.status(401).json({ ok: false, error: 'unauthorized' });
  }
  const body = req.body || {};
  const currentPassword = String(body.current_password || '');
  const newPassword = String(body.new_password || '');
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ ok: false, error: 'missing_credentials' });
  }
  if (newPassword.length < 8) {
    return res.status(400).json({ ok: false, error: 'weak_password' });
  }

  const users = readUsers();
  const idx = users.findIndex(u => u && u.id === auth.user.id);
  if (idx === -1) {
    return res.status(401).json({ ok: false, error: 'unauthorized' });
  }
  const user = users[idx];
  const ok = await bcrypt.compare(currentPassword, String(user.password_hash || ''));
  if (!ok) {
    return res.status(401).json({ ok: false, error: 'invalid_credentials' });
  }

  const hash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
  users[idx] = { ...user, password_hash: hash, updated_at: nowIso() };
  saveUsers(users);
  return res.json({ ok: true });
});

ensureAdminSeed();

app.listen(80, '0.0.0.0', () => console.log('state-api :80 (last-write-wins mode)'));
