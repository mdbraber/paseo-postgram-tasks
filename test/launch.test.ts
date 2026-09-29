import assert from "node:assert/strict";
import { test } from "node:test";
import { agentConfig, providerOptions, resolveChoice, workspaceChoice } from "../shared/launch.ts";

const entries = [
  {
    provider: "claude", status: "ready", label: "Claude", defaultModeId: "auto",
    modes: [{ id: "auto", label: "Auto mode" }, { id: "bypass", label: "Bypass" }],
    models: [
      { id: "sonnet", label: "Sonnet", thinkingOptions: [{ id: "low", label: "Low" }] },
      {
        id: "opus", label: "Opus", isDefault: true, defaultThinkingOptionId: "medium",
        thinkingOptions: [{ id: "medium", label: "Medium" }, { id: "high", label: "High" }],
      },
      { id: "hidden", label: "Hidden", isSelectable: false },
    ],
  },
  { provider: "codex", status: "unavailable", models: [{ id: "gpt", label: "GPT" }] },
  { provider: "pi", status: "ready", enabled: false, models: [{ id: "x", label: "X" }] },
  { provider: "empty", status: "ready", models: [] },
];

test("offers ready, enabled providers with selectable models", () => {
  const providers = providerOptions(entries);
  assert.deepEqual(providers.map((entry) => entry.provider), ["claude"]);
  assert.deepEqual(providers[0]!.models.map((model) => model.id), ["sonnet", "opus"]);
});

test("defaults to the provider's default model, thinking level and mode", () => {
  assert.deepEqual(resolveChoice(providerOptions(entries), null), {
    provider: "claude", model: "opus", thinkingOptionId: "medium", modeId: "auto",
  });
  assert.equal(resolveChoice([], null), null);
});

test("keeps what was asked for where it exists, and falls back where it doesn't", () => {
  const providers = providerOptions(entries);
  assert.deepEqual(resolveChoice(providers, { provider: "claude", model: "opus", thinkingOptionId: "high", modeId: "bypass" }), {
    provider: "claude", model: "opus", thinkingOptionId: "high", modeId: "bypass",
  });
  // Switching to a model without "high" takes that model's own thinking options.
  assert.deepEqual(resolveChoice(providers, { provider: "claude", model: "sonnet", thinkingOptionId: "high" }), {
    provider: "claude", model: "sonnet", modeId: "auto",
  });
  assert.equal(resolveChoice(providers, { provider: "codex", model: "gpt" })?.model, "opus");
});

test("copies the workspace's latest agent", () => {
  const agents = [
    { provider: "claude", model: "sonnet", workspaceId: "w1", updatedAt: "2026-09-01T00:00:00Z" },
    { provider: "claude", model: "opus", thinkingOptionId: "high", currentModeId: "bypass", workspaceId: "w1", updatedAt: "2026-09-02T00:00:00Z" },
    { provider: "codex", model: "gpt", workspaceId: "w2", updatedAt: "2026-09-03T00:00:00Z" },
  ];
  assert.deepEqual(workspaceChoice(agents, "w1"), { provider: "claude", model: "opus", thinkingOptionId: "high", modeId: "bypass" });
  assert.equal(workspaceChoice(agents, "none"), null);
});

test("builds the agent config Paseo expects", () => {
  assert.deepEqual(agentConfig({ provider: "claude", model: "opus", modeId: "auto" }), { provider: "claude/opus", modeId: "auto" });
});
