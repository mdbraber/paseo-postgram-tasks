import assert from "node:assert/strict";
import { test } from "node:test";
import { configPath, loadPostgramConfig } from "../server/config.ts";

test("config lives in PASEO_HOME, defaulting to ~/.paseo", () => {
  assert.equal(configPath({ PASEO_HOME: "/data/paseo" }, "/home/user"), "/data/paseo/postgram-tasks.json");
  assert.equal(configPath({}, "/home/user"), "/home/user/.paseo/postgram-tasks.json");
});

test("loads a valid file", async () => {
  const result = await loadPostgramConfig("/x", async () => '{"apiUrl":"http://pg:3100","apiKey":"k"}');
  assert.deepEqual(result, { ok: true, value: { apiUrl: "http://pg:3100", apiKey: "k" } });
});

test("a missing file is not_configured and names the path", async () => {
  const result = await loadPostgramConfig("/x/postgram-tasks.json", async () => {
    throw Object.assign(new Error("nope"), { code: "ENOENT" });
  });
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error.kind, "not_configured");
    assert.match(result.error.message, /\/x\/postgram-tasks\.json/);
  }
});

test("bad JSON or a missing key is not_configured", async () => {
  for (const body of ["{", '{"apiUrl":"http://pg"}', '{"apiUrl":"not a url","apiKey":"k"}']) {
    const result = await loadPostgramConfig("/x", async () => body);
    assert.equal(result.ok ? "ok" : result.error.kind, "not_configured", body);
  }
});
