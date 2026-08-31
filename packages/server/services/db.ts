import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

let db: DatabaseSync | null = null;

/**
 * 数据库文件放在 fnOS 包数据目录（卸载向导可选择保留或清除），
 * 本地开发时退回到项目下的 .data 目录。
 */
export function getDb(): DatabaseSync {
  if (db) return db;

  const dir = process.env.STORAGE_DIR || join(process.cwd(), ".data");
  mkdirSync(dir, { recursive: true });
  const database = new DatabaseSync(join(dir, "schulte.db"));
  initializeSchema(database);
  db = database;
  return database;
}

export function initializeSchema(database: DatabaseSync): void {
  database.exec(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS users (
      uid TEXT PRIMARY KEY,
      username TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      last_seen INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS local_accounts (
      uid TEXT PRIMARY KEY REFERENCES users(uid) ON DELETE CASCADE,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      password_salt TEXT NOT NULL,
      must_change_password INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL,
      disabled_at INTEGER
    );
    CREATE TABLE IF NOT EXISTS auth_sessions (
      token_hash TEXT PRIMARY KEY,
      uid TEXT NOT NULL REFERENCES users(uid) ON DELETE CASCADE,
      created_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_auth_sessions_uid ON auth_sessions(uid);

    CREATE TABLE IF NOT EXISTS plays (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      uid TEXT NOT NULL,
      level INTEGER NOT NULL,
      ms INTEGER NOT NULL,
      errors INTEGER NOT NULL DEFAULT 0,
      seed INTEGER,
      played_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_plays_uid ON plays(uid, played_at DESC);
    CREATE INDEX IF NOT EXISTS idx_plays_level ON plays(level, ms);

    CREATE TABLE IF NOT EXISTS bests (
      uid TEXT NOT NULL,
      level INTEGER NOT NULL,
      best_ms INTEGER NOT NULL,
      plays INTEGER NOT NULL DEFAULT 0,
      updated_at INTEGER NOT NULL,
      PRIMARY KEY (uid, level)
    );
  `);

  const playColumns = database.prepare("PRAGMA table_info(plays)").all() as Array<{ name: string }>;
  if (!playColumns.some((column) => column.name === "ruleset")) {
    database.exec("ALTER TABLE plays ADD COLUMN ruleset TEXT NOT NULL DEFAULT 'v2'");
  }

  database.exec(`
    CREATE INDEX IF NOT EXISTS idx_plays_ruleset_uid ON plays(ruleset, uid, played_at DESC);
    CREATE INDEX IF NOT EXISTS idx_plays_ruleset_level ON plays(ruleset, level, ms);

    CREATE TABLE IF NOT EXISTS bests_rulesets (
      uid TEXT NOT NULL,
      ruleset TEXT NOT NULL,
      level INTEGER NOT NULL,
      best_ms INTEGER NOT NULL,
      plays INTEGER NOT NULL DEFAULT 0,
      updated_at INTEGER NOT NULL,
      PRIMARY KEY (uid, ruleset, level)
    );
    CREATE INDEX IF NOT EXISTS idx_bests_ruleset_level ON bests_rulesets(ruleset, level, best_ms);

    INSERT OR IGNORE INTO bests_rulesets (uid, ruleset, level, best_ms, plays, updated_at)
    SELECT uid, 'v2', level, best_ms, plays, updated_at FROM bests;
  `);
}

export function upsertUser(uid: string, username: string): void {
  const now = Date.now();
  getDb()
    .prepare(
      `INSERT INTO users (uid, username, created_at, last_seen) VALUES (?, ?, ?, ?)
       ON CONFLICT(uid) DO UPDATE SET username = excluded.username, last_seen = excluded.last_seen`
    )
    .run(uid, username, now, now);
}
