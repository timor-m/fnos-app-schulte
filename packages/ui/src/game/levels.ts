import {
  CURRENT_RULESET,
  MAX_LEVEL,
  legacyGridSizeForLevel,
  levelProfileForLevel,
  shapeName,
  type BoardShape,
  type LevelProfile,
  type Ruleset
} from "../../../shared/levels";

export {
  CURRENT_RULESET,
  MAX_LEVEL,
  TIMED_FROM_LEVEL,
  SEQUENTIAL_FROM_LEVEL,
  LEVEL_BANDS,
  LAYOUT_UNLOCKS,
  isRuleset,
  isValidLevel,
  isLevelUnlocked,
  firstPlayableLevel,
  gridSizeForLevel,
  targetCountForLevel,
  distractorCountForLevel,
  cellCountForLevel,
  shapeForLevel,
  shapeName,
  levelProfileForLevel,
  layoutUnlockAt,
  layoutUnlockAfter,
  levelBand,
  timeLimitForLevel
} from "../../../shared/levels";
export type { BoardShape, LevelBand, LevelProfile, LayoutUnlock, Ruleset } from "../../../shared/levels";

export type CellSpec = {
  id: string;
  kind: "target" | "distractor";
  label: string;
  sequenceValue: number | null;
  color: string;
  bg: string;
  fontScale: number;
  rotation: number;
  widthPct: number;
  heightPct: number;
  placeH: "start" | "center" | "end";
  placeV: "start" | "center" | "end";
  radius: number;
  x: number;
  y: number;
  visualRadius: number;
  nodeShape: "circle" | "hex" | "triangle" | "diamond" | "capsule" | "petal";
  nodeRotation: number;
};

export type LayoutGuide =
  | { kind: "path"; d: string }
  | { kind: "circle"; cx: number; cy: number; radius: number }
  | { kind: "ellipse"; cx: number; cy: number; rx: number; ry: number; rotation: number }
  | { kind: "rect"; x: number; y: number; width: number; height: number; radius: number };

export type LevelSpec = LevelProfile & {
  seed: number;
  cells: CellSpec[];
  guides: LayoutGuide[];
};

type Point = { x: number; y: number };
type LayoutPoint = Point & {
  nodeShape?: CellSpec["nodeShape"];
  nodeRotation?: number;
};
type LayoutGeometry = { points: LayoutPoint[]; guides: LayoutGuide[] };
type Random = () => number;

const TEXT_COLORS = ["#226747", "#9b4f28", "#405f82", "#5d6d1f", "#80445a"];
const CELL_BGS = ["#ffffff", "#eaf4ec", "#fdf0e2", "#eef3f9", "#f5f4e1"];
const PLACES = ["start", "center", "end"] as const;
const LETTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const VECTOR_FONT_RATIO = 1.02;

function hashString(input: string): number {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function mulberry32(seed: number): Random {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffled<T>(items: T[], rand: Random): T[] {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(rand() * (index + 1));
    [copy[index], copy[swap]] = [copy[swap], copy[index]];
  }
  return copy;
}

export function canonicalSeed(level: number, ruleset: Ruleset = CURRENT_RULESET): number {
  return hashString(`schulte:${ruleset}:${level}`);
}

export function randomSeed(): number {
  return (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0;
}

function gridPoints(total: number): LayoutPoint[] {
  const columns = Math.ceil(Math.sqrt(total));
  const rows = Math.ceil(total / columns);
  const stepX = 820 / columns;
  const stepY = 820 / rows;
  return Array.from({ length: total }, (_, index) => {
    const row = Math.floor(index / columns);
    const countInRow = Math.min(columns, total - row * columns);
    const column = index % columns;
    const rowWidth = countInRow * stepX;
    return { x: 500 - rowWidth / 2 + stepX * (column + 0.5), y: 90 + stepY * (row + 0.5) };
  });
}

function pathThrough(points: Point[], close = false): string {
  if (points.length === 0) return "";
  return `${points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`).join(" ")}${close ? " Z" : ""}`;
}

function distributeWeighted(total: number, weights: number[], minimum: number): number[] {
  const counts = weights.map(() => minimum);
  let remaining = total - minimum * weights.length;
  while (remaining > 0) {
    let selected = 0;
    let best = Number.NEGATIVE_INFINITY;
    for (let index = 0; index < weights.length; index += 1) {
      const score = weights[index] / (counts[index] + 1);
      if (score > best) {
        best = score;
        selected = index;
      }
    }
    counts[selected] += 1;
    remaining -= 1;
  }
  return counts;
}

function sampleCurve(total: number, createPoint: (ratio: number) => Point): Point[] {
  const samples: Array<Point & { travelled: number }> = [];
  let travelled = 0;
  for (let index = 0; index <= 1600; index += 1) {
    const point = createPoint(index / 1600);
    if (samples.length > 0) {
      const previous = samples[samples.length - 1];
      travelled += Math.hypot(point.x - previous.x, point.y - previous.y);
    }
    samples.push({ ...point, travelled });
  }
  return Array.from({ length: total }, (_, index) => {
    const target = travelled * index / Math.max(1, total - 1);
    const point = samples.find((candidate) => candidate.travelled >= target) ?? samples[samples.length - 1];
    return { x: point.x, y: point.y };
  });
}

function hexGeometry(total: number): LayoutGeometry {
  const columns = Math.ceil(Math.sqrt(total));
  const rows = Math.ceil(total / columns);
  const hasOffsetRow = rows > 1;
  const radius = Math.min(
    880 / (Math.sqrt(3) * (columns + (hasOffsetRow ? 0.5 : 0))),
    880 / (1.5 * rows + 0.5)
  );
  const width = Math.sqrt(3) * radius;
  const stepY = radius * 1.5;
  const totalWidth = width * (columns + (hasOffsetRow ? 0.5 : 0));
  const totalHeight = radius * 2 + stepY * (rows - 1);
  const startX = (1000 - totalWidth) / 2 + width / 2;
  const startY = (1000 - totalHeight) / 2 + radius;
  const points = Array.from({ length: total }, (_, index) => {
    const row = Math.floor(index / columns);
    const column = index % columns;
    return {
      x: startX + column * width + (row % 2) * width / 2,
      y: startY + row * stepY,
      nodeShape: "hex" as const
    };
  });
  return { points, guides: [] };
}

function radialGeometry(total: number): LayoutGeometry {
  if (total === 1) return { points: [{ x: 500, y: 500 }], guides: [] };
  const ringCount = total <= 12 ? 2 : total <= 25 ? 3 : total <= 40 ? 4 : 5;
  const radii = Array.from({ length: ringCount }, (_, index) => 90 + (330 * index) / Math.max(1, ringCount - 1));
  const counts = distributeWeighted(total - 1, radii, 3);
  const points: LayoutPoint[] = [{ x: 500, y: 500 }];
  radii.forEach((radius, ring) => {
    const count = counts[ring];
    for (let index = 0; index < count; index += 1) {
      const angle = -Math.PI / 2 + (Math.PI * 2 * index) / count + ring * 0.13;
      points.push({ x: 500 + Math.cos(angle) * radius, y: 500 + Math.sin(angle) * radius });
    }
  });
  return {
    points,
    guides: radii.map((radius) => ({ kind: "circle" as const, cx: 500, cy: 500, radius }))
  };
}

function spiralGeometry(total: number, direction: number): LayoutGeometry {
  const createPoint = (ratio: number) => {
    const radius = 42 + ratio * 388;
    const angle = direction * ratio * Math.PI * 6.3 - Math.PI / 2;
    return { x: 500 + Math.cos(angle) * radius, y: 500 + Math.sin(angle) * radius };
  };
  const points = sampleCurve(total, createPoint);
  const guidePoints = Array.from({ length: 180 }, (_, index) => createPoint(index / 179));
  return { points, guides: [{ kind: "path", d: pathThrough(guidePoints) }] };
}

function scatterGeometry(total: number, seed: number): LayoutGeometry {
  const centerSets = {
    3: [[200, 210], [800, 210], [500, 760]],
    4: [[205, 205], [795, 205], [205, 795], [795, 795]],
    5: [[190, 190], [810, 190], [500, 500], [190, 810], [810, 810]]
  } as const;
  const groupCount = total <= 16 ? 3 : total <= 30 ? 4 : 5;
  const centers = centerSets[groupCount];
  const counts = distributeWeighted(total, centers.map(() => 1), 1);
  const slots = [
    [-84, -84], [0, -84], [84, -84], [-126, 0], [-42, 0],
    [42, 0], [126, 0], [-84, 84], [0, 84], [84, 84]
  ];
  const points: LayoutPoint[] = [];
  centers.forEach(([cx, cy], group) => {
    const offset = (group * 2 + seed) % slots.length;
    for (let index = 0; index < counts[group]; index += 1) {
      const slot = slots[(index + offset) % slots.length];
      points.push({ x: cx + slot[0], y: cy + slot[1] });
    }
  });
  const guides = centers.map(([cx, cy]) => ({
    kind: "path" as const,
    d: pathThrough([
      { x: cx - 126, y: cy }, { x: cx - 84, y: cy - 84 }, { x: cx + 84, y: cy - 84 },
      { x: cx + 126, y: cy }, { x: cx + 84, y: cy + 84 }, { x: cx - 84, y: cy + 84 }
    ], true)
  }));
  return { points, guides };
}

function triangleGeometry(total: number): LayoutGeometry {
  const rows = Math.ceil((Math.sqrt(8 * total + 1) - 1) / 2);
  const points: LayoutPoint[] = [];
  for (let row = 0; row < rows && points.length < total; row += 1) {
    const count = row + 1;
    const step = 780 / rows;
    for (let column = 0; column < count && points.length < total; column += 1) {
      points.push({
        x: 500 + (column - (count - 1) / 2) * step,
        y: 100 + (800 * row) / Math.max(1, rows - 1),
        nodeShape: "triangle"
      });
    }
  }
  return {
    points,
    guides: [{ kind: "path", d: pathThrough([{ x: 500, y: 78 }, { x: 930, y: 922 }, { x: 70, y: 922 }], true) }]
  };
}

function waveGeometry(total: number): LayoutGeometry {
  const rows = total <= 16 ? 3 : total <= 30 ? 4 : 5;
  const counts = distributeWeighted(total, Array.from({ length: rows }, () => 1), 1);
  const points: LayoutPoint[] = [];
  const guides: LayoutGuide[] = [];
  counts.forEach((count, row) => {
    const createPoint = (ratio: number) => {
      const baseY = rows === 1 ? 500 : 135 + (730 * row) / (rows - 1);
      return { x: 85 + ratio * 830, y: baseY + Math.sin(ratio * Math.PI * 2 + row * 0.8) * 46 };
    };
    points.push(...Array.from({ length: count }, (_, index) => ({
      ...createPoint(count === 1 ? 0.5 : index / (count - 1)),
      nodeShape: "capsule" as const
    })));
    guides.push({ kind: "path", d: pathThrough(Array.from({ length: 80 }, (_, index) => createPoint(index / 79))) });
  });
  return { points, guides };
}

function fanGeometry(total: number): LayoutGeometry {
  const rows = total <= 16 ? 4 : total <= 25 ? 5 : total <= 37 ? 6 : 7;
  const radii = Array.from({ length: rows }, (_, index) => 145 + (675 * index) / Math.max(1, rows - 1));
  const counts = distributeWeighted(total, radii, 2);
  const points: LayoutPoint[] = [];
  const guides: LayoutGuide[] = [];
  for (let row = 0; row < rows; row += 1) {
    const count = counts[row];
    const radius = radii[row];
    for (let index = 0; index < count; index += 1) {
      const angle = count === 1 ? 0 : -0.55 + (1.1 * index) / (count - 1);
      points.push({ x: 500 + Math.sin(angle) * radius, y: 925 - Math.cos(angle) * radius });
    }
    const startX = 500 + Math.sin(-0.55) * radius;
    const startY = 925 - Math.cos(-0.55) * radius;
    const endX = 500 + Math.sin(0.55) * radius;
    const endY = 925 - Math.cos(0.55) * radius;
    guides.push({ kind: "path", d: `M ${startX.toFixed(2)} ${startY.toFixed(2)} A ${radius} ${radius} 0 0 1 ${endX.toFixed(2)} ${endY.toFixed(2)}` });
  }
  guides.push({ kind: "path", d: "M 500 925 L 71 662 M 500 925 L 929 662" });
  return { points, guides };
}

function orbitGeometry(total: number): LayoutGeometry {
  const lanes = total <= 16 ? 2 : total <= 30 ? 3 : 4;
  const rxValues = Array.from({ length: lanes }, (_, index) => 165 + (245 * index) / Math.max(1, lanes - 1));
  const ryValues = Array.from({ length: lanes }, (_, index) => 105 + (220 * index) / Math.max(1, lanes - 1));
  const counts = distributeWeighted(total, rxValues.map((rx, index) => rx + ryValues[index]), 3);
  const rotation = 12 * Math.PI / 180;
  const points: LayoutPoint[] = [];
  const guides: LayoutGuide[] = [];
  counts.forEach((count, lane) => {
    const cx = 500 + lane * 5;
    const cy = 500 - lane * 4;
    const rx = rxValues[lane];
    const ry = ryValues[lane];
    for (let index = 0; index < count; index += 1) {
      const angle = (Math.PI * 2 * index) / count + lane * 0.31;
      const ox = Math.cos(angle) * rx;
      const oy = Math.sin(angle) * ry;
      points.push({
        x: cx + ox * Math.cos(rotation) - oy * Math.sin(rotation),
        y: cy + ox * Math.sin(rotation) + oy * Math.cos(rotation)
      });
    }
    guides.push({ kind: "ellipse", cx, cy, rx, ry, rotation: 12 });
  });
  return { points, guides };
}

function diamondGeometry(total: number): LayoutGeometry {
  const candidates: Array<Point & { distance: number }> = [];
  for (let y = -8; y <= 8; y += 1) {
    for (let x = -8; x <= 8; x += 1) {
      candidates.push({ x, y, distance: Math.abs(x) + Math.abs(y) });
    }
  }
  candidates.sort((left, right) => left.distance - right.distance || left.y - right.y || left.x - right.x);
  const selected = candidates.slice(0, total);
  const extent = Math.max(...selected.flatMap((point) => [Math.abs(point.x), Math.abs(point.y)]), 1);
  const step = 410 / extent;
  const points = selected.map((point) => ({
    x: 500 + point.x * step,
    y: 500 + point.y * step,
    nodeShape: "diamond" as const
  }));
  return {
    points,
    guides: [{ kind: "path", d: pathThrough([{ x: 500, y: 70 }, { x: 930, y: 500 }, { x: 500, y: 930 }, { x: 70, y: 500 }], true) }]
  };
}

function petalGeometry(total: number): LayoutGeometry {
  const points: LayoutPoint[] = [{ x: 500, y: 500, nodeShape: "petal" }];
  const counts = distributeWeighted(total - 1, Array.from({ length: 6 }, () => 1), 1);
  const guides: LayoutGuide[] = [];
  counts.forEach((count, petal) => {
    const direction = petal * Math.PI / 3 - Math.PI / 2;
    const rotation = direction * 180 / Math.PI;
    const cx = 500 + Math.cos(direction) * 280;
    const cy = 500 + Math.sin(direction) * 280;
    for (let index = 0; index < count; index += 1) {
      const angle = (Math.PI * 2 * index) / count;
      const along = Math.cos(angle) * 150;
      const across = Math.sin(angle) * 70;
      points.push({
        x: cx + along * Math.cos(direction) - across * Math.sin(direction),
        y: cy + along * Math.sin(direction) + across * Math.cos(direction),
        nodeShape: "petal",
        nodeRotation: rotation
      });
    }
    guides.push({ kind: "ellipse", cx, cy, rx: 150, ry: 70, rotation });
  });
  return { points, guides };
}

function trackGeometry(total: number): LayoutGeometry {
  const lanes = total <= 20 ? 2 : 3;
  const sizes = lanes === 2 ? [[275, 175], [430, 345]] : [[270, 170], [350, 260], [430, 350]];
  const counts = distributeWeighted(total, sizes.map(([rx, ry]) => rx + ry), 4);
  const points: LayoutPoint[] = [];
  const guides: LayoutGuide[] = [];
  sizes.forEach(([rx, ry], lane) => {
    const curve = (ratio: number) => {
      const angle = ratio * Math.PI * 2;
      const cosine = Math.cos(angle);
      const sine = Math.sin(angle);
      return {
        x: 500 + rx * Math.sign(cosine) * Math.abs(cosine) ** 0.32,
        y: 500 + ry * Math.sign(sine) * Math.abs(sine) ** 0.32
      };
    };
    const lanePoints = sampleCurve(counts[lane] + 1, curve).slice(0, -1);
    points.push(...lanePoints.map((point, index) => {
      const next = lanePoints[(index + 1) % lanePoints.length];
      return {
        ...point,
        nodeShape: "capsule" as const,
        nodeRotation: Math.atan2(next.y - point.y, next.x - point.x) * 180 / Math.PI
      };
    }));
    guides.push({ kind: "rect", x: 500 - rx, y: 500 - ry, width: rx * 2, height: ry * 2, radius: Math.min(118, ry) });
  });
  return { points, guides };
}

function snakeGeometry(total: number): LayoutGeometry {
  const rows = total <= 16 ? 3 : total <= 25 ? 4 : total <= 40 ? 5 : 6;
  const counts = distributeWeighted(total, Array.from({ length: rows }, () => 1), 1);
  const points: LayoutPoint[] = [];
  let path = "";
  counts.forEach((count, row) => {
    const y = rows === 1 ? 500 : 100 + (800 * row) / (rows - 1);
    for (let index = 0; index < count; index += 1) {
      const ratio = count === 1 ? 0.5 : index / (count - 1);
      const directed = row % 2 === 0 ? ratio : 1 - ratio;
      points.push({ x: 90 + directed * 820, y, nodeShape: "capsule" });
    }
    if (row === 0) {
      path = `M 90 ${y} L 910 ${y}`;
      return;
    }
    const previousY = 100 + (800 * (row - 1)) / (rows - 1);
    const edge = row % 2 === 1 ? 910 : 90;
    const control = edge + (row % 2 === 1 ? 62 : -62);
    path += ` Q ${control} ${(previousY + y) / 2} ${edge} ${y} L ${row % 2 === 1 ? 90 : 910} ${y}`;
  });
  return { points, guides: [{ kind: "path", d: path }] };
}

function geometryForShape(shape: BoardShape, total: number, seed: number): LayoutGeometry {
  switch (shape) {
    case "grid": return { points: gridPoints(total), guides: [] };
    case "hex": return hexGeometry(total);
    case "radial": return radialGeometry(total);
    case "spiral": return spiralGeometry(total, seed % 2 === 0 ? 1 : -1);
    case "scatter": return scatterGeometry(total, seed);
    case "triangle": return triangleGeometry(total);
    case "wave": return waveGeometry(total);
    case "fan": return fanGeometry(total);
    case "orbit": return orbitGeometry(total);
    case "diamond": return diamondGeometry(total);
    case "petal": return petalGeometry(total);
    case "track": return trackGeometry(total);
    case "snake": return snakeGeometry(total);
  }
}

function stableGeometry(shape: BoardShape, total: number, seed: number): LayoutGeometry {
  const geometry = geometryForShape(shape, total, seed);
  const usable = geometry.points.length === total && geometry.points.every((point) => (
    Number.isFinite(point.x) && Number.isFinite(point.y) && point.x >= 55 && point.x <= 945 && point.y >= 55 && point.y <= 945
  ));
  if (usable) return geometry;
  return { points: gridPoints(total), guides: [] };
}

function nearestDistance(points: Point[]): number {
  let nearest = Number.POSITIVE_INFINITY;
  for (let first = 0; first < points.length; first += 1) {
    for (let second = first + 1; second < points.length; second += 1) {
      nearest = Math.min(nearest, Math.hypot(points[first].x - points[second].x, points[first].y - points[second].y));
    }
  }
  return nearest;
}

function defaultNodeShape(shape: BoardShape): CellSpec["nodeShape"] {
  if (shape === "hex") return "hex";
  if (shape === "triangle") return "triangle";
  if (shape === "diamond") return "diamond";
  if (shape === "wave" || shape === "track" || shape === "snake") return "capsule";
  if (shape === "petal") return "petal";
  return "circle";
}

function textUnitWidth(label: string): number {
  return [...label].reduce((width, character) => {
    if (character === "1" || character === "I") return width + 0.42;
    if (character === "M" || character === "W") return width + 0.78;
    return width + 0.62;
  }, 0);
}

function textHalfExtents(label: string, fontScale: number, rotation: number, visualRadius: number): Point {
  const fontSize = visualRadius * VECTOR_FONT_RATIO * fontScale;
  const width = fontSize * textUnitWidth(label);
  const height = fontSize * 1.05;
  const radians = Math.abs(rotation) * Math.PI / 180;
  return {
    x: (Math.cos(radians) * width + Math.sin(radians) * height) / 2,
    y: (Math.sin(radians) * width + Math.cos(radians) * height) / 2
  };
}

function resolveFontScales(
  labels: string[],
  points: Point[],
  rotations: number[],
  desired: number[],
  minimum: number,
  visualRadius: number
): number[] {
  const scales = [...desired];
  for (let pass = 0; pass < 80; pass += 1) {
    let changed = false;
    for (let left = 0; left < points.length; left += 1) {
      const a = textHalfExtents(labels[left], scales[left], rotations[left], visualRadius);
      for (let right = left + 1; right < points.length; right += 1) {
        const b = textHalfExtents(labels[right], scales[right], rotations[right], visualRadius);
        const overlapX = Math.abs(points[left].x - points[right].x) < a.x + b.x + 8;
        const overlapY = Math.abs(points[left].y - points[right].y) < a.y + b.y + 8;
        if (!overlapX || !overlapY) continue;
        const candidate = scales[left] - minimum >= scales[right] - minimum ? left : right;
        const next = Math.max(minimum, scales[candidate] - 0.04);
        if (next < scales[candidate]) {
          scales[candidate] = next;
          changed = true;
        }
      }
    }
    if (!changed) break;
  }
  return scales;
}

function distractorLabels(count: number, rand: Random, level: number): string[] {
  const pool = shuffled([...LETTERS], rand);
  return Array.from({ length: count }, (_, index) => {
    const first = pool[index % pool.length];
    if (level < 301 || index < Math.ceil(count / 2)) return first;
    return `${first}${LETTERS[(index * 7 + Math.floor(rand() * LETTERS.length)) % LETTERS.length]}`;
  });
}

export function buildLevel(
  level: number,
  seed = canonicalSeed(level),
  ruleset: Ruleset = CURRENT_RULESET
): LevelSpec {
  const profile = levelProfileForLevel(level, ruleset);
  const rand = mulberry32(seed);
  const targets = Array.from({ length: profile.targetCount }, (_, index) => ({
    kind: "target" as const,
    label: String(index + 1),
    sequenceValue: index + 1
  }));
  const distractors = distractorLabels(profile.distractorCount, rand, level).map((label) => ({
    kind: "distractor" as const,
    label,
    sequenceValue: null
  }));
  const content = shuffled([...targets, ...distractors], rand);
  const geometry = stableGeometry(profile.shape, profile.totalCount, seed);
  const points = geometry.points;
  const columns = Math.ceil(Math.sqrt(profile.totalCount));
  const baseRadius = Math.max(34, Math.min(64, 310 / columns));
  const radiusFactor: Record<CellSpec["nodeShape"], number> = {
    circle: 0.43,
    hex: 1 / Math.sqrt(3),
    triangle: 0.39,
    diamond: 0.39,
    capsule: 0.34,
    petal: 0.39
  };
  const layoutNodeShape = defaultNodeShape(profile.shape);
  const visibleRadius = profile.shape === "hex"
    ? nearestDistance(points) / Math.sqrt(3)
    : Math.min(baseRadius, nearestDistance(points) * radiusFactor[layoutNodeShape]);
  const colorPalette = TEXT_COLORS.slice(0, profile.visual.colorCount);
  const rotations = content.map(() => (rand() * 2 - 1) * profile.visual.maxRotation);
  const scaleRange = profile.visual.fontMax - profile.visual.fontMin;
  const scaleCandidates = content.map((_, index) => (
    profile.visual.fontMin + scaleRange * ((index % 9) / 8)
  ));
  const desiredScales = shuffled(scaleCandidates, rand);
  const fontScales = profile.shape === "grid"
    ? desiredScales
    : resolveFontScales(
      content.map((item) => item.label),
      points,
      rotations,
      desiredScales,
      profile.visual.fontMin,
      visibleRadius
    );

  const cells: CellSpec[] = content.map((item, index) => ({
    id: `${item.kind}:${item.label}:${index}`,
    ...item,
    color: colorPalette[Math.floor(rand() * colorPalette.length)],
    bg: CELL_BGS[Math.floor(rand() * CELL_BGS.length)],
    fontScale: fontScales[index],
    rotation: rotations[index],
    widthPct: ruleset === "v2" ? 64 + rand() * 34 : 78 + rand() * 22,
    heightPct: ruleset === "v2" ? 64 + rand() * 34 : 78 + rand() * 22,
    placeH: PLACES[Math.floor(rand() * PLACES.length)],
    placeV: PLACES[Math.floor(rand() * PLACES.length)],
    radius: 6 + Math.round(rand() * 9),
    x: points[index]?.x ?? 500,
    y: points[index]?.y ?? 500,
    visualRadius: visibleRadius,
    nodeShape: points[index]?.nodeShape ?? defaultNodeShape(profile.shape),
    nodeRotation: points[index]?.nodeRotation ?? 0
  }));

  return { ...profile, seed, cells, guides: geometry.guides };
}

export function buildLegacyLevel(level: number, seed = canonicalSeed(level, "v2")): LevelSpec {
  return buildLevel(level, seed, "v2");
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

export function legacySizeForLevel(level: number): number {
  return legacyGridSizeForLevel(level);
}
