import type { PluginClientContext } from "@getpaseo/plugin/client";
import { settingsRpc } from "@getpaseo/plugin";
import { describeError } from "./client/describe-error.ts";
import { TasksPanel } from "./client/tasks-panel.tsx";
import { createTask } from "./shared/contracts.ts";
import { projectSettings } from "./shared/settings.ts";
import { TASKS_PANEL_ID, tasksPanelLocation } from "./shared/panel.ts";
import { resolveTaskKey } from "./shared/task-key.ts";
import { Platform } from "react-native";

export default function contribute(client: PluginClientContext) {
  const location = tasksPanelLocation(Platform.OS);
  const cleanups = [
    client.addWorkspacePanel({
      id: TASKS_PANEL_ID,
      title: "Tasks",
      icon: "ListTodo",
      context: "workspace",
      locations: ["workspace", "explorer"],
      Component: TasksPanel,
    }),
    client.addSlashCommand({
      name: "task",
      description: "Save a note as a task in this project's Postgram list",
      argumentHint: "<what needs doing>",
      context: "agent",
      async onSubmit({ args, workspace, rpc, openPanel }) {
        const content = args.trim();
        if (!content) throw new Error("Usage: /task <what needs doing>");
        // settingsRpc(id).read returns { status, revision, values } with untyped values.
        const read = await rpc(settingsRpc(projectSettings.id).read, {});
        const parsed = read.status === "ready" ? projectSettings.schema.safeParse(read.values) : null;
        const stored = parsed?.success ? parsed.data.projects[workspace.projectId] : undefined;
        const taskKey = resolveTaskKey(stored?.taskKey, workspace.projectRootPath);
        const result = await rpc(createTask, { taskKey, tags: stored?.filterTags, content });
        if (!result.ok) throw new Error(describeError(result.error));
        openPanel(TASKS_PANEL_ID, { location });
      },
    }),
    client.addCommandCenterItem({
      id: "open-tasks",
      title: "Open Tasks",
      icon: "ListTodo",
      keywords: ["tasks", "todo", "postgram"],
      context: "workspace",
      onSelect({ openPanel }) {
        openPanel(TASKS_PANEL_ID, { location });
      },
    }),
  ];
  return () => {
    for (const cleanup of cleanups) cleanup();
  };
}
