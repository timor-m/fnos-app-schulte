<script setup lang="ts">
import { onMounted, provide, reactive, ref } from "vue";
import { CircleUserRound, Gamepad2, Settings, Trophy } from "lucide-vue-next";
import HomeView from "./views/HomeView.vue";
import GameView from "./views/GameView.vue";
import LeaderboardView from "./views/LeaderboardView.vue";
import ProfileView from "./views/ProfileView.vue";
import SettingsDialog from "./components/SettingsDialog.vue";
import { clampLevel, canonicalSeed, parseSeed } from "./game/levels";
import { loadSettings, saveSettings, type GameSettings, DEFAULT_SETTINGS } from "./game/storage";
import appIcon from "./assets/app-icon.png";

type SessionResponse = {
  ok: boolean;
  data: {
    authenticated: boolean;
    uid: string | null;
    username: string | null;
    isAdmin: boolean;
  };
};

type GameTarget = { level: number; seed: number | null };
type View = "home" | "leaderboard" | "me" | "game";

const view = ref<View>("home");
const target = ref<GameTarget>({ level: 1, seed: null });
const username = ref<string | null>(null);
const settingsOpen = ref(false);

const settings = reactive<GameSettings>({ ...DEFAULT_SETTINGS, ...loadSettings() });

function updateSettings(patch: Partial<GameSettings>) {
  Object.assign(settings, patch);
  saveSettings({ ...settings });
}

provide("settings", settings);

function openGame(level: number, seed: number | null = null) {
  target.value = { level: clampLevel(level), seed };
  view.value = "game";
  syncUrl(target.value);
}

function goHome() {
  view.value = "home";
  const url = new URL(window.location.href);
  if (url.search) {
    url.search = "";
    window.history.replaceState(null, "", url.toString());
  }
}

function goTab(tab: Exclude<View, "game">) {
  view.value = tab;
  if (tab === "home") {
    goHome();
  }
}

function syncUrl(t: GameTarget) {
  const url = new URL(window.location.href);
  url.search = "";
  url.searchParams.set("level", String(t.level));
  // 默认方案不携带种子，保持链接干净；换版后的自定义方案带上种子
  if (t.seed !== null && t.seed !== canonicalSeed(t.level)) {
    url.searchParams.set("s", String(t.seed));
  }
  window.history.replaceState(null, "", url.toString());
}

function shareUrl(level: number, seed: number | null): string {
  const url = new URL(window.location.href);
  url.search = "";
  url.searchParams.set("level", String(level));
  if (seed !== null && seed !== canonicalSeed(level)) {
    url.searchParams.set("s", String(seed));
  }
  return url.toString();
}

onMounted(async () => {
  // 分享链接直达：?level=12 或 ?level=12&s=12345
  const params = new URLSearchParams(window.location.search);
  const levelParam = Number(params.get("level"));
  if (Number.isFinite(levelParam) && levelParam >= 1) {
    target.value = { level: clampLevel(levelParam), seed: parseSeed(params.get("s")) };
    view.value = "game";
  }

  try {
    const apiBase = new URL("./api/", window.location.href);
    const res = await fetch(new URL("session", apiBase));
    if (res.ok) {
      const json = (await res.json()) as SessionResponse;
      username.value = json.data.username;
    }
  } catch {
    // 本地开发未经过网关时忽略
  }
});
</script>

<template>
  <div class="app-shell">
    <header class="topbar">
      <button class="brand" type="button" @click="goHome">
        <img class="brand-mark" :src="appIcon" alt="舒尔特训练" width="34" height="34" />
        <span class="brand-text">
          <strong>舒尔特训练</strong>
        </span>
      </button>
      <div class="topbar-right">
        <nav class="main-nav" aria-label="主导航">
          <button type="button" :class="{ active: view === 'home' || view === 'game' }" @click="goTab('home')">
            <Gamepad2 :size="16" /><span>游戏</span>
          </button>
          <button type="button" :class="{ active: view === 'leaderboard' }" @click="goTab('leaderboard')">
            <Trophy :size="16" /><span>排行榜</span>
          </button>
          <button type="button" :class="{ active: view === 'me' }" @click="goTab('me')">
            <CircleUserRound :size="16" /><span>我的</span>
          </button>
        </nav>
        <span v-if="username" class="user-chip" :title="`fnOS 用户：${username}`">{{ username }}</span>
        <button class="icon-btn" type="button" aria-label="设置" title="设置" @click="settingsOpen = true">
          <Settings :size="20" :stroke-width="1.8" />
        </button>
      </div>
    </header>

    <HomeView v-if="view === 'home'" @start="openGame" />
    <LeaderboardView v-else-if="view === 'leaderboard'" @play="openGame" />
    <ProfileView v-else-if="view === 'me'" @play="openGame" />
    <GameView
      v-else
      :key="`${target.level}:${target.seed ?? 'canon'}`"
      :level="target.level"
      :seed="target.seed"
      :share-url="shareUrl"
      @exit="goHome"
      @navigate="openGame"
      @seed-change="(s) => syncUrl({ level: target.level, seed: s })"
    />

    <SettingsDialog
      v-if="settingsOpen"
      :settings="settings"
      @update="updateSettings"
      @close="settingsOpen = false"
    />
  </div>
</template>
