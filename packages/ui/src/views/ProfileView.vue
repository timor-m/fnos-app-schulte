<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from "vue";
import {
  CircleDot,
  Diamond,
  Fan,
  Flower2,
  Grid3x3,
  Hexagon,
  Orbit,
  Play,
  RectangleHorizontal,
  Route,
  Shell,
  Sparkles,
  TrendingUp,
  Triangle,
  Waves
} from "lucide-vue-next";
import { fetchMe, fetchMyPlays, type MeData, type PlayItem } from "../game/api";
import { firstPlayableLevel, shapeForLevel, type BoardShape } from "../game/levels";
import { formatElapsed } from "../game/format";

const emit = defineEmits<{
  (e: "play", level: number): void;
}>();

const me = ref<MeData | null>(null);
const loading = ref(true);

// 最近成绩：首屏来自 /api/me，之后按游标滚动加载
const plays = ref<PlayItem[]>([]);
const playsCursor = ref<number | null>(null);
const loadingMore = ref(false);
const loadError = ref(false);
const sentinel = ref<HTMLElement | null>(null);
let observer: IntersectionObserver | null = null;

const shapeIcons: Record<BoardShape, typeof Grid3x3> = {
  grid: Grid3x3,
  hex: Hexagon,
  radial: CircleDot,
  spiral: Shell,
  scatter: Sparkles,
  triangle: Triangle,
  wave: Waves,
  fan: Fan,
  orbit: Orbit,
  diamond: Diamond,
  petal: Flower2,
  track: RectangleHorizontal,
  snake: Route
};

async function loadProfile() {
  loading.value = true;
  observer?.disconnect();
  observer = null;
  plays.value = [];
  playsCursor.value = null;
  me.value = await fetchMe();
  loading.value = false;
  if (me.value) {
    plays.value = me.value.recentPlays;
    playsCursor.value = me.value.playsCursor;
    await nextTick();
    if (sentinel.value) {
      observer = new IntersectionObserver(
        (entries) => {
          if (entries.some((entry) => entry.isIntersecting)) void loadMore();
        },
        { rootMargin: "240px" }
      );
      observer.observe(sentinel.value);
    }
  }
}

onMounted(() => void loadProfile());

onBeforeUnmount(() => observer?.disconnect());

async function loadMore() {
  if (loadingMore.value || playsCursor.value === null) return;
  loadingMore.value = true;
  loadError.value = false;
  const res = await fetchMyPlays(playsCursor.value);
  loadingMore.value = false;
  if (!res) {
    loadError.value = true;
    return;
  }
  plays.value = [...plays.value, ...res.plays];
  playsCursor.value = res.nextCursor;
  // 列表不够高时哨兵仍在视口内，IntersectionObserver 不会再次触发，这里主动续载
  await nextTick();
  if (
    playsCursor.value !== null &&
    sentinel.value &&
    sentinel.value.getBoundingClientRect().top < window.innerHeight + 240
  ) {
    void loadMore();
  }
}

const avatarStyle = computed(() => {
  const uid = me.value?.user.uid ?? "?";
  let hash = 0;
  for (let i = 0; i < uid.length; i += 1) hash = (hash * 31 + uid.charCodeAt(i)) >>> 0;
  const hue = hash % 360;
  return { background: `hsl(${hue} 48% 88%)`, color: `hsl(${hue} 45% 32%)` };
});

const initial = computed(() => [...(me.value?.user.username ?? "?")][0]?.toUpperCase() ?? "?");

function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "刚刚";
  if (minutes < 60) return `${minutes} 分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} 小时前`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} 天前`;
  return new Date(ts).toLocaleDateString("zh-CN", { month: "numeric", day: "numeric" });
}
</script>

<template>
  <main class="me-page">
    <div v-if="loading" class="board-empty">加载中…</div>

    <template v-else-if="me">
      <section class="me-hero">
        <span class="avatar big" :style="avatarStyle">{{ initial }}</span>
        <div class="me-id">
          <h1>{{ me.user.username }}</h1>
          <p v-if="me.user.guest">本机体验身份 · 安装到 fnOS 后自动使用 NAS 账号</p>
          <p v-else>fnOS 家庭成员</p>
        </div>
        <button
          type="button"
          class="btn primary me-continue"
          @click="emit('play', firstPlayableLevel(new Set(me.records.map((r) => r.level))))"
        >
          <Play :size="16" fill="currentColor" />继续训练
        </button>
      </section>

      <section class="me-stats">
        <div class="me-stat">
          <strong class="mono">{{ me.summary.completed }}</strong>
          <small>已通关</small>
        </div>
        <div class="me-stat">
          <strong class="mono">{{ me.summary.totalPlays }}</strong>
          <small>累计完成</small>
        </div>
        <div class="me-stat">
          <strong class="mono">{{ me.summary.weekPlays }}</strong>
          <small>近 7 天</small>
        </div>
        <div class="me-stat">
          <strong class="mono">{{ me.summary.completed > 0 ? formatElapsed(me.summary.avgBestMs) : "--" }}</strong>
          <small>平均成绩</small>
        </div>
      </section>

      <section class="me-panel">
        <header class="me-panel-head">
          <h2><TrendingUp :size="17" />段位进度</h2>
        </header>
        <div class="band-rows">
          <div v-for="band in me.bands" :key="band.name" class="band-row">
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
        <header class="me-panel-head">
          <h2>最近成绩</h2>
        </header>
        <div v-if="plays.length === 0" class="board-empty">
          <p>还没有训练记录</p>
          <span>从第 1 关开始吧</span>
        </div>
        <div v-else class="play-list">
          <div v-for="play in plays" :key="play.id" class="play-row">
            <span class="play-shape">
              <component :is="shapeIcons[shapeForLevel(play.level)]" :size="16" aria-hidden="true" />
            </span>
            <span class="play-level">第 {{ play.level }} 关</span>
            <span class="play-ms mono">{{ formatElapsed(play.ms) }}</span>
            <span class="play-err" :class="{ clean: play.errors === 0 }">
              {{ play.errors === 0 ? "零失误" : `失误 ${play.errors}` }}
            </span>
            <span class="play-time">{{ relativeTime(play.playedAt) }}</span>
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
      <p>服务暂不可用</p>
      <span>成绩仍保存在本机</span>
    </div>
  </main>
</template>
