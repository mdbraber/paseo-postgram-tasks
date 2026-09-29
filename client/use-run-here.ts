import { usePaseo, useRpc } from "@getpaseo/plugin/client";
import { useToast } from "@getpaseo/plugin/client/react-native";
import { useRef } from "react";
import { describeError } from "./describe-error.ts";
import type { LaunchOptions } from "./use-launch-options.ts";
import { recordRun } from "../shared/contracts.ts";
import { agentConfig, resolveChoice } from "../shared/launch.ts";
import { TASK_LABEL } from "../shared/runs.ts";
import { agentTitle, currentAgent } from "../shared/start.ts";
import type { Task } from "../shared/tasks.ts";

// Sends the task text to this workspace's current agent, or starts one here when there is none.
// Resolves to the agent it went to, or null when nothing was sent.
export function useRunHere(options: { workspaceId: string; host: { id: string; label: string }; launch: LaunchOptions }) {
  const paseo = usePaseo();
  const toast = useToast();
  const record = useRpc(recordRun);
  const busy = useRef(false);

  return async function runHere(task: Task): Promise<{ agentId: string; task: Task | null } | null> {
    if (busy.current) return null;
    busy.current = true;
    let agentId: string;
    try {
      const { entries } = await paseo.agents.list({ sort: [{ key: "updated_at", direction: "desc" }], page: { limit: 200 } });
      const existing = currentAgent(entries.map((entry) => entry.agent), options.workspaceId);
      if (existing) {
        await paseo.agents.ref(existing.id).send(task.content);
        agentId = existing.id;
      } else {
        const choice = resolveChoice(options.launch.providers ?? [], options.launch.preferred);
        if (!choice) throw new Error(options.launch.error ?? "No agent providers are available on this host.");
        const agent = await paseo.workspaces.ref(options.workspaceId).agents.create({
          config: agentConfig(choice),
          prompt: task.content,
          title: agentTitle(task.content),
          labels: { [TASK_LABEL]: task.id },
        });
        agentId = agent.id;
      }
    } catch (error) {
      toast.error(`Couldn't run the task here: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    } finally {
      busy.current = false;
    }
    // The agent has the task; a failed update only leaves the card without its link.
    const result = await record({
      id: task.id,
      run: {
        agentId, workspaceId: options.workspaceId, serverId: options.host.id, hostLabel: options.host.label,
        profileId: null, startedAt: new Date().toISOString(),
      },
    });
    if (!result.ok) toast.error(`The agent has the task, but the task couldn't be updated: ${describeError(result.error)}`);
    return { agentId, task: result.ok ? result.value : null };
  };
}
