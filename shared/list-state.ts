import type { Result, TaskError } from "./result.ts";
import type { Task } from "./tasks.ts";

export interface TaskLists {
  open: Task[];
  done: Task[];
}

export type ListState =
  | { status: "loading" }
  | { status: "error"; error: TaskError }
  | { status: "ready"; open: Task[]; done: Task[]; refreshError: TaskError | null };

function newest(local: Map<string, Task>, incoming: Task): Task {
  const known = local.get(incoming.id);
  return known && known.version > incoming.version ? known : incoming;
}

// A failed refresh keeps what the user is looking at (an open editor or Start dialog
// looks its task up here), and a refresh that started before a save never brings
// back the older version.
export function applyListResult(prev: ListState, result: Result<TaskLists>): ListState {
  if (!result.ok) {
    return prev.status === "ready" ? { ...prev, refreshError: result.error } : { status: "error", error: result.error };
  }
  const local = new Map(prev.status === "ready" ? [...prev.open, ...prev.done].map((t) => [t.id, t]) : []);
  const tasks = [...result.value.open, ...result.value.done].map((t) => newest(local, t));
  return {
    status: "ready",
    open: tasks.filter((t) => t.status !== "done" && t.status !== "archived"),
    done: tasks.filter((t) => t.status === "done"),
    refreshError: null,
  };
}

// Applies a task returned by a mutation without waiting for the next refresh.
export function applyTask(prev: ListState, task: Task): ListState {
  if (prev.status !== "ready") return prev;
  const shown = [...prev.open, ...prev.done].find((t) => t.id === task.id);
  if (shown && shown.version > task.version) return prev;
  const without = (list: Task[]) => list.filter((t) => t.id !== task.id);
  const open = without(prev.open);
  const done = without(prev.done);
  if (task.status === "done") return { ...prev, open, done: [task, ...done] };
  if (task.status === "archived") return { ...prev, open, done };
  return { ...prev, open: [task, ...open], done };
}
