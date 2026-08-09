import {
  MAX_LEVEL,
  gridSizeForLevel,
  shapeForLevel
} from "../../../shared/levels";
import type { BoardShape } from "../../../shared/levels";

// 关卡体系配置（总量、段位、难度曲线）在 packages/shared/levels.ts 中维护，
// 这里只做转发，保持既有 import 路径不变。
export {
  MAX_LEVEL,
  TIMED_FROM_LEVEL,
  LEVEL_BANDS,
  isValidLevel,
  gridSizeForLevel,
  cellCountForLevel,
  shapeForLevel,
  levelBand,
  timeLimitForLevel
} from "../../../shared/levels";
export type { BoardShape, LevelBand } from "../../../shared/levels";

export type CellSkin = {
  value: number;
  color: string;
  bg: string;
  fontScale: number;
  /** 仅方格模式：格子在其网格区域内的宽高百分比与对齐方式，营造错落感 */
  widthPct: number;
  heightPct: number;
  placeH: "start" | "center" | "end";
  placeV: "start" | "center" | "end";
  radius: number;
};

export type LevelSpec = {
  level: number;
  size: number;
  shape: BoardShape;
  seed: number;
  cells: CellSkin[];
};

export function shapeName(shape: BoardShape): string {
  return shape === "hex" ? "蜂巢" : "方格";
}

/** 数字配色：固定在几种低饱和深色中随机组合，保证可读性 */
const TEXT_COLORS = ["#226747", "#b4632f", "#4f6d8f", "#6e7a28", "#8a4f63"];

/** 格子底色：清新淡色系，部分保留纯白 */
const CELL_BGS = ["#ffffff", "#eaf4ec", "#fdf0e2", "#eef3f9", "#f5f4e1"];

const PLACES = ["start", "center", "end"] as const;

function hashString(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 每关的默认种子：同一关在任何时候、任何设备上渲染完全一致 */
export function canonicalSeed(level: number): number {
  return hashString(`schulte:v2:${level}`);
}

export function randomSeed(): number {
  return (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0;
}

/**
 * 由种子生成一关的完整方案：数字排布、底色、字号、错位方式。
 * 相同种子必然得到相同方案，因此分享链接只需要带上关卡号和种子。
 */
export function buildLevel(level: number, seed = canonicalSeed(level)): LevelSpec {
  const size = gridSizeForLevel(level);
  const total = size * size;
  const rand = mulberry32(seed);

  const numbers = Array.from({ length: total }, (_, i) => i + 1);
  for (let i = numbers.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    [numbers[i], numbers[j]] = [numbers[j], numbers[i]];
  }

  const cells: CellSkin[] = numbers.map((value) => ({
    value,
    color: TEXT_COLORS[Math.floor(rand() * TEXT_COLORS.length)],
    bg: CELL_BGS[Math.floor(rand() * CELL_BGS.length)],
    fontScale: 0.82 + rand() * 0.42,
    widthPct: 64 + rand() * 34,
    heightPct: 64 + rand() * 34,
    placeH: PLACES[Math.floor(rand() * PLACES.length)],
    placeV: PLACES[Math.floor(rand() * PLACES.length)],
    radius: 6 + Math.round(rand() * 9)
  }));

  return { level, size, shape: shapeForLevel(level), seed, cells };
}

export function clampLevel(level: number): number {
  if (Number.isNaN(level)) return 1;
  return Math.min(MAX_LEVEL, Math.max(1, Math.floor(level)));
}

export function parseSeed(raw: string | null): number | null {
  if (!raw) return null;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 0 || value > 0xffffffff) return null;
  return value >>> 0;
}
