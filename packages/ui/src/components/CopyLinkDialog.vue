<script setup lang="ts">
import { nextTick, onMounted, ref } from "vue";
import { Check, Copy, X } from "lucide-vue-next";

const props = defineProps<{ url: string }>();
const emit = defineEmits<{
  (event: "close"): void;
}>();

const dialogPanel = ref<HTMLElement | null>(null);
const linkInput = ref<HTMLInputElement | null>(null);
const copied = ref(false);

function selectLink() {
  linkInput.value?.focus();
  linkInput.value?.select();
}

async function copyLink() {
  try {
    await navigator.clipboard.writeText(props.url);
    copied.value = true;
  } catch {
    selectLink();
  }
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key === "Escape") {
    event.preventDefault();
    event.stopPropagation();
    emit("close");
    return;
  }
  if (event.key !== "Tab") return;
  const controls = [
    ...(dialogPanel.value?.querySelectorAll<HTMLElement>("button:not(:disabled), input:not(:disabled)") ?? [])
  ];
  if (controls.length === 0) return;
  const first = controls[0];
  const last = controls[controls.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

onMounted(async () => {
  await nextTick();
  selectLink();
});
</script>

<template>
  <div
    class="dialog-backdrop modal-front"
    role="dialog"
    aria-modal="true"
    aria-labelledby="copy-link-title"
    @click.self="emit('close')"
    @keydown="handleKeydown"
  >
    <div ref="dialogPanel" class="dialog copy-link-dialog">
      <div class="dialog-head">
        <h2 id="copy-link-title">分享链接</h2>
        <button class="icon-btn" type="button" aria-label="关闭" @click="emit('close')">
          <X :size="20" />
        </button>
      </div>
      <input
        ref="linkInput"
        class="copy-link-input mono"
        type="text"
        readonly
        :value="url"
        aria-label="分享链接"
        @focus="selectLink"
      />
      <div class="dialog-actions">
        <button type="button" class="btn primary" @click="copyLink">
          <Check v-if="copied" :size="16" />
          <Copy v-else :size="16" />
          {{ copied ? "已复制" : "复制链接" }}
        </button>
      </div>
    </div>
  </div>
</template>
