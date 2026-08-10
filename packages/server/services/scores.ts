import type { DatabaseSync } from "node:sqlite";

export type MergedBestRecord = {
  level: number;
  bestMs: number;
  plays: number;
};

export function mergedRecordsForUser(database: DatabaseSync, uid: string): MergedBestRecord[] {
  return database
    .prepare(
      `SELECT level, MIN(best_ms) AS bestMs, SUM(plays) AS plays
       FROM bests_rulesets
       WHERE uid = ?
       GROUP BY level
       ORDER BY level`
    )
    .all(uid) as MergedBestRecord[];
}

export function mergedBestForLevel(
  database: DatabaseSync,
  uid: string,
  level: number
): { bestMs: number | null; plays: number } {
  const row = database
    .prepare(
      `SELECT MIN(best_ms) AS bestMs, COALESCE(SUM(plays), 0) AS plays
       FROM bests_rulesets
       WHERE uid = ? AND level = ?`
    )
    .get(uid, level) as { bestMs: number | null; plays: number };
  return row;
}

export function mergedLevelLeaderboard(database: DatabaseSync, level: number): Array<Record<string, unknown>> {
  return database
    .prepare(
      `SELECT u.uid, u.username,
              MIN(b.best_ms) AS bestMs,
              SUM(b.plays) AS plays,
              MAX(b.updated_at) AS updatedAt
       FROM bests_rulesets b
       JOIN users u ON u.uid = b.uid
       WHERE b.level = ?
       GROUP BY u.uid, u.username
       ORDER BY bestMs ASC
       LIMIT 50`
    )
    .all(level) as Array<Record<string, unknown>>;
}

export function mergedOverallLeaderboard(database: DatabaseSync): Array<Record<string, unknown>> {
  return database
    .prepare(
      `WITH merged AS (
         SELECT uid, level,
                MIN(best_ms) AS best_ms,
                SUM(plays) AS plays,
                MAX(updated_at) AS updated_at
         FROM bests_rulesets
         GROUP BY uid, level
       )
       SELECT u.uid, u.username,
              COUNT(b.level) AS completed,
              COALESCE(SUM(b.plays), 0) AS totalPlays,
              COALESCE(AVG(b.best_ms), 0) AS avgBestMs,
              COALESCE(SUM(b.best_ms), 0) AS totalBestMs,
              MAX(b.updated_at) AS lastActive
       FROM users u
       JOIN merged b ON b.uid = u.uid
       GROUP BY u.uid, u.username
       ORDER BY completed DESC, avgBestMs ASC
       LIMIT 50`
    )
    .all() as Array<Record<string, unknown>>;
}
