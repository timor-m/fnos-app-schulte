import assert from "node:assert/strict";

const values = new Map<string, string>();
Object.defineProperty(globalThis, "localStorage", {
  value: {
    getItem(key: string) {
      return values.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      values.set(key, value);
    },
    removeItem(key: string) {
      values.delete(key);
    }
  },
  configurable: true
});

const {
  bestTime,
  highestUnseenLayoutUnlock,
  loadProgress,
  markLayoutUnlockSeen,
  saveProgress,
  saveRecord,
  seenLayoutUnlocks
} = await import("../packages/ui/src/game/storage");

saveProgress(260, "v2");
saveProgress(12, "v3");
assert.equal(loadProgress("v2"), 260);
assert.equal(loadProgress("v3"), 12);

saveRecord(8, 22000, "v2");
saveRecord(8, 18000, "v3");
assert.equal(bestTime(8, "v2"), 22000);
assert.equal(bestTime(8, "v3"), 18000);

assert.equal(highestUnseenLayoutUnlock(450)?.level, 451);
markLayoutUnlockSeen(451);
assert.equal(highestUnseenLayoutUnlock(450), null);
assert.deepEqual([...seenLayoutUnlocks()], [101, 151, 201, 251, 301, 351, 401, 451]);

console.log("storage tests passed: rulesets isolated and unlock prompts acknowledged once");
