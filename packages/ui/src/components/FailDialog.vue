<script setup lang="ts">
import { Home, RotateCcw, Shuffle, TimerOff } from "lucide-vue-next";
import { formatElapsed } from "../game/format";

const props = defineProps<{
  level: number;
  reached: number;
  total: number;
  timeMs: number;
  best: number | null;
}>();

const emit = defineEmits<{
  (e: "retry"): void;
  (e: "reshuffle"): void;
  (e: "home"): void;
}>();
</script>

<template>
  <div class="dialog-backdrop" role="dialog" aria-modal="true" aria-label="挑战失败">
    <div class="dialog dialog-fail">
      <p class="dialog-eyebrow fail"><TimerOff :size="15" />时间到</p>
      <h2>第 {{ level }} 关 · 差一点点</h2>

      <div class="fail-progress">
        <div class="fail-progress-track">
          <div class="fail-progress-fill" :style="{ width: `${(reached / total) * 100}%` }"></div>
        </div>
        <p>已点到 <strong>{{ reached }}</strong> / {{ total }}</p>
      </div>
      <p class="fail-cheer">{{ reached > 0 ? `再点 ${total - reached} 个就成功啦！` : "热热身，再来一次！" }}</p>

      <dl class="result-grid">
        <div>
          <dt>用时</dt>
          <dd class="mono">{{ formatElapsed(timeMs) }}</dd>
        </div>
        <div>
          <dt>历史最佳</dt>
          <dd class="mono">{{ best !== null ? formatElapsed(best) : "--" }}</dd>
        </div>
      </dl>

      <div class="dialog-actions actions-3">
        <button type="button" class="btn primary" @click="emit('retry')"><RotateCcw :size="16" />重新挑战</button>
        <button type="button" class="btn" @click="emit('reshuffle')"><Shuffle :size="16" />换一套排版</button>
        <button type="button" class="btn" @click="emit('home')"><Home :size="16" />返回主页</button>
      </div>
    </div>
  </div>
</template>
