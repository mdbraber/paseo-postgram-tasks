import type { TaskError } from "../shared/result.ts";

export function describeError(error: TaskError): string {
  switch (error.kind) {
    case "not_configured": return `Postgram isn't set up on this host. ${error.message}`;
    case "unauthorized": return "Postgram rejected the API key in postgram-tasks.json.";
    case "forbidden": return "This Postgram key isn't allowed to use tasks. Use a key with the task type.";
    case "conflict": return "This task was changed somewhere else.";
    default: return error.message;
  }
}
