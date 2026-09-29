import { defineSettings } from "@getpaseo/plugin";
import { z } from "zod";

export const ProjectSettingsSchema = z.object({
  taskKey: z.string().optional(),
  defaultProfileId: z.string().optional(),
});
export type ProjectSettings = z.infer<typeof ProjectSettingsSchema>;

// Keyed by Paseo project ID. Host scope: every client of this daemon shares it.
export const projectSettings = defineSettings({
  id: "projects",
  scope: "host",
  version: 1,
  schema: z.object({ projects: z.record(z.string(), ProjectSettingsSchema).default({}) }),
});
