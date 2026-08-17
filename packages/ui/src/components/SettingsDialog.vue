<script setup lang="ts">
import { nextTick, onMounted, ref, watch } from "vue";
import { ChevronRight, Info, Trash2, X } from "lucide-vue-next";
import type { GameSettings } from "../game/storage";

const props = defineProps<{
  settings: GameSettings;
  inactive: boolean;
}>();

const emit = defineEmits<{
  (e: "update", patch: Partial<GameSettings>): void;
  (e: "about"): void;
  (e: "clear"): void;
  (e: "close"): void;
}>();

const closeButton = ref<HTMLButtonElement | null>(null);
const aboutButton = ref<HTMLButtonElement | null>(null);
const clearButton = ref<HTMLButtonElement | null>(null);
let lastTrigger: HTMLButtonElement | null = null;

onMounted(() => closeButton.value?.focus());

watch(
  () => props.inactive,
  async (inactive) => {
    if (inactive) return;
    await nextTick();
    lastTrigger?.focus();
  }
);

function requestClear() {
  lastTrigger = clearButton.value;
  emit("clear");
}

function requestAbout() {
  lastTrigger = aboutButton.value;
  emit("about");
}
</script>

<template>
  <div
    class="dialog-backdrop"
    :class="{ inactive: props.inactive }"
    role="dialog"
    :aria-modal="props.inactive ? undefined : 'true'"
    :aria-hidden="props.inactive || undefined"
    :inert="props.inactive"
    aria-label="设置"
    @click.self="emit('close')"
    @keydown.esc.stop.prevent="emit('close')"
  >
    <div class="dialog">
      <div class="dialog-head">
        <h2>设置</h2>
        <button ref="closeButton" class="icon-btn" type="button" aria-label="关闭" @click="emit('close')">
          <X :size="20" />
        </button>
      </div>

      <div class="setting-row">
        <div>
          <strong>音效</strong>
          <p>点按与通关时播放提示音</p>
        </div>
        <button
          type="button"
          class="switch"
          :class="{ on: props.settings.sound }"
          role="switch"
          :aria-checked="props.settings.sound"
          @click="emit('update', { sound: !props.settings.sound })"
        >
          <span></span>
        </button>
      </div>

      <div class="setting-row">
        <div>
          <strong>震动反馈</strong>
          <p>移动设备上点错时轻微震动</p>
        </div>
        <button
          type="button"
          class="switch"
          :class="{ on: props.settings.haptics }"
          role="switch"
          :aria-checked="props.settings.haptics"
          @click="emit('update', { haptics: !props.settings.haptics })"
        >
          <span></span>
        </button>
      </div>

      <div class="setting-row danger">
        <div>
          <strong>清理缓存</strong>
          <p>清理本机保存的成绩、进度与解锁记录</p>
        </div>
        <button ref="clearButton" type="button" class="btn danger" @click="requestClear"><Trash2 :size="15" />清理</button>
      </div>

      <button ref="aboutButton" type="button" class="setting-row setting-link" @click="requestAbout">
        <span class="setting-link-label">
          <Info :size="19" />
          <span>
            <strong>关于</strong>
            <p>应用信息与开源项目</p>
          </span>
        </span>
        <ChevronRight :size="19" />
      </button>
    </div>
  </div>
</template>
