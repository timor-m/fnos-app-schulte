import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { initializeSchema } from "../packages/server/services/db";

const database = new DatabaseSync(":memory:");
database.exec(`
  CREATE TABLE users (
    uid TEXT PRIMARY KEY,
    username TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    last_seen INTEGER NOT NULL
  );
  CREATE TABLE plays (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    uid TEXT NOT NULL,
    level INTEGER NOT NULL,
    ms INTEGER NOT NULL,
    errors INTEGER NOT NULL DEFAULT 0,
    seed INTEGER,
    played_at INTEGER NOT NULL
  );
  CREATE TABLE bests (
    uid TEXT NOT NULL,
    level INTEGER NOT NULL,
    best_ms INTEGER NOT NULL,
    plays INTEGER NOT NULL DEFAULT 0,
    updated_at INTEGER NOT NULL,
    PRIMARY KEY (uid, level)
  );
  INSERT INTO users VALUES ('legacy-user', '旧玩家', 1, 1);
  INSERT INTO plays (uid, level, ms, errors, seed, played_at)
  VALUES ('legacy-user', 12, 12345, 1, 42, 1000);
  INSERT INTO bests VALUES ('legacy-user', 12, 12345, 3, 1000);
`);

initializeSchema(database);
initializeSchema(database);

const columns = database.prepare("PRAGMA table_info(plays)").all() as Array<{ name: string }>;
assert.ok(columns.some((column) => column.name === "ruleset"));
assert.equal(
  (database.prepare("SELECT ruleset FROM plays WHERE uid = 'legacy-user'").get() as { ruleset: string }).ruleset,
  "v2"
);
assert.deepEqual(
  { ...database.prepare("SELECT ruleset, level, best_ms, plays FROM bests_rulesets WHERE uid = 'legacy-user'").get() },
  { ruleset: "v2", level: 12, best_ms: 12345, plays: 3 }
);
assert.equal(
  (database.prepare("SELECT COUNT(*) AS count FROM bests_rulesets WHERE ruleset = 'v3'").get() as { count: number }).count,
  0
);

database.close();
console.log("database migration test passed: legacy records preserved as v2");
