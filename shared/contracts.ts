import { defineRpc } from "@getpaseo/plugin";
import { z } from "zod";
import { resultSchema } from "./result.ts";
import { TaskRunSchema } from "./runs.ts";
import { TASK_STATUSES, TaskSchema } from "./tasks.ts";

const TaskResult = resultSchema(TaskSchema);

export const TaskPatchSchema = z.object({
  content: z.string().optional(),
  status: z.enum(TASK_STATUSES).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const listTasks = defineRpc({
  name: "tasks.list",
  input: z.object({ taskKey: z.string().min(1) }),
  output: resultSchema(z.object({ open: z.array(TaskSchema), done: z.array(TaskSchema) })),
});

export const getTask = defineRpc({ name: "tasks.get", input: z.object({ id: z.string() }), output: TaskResult });

export const createTask = defineRpc({
  name: "tasks.create",
  input: z.object({ taskKey: z.string().min(1), content: z.string() }),
  output: TaskResult,
});

export const updateTask = defineRpc({
  name: "tasks.update",
  input: z.object({ id: z.string(), version: z.number().int(), patch: TaskPatchSchema }),
  output: TaskResult,
});

export const completeTask = defineRpc({
  name: "tasks.complete",
  input: z.object({ id: z.string(), version: z.number().int() }),
  output: TaskResult,
});

export const activateTask = defineRpc({ name: "tasks.activate", input: z.object({ id: z.string() }), output: resultSchema(TaskSchema.nullable()) });

export const recordRun = defineRpc({
  name: "tasks.record-run",
  input: z.object({ id: z.string(), run: TaskRunSchema }),
  output: TaskResult,
});
