<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from "vue";
import { ArrowLeft, ArrowRight, Check, Copy, Crown, Home, LoaderCircle, RotateCcw, Star, TriangleAlert } from "lucide-vue-next";
import { shapeName, type BoardShape } from "../game/levels";
import { formatElapsed, formatPace } from "../game/format";
import { createResultPoster } from "../game/poster";

const props = defineProps<{
  level: number;
  shape: BoardShape;
  targetCount: number;
  timeMs: number;
  errors: number;
  best: number | null;
  isNewBest: boolean;
  levelBest: number | null;
  isLevelBest: boolean;
  hasNext: boolean;
  returnToPrevious: boolean;
}>();

const emit = defineEmits<{
  (e: "next"): void;
  (e: "replay"): void;
  (e: "home"): void;
}>();

const shareState = ref<"idle" | "working" | "copied" | "failed">("idle");
let shareResetTimer: number | null = null;

onBeforeUnmount(() => {
  if (shareResetTimer !== null) window.clearTimeout(shareResetTimer);
});
// 星级评定：按平均每格用时，1.0s/格以内三星，1.8s/格以内两星
const stars = computed(() => {
  const pace = props.timeMs / props.targetCount / 1000;
  if (pace <= 1.0) return 3;
  if (pace <= 1.8) return 2;
  return 1;
});

const starLabel = computed(() => ["继续加油", "表现出色", "眼疾手快"][stars.value - 1]);

const STAR_SHARDS = [
  { x: -28, y: -18, rotation: -36 },
  { x: -34, y: 8, rotation: -70 },
  { x: -16, y: 26, rotation: -18 },
  { x: 18, y: -27, rotation: 28 },
  { x: 32, y: -5, rotation: 68 },
  { x: 24, y: 23, rotation: 42 }
];

const CONFETTI_COLORS = ["#2f9e6e", "#eeb54a", "#e8834f", "#6d8fc4", "#c46a8a"];
const confetti = Array.from({ length: 26 }, (_, i) => {
  const direction = i % 2 === 0 ? -1 : 1;
  const spread = 54 + ((i * 47) % 142);
  const burstX = direction * spread;
  const burstY = -(52 + ((i * 37) % 104));
  const fallX = burstX + direction * (-24 + ((i * 29) % 74));
  const middleRotation = direction * (150 + ((i * 71) % 260));
  return {
    originX: 50 + ((i * 17) % 9) - 4,
    burstX,
    burstY,
    driftX: burstX * 0.92,
    driftY: burstY * -0.08,
    fallX,
    fallY: 350 + ((i * 31) % 132),
    delay: ((i * 7) % 13) * 0.035,
    duration: 1.8 + ((i * 11) % 9) * 0.11,
    startRotation: (i * 53) % 180,
    middleRotation,
    flutterRotation: middleRotation * 1.45,
    endRotation: direction * (520 + ((i * 97) % 540)),
    scale: 0.78 + ((i * 19) % 7) * 0.055,
    color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
    round: i % 5 === 0,
    strip: i % 5 === 2
  };
});

async function shareResult() {
  if (shareState.value === "working") return;
  shareState.value = "working";
  if (shareResetTimer !== null) window.clearTimeout(shareResetTimer);

  try {
    if (!navigator.clipboard?.write || typeof ClipboardItem === "undefined") {
      throw new Error("Image clipboard is unavailable");
    }
    const poster = createResultPoster({
      level: props.level,
      shapeName: shapeName(props.shape),
      targetCount: props.targetCount,
      time: formatElapsed(props.timeMs),
      errors: props.errors,
      pace: formatPace(props.timeMs, props.targetCount),
      best: props.best !== null ? formatElapsed(props.best) : "--",
      stars: stars.value,
      starLabel: starLabel.value,
      isNewBest: props.isNewBest
    });
    await navigator.clipboard.write([new ClipboardItem({ "image/png": poster })]);
    shareState.value = "copied";
  } catch {
    shareState.value = "failed";
  }
  shareResetTimer = window.setTimeout(() => (shareState.value = "idle"), 2400);
}
</script>

<template>
  <div class="dialog-backdrop" role="dialog" aria-modal="true" aria-label="通关成绩">
    <div class="dialog dialog-win">
      <span
        v-for="(piece, i) in confetti"
        :key="i"
        class="confetti"
        :class="{ round: piece.round, strip: piece.strip }"
        :style="{
          left: `${piece.originX}%`,
          '--confetti-burst-x': `${piece.burstX}px`,
          '--confetti-burst-y': `${piece.burstY}px`,
          '--confetti-drift-x': `${piece.driftX}px`,
          '--confetti-drift-y': `${piece.driftY}px`,
          '--confetti-fall-x': `${piece.fallX}px`,
          '--confetti-fall-y': `${piece.fallY}px`,
          '--confetti-delay': `${piece.delay}s`,
          '--confetti-duration': `${piece.duration}s`,
          '--confetti-start-rotation': `${piece.startRotation}deg`,
          '--confetti-middle-rotation': `${piece.middleRotation}deg`,
          '--confetti-flutter-rotation': `${piece.flutterRotation}deg`,
          '--confetti-end-rotation': `${piece.endRotation}deg`,
          '--confetti-scale': piece.scale,
          background: piece.color
        }"
        aria-hidden="true"
      ></span>

      <aside class="win-leader-record" :class="{ crowned: isLevelBest }" aria-live="polite">
        <Crown :size="15" :stroke-width="2.2" aria-hidden="true" />
        <span>{{ isLevelBest ? "最佳认证" : "单关榜最佳" }}</span>
        <strong class="mono">{{ levelBest !== null ? formatElapsed(levelBest) : "--" }}</strong>
      </aside>

      <p class="dialog-eyebrow">{{ isNewBest ? "新纪录" : "闯关成功" }}</p>
      <h2>第 {{ level }} 关 · {{ shapeName(shape) }}</h2>

      <div class="stars" :aria-label="`${stars} 星评价`">
        <span
          v-for="n in 3"
          :key="n"
          class="star-stage"
          :class="{ earned: n <= stars, featured: n === 2 }"
        >
          <Star class="star-base" fill="currentColor" :stroke-width="0" />
          <span
            v-if="n <= stars"
            class="star-fill"
            :style="{ '--star-fill-delay': `${0.18 + n * 0.34}s` }"
            aria-hidden="true"
          >
            <Star class="star-color" fill="currentColor" :stroke-width="0" />
          </span>
          <span
            v-for="(shard, shardIndex) in n <= stars ? STAR_SHARDS : []"
            :key="shardIndex"
            class="star-shard"
            :style="{
              '--star-shard-x': `${shard.x}px`,
              '--star-shard-y': `${shard.y}px`,
              '--star-shard-rotation': `${shard.rotation}deg`,
              '--star-shard-delay': `${0.62 + n * 0.34 + shardIndex * 0.025}s`
            }"
            aria-hidden="true"
          ></span>
        </span>
      </div>
      <p class="star-label">{{ starLabel }}</p>

      <p class="win-time mono">{{ formatElapsed(timeMs) }}</p>

      <dl class="result-grid three">
        <div>
          <dt>失误</dt>
          <dd class="mono">{{ errors }} 次</dd>
        </div>
        <div>
          <dt>速度</dt>
          <dd class="mono">{{ formatPace(timeMs, targetCount) }}</dd>
        </div>
        <div>
          <dt>历史最佳</dt>
          <dd class="mono">{{ best !== null ? formatElapsed(best) : "--" }}</dd>
        </div>
      </dl>

      <div class="dialog-actions" :class="hasNext ? 'actions-4' : 'actions-3'">
        <button type="button" class="btn" @click="emit('replay')"><RotateCcw :size="16" />再玩一次</button>
        <button v-if="hasNext" type="button" class="btn primary" @click="emit('next')"><ArrowRight :size="16" />下一关</button>
        <button type="button" class="btn" :disabled="shareState === 'working'" @click="shareResult">
          <LoaderCircle v-if="shareState === 'working'" :size="16" />
          <Check v-else-if="shareState === 'copied'" :size="16" />
          <TriangleAlert v-else-if="shareState === 'failed'" :size="16" />
          <Copy v-else :size="16" />
          {{ shareState === "working" ? "生成中" : shareState === "copied" ? "已复制海报" : shareState === "failed" ? "复制失败" : "复制海报" }}
        </button>
        <button type="button" class="btn" @click="emit('home')">
          <ArrowLeft v-if="returnToPrevious" :size="16" />
          <Home v-else :size="16" />
          {{ returnToPrevious ? "返回" : "返回主页" }}
        </button>
      </div>
    </div>
  </div>
</template>
