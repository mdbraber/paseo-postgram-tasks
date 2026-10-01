import assert from "node:assert/strict";
import { test } from "node:test";
import { createPostgramClient } from "../server/postgram.ts";

interface Call { method: string; url: string; body: unknown; auth: string | null }

function fakeFetch(respond: (call: Call) => { status: number; body: unknown }) {
  const calls: Call[] = [];
  const impl = (async (input: string | URL | Request, init?: RequestInit) => {
    const headers = new Headers(init?.headers);
    const call: Call = {
      method: init?.method ?? "GET",
      url: String(input),
      body: init?.body ? JSON.parse(String(init.body)) : undefined,
      auth: headers.get("authorization"),
    };
    calls.push(call);
    const { status, body } = respond(call);
    return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
  }) as typeof fetch;
  return { impl, calls };
}

const entity = (id: string, extra: Record<string, unknown> = {}) => ({
  id, type: "task", content: `task ${id}`, status: "inbox", version: 1,
  tags: ["project:ops"], metadata: {}, updated_at: "2026-09-29T10:00:00Z", ...extra,
});
const config = { apiUrl: "http://pg:3100/", apiKey: "secret" };

test("lists every page for a tag", async () => {
  const all = Array.from({ length: 150 }, (_, i) => entity(`t${i}`));
  const { impl, calls } = fakeFetch((call) => {
    const url = new URL(call.url);
    const offset = Number(url.searchParams.get("offset"));
    const limit = Number(url.searchParams.get("limit"));
    return { status: 200, body: { items: all.slice(offset, offset + limit), total: all.length, limit, offset } };
  });
  const result = await createPostgramClient(config, impl).list("project:ops");
  assert.equal(result.ok && result.value.length, 150);
  assert.equal(calls.length, 2);
  const first = new URL(calls[0]!.url);
  assert.equal(first.origin + first.pathname, "http://pg:3100/api/entities");
  assert.equal(first.searchParams.get("type"), "task");
  assert.equal(first.searchParams.get("tags"), "project:ops");
  assert.equal(calls[0]!.auth, "Bearer secret");
});

test("lists all tasks without a tag filter", async () => {
  const { impl, calls } = fakeFetch(() => ({ status: 200, body: { items: [entity("t1"), entity("t2", { tags: ["project:blink"] })], total: 2 } }));
  const result = await createPostgramClient(config, impl).listAll();
  assert.equal(result.ok && result.value.length, 2);
  const url = new URL(calls[0]!.url);
  assert.equal(url.searchParams.get("type"), "task");
  assert.equal(url.searchParams.has("tags"), false);
});

test("maps entities to tasks, defaulting a null status to inbox", async () => {
  const { impl } = fakeFetch(() => ({ status: 200, body: { entity: entity("t1", { status: null, metadata: null }) } }));
  const result = await createPostgramClient(config, impl).get("t1");
  assert.deepEqual(result, {
    ok: true,
    value: { id: "t1", content: "task t1", status: "inbox", version: 1, tags: ["project:ops"], metadata: {}, updatedAt: "2026-09-29T10:00:00Z" },
  });
});

test("creates personal inbox tasks", async () => {
  const { impl, calls } = fakeFetch(() => ({ status: 201, body: { entity: entity("t1") } }));
  await createPostgramClient(config, impl).create({ content: "hello", tags: ["project:ops"] });
  assert.equal(calls[0]!.method, "POST");
  assert.equal(new URL(calls[0]!.url).pathname, "/api/tasks");
  assert.deepEqual(calls[0]!.body, { content: "hello", tags: ["project:ops"], status: "inbox", visibility: "personal" });
});

test("sends the version with updates and completes", async () => {
  const { impl, calls } = fakeFetch(() => ({ status: 200, body: { entity: entity("t1", { version: 4 }) } }));
  const client = createPostgramClient(config, impl);
  await client.update("t1", 3, { content: "new", metadata: { a: 1 } });
  await client.complete("t1", 4);
  assert.equal(calls[0]!.method, "PATCH");
  assert.deepEqual(calls[0]!.body, { version: 3, content: "new", metadata: { a: 1 } });
  assert.equal(new URL(calls[1]!.url).pathname, "/api/tasks/t1/complete");
  assert.deepEqual(calls[1]!.body, { version: 4 });
});

test("maps HTTP errors to error kinds with Postgram's message", async () => {
  const cases: [number, string][] = [[400, "invalid"], [401, "unauthorized"], [403, "forbidden"], [404, "not_found"], [409, "conflict"], [500, "server"]];
  for (const [status, kind] of cases) {
    const { impl } = fakeFetch(() => ({ status, body: { error: { code: "X", message: `boom ${status}` } } }));
    const result = await createPostgramClient(config, impl).get("t1");
    assert.deepEqual(result, { ok: false, error: { kind, message: `boom ${status}` } });
  }
});

test("a network failure is unreachable", async () => {
  const impl = (async () => { throw new TypeError("fetch failed"); }) as typeof fetch;
  const result = await createPostgramClient(config, impl).get("t1");
  assert.equal(result.ok ? "ok" : result.error.kind, "unreachable");
});
