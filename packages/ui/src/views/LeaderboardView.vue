<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { Crown, Medal, Play, RefreshCw } from "lucide-vue-next";
import {
  fetchLevelBoard,
  fetchOverallBoard,
  type LevelEntry,
  type OverallEntry
} from "../game/api";
import { MAX_LEVEL, levelProfileForLevel, shapeName, type Ruleset } from "../game/levels";
import { formatElapsed } from "../game/format";

const emit = defineEmits<{
  (e: "play", level: number, ruleset: Ruleset): void;
}>();

const scope = ref<"overall" | "level">("overall");
const ruleset = ref<Ruleset>("v3");
const level = ref(1);
const loading = ref(true);
const overall = ref<OverallEntry[]>([]);
const levelEntries = ref<LevelEntry[]>([]);

const podium = computed(() => overall.value.slice(0, 3));
const rest = computed(() => overall.value.slice(3));

function avatarStyle(uid: string) {
  let hash = 0;
  for (let i = 0; i < uid.length; i += 1) hash = (hash * 31 + uid.charCodeAt(i)) >>> 0;
  const hue = hash % 360;
  return { background: `hsl(${hue} 48% 88%)`, color: `hsl(${hue} 45% 32%)` };
}

function initial(username: string): string {
  return [...username][0]?.toUpperCase() ?? "?";
}

async function load() {
  loading.value = true;
  if (scope.value === "overall") {
    const data = await fetchOverallBoard(ruleset.value);
    overall.value = data?.entries ?? [];
  } else {
    const data = await fetchLevelBoard(level.value, ruleset.value);
    levelEntries.value = data?.entries ?? [];
  }
  loading.value = false;
}

watch([scope, level, ruleset], () => void load());
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
        <div class="scope-tabs version-tabs" aria-label="规则版本">
          <button type="button" :class="{ active: ruleset === 'v3' }" @click="ruleset = 'v3'">当前版</button>
          <button type="button" :class="{ active: ruleset === 'v2' }" @click="ruleset = 'v2'">经典版</button>
        </div>
        <div class="scope-tabs" role="tablist">
          <button type="button" :class="{ active: scope === 'overall' }" @click="scope = 'overall'">总榜</button>
          <button type="button" :class="{ active: scope === 'level' }" @click="scope = 'level'">单关榜</button>
        </div>
        <label v-if="scope === 'level'" class="level-picker">
          第
          <input v-model.number="level" type="number" :min="1" :max="MAX_LEVEL" />
          关
        </label>
        <button class="icon-btn" type="button" aria-label="刷新" title="刷新" @click="load">
          <RefreshCw :size="17" />
        </button>
      </div>
    </section>

    <div v-if="loading" class="board-empty">加载中…</div>

    <!-- 总榜：领奖台 + 列表 -->
    <template v-else-if="scope === 'overall'">
      <div v-if="overall.length === 0" class="board-empty">
        <p>还没有家庭成绩</p>
        <span>完成任意一关即可上榜</span>
      </div>
      <template v-else>
        <section class="podium">
          <article
            v-for="entry in podium"
            :key="entry.uid"
            class="podium-card"
            :class="[`rank-${entry.rank}`, { me: entry.isMe }]"
          >
            <span class="podium-medal">
              <Crown v-if="entry.rank === 1" :size="22" />
              <Medal v-else :size="20" />
            </span>
            <span class="avatar" :style="avatarStyle(entry.uid)">{{ initial(entry.username) }}</span>
            <strong class="podium-name">{{ entry.username }}<em v-if="entry.isMe">（我）</em></strong>
            <span class="podium-main">{{ entry.completed }} <small>关</small></span>
            <span class="podium-sub">平均 {{ formatElapsed(Math.round(entry.avgBestMs)) }} · 共 {{ entry.totalPlays }} 次</span>
          </article>
        </section>

        <section v-if="rest.length" class="rank-list">
          <div v-for="entry in rest" :key="entry.uid" class="rank-row" :class="{ me: entry.isMe }">
            <span class="rank-num">{{ entry.rank }}</span>
            <span class="avatar small" :style="avatarStyle(entry.uid)">{{ initial(entry.username) }}</span>
            <span class="rank-name">{{ entry.username }}<em v-if="entry.isMe">（我）</em></span>
            <span class="rank-stat">通关 <strong>{{ entry.completed }}</strong></span>
            <span class="rank-stat hide-sm">平均 {{ formatElapsed(Math.round(entry.avgBestMs)) }}</span>
            <span class="rank-stat hide-sm">共 {{ entry.totalPlays }} 次</span>
          </div>
        </section>
      </template>
    </template>

    <!-- 单关榜 -->
    <template v-else>
      <p class="level-board-meta">
        第 {{ level }} 关 · {{ shapeName(levelProfileForLevel(level, ruleset).shape) }} ·
        {{ levelProfileForLevel(level, ruleset).targetCount }} 个数字
        <template v-if="levelProfileForLevel(level, ruleset).distractorCount">
          + {{ levelProfileForLevel(level, ruleset).distractorCount }} 字母
        </template>
        <button type="button" class="mini-play" @click="emit('play', level, ruleset)"><Play :size="13" fill="currentColor" />去挑战</button>
      </p>
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
  </main>
</template>
