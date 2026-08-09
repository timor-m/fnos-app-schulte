import { defineEventHandler } from "h3";
import { ok } from "../../utils/api-response";
import { getIdentity } from "../../utils/identity";
import { getDb, upsertUser } from "../../services/db";
import { LEVEL_BANDS } from "../../../shared/levels";

/** 最近成绩首屏条数：与 me-plays.get.ts 的分页大小保持一致 */
const RECENT_PLAYS_PAGE_SIZE = 15;

export default defineEventHandler((event) => {
  const identity = getIdentity(event);
  upsertUser(identity.uid, identity.username);
  const db = getDb();

  const summary = db
    .prepare(
      `SELECT COUNT(*) AS completed, COALESCE(SUM(plays), 0) AS totalPlays,
              COALESCE(SUM(best_ms), 0) AS totalBestMs, COALESCE(AVG(best_ms), 0) AS avgBestMs
       FROM bests WHERE uid = ?`
    )
    .get(identity.uid) as { completed: number; totalPlays: number; totalBestMs: number; avgBestMs: number };

  const weekAgo = Date.now() - 7 * 24 * 3600 * 1000;
  const recent = db
    .prepare("SELECT COUNT(*) AS count FROM plays WHERE uid = ? AND played_at >= ?")
    .get(identity.uid, weekAgo) as { count: number };

  const records = db
    .prepare("SELECT level, best_ms AS bestMs, plays FROM bests WHERE uid = ? ORDER BY level")
    .all(identity.uid) as Array<{ level: number; bestMs: number; plays: number }>;

  const completedLevels = new Set(records.map((r) => r.level));
  const bands = LEVEL_BANDS.map((band) => {
    let done = 0;
    for (let lv = band.from; lv <= band.to; lv += 1) {
      if (completedLevels.has(lv)) done += 1;
    }
    return { ...band, done, total: band.to - band.from + 1 };
  });

  // 按自增 id 倒序翻页，新成绩插入也不影响游标稳定性
  const recentRows = db
    .prepare(
      "SELECT id, level, ms, errors, played_at AS playedAt FROM plays WHERE uid = ? ORDER BY id DESC LIMIT ?"
    )
    .all(identity.uid, RECENT_PLAYS_PAGE_SIZE + 1) as Array<{
    id: number;
    level: number;
    ms: number;
    errors: number;
    playedAt: number;
  }>;
  const hasMorePlays = recentRows.length > RECENT_PLAYS_PAGE_SIZE;
  const recentPlays = recentRows.slice(0, RECENT_PLAYS_PAGE_SIZE);

  return ok({
    user: identity,
    summary: {
      completed: summary.completed,
      totalPlays: summary.totalPlays,
      totalBestMs: summary.totalBestMs,
      avgBestMs: Math.round(summary.avgBestMs),
      weekPlays: recent.count
    },
    records,
    bands,
    recentPlays,
    playsCursor: hasMorePlays ? recentPlays[recentPlays.length - 1].id : null
  });
});
