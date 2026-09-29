import { useRpc } from "@getpaseo/plugin/client";
import { useCallback, useEffect, useRef, useState } from "react";
import { listTasks } from "../shared/contracts.ts";
import { applyListResult, applyTask, type ListState } from "../shared/list-state.ts";
import type { Task } from "../shared/tasks.ts";

const REFRESH_MS = 30_000;

export function useTasks(taskKey: string | null) {
  const list = useRpc(listTasks);
  const [state, setState] = useState<ListState>({ status: "loading" });
  const latestKey = useRef(taskKey);
  latestKey.current = taskKey;

  const reload = useCallback(async () => {
    if (!taskKey) return;
    const result = await list({ taskKey });
    if (latestKey.current !== taskKey) return;
    setState((current) => applyListResult(current, result));
  }, [list, taskKey]);

  useEffect(() => {
    setState({ status: "loading" });
    void reload();
    const interval = setInterval(() => void reload(), REFRESH_MS);
    return () => clearInterval(interval);
  }, [reload]);

  // Apply a task returned by a mutation without waiting for the next reload.
  const replace = useCallback((task: Task) => setState((current) => applyTask(current, task)), []);

  return { state, reload, replace };
}
