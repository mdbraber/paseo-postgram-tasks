// What Paseo's New workspace screen lets you pick for the first agent: model, thinking level and mode.

export interface Option {
  id: string;
  label: string;
}

export interface ModelOption extends Option {
  isDefault?: boolean;
  thinkingOptions: Option[];
  defaultThinkingOptionId?: string;
}

export interface ProviderOption {
  provider: string;
  label: string;
  models: ModelOption[];
  modes: Option[];
  defaultModeId: string | null;
}

export interface LaunchChoice {
  provider: string;
  model: string;
  thinkingOptionId?: string;
  modeId?: string;
}

interface SnapshotEntry {
  provider: string;
  status: string;
  enabled?: boolean;
  label?: string;
  models?: {
    id: string;
    label: string;
    isDefault?: boolean;
    isSelectable?: boolean;
    thinkingOptions?: { id: string; label: string; isDefault?: boolean }[];
    defaultThinkingOptionId?: string;
  }[];
  modes?: Option[];
  defaultModeId?: string | null;
}

// Providers that are ready and have a model to pick, from Paseo's provider snapshot.
export function providerOptions(entries: readonly SnapshotEntry[]): ProviderOption[] {
  return entries
    .filter((entry) => entry.status === "ready" && entry.enabled !== false)
    .map((entry) => ({
      provider: entry.provider,
      label: entry.label ?? entry.provider,
      models: (entry.models ?? [])
        .filter((model) => model.isSelectable !== false)
        .map((model) => ({
          id: model.id,
          label: model.label,
          isDefault: model.isDefault,
          thinkingOptions: (model.thinkingOptions ?? []).map(({ id, label }) => ({ id, label })),
          defaultThinkingOptionId:
            model.defaultThinkingOptionId ?? model.thinkingOptions?.find((option) => option.isDefault)?.id,
        })),
      modes: (entry.modes ?? []).map(({ id, label }) => ({ id, label })),
      defaultModeId: entry.defaultModeId ?? null,
    }))
    .filter((entry) => entry.models.length > 0);
}

// Keeps what `wanted` asks for where the provider offers it, and fills the rest with its defaults.
export function resolveChoice(providers: readonly ProviderOption[], wanted: Partial<LaunchChoice> | null): LaunchChoice | null {
  const provider = providers.find((entry) => entry.provider === wanted?.provider) ?? providers[0];
  if (!provider) return null;
  const model =
    provider.models.find((entry) => entry.id === wanted?.model) ??
    provider.models.find((entry) => entry.isDefault) ??
    provider.models[0];
  if (!model) return null;
  const thinking =
    model.thinkingOptions.find((entry) => entry.id === wanted?.thinkingOptionId)?.id ?? model.defaultThinkingOptionId;
  const mode = provider.modes.find((entry) => entry.id === wanted?.modeId)?.id ?? provider.defaultModeId ?? undefined;
  return {
    provider: provider.provider,
    model: model.id,
    ...(thinking ? { thinkingOptionId: thinking } : {}),
    ...(mode ? { modeId: mode } : {}),
  };
}

export interface WorkspaceAgent {
  provider: string;
  model: string | null;
  thinkingOptionId?: string | null;
  currentModeId?: string | null;
  workspaceId?: string;
  updatedAt: string;
}

// What the workspace's most recently active agent runs, to start the next one the same way.
export function workspaceChoice(agents: readonly WorkspaceAgent[], workspaceId: string): Partial<LaunchChoice> | null {
  const latest = agents
    .filter((agent) => agent.workspaceId === workspaceId && agent.model)
    .reduce<WorkspaceAgent | null>((best, agent) => (best && best.updatedAt >= agent.updatedAt ? best : agent), null);
  if (!latest?.model) return null;
  return {
    provider: latest.provider,
    model: latest.model,
    ...(latest.thinkingOptionId ? { thinkingOptionId: latest.thinkingOptionId } : {}),
    ...(latest.currentModeId ? { modeId: latest.currentModeId } : {}),
  };
}

/** Paseo wants the provider and model together as `provider/model`. */
export function agentConfig(choice: LaunchChoice) {
  return {
    provider: `${choice.provider}/${choice.model}`,
    ...(choice.thinkingOptionId ? { thinkingOptionId: choice.thinkingOptionId } : {}),
    ...(choice.modeId ? { modeId: choice.modeId } : {}),
  };
}
