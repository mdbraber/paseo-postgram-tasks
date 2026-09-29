import assert from "node:assert/strict";
import { test } from "node:test";
import { readRuns, statusAfterArchive, statusAfterTurn, taskActions, withRun, type TaskRun } from "../shared/runs.ts";
import type { Task } from "../shared/tasks.ts";

const run: TaskRun = {
  agentId: "a1", serverId: "srv", hostLabel: "laptop", workspaceId: "w1",
  profileId: null, startedAt: "2026-09-29T12:00:00Z",
};

test("no runs when metadata has none", () => {
  assert.deepEqual(readRuns({}), []);
});

test("ignores malformed paseo metadata", () => {
  assert.deepEqual(readRuns({ paseo: "oops" }), []);
  assert.deepEqual(readRuns({ paseo: { runs: "oops" } }), []);
  assert.deepEqual(readRuns({ paseo: { runs: [{ agentId: 1 }, run] } }), [run]);
});

test("appends a run and keeps every other key", () => {
  const before = { context: "@computer", priority: 2, paseo: { runs: [run], other: true } };
  const after = withRun(before, { ...run, agentId: "a2" });
  assert.equal(after.context, "@computer");
  assert.equal(after.priority, 2);
  assert.deepEqual((after.paseo as { other: boolean }).other, true);
  assert.deepEqual(readRuns(after).map((r) => r.agentId), ["a1", "a2"]);
  assert.deepEqual(readRuns(before).map((r) => r.agentId), ["a1"], "input is not mutated");
});

const task = (status: Task["status"], runs: TaskRun[]): Task => ({
  id: "t1", content: "Fix it", status, version: 1, tags: [], metadata: runs.length ? { paseo: { runs } } : {}, updatedAt: "2026-09-29T10:00:00Z",
});
const older: TaskRun = { ...run, agentId: "a0", startedAt: "2026-09-28T12:00:00Z" };

test("a task without runs can only be started", () => {
  assert.equal(taskActions(task("inbox", []), "unknown"), "start");
});

test("a live agent can only be opened, even when the task is done", () => {
  assert.equal(taskActions(task("active", [run]), "live"), "open");
  assert.equal(taskActions(task("done", [run]), "live"), "open");
});

test("an archived agent or a done task can be continued", () => {
  assert.equal(taskActions(task("active", [run]), "archived"), "continue");
  assert.equal(taskActions(task("done", [run]), "unknown"), "continue");
});

test("an agent whose state can't be read leaves Start available", () => {
  assert.equal(taskActions(task("active", [run]), "unknown"), "start");
});

test("archiving the task's latest agent marks it done", () => {
  assert.equal(statusAfterArchive(task("active", [older, run]), "a1"), "done");
  assert.equal(statusAfterArchive(task("waiting", [run]), "a1"), "done");
});

test("archiving an older agent, or one of a finished task, changes nothing", () => {
  assert.equal(statusAfterArchive(task("active", [older, run]), "a0"), null);
  assert.equal(statusAfterArchive(task("done", [run]), "a1"), null);
  assert.equal(statusAfterArchive(task("archived", [run]), "a1"), null);
  assert.equal(statusAfterArchive(task("active", [run]), "other"), null);
});

test("a done task's agent working again makes the task active", () => {
  assert.equal(statusAfterTurn(task("done", [older, run]), "a0"), "active");
  assert.equal(statusAfterTurn(task("next", [run]), "a1"), null);
  assert.equal(statusAfterTurn(task("done", [run]), "other"), null);
});
