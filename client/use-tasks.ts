import { useRpc } from "@getpaseo/plugin/client";
import { useCallback, useEffect, useRef, useState } from "react";
import { listTasks } from "../shared/contracts.ts";
import { applyListResult, applyTask, type ListState } from "../shared/list-state.ts";
import type { Task } from "../shared/tasks.ts";

const REFRESH_MS = 30_000;

// `filterTags` narrows the project's list to tasks carrying all of them.
export function useTasks(taskKey: string | null, filterTags: readonly string[]) {
  const list = useRpc(listTasks);
  const [state, setState] = useState<ListState>({ status: "loading" });
  // The tags found on the project's tasks, narrowed or not.
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  // The tags come as a new array on every render, so the selection is compared as text.
  const selection = taskKey === null ? null : JSON.stringify([taskKey, ...filterTags]);
  const latestSelection = useRef(selection);
  latestSelection.current = selection;

  const reload = useCallback(async () => {
    if (selection === null) return;
    const [key, ...tags] = JSON.parse(selection) as string[];
    const result = await list({ taskKey: key!, tags });
    if (latestSelection.current !== selection) return;
    if (result.ok) setAvailableTags(result.value.tags);
    setState((current) => applyListResult(current, result));
  }, [list, selection]);

  useEffect(() => {
    setState({ status: "loading" });
    void reload();
    const interval = setInterval(() => void reload(), REFRESH_MS);
    return () => clearInterval(interval);
  }, [reload]);

  // Another project has other tags; narrowing within a project keeps its tags listed.
  useEffect(() => setAvailableTags([]), [taskKey]);

  // Apply a task returned by a mutation without waiting for the next reload.
  const replace = useCallback((task: Task) => setState((current) => applyTask(current, task)), []);

  return { state, availableTags, reload, replace };
}
