import type { H3Event } from "h3";
import { getGatewayUser } from "./gateway-user";

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
