<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref } from "vue";
import { Check, Copy, ExternalLink, Github, MessageCircle, X } from "lucide-vue-next";
import packageMeta from "../../../../package.json";
import templateConfig from "../../../../template.config.json";
import appIcon from "../assets/app-icon.png";

const emit = defineEmits<{
  (e: "close"): void;
}>();

const closeButton = ref<HTMLButtonElement | null>(null);

const QQ_GROUP = "1016244594";
const qqCopied = ref(false);
let qqCopiedTimer: number | null = null;

async function copyQqGroup() {
  let ok = false;
  try {
    await navigator.clipboard.writeText(QQ_GROUP);
    ok = true;
  } catch {
    // 旧 WebView 无 Clipboard API 时走 textarea 兜底
    const textarea = document.createElement("textarea");
    textarea.value = QQ_GROUP;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    try {
      ok = document.execCommand("copy");
    } catch {
      ok = false;
    }
    textarea.remove();
  }
  if (!ok) return;
  qqCopied.value = true;
  if (qqCopiedTimer !== null) window.clearTimeout(qqCopiedTimer);
  qqCopiedTimer = window.setTimeout(() => (qqCopied.value = false), 2000);
}

onMounted(async () => {
  await nextTick();
  closeButton.value?.focus();
});

onBeforeUnmount(() => {
  if (qqCopiedTimer !== null) window.clearTimeout(qqCopiedTimer);
});
</script>

<template>
  <div
    class="dialog-backdrop"
    role="dialog"
    aria-modal="true"
    aria-label="关于"
    @click.self="emit('close')"
    @keydown.esc.stop.prevent="emit('close')"
  >
    <div class="dialog about-dialog">
      <div class="dialog-head">
        <h2>关于</h2>
        <button ref="closeButton" class="icon-btn" type="button" aria-label="关闭" @click="emit('close')">
          <X :size="20" />
        </button>
      </div>

      <div class="about-brand">
        <img :src="appIcon" :alt="templateConfig.appTitle" width="64" height="64" />
        <div>
          <strong>{{ templateConfig.appTitle }}</strong>
          <span>v{{ packageMeta.version }}</span>
        </div>
      </div>

      <dl class="about-meta">
        <div>
          <dt>应用 ID</dt>
          <dd>{{ templateConfig.appName }}</dd>
        </div>
        <div>
          <dt>版本</dt>
          <dd>{{ packageMeta.version }}</dd>
        </div>
        <div>
          <dt>开发者</dt>
          <dd>{{ templateConfig.maintainer }}</dd>
        </div>
      </dl>

      <a
        class="about-github"
        :href="templateConfig.maintainerUrl"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="在 GitHub 查看项目"
      >
        <Github :size="18" />
        <span>GitHub</span>
        <ExternalLink :size="15" />
      </a>

      <button
        class="about-github about-qq"
        type="button"
        :aria-label="`复制 QQ 交流群号 ${QQ_GROUP}`"
        @click="copyQqGroup"
      >
        <MessageCircle :size="18" />
        <span>QQ 交流群：{{ QQ_GROUP }}</span>
        <Check v-if="qqCopied" :size="15" class="about-qq-copied" />
        <Copy v-else :size="15" />
      </button>
    </div>
  </div>
</template>
