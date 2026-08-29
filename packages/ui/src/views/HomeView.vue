<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from "vue";
import { Lock, Medal, Play, RefreshCw, Star, Timer } from "lucide-vue-next";
import {
  LEVEL_BANDS,
  MAX_LEVEL,
  SEQUENTIAL_FROM_LEVEL,
  firstPlayableLevel,
  isLevelUnlocked,
  levelBand,
  levelProfileForLevel,
  shapeName,
  timeLimitForLevel
} from "../game/levels";
import {
  bestTime,
  completedCount,
  highestUnseenLayoutUnlock,
  loadProgress,
  markLayoutUnlockSeen
} from "../game/storage";
import { formatElapsed, starsFor } from "../game/format";
import { fetchMe } from "../game/api";
import LayoutUnlockDialog from "../components/LayoutUnlockDialog.vue";
import ShapeIcon from "../components/ShapeIcon.vue";
import type { LayoutUnlock } from "../game/levels";

const props = defineProps<{
  scrollToLevel?: number | null;
}>();

const emit = defineEmits<{
  (e: "start", level: number): void;
}>();

const progress = ref(0);
const doneCount = ref(0);
const serverBests = ref<Map<number, number>>(new Map());
const fastestLevels = ref<Set<number>>(new Set());
const missedUnlock = ref<LayoutUnlock | null>(null);
const refreshing = ref(false);
const refreshStatus = ref<"idle" | "loading" | "success" | "failed">("idle");
let refreshStatusTimer: number | null = null;

async function refreshLevels(showStatus = false) {
  if (refreshing.value) return;
  refreshing.value = true;
  if (refreshStatusTimer !== null) window.clearTimeout(refreshStatusTimer);
  if (showStatus) refreshStatus.value = "loading";
  progress.value = loadProgress();
  doneCount.value = completedCount();
  let succeeded = false;
  try {
    // 服务器成绩优先（同账号多设备同步），失败时保留本机记录。
    const me = await fetchMe();
    if (me) {
      succeeded = true;
      serverBests.value = new Map(me.records.map((r) => [r.level, r.bestMs]));
      fastestLevels.value = new Set(me.records.filter((r) => r.isFastest).map((r) => r.level));
      doneCount.value = me.summary.completed;
      progress.value = Math.max(progress.value, ...me.records.map((r) => r.level), 0);
    }
    missedUnlock.value = highestUnseenLayoutUnlock(progress.value);
  } finally {
    refreshing.value = false;
    if (showStatus) {
      refreshStatus.value = succeeded ? "success" : "failed";
      refreshStatusTimer = window.setTimeout(() => (refreshStatus.value = "idle"), 2200);
    }
  }
}

onMounted(() => void refreshLevels());

onMounted(async () => {
  if (!props.scrollToLevel) return;
  await nextTick();
  window.requestAnimationFrame(() => {
    document.getElementById(`level-${props.scrollToLevel}`)?.scrollIntoView({
      behavior: "smooth",
      block: "center"
    });
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
    const profile = levelProfileForLevel(level);
    const shape = profile.shape;
    return {
      level,
      targetCount: profile.targetCount,
      distractorCount: profile.distractorCount,
      band: levelBand(level),
      shape,
      shapeLabel: shapeName(shape),
      best,
      stars: best !== null ? starsFor(best, profile.targetCount) : 0,
      isFastest: fastestLevels.value.has(level),
      done: best !== null,
      locked: !isLevelUnlocked(level, doneLevels.value)
    };
  })
);

const nextProfile = computed(() => levelProfileForLevel(nextLevel.value));

/** 集星总数：由每关最佳成绩换算，满星 3 × 500 */
const totalStars = computed(() => levels.value.reduce((sum, item) => sum + item.stars, 0));

function playMissedUnlock() {
  if (!missedUnlock.value) return;
  const level = missedUnlock.value.level;
  markLayoutUnlockSeen(level);
  missedUnlock.value = null;
  emit("start", level);
}

function dismissMissedUnlock() {
  if (!missedUnlock.value) return;
  markLayoutUnlockSeen(missedUnlock.value.level);
  missedUnlock.value = null;
}

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
  if (refreshStatusTimer !== null) window.clearTimeout(refreshStatusTimer);
});
</script>

<template>
  <main class="home">
    <section class="home-hero">
      <div class="hero-info">
        <div class="hero-title-row">
          <h1>舒尔特训练</h1>
          <span class="hero-refresh-control">
            <span
              v-if="refreshStatus !== 'idle'"
              class="hero-refresh-status"
              :class="refreshStatus"
              role="status"
            >
              {{ refreshStatus === "loading" ? "正在刷新" : refreshStatus === "success" ? "已刷新" : "刷新失败" }}
            </span>
            <button
              type="button"
              class="hero-refresh"
              :class="{ refreshing }"
              :disabled="refreshing"
              aria-label="刷新关卡数据"
              title="刷新关卡数据"
              @click="refreshLevels(true)"
            >
              <RefreshCw :size="18" />
            </button>
          </span>
        </div>
        <p>13 种布局渐进穿插，按 1 到 N 的顺序点按，并从第 200 关起避开字母干扰。</p>
        <div class="hero-stats">
          <span>已完成 <strong>{{ doneCount }}</strong> / {{ MAX_LEVEL }} 关</span>
          <span class="dot" aria-hidden="true"></span>
          <span class="hero-stars-total" title="按每关最佳成绩换算的星级总和">
            <Star :size="13" fill="currentColor" :stroke-width="0" aria-hidden="true" />
            <strong>{{ totalStars }}</strong> / {{ MAX_LEVEL * 3 }}
          </span>
          <span class="dot" aria-hidden="true"></span>
          <span>当前进度 <strong>第 {{ progress }} 关</strong></span>
        </div>
      </div>
      <button class="continue-btn" type="button" @click="emit('start', nextLevel)">
        <span class="continue-label"><Play :size="17" fill="currentColor" />{{ doneCount > 0 ? "继续训练" : "开始训练" }}</span>
        <span class="continue-level">
          第 {{ nextLevel }} 关 · <ShapeIcon :shape="nextProfile.shape" :size="14" /> {{ nextProfile.targetCount }} 个数字
          <template v-if="nextProfile.distractorCount"> + {{ nextProfile.distractorCount }} 字母</template>
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
          :id="`level-${item.level}`"
          type="button"
          class="level-cell"
          :class="{ done: item.done, current: item.level === nextLevel, locked: item.locked }"
          :aria-disabled="item.locked || undefined"
          :title="item.locked ? `通关第 ${item.level - 1} 关后解锁` : undefined"
          :aria-label="item.locked ? `第 ${item.level} 关，未解锁` : `第 ${item.level} 关，${item.shapeLabel}，${item.targetCount} 个数字，${item.distractorCount} 个字母干扰`"
          @click="onLevelTap(item)"
        >
          <span v-if="item.done" class="lc-stars" :aria-label="`${item.stars} 星`">
            <Star
              v-for="n in 3"
              :key="n"
              :size="8"
              :fill="n <= item.stars ? 'currentColor' : 'none'"
              :stroke-width="2.6"
              :class="{ earned: n <= item.stars }"
              aria-hidden="true"
            />
          </span>
          <span class="lc-top">
            <span class="lc-id">
              <span class="level-num">{{ item.level }}</span>
              <ShapeIcon :shape="item.shape" :size="13" class="lc-shape" />
            </span>
          </span>
          <span class="lc-bottom">
            <template v-if="item.locked">
              <Lock :size="11" />
            </template>
            <template v-else-if="item.done">
              <span class="lc-result">{{ formatElapsed(item.best!) }}</span>
              <span v-if="item.isFastest" class="lc-fastest" title="我的成绩为本关最快" aria-label="本关最快">
                <Medal :size="14" :stroke-width="2.2" />
              </span>
            </template>
            <template v-else>
              {{ item.targetCount }} 数字
              <span v-if="item.distractorCount" class="lc-distractors">+{{ item.distractorCount }} 字母</span>
              <Timer v-if="timeLimitForLevel(item.level)" :size="10" class="lc-timer" />
            </template>
          </span>
        </button>
      </div>
    </section>

    <p class="home-tip">1-{{ SEQUENTIAL_FROM_LEVEL - 1 }} 关全部开放，{{ SEQUENTIAL_FROM_LEVEL }} 关起需逐关通关解锁；同一关每次进入会生成新的排布与配色。</p>

    <div v-if="lockTip" class="toast" role="status"><Lock :size="14" />{{ lockTip }}</div>

    <LayoutUnlockDialog
      v-if="missedUnlock"
      :unlock="missedUnlock"
      @play="playMissedUnlock"
      @later="dismissMissedUnlock"
    />
  </main>
</template>
