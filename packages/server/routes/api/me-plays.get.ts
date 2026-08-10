import { defineEventHandler, getQuery } from "h3";
import { fail, ok } from "../../utils/api-response";
import { getIdentity } from "../../utils/identity";
import { getDb } from "../../services/db";
import { isRuleset } from "../../../shared/levels";

const DEFAULT_PAGE_SIZE = 15;
const MAX_PAGE_SIZE = 50;

/**
 * 我的成绩分页：以 plays 自增 id 为游标（id < cursor 倒序取下一页），
 * 翻页期间插入新成绩不会导致重复或漏项。
 */
export default defineEventHandler((event) => {
  const query = getQuery(event);
  const cursor = Number(query.cursor);
  const limit = Math.min(MAX_PAGE_SIZE, Math.max(1, Number(query.limit) || DEFAULT_PAGE_SIZE));
  const ruleset = isRuleset(query.ruleset) ? query.ruleset : "v3";

  if (!Number.isInteger(cursor) || cursor < 1) {
    return fail("无效的游标");
  }

  const identity = getIdentity(event);
  const db = getDb();
  const rows = db
    .prepare(
      "SELECT id, level, ms, errors, ruleset, played_at AS playedAt FROM plays WHERE uid = ? AND ruleset = ? AND id < ? ORDER BY id DESC LIMIT ?"
    )
    .all(identity.uid, ruleset, cursor, limit + 1) as Array<{
    id: number;
    level: number;
    ms: number;
    errors: number;
    ruleset: string;
    playedAt: number;
  }>;

  const hasMore = rows.length > limit;
  const plays = rows.slice(0, limit);

  return ok({
    plays,
    nextCursor: hasMore ? plays[plays.length - 1].id : null
  });
});
