import assert from "node:assert/strict";
import { test } from "node:test";
import { defaultTaskKey, normalizeTaskKey, projectTag, resolveTaskKey } from "../shared/task-key.ts";

test("uses the folder name", () => {
  assert.equal(defaultTaskKey("/Users/me/ops"), "ops");
});

test("ignores a trailing slash", () => {
  assert.equal(defaultTaskKey("/Users/me/ops/"), "ops");
});

test("normalizes spaces, case and symbols", () => {
  assert.equal(normalizeTaskKey("  My Project (v2) "), "my-project-v2");
});

test("keeps dots, dashes and underscores", () => {
  assert.equal(normalizeTaskKey("ops-server2_2.x"), "ops-server2_2.x");
});

test("never returns an empty default", () => {
  assert.equal(defaultTaskKey("/"), "project");
  assert.equal(defaultTaskKey("/tmp/!!!"), "project");
});

test("prefers a stored key", () => {
  assert.equal(resolveTaskKey("ops-server2", "/home/user/ops"), "ops-server2");
});

test("falls back when the stored key normalizes to nothing", () => {
  assert.equal(resolveTaskKey("  !! ", "/home/user/ops"), "ops");
  assert.equal(resolveTaskKey(undefined, "/home/user/ops"), "ops");
});

test("builds the project tag", () => {
  assert.equal(projectTag("ops"), "project:ops");
});
