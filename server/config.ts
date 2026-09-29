import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { z } from "zod";
import { fail, ok, type Result } from "../shared/result.ts";

const PostgramConfigSchema = z.object({ apiUrl: z.string().url(), apiKey: z.string().min(1) });
export type PostgramConfig = z.infer<typeof PostgramConfigSchema>;

export function configPath(env: NodeJS.ProcessEnv = process.env, home: string = homedir()): string {
  return join(env.PASEO_HOME || join(home, ".paseo"), "postgram-tasks.json");
}

export async function loadPostgramConfig(
  path: string,
  read: (path: string) => Promise<string> = (p) => readFile(p, "utf8"),
): Promise<Result<PostgramConfig>> {
  let text: string;
  try {
    text = await read(path);
  } catch (error) {
    const missing = (error as { code?: string }).code === "ENOENT";
    return fail("not_configured", missing ? `No Postgram config at ${path}` : `Cannot read ${path}: ${String(error)}`);
  }
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return fail("not_configured", `${path} is not valid JSON`);
  }
  const parsed = PostgramConfigSchema.safeParse(json);
  return parsed.success
    ? ok(parsed.data)
    : fail("not_configured", `${path} needs "apiUrl" (a URL) and "apiKey"`);
}
