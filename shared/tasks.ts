import { z } from "zod";

export const TASK_STATUSES = ["inbox", "next", "active", "waiting", "scheduled", "someday", "done", "archived"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TaskSchema = z.object({
  id: z.string(),
  content: z.string(),
  status: z.enum(TASK_STATUSES),
  version: z.number().int(),
  tags: z.array(z.string()),
  metadata: z.record(z.string(), z.unknown()),
  updatedAt: z.string(),
});
export type Task = z.infer<typeof TaskSchema>;

export const SECTION_ORDER = ["inbox", "next", "active", "waiting", "scheduled", "someday"] as const;
export type SectionStatus = (typeof SECTION_ORDER)[number];

export const STATUS_LABELS: Record<TaskStatus, string> = {
  inbox: "Inbox",
  next: "Next",
  active: "Active",
  waiting: "Waiting",
  scheduled: "Scheduled",
  someday: "Someday",
  done: "Done",
  archived: "Archived",
};

export function taskTitle(content: string): string {
  return content.split("\n").find((line) => line.trim())?.trim() || "Untitled task";
}

// Everything after the title line, keeping its line breaks.
export function taskBody(content: string): string {
  const lines = content.split("\n");
  const titleIndex = lines.findIndex((line) => line.trim());
  if (titleIndex === -1) return "";
  return lines.slice(titleIndex + 1).join("\n").trim();
}

export function groupTasks(tasks: readonly Task[]): Record<SectionStatus, Task[]> {
  const groups: Record<SectionStatus, Task[]> = { inbox: [], next: [], active: [], waiting: [], scheduled: [], someday: [] };
  for (const task of tasks) {
    if ((SECTION_ORDER as readonly string[]).includes(task.status)) groups[task.status as SectionStatus].push(task);
  }
  for (const status of SECTION_ORDER) groups[status].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return groups;
}

export function startsCollapsed(status: SectionStatus, count: number): boolean {
  return count === 0 || status === "scheduled" || status === "someday";
}

export interface MoveOption {
  status: TaskStatus;
  label: string;
  needsDate: boolean;
}

// Postgram's statuses, in the order of its task board.
export function moveOptions(current: TaskStatus): MoveOption[] {
  const order: TaskStatus[] =
    current === "inbox"
      ? ["next", "active", "waiting", "scheduled", "someday", "done"]
      : ["done", "inbox", "next", "active", "waiting", "scheduled", "someday"];
  return order
    .filter((status) => status !== current)
    .map((status) => ({
      status,
      label: status === "scheduled" ? "Schedule" : STATUS_LABELS[status],
      needsDate: status === "scheduled",
    }));
}

export function visibleTags(tags: readonly string[]): string[] {
  return tags.filter((tag) => !tag.startsWith("project:"));
}

export function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

// Postgram merges metadata into what it has, so a cleared field must be sent as null.
export function editMetadata(metadata: Record<string, unknown>, key: string, raw: string): Record<string, unknown> {
  const value = raw.trim();
  if (value === "") return { ...metadata, [key]: null };
  return { ...metadata, [key]: key === "priority" && /^\d+$/.test(value) ? Number(value) : value };
}

export function metadataText(metadata: Record<string, unknown>, key: string): string {
  const value = metadata[key];
  return value === undefined || value === null ? "" : String(value);
}

export function canSchedule(metadata: Record<string, unknown>): boolean {
  return typeof metadata.scheduled_for === "string" && isIsoDate(metadata.scheduled_for);
}

export const DATE_FIELDS = ["due_date", "scheduled_for"] as const;

/** What the editor holds until the user saves: the text, status and metadata fields as typed. */
export interface TaskDraft {
  content: string;
  status: TaskStatus;
  fields: Record<string, string>;
}

export type TaskPatch = { content?: string; status?: TaskStatus; metadata?: Record<string, unknown> };

export function draftFromTask(task: Task, fieldKeys: readonly string[]): TaskDraft {
  return {
    content: task.content,
    status: task.status,
    fields: Object.fromEntries(fieldKeys.map((key) => [key, metadataText(task.metadata, key)])),
  };
}

// The changes a save sends, or why the draft can't be saved. An empty patch means nothing changed.
export function draftPatch(task: Task, draft: TaskDraft): { ok: true; patch: TaskPatch } | { ok: false; message: string } {
  if (!draft.content.trim()) return { ok: false, message: "The task needs some text." };
  const patch: TaskPatch = {};
  if (draft.content !== task.content) patch.content = draft.content;
  let metadata = task.metadata;
  for (const [key, value] of Object.entries(draft.fields)) {
    if (value.trim() === metadataText(task.metadata, key)) continue;
    if ((DATE_FIELDS as readonly string[]).includes(key) && value.trim() && !isIsoDate(value.trim())) {
      return { ok: false, message: "Dates must be YYYY-MM-DD." };
    }
    metadata = editMetadata(metadata, key, value);
  }
  if (metadata !== task.metadata) patch.metadata = metadata;
  if (draft.status !== task.status) patch.status = draft.status;
  if (draft.status === "scheduled" && (patch.status || patch.metadata) && !canSchedule(metadata)) {
    return { ok: false, message: "Set a scheduled date (YYYY-MM-DD) to schedule this task." };
  }
  return { ok: true, patch };
}

export function isDraftChanged(task: Task, draft: TaskDraft): boolean {
  return (
    draft.content !== task.content ||
    draft.status !== task.status ||
    Object.entries(draft.fields).some(([key, value]) => value.trim() !== metadataText(task.metadata, key))
  );
}
