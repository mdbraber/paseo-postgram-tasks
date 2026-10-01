import { useSettings, useWorkspace } from "@getpaseo/plugin/client";
import { useCallback } from "react";
import { projectSettings, withProjectSettings, type ProjectSettings } from "../shared/settings.ts";
import { cleanTags } from "../shared/filter.ts";
import { defaultTaskKey, resolveTaskKey } from "../shared/task-key.ts";

export interface ProjectInfo {
  projectId: string;
  projectRootPath: string;
  projectKind: "git" | "non_git" | "directory";
  displayName: string;
  taskKey: string;
  /** The key the project's folder gives it. */
  defaultTaskKey: string;
  /** Only tasks carrying all of these tags are shown. */
  filterTags: string[];
  defaultProfileId: string | undefined;
  saveProjectSettings(next: ProjectSettings): Promise<boolean>;
}

export function useProject(workspaceId: string): ProjectInfo | null {
  const workspace = useWorkspace(workspaceId, (w) => ({
    projectId: w.projectId,
    projectRootPath: w.projectRootPath,
    projectKind: w.projectKind,
    displayName: w.projectDisplayName,
  }));
  const settings = useSettings(projectSettings);

  const saveProjectSettings = useCallback(
    async (next: ProjectSettings) => {
      if (settings.status !== "ready" || !workspace) return false;
      return settings.save(withProjectSettings(settings.values, workspace.projectId, next), settings.revision);
    },
    [settings, workspace],
  );

  if (!workspace || settings.status !== "ready") return null;
  const stored = settings.values.projects[workspace.projectId] ?? {};
  return {
    ...workspace,
    taskKey: resolveTaskKey(stored.taskKey, workspace.projectRootPath),
    defaultTaskKey: defaultTaskKey(workspace.projectRootPath),
    filterTags: cleanTags(stored.filterTags ?? []),
    defaultProfileId: stored.defaultProfileId,
    saveProjectSettings,
  };
}
