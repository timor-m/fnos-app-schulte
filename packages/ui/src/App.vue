<script setup lang="ts">
import { onMounted, provide, reactive, ref } from "vue";
import { CircleUserRound, Gamepad2, Settings, Trophy } from "lucide-vue-next";
import HomeView from "./views/HomeView.vue";
import GameView from "./views/GameView.vue";
import LeaderboardView from "./views/LeaderboardView.vue";
import ProfileView from "./views/ProfileView.vue";
import SettingsDialog from "./components/SettingsDialog.vue";
import { clampLevel, canonicalSeed, parseSeed, type Ruleset } from "./game/levels";
import { loadSettings, saveSettings, type GameSettings, DEFAULT_SETTINGS } from "./game/storage";
import { fetchSession } from "./game/api";
import { preloadAudio } from "./game/sound";
import appIcon from "./assets/app-icon.png";

type GameTarget = { level: number; seed: number | null; ruleset: Ruleset };
type View = "home" | "leaderboard" | "me" | "game";

const view = ref<View>("home");
const target = ref<GameTarget>({ level: 1, seed: null, ruleset: "v3" });
const username = ref<string | null>(null);
const settingsOpen = ref(false);

const settings = reactive<GameSettings>({ ...DEFAULT_SETTINGS, ...loadSettings() });

function updateSettings(patch: Partial<GameSettings>) {
  Object.assign(settings, patch);
  saveSettings({ ...settings });
  if (typeof patch.sound === "boolean") preloadAudio();
}

provide("settings", settings);

function openGame(level: number, ruleset: Ruleset = "v3", seed: number | null = null) {
  target.value = { level: clampLevel(level), seed, ruleset };
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
  if (t.ruleset === "v3") url.searchParams.set("r", "3");
  // 默认方案不携带种子，保持链接干净；换版后的自定义方案带上种子
  if (t.seed !== null && t.seed !== canonicalSeed(t.level, t.ruleset)) {
    url.searchParams.set("s", String(t.seed));
  }
  window.history.replaceState(null, "", url.toString());
}

function shareUrl(level: number, seed: number | null, ruleset: Ruleset): string {
  const url = new URL(window.location.href);
  url.search = "";
  url.searchParams.set("level", String(level));
  if (ruleset === "v3") url.searchParams.set("r", "3");
  if (seed !== null && seed !== canonicalSeed(level, ruleset)) {
    url.searchParams.set("s", String(seed));
  }
  return url.toString();
}

onMounted(async () => {
  // 分享链接直达：?level=12 或 ?level=12&s=12345
  const params = new URLSearchParams(window.location.search);
  const levelParam = Number(params.get("level"));
  if (Number.isFinite(levelParam) && levelParam >= 1) {
    const ruleset: Ruleset = params.get("r") === "3" ? "v3" : "v2";
    target.value = { level: clampLevel(levelParam), seed: parseSeed(params.get("s")), ruleset };
    view.value = "game";
  }

  const session = await fetchSession();
  username.value = session?.username ?? null;
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
      :key="`${target.ruleset}:${target.level}:${target.seed ?? 'canon'}`"
      :level="target.level"
      :seed="target.seed"
      :ruleset="target.ruleset"
      :share-url="shareUrl"
      @exit="goHome"
      @navigate="openGame"
      @seed-change="(s) => syncUrl({ level: target.level, seed: s, ruleset: target.ruleset })"
    />

    <SettingsDialog
      v-if="settingsOpen"
      :settings="settings"
      @update="updateSettings"
      @close="settingsOpen = false"
    />
  </div>
</template>
