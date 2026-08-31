<script setup lang="ts">
import { ref } from "vue";
import { LogIn } from "lucide-vue-next";
import { changePassword, fetchSession, login } from "../game/api";
import appIcon from "../assets/app-icon.png";
const emit = defineEmits<{ (e: "success"): void }>();
const username = ref("admin"); const password = ref("admin"); const nextPassword = ref(""); const forceChange = ref(false); const error = ref(""); const loading = ref(false);
async function submit() { loading.value=true; error.value=""; try { if(await login(username.value,password.value)){ const s=await fetchSession(); if(s?.mustChangePassword) forceChange.value=true; else emit("success"); } else error.value="用户名或密码错误"; } catch { error.value="服务暂时不可用"; } finally { loading.value=false; } }
async function updatePassword() { loading.value=true; error.value=""; try { if(nextPassword.value.length<8){error.value="密码至少需要 8 位";return;} const result=await changePassword(nextPassword.value); if(result.ok) emit("success"); else error.value=result.message || "密码更新失败"; } finally { loading.value=false; } }
function handleSubmit() { return forceChange.value ? updatePassword() : submit(); }
</script>
<template>
  <main class="login-page">
    <form class="login-card" @submit.prevent="handleSubmit">
      <div class="login-brand">
        <img :src="appIcon" alt="" class="login-mark" />
        <div>
          <span class="login-kicker">专注力训练工具</span>
          <h1>舒尔特训练</h1>
        </div>
      </div>
      <p class="login-intro">{{ forceChange ? "首次登录，请设置一个新密码" : "登录后同步训练成绩与个人记录" }}</p>
      <div class="login-fields">
        <label v-if="!forceChange">用户名<input v-model="username" autocomplete="username" required /></label>
        <label v-if="!forceChange">密码<input v-model="password" type="password" autocomplete="current-password" required /></label>
        <label v-else>新密码<input v-model="nextPassword" type="password" minlength="8" autocomplete="new-password" required /></label>
      </div>
      <p v-if="error" class="login-error">{{ error }}</p>
      <button class="btn primary login-submit" :disabled="loading"><LogIn :size="16" />{{ loading ? "处理中…" : forceChange ? "保存新密码" : "登录" }}</button>
      <p class="login-footnote">本地账号 · 数据保存在当前部署实例</p>
    </form>
  </main>
</template>
