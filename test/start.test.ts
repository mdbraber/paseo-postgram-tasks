import assert from "node:assert/strict";
import { test } from "node:test";
import { agentTitle, availableTargets, currentAgent, workspaceSource } from "../shared/start.ts";

test("worktrees only for git projects", () => {
  assert.deepEqual(availableTargets("git"), ["local", "worktree"]);
  assert.deepEqual(availableTargets("non_git"), ["local"]);
  assert.deepEqual(availableTargets("directory"), ["local"]);
});

test("builds workspace sources", () => {
  const project = { projectId: "p1", projectRootPath: "/src/app" };
  assert.deepEqual(workspaceSource("local", project), { kind: "directory", path: "/src/app", projectId: "p1" });
  assert.deepEqual(workspaceSource("worktree", project), { kind: "worktree", cwd: "/src/app", projectId: "p1", action: "branch-off" });
  assert.deepEqual(workspaceSource("worktree", project, " develop "), {
    kind: "worktree", cwd: "/src/app", projectId: "p1", action: "branch-off", refName: "develop",
  });
});

test("agent title is the task title, capped at 60 characters", () => {
  assert.equal(agentTitle("Fix backups\nmore"), "Fix backups");
  assert.equal(agentTitle("x".repeat(80)).length, 60);
});

test("Run here picks the workspace's most recent agent that isn't archived", () => {
  const agents = [
    { id: "old", workspaceId: "w1", updatedAt: "2026-09-01T00:00:00Z" },
    { id: "archived", workspaceId: "w1", archivedAt: "2026-09-03T00:00:00Z", updatedAt: "2026-09-03T00:00:00Z" },
    { id: "recent", workspaceId: "w1", archivedAt: null, updatedAt: "2026-09-02T00:00:00Z" },
    { id: "elsewhere", workspaceId: "w2", updatedAt: "2026-09-04T00:00:00Z" },
  ];
  assert.equal(currentAgent(agents, "w1")?.id, "recent");
  assert.equal(currentAgent(agents, "w3"), null);
});
