import { getPaseoClient, useHosts } from "@getpaseo/plugin/client";
import { useEffect, useState } from "react";
import { latestRun, readRuns, type AgentState } from "../shared/runs.ts";
import type { Task } from "../shared/tasks.ts";

// Follows the task's latest agent on whichever host runs it; "unknown" while that host is offline.
export function useAgentState(task: Task): AgentState {
  const hosts = useHosts();
  const run = latestRun(readRuns(task.metadata));
  const online = run !== null && hosts.some((host) => host.serverId === run.serverId && host.status === "online");
  const [state, setState] = useState<AgentState>("unknown");
  const agentId = run?.agentId;
  const serverId = run?.serverId;

  useEffect(() => {
    setState("unknown");
    if (!agentId || !serverId || !online) return;
    let cancelled = false;
    const show = (agent: { archivedAt?: string | null } | null) => {
      if (!cancelled) setState(agent ? (agent.archivedAt ? "archived" : "live") : "unknown");
    };
    let stop = () => {};
    try {
      const paseo = getPaseoClient(serverId);
      paseo.agents.ref(agentId).refresh().then((result) => show(result?.agent ?? null), () => show(null));
      stop = paseo.agents.subscribe((update) => {
        if (update.kind === "upsert" && update.agent.id === agentId) show(update.agent);
      });
    } catch {
      show(null);
    }
    return () => {
      cancelled = true;
      stop();
    };
    // A task update (from a status change or a new run) re-reads the agent.
  }, [agentId, serverId, online, task.updatedAt]);

  return state;
}
