import assert from "node:assert/strict";
import { test } from "node:test";
import { createHandlers } from "../server/handlers.ts";
import type { PostgramClient, TaskPatch } from "../server/postgram.ts";
import { fail, ok, type Result } from "../shared/result.ts";
import { readRuns, type TaskRun } from "../shared/runs.ts";
import type { Task } from "../shared/tasks.ts";

const base: Task = { id: "t1", content: "Fix it", status: "inbox", version: 1, tags: ["project:ops"], metadata: { context: "@computer" }, updatedAt: "2026-09-29T10:00:00Z" };
const run: TaskRun = { agentId: "a1", serverId: "srv", hostLabel: "mbp", workspaceId: "w1", profileId: null, startedAt: "2026-09-29T12:00:00Z" };

function fakeClient(overrides: Partial<PostgramClient> = {}) {
  const updates: { id: string; version: number; patch: TaskPatch }[] = [];
  const completed: string[] = [];
  const client: PostgramClient = {
    list: async () => ok([base]),
    listByStatus: async () => ok([]),
    get: async () => ok(base),
    create: async ({ content, tags }) => ok({ ...base, content, tags }),
    update: async (id, version, patch) => {
      updates.push({ id, version, patch });
      return ok({ ...base, ...patch, version: version + 1 } as Task);
    },
    complete: async (id) => { completed.push(id); return ok({ ...base, status: "done" }); },
    ...overrides,
  };
  return { client, updates, completed };
}
const withRuns = (status: Task["status"], agentIds: string[]): Task => ({
  ...base, status, metadata: { paseo: { runs: agentIds.map((agentId, i) => ({ ...run, agentId, startedAt: `2026-09-2${i}T00:00:00Z` })) } },
});
const handlersFor = (client: PostgramClient) => createHandlers(async () => ok(client));

test("splits open and recent done tasks for the project tag", async () => {
  let asked = "";
  const done = (i: number): Task => ({ ...base, id: `d${i}`, status: "done", updatedAt: `2026-09-${String(10 + i).padStart(2, "0")}T00:00:00Z` });
  const { client } = fakeClient({
    list: async (tag) => { asked = tag; return ok([base, ...Array.from({ length: 12 }, (_, i) => done(i))]); },
  });
  const result = await handlersFor(client).list({ taskKey: "ops" });
  assert.equal(asked, "project:ops");
  assert.ok(result.ok);
  if (result.ok) {
    assert.deepEqual(result.value.open.map((t) => t.id), ["t1"]);
    assert.equal(result.value.done.length, 10);
    assert.equal(result.value.done[0]!.id, "d11", "newest done first");
  }
});

test("creates with the project tag and trimmed content", async () => {
  let created: { content: string; tags: string[] } | undefined;
  const { client } = fakeClient({ create: async (input) => { created = input; return ok(base); } });
  await handlersFor(client).create({ taskKey: "ops", content: "  Fix backups \n" });
  assert.deepEqual(created, { content: "Fix backups", tags: ["project:ops"] });
});

test("rejects blank content on create and update without calling Postgram", async () => {
  const { client, updates } = fakeClient({ create: async () => { throw new Error("must not be called"); } });
  const handlers = handlersFor(client);
  const created = await handlers.create({ taskKey: "ops", content: "  \n " });
  const updated = await handlers.update({ id: "t1", version: 1, patch: { content: "   " } });
  assert.equal(created.ok ? "ok" : created.error.kind, "invalid");
  assert.equal(updated.ok ? "ok" : updated.error.kind, "invalid");
  assert.equal(updates.length, 0);
});

test("records a run: waiting, keeps metadata, appends the run", async () => {
  const { client, updates } = fakeClient();
  const result = await handlersFor(client).recordRun({ id: "t1", run });
  assert.ok(result.ok);
  assert.equal(updates.length, 1);
  assert.equal(updates[0]!.patch.status, "active");
  assert.equal(updates[0]!.patch.metadata?.context, "@computer");
  assert.deepEqual(readRuns(updates[0]!.patch.metadata ?? {}), [run]);
});

test("retries a run record once after a version conflict, against the fresh task", async () => {
  let gets = 0;
  let attempts = 0;
  const { client } = fakeClient({
    get: async () => { gets++; return ok({ ...base, version: gets === 1 ? 1 : 2, metadata: { context: gets === 1 ? "@a" : "@b" } }); },
    update: async (_id, version, patch) => {
      attempts++;
      return attempts === 1 ? fail("conflict", "stale") : ok({ ...base, ...patch, version: version + 1 } as Task);
    },
  });
  const result = await handlersFor(client).recordRun({ id: "t1", run });
  assert.ok(result.ok);
  assert.equal(attempts, 2);
  if (result.ok) assert.equal(result.value.metadata.context, "@b");
});

test("gives up after a second conflict", async () => {
  const { client } = fakeClient({ update: async () => fail("conflict", "stale") });
  const result = await handlersFor(client).recordRun({ id: "t1", run });
  assert.equal(result.ok ? "ok" : result.error.kind, "conflict");
});

test("passes a missing config through as the error", async () => {
  const handlers = createHandlers(async () => fail("not_configured", "No Postgram config at /x"));
  const result = await handlers.list({ taskKey: "ops" });
  assert.deepEqual(result, { ok: false, error: { kind: "not_configured", message: "No Postgram config at /x" } });
});

test("archiving a labelled task's latest agent completes the task", async () => {
  const { client, completed } = fakeClient({ get: async () => ok(withRuns("active", ["a0", "a1"])) });
  const result = await handlersFor(client).agentArchived({ agentId: "a1", taskId: "t1" });
  assert.ok(result.ok);
  assert.deepEqual(completed, ["t1"]);
});

test("archiving an unlabelled agent finds its task among active tasks", async () => {
  let asked = "";
  const { client, completed } = fakeClient({
    listByStatus: async (status) => { asked = status; return ok([{ ...withRuns("active", ["x"]), id: "t0" }, withRuns("active", ["a1"])]); },
    get: async () => ok(withRuns("active", ["a1"])),
  });
  await handlersFor(client).agentArchived({ agentId: "a1", taskId: null });
  assert.equal(asked, "active");
  assert.deepEqual(completed, ["t1"]);
});

test("archiving an agent that no task started changes nothing", async () => {
  const { client, completed, updates } = fakeClient({ listByStatus: async () => ok([withRuns("active", ["x"])]) });
  const result = await handlersFor(client).agentArchived({ agentId: "a1", taskId: null });
  assert.deepEqual(result, ok(null));
  assert.deepEqual(completed, []);
  assert.equal(updates.length, 0);
});

test("an agent working again reopens its done task", async () => {
  const { client, updates } = fakeClient({ get: async () => ok(withRuns("done", ["a1"])) });
  await handlersFor(client).agentTurnStarted({ agentId: "a1", taskId: "t1" });
  assert.equal(updates[0]?.patch.status, "active");
});

test("an agent working on an open task leaves its status alone", async () => {
  const { client, updates } = fakeClient({ get: async () => ok(withRuns("waiting", ["a1"])) });
  await handlersFor(client).agentTurnStarted({ agentId: "a1", taskId: "t1" });
  assert.equal(updates.length, 0);
});

test("activating sets any other status to active and skips active tasks", async () => {
  const done = fakeClient({ get: async () => ok(withRuns("done", ["a1"])) });
  await handlersFor(done.client).activate({ id: "t1" });
  assert.equal(done.updates[0]?.patch.status, "active");
  const active = fakeClient({ get: async () => ok(withRuns("active", ["a1"])) });
  await handlersFor(active.client).activate({ id: "t1" });
  assert.equal(active.updates.length, 0);
});

test("a status change retries once after a version conflict", async () => {
  let attempts = 0;
  const { client } = fakeClient({
    get: async () => ok(withRuns("done", ["a1"])),
    update: async (_id, version, patch) => {
      attempts++;
      return attempts === 1 ? fail("conflict", "stale") : ok({ ...base, ...patch, version: version + 1 } as Task);
    },
  });
  const result = await handlersFor(client).activate({ id: "t1" });
  assert.ok(result.ok);
  assert.equal(attempts, 2);
});
