import assert from "node:assert/strict";
import { formatCountdown } from "../packages/ui/src/game/format";

assert.equal(formatCountdown(60_000), "1:00");
assert.equal(formatCountdown(59_000), "0:59");
assert.equal(formatCountdown(1_001), "0:02");
assert.equal(formatCountdown(1_000), "0:01");
assert.equal(formatCountdown(1), "0:01");
assert.equal(formatCountdown(0), "0:00");
assert.equal(formatCountdown(-1), "0:00");

console.log("countdown format tests passed");
