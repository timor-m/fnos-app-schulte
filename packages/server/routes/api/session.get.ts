import { defineEventHandler } from "h3";
import { ok } from "../../utils/api-response";
import { getGatewayUser } from "../../utils/gateway-user";
import { getAppConfig } from "../../utils/runtime-config";
import { bootstrapLocalAdmin, session } from "../../services/auth";

export default defineEventHandler((event) => {
  if (getAppConfig().authMode === "local") {
    bootstrapLocalAdmin();
    return ok({ ...session(event), authMode: "local" });
  }
  return ok({ ...getGatewayUser(event), authMode: "fnos" });
});
