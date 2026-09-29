import type { PluginHookContext, PluginServerContext } from "@getpaseo/plugin/server";
import { configPath, loadPostgramConfig } from "./server/config.ts";
import { createHandlers } from "./server/handlers.ts";
import { createPostgramClient } from "./server/postgram.ts";
import { activateTask, completeTask, createTask, getTask, listTasks, recordRun, updateTask } from "./shared/contracts.ts";
import { ok } from "./shared/result.ts";
import { TASK_LABEL } from "./shared/runs.ts";
import { projectSettings } from "./shared/settings.ts";

async function taskIdOf(paseo: PluginHookContext["paseo"], agentId: string): Promise<string | null> {
  const result = await paseo.agents.ref(agentId).refresh().catch(() => null);
  return result?.agent.labels?.[TASK_LABEL] ?? null;
}

export default function contribute(server: PluginServerContext) {
  server.registerSettings(projectSettings);

  // Read the config on every call so a new or fixed file works without a reload.
  const handlers = createHandlers(async () => {
    const config = await loadPostgramConfig(configPath());
    return config.ok ? ok(createPostgramClient(config.value)) : config;
  });

  server.handle(listTasks, handlers.list);
  server.handle(getTask, handlers.get);
  server.handle(createTask, handlers.create);
  server.handle(updateTask, handlers.update);
  server.handle(completeTask, handlers.complete);
  server.handle(recordRun, handlers.recordRun);
  server.handle(activateTask, handlers.activate);

  // Keep a task's status in step with its agent on the host that runs the agent.
  const stopArchived = server.on("agent.archived", async ({ agent }, { paseo }) => {
    await handlers.agentArchived({ agentId: agent.id, taskId: await taskIdOf(paseo, agent.id) });
  });
  const stopTurn = server.on("agent.turn_started", async ({ agent }, { paseo }) => {
    const taskId = await taskIdOf(paseo, agent.id);
    if (taskId) await handlers.agentTurnStarted({ agentId: agent.id, taskId });
  });

  return () => {
    stopArchived();
    stopTurn();
  };
}
