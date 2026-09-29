import assert from "node:assert/strict";
import { test } from "node:test";
import { applyListResult, applyTask, type ListState } from "../shared/list-state.ts";
import { fail, ok } from "../shared/result.ts";
import type { Task } from "../shared/tasks.ts";

const task = (id: string, version: number, status: Task["status"] = "inbox", content = id): Task => ({
  id, content, status, version, tags: [], metadata: {}, updatedAt: "2026-09-29T10:00:00Z",
});
const ready = (open: Task[], done: Task[] = []): Extract<ListState, { status: "ready" }> => ({ status: "ready", open, done, refreshError: null });

test("the first load becomes ready", () => {
  assert.deepEqual(applyListResult({ status: "loading" }, ok({ open: [task("a", 1)], done: [] })), ready([task("a", 1)]));
});

test("a failed first load is an error", () => {
  const next = applyListResult({ status: "loading" }, fail("unreachable", "down"));
  assert.deepEqual(next, { status: "error", error: { kind: "unreachable", message: "down" } });
});

test("a failed refresh keeps the last good lists and reports the error", () => {
  const next = applyListResult(ready([task("a", 1)]), fail("unreachable", "down"));
  assert.deepEqual(next, { ...ready([task("a", 1)]), refreshError: { kind: "unreachable", message: "down" } });
});

test("a successful refresh clears the refresh error", () => {
  const before: ListState = { ...ready([task("a", 1)]), refreshError: { kind: "unreachable", message: "down" } };
  assert.deepEqual(applyListResult(before, ok({ open: [task("a", 1)], done: [] })), ready([task("a", 1)]));
});

test("a refresh never replaces a newer local version of a task", () => {
  const local = ready([task("a", 3, "inbox", "saved text")]);
  const next = applyListResult(local, ok({ open: [task("a", 2, "inbox", "older text"), task("b", 1)], done: [] }));
  assert.equal(next.status, "ready");
  if (next.status === "ready") {
    assert.deepEqual(next.open.map((t) => [t.id, t.version, t.content]), [["a", 3, "saved text"], ["b", 1, "b"]]);
  }
});

test("a refresh drops tasks that are gone from the server", () => {
  const next = applyListResult(ready([task("a", 1), task("gone", 1)]), ok({ open: [task("a", 1)], done: [] }));
  assert.deepEqual(next.status === "ready" && next.open.map((t) => t.id), ["a"]);
});

test("applying a task moves it between open and done, and archived removes it", () => {
  let state: ListState = ready([task("a", 1)]);
  state = applyTask(state, task("a", 2, "done"));
  assert.deepEqual(state.status === "ready" && [state.open.length, state.done.map((t) => t.id)], [0, ["a"]]);
  state = applyTask(state, task("a", 3, "archived"));
  assert.deepEqual(state.status === "ready" && [state.open.length, state.done.length], [0, 0]);
});

test("applying an older version than the one shown is ignored", () => {
  const state = applyTask(ready([task("a", 5, "inbox", "new")]), task("a", 4, "inbox", "old"));
  assert.deepEqual(state.status === "ready" && state.open[0]?.content, "new");
});
