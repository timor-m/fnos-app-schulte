import { defineEventHandler, getQuery } from "h3";
import { ok } from "../../utils/api-response";
import { getIdentity } from "../../utils/identity";
import { getDb } from "../../services/db";

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
    const rows = db
      .prepare(
        `SELECT u.uid, u.username, b.best_ms AS bestMs, b.plays, b.updated_at AS updatedAt
         FROM bests b JOIN users u ON u.uid = b.uid
         WHERE b.level = ?
         ORDER BY b.best_ms ASC
         LIMIT 50`
      )
      .all(level) as Array<Record<string, unknown>>;
    return ok({ scope: "level", level, entries: withRank(rows, identity.uid) });
  }

  const rows = db
    .prepare(
      `SELECT u.uid, u.username,
              COUNT(b.level) AS completed,
              COALESCE(SUM(b.plays), 0) AS totalPlays,
              COALESCE(AVG(b.best_ms), 0) AS avgBestMs,
              COALESCE(SUM(b.best_ms), 0) AS totalBestMs,
              MAX(b.updated_at) AS lastActive
       FROM users u
       LEFT JOIN bests b ON b.uid = u.uid
       GROUP BY u.uid
       ORDER BY completed DESC, avgBestMs ASC
       LIMIT 50`
    )
    .all() as Array<Record<string, unknown>>;

  return ok({ scope: "overall", entries: withRank(rows, identity.uid) });
});

function withRank(rows: Array<Record<string, unknown>>, currentUid: string) {
  return rows.map((row, index) => ({
    ...row,
    rank: index + 1,
    isMe: row.uid === currentUid
  }));
}
