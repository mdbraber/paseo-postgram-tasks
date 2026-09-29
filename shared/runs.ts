import { z } from "zod";
import type { Task, TaskStatus } from "./tasks.ts";

export const TaskRunSchema = z.object({
  agentId: z.string(),
  serverId: z.string(),
  hostLabel: z.string(),
  workspaceId: z.string(),
  profileId: z.string().nullable(),
  startedAt: z.string(),
});
export type TaskRun = z.infer<typeof TaskRunSchema>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function readRuns(metadata: Record<string, unknown>): TaskRun[] {
  const paseo = metadata.paseo;
  if (!isRecord(paseo) || !Array.isArray(paseo.runs)) return [];
  return paseo.runs.flatMap((entry) => {
    const parsed = TaskRunSchema.safeParse(entry);
    return parsed.success ? [parsed.data] : [];
  });
}

export function withRun(metadata: Record<string, unknown>, run: TaskRun): Record<string, unknown> {
  const paseo = isRecord(metadata.paseo) ? metadata.paseo : {};
  return { ...metadata, paseo: { ...paseo, runs: [...readRuns(metadata), run] } };
}

// Agents started from a task carry its id, so agent events can find the task.
export const TASK_LABEL = "postgram-task";

export function latestRun(runs: readonly TaskRun[]): TaskRun | null {
  return runs.reduce<TaskRun | null>((latest, run) => (latest && latest.startedAt > run.startedAt ? latest : run), null);
}

/** What the task's latest agent is doing: still around, archived, or not readable from here. */
export type AgentState = "live" | "archived" | "unknown";

/** Which actions a task offers: open its running agent, continue it, or start one. */
export type TaskActions = "open" | "continue" | "start";

export function taskActions(task: Task, agent: AgentState): TaskActions {
  if (!latestRun(readRuns(task.metadata))) return "start";
  if (agent === "live") return "open";
  if (agent === "archived" || task.status === "done") return "continue";
  return "start";
}

// Archiving a task's latest agent finishes the task.
export function statusAfterArchive(task: Task, agentId: string): TaskStatus | null {
  if (task.status === "done" || task.status === "archived") return null;
  return latestRun(readRuns(task.metadata))?.agentId === agentId ? "done" : null;
}

// One of a done task's agents working again reopens the task.
export function statusAfterTurn(task: Task, agentId: string): TaskStatus | null {
  if (task.status !== "done") return null;
  return readRuns(task.metadata).some((run) => run.agentId === agentId) ? "active" : null;
}
