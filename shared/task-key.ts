// A task key names a project's task list in Postgram. It becomes the tag `project:<key>`.

export function normalizeTaskKey(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function defaultTaskKey(projectRootPath: string): string {
  const folder = projectRootPath.replace(/[\\/]+$/, "").split(/[\\/]/).pop() ?? "";
  return normalizeTaskKey(folder) || "project";
}

export function resolveTaskKey(stored: string | undefined, projectRootPath: string): string {
  const key = stored === undefined ? "" : normalizeTaskKey(stored);
  return key || defaultTaskKey(projectRootPath);
}

export function projectTag(taskKey: string): string {
  return `project:${taskKey}`;
}
