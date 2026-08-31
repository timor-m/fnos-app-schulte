<script setup lang="ts">
import { onMounted, ref } from "vue";
import { KeyRound, UserPlus, X } from "lucide-vue-next";
import ConfirmDialog from "./ConfirmDialog.vue";
import { changePassword, createAccount, deleteAccount, fetchAccounts, resetAccount, logout, type LocalAccount } from "../game/api";
const props=defineProps<{ isAdmin:boolean }>(); const emit=defineEmits<{(e:"close"):void;(e:"logout"):void}>();
const password=ref(""); const username=ref(""); const accounts=ref<LocalAccount[]>([]); const message=ref(""); const deletingUid=ref<string|null>(null);
onMounted(async()=>{if(props.isAdmin) accounts.value=await fetchAccounts();});
async function savePassword(){const result=await changePassword(password.value);message.value=result.ok?"密码已更新，请重新登录":result.message||"密码更新失败";password.value="";}
async function add(){message.value=await createAccount(username.value)?"账号已创建，临时密码为 admin":"创建失败";username.value="";accounts.value=await fetchAccounts();}
async function reset(uid:string){message.value=await resetAccount(uid)?"已重置为临时密码 admin":"重置失败";}
async function remove(){if(!deletingUid.value)return; const result=await deleteAccount(deletingUid.value); message.value=result.ok?"账号已删除":result.message||"删除失败"; deletingUid.value=null; if(result.ok) accounts.value=await fetchAccounts();}
async function signOut(){await logout();emit("logout");}
</script>
<template>
  <div class="dialog-backdrop" role="dialog" aria-modal="true" @click.self="emit('close')">
    <div class="dialog account-dialog">
      <div class="dialog-head account-dialog-head">
        <div class="account-title"><span class="account-title-icon"><KeyRound :size="17" /></span><div><h2>账号安全</h2><p>管理登录密码与本地账号</p></div></div>
        <button class="icon-btn" aria-label="关闭" @click="emit('close')"><X :size="20" /></button>
      </div>
      <div class="account-current"><span>当前账号</span><strong>本地账号</strong></div>
      <section class="account-section">
        <div class="account-section-head"><h3>修改密码</h3><span>至少 8 位</span></div>
        <form class="account-form" @submit.prevent="savePassword">
          <label><span class="sr-only">新密码</span><input v-model="password" type="password" minlength="8" placeholder="输入新密码" autocomplete="new-password" required /></label>
          <button class="btn primary" type="submit"><KeyRound :size="15" />更新密码</button>
        </form>
      </section>
      <section v-if="props.isAdmin" class="account-section">
        <div class="account-section-head"><h3>本地账号</h3><span>{{ accounts.length }} 个账号</span></div>
        <form class="account-form" @submit.prevent="add">
          <label><span class="sr-only">新增用户名</span><input v-model="username" placeholder="3-64 位用户名" autocomplete="off" required /></label>
          <button class="btn primary" type="submit"><UserPlus :size="15" />新增账号</button>
        </form>
        <div class="account-list"><div v-for="account in accounts" :key="account.uid" class="account-item"><div><strong>{{ account.username }}</strong><small>{{ account.uid === 'local-admin' ? '管理员' : account.mustChangePassword ? '待首次改密' : '普通账号' }}</small></div><span v-if="account.uid === 'local-admin'" class="account-admin-label">管理员</span><div v-else class="account-item-actions"><button class="btn ghost" @click="reset(account.uid)">重置密码</button><button class="btn danger" @click="deletingUid = account.uid">删除</button></div></div></div>
      </section>
      <p v-if="message" class="account-message">{{ message }}</p>
      <button class="btn danger account-logout" @click="signOut">退出登录</button>
      <ConfirmDialog v-if="deletingUid" title="删除本地账号？" message="该账号的登录会话、成绩和排行榜记录都会被永久删除。" confirm-label="删除账号" danger @confirm="remove" @cancel="deletingUid = null" />
    </div>
  </div>
</template>
