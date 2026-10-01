import { projectTag } from "./task-key.ts";

// A panel shows one project's tasks, optionally narrowed to those carrying every chosen tag.

const PROJECT_PREFIX = "project:";

interface Tagged {
  tags: readonly string[];
}

function sortedUnique(values: string[]): string[] {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}

export function projectKeys(tasks: readonly Tagged[]): string[] {
  const keys = tasks.flatMap((task) => task.tags.filter((tag) => tag.startsWith(PROJECT_PREFIX)).map((tag) => tag.slice(PROJECT_PREFIX.length)));
  return sortedUnique(keys.filter(Boolean));
}

export function narrowingTags(tasks: readonly Tagged[]): string[] {
  return sortedUnique(tasks.flatMap((task) => task.tags.filter((tag) => !tag.startsWith(PROJECT_PREFIX))));
}

export function matchesTags(task: Tagged, tags: readonly string[]): boolean {
  return tags.every((tag) => task.tags.includes(tag));
}

// Narrowing tags as stored: a task keeps exactly one project tag, so those are dropped.
export function cleanTags(tags: readonly string[]): string[] {
  return [...new Set(tags.map((tag) => tag.trim()).filter((tag) => tag && !tag.startsWith(PROJECT_PREFIX)))];
}

export function selectionTags(taskKey: string, tags: readonly string[]): string[] {
  return [projectTag(taskKey), ...tags];
}
