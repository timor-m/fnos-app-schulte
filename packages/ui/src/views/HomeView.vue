<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { Check, Grid3x3, Hexagon, Lock, Play, Timer } from "lucide-vue-next";
import {
  LEVEL_BANDS,
  MAX_LEVEL,
  SEQUENTIAL_FROM_LEVEL,
  firstPlayableLevel,
  gridSizeForLevel,
  isLevelUnlocked,
  levelBand,
  shapeForLevel,
  shapeName,
  timeLimitForLevel
} from "../game/levels";
import { bestTime, completedCount, loadProgress } from "../game/storage";
import { formatElapsed } from "../game/format";
import { fetchMe } from "../game/api";

const emit = defineEmits<{
  (e: "start", level: number): void;
}>();

const progress = ref(0);
const doneCount = ref(0);
const serverBests = ref<Map<number, number>>(new Map());

onMounted(() => {
  progress.value = loadProgress();
  doneCount.value = completedCount();
  // 服务器成绩优先（同账号多设备同步），失败时退回本机记录
  void fetchMe().then((me) => {
    if (!me) return;
    serverBests.value = new Map(me.records.map((r) => [r.level, r.bestMs]));
    doneCount.value = me.summary.completed;
    progress.value = Math.max(progress.value, ...me.records.map((r) => r.level), 0);
  });
});

/** 已通关关卡集合：服务器成绩优先，本机记录兜底 */
const doneLevels = computed(() => {
  const set = new Set<number>(serverBests.value.keys());
  for (let level = 1; level <= MAX_LEVEL; level += 1) {
    if (bestTime(level) !== null) set.add(level);
  }
  return set;
});

const nextLevel = computed(() => firstPlayableLevel(doneLevels.value));

const levels = computed(() =>
  Array.from({ length: MAX_LEVEL }, (_, i) => {
    const level = i + 1;
    const best = serverBests.value.get(level) ?? bestTime(level);
    const shape = shapeForLevel(level);
    return {
      level,
      size: gridSizeForLevel(level),
      band: levelBand(level),
      shape,
      shapeLabel: shapeName(shape),
      best,
      done: best !== null,
      locked: !isLevelUnlocked(level, doneLevels.value)
    };
  })
);

// 段位导航：与 packages/shared/levels.ts 的段位划分保持一致
const bands = LEVEL_BANDS;

const bandSections = computed(() =>
  bands.map((band) => {
    const items = levels.value.filter((item) => item.level >= band.from && item.level <= band.to);
    return {
      ...band,
      items,
      doneCount: items.filter((item) => item.done).length
    };
  })
);

/** 当前视口所处段位（滚动高亮跳转条） */
const activeBand = ref(1);
const bandNav = ref<HTMLElement | null>(null);

function jumpTo(from: number) {
  activeBand.value = from;
  document.getElementById(`lv-${from}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

// 滚动监听：视口顶部越过的最后一个段位即为当前段位，并把对应按钮滑进可视区
function onScroll() {
  const anchor = window.scrollY + 150;
  let current = bands[0].from;
  for (const band of bands) {
    const el = document.getElementById(`lv-${band.from}`);
    if (el && el.offsetTop <= anchor) current = band.from;
  }
  if (current === activeBand.value) return;
  activeBand.value = current;
  const btn = bandNav.value?.querySelector<HTMLButtonElement>(`[data-band="${current}"]`);
  if (btn && bandNav.value) {
    const nav = bandNav.value;
    const left = btn.offsetLeft - nav.clientWidth / 2 + btn.clientWidth / 2;
    nav.scrollTo({ left, behavior: "smooth" });
  }
}

onMounted(() => {
  window.addEventListener("scroll", onScroll, { passive: true });
});

onBeforeUnmount(() => {
  window.removeEventListener("scroll", onScroll);
});

// 点击未解锁关卡的轻提示（disabled 按钮不触发事件，故锁定格保持可点击）
const lockTip = ref("");
let lockTipTimer: number | null = null;

function onLevelTap(item: { level: number; locked: boolean }) {
  if (!item.locked) {
    emit("start", item.level);
    return;
  }
  lockTip.value = `第 ${item.level} 关还未解锁，先通关第 ${item.level - 1} 关`;
  if (lockTipTimer !== null) window.clearTimeout(lockTipTimer);
  lockTipTimer = window.setTimeout(() => (lockTip.value = ""), 2200);
}

onBeforeUnmount(() => {
  if (lockTipTimer !== null) window.clearTimeout(lockTipTimer);
});
</script>

<template>
  <main class="home">
    <section class="home-hero">
      <div class="hero-info">
        <h1>舒尔特训练</h1>
        <p>方格与蜂巢混合排布，按 1 到 N 的顺序依次点按，训练视觉搜索与专注力。</p>
        <div class="hero-stats">
          <span>已完成 <strong>{{ doneCount }}</strong> / {{ MAX_LEVEL }} 关</span>
          <span class="dot" aria-hidden="true"></span>
          <span>当前进度 <strong>第 {{ progress }} 关</strong></span>
        </div>
      </div>
      <button class="continue-btn" type="button" @click="emit('start', nextLevel)">
        <span class="continue-label"><Play :size="17" fill="currentColor" />{{ doneCount > 0 ? "继续训练" : "开始训练" }}</span>
        <span class="continue-level">
          第 {{ nextLevel }} 关 · {{ shapeName(shapeForLevel(nextLevel)) }} {{ gridSizeForLevel(nextLevel) }}×{{ gridSizeForLevel(nextLevel) }}
        </span>
      </button>
    </section>

    <nav ref="bandNav" class="band-jump" aria-label="段位跳转">
      <button
        v-for="band in bands"
        :key="band.from"
        type="button"
        :data-band="band.from"
        :class="{ active: activeBand === band.from }"
        @click="jumpTo(band.from)"
      >
        {{ band.name }} {{ band.from }}-{{ band.to }}
      </button>
    </nav>

    <section
      v-for="section in bandSections"
      :key="section.from"
      :id="`lv-${section.from}`"
      class="band-section"
      :aria-label="`${section.name}段位`"
    >
      <header class="band-head">
        <h2>{{ section.name }}</h2>
        <span class="band-range">{{ section.from }}-{{ section.to }} 关</span>
        <span v-if="section.from >= 101" class="band-timed"><Timer :size="11" />限时挑战</span>
        <span class="band-prog">
          <span class="band-prog-track"><span :style="{ width: `${(section.doneCount / section.items.length) * 100}%` }"></span></span>
          <em>{{ section.doneCount }}/{{ section.items.length }}</em>
        </span>
      </header>
      <div class="level-grid">
        <button
          v-for="item in section.items"
          :key="item.level"
          type="button"
          class="level-cell"
          :class="{ done: item.done, current: item.level === nextLevel, locked: item.locked }"
          :aria-disabled="item.locked || undefined"
          :title="item.locked ? `通关第 ${item.level - 1} 关后解锁` : undefined"
          :aria-label="item.locked ? `第 ${item.level} 关，未解锁` : `第 ${item.level} 关，${item.shapeLabel} ${item.size}×${item.size}`"
          @click="onLevelTap(item)"
        >
          <span class="lc-top">
            <span class="level-num">{{ item.level }}</span>
            <Hexagon v-if="item.shape === 'hex'" :size="13" class="lc-shape hex" />
            <Grid3x3 v-else :size="13" class="lc-shape" />
          </span>
          <span class="lc-bottom">
            <template v-if="item.locked">
              <Lock :size="11" />
            </template>
            <template v-else-if="item.done">
              <Check :size="11" class="lc-check" />{{ formatElapsed(item.best!) }}
            </template>
            <template v-else>
              {{ item.size }}×{{ item.size }}<Timer v-if="timeLimitForLevel(item.level)" :size="10" class="lc-timer" />
            </template>
          </span>
        </button>
      </div>
    </section>

    <p class="home-tip">1-{{ SEQUENTIAL_FROM_LEVEL - 1 }} 关全部开放，{{ SEQUENTIAL_FROM_LEVEL }} 关起需逐关通关解锁；同一关的排布与配色默认固定，分享链接可直接挑战同一局面。</p>

    <div v-if="lockTip" class="toast" role="status"><Lock :size="14" />{{ lockTip }}</div>
  </main>
</template>
