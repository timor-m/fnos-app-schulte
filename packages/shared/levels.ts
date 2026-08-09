/**
 * 关卡体系配置：UI 与服务端共用的唯一来源。
 *
 * 关卡不是逐关存储的数据，而是 (关卡号, 种子) 的纯函数结果，
 * 因此后续版本要增加关卡时只需调整本文件：
 * 1. 调高 MAX_LEVEL；
 * 2. 在 LEVEL_BANDS 末尾追加新段位；
 * 3. 如需更大棋盘，在 gridSizeForLevel 末尾追加新的规模档（不要改动已有档位阈值，
 *    否则老关卡的排布会变，历史成绩失去可比性）。
 * 数据库按 (uid, level) 存档，无需迁移。
 */

export const MAX_LEVEL = 500;

/** 从第 101 关起进入限时挑战 */
export const TIMED_FROM_LEVEL = 101;

export type BoardShape = "grid" | "hex";

export type LevelBand = {
  name: string;
  from: number;
  to: number;
};

/** 段位划分：必须连续覆盖 1..MAX_LEVEL，新增关卡时在末尾追加 */
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

export function isValidLevel(level: number): boolean {
  return Number.isInteger(level) && level >= 1 && level <= MAX_LEVEL;
}

/**
 * 关卡难度曲线：等级只决定棋盘规模，形状由关卡号混合决定。
 * 扩展时只允许在末尾追加更大的档位，保持已有阈值不变。
 */
export function gridSizeForLevel(level: number): number {
  if (level <= 3) return 3;
  if (level <= 6) return 4;
  if (level <= 25) return 5;
  if (level <= 45) return 6;
  if (level <= 70) return 7;
  if (level <= 110) return 8;
  if (level <= 200) return 9;
  return 10;
}

export function cellCountForLevel(level: number): number {
  const size = gridSizeForLevel(level);
  return size * size;
}

/** 方格与蜂巢混合：每 3 关出现一个蜂巢关，无需手动筛选 */
export function shapeForLevel(level: number): BoardShape {
  return level % 3 === 0 ? "hex" : "grid";
}

export function levelBand(level: number): string {
  const band = LEVEL_BANDS.find((item) => level >= item.from && level <= item.to);
  return (band ?? LEVEL_BANDS[LEVEL_BANDS.length - 1]).name;
}

/**
 * 限时挑战（101 关起）：按格子数给时间，等级越高每格可用时间越短。
 * 返回 null 表示不限时。
 */
export function timeLimitForLevel(level: number): number | null {
  if (level < TIMED_FROM_LEVEL) return null;
  const perCellMs = Math.max(850, 1750 - (level - TIMED_FROM_LEVEL) * 2.2);
  return Math.round(cellCountForLevel(level) * perCellMs);
}
