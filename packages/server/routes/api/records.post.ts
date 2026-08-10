import { defineEventHandler, readBody } from "h3";
import { fail, ok } from "../../utils/api-response";
import { getIdentity } from "../../utils/identity";
import { getDb, upsertUser } from "../../services/db";
import { isRuleset, isValidLevel, type Ruleset } from "../../../shared/levels";

type SubmitBody = {
  level?: number;
  ms?: number;
  errors?: number;
  seed?: number | null;
  ruleset?: Ruleset;
};

export default defineEventHandler(async (event) => {
  const body = (await readBody(event)) as SubmitBody;
  const level = Number(body.level);
  const ms = Number(body.ms);
  const errors = Number(body.errors ?? 0);
  const seed = body.seed === null || body.seed === undefined ? null : Number(body.seed);
  // 未传版本的是历史客户端，继续归入经典版。
  const ruleset = body.ruleset ?? "v2";

  if (!isValidLevel(level)) {
    return fail("无效的关卡");
  }
  if (!isRuleset(ruleset)) {
    return fail("无效的规则版本");
  }
  if (!Number.isFinite(ms) || ms < 500 || ms > 3_600_000) {
    return fail("无效的成绩");
  }

  const identity = getIdentity(event);
  upsertUser(identity.uid, identity.username);

  const db = getDb();
  const now = Date.now();
  db.prepare("INSERT INTO plays (uid, level, ms, errors, seed, played_at, ruleset) VALUES (?, ?, ?, ?, ?, ?, ?)").run(
    identity.uid,
    level,
    Math.round(ms),
    Math.max(0, Math.round(errors)),
    seed,
    now,
    ruleset
  );

  const previous = db
    .prepare("SELECT best_ms, plays FROM bests_rulesets WHERE uid = ? AND ruleset = ? AND level = ?")
    .get(identity.uid, ruleset, level) as { best_ms: number; plays: number } | undefined;

  const isNewBest = !previous || ms < previous.best_ms;
  db.prepare(
    `INSERT INTO bests_rulesets (uid, ruleset, level, best_ms, plays, updated_at) VALUES (?, ?, ?, ?, 1, ?)
     ON CONFLICT(uid, ruleset, level) DO UPDATE SET
       best_ms = MIN(best_ms, excluded.best_ms),
       plays = plays + 1,
       updated_at = excluded.updated_at`
  ).run(identity.uid, ruleset, level, Math.round(ms), now);

  return ok({
    best: isNewBest ? Math.round(ms) : previous!.best_ms,
    isNewBest,
    plays: (previous?.plays ?? 0) + 1
  });
});
