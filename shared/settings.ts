import { defineSettings } from "@getpaseo/plugin";
import { z } from "zod";

export const ProjectSettingsSchema = z.object({
  taskKey: z.string().optional(),
  // Only tasks carrying all of these tags are shown.
  filterTags: z.array(z.string()).optional(),
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

type ProjectSettingsValues = z.infer<typeof projectSettings.schema>;

// The values to save after changing one project. Paseo only saves plain JSON, which has
// no undefined, so unset fields are left out.
export function withProjectSettings(values: ProjectSettingsValues, projectId: string, next: ProjectSettings): ProjectSettingsValues {
  const set = Object.fromEntries(Object.entries(next).filter(([, value]) => value !== undefined));
  return { ...values, projects: { ...values.projects, [projectId]: set } };
}
