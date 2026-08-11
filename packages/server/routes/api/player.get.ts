import { defineEventHandler, getQuery, setResponseStatus } from "h3";
import { fail, ok } from "../../utils/api-response";
import { getIdentity } from "../../utils/identity";
import { getDb } from "../../services/db";
import { mergedOverallRankForUser, mergedRecordsForUser } from "../../services/scores";
import { LEVEL_BANDS } from "../../../shared/levels";

const RECENT_PLAYS_PAGE_SIZE = 15;

export default defineEventHandler((event) => {
  const query = getQuery(event);
  const uid = typeof query.uid === "string" ? query.uid.trim() : "";
  if (!uid || uid.length > 128) {
    setResponseStatus(event, 400);
    return fail("无效的玩家");
  }

  const db = getDb();
  const user = db
    .prepare("SELECT uid, username FROM users WHERE uid = ?")
    .get(uid) as { uid: string; username: string } | undefined;
  if (!user) {
    setResponseStatus(event, 404);
    return fail("玩家不存在");
  }

  const identity = getIdentity(event);
  const records = mergedRecordsForUser(db, uid);
  const totalBestMs = records.reduce((sum, record) => sum + record.bestMs, 0);
  const totalPlays = records.reduce((sum, record) => sum + record.plays, 0);
  const weekAgo = Date.now() - 7 * 24 * 3600 * 1000;
  const activity = db
    .prepare(
      `SELECT COUNT(CASE WHEN played_at >= ? THEN 1 END) AS weekPlays,
              MAX(played_at) AS lastActive
       FROM plays
       WHERE uid = ?`
    )
    .get(weekAgo, uid) as { weekPlays: number; lastActive: number | null };

  const completedLevels = new Set(records.map((record) => record.level));
  const bands = LEVEL_BANDS.map((band) => {
    let done = 0;
    for (let level = band.from; level <= band.to; level += 1) {
      if (completedLevels.has(level)) done += 1;
    }
    return { ...band, done, total: band.to - band.from + 1 };
  });

  const recentRows = db
    .prepare(
      `SELECT id, level, ms, errors, played_at AS playedAt
       FROM plays
       WHERE uid = ?
       ORDER BY id DESC
       LIMIT ?`
    )
    .all(uid, RECENT_PLAYS_PAGE_SIZE + 1) as Array<{
    id: number;
    level: number;
    ms: number;
    errors: number;
    playedAt: number;
  }>;
  const hasMorePlays = recentRows.length > RECENT_PLAYS_PAGE_SIZE;
  const recentPlays = recentRows.slice(0, RECENT_PLAYS_PAGE_SIZE);

  return ok({
    user: {
      ...user,
      isMe: user.uid === identity.uid
    },
    summary: {
      rank: mergedOverallRankForUser(db, uid),
      completed: records.length,
      totalPlays,
      avgBestMs: records.length > 0 ? Math.round(totalBestMs / records.length) : 0,
      weekPlays: activity.weekPlays,
      fastestCount: records.filter((record) => record.isFastest).length,
      lastActive: activity.lastActive
    },
    records,
    bands,
    recentPlays,
    playsCursor: hasMorePlays ? recentPlays[recentPlays.length - 1].id : null
  });
});
