import assert from "node:assert/strict";
import { test } from "node:test";
import { settingsRpc } from "@getpaseo/plugin";
import { projectSettings, withProjectSettings } from "../shared/settings.ts";

const write = settingsRpc(projectSettings.id).write.input;

test("unset fields are left out, since Paseo only saves plain JSON", () => {
  const values = withProjectSettings({ projects: {} }, "p1", { taskKey: "ops", filterTags: undefined, defaultProfileId: undefined });
  assert.deepEqual(values, { projects: { p1: { taskKey: "ops" } } });
  assert.equal(write.safeParse({ revision: "1", values }).success, true);
});

test("keeps the other projects and replaces this one", () => {
  const before = { projects: { p1: { taskKey: "ops", filterTags: ["spiff"] }, p2: { taskKey: "blink" } } };
  const values = withProjectSettings(before, "p1", { taskKey: "devops", filterTags: ["zark"] });
  assert.deepEqual(values, { projects: { p1: { taskKey: "devops", filterTags: ["zark"] }, p2: { taskKey: "blink" } } });
});
