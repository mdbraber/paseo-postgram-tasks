import { z, type ZodType } from "zod";

export const TASK_ERROR_KINDS = [
  "not_configured", "unauthorized", "forbidden", "unreachable", "conflict", "not_found", "invalid", "server",
] as const;
export type TaskErrorKind = (typeof TASK_ERROR_KINDS)[number];

export const TaskErrorSchema = z.object({ kind: z.enum(TASK_ERROR_KINDS), message: z.string() });
export type TaskError = z.infer<typeof TaskErrorSchema>;

export type Result<T> = { ok: true; value: T } | { ok: false; error: TaskError };

export function resultSchema<Value extends ZodType>(value: Value) {
  return z.discriminatedUnion("ok", [
    z.object({ ok: z.literal(true), value }),
    z.object({ ok: z.literal(false), error: TaskErrorSchema }),
  ]);
}

export const ok = <T>(value: T): Result<T> => ({ ok: true, value });
export const fail = <T = never>(kind: TaskErrorKind, message: string): Result<T> => ({ ok: false, error: { kind, message } });
