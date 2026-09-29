import { taskTitle } from "./tasks.ts";

// The isolation choices of Paseo's New workspace screen.
export type StartTarget = "local" | "worktree";

export const START_TARGET_LABELS: Record<StartTarget, string> = {
  local: "Local",
  worktree: "New worktree",
};

export function availableTargets(projectKind: "git" | "non_git" | "directory"): StartTarget[] {
  return projectKind === "git" ? ["local", "worktree"] : ["local"];
}

export type WorkspaceSource =
  | { kind: "directory"; path: string; projectId: string }
  | { kind: "worktree"; cwd: string; projectId: string; action: "branch-off"; refName?: string };

// `baseRef` is the branch a new worktree starts from; empty means the project's default.
export function workspaceSource(
  target: StartTarget,
  project: { projectId: string; projectRootPath: string },
  baseRef = "",
): WorkspaceSource {
  if (target === "local") return { kind: "directory", path: project.projectRootPath, projectId: project.projectId };
  const ref = baseRef.trim();
  return {
    kind: "worktree", cwd: project.projectRootPath, projectId: project.projectId, action: "branch-off",
    ...(ref ? { refName: ref } : {}),
  };
}

export function agentTitle(content: string): string {
  return taskTitle(content).slice(0, 60);
}

export interface WorkspaceAgentEntry {
  id: string;
  workspaceId?: string;
  archivedAt?: string | null;
  updatedAt: string;
}

// The agent "Run in this workspace" sends to: the workspace's most recently active agent that isn't archived.
export function currentAgent<Agent extends WorkspaceAgentEntry>(agents: readonly Agent[], workspaceId: string): Agent | null {
  return agents
    .filter((agent) => agent.workspaceId === workspaceId && !agent.archivedAt)
    .reduce<Agent | null>((best, agent) => (best && best.updatedAt >= agent.updatedAt ? best : agent), null);
}
