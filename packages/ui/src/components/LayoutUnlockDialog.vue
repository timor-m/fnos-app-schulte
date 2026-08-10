<script setup lang="ts">
import { ArrowRight, Home, Sparkles } from "lucide-vue-next";
import BoardRenderer from "./BoardRenderer.vue";
import { buildLevel, canonicalSeed, type LayoutUnlock } from "../game/levels";

const props = defineProps<{ unlock: LayoutUnlock }>();
const emit = defineEmits<{
  (event: "play"): void;
  (event: "later"): void;
}>();

const previewSpec = buildLevel(props.unlock.level, canonicalSeed(props.unlock.level));
</script>

<template>
  <div class="dialog-backdrop" role="dialog" aria-modal="true" aria-label="新布局解锁">
    <div class="dialog unlock-dialog">
      <p class="dialog-eyebrow unlock"><Sparkles :size="15" />新布局解锁</p>
      <h2>{{ unlock.name }}</h2>
      <div class="unlock-preview" aria-hidden="true">
        <BoardRenderer :spec="previewSpec" preview />
      </div>
      <p class="unlock-copy">第 {{ unlock.level }} 关开始加入{{ unlock.name }}布局，之后会与已解锁布局穿插出现。</p>
      <div class="dialog-actions actions-2">
        <button type="button" class="btn primary" @click="emit('play')">
          <ArrowRight :size="16" />体验新布局
        </button>
        <button type="button" class="btn" @click="emit('later')"><Home :size="16" />稍后</button>
      </div>
    </div>
  </div>
</template>
