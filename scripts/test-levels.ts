import assert from "node:assert/strict";
import {
  LAYOUT_UNLOCKS,
  MAX_LEVEL,
  distractorCountForLevel,
  levelProfileForLevel,
  shapeForLevel,
  targetCountForLevel,
  timeLimitForLevel,
  unlockedShapesForLevel
} from "../packages/shared/levels";
import { buildLevel, canonicalSeed } from "../packages/ui/src/game/levels";

const NODE_EXTENT: Record<string, number> = {
  circle: 1,
  hex: 1,
  triangle: 1.12,
  diamond: 1.08,
  capsule: 1.38,
  petal: 1.12
};

function textWidth(label: string): number {
  return [...label].reduce((width, character) => {
    if (character === "1" || character === "I") return width + 0.42;
    if (character === "M" || character === "W") return width + 0.78;
    return width + 0.62;
  }, 0);
}

function textExtents(cell: ReturnType<typeof buildLevel>["cells"][number]) {
  const fontSize = cell.visualRadius * 1.02 * cell.fontScale;
  const width = fontSize * textWidth(cell.label);
  const height = fontSize * 1.05;
  const radians = Math.abs(cell.rotation) * Math.PI / 180;
  return {
    x: (Math.cos(radians) * width + Math.sin(radians) * height) / 2,
    y: (Math.sin(radians) * width + Math.cos(radians) * height) / 2
  };
}

function expectedCounts(level: number): [number, number] {
  if (level <= 5) return [9, 0];
  if (level <= 15) return [12, 0];
  if (level <= 45) return [16, 0];
  if (level <= 70) return [20, 0];
  if (level <= 150) return [25, 0];
  if (level <= 199) return [30, 0];
  if (level <= 225) return [32, 3];
  if (level <= 250) return [32, 5];
  if (level <= 275) return [34, 7];
  if (level <= 300) return [34, 9];
  if (level <= 350) return [36, 11];
  if (level <= 400) return [36, 13];
  if (level <= 450) return [34, 15];
  return [32, 17];
}

for (const unlock of LAYOUT_UNLOCKS) {
  assert.equal(shapeForLevel(unlock.level), unlock.shape, `第 ${unlock.level} 关应强制使用 ${unlock.shape}`);
  if (unlock.level >= 101) {
    const appearances = Array.from({ length: 11 }, (_, offset) => shapeForLevel(unlock.level + offset))
      .filter((shape) => shape === unlock.shape).length;
    assert.ok(appearances >= 2, `${unlock.shape} 在解锁后的高权重窗口内应再次出现`);
  }
}

for (let level = 1; level <= MAX_LEVEL; level += 1) {
  const [targets, distractors] = expectedCounts(level);
  const profile = levelProfileForLevel(level);
  const seed = canonicalSeed(level);
  const first = buildLevel(level, seed);
  const second = buildLevel(level, seed);

  assert.equal(targetCountForLevel(level), targets, `第 ${level} 关目标数`);
  assert.equal(distractorCountForLevel(level), distractors, `第 ${level} 关干扰数`);
  assert.equal(profile.totalCount, targets + distractors);
  assert.ok(profile.totalCount <= 49, `第 ${level} 关超过 49 项`);
  assert.equal(first.cells.length, profile.totalCount, `第 ${level} 关项目数量`);
  assert.deepEqual(first, second, `第 ${level} 关种子未能复现`);
  assert.ok(unlockedShapesForLevel(level).includes(profile.shape), `第 ${level} 关使用了未解锁布局`);
  assert.ok(
    first.shape === "grid" || first.shape === "hex" || first.guides.length > 0,
    `第 ${level} 关缺少布局结构线`
  );

  if (level >= 6) {
    assert.notEqual(profile.shape, shapeForLevel(level - 1), `第 ${level} 关与前一关布局重复`);
  }

  const targetCells = first.cells.filter((cell) => cell.kind === "target");
  const distractorCells = first.cells.filter((cell) => cell.kind === "distractor");
  assert.equal(targetCells.length, targets);
  assert.equal(distractorCells.length, distractors);
  assert.deepEqual(
    targetCells.map((cell) => cell.sequenceValue).sort((a, b) => Number(a) - Number(b)),
    Array.from({ length: targets }, (_, index) => index + 1)
  );
  assert.ok(distractorCells.every((cell) => /^[A-Z]{1,2}$/.test(cell.label)), `第 ${level} 关字母标签非法`);

  for (const cell of first.cells) {
    assert.ok(cell.x - cell.visualRadius >= 0 && cell.x + cell.visualRadius <= 1000, `第 ${level} 关横向越界`);
    assert.ok(cell.y - cell.visualRadius >= 0 && cell.y + cell.visualRadius <= 1000, `第 ${level} 关纵向越界`);
    assert.ok(cell.fontScale >= profile.visual.fontMin - 0.001, `第 ${level} 关字号低于下限`);
    assert.ok(cell.fontScale <= profile.visual.fontMax + 0.001, `第 ${level} 关字号超过上限`);
  }
  for (let left = 0; left < first.cells.length; left += 1) {
    for (let right = left + 1; right < first.cells.length; right += 1) {
      const a = first.cells[left];
      const b = first.cells[right];
      const distance = Math.hypot(a.x - b.x, a.y - b.y);
      const minimum = first.shape === "hex"
        ? Math.sqrt(3) * Math.max(a.visualRadius, b.visualRadius)
        : a.visualRadius * NODE_EXTENT[a.nodeShape] + b.visualRadius * NODE_EXTENT[b.nodeShape];
      assert.ok(distance + 0.01 >= minimum, `第 ${level} 关可见项目重叠`);

      const textA = textExtents(a);
      const textB = textExtents(b);
      const textOverlaps = Math.abs(a.x - b.x) < textA.x + textB.x + 7.9
        && Math.abs(a.y - b.y) < textA.y + textB.y + 7.9;
      assert.equal(textOverlaps, false, `第 ${level} 关文字边界重叠`);
    }
  }

  if (profile.visual.fontMax - profile.visual.fontMin >= 0.1) {
    const scales = first.cells.map((cell) => cell.fontScale);
    assert.ok(Math.max(...scales) - Math.min(...scales) >= 0.08, `第 ${level} 关字号变化丢失`);
  }

  if (first.shape === "hex") {
    const touchingDistance = Math.sqrt(3) * first.cells[0].visualRadius;
    for (const cell of first.cells) {
      const nearest = Math.min(...first.cells
        .filter((other) => other.id !== cell.id)
        .map((other) => Math.hypot(cell.x - other.x, cell.y - other.y)));
      assert.ok(Math.abs(nearest - touchingDistance) < 0.05, `第 ${level} 关蜂巢存在间隙`);
    }
  }
}

assert.equal(levelProfileForLevel(100).timeLimitMs, null);
assert.ok((levelProfileForLevel(101).timeLimitMs ?? 0) > 0);
assert.equal(timeLimitForLevel(101, "v3", "grid", 25), 60_000);
assert.equal(timeLimitForLevel(120, "v3", "grid", 25), 60_000);
assert.equal(timeLimitForLevel(121, "v3", "grid", 25), 55_000);
assert.equal(timeLimitForLevel(150, "v3", "grid", 25), 55_000);
assert.equal(timeLimitForLevel(151, "v3", "grid", 30), 60_000);
assert.equal(timeLimitForLevel(199, "v3", "grid", 30), 60_000);
assert.equal(timeLimitForLevel(200, "v3", "grid", 32), 51_200);
assert.equal(buildLevel(200).distractorCount, 3);
assert.equal(buildLevel(500).totalCount, 49);

console.log(`level tests passed: ${MAX_LEVEL} levels, ${LAYOUT_UNLOCKS.length} layouts`);
