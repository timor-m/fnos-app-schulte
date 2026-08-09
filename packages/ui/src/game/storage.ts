const PROGRESS_KEY = "schulte:progress:v2";
const RECORDS_KEY = "schulte:records:v2";
const SETTINGS_KEY = "schulte:settings:v2";

export type RecordsMap = Record<string, number>;

export type GameSettings = {
  sound: boolean;
  haptics: boolean;
};

export const DEFAULT_SETTINGS: GameSettings = {
  sound: true,
  haptics: true
};

function readJson<T extends object>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return { ...fallback };
    return { ...fallback, ...(JSON.parse(raw) as Partial<T>) };
  } catch {
    return { ...fallback };
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // 隐私模式等场景下静默失败，不影响游戏
  }
}

/** 已完成的最大关卡号，0 表示尚未通关任何关卡 */
export function loadProgress(): number {
  try {
    const raw = localStorage.getItem(PROGRESS_KEY);
    const value = raw ? Number(JSON.parse(raw)) : 0;
    return Number.isFinite(value) ? value : 0;
  } catch {
    return 0;
  }
}

export function saveProgress(level: number): void {
  writeJson(PROGRESS_KEY, level);
}

export function loadRecords(): RecordsMap {
  try {
    const raw = localStorage.getItem(RECORDS_KEY);
    return raw ? (JSON.parse(raw) as RecordsMap) : {};
  } catch {
    return {};
  }
}

export function bestTime(level: number): number | null {
  const value = loadRecords()[`lv:${level}`];
  return typeof value === "number" ? value : null;
}

export function saveRecord(level: number, ms: number): boolean {
  const records = loadRecords();
  const key = `lv:${level}`;
  const previous = records[key];
  const isBest = typeof previous !== "number" || ms < previous;
  if (isBest) {
    records[key] = ms;
    writeJson(RECORDS_KEY, records);
  }
  return isBest;
}

export function completedCount(): number {
  return Object.keys(loadRecords()).length;
}

export function loadSettings(): GameSettings {
  return readJson<GameSettings>(SETTINGS_KEY, DEFAULT_SETTINGS);
}

export function saveSettings(settings: GameSettings): void {
  writeJson(SETTINGS_KEY, settings);
}

export function clearAllData(): void {
  try {
    localStorage.removeItem(PROGRESS_KEY);
    localStorage.removeItem(RECORDS_KEY);
  } catch {
    // ignore
  }
}
