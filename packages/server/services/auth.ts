import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { getCookie, setCookie, deleteCookie, getRequestIP, type H3Event } from "h3";
import { getDb, upsertUser } from "./db";

const hash = (password: string, salt: string) => scryptSync(password, salt, 64).toString("hex");
const tokenHash = (token: string) => createHash("sha256").update(token).digest("hex");
const loginFailures = new Map<string, { count: number; firstAt: number; blockedUntil: number }>();

export function bootstrapLocalAdmin() {
  const db = getDb();
  if (db.prepare("SELECT 1 FROM local_accounts LIMIT 1").get()) return;
  const now = Date.now(); const uid = "local-admin"; const salt = randomBytes(16).toString("hex");
  db.prepare("INSERT OR IGNORE INTO users(uid, username, created_at, last_seen) VALUES(?,?,?,?)").run(uid, "admin", now, now);
  db.prepare("INSERT OR IGNORE INTO local_accounts(uid, username, password_hash, password_salt, created_at) VALUES(?,?,?,?,?)").run(uid, "admin", hash("admin", salt), salt, now);
}

export function login(event: H3Event, username: string, password: string) {
  const key = `${getRequestIP(event) || "unknown"}:${username.trim().toLowerCase()}`;
  const now = Date.now(); const state = loginFailures.get(key);
  if (state && state.blockedUntil > now) throw new Error("登录失败次数过多，请稍后再试");
  if (state && now - state.firstAt > 15 * 60 * 1000) loginFailures.delete(key);
  bootstrapLocalAdmin();
  const row = getDb().prepare("SELECT uid, username, password_hash AS passwordHash, password_salt AS passwordSalt FROM local_accounts WHERE username=? AND disabled_at IS NULL").get(username.trim()) as {uid:string;username:string;passwordHash:string;passwordSalt:string}|undefined;
  if (!row) { recordLoginFailure(key); return false; }
  const expected = Buffer.from(row.passwordHash);
  const actual = Buffer.from(hash(password, row.passwordSalt));
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) { recordLoginFailure(key); return false; }
  loginFailures.delete(key);
  const token = randomBytes(32).toString("base64url");
  getDb().prepare("INSERT INTO auth_sessions(token_hash,uid,created_at,expires_at) VALUES(?,?,?,?)").run(tokenHash(token), row.uid, now, now + 30 * 24 * 3600 * 1000);
  setCookie(event, "schulte_session", token, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 30 * 24 * 3600 });
  upsertUser(row.uid, row.username); return true;
}

function recordLoginFailure(key: string) {
  const now = Date.now(); const prior = loginFailures.get(key);
  const state = prior && now - prior.firstAt <= 15 * 60 * 1000 ? prior : { count: 0, firstAt: now, blockedUntil: 0 };
  state.count += 1;
  if (state.count >= 5) state.blockedUntil = now + 10 * 60 * 1000;
  loginFailures.set(key, state);
}

export function logout(event: H3Event) {
  const token = getCookie(event, "schulte_session");
  if (token) getDb().prepare("DELETE FROM auth_sessions WHERE token_hash=?").run(tokenHash(token));
  deleteCookie(event, "schulte_session", { path: "/" });
}

export function session(event: H3Event) {
  const token = getCookie(event, "schulte_session");
  if (!token) return { authenticated: false, uid: null, username: null, guest: false };
  const row = getDb().prepare("SELECT u.uid,u.username,a.must_change_password AS mustChangePassword FROM auth_sessions s JOIN users u ON u.uid=s.uid JOIN local_accounts a ON a.uid=u.uid WHERE s.token_hash=? AND s.expires_at>? AND a.disabled_at IS NULL").get(tokenHash(token), Date.now()) as {uid:string;username:string;mustChangePassword:number}|undefined;
  return row ? { authenticated: true, uid: row.uid, username: row.username, guest: false, isAdmin: row.uid === "local-admin", mustChangePassword: Boolean(row.mustChangePassword) } : { authenticated: false, uid: null, username: null, guest: false, isAdmin: false, mustChangePassword: false };
}

function current(event: H3Event) { const s = session(event); if (!s.authenticated || !s.uid) throw new Error("请先登录"); return s; }
function ensureAdmin(event: H3Event) { const s = current(event); if (!s.isAdmin) throw new Error("仅管理员可执行此操作"); return s; }
export function changePassword(event: H3Event, password: string) { const s = current(event); if (password.length < 8 || password.length > 128) throw new Error("密码长度必须为 8-128 个字符"); const salt = randomBytes(16).toString("hex"); getDb().prepare("UPDATE local_accounts SET password_hash=?,password_salt=?,must_change_password=0 WHERE uid=?").run(hash(password, salt), salt, s.uid); logout(event); }
export function listAccounts(event: H3Event) { ensureAdmin(event); return getDb().prepare("SELECT uid,username,must_change_password AS mustChangePassword,disabled_at AS disabledAt FROM local_accounts ORDER BY username").all(); }
export function createAccount(event: H3Event, username: string) { ensureAdmin(event); if (!/^[A-Za-z0-9_.-]{3,64}$/.test(username)) throw new Error("用户名需为 3-64 位字母、数字、点、下划线或短横线"); const db=getDb(); if(db.prepare("SELECT 1 FROM local_accounts WHERE username=?").get(username)) throw new Error("用户名已存在"); const uid=`local-${randomBytes(10).toString("hex")}`; const salt=randomBytes(16).toString("hex"); const now=Date.now(); db.prepare("INSERT INTO users(uid,username,created_at,last_seen) VALUES(?,?,?,?)").run(uid,username,now,now); db.prepare("INSERT INTO local_accounts(uid,username,password_hash,password_salt,created_at) VALUES(?,?,?,?,?)").run(uid,username,hash("admin",salt),salt,now); return { uid, username, temporaryPassword: "admin" }; }
export function resetPassword(event: H3Event, uid: string) { ensureAdmin(event); const salt=randomBytes(16).toString("hex"); getDb().prepare("UPDATE local_accounts SET password_hash=?,password_salt=?,must_change_password=1 WHERE uid=? AND disabled_at IS NULL").run(hash("admin",salt),salt,uid); getDb().prepare("DELETE FROM auth_sessions WHERE uid=?").run(uid); return { temporaryPassword: "admin" }; }
export function deleteAccount(event: H3Event, uid: string) {
  ensureAdmin(event);
  if (!uid || uid === "local-admin") throw new Error("不能删除管理员账号");
  const db = getDb();
  if (!db.prepare("SELECT 1 FROM local_accounts WHERE uid=?").get(uid)) throw new Error("账号不存在");
  db.exec("BEGIN");
  try {
    db.prepare("DELETE FROM auth_sessions WHERE uid=?").run(uid);
    db.prepare("DELETE FROM plays WHERE uid=?").run(uid);
    db.prepare("DELETE FROM bests WHERE uid=?").run(uid);
    db.prepare("DELETE FROM bests_rulesets WHERE uid=?").run(uid);
    db.prepare("DELETE FROM local_accounts WHERE uid=?").run(uid);
    db.prepare("DELETE FROM users WHERE uid=?").run(uid);
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
  return { deleted: true };
}
