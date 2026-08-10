import { defineEventHandler, getQuery } from "h3";
import { ok } from "../../utils/api-response";
import { getIdentity } from "../../utils/identity";
import { getDb } from "../../services/db";
import { mergedLevelLeaderboard, mergedOverallLeaderboard } from "../../services/scores";

/**
 * 家庭排行榜：
 * - 默认返回总榜（按通关数排序，通关数相同比平均速度）
 * - ?level=N 返回该关的单关排行（按最好成绩排序）
 */
export default defineEventHandler((event) => {
  const identity = getIdentity(event);
  const query = getQuery(event);
  const db = getDb();

  if (query.level !== undefined) {
    const level = Number(query.level);
    const rows = mergedLevelLeaderboard(db, level);
    return ok({ scope: "level", level, entries: withRank(rows, identity.uid) });
  }

  const rows = mergedOverallLeaderboard(db);

  return ok({ scope: "overall", entries: withRank(rows, identity.uid) });
});

function withRank(rows: Array<Record<string, unknown>>, currentUid: string) {
  return rows.map((row, index) => ({
    ...row,
    rank: index + 1,
    isMe: row.uid === currentUid
  }));
}
