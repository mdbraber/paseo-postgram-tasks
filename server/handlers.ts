import type { PostgramClient, TaskPatch } from "./postgram.ts";
import { cleanTags, matchesTags, narrowingTags, projectKeys, selectionTags } from "../shared/filter.ts";
import { fail, ok, type Result } from "../shared/result.ts";
import { latestRun, readRuns, statusAfterArchive, statusAfterTurn, withRun, type TaskRun } from "../shared/runs.ts";
import { projectTag } from "../shared/task-key.ts";
import type { Task, TaskStatus } from "../shared/tasks.ts";

export const DONE_LIMIT = 10;

type GetClient = () => Promise<Result<PostgramClient>>;

export function createHandlers(getClient: GetClient) {
  async function withClient<T>(run: (client: PostgramClient) => Promise<Result<T>>): Promise<Result<T>> {
    const client = await getClient();
    return client.ok ? run(client.value) : client;
  }

  async function appendRun(client: PostgramClient, id: string, run: TaskRun): Promise<Result<Task>> {
    const current = await client.get(id);
    if (!current.ok) return current;
    return client.update(id, current.value.version, {
      status: "active",
      metadata: withRun(current.value.metadata, run),
    });
  }

  // Applies the status `decide` picks for the current task, if any. On a version
  // conflict it reloads once and decides again, since agent events race user edits.
  async function transition(client: PostgramClient, id: string, decide: (task: Task) => TaskStatus | null): Promise<Result<Task | null>> {
    for (let attempt = 0; ; attempt++) {
      const current = await client.get(id);
      if (!current.ok) return current;
      const status = decide(current.value);
      if (!status) return ok(null);
      const result = status === "done"
        ? await client.complete(id, current.value.version)
        : await client.update(id, current.value.version, { status });
      if (result.ok || result.error.kind !== "conflict" || attempt === 1) return result;
    }
  }

  return {
    // `tags` narrows the project's list; the tags to choose from come from the whole project.
    list: ({ taskKey, tags = [] }: { taskKey: string; tags?: string[] }) =>
      withClient(async (client) => {
        const all = await client.list(projectTag(taskKey));
        if (!all.ok) return all;
        const shown = all.value.filter((task) => matchesTags(task, cleanTags(tags)));
        const done = shown
          .filter((task) => task.status === "done")
          .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
          .slice(0, DONE_LIMIT);
        const open = shown.filter((task) => task.status !== "done" && task.status !== "archived");
        return ok({ open, done, tags: narrowingTags(all.value) });
      }),

    projects: () =>
      withClient(async (client) => {
        const all = await client.listAll();
        return all.ok ? ok(projectKeys(all.value)) : all;
      }),

    get: ({ id }: { id: string }) => withClient((client) => client.get(id)),

    create: ({ taskKey, tags = [], content }: { taskKey: string; tags?: string[]; content: string }) => {
      const text = content.trim();
      if (!text) return Promise.resolve(fail<Task>("invalid", "A task needs some text"));
      return withClient((client) => client.create({ content: text, tags: selectionTags(taskKey, cleanTags(tags)) }));
    },

    update: ({ id, version, patch }: { id: string; version: number; patch: TaskPatch }) => {
      if (patch.content !== undefined && !patch.content.trim()) {
        return Promise.resolve(fail<Task>("invalid", "A task needs some text"));
      }
      return withClient((client) => client.update(id, version, patch));
    },

    complete: ({ id, version }: { id: string; version: number }) => withClient((client) => client.complete(id, version)),

    // The agent is already running, so a concurrent edit must not lose the link:
    // on a version conflict, reload once and re-apply only this change.
    recordRun: ({ id, run }: { id: string; run: TaskRun }) =>
      withClient(async (client) => {
        const first = await appendRun(client, id, run);
        if (first.ok || first.error.kind !== "conflict") return first;
        return appendRun(client, id, run);
      }),

    activate: ({ id }: { id: string }) =>
      withClient((client) => transition(client, id, (task) => (task.status === "active" ? null : "active"))),

    // Agents started before tasks labelled them are found among active tasks.
    agentArchived: ({ agentId, taskId }: { agentId: string; taskId: string | null }) =>
      withClient(async (client) => {
        let id = taskId;
        if (!id) {
          const active = await client.listByStatus("active");
          if (!active.ok) return active;
          id = active.value.find((task) => latestRun(readRuns(task.metadata))?.agentId === agentId)?.id ?? null;
        }
        return id ? transition(client, id, (task) => statusAfterArchive(task, agentId)) : ok(null);
      }),

    agentTurnStarted: ({ agentId, taskId }: { agentId: string; taskId: string }) =>
      withClient((client) => transition(client, taskId, (task) => statusAfterTurn(task, agentId))),
  };
}
