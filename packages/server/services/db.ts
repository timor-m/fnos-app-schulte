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
  db = new DatabaseSync(join(dir, "schulte.db"));
  db.exec(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS users (
      uid TEXT PRIMARY KEY,
      username TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      last_seen INTEGER NOT NULL
    );

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
  return db;
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
