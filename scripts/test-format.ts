import assert from "node:assert/strict";
import { formatCountdown, formatElapsed, starsFor } from "../packages/ui/src/game/format";

assert.equal(formatElapsed(125_678), "125.6s");
assert.equal(formatElapsed(60_000), "60.0s");
assert.equal(formatElapsed(59_999), "59.9s");
assert.equal(formatElapsed(1_000), "1.0s");
assert.equal(formatElapsed(999), "0.9s");
assert.equal(formatElapsed(0), "0.0s");
assert.equal(formatElapsed(-1), "0.0s");

assert.equal(formatCountdown(60_000), "01:00");
assert.equal(formatCountdown(59_000), "00:59");
assert.equal(formatCountdown(1_001), "00:02");
assert.equal(formatCountdown(1_000), "00:01");
assert.equal(formatCountdown(1), "00:01");
assert.equal(formatCountdown(0), "00:00");
assert.equal(formatCountdown(-1), "00:00");

// 星级：1.0s/格以内三星，1.8s/格以内两星，更慢一星
assert.equal(starsFor(9_000, 9), 3);
assert.equal(starsFor(9_100, 9), 2);
assert.equal(starsFor(16_200, 9), 2);
assert.equal(starsFor(16_300, 9), 1);
assert.equal(starsFor(0, 0), 1);

console.log("clock format tests passed");
