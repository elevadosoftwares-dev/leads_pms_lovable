import { describe, it as test } from "node:test";
import assert from "node:assert/strict";
import { validateAccountEdit, validatePassword } from "./account-rules.ts";

describe("account controls", () => {
  test("passwords require at least eight characters", () => {
    assert.throws(() => validatePassword("1234567", "1234567"));
    assert.doesNotThrow(() => validatePassword("12345678", "12345678"));
  });
  test("new password confirmation must match", () => {
    assert.throws(() => validatePassword("12345678", "87654321"));
  });
  test("administrator cannot demote themselves", () => {
    assert.throws(() => validateAccountEdit("a", "a", false, true));
    assert.doesNotThrow(() => validateAccountEdit("a", "b", false, true));
  });
  test("administrator cannot disable themselves", () => {
    assert.throws(() => validateAccountEdit("a", "a", true, false));
    assert.doesNotThrow(() => validateAccountEdit("a", "b", true, false));
  });
});
