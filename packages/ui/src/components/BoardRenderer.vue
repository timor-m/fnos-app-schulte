<script setup lang="ts">
import { computed } from "vue";
import type { CellSpec, LevelSpec } from "../game/levels";

const props = withDefaults(
  defineProps<{
    spec: LevelSpec;
    active?: boolean;
    paused?: boolean;
    wrongId?: string | null;
    preview?: boolean;
  }>(),
  { active: false, paused: false, wrongId: null, preview: false }
);

const emit = defineEmits<{
  (event: "select", cell: CellSpec): void;
}>();

const columns = computed(() => Math.ceil(Math.sqrt(props.spec.totalCount)));
let lastSelectionId = "";
let lastSelectionAt = Number.NEGATIVE_INFINITY;

function gridCellStyle(cell: CellSpec) {
  return {
    width: `${cell.widthPct}%`,
    height: `${cell.heightPct}%`,
    justifySelf: cell.placeH,
    alignSelf: cell.placeV,
    borderRadius: `${cell.radius}px`,
    background: cell.bg,
    color: cell.color,
    fontSize: `${cell.fontScale}em`,
    rotate: `${cell.rotation}deg`
  };
}

function hexPoints(cell: CellSpec): string {
  return regularPolygonPoints(cell, 6, -Math.PI / 2, 1);
}

function regularPolygonPoints(cell: CellSpec, sides: number, rotation: number, radiusScale: number): string {
  const radius = cell.visualRadius * radiusScale;
  return Array.from({ length: sides }, (_, index) => {
    const angle = rotation + (Math.PI * 2 * index) / sides;
    return `${(cell.x + Math.cos(angle) * radius).toFixed(2)},${(cell.y + Math.sin(angle) * radius).toFixed(2)}`;
  }).join(" ");
}

function nodeTransform(cell: CellSpec): string {
  return `rotate(${cell.nodeRotation} ${cell.x} ${cell.y})`;
}

function selectOnce(cell: CellSpec) {
  if (!props.active || props.paused || props.preview) return;
  const now = performance.now();
  // 部分 WebView 会为同一次触摸同时派发 pointerdown 与 touchstart。
  if (cell.id === lastSelectionId && now - lastSelectionAt < 320) return;
  lastSelectionId = cell.id;
  lastSelectionAt = now;
  emit("select", cell);
}

function selectGrid(event: PointerEvent | TouchEvent) {
  if (!props.active || props.paused || props.preview) return;
  if (event.cancelable) event.preventDefault();
  const target = event.target as Element | null;
  const rawIndex = target?.closest<HTMLElement>("[data-cell-index]")?.dataset.cellIndex;
  const index = rawIndex === undefined ? -1 : Number(rawIndex);
  const cell = props.spec.cells[index];
  if (cell) selectOnce(cell);
}

function selectVector(event: PointerEvent | TouchEvent) {
  if (!props.active || props.paused || props.preview) return;
  if (event.cancelable) event.preventDefault();

  const point = "changedTouches" in event ? event.changedTouches[0] : event;
  const svg = event.currentTarget as SVGSVGElement;
  if (!point || !svg) return;
  const rect = svg.getBoundingClientRect();
  const x = ((point.clientX - rect.left) / rect.width) * 1000;
  const y = ((point.clientY - rect.top) / rect.height) * 1000;

  let nearest: CellSpec | null = null;
  let nearestDistance = Number.POSITIVE_INFINITY;
  for (const cell of props.spec.cells) {
    const distance = Math.hypot(x - cell.x, y - cell.y);
    if (distance < nearestDistance) {
      nearest = cell;
      nearestDistance = distance;
    }
  }
  if (nearest && nearestDistance <= Math.max(66, nearest.visualRadius * 1.05)) {
    selectOnce(nearest);
  }
}
</script>

<template>
  <div
    v-if="spec.shape === 'grid'"
    v-memo="[spec, wrongId, active, paused, preview]"
    class="board grid-board"
    :class="{ dimmed: paused, preview }"
    :style="{ '--grid-cols': columns }"
    @pointerdown="selectGrid"
    @touchstart="selectGrid"
  >
    <button
      v-for="(cell, index) in spec.cells"
      :key="cell.id"
      type="button"
      class="cell"
      :data-cell-index="index"
      :class="{ wrong: wrongId === cell.id, distractor: cell.kind === 'distractor' }"
      :disabled="!active || paused || preview"
      :aria-label="cell.kind === 'target' ? `数字 ${cell.label}` : `干扰项 ${cell.label}`"
    >
      <span class="cell-visual" :style="gridCellStyle(cell)">{{ cell.label }}</span>
    </button>
  </div>

  <div
    v-else
    v-memo="[spec, wrongId, active, paused, preview]"
    class="board vector-stage"
    :class="[`shape-${spec.shape}`, { dimmed: paused, preview }]"
  >
    <svg
      class="vector-svg"
      viewBox="0 0 1000 1000"
      role="group"
      :aria-label="`${spec.shape} 棋盘`"
      @pointerdown="selectVector"
      @touchstart="selectVector"
    >
      <rect class="vector-input-plane" x="0" y="0" width="1000" height="1000" />
      <g class="vector-guides" aria-hidden="true">
        <template v-for="(guide, index) in spec.guides" :key="index">
          <path v-if="guide.kind === 'path'" class="vector-guide" :d="guide.d" />
          <circle
            v-else-if="guide.kind === 'circle'"
            class="vector-guide"
            :cx="guide.cx"
            :cy="guide.cy"
            :r="guide.radius"
          />
          <ellipse
            v-else-if="guide.kind === 'ellipse'"
            class="vector-guide"
            :cx="guide.cx"
            :cy="guide.cy"
            :rx="guide.rx"
            :ry="guide.ry"
            :transform="`rotate(${guide.rotation} ${guide.cx} ${guide.cy})`"
          />
          <rect
            v-else
            class="vector-guide"
            :x="guide.x"
            :y="guide.y"
            :width="guide.width"
            :height="guide.height"
            :rx="guide.radius"
          />
        </template>
      </g>
      <g
        v-for="cell in spec.cells"
        :key="cell.id"
        class="vector-cell"
        :class="{ wrong: wrongId === cell.id, distractor: cell.kind === 'distractor' }"
        role="button"
        :aria-label="cell.kind === 'target' ? `数字 ${cell.label}` : `干扰项 ${cell.label}`"
        :aria-disabled="!active || paused || preview"
      >
        <polygon
          v-if="cell.nodeShape === 'hex'"
          class="vector-tile hex-tile"
          :points="hexPoints(cell)"
          :fill="cell.bg"
        />
        <polygon
          v-else-if="cell.nodeShape === 'triangle'"
          class="vector-tile"
          :points="regularPolygonPoints(cell, 3, -Math.PI / 2, 1.12)"
          :fill="cell.bg"
        />
        <polygon
          v-else-if="cell.nodeShape === 'diamond'"
          class="vector-tile"
          :points="regularPolygonPoints(cell, 4, Math.PI / 4, 1.08)"
          :fill="cell.bg"
        />
        <rect
          v-else-if="cell.nodeShape === 'capsule'"
          class="vector-tile"
          :x="cell.x - cell.visualRadius * 1.14"
          :y="cell.y - cell.visualRadius * 0.76"
          :width="cell.visualRadius * 2.28"
          :height="cell.visualRadius * 1.52"
          :rx="cell.visualRadius * 0.76"
          :transform="nodeTransform(cell)"
          :fill="cell.bg"
        />
        <ellipse
          v-else-if="cell.nodeShape === 'petal'"
          class="vector-tile"
          :cx="cell.x"
          :cy="cell.y"
          :rx="cell.visualRadius * 1.12"
          :ry="cell.visualRadius * 0.78"
          :transform="nodeTransform(cell)"
          :fill="cell.bg"
        />
        <circle
          v-else
          class="vector-tile"
          :cx="cell.x"
          :cy="cell.y"
          :r="cell.visualRadius"
          :fill="cell.bg"
        />
        <text
          class="vector-text"
          :x="cell.x"
          :y="cell.y"
          :fill="cell.color"
          :font-size="cell.visualRadius * 1.02 * cell.fontScale"
          :transform="`rotate(${cell.rotation} ${cell.x} ${cell.y})`"
        >
          {{ cell.label }}
        </text>
      </g>
    </svg>
  </div>
</template>
