<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { ChevronDown, ChevronLeft, ChevronRight, Crown, Medal, Play, RefreshCw, X } from "lucide-vue-next";
import {
  fetchLevelBoard,
  fetchOverallBoard,
  type LevelEntry,
  type OverallEntry
} from "../game/api";
import { MAX_LEVEL, levelProfileForLevel } from "../game/levels";
import { formatElapsed } from "../game/format";
import ShapeIcon from "../components/ShapeIcon.vue";

type LeaderboardScope = "overall" | "level";

const props = defineProps<{
  initialScope: LeaderboardScope;
  initialLevel: number;
}>();

const emit = defineEmits<{
  (e: "play", level: number): void;
  (e: "state-change", scope: LeaderboardScope, level: number): void;
}>();

const scope = ref<LeaderboardScope>(props.initialScope);
const level = ref(Math.min(MAX_LEVEL, Math.max(1, props.initialLevel)));
const loading = ref(true);
const overall = ref<OverallEntry[]>([]);
const levelEntries = ref<LevelEntry[]>([]);
const levelPickerOpen = ref(false);
const levelRangeStart = ref(1);
const levelDecadeStart = ref(1);
let loadRequest = 0;

const levelRanges = Array.from({ length: Math.ceil(MAX_LEVEL / 100) }, (_, index) => {
  const from = index * 100 + 1;
  return { from, to: Math.min(from + 99, MAX_LEVEL) };
});
const levelDecades = computed(() =>
  Array.from({ length: 10 }, (_, index) => {
    const from = levelRangeStart.value + index * 10;
    return { from, to: Math.min(from + 9, MAX_LEVEL) };
  })
);
const visibleLevels = computed(() =>
  Array.from({ length: Math.min(10, MAX_LEVEL - levelDecadeStart.value + 1) }, (_, index) => levelDecadeStart.value + index)
);
const currentProfile = computed(() => levelProfileForLevel(level.value));

function avatarStyle(uid: string) {
  let hash = 0;
  for (let i = 0; i < uid.length; i += 1) hash = (hash * 31 + uid.charCodeAt(i)) >>> 0;
  const hue = hash % 360;
  return { background: `hsl(${hue} 48% 88%)`, color: `hsl(${hue} 45% 32%)` };
}

function initial(username: string): string {
  return [...username][0]?.toUpperCase() ?? "?";
}

function openLevelPicker() {
  levelRangeStart.value = Math.floor((level.value - 1) / 100) * 100 + 1;
  levelDecadeStart.value = Math.floor((level.value - 1) / 10) * 10 + 1;
  levelPickerOpen.value = true;
}

function selectLevelRange(from: number) {
  levelRangeStart.value = from;
  levelDecadeStart.value = from;
}

function selectLevel(nextLevel: number) {
  level.value = Math.min(MAX_LEVEL, Math.max(1, nextLevel));
  levelPickerOpen.value = false;
}

async function load() {
  const request = ++loadRequest;
  const requestedScope = scope.value;
  const requestedLevel = level.value;
  loading.value = true;
  if (requestedScope === "overall") {
    const data = await fetchOverallBoard();
    if (request !== loadRequest) return;
    overall.value = data?.entries ?? [];
  } else {
    const data = await fetchLevelBoard(requestedLevel);
    if (request !== loadRequest) return;
    levelEntries.value = data?.entries ?? [];
  }
  loading.value = false;
}

watch([scope, level], () => {
  emit("state-change", scope.value, level.value);
  void load();
});
onMounted(() => void load());
</script>

<template>
  <main class="board-page">
    <section class="board-head">
      <div>
        <h1>家庭排行榜</h1>
        <p>同一屋檐下的专注力较量</p>
      </div>
      <div class="board-controls">
        <div class="scope-tabs" role="tablist">
          <button type="button" :class="{ active: scope === 'overall' }" @click="scope = 'overall'">总榜</button>
          <button type="button" :class="{ active: scope === 'level' }" @click="scope = 'level'">单关榜</button>
        </div>
        <button class="icon-btn" type="button" aria-label="刷新" title="刷新" @click="load">
          <RefreshCw :size="17" />
        </button>
      </div>
    </section>

    <section v-if="scope === 'level'" class="level-switcher" aria-label="选择排行榜关卡">
      <button
        type="button"
        class="level-step"
        :disabled="level <= 1"
        aria-label="上一关"
        title="上一关"
        @click="selectLevel(level - 1)"
      >
        <ChevronLeft :size="20" />
      </button>
      <button type="button" class="level-current" aria-haspopup="dialog" @click="openLevelPicker">
        <span>
          <strong>第 {{ level }} 关</strong>
          <small>
            <ShapeIcon :shape="currentProfile.shape" :size="15" />
            <span>{{ currentProfile.targetCount }} 个数字</span>
            <template v-if="currentProfile.distractorCount"> + {{ currentProfile.distractorCount }} 字母</template>
          </small>
        </span>
        <ChevronDown :size="18" />
      </button>
      <button
        type="button"
        class="level-step"
        :disabled="level >= MAX_LEVEL"
        aria-label="下一关"
        title="下一关"
        @click="selectLevel(level + 1)"
      >
        <ChevronRight :size="20" />
      </button>
      <button type="button" class="btn primary level-play" @click="emit('play', level)">
        <Play :size="15" fill="currentColor" />去挑战
      </button>
    </section>

    <div v-if="loading" class="board-empty">加载中…</div>

    <template v-else-if="scope === 'overall'">
      <div v-if="overall.length === 0" class="board-empty">
        <p>还没有家庭成绩</p>
        <span>完成任意一关即可上榜</span>
      </div>
      <section v-else class="overall-list">
        <article
          v-for="entry in overall"
          :key="entry.uid"
          class="overall-card"
          :class="[`rank-${entry.rank}`, { me: entry.isMe }]"
        >
          <span class="overall-rank">
            <span v-if="entry.rank <= 3" class="overall-medal">
              <Crown v-if="entry.rank === 1" :size="22" />
              <Medal v-else :size="20" />
            </span>
            <strong v-else>{{ entry.rank }}</strong>
          </span>
          <span class="avatar" :style="avatarStyle(entry.uid)">{{ initial(entry.username) }}</span>
          <span class="overall-person">
            <strong>{{ entry.username }}<em v-if="entry.isMe">（我）</em></strong>
            <small>第 {{ entry.rank }} 名</small>
          </span>
          <span class="overall-stat primary-stat">
            <strong>{{ entry.completed }}</strong>
            <small>通关数</small>
          </span>
          <span class="overall-stat average-stat">
            <strong class="mono">{{ formatElapsed(Math.round(entry.avgBestMs)) }}</strong>
            <small>平均成绩</small>
          </span>
          <span class="overall-stat plays-stat">
            <strong>{{ entry.totalPlays }}</strong>
            <small>完成次数</small>
          </span>
        </article>
      </section>
    </template>

    <template v-else>
      <div v-if="levelEntries.length === 0" class="board-empty">
        <p>这一关还没有成绩</p>
        <span>成为第一个完成的人</span>
      </div>
      <section v-else class="rank-list">
        <div v-for="entry in levelEntries" :key="entry.uid" class="rank-row" :class="{ me: entry.isMe }">
          <span class="rank-num" :class="{ top: entry.rank <= 3 }">{{ entry.rank }}</span>
          <span class="avatar small" :style="avatarStyle(entry.uid)">{{ initial(entry.username) }}</span>
          <span class="rank-name">{{ entry.username }}<em v-if="entry.isMe">（我）</em></span>
          <span class="rank-stat"><strong class="mono">{{ formatElapsed(entry.bestMs) }}</strong></span>
          <span class="rank-stat hide-sm">{{ entry.plays }} 次尝试</span>
        </div>
      </section>
    </template>

    <div
      v-if="levelPickerOpen"
      class="dialog-backdrop level-picker-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="选择关卡"
      @click.self="levelPickerOpen = false"
      @keydown.esc="levelPickerOpen = false"
    >
      <section class="level-picker-dialog">
        <header class="level-picker-head">
          <div>
            <h2>选择关卡</h2>
            <p>当前第 {{ level }} 关</p>
          </div>
          <button type="button" class="icon-btn" aria-label="关闭" title="关闭" @click="levelPickerOpen = false">
            <X :size="19" />
          </button>
        </header>
        <nav class="level-range-tabs" aria-label="关卡范围">
          <button
            v-for="range in levelRanges"
            :key="range.from"
            type="button"
            :class="{ active: levelRangeStart === range.from }"
            @click="selectLevelRange(range.from)"
          >
            {{ range.from }}-{{ range.to }}
          </button>
        </nav>
        <nav class="level-decade-tabs" aria-label="十关范围">
          <button
            v-for="decade in levelDecades"
            :key="decade.from"
            type="button"
            :class="{ active: levelDecadeStart === decade.from }"
            @click="levelDecadeStart = decade.from"
          >
            {{ decade.from }}-{{ decade.to }}
          </button>
        </nav>
        <div class="quick-level-grid">
          <button
            v-for="itemLevel in visibleLevels"
            :key="itemLevel"
            type="button"
            :class="{ active: itemLevel === level }"
            :aria-current="itemLevel === level ? 'true' : undefined"
            @click="selectLevel(itemLevel)"
          >
            {{ itemLevel }}
          </button>
        </div>
      </section>
    </div>
  </main>
</template>
