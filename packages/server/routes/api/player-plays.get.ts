import { defineEventHandler, getQuery, setResponseStatus } from "h3";
import { fail, ok } from "../../utils/api-response";
import { getDb } from "../../services/db";

const DEFAULT_PAGE_SIZE = 15;
const MAX_PAGE_SIZE = 50;

export default defineEventHandler((event) => {
  const query = getQuery(event);
  const uid = typeof query.uid === "string" ? query.uid.trim() : "";
  const cursor = Number(query.cursor);
  const limit = Math.min(MAX_PAGE_SIZE, Math.max(1, Number(query.limit) || DEFAULT_PAGE_SIZE));

  if (!uid || uid.length > 128) {
    setResponseStatus(event, 400);
    return fail("无效的玩家");
  }
  if (!Number.isInteger(cursor) || cursor < 1) {
    setResponseStatus(event, 400);
    return fail("无效的游标");
  }

  const db = getDb();
  const user = db.prepare("SELECT 1 FROM users WHERE uid = ?").get(uid);
  if (!user) {
    setResponseStatus(event, 404);
    return fail("玩家不存在");
  }

  const rows = db
    .prepare(
      "SELECT id, level, ms, errors, played_at AS playedAt FROM plays WHERE uid = ? AND id < ? ORDER BY id DESC LIMIT ?"
    )
    .all(uid, cursor, limit + 1) as Array<{
    id: number;
    level: number;
    ms: number;
    errors: number;
    playedAt: number;
  }>;
  const hasMore = rows.length > limit;
  const plays = rows.slice(0, limit);

  return ok({
    plays,
    nextCursor: hasMore ? plays[plays.length - 1].id : null
  });
});
