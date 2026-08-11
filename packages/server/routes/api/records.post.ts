import { defineEventHandler, readBody } from "h3";
import { fail, ok } from "../../utils/api-response";
import { getIdentity } from "../../utils/identity";
import { getDb, upsertUser } from "../../services/db";
import { mergedBestForLevel, mergedFastestForLevel } from "../../services/scores";
import { CURRENT_RULESET, isValidLevel } from "../../../shared/levels";

type SubmitBody = {
  level?: number;
  ms?: number;
  errors?: number;
  seed?: number | null;
};

export default defineEventHandler(async (event) => {
  const body = (await readBody(event)) as SubmitBody;
  const level = Number(body.level);
  const ms = Number(body.ms);
  const errors = Number(body.errors ?? 0);
  const seed = body.seed === null || body.seed === undefined ? null : Number(body.seed);
  const ruleset = CURRENT_RULESET;

  if (!isValidLevel(level)) {
    return fail("无效的关卡");
  }
  if (!Number.isFinite(ms) || ms < 500 || ms > 3_600_000) {
    return fail("无效的成绩");
  }

  const identity = getIdentity(event);
  upsertUser(identity.uid, identity.username);

  const db = getDb();
  const now = Date.now();
  const roundedMs = Math.round(ms);
  db.prepare("INSERT INTO plays (uid, level, ms, errors, seed, played_at, ruleset) VALUES (?, ?, ?, ?, ?, ?, ?)").run(
    identity.uid,
    level,
    roundedMs,
    Math.max(0, Math.round(errors)),
    seed,
    now,
    ruleset
  );

  const previous = mergedBestForLevel(db, identity.uid, level);

  const isNewBest = previous.bestMs === null || roundedMs < previous.bestMs;
  db.prepare(
    `INSERT INTO bests_rulesets (uid, ruleset, level, best_ms, plays, updated_at) VALUES (?, ?, ?, ?, 1, ?)
     ON CONFLICT(uid, ruleset, level) DO UPDATE SET
       best_ms = MIN(best_ms, excluded.best_ms),
       plays = plays + 1,
       updated_at = excluded.updated_at`
  ).run(identity.uid, ruleset, level, roundedMs, now);

  const levelBest = mergedFastestForLevel(db, level);

  return ok({
    best: isNewBest ? roundedMs : previous.bestMs,
    isNewBest,
    plays: previous.plays + 1,
    levelBest,
    isLevelBest: levelBest !== null && roundedMs === levelBest
  });
});
