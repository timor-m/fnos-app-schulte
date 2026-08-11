<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from "vue";
import { ArrowLeft, Crown, History, Trophy } from "lucide-vue-next";
import { fetchPlayer, fetchPlayerPlays, type PlayerData, type PlayItem } from "../game/api";
import { formatElapsed } from "../game/format";
import { shapeForLevel } from "../game/levels";
import ShapeIcon from "../components/ShapeIcon.vue";

const props = defineProps<{ uid: string }>();

const emit = defineEmits<{
  (e: "back"): void;
}>();

const player = ref<PlayerData | null>(null);
const loading = ref(true);
const showAllRecords = ref(false);
const plays = ref<PlayItem[]>([]);
const playsCursor = ref<number | null>(null);
const loadingMore = ref(false);
const loadError = ref(false);
const sentinel = ref<HTMLElement | null>(null);
let observer: IntersectionObserver | null = null;

const avatarStyle = computed(() => {
  let hash = 0;
  for (let index = 0; index < props.uid.length; index += 1) {
    hash = (hash * 31 + props.uid.charCodeAt(index)) >>> 0;
  }
  const hue = hash % 360;
  return { background: `hsl(${hue} 48% 88%)`, color: `hsl(${hue} 45% 32%)` };
});

const initial = computed(() => [...(player.value?.user.username ?? "?")][0]?.toUpperCase() ?? "?");
const visibleRecords = computed(() =>
  showAllRecords.value ? player.value?.records ?? [] : (player.value?.records ?? []).slice(0, 12)
);

function relativeTime(timestamp: number | null): string {
  if (timestamp === null) return "暂无训练";
  const diff = Math.max(0, Date.now() - timestamp);
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "刚刚活跃";
  if (minutes < 60) return `${minutes} 分钟前活跃`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} 小时前活跃`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} 天前活跃`;
  return `${new Date(timestamp).toLocaleDateString("zh-CN", { month: "numeric", day: "numeric" })} 活跃`;
}

function playTime(timestamp: number): string {
  const label = relativeTime(timestamp);
  return label.replace(/活跃$/, "").trim();
}

async function loadMore() {
  if (loadingMore.value || playsCursor.value === null) return;
  loadingMore.value = true;
  loadError.value = false;
  const result = await fetchPlayerPlays(props.uid, playsCursor.value);
  loadingMore.value = false;
  if (!result) {
    loadError.value = true;
    return;
  }

  const knownIds = new Set(plays.value.map((play) => play.id));
  plays.value = [...plays.value, ...result.plays.filter((play) => !knownIds.has(play.id))];
  playsCursor.value = result.nextCursor;
  await nextTick();
  if (
    playsCursor.value !== null &&
    sentinel.value &&
    sentinel.value.getBoundingClientRect().top < window.innerHeight + 240
  ) {
    void loadMore();
  }
}

onMounted(async () => {
  loading.value = true;
  player.value = await fetchPlayer(props.uid);
  loading.value = false;
  if (!player.value) return;

  plays.value = player.value.recentPlays;
  playsCursor.value = player.value.playsCursor;
  await nextTick();
  if (!sentinel.value) return;
  observer = new IntersectionObserver(
    (entries) => {
      if (entries.some((entry) => entry.isIntersecting)) void loadMore();
    },
    { rootMargin: "240px" }
  );
  observer.observe(sentinel.value);
});

onBeforeUnmount(() => observer?.disconnect());
</script>

<template>
  <main class="me-page player-page">
    <button type="button" class="btn ghost player-back" @click="emit('back')">
      <ArrowLeft :size="17" />返回排行榜
    </button>

    <div v-if="loading" class="board-empty">加载中…</div>

    <template v-else-if="player">
      <section class="me-hero player-hero">
        <span class="avatar big" :style="avatarStyle">{{ initial }}</span>
        <div class="me-id">
          <div class="player-name-row">
            <h1>{{ player.user.username }}</h1>
            <span v-if="player.user.isMe" class="player-self">我</span>
          </div>
          <p>{{ relativeTime(player.summary.lastActive) }}</p>
        </div>
        <span v-if="player.summary.rank !== null" class="player-rank-badge">
          <Trophy :size="17" />总榜第 {{ player.summary.rank }} 名
        </span>
      </section>

      <section class="me-stats player-stats" aria-label="玩家统计">
        <div class="me-stat">
          <strong class="mono">{{ player.summary.completed }}</strong>
          <small>通关数</small>
        </div>
        <div class="me-stat">
          <strong class="mono">{{ player.summary.totalPlays }}</strong>
          <small>完成次数</small>
        </div>
        <div class="me-stat">
          <strong class="mono">{{ player.summary.weekPlays }}</strong>
          <small>近 7 天</small>
        </div>
        <div class="me-stat">
          <strong class="mono">{{ player.summary.fastestCount }}</strong>
          <small>单关榜首</small>
        </div>
        <div class="me-stat">
          <strong class="mono">{{ player.summary.completed ? formatElapsed(player.summary.avgBestMs) : "--" }}</strong>
          <small>平均最佳</small>
        </div>
      </section>

      <section class="me-panel">
        <header class="me-panel-head">
          <h2><Trophy :size="17" />段位进度</h2>
        </header>
        <div class="band-rows">
          <div v-for="band in player.bands" :key="band.name" class="band-row">
            <span class="band-name">{{ band.name }}</span>
            <span class="band-range">{{ band.from }}-{{ band.to }}</span>
            <div class="band-track">
              <div class="band-fill" :style="{ width: `${(band.done / band.total) * 100}%` }"></div>
            </div>
            <span class="band-count mono">{{ band.done }}/{{ band.total }}</span>
          </div>
        </div>
      </section>

      <section class="me-panel">
        <header class="me-panel-head player-panel-head">
          <h2><Crown :size="17" />关卡最佳记录</h2>
          <span>{{ player.records.length }} 关</span>
        </header>
        <div v-if="visibleRecords.length === 0" class="player-panel-empty">还没有通关记录</div>
        <div v-else class="player-record-list">
          <div v-for="record in visibleRecords" :key="record.level" class="player-record-row">
            <span class="play-shape">
              <ShapeIcon :shape="shapeForLevel(record.level)" :size="16" />
            </span>
            <span class="player-record-level">第 {{ record.level }} 关</span>
            <span v-if="record.isFastest" class="player-record-crown" title="单关榜首">
              <Crown :size="16" />
            </span>
            <strong class="mono">{{ formatElapsed(record.bestMs) }}</strong>
            <small>{{ record.plays }} 次完成</small>
          </div>
        </div>
        <button
          v-if="player.records.length > 12"
          type="button"
          class="btn ghost player-record-toggle"
          @click="showAllRecords = !showAllRecords"
        >
          {{ showAllRecords ? "收起记录" : `查看全部 ${player.records.length} 条` }}
        </button>
      </section>

      <section class="me-panel">
        <header class="me-panel-head">
          <h2><History :size="17" />最近成绩</h2>
        </header>
        <div v-if="plays.length === 0" class="player-panel-empty">还没有训练记录</div>
        <div v-else class="play-list">
          <div v-for="play in plays" :key="play.id" class="play-row">
            <span class="play-shape">
              <ShapeIcon :shape="shapeForLevel(play.level)" :size="16" />
            </span>
            <span class="play-level">第 {{ play.level }} 关</span>
            <span class="play-ms mono">{{ formatElapsed(play.ms) }}</span>
            <span class="play-err" :class="{ clean: play.errors === 0 }">
              {{ play.errors === 0 ? "零失误" : `失误 ${play.errors}` }}
            </span>
            <span class="play-time">{{ playTime(play.playedAt) }}</span>
          </div>
        </div>
        <div v-if="playsCursor !== null" ref="sentinel" class="plays-more">
          <button v-if="loadError" type="button" class="btn plays-retry" @click="loadMore">加载失败，重试</button>
          <span v-else-if="loadingMore">加载中…</span>
        </div>
        <p v-else-if="plays.length > 0" class="plays-more">已显示全部 {{ plays.length }} 条成绩</p>
      </section>
    </template>

    <div v-else class="board-empty">
      <p>找不到这位玩家</p>
      <span>该家庭成员可能尚未产生训练记录</span>
    </div>
  </main>
</template>
