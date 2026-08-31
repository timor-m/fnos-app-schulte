import { getGatewayUser } from "./gateway-user";
import { getCookie, createError, type H3Event } from "h3";
import { createHash } from "node:crypto";
import { getAppConfig } from "./runtime-config";
import { getDb, upsertUser } from "../services/db";

export type Identity = {
  uid: string;
  username: string;
  guest: boolean;
};

/**
 * 通过 fnOS 统一网关的用户上下文确定身份。
 * 本地开发不经过网关，退回为一个固定的本机玩家，保证功能可完整体验。
 */
export function getIdentity(event: H3Event): Identity {
  if (getAppConfig().authMode === "local") {
    const token = getCookie(event, "schulte_session");
    if (!token) throw createError({ statusCode: 401, statusMessage: "请先登录" });
    const hash = createHash("sha256").update(token).digest("hex");
    const row = getDb().prepare("SELECT u.uid, u.username FROM auth_sessions s JOIN users u ON u.uid=s.uid JOIN local_accounts a ON a.uid=u.uid WHERE s.token_hash=? AND s.expires_at>? AND a.disabled_at IS NULL").get(hash, Date.now()) as {uid:string;username:string}|undefined;
    if (!row) throw createError({ statusCode: 401, statusMessage: "登录已过期，请重新登录" });
    upsertUser(row.uid, row.username);
    return { uid: row.uid, username: row.username, guest: false };
  }
  const user = getGatewayUser(event);
  if (user.authenticated && user.uid) {
    return {
      uid: user.uid,
      username: user.username || "家庭成员",
      guest: false
    };
  }
  return { uid: "local-guest", username: "本机玩家", guest: true };
}
