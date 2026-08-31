import { defineEventHandler, readBody } from "h3";
import { deleteAccount } from "../../../../services/auth";

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody<{ uid?: string }>(event);
    return { ok: true, data: deleteAccount(event, String(body?.uid || "")) };
  } catch (error) {
    return { ok: false, error: { message: error instanceof Error ? error.message : "删除失败" } };
  }
});
