<script setup lang="ts">
import { onMounted, ref } from "vue";
import { TriangleAlert } from "lucide-vue-next";

withDefaults(
  defineProps<{
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    danger?: boolean;
  }>(),
  {
    confirmLabel: "确定",
    cancelLabel: "取消",
    danger: false
  }
);

const emit = defineEmits<{
  (event: "confirm"): void;
  (event: "cancel"): void;
}>();

const dialogPanel = ref<HTMLElement | null>(null);
const cancelButton = ref<HTMLButtonElement | null>(null);

function handleKeydown(event: KeyboardEvent) {
  if (event.key === "Escape") {
    event.preventDefault();
    event.stopPropagation();
    emit("cancel");
    return;
  }
  if (event.key !== "Tab") return;
  const buttons = [...(dialogPanel.value?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)") ?? [])];
  if (buttons.length === 0) return;
  const first = buttons[0];
  const last = buttons[buttons.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

onMounted(() => cancelButton.value?.focus());
</script>

<template>
  <div
    class="dialog-backdrop modal-front"
    role="alertdialog"
    aria-modal="true"
    aria-labelledby="confirm-dialog-title"
    aria-describedby="confirm-dialog-message"
    @click.self="emit('cancel')"
    @keydown="handleKeydown"
  >
    <div ref="dialogPanel" class="dialog confirm-dialog">
      <span class="confirm-icon" :class="{ danger }" aria-hidden="true">
        <TriangleAlert :size="22" />
      </span>
      <h2 id="confirm-dialog-title">{{ title }}</h2>
      <p id="confirm-dialog-message" class="confirm-message">{{ message }}</p>
      <div class="dialog-actions actions-2">
        <button ref="cancelButton" type="button" class="btn" @click="emit('cancel')">{{ cancelLabel }}</button>
        <button
          type="button"
          class="btn"
          :class="danger ? 'danger solid' : 'primary'"
          @click="emit('confirm')"
        >
          {{ confirmLabel }}
        </button>
      </div>
    </div>
  </div>
</template>
