import assert from "node:assert/strict";
import { test } from "node:test";
import {
  draftFromTask, draftPatch, groupTasks, isDraftChanged, isIsoDate, moveOptions, startsCollapsed, taskBody, taskTitle, visibleTags,
  type Task,
} from "../shared/tasks.ts";

const task = (id: string, status: Task["status"], updatedAt: string): Task => ({
  id, content: id, status, version: 1, tags: [], metadata: {}, updatedAt,
});

test("title is the first non-empty line", () => {
  assert.equal(taskTitle("\n\n  Fix backups \nmore"), "Fix backups");
  assert.equal(taskTitle("   "), "Untitled task");
});

test("body is the rest, keeping line breaks", () => {
  assert.equal(taskBody("Title\n\nline one\nline two\n"), "line one\nline two");
  assert.equal(taskBody("Only a title"), "");
});

const FIELDS = ["context", "scheduled_for"];

test("an unchanged draft saves nothing", () => {
  const t = { ...task("a", "inbox", "2026-09-01T00:00:00Z"), metadata: { context: "@home" } };
  const draft = draftFromTask(t, FIELDS);
  assert.equal(isDraftChanged(t, draft), false);
  assert.deepEqual(draftPatch(t, draft), { ok: true, patch: {} });
});

test("a draft sends only what changed, clearing emptied fields", () => {
  const t = { ...task("a", "inbox", "2026-09-01T00:00:00Z"), metadata: { context: "@home" } };
  const draft = { content: "new text", status: "next" as const, fields: { context: "", scheduled_for: "" } };
  assert.equal(isDraftChanged(t, draft), true);
  assert.deepEqual(draftPatch(t, draft), {
    ok: true,
    patch: { content: "new text", status: "next", metadata: { context: null } },
  });
});

test("a draft can't be saved empty, with a bad date, or scheduled without a date", () => {
  const t = task("a", "inbox", "2026-09-01T00:00:00Z");
  const draft = draftFromTask(t, FIELDS);
  assert.equal(draftPatch(t, { ...draft, content: "  " }).ok, false);
  assert.equal(draftPatch(t, { ...draft, fields: { ...draft.fields, scheduled_for: "tomorrow" } }).ok, false);
  assert.equal(draftPatch(t, { ...draft, status: "scheduled" }).ok, false);
  assert.deepEqual(draftPatch(t, { ...draft, status: "scheduled", fields: { ...draft.fields, scheduled_for: "2026-10-01" } }), {
    ok: true,
    patch: { status: "scheduled", metadata: { scheduled_for: "2026-10-01" } },
  });
});

test("groups open tasks by status, newest first, dropping done and archived", () => {
  const groups = groupTasks([
    task("a", "inbox", "2026-09-01T00:00:00Z"),
    task("b", "inbox", "2026-09-02T00:00:00Z"),
    task("c", "waiting", "2026-09-01T00:00:00Z"),
    task("f", "active", "2026-09-01T00:00:00Z"),
    task("d", "done", "2026-09-03T00:00:00Z"),
    task("e", "archived", "2026-09-03T00:00:00Z"),
  ]);
  assert.deepEqual(groups.inbox.map((t) => t.id), ["b", "a"]);
  assert.deepEqual(groups.waiting.map((t) => t.id), ["c"]);
  assert.deepEqual(groups.active.map((t) => t.id), ["f"]);
  assert.deepEqual(groups.next, []);
  assert.deepEqual(groups.scheduled, []);
  assert.deepEqual(groups.someday, []);
});

test("empty sections and scheduled/someday start collapsed", () => {
  assert.equal(startsCollapsed("inbox", 0), true);
  assert.equal(startsCollapsed("inbox", 2), false);
  assert.equal(startsCollapsed("scheduled", 3), true);
  assert.equal(startsCollapsed("someday", 1), true);
});

test("move options follow Postgram's order and skip the current status", () => {
  assert.deepEqual(moveOptions("inbox").map((o) => o.status), ["next", "active", "waiting", "scheduled", "someday", "done"]);
  assert.deepEqual(moveOptions("next").map((o) => o.status), ["done", "inbox", "active", "waiting", "scheduled", "someday"]);
  assert.equal(moveOptions("inbox").find((o) => o.status === "scheduled")?.needsDate, true);
  assert.equal(moveOptions("inbox").find((o) => o.status === "scheduled")?.label, "Schedule");
});

test("hides project tags", () => {
  assert.deepEqual(visibleTags(["project:ops", "infra", "project:x"]), ["infra"]);
});

test("accepts only real YYYY-MM-DD dates", () => {
  assert.equal(isIsoDate("2026-10-01"), true);
  assert.equal(isIsoDate("2026-02-30"), false);
  assert.equal(isIsoDate("1 oct"), false);
});

test("clearing a metadata field sends null so Postgram's merge removes it", async () => {
  const { editMetadata } = await import("../shared/tasks.ts");
  assert.deepEqual(editMetadata({ due_date: "2026-10-01", other: 1 }, "due_date", "  "), { due_date: null, other: 1 });
});

test("editing metadata trims text and stores whole-number priorities as numbers", async () => {
  const { editMetadata } = await import("../shared/tasks.ts");
  assert.deepEqual(editMetadata({}, "context", " @home "), { context: "@home" });
  assert.deepEqual(editMetadata({}, "priority", "2"), { priority: 2 });
  assert.deepEqual(editMetadata({}, "priority", "high"), { priority: "high" });
});

test("metadata text shows cleared and missing values as empty", async () => {
  const { metadataText } = await import("../shared/tasks.ts");
  assert.equal(metadataText({ a: null }, "a"), "");
  assert.equal(metadataText({}, "a"), "");
  assert.equal(metadataText({ a: 2 }, "a"), "2");
});

test("a task can be scheduled only with a valid scheduled date", async () => {
  const { canSchedule } = await import("../shared/tasks.ts");
  assert.equal(canSchedule({ scheduled_for: "2026-10-01" }), true);
  assert.equal(canSchedule({ scheduled_for: null }), false);
  assert.equal(canSchedule({}), false);
  assert.equal(canSchedule({ scheduled_for: "soon" }), false);
});
