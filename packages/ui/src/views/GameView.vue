<script setup lang="ts">
import { computed, inject, onBeforeUnmount, onMounted, ref } from "vue";
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  Pause,
  Play,
  RotateCcw,
  Share2,
  Shuffle,
  Target,
  Timer,
  Trophy
} from "lucide-vue-next";
import {
  MAX_LEVEL,
  buildLevel,
  canonicalSeed,
  levelBand,
  randomSeed,
  shapeName,
  timeLimitForLevel,
  type CellSkin
} from "../game/levels";
import {
  bestTime,
  loadProgress,
  saveProgress,
  saveRecord,
  type GameSettings
} from "../game/storage";
import { formatCountdown, formatElapsed } from "../game/format";
import { playComplete, playError, playFail, playTap } from "../game/sound";
import { submitRecord } from "../game/api";
import CompleteDialog from "../components/CompleteDialog.vue";
import FailDialog from "../components/FailDialog.vue";

const props = defineProps<{
  level: number;
  seed: number | null;
  shareUrl: (level: number, seed: number | null) => string;
}>();

const emit = defineEmits<{
  (e: "exit"): void;
  (e: "navigate", level: number): void;
  (e: "seed-change", seed: number): void;
}>();

const settings = inject<GameSettings>("settings")!;

const currentSeed = ref(props.seed ?? canonicalSeed(props.level));
const spec = ref(buildLevel(props.level, currentSeed.value));

const target = ref(1);
const errors = ref(0);
const elapsed = ref(0);
const started = ref(false);
const paused = ref(false);
const finished = ref(false);
const failed = ref(false);
const isNewBest = ref(false);
const wrongIndex = ref(-1);
const shared = ref(false);

let timer: number | null = null;
let startedAt = 0;
let accumulated = 0;

const best = ref<number | null>(bestTime(props.level));
const timeLimit = timeLimitForLevel(props.level);

const size = computed(() => spec.value.size);
const total = computed(() => spec.value.cells.length);
const shapeLabel = computed(() => shapeName(spec.value.shape));
const progressRatio = computed(() => ((target.value - 1) / total.value) * 100);
const doneSet = computed(() => new Set(Array.from({ length: target.value - 1 }, (_, i) => i + 1)));

const remaining = computed(() => (timeLimit === null ? null : Math.max(0, timeLimit - elapsed.value)));
const timeCritical = computed(() => remaining.value !== null && remaining.value <= 10000 && started.value && !finished.value && !failed.value);

/** 就绪态：未开始、未结束、未失败时遮罩盖住棋盘，点击开始才计时 */
const ready = computed(() => !started.value && !finished.value && !failed.value);

// ---- 蜂巢 SVG 几何：尖顶六边形无缝拼接，行间距精确为 3/4 高度 ----

const HEX_W = 100;
const HEX_H = (HEX_W * 2) / Math.sqrt(3);
const HEX_STEP_Y = HEX_H * 0.75;

const hexViewBox = computed(() => {
  const width = size.value * HEX_W + HEX_W / 2;
  const height = (size.value - 1) * HEX_STEP_Y + HEX_H;
  return `0 0 ${width} ${height}`;
});

function hexPoints(index: number): string {
  const r = Math.floor(index / size.value);
  const c = index % size.value;
  const cx = HEX_W / 2 + c * HEX_W + (r % 2 === 1 ? HEX_W / 2 : 0);
  const cy = HEX_H / 2 + r * HEX_STEP_Y;
  return [
    [cx, cy - HEX_H / 2],
    [cx + HEX_W / 2, cy - HEX_H / 4],
    [cx + HEX_W / 2, cy + HEX_H / 4],
    [cx, cy + HEX_H / 2],
    [cx - HEX_W / 2, cy + HEX_H / 4],
    [cx - HEX_W / 2, cy - HEX_H / 4]
  ]
    .map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`)
    .join(" ");
}

function hexCenter(index: number): { x: number; y: number } {
  const r = Math.floor(index / size.value);
  const c = index % size.value;
  return {
    x: HEX_W / 2 + c * HEX_W + (r % 2 === 1 ? HEX_W / 2 : 0),
    y: HEX_H / 2 + r * HEX_STEP_Y
  };
}

function gridCellStyle(cell: CellSkin) {
  return {
    width: `${cell.widthPct}%`,
    height: `${cell.heightPct}%`,
    justifySelf: cell.placeH,
    alignSelf: cell.placeV,
    borderRadius: `${cell.radius}px`,
    background: cell.bg,
    color: cell.color,
    fontSize: `${cell.fontScale}em`
  };
}

// ---- 计时 ----

function tick() {
  elapsed.value = accumulated + (performance.now() - startedAt);
  if (timeLimit !== null && elapsed.value >= timeLimit && !finished.value && !failed.value) {
    fail();
  }
}

function startTimer() {
  if (started.value) return;
  started.value = true;
  startedAt = performance.now();
  timer = window.setInterval(tick, 100);
}

function begin() {
  startTimer();
}

function stopTimer() {
  if (timer !== null) {
    window.clearInterval(timer);
    timer = null;
  }
}

function vibrate(pattern: number | number[]) {
  try {
    if (settings.haptics && "vibrate" in navigator) {
      navigator.vibrate(pattern);
    }
  } catch {
    // 触觉反馈失败不影响游戏
  }
}

function safeSound(play: () => void) {
  // 音效必须在状态更新之后调用，且任何异常都不能吞掉这次点按
  if (!settings.sound) return;
  try {
    play();
  } catch {
    // 音频上下文不可用时静默降级
  }
}

function tapCell(value: number, index: number) {
  if (!started.value || paused.value || finished.value || failed.value) return;

  if (value === target.value) {
    target.value += 1;
    safeSound(() => playTap(target.value - 1));
    if (target.value > total.value) {
      finish();
    }
  } else if (!doneSet.value.has(value)) {
    errors.value += 1;
    wrongIndex.value = index;
    safeSound(playError);
    vibrate(30);
    window.setTimeout(() => {
      if (wrongIndex.value === index) wrongIndex.value = -1;
    }, 350);
  }
}

function finish() {
  accumulated = elapsed.value;
  stopTimer();
  finished.value = true;
  safeSound(playComplete);
  vibrate(60);

  const ms = Math.round(elapsed.value);
  // 本地先记录保证界面即时反馈，同时上报服务器（排行榜与个人档案）
  const localBest = saveRecord(props.level, ms);
  isNewBest.value = localBest;
  best.value = bestTime(props.level);

  void submitRecord({ level: props.level, ms, errors: errors.value, seed: currentSeed.value }).then((res) => {
    if (res) {
      isNewBest.value = res.isNewBest;
      best.value = res.best;
    }
  });

  // 通关后推进进度（只前进，不回退）
  if (props.level > loadProgress()) {
    saveProgress(props.level);
  }
}

function fail() {
  accumulated = elapsed.value;
  stopTimer();
  failed.value = true;
  safeSound(playFail);
  vibrate([60, 40, 60]);
}

function togglePause() {
  if (!started.value || finished.value || failed.value) return;
  if (paused.value) {
    paused.value = false;
    startedAt = performance.now();
    timer = window.setInterval(tick, 100);
  } else {
    accumulated = elapsed.value;
    stopTimer();
    paused.value = true;
  }
}

function resetState() {
  stopTimer();
  target.value = 1;
  errors.value = 0;
  elapsed.value = 0;
  accumulated = 0;
  started.value = false;
  paused.value = false;
  finished.value = false;
  failed.value = false;
  wrongIndex.value = -1;
}

/** 重新开始：方案不变，只清零进度 */
function restart() {
  resetState();
}

/** 重新排版：换一套排布与配色（新种子），并同步到地址栏便于分享 */
function refreshLayout() {
  currentSeed.value = randomSeed();
  spec.value = buildLevel(props.level, currentSeed.value);
  resetState();
  emit("seed-change", currentSeed.value);
}

async function share() {
  const url = props.shareUrl(props.level, currentSeed.value);
  const text = `我在「舒尔特训练」第 ${props.level} 关（${shapeLabel.value} ${size.value}×${size.value}）等你挑战：${url}`;
  try {
    await navigator.clipboard.writeText(text);
    shared.value = true;
    window.setTimeout(() => (shared.value = false), 2000);
  } catch {
    window.prompt("复制分享链接", url);
  }
}

function nextLevel() {
  if (props.level < MAX_LEVEL) {
    emit("navigate", props.level + 1);
  }
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === "Escape") {
    if (finished.value || failed.value) return;
    togglePause();
  }
}

onMounted(() => window.addEventListener("keydown", onKeydown));
onBeforeUnmount(() => {
  stopTimer();
  window.removeEventListener("keydown", onKeydown);
});
</script>

<template>
  <main class="game">
    <section class="game-hud">
      <div class="hud-group">
        <button class="icon-btn" type="button" aria-label="返回主页" title="返回主页" @click="emit('exit')">
          <ArrowLeft :size="20" />
        </button>
        <div class="hud-title">
          <strong>第 {{ level }} 关 · {{ shapeLabel }}</strong>
          <small>{{ levelBand(level) }} · {{ size }}×{{ size }}<template v-if="timeLimit !== null"> · 限时</template></small>
        </div>
      </div>

      <div class="hud-stats">
        <div class="stat" :class="{ countdown: timeLimit !== null, critical: timeCritical }">
          <small><Timer :size="12" />{{ timeLimit !== null ? "剩余时间" : "已用时间" }}</small>
          <strong class="mono">{{ timeLimit !== null ? formatCountdown(remaining!) : formatElapsed(elapsed) }}</strong>
        </div>
        <div class="stat highlight">
          <small><Target :size="12" />当前数字</small>
          <strong class="mono">{{ Math.min(target, total) }}<em>/{{ total }}</em></strong>
        </div>
        <div class="stat">
          <small><AlertTriangle :size="12" />失误</small>
          <strong class="mono">{{ errors }}</strong>
        </div>
        <div class="stat hide-sm">
          <small><Trophy :size="12" />最佳</small>
          <strong class="mono">{{ best !== null ? formatElapsed(best) : "--" }}</strong>
        </div>
      </div>

      <div class="hud-actions">
        <button class="icon-btn" type="button" aria-label="重新排版" title="重新排版（换一套排布与配色）" @click="refreshLayout">
          <Shuffle :size="20" />
        </button>
        <button class="icon-btn" type="button" :aria-label="paused ? '继续' : '暂停'" :title="paused ? '继续' : '暂停'" @click="togglePause">
          <Pause v-if="!paused" :size="20" />
          <Play v-else :size="20" fill="currentColor" />
        </button>
        <button class="icon-btn" type="button" aria-label="重新开始" title="重新开始" @click="restart">
          <RotateCcw :size="20" />
        </button>
        <button class="icon-btn" type="button" aria-label="分享本关" title="分享本关" @click="share">
          <Check v-if="shared" :size="20" :stroke-width="2.4" />
          <Share2 v-else :size="20" />
        </button>
      </div>
    </section>

    <div class="progress-track" role="progressbar" :aria-valuenow="target - 1" :aria-valuemax="total">
      <div class="progress-fill" :style="{ width: `${progressRatio}%` }"></div>
    </div>

    <section class="board-wrap">
      <!-- 错落方格 -->
      <div
        v-if="spec.shape === 'grid'"
        class="board grid-board"
        :class="{ dimmed: paused }"
        :style="{ '--k': size }"
      >
        <button
          v-for="(cell, index) in spec.cells"
          :key="index"
          type="button"
          class="cell"
          :class="{ wrong: wrongIndex === index }"
          :style="gridCellStyle(cell)"
          :disabled="!started || paused"
          @pointerdown="tapCell(cell.value, index)"
        >
          {{ cell.value }}
        </button>
        <div v-if="ready" class="ready-mask">
          <p class="ready-title">第 {{ level }} 关 · {{ shapeLabel }} {{ size }}×{{ size }}</p>
          <p v-if="timeLimit !== null" class="ready-limit"><Timer :size="13" />限时 {{ formatCountdown(timeLimit) }}</p>
          <button type="button" class="start-btn" @click="begin"><Play :size="18" fill="currentColor" />开始</button>
          <p class="ready-hint">点击开始即计时，按 1 到 {{ total }} 依次点按</p>
        </div>
        <div v-if="paused" class="pause-mask">
          <p>已暂停</p>
          <button type="button" class="resume-btn" @click="togglePause"><Play :size="16" fill="currentColor" />继续</button>
        </div>
      </div>

      <!-- 蜂巢：整张棋盘一个 SVG，几何精确、无缝无叠 -->
      <div v-else class="board hex-stage" :class="{ dimmed: paused }">
        <svg class="hex-svg" :viewBox="hexViewBox" role="group" aria-label="蜂巢棋盘">
          <g
            v-for="(cell, index) in spec.cells"
            :key="index"
            class="hex-g"
            :class="{ wrong: wrongIndex === index }"
            role="button"
            :aria-label="`数字 ${cell.value}`"
            @pointerdown="tapCell(cell.value, index)"
          >
            <polygon
              class="hex-poly"
              :class="{ wrong: wrongIndex === index }"
              :points="hexPoints(index)"
              :fill="cell.bg"
            />
            <text
              class="hex-text"
              :x="hexCenter(index).x"
              :y="hexCenter(index).y"
              :fill="cell.color"
              :font-size="34 * cell.fontScale"
            >
              {{ cell.value }}
            </text>
          </g>
        </svg>
        <div v-if="ready" class="ready-mask">
          <p class="ready-title">第 {{ level }} 关 · {{ shapeLabel }} {{ size }}×{{ size }}</p>
          <p v-if="timeLimit !== null" class="ready-limit"><Timer :size="13" />限时 {{ formatCountdown(timeLimit) }}</p>
          <button type="button" class="start-btn" @click="begin"><Play :size="18" fill="currentColor" />开始</button>
          <p class="ready-hint">点击开始即计时，按 1 到 {{ total }} 依次点按</p>
        </div>
        <div v-if="paused" class="pause-mask">
          <p>已暂停</p>
          <button type="button" class="resume-btn" @click="togglePause"><Play :size="16" fill="currentColor" />继续</button>
        </div>
      </div>
    </section>

    <CompleteDialog
      v-if="finished"
      :level="level"
      :shape="spec.shape"
      :seed="currentSeed"
      :time-ms="Math.round(elapsed)"
      :errors="errors"
      :best="best"
      :is-new-best="isNewBest"
      :has-next="level < MAX_LEVEL"
      :share-url="shareUrl"
      @next="nextLevel"
      @replay="restart"
      @home="emit('exit')"
    />

    <FailDialog
      v-if="failed"
      :level="level"
      :reached="target - 1"
      :total="total"
      :time-ms="Math.round(elapsed)"
      :best="best"
      @retry="restart"
      @reshuffle="refreshLayout"
      @home="emit('exit')"
    />
  </main>
</template>
