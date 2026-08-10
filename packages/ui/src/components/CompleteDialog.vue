<script setup lang="ts">
import { computed, ref } from "vue";
import { ArrowRight, Check, Home, RotateCcw, Share2, Star } from "lucide-vue-next";
import { shapeName, type BoardShape, type Ruleset } from "../game/levels";
import { formatElapsed, formatPace } from "../game/format";

const props = defineProps<{
  level: number;
  shape: BoardShape;
  ruleset: Ruleset;
  targetCount: number;
  seed: number;
  timeMs: number;
  errors: number;
  best: number | null;
  isNewBest: boolean;
  hasNext: boolean;
  shareUrl: (level: number, seed: number | null, ruleset: Ruleset) => string;
}>();

const emit = defineEmits<{
  (e: "next"): void;
  (e: "replay"): void;
  (e: "home"): void;
}>();

const copied = ref(false);
// 星级评定：按平均每格用时，1.0s/格以内三星，1.8s/格以内两星
const stars = computed(() => {
  const pace = props.timeMs / props.targetCount / 1000;
  if (pace <= 1.0) return 3;
  if (pace <= 1.8) return 2;
  return 1;
});

const starLabel = computed(() => ["继续加油", "表现出色", "眼疾手快"][stars.value - 1]);

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
  const url = props.shareUrl(props.level, props.seed, props.ruleset);
  const text = `我在「舒尔特训练」第 ${props.level} 关（${shapeName(props.shape)}）用时 ${formatElapsed(props.timeMs)}，来挑战同一局面：${url}`;
  try {
    await navigator.clipboard.writeText(text);
    copied.value = true;
    window.setTimeout(() => (copied.value = false), 2000);
  } catch {
    window.prompt("复制分享链接", url);
  }
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

      <p class="dialog-eyebrow">{{ isNewBest ? "新纪录" : "闯关成功" }}</p>
      <h2>第 {{ level }} 关 · {{ shapeName(shape) }}</h2>

      <div class="stars" :aria-label="`${stars} 星评价`">
        <Star
          v-for="n in 3"
          :key="n"
          class="star"
          :class="{ lit: n <= stars }"
          :style="{ animationDelay: `${0.25 + n * 0.16}s` }"
          :fill="n <= stars ? 'currentColor' : 'currentColor'"
          :stroke-width="0"
        />
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
        <button v-if="hasNext" type="button" class="btn primary" @click="emit('next')"><ArrowRight :size="16" />下一关</button>
        <button type="button" class="btn" @click="emit('replay')"><RotateCcw :size="16" />再玩一次</button>
        <button type="button" class="btn" @click="shareResult">
          <Check v-if="copied" :size="16" /><Share2 v-else :size="16" />{{ copied ? "已复制" : "分享成绩" }}
        </button>
        <button type="button" class="btn" @click="emit('home')"><Home :size="16" />返回主页</button>
      </div>
    </div>
  </div>
</template>
