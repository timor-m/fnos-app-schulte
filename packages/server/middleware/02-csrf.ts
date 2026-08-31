import { createError, defineEventHandler, getHeader, getRequestURL } from "h3";

const protectedMethods = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export default defineEventHandler((event) => {
  if (!protectedMethods.has(event.method.toUpperCase()) || !getRequestURL(event).pathname.includes("/api/")) return;
  const origin = getHeader(event, "origin");
  if (!origin) return;
  try {
    if (new URL(origin).origin !== getRequestURL(event).origin) {
      throw createError({ statusCode: 403, statusMessage: "跨站请求被拒绝" });
    }
  } catch (error) {
    if (error && typeof error === "object" && "statusCode" in error) throw error;
    throw createError({ statusCode: 403, statusMessage: "无效的请求来源" });
  }
});
