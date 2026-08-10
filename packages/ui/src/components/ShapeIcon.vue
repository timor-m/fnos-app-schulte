<script setup lang="ts">
import {
  CircleDot,
  Diamond,
  Fan,
  Flower2,
  Grid3x3,
  Hexagon,
  Orbit,
  RectangleHorizontal,
  Route,
  Shell,
  Sparkles,
  Triangle,
  Waves
} from "lucide-vue-next";
import type { BoardShape } from "../game/levels";

withDefaults(
  defineProps<{
    shape: BoardShape;
    size?: number;
  }>(),
  { size: 16 }
);

const icons: Record<BoardShape, typeof Grid3x3> = {
  grid: Grid3x3,
  hex: Hexagon,
  radial: CircleDot,
  spiral: Shell,
  scatter: Sparkles,
  triangle: Triangle,
  wave: Waves,
  fan: Fan,
  orbit: Orbit,
  diamond: Diamond,
  petal: Flower2,
  track: RectangleHorizontal,
  snake: Route
};
</script>

<template>
  <component :is="icons[shape]" :size="size" aria-hidden="true" />
</template>
