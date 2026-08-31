// 以构建期确定的网关前缀为基准拼接 API 地址：
// 不能用 "./api/" 相对当前页面 URL 解析——fnOS 桌面入口的 iframe 地址不带尾斜杠时，
// 相对解析会丢一级路径变成 /app/api/*（404）。
const appBasePath = import.meta.env.BASE_URL.endsWith("/")
  ? import.meta.env.BASE_URL
  : `${import.meta.env.BASE_URL}/`;
const apiBase = new URL("api/", new URL(appBasePath, window.location.origin));

function apiUrl(path: string): string {
  return new URL(path.replace(/^\//, ""), apiBase).toString();
}

type Envelope<T> = { ok: boolean; data: T };

async function get<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(apiUrl(path));
    if (!res.ok) return null;
    return ((await res.json()) as Envelope<T>).data;
  } catch {
    return null;
  }
}

export type Identity = { uid: string; username: string; guest: boolean };

export type PlayItem = { id: number; level: number; ms: number; errors: number; playedAt: number };

export type OverallEntry = {
  uid: string;
  username: string;
  completed: number;
  totalPlays: number;
  avgBestMs: number;
  totalBestMs: number;
  lastActive: number | null;
  rank: number;
  isMe: boolean;
};

export type LevelEntry = {
  uid: string;
  username: string;
  bestMs: number;
  plays: number;
  updatedAt: number;
  rank: number;
  isMe: boolean;
};

export type MeData = {
  user: Identity;
  summary: {
    completed: number;
    totalPlays: number;
    totalBestMs: number;
    avgBestMs: number;
    weekPlays: number;
  };
  records: Array<{ level: number; bestMs: number; plays: number; isFastest: boolean }>;
  bands: Array<{ name: string; from: number; to: number; done: number; total: number }>;
  recentPlays: PlayItem[];
  /** 最近成绩下一页游标，null 表示没有更多 */
  playsCursor: number | null;
};

export function fetchMe(): Promise<MeData | null> {
  return get<MeData>("me");
}

export type SessionInfo = {
  authenticated: boolean;
  uid: string | null;
  username: string | null;
  isAdmin: boolean;
  guest?: boolean;
  authMode?: "local" | "fnos";
};

export function fetchSession(): Promise<SessionInfo | null> {
  return get<SessionInfo>("session");
}

export async function login(username: string, password: string): Promise<boolean> {
  const res = await fetch(apiUrl("auth/login"), { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ username, password }) });
  return res.ok && Boolean((await res.json() as Envelope<unknown>).ok);
}

export async function logout(): Promise<void> { await fetch(apiUrl("auth/logout"), { method: "POST" }); }

export async function changePassword(password: string): Promise<{ ok: boolean; message?: string }> {
  try {
    const res = await fetch(apiUrl("auth/password"), { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ password }) });
    const body = await res.json() as Envelope<unknown> & { error?: { message?: string } };
    return { ok: res.ok && Boolean(body.ok), message: body.error?.message };
  } catch {
    return { ok: false, message: "服务暂时不可用" };
  }
}
export type LocalAccount = { uid: string; username: string; mustChangePassword: boolean; disabledAt: number | null };
export async function fetchAccounts(): Promise<LocalAccount[]> { return (await get<LocalAccount[]>("auth/accounts")) ?? []; }
export async function createAccount(username: string): Promise<boolean> { const r=await fetch(apiUrl("auth/accounts"),{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({username})}); return r.ok && Boolean((await r.json() as Envelope<unknown>).ok); }
export async function resetAccount(uid: string): Promise<boolean> { const r=await fetch(apiUrl("auth/accounts/reset"),{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({uid})}); return r.ok && Boolean((await r.json() as Envelope<unknown>).ok); }
export async function deleteAccount(uid: string): Promise<{ ok: boolean; message?: string }> { try { const r=await fetch(apiUrl("auth/accounts/delete"),{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({uid})}); const body=await r.json() as Envelope<unknown> & {error?:{message?:string}}; return {ok:r.ok&&Boolean(body.ok),message:body.error?.message}; } catch { return {ok:false,message:"服务暂时不可用"}; } }

export function fetchMyPlays(cursor: number): Promise<{ plays: PlayItem[]; nextCursor: number | null } | null> {
  return get<{ plays: PlayItem[]; nextCursor: number | null }>(`me-plays?cursor=${cursor}`);
}

export type PlayerData = {
  user: {
    uid: string;
    username: string;
    isMe: boolean;
  };
  summary: {
    rank: number | null;
    completed: number;
    totalPlays: number;
    avgBestMs: number;
    weekPlays: number;
    fastestCount: number;
    lastActive: number | null;
  };
  records: Array<{ level: number; bestMs: number; plays: number; isFastest: boolean }>;
  bands: Array<{ name: string; from: number; to: number; done: number; total: number }>;
  recentPlays: PlayItem[];
  playsCursor: number | null;
};

export function fetchPlayer(uid: string): Promise<PlayerData | null> {
  return get<PlayerData>(`player?uid=${encodeURIComponent(uid)}`);
}

export function fetchPlayerPlays(
  uid: string,
  cursor: number
): Promise<{ plays: PlayItem[]; nextCursor: number | null } | null> {
  return get<{ plays: PlayItem[]; nextCursor: number | null }>(
    `player-plays?uid=${encodeURIComponent(uid)}&cursor=${cursor}`
  );
}

export function fetchOverallBoard(): Promise<{ entries: OverallEntry[] } | null> {
  return get<{ entries: OverallEntry[] }>("leaderboard");
}

export function fetchLevelBoard(level: number): Promise<{ entries: LevelEntry[] } | null> {
  return get<{ entries: LevelEntry[] }>(`leaderboard?level=${level}`);
}

export type SubmitResult = {
  best: number;
  isNewBest: boolean;
  plays: number;
  levelBest: number;
  isLevelBest: boolean;
};

export async function submitRecord(payload: {
  level: number;
  ms: number;
  errors: number;
  seed: number | null;
}): Promise<SubmitResult | null> {
  try {
    const res = await fetch(apiUrl("records"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (!res.ok) return null;
    const json = (await res.json()) as Envelope<SubmitResult>;
    return json.ok ? json.data : null;
  } catch {
    return null;
  }
}
