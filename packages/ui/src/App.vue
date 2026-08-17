<script setup lang="ts">
import { nextTick, onMounted, provide, reactive, ref } from "vue";
import { CircleUserRound, Gamepad2, Settings, Trophy } from "lucide-vue-next";
import HomeView from "./views/HomeView.vue";
import GameView from "./views/GameView.vue";
import LeaderboardView from "./views/LeaderboardView.vue";
import ProfileView from "./views/ProfileView.vue";
import PlayerProfileView from "./views/PlayerProfileView.vue";
import SettingsDialog from "./components/SettingsDialog.vue";
import AboutDialog from "./components/AboutDialog.vue";
import ConfirmDialog from "./components/ConfirmDialog.vue";
import { clampLevel, canonicalSeed, parseSeed, type Ruleset } from "./game/levels";
import { clearAllData, loadSettings, saveSettings, type GameSettings, DEFAULT_SETTINGS } from "./game/storage";
import { fetchSession } from "./game/api";
import { preloadAudio } from "./game/sound";
import appIcon from "./assets/app-icon.png";

type GameLocation = { level: number; seed: number | null; ruleset: Ruleset };
type GameTarget = GameLocation & { autoStart: boolean };
type MainTab = "home" | "leaderboard" | "me";
type View = MainTab | "player" | "game";
type LeaderboardState = { scope: "overall" | "level"; level: number };

const view = ref<View>("home");
const target = ref<GameTarget>({ level: 1, seed: null, ruleset: "v3", autoStart: false });
const username = ref<string | null>(null);
const settingsOpen = ref(false);
const aboutOpen = ref(false);
const clearConfirmOpen = ref(false);
const leaveConfirmOpen = ref(false);
const homeScrollLevel = ref<number | null>(null);
const gameInProgress = ref(false);
const leaderboardState = reactive<LeaderboardState>({ scope: "overall", level: 1 });
const gameReturn = ref<LeaderboardState | null>(null);
const selectedPlayerUid = ref<string | null>(null);
let pendingLeaveAction: (() => void) | null = null;
let leaveReturnFocus: HTMLElement | null = null;

const settings = reactive<GameSettings>({ ...DEFAULT_SETTINGS, ...loadSettings() });

function updateSettings(patch: Partial<GameSettings>) {
  Object.assign(settings, patch);
  saveSettings({ ...settings });
  if (typeof patch.sound === "boolean") preloadAudio();
}

function updateGameActivity(active: boolean) {
  gameInProgress.value = active;
}

function openAbout() {
  aboutOpen.value = true;
}

function openClearConfirm() {
  clearConfirmOpen.value = true;
}

function clearLocalData() {
  clearAllData();
  window.location.reload();
}

provide("settings", settings);

function openGame(
  level: number,
  ruleset: Ruleset = "v3",
  seed: number | null = null,
  autoStart = false
) {
  gameInProgress.value = false;
  target.value = { level: clampLevel(level), seed, ruleset, autoStart };
  view.value = "game";
  syncUrl(target.value);
}

function openDefaultGame(level: number) {
  gameReturn.value = null;
  openGame(level);
}

function openLeaderboardGame(level: number) {
  gameReturn.value = { ...leaderboardState };
  openGame(level);
}

function updateLeaderboardState(scope: LeaderboardState["scope"], level: number) {
  leaderboardState.scope = scope;
  leaderboardState.level = level;
}

function openPlayer(uid: string) {
  selectedPlayerUid.value = uid;
  view.value = "player";
  clearGameUrl();
}

function returnToLeaderboard() {
  view.value = "leaderboard";
  clearGameUrl();
}

function clearGameUrl() {
  const url = new URL(window.location.href);
  if (url.search) {
    url.search = "";
    window.history.replaceState(null, "", url.toString());
  }
}

function performGoHome() {
  gameInProgress.value = false;
  gameReturn.value = null;
  homeScrollLevel.value = null;
  view.value = "home";
  clearGameUrl();
}

function goHome() {
  requestLeaveGame(performGoHome);
}

function returnHomeAtCurrentLevel() {
  gameInProgress.value = false;
  gameReturn.value = null;
  homeScrollLevel.value = target.value.level;
  view.value = "home";
  clearGameUrl();
}

function returnFromGame() {
  if (gameReturn.value) {
    updateLeaderboardState(gameReturn.value.scope, gameReturn.value.level);
    view.value = "leaderboard";
    clearGameUrl();
    gameReturn.value = null;
    gameInProgress.value = false;
    return;
  }
  returnHomeAtCurrentLevel();
}

function goTab(tab: MainTab) {
  if (tab === "home") {
    goHome();
    return;
  }
  requestLeaveGame(() => {
    gameInProgress.value = false;
    gameReturn.value = null;
    view.value = tab;
    clearGameUrl();
  });
}

function requestLeaveGame(action: () => void) {
  if (view.value !== "game" || !gameInProgress.value) {
    action();
    return;
  }
  pendingLeaveAction = action;
  leaveReturnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  leaveConfirmOpen.value = true;
}

async function cancelLeaveGame() {
  leaveConfirmOpen.value = false;
  pendingLeaveAction = null;
  await nextTick();
  leaveReturnFocus?.focus();
  leaveReturnFocus = null;
}

function confirmLeaveGame() {
  const action = pendingLeaveAction;
  leaveConfirmOpen.value = false;
  pendingLeaveAction = null;
  leaveReturnFocus = null;
  action?.();
}

function syncUrl(t: GameLocation) {
  const url = new URL(window.location.href);
  url.search = "";
  url.searchParams.set("level", String(t.level));
  // 默认方案不携带种子，保持链接干净；重新排版后的自定义方案带上种子
  if (t.seed !== null && t.seed !== canonicalSeed(t.level, t.ruleset)) {
    url.searchParams.set("s", String(t.seed));
  }
  window.history.replaceState(null, "", url.toString());
}

function shareUrl(level: number, seed: number | null, ruleset: Ruleset): string {
  const url = new URL(window.location.href);
  url.search = "";
  url.searchParams.set("level", String(level));
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
    target.value = { level: clampLevel(levelParam), seed: parseSeed(params.get("s")), ruleset: "v3", autoStart: false };
    view.value = "game";
    syncUrl(target.value);
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
          <button type="button" :class="{ active: view === 'leaderboard' || view === 'player' }" @click="goTab('leaderboard')">
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

    <HomeView v-if="view === 'home'" :scroll-to-level="homeScrollLevel" @start="openDefaultGame" />
    <LeaderboardView
      v-else-if="view === 'leaderboard'"
      :initial-scope="leaderboardState.scope"
      :initial-level="leaderboardState.level"
      @play="openLeaderboardGame"
      @player="openPlayer"
      @state-change="updateLeaderboardState"
    />
    <ProfileView v-else-if="view === 'me'" @play="openDefaultGame" />
    <PlayerProfileView
      v-else-if="view === 'player' && selectedPlayerUid"
      :key="selectedPlayerUid"
      :uid="selectedPlayerUid"
      @back="returnToLeaderboard"
    />
    <GameView
      v-else
      :key="`${target.ruleset}:${target.level}:${target.seed ?? 'canon'}`"
      :level="target.level"
      :seed="target.seed"
      :ruleset="target.ruleset"
      :auto-start="target.autoStart"
      :return-to-previous="gameReturn !== null"
      :external-pause="settingsOpen || leaveConfirmOpen"
      :share-url="shareUrl"
      @exit="goHome"
      @return="returnFromGame"
      @navigate="openGame"
      @activity-change="updateGameActivity"
      @seed-change="(s) => syncUrl({ level: target.level, seed: s, ruleset: target.ruleset })"
    />

    <SettingsDialog
      v-if="settingsOpen"
      :settings="settings"
      :inactive="aboutOpen || clearConfirmOpen"
      @update="updateSettings"
      @about="openAbout"
      @clear="openClearConfirm"
      @close="settingsOpen = false"
    />
    <AboutDialog v-if="aboutOpen" @close="aboutOpen = false" />
    <ConfirmDialog
      v-if="clearConfirmOpen"
      title="清理本机缓存？"
      message="本机保存的成绩、进度与解锁记录将被清除，服务器数据不会受到影响。"
      confirm-label="清理"
      danger
      @confirm="clearLocalData"
      @cancel="clearConfirmOpen = false"
    />
    <ConfirmDialog
      v-if="leaveConfirmOpen"
      title="离开当前对局？"
      message="本局尚未完成，离开后当前进度不会保存。"
      confirm-label="离开"
      danger
      @confirm="confirmLeaveGame"
      @cancel="cancelLeaveGame"
    />
  </div>
</template>
