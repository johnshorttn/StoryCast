import assert from "node:assert/strict";
import test from "node:test";
import { giftCodeHash } from "./plan-gifts.server.ts";

test("gift codes are normalized and stored as irreversible hashes", () => {
  const hash = giftCodeHash(" abC-123 ");
  assert.equal(hash, giftCodeHash("ABC-123"));
  assert.notEqual(hash, "ABC-123");
  assert.equal(hash.length, 64);
});
