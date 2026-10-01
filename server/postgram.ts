import type { PostgramConfig } from "./config.ts";
import { fail, ok, type Result, type TaskErrorKind } from "../shared/result.ts";
import { TASK_STATUSES, type Task, type TaskStatus } from "../shared/tasks.ts";

export interface TaskPatch {
  content?: string;
  status?: TaskStatus;
  metadata?: Record<string, unknown>;
}

export interface PostgramClient {
  list(tag: string): Promise<Result<Task[]>>;
  listAll(): Promise<Result<Task[]>>;
  listByStatus(status: TaskStatus): Promise<Result<Task[]>>;
  get(id: string): Promise<Result<Task>>;
  create(input: { content: string; tags: string[] }): Promise<Result<Task>>;
  update(id: string, version: number, patch: TaskPatch): Promise<Result<Task>>;
  complete(id: string, version: number): Promise<Result<Task>>;
}

interface RawEntity {
  id: string;
  content: string | null;
  status: string | null;
  version: number;
  tags: string[] | null;
  metadata: Record<string, unknown> | null;
  updated_at: string;
}

const PAGE_SIZE = 100;
const TIMEOUT_MS = 10_000;

function kindForStatus(status: number): TaskErrorKind {
  switch (status) {
    case 400: return "invalid";
    case 401: return "unauthorized";
    case 403: return "forbidden";
    case 404: return "not_found";
    case 409: return "conflict";
    default: return "server";
  }
}

function toTask(entity: RawEntity): Task {
  const status = (TASK_STATUSES as readonly string[]).includes(entity.status ?? "") ? (entity.status as TaskStatus) : "inbox";
  return {
    id: entity.id,
    content: entity.content ?? "",
    status,
    version: entity.version,
    tags: entity.tags ?? [],
    metadata: entity.metadata ?? {},
    updatedAt: entity.updated_at,
  };
}

export function createPostgramClient(config: PostgramConfig, fetchImpl: typeof fetch = fetch): PostgramClient {
  const base = config.apiUrl.replace(/\/+$/, "");

  async function request<T>(method: string, path: string, body?: unknown): Promise<Result<T>> {
    let response: Response;
    // AbortSignal.timeout would be simpler, but React Native's global types hide it.
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      response = await fetchImpl(`${base}${path}`, {
        method,
        headers: { authorization: `Bearer ${config.apiKey}`, "content-type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
      });
    } catch (error) {
      return fail("unreachable", `Cannot reach Postgram at ${base}: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      clearTimeout(timer);
    }
    const json = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;
    if (!response.ok) {
      return fail(kindForStatus(response.status), json?.error?.message ?? `Postgram returned HTTP ${response.status}`);
    }
    return ok(json as T);
  }

  async function entity(method: string, path: string, body?: unknown): Promise<Result<Task>> {
    const result = await request<{ entity: RawEntity }>(method, path, body);
    return result.ok ? ok(toTask(result.value.entity)) : result;
  }

  async function listWhere(filter: Record<string, string>): Promise<Result<Task[]>> {
    const tasks: Task[] = [];
    for (let offset = 0; ; offset += PAGE_SIZE) {
      const query = new URLSearchParams({ type: "task", ...filter, limit: String(PAGE_SIZE), offset: String(offset) });
      const page = await request<{ items: RawEntity[]; total: number }>("GET", `/api/entities?${query}`);
      if (!page.ok) return page;
      tasks.push(...page.value.items.map(toTask));
      if (page.value.items.length === 0 || tasks.length >= page.value.total) return ok(tasks);
    }
  }

  return {
    list: (tag) => listWhere({ tags: tag }),
    listAll: () => listWhere({}),
    listByStatus: (status) => listWhere({ status }),
    get: (id) => entity("GET", `/api/entities/${encodeURIComponent(id)}`),
    create: ({ content, tags }) =>
      entity("POST", "/api/tasks", { content, tags, status: "inbox", visibility: "personal" }),
    update: (id, version, patch) => entity("PATCH", `/api/tasks/${encodeURIComponent(id)}`, { version, ...patch }),
    complete: (id, version) => entity("POST", `/api/tasks/${encodeURIComponent(id)}/complete`, { version }),
  };
}
