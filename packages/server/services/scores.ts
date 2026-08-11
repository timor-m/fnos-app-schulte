import type { DatabaseSync } from "node:sqlite";

export type MergedBestRecord = {
  level: number;
  bestMs: number;
  plays: number;
  isFastest: boolean;
};

export function mergedRecordsForUser(database: DatabaseSync, uid: string): MergedBestRecord[] {
  const rows = database
    .prepare(
      `WITH merged AS (
         SELECT uid, level, MIN(best_ms) AS bestMs, SUM(plays) AS plays
         FROM bests_rulesets
         GROUP BY uid, level
       ), fastest AS (
         SELECT level, MIN(bestMs) AS fastestMs
         FROM merged
         GROUP BY level
       )
       SELECT merged.level, merged.bestMs, merged.plays,
              CASE WHEN merged.bestMs = fastest.fastestMs THEN 1 ELSE 0 END AS isFastest
       FROM merged
       JOIN fastest ON fastest.level = merged.level
       WHERE merged.uid = ?
       ORDER BY merged.level`
    )
    .all(uid) as Array<Omit<MergedBestRecord, "isFastest"> & { isFastest: number }>;
  return rows.map((row) => ({ ...row, isFastest: row.isFastest === 1 }));
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

export function mergedFastestForLevel(database: DatabaseSync, level: number): number | null {
  const row = database
    .prepare("SELECT MIN(best_ms) AS bestMs FROM bests_rulesets WHERE level = ?")
    .get(level) as { bestMs: number | null };
  return row.bestMs;
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

export function mergedOverallRankForUser(database: DatabaseSync, uid: string): number | null {
  const row = database
    .prepare(
      `WITH merged AS (
         SELECT uid, level,
                MIN(best_ms) AS best_ms,
                SUM(plays) AS plays
         FROM bests_rulesets
         GROUP BY uid, level
       ), overall AS (
         SELECT uid,
                COUNT(level) AS completed,
                AVG(best_ms) AS avgBestMs
         FROM merged
         GROUP BY uid
       ), ranked AS (
         SELECT uid,
                ROW_NUMBER() OVER (ORDER BY completed DESC, avgBestMs ASC) AS rank
         FROM overall
       )
       SELECT rank FROM ranked WHERE uid = ?`
    )
    .get(uid) as { rank: number } | undefined;
  return row?.rank ?? null;
}
