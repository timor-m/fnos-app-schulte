import { LAYOUT_UNLOCKS, type LayoutUnlock, type Ruleset } from "./levels";

const SETTINGS_KEY = "schulte:settings:v2";
const UNLOCKS_KEY = "schulte:layout-unlocks:v3";

function progressKey(ruleset: Ruleset): string {
  return `schulte:progress:${ruleset}`;
}

function recordsKey(ruleset: Ruleset): string {
  return `schulte:records:${ruleset}`;
}

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
export function loadProgress(ruleset: Ruleset = "v3"): number {
  try {
    const raw = localStorage.getItem(progressKey(ruleset));
    const value = raw ? Number(JSON.parse(raw)) : 0;
    return Number.isFinite(value) ? value : 0;
  } catch {
    return 0;
  }
}

export function saveProgress(level: number, ruleset: Ruleset = "v3"): void {
  writeJson(progressKey(ruleset), level);
}

export function loadRecords(ruleset: Ruleset = "v3"): RecordsMap {
  try {
    const raw = localStorage.getItem(recordsKey(ruleset));
    return raw ? (JSON.parse(raw) as RecordsMap) : {};
  } catch {
    return {};
  }
}

export function bestTime(level: number, ruleset: Ruleset = "v3"): number | null {
  const value = loadRecords(ruleset)[`lv:${level}`];
  return typeof value === "number" ? value : null;
}

export function saveRecord(level: number, ms: number, ruleset: Ruleset = "v3"): boolean {
  const records = loadRecords(ruleset);
  const key = `lv:${level}`;
  const previous = records[key];
  const isBest = typeof previous !== "number" || ms < previous;
  if (isBest) {
    records[key] = ms;
    writeJson(recordsKey(ruleset), records);
  }
  return isBest;
}

export function completedCount(ruleset: Ruleset = "v3"): number {
  return Object.keys(loadRecords(ruleset)).length;
}

export function seenLayoutUnlocks(): Set<number> {
  try {
    const raw = localStorage.getItem(UNLOCKS_KEY);
    const values = raw ? (JSON.parse(raw) as unknown[]) : [];
    return new Set(values.filter((value): value is number => Number.isInteger(value)));
  } catch {
    return new Set();
  }
}

export function markLayoutUnlockSeen(level: number): void {
  const seen = seenLayoutUnlocks();
  for (const unlock of LAYOUT_UNLOCKS) {
    if (unlock.afterLevel !== null && unlock.level <= level) seen.add(unlock.level);
  }
  writeJson(UNLOCKS_KEY, [...seen].sort((a, b) => a - b));
}

export function highestUnseenLayoutUnlock(progress: number): LayoutUnlock | null {
  const seen = seenLayoutUnlocks();
  return [...LAYOUT_UNLOCKS]
    .filter((unlock) => unlock.afterLevel !== null && unlock.afterLevel <= progress && !seen.has(unlock.level))
    .sort((a, b) => b.level - a.level)[0] ?? null;
}

export function loadSettings(): GameSettings {
  return readJson<GameSettings>(SETTINGS_KEY, DEFAULT_SETTINGS);
}

export function saveSettings(settings: GameSettings): void {
  writeJson(SETTINGS_KEY, settings);
}

export function clearAllData(): void {
  try {
    for (const ruleset of ["v2", "v3"] as const) {
      localStorage.removeItem(progressKey(ruleset));
      localStorage.removeItem(recordsKey(ruleset));
    }
    localStorage.removeItem(UNLOCKS_KEY);
  } catch {
    // ignore
  }
}
