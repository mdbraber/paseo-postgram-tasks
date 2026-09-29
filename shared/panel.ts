export const TASKS_PANEL_ID = "tasks";

// The iOS and Android apps show a fixed right-hand panel (Changes, Files, PR) that
// can't host plugin panels, so there Tasks opens as a regular workspace tab.
export function tasksPanelLocation(platform: string): "explorer" | "workspace" {
  return platform === "web" ? "explorer" : "workspace";
}
