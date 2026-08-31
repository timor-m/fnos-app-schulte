import { defineEventHandler, readBody } from "h3";
import { getAppConfig } from "../../../utils/runtime-config";
import { login } from "../../../services/auth";
export default defineEventHandler(async (event) => {
  if (getAppConfig().authMode !== "local") return { ok: false, error: { message: "当前部署使用 fnOS 账号" } };
  const body = await readBody<{username?:string;password?:string}>(event);
  try {
    if (!login(event, String(body?.username || ""), String(body?.password || ""))) return { ok: false, error: { message: "用户名或密码错误" } };
  } catch (error) {
    return { ok: false, error: { message: error instanceof Error ? error.message : "登录暂时不可用" } };
  }
  return { ok: true, data: { authenticated: true } };
});
