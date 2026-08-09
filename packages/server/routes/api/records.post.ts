import { defineEventHandler, readBody } from "h3";
import { fail, ok } from "../../utils/api-response";
import { getIdentity } from "../../utils/identity";
import { getDb, upsertUser } from "../../services/db";
import { isValidLevel } from "../../../shared/levels";

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
  db.prepare("INSERT INTO plays (uid, level, ms, errors, seed, played_at) VALUES (?, ?, ?, ?, ?, ?)").run(
    identity.uid,
    level,
    Math.round(ms),
    Math.max(0, Math.round(errors)),
    seed,
    now
  );

  const previous = db
    .prepare("SELECT best_ms, plays FROM bests WHERE uid = ? AND level = ?")
    .get(identity.uid, level) as { best_ms: number; plays: number } | undefined;

  const isNewBest = !previous || ms < previous.best_ms;
  db.prepare(
    `INSERT INTO bests (uid, level, best_ms, plays, updated_at) VALUES (?, ?, ?, 1, ?)
     ON CONFLICT(uid, level) DO UPDATE SET
       best_ms = MIN(best_ms, excluded.best_ms),
       plays = plays + 1,
       updated_at = excluded.updated_at`
  ).run(identity.uid, level, Math.round(ms), now);

  return ok({
    best: isNewBest ? Math.round(ms) : previous!.best_ms,
    isNewBest,
    plays: (previous?.plays ?? 0) + 1
  });
});
