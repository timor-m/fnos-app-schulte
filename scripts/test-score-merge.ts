import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import {
  mergedBestForLevel,
  mergedFastestForLevel,
  mergedLevelLeaderboard,
  mergedOverallLeaderboard,
  mergedOverallRankForUser,
  mergedRecordsForUser
} from "../packages/server/services/scores";

const database = new DatabaseSync(":memory:");
database.exec(`
  CREATE TABLE users (
    uid TEXT PRIMARY KEY,
    username TEXT NOT NULL
  );
  CREATE TABLE bests_rulesets (
    uid TEXT NOT NULL,
    ruleset TEXT NOT NULL,
    level INTEGER NOT NULL,
    best_ms INTEGER NOT NULL,
    plays INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    PRIMARY KEY (uid, ruleset, level)
  );

  INSERT INTO users VALUES ('a', '甲'), ('b', '乙');
  INSERT INTO bests_rulesets VALUES
    ('a', 'v2', 1, 12000, 2, 100),
    ('a', 'v3', 1, 10000, 3, 200),
    ('a', 'v2', 2, 15000, 1, 300),
    ('b', 'v3', 1, 9000, 4, 400);
`);

assert.deepEqual(
  mergedRecordsForUser(database, "a"),
  [
    { level: 1, bestMs: 10000, plays: 5, isFastest: false },
    { level: 2, bestMs: 15000, plays: 1, isFastest: true }
  ]
);

assert.equal(mergedOverallRankForUser(database, "a"), 1);
assert.equal(mergedOverallRankForUser(database, "b"), 2);
assert.equal(mergedOverallRankForUser(database, "missing"), null);
assert.deepEqual({ ...mergedBestForLevel(database, "a", 1) }, { bestMs: 10000, plays: 5 });
assert.deepEqual({ ...mergedBestForLevel(database, "a", 99) }, { bestMs: null, plays: 0 });
assert.equal(mergedFastestForLevel(database, 1), 9000);
assert.equal(mergedFastestForLevel(database, 2), 15000);
assert.equal(mergedFastestForLevel(database, 99), null);

assert.deepEqual(
  mergedLevelLeaderboard(database, 1).map(({ uid, bestMs, plays }) => ({ uid, bestMs, plays })),
  [
    { uid: "b", bestMs: 9000, plays: 4 },
    { uid: "a", bestMs: 10000, plays: 5 }
  ]
);

assert.deepEqual(
  mergedOverallLeaderboard(database).map(({ uid, completed, totalPlays, totalBestMs }) => ({
    uid,
    completed,
    totalPlays,
    totalBestMs
  })),
  [
    { uid: "a", completed: 2, totalPlays: 6, totalBestMs: 25000 },
    { uid: "b", completed: 1, totalPlays: 4, totalBestMs: 9000 }
  ]
);

database.close();
console.log("score merge tests passed: rulesets share one leaderboard and profile");
