#!/usr/bin/env node
import { randomBytes, scryptSync } from "node:crypto";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
const password = process.argv[2];
if (!password || password.length < 8) throw new Error("usage: reset-local-admin-password.mjs <password> (8-128 chars)");
const dir = process.env.STORAGE_DIR || "/data";
mkdirSync(dir, { recursive: true });
const db = new DatabaseSync(join(dir, "schulte.db"));
const salt=randomBytes(16).toString("hex");
const result = db.prepare("UPDATE local_accounts SET password_hash=?,password_salt=?,must_change_password=1 WHERE uid='local-admin'").run(scryptSync(password,salt,64).toString("hex"),salt);
if (!result.changes) throw new Error("local admin account does not exist");
db.prepare("DELETE FROM auth_sessions WHERE uid='local-admin'").run();
db.close();
console.log("local admin password reset");
