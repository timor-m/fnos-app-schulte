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
  layoutUnlockAfter,
  levelBand,
  randomSeed,
  shapeName,
  type CellSpec,
  type Ruleset
} from "../game/levels";
import {
  bestTime,
  loadProgress,
  markLayoutUnlockSeen,
  saveProgress,
  saveRecord,
  seenLayoutUnlocks,
  type GameSettings
} from "../game/storage";
import { formatCountdown, formatElapsed } from "../game/format";
import {
  preloadAudio,
  playComplete,
  playError,
  playFail,
  playStart,
  playTap,
  unlockAudio
} from "../game/sound";
import { submitRecord } from "../game/api";
import CompleteDialog from "../components/CompleteDialog.vue";
import FailDialog from "../components/FailDialog.vue";
import BoardRenderer from "../components/BoardRenderer.vue";
import LayoutUnlockDialog from "../components/LayoutUnlockDialog.vue";

const props = defineProps<{
  level: number;
  seed: number | null;
  ruleset: Ruleset;
  shareUrl: (level: number, seed: number | null, ruleset: Ruleset) => string;
}>();

const emit = defineEmits<{
  (e: "exit"): void;
  (e: "navigate", level: number, ruleset: Ruleset): void;
  (e: "seed-change", seed: number): void;
}>();

const settings = inject<GameSettings>("settings")!;

const currentSeed = ref(props.seed ?? canonicalSeed(props.level, props.ruleset));
const spec = ref(buildLevel(props.level, currentSeed.value, props.ruleset));

const target = ref(1);
const errors = ref(0);
const elapsed = ref(0);
const started = ref(false);
const paused = ref(false);
const finished = ref(false);
const failed = ref(false);
const isNewBest = ref(false);
const wrongId = ref<string | null>(null);
const shared = ref(false);
const unlockOpen = ref(false);

let timer: number | null = null;
let startedAt = 0;
let accumulated = 0;
let tapSoundFrame: number | null = null;
let pendingTapSound = 0;

const best = ref<number | null>(bestTime(props.level, props.ruleset));
const timeLimit = spec.value.timeLimitMs;

const total = computed(() => spec.value.targetCount);
const shapeLabel = computed(() => shapeName(spec.value.shape));
const progressRatio = computed(() => ((target.value - 1) / total.value) * 100);

const remaining = computed(() => (timeLimit === null ? null : Math.max(0, timeLimit - elapsed.value)));
const timeCritical = computed(() => remaining.value !== null && remaining.value <= 10000 && started.value && !finished.value && !failed.value);

/** 就绪态：未开始、未结束、未失败时遮罩盖住棋盘，点击开始才计时 */
const ready = computed(() => !started.value && !finished.value && !failed.value);

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
  if (settings.sound) unlockAudio();
  if (settings.sound) safeSound(playStart);
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

function queueTapSound(step: number) {
  if (!settings.sound) return;
  pendingTapSound = step;
  if (tapSoundFrame !== null) return;
  tapSoundFrame = window.requestAnimationFrame(() => {
    tapSoundFrame = null;
    safeSound(() => playTap(pendingTapSound));
  });
}

function cancelTapSound() {
  if (tapSoundFrame !== null) window.cancelAnimationFrame(tapSoundFrame);
  tapSoundFrame = null;
}

function markWrong(cell: CellSpec) {
  errors.value += 1;
  wrongId.value = cell.id;
  safeSound(playError);
  vibrate(30);
  window.setTimeout(() => {
    if (wrongId.value === cell.id) wrongId.value = null;
  }, 350);
}

function tapCell(cell: CellSpec) {
  if (!started.value || paused.value || finished.value || failed.value) return;

  if (cell.kind === "distractor") {
    markWrong(cell);
    return;
  }

  if (cell.sequenceValue === target.value) {
    target.value += 1;
    queueTapSound(target.value - 1);
    if (target.value > total.value) {
      finish();
    }
  } else if ((cell.sequenceValue ?? 0) > target.value) {
    markWrong(cell);
  }
}

function finish() {
  accumulated = elapsed.value;
  stopTimer();
  finished.value = true;
  cancelTapSound();
  safeSound(playComplete);
  vibrate(60);

  const ms = Math.round(elapsed.value);
  // 本地先记录保证界面即时反馈，同时上报服务器（排行榜与个人档案）
  const localBest = saveRecord(props.level, ms, props.ruleset);
  isNewBest.value = localBest;
  best.value = bestTime(props.level, props.ruleset);

  void submitRecord({ level: props.level, ms, errors: errors.value, seed: currentSeed.value, ruleset: props.ruleset }).then((res) => {
    if (res) {
      isNewBest.value = res.isNewBest;
      best.value = res.best;
    }
  });

  // 通关后推进进度（只前进，不回退）
  if (props.level > loadProgress(props.ruleset)) {
    saveProgress(props.level, props.ruleset);
  }
}

function fail() {
  accumulated = elapsed.value;
  stopTimer();
  failed.value = true;
  cancelTapSound();
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
  cancelTapSound();
  target.value = 1;
  errors.value = 0;
  elapsed.value = 0;
  accumulated = 0;
  started.value = false;
  paused.value = false;
  finished.value = false;
  failed.value = false;
  wrongId.value = null;
}

/** 重新开始：方案不变，只清零进度 */
function restart() {
  resetState();
}

/** 重新排版：换一套排布与配色（新种子），并同步到地址栏便于分享 */
function refreshLayout() {
  currentSeed.value = randomSeed();
  spec.value = buildLevel(props.level, currentSeed.value, props.ruleset);
  resetState();
  emit("seed-change", currentSeed.value);
}

async function share() {
  const url = props.shareUrl(props.level, currentSeed.value, props.ruleset);
  const distractorText = spec.value.distractorCount > 0 ? ` + ${spec.value.distractorCount} 个字母干扰` : "";
  const text = `我在「舒尔特训练」第 ${props.level} 关（${shapeLabel.value}，${total.value} 个数字${distractorText}）等你挑战：${url}`;
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
    const unlock = props.ruleset === "v3" ? layoutUnlockAfter(props.level) : null;
    if (unlock && !seenLayoutUnlocks().has(unlock.level)) {
      unlockOpen.value = true;
      return;
    }
    emit("navigate", props.level + 1, props.ruleset);
  }
}

function playUnlockedLayout() {
  const unlock = layoutUnlockAfter(props.level);
  if (!unlock) return;
  markLayoutUnlockSeen(unlock.level);
  emit("navigate", unlock.level, props.ruleset);
}

function deferUnlockedLayout() {
  const unlock = layoutUnlockAfter(props.level);
  if (unlock) markLayoutUnlockSeen(unlock.level);
  emit("exit");
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === "Escape") {
    if (finished.value || failed.value) return;
    togglePause();
  }
}

onMounted(() => {
  // 进入对局页即开始加载音效资源，点击开始时只负责解锁与播放。
  if (settings.sound) preloadAudio();
  window.addEventListener("keydown", onKeydown);
});
onBeforeUnmount(() => {
  stopTimer();
  cancelTapSound();
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
          <small>
            {{ levelBand(level) }} · {{ total }} 个数字
            <template v-if="spec.distractorCount"> + {{ spec.distractorCount }} 干扰</template>
            <template v-if="timeLimit !== null"> · 限时</template>
          </small>
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
      <div class="board-shell">
        <BoardRenderer
          :spec="spec"
          :active="started"
          :paused="paused"
          :wrong-id="wrongId"
          @select="tapCell"
        />
        <div v-if="ready" class="ready-mask">
          <p class="ready-title">第 {{ level }} 关 · {{ shapeLabel }}</p>
          <p v-if="timeLimit !== null" class="ready-limit"><Timer :size="13" />限时 {{ formatCountdown(timeLimit) }}</p>
          <button type="button" class="start-btn" @click="begin"><Play :size="18" fill="currentColor" />开始</button>
          <p class="ready-hint">
            按 1 到 {{ total }} 依次点按
            <template v-if="spec.distractorCount">，忽略 {{ spec.distractorCount }} 个字母</template>
          </p>
        </div>
        <div v-if="paused" class="pause-mask">
          <p>已暂停</p>
          <button type="button" class="resume-btn" @click="togglePause"><Play :size="16" fill="currentColor" />继续</button>
        </div>
      </div>
    </section>

    <CompleteDialog
      v-if="finished && !unlockOpen"
      :level="level"
      :shape="spec.shape"
      :ruleset="ruleset"
      :target-count="spec.targetCount"
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

    <LayoutUnlockDialog
      v-if="unlockOpen && layoutUnlockAfter(level)"
      :unlock="layoutUnlockAfter(level)!"
      @play="playUnlockedLayout"
      @later="deferUnlockedLayout"
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
