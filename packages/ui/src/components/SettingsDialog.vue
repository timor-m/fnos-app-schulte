<script setup lang="ts">
import { Trash2, X } from "lucide-vue-next";
import { clearAllData, type GameSettings } from "../game/storage";

const props = defineProps<{
  settings: GameSettings;
}>();

const emit = defineEmits<{
  (e: "update", patch: Partial<GameSettings>): void;
  (e: "close"): void;
}>();

function confirmClear() {
  if (window.confirm("确定要清除全部关卡成绩与进度吗？此操作不可恢复。")) {
    clearAllData();
    window.location.reload();
  }
}
</script>

<template>
  <div class="dialog-backdrop" role="dialog" aria-modal="true" aria-label="设置" @click.self="emit('close')">
    <div class="dialog">
      <div class="dialog-head">
        <h2>设置</h2>
        <button class="icon-btn" type="button" aria-label="关闭" @click="emit('close')">
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
          <strong>清除全部数据</strong>
          <p>删除本机保存的所有成绩与进度</p>
        </div>
        <button type="button" class="btn danger" @click="confirmClear"><Trash2 :size="15" />清除</button>
      </div>
    </div>
  </div>
</template>
