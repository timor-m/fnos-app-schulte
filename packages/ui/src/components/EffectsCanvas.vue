<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from "vue";
import { TapEffects } from "../game/effects";

const canvas = ref<HTMLCanvasElement | null>(null);
let effects: TapEffects | null = null;

onMounted(() => {
  if (canvas.value) effects = new TapEffects(canvas.value);
});

onBeforeUnmount(() => {
  effects?.destroy();
  effects = null;
});

defineExpose({
  burst: (clientX: number, clientY: number, color: string, label: string) =>
    effects?.burst(clientX, clientY, color, label),
  wrong: (clientX: number, clientY: number) => effects?.wrong(clientX, clientY),
  combo: (clientX: number, clientY: number, text: string) => effects?.combo(clientX, clientY, text)
});
</script>

<template>
  <canvas ref="canvas" class="effects-canvas" aria-hidden="true"></canvas>
</template>
