export const MAX_LEVEL = 500;
export const TIMED_FROM_LEVEL = 101;
export const SEQUENTIAL_FROM_LEVEL = TIMED_FROM_LEVEL;
export const CURRENT_RULESET = "v3" as const;

export type Ruleset = "v2" | "v3";
export type BoardShape =
  | "grid"
  | "hex"
  | "radial"
  | "spiral"
  | "scatter"
  | "triangle"
  | "wave"
  | "fan"
  | "orbit"
  | "diamond"
  | "petal"
  | "track"
  | "snake";

export type LevelBand = { name: string; from: number; to: number };

export type VisualProfile = {
  colorCount: number;
  fontMin: number;
  fontMax: number;
  maxRotation: number;
};

export type LevelProfile = {
  ruleset: Ruleset;
  level: number;
  shape: BoardShape;
  targetCount: number;
  distractorCount: number;
  totalCount: number;
  visual: VisualProfile;
  timeLimitMs: number | null;
};

export type LayoutUnlock = {
  level: number;
  afterLevel: number | null;
  shape: BoardShape;
  name: string;
};

export const LEVEL_BANDS: LevelBand[] = [
  { name: "入门", from: 1, to: 10 },
  { name: "基础", from: 11, to: 25 },
  { name: "进阶", from: 26, to: 45 },
  { name: "高手", from: 46, to: 70 },
  { name: "大师", from: 71, to: 100 },
  { name: "骨灰", from: 101, to: 200 },
  { name: "地狱", from: 201, to: 350 },
  { name: "传说", from: 351, to: 500 }
];

export const LAYOUT_UNLOCKS: LayoutUnlock[] = [
  { level: 1, afterLevel: null, shape: "grid", name: "方格" },
  { level: 6, afterLevel: null, shape: "hex", name: "蜂巢" },
  { level: 11, afterLevel: null, shape: "radial", name: "圆盘" },
  { level: 16, afterLevel: null, shape: "spiral", name: "螺旋" },
  { level: 21, afterLevel: null, shape: "scatter", name: "星群" },
  { level: 101, afterLevel: 100, shape: "triangle", name: "三角阵" },
  { level: 151, afterLevel: 150, shape: "wave", name: "波浪" },
  { level: 201, afterLevel: 200, shape: "fan", name: "扇形" },
  { level: 251, afterLevel: 250, shape: "orbit", name: "椭圆轨道" },
  { level: 301, afterLevel: 300, shape: "diamond", name: "菱形阵" },
  { level: 351, afterLevel: 350, shape: "petal", name: "花瓣" },
  { level: 401, afterLevel: 400, shape: "track", name: "跑道" },
  { level: 451, afterLevel: 450, shape: "snake", name: "蛇形路径" }
];

const SHAPE_NAMES: Record<BoardShape, string> = Object.fromEntries(
  LAYOUT_UNLOCKS.map((item) => [item.shape, item.name])
) as Record<BoardShape, string>;

const SHAPE_TIME_FACTORS: Record<BoardShape, number> = {
  grid: 1,
  triangle: 1.04,
  diamond: 1.04,
  hex: 1.06,
  wave: 1.06,
  snake: 1.06,
  radial: 1.08,
  fan: 1.08,
  track: 1.08,
  spiral: 1.1,
  scatter: 1.1,
  orbit: 1.1,
  petal: 1.1
};

const ADVANCED_TIME_START_LEVEL = 200;
const ADVANCED_START_PER_TARGET_MS = 1900;
const ADVANCED_END_PER_TARGET_MS = 1400;
const DISTRACTOR_TIME_BONUS_MS = 150;

const shapeCache: BoardShape[] = [];

function hashString(input: string): number {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function isRuleset(value: unknown): value is Ruleset {
  return value === "v2" || value === "v3";
}

export function isValidLevel(level: number): boolean {
  return Number.isInteger(level) && level >= 1 && level <= MAX_LEVEL;
}

export function shapeName(shape: BoardShape): string {
  return SHAPE_NAMES[shape];
}

export function layoutUnlockAt(level: number): LayoutUnlock | null {
  return LAYOUT_UNLOCKS.find((item) => item.level === level) ?? null;
}

export function layoutUnlockAfter(level: number): LayoutUnlock | null {
  return LAYOUT_UNLOCKS.find((item) => item.afterLevel === level) ?? null;
}

export function unlockedShapesForLevel(level: number): BoardShape[] {
  return LAYOUT_UNLOCKS.filter((item) => item.level <= level).map((item) => item.shape);
}

function v3ShapeForLevel(level: number): BoardShape {
  while (shapeCache.length < level) {
    const current = shapeCache.length + 1;
    const forced = layoutUnlockAt(current);
    if (forced) {
      shapeCache.push(forced.shape);
      continue;
    }

    const unlocked = unlockedShapesForLevel(current);
    const previous = shapeCache[current - 2];
    let choices = unlocked.filter((shape) => shape !== previous);
    if (choices.length === 0) choices = unlocked;

    const latestUnlock = [...LAYOUT_UNLOCKS].reverse().find((item) => item.level < current && item.level >= current - 10);
    const weighted = choices.flatMap((shape) => {
      const weight = latestUnlock?.shape === shape ? 3 : 1;
      return Array.from({ length: weight }, () => shape);
    });
    shapeCache.push(weighted[hashString(`schulte:shape:v3:${current}`) % weighted.length]);
  }
  return shapeCache[level - 1];
}

export function legacyGridSizeForLevel(level: number): number {
  if (level <= 3) return 3;
  if (level <= 6) return 4;
  if (level <= 25) return 5;
  if (level <= 45) return 6;
  if (level <= 70) return 7;
  if (level <= 110) return 8;
  if (level <= 200) return 9;
  return 10;
}

export function targetCountForLevel(level: number, ruleset: Ruleset = CURRENT_RULESET): number {
  if (ruleset === "v2") return legacyGridSizeForLevel(level) ** 2;
  if (level <= 5) return 9;
  if (level <= 15) return 12;
  if (level <= 45) return 16;
  if (level <= 70) return 20;
  if (level <= 150) return 25;
  if (level <= 199) return 30;
  if (level <= 250) return 32;
  if (level <= 300) return 34;
  if (level <= 400) return 36;
  if (level <= 450) return 34;
  return 32;
}

export function distractorCountForLevel(level: number, ruleset: Ruleset = CURRENT_RULESET): number {
  if (ruleset === "v2" || level < 200) return 0;
  if (level <= 225) return 3;
  if (level <= 250) return 5;
  if (level <= 275) return 7;
  if (level <= 300) return 9;
  if (level <= 350) return 11;
  if (level <= 400) return 13;
  if (level <= 450) return 15;
  return 17;
}

export function visualProfileForLevel(level: number, ruleset: Ruleset = CURRENT_RULESET): VisualProfile {
  if (ruleset === "v2") return { colorCount: 5, fontMin: 0.82, fontMax: 1.24, maxRotation: 0 };
  if (level <= 25) return { colorCount: 2, fontMin: 0.96, fontMax: 1.04, maxRotation: 0 };
  if (level <= 70) return { colorCount: 4, fontMin: 0.9, fontMax: 1.1, maxRotation: 0 };
  if (level <= 150) return { colorCount: 5, fontMin: 0.84, fontMax: 1.16, maxRotation: 0 };
  if (level <= 300) return { colorCount: 5, fontMin: 0.78, fontMax: 1.22, maxRotation: 4 };
  if (level <= 400) return { colorCount: 5, fontMin: 0.78, fontMax: 1.22, maxRotation: 6 };
  return { colorCount: 5, fontMin: 0.76, fontMax: 1.24, maxRotation: 8 };
}

export function shapeForLevel(level: number, ruleset: Ruleset = CURRENT_RULESET): BoardShape {
  if (ruleset === "v2") return level % 3 === 0 ? "hex" : "grid";
  return v3ShapeForLevel(level);
}

export function levelProfileForLevel(level: number, ruleset: Ruleset = CURRENT_RULESET): LevelProfile {
  const shape = shapeForLevel(level, ruleset);
  const targetCount = targetCountForLevel(level, ruleset);
  const distractorCount = distractorCountForLevel(level, ruleset);
  return {
    ruleset,
    level,
    shape,
    targetCount,
    distractorCount,
    totalCount: targetCount + distractorCount,
    visual: visualProfileForLevel(level, ruleset),
    timeLimitMs: timeLimitForLevel(level, ruleset, shape, targetCount)
  };
}

export function gridSizeForLevel(level: number, ruleset: Ruleset = CURRENT_RULESET): number {
  return ruleset === "v2" ? legacyGridSizeForLevel(level) : Math.ceil(Math.sqrt(targetCountForLevel(level)));
}

export function cellCountForLevel(level: number, ruleset: Ruleset = CURRENT_RULESET): number {
  const profile = levelProfileForLevel(level, ruleset);
  return profile.totalCount;
}

export function levelBand(level: number): string {
  return (LEVEL_BANDS.find((item) => level >= item.from && level <= item.to) ?? LEVEL_BANDS.at(-1)!).name;
}

export function isLevelUnlocked(level: number, doneLevels: ReadonlySet<number>): boolean {
  if (level < SEQUENTIAL_FROM_LEVEL) return true;
  return doneLevels.has(level - 1);
}

export function firstPlayableLevel(doneLevels: ReadonlySet<number>): number {
  for (let level = 1; level <= MAX_LEVEL; level += 1) {
    if (!doneLevels.has(level) && isLevelUnlocked(level, doneLevels)) return level;
  }
  return MAX_LEVEL;
}

export function timeLimitForLevel(
  level: number,
  ruleset: Ruleset = CURRENT_RULESET,
  shape = shapeForLevel(level, ruleset),
  targetCount = targetCountForLevel(level, ruleset)
): number | null {
  if (level < TIMED_FROM_LEVEL) return null;
  if (ruleset === "v2") {
    const perCellMs = Math.max(850, 1750 - (level - TIMED_FROM_LEVEL) * 2.2);
    return Math.round(targetCount * perCellMs);
  }
  const perTargetMs = level <= 120
    ? 2400
    : level <= 150
      ? 2200
      : level < 200
        ? 2000
        : ADVANCED_START_PER_TARGET_MS
          - ((level - ADVANCED_TIME_START_LEVEL) / (MAX_LEVEL - ADVANCED_TIME_START_LEVEL))
            * (ADVANCED_START_PER_TARGET_MS - ADVANCED_END_PER_TARGET_MS);
  const distractorBonus = level >= ADVANCED_TIME_START_LEVEL
    ? distractorCountForLevel(level, ruleset) * DISTRACTOR_TIME_BONUS_MS
    : 0;
  return Math.round(targetCount * perTargetMs * SHAPE_TIME_FACTORS[shape] + distractorBonus);
}
