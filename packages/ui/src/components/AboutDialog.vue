<script setup lang="ts">
import { nextTick, onMounted, ref } from "vue";
import { ExternalLink, Github, X } from "lucide-vue-next";
import packageMeta from "../../../../package.json";
import templateConfig from "../../../../template.config.json";
import appIcon from "../assets/app-icon.png";

const emit = defineEmits<{
  (e: "close"): void;
}>();

const closeButton = ref<HTMLButtonElement | null>(null);

onMounted(async () => {
  await nextTick();
  closeButton.value?.focus();
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
    </div>
  </div>
</template>
