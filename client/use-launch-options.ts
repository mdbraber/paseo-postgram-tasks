import { usePaseo } from "@getpaseo/plugin/client";
import { useEffect, useState } from "react";
import { providerOptions, workspaceChoice, type LaunchChoice, type ProviderOption } from "../shared/launch.ts";

type Paseo = ReturnType<typeof usePaseo>;

export interface LaunchOptions {
  /** null until the host's providers are known. */
  providers: ProviderOption[] | null;
  error: string | null;
  /** What the workspace's latest agent runs, used as the starting choice. */
  preferred: Partial<LaunchChoice> | null;
}

// Providers are the same for every panel on a host, so they are fetched once per host and folder.
const providerCache = new WeakMap<Paseo, Map<string, ProviderOption[]>>();

async function loadProviders(paseo: Paseo, cwd: string): Promise<ProviderOption[]> {
  let snapshot = await paseo.providers.snapshot({ cwd });
  // Paseo discovers providers lazily; the first snapshot can still be filling in.
  if (snapshot.entries.some((entry) => entry.status === "loading")) {
    snapshot = await paseo.providers.waitForReady({ cwd, timeoutMs: 20_000 });
  }
  return providerOptions(snapshot.entries);
}

// Loaded when the Tasks panel opens, so the Start dialog and Run in this workspace don't wait.
export function useLaunchOptions(workspaceId: string, cwd: string | null): LaunchOptions {
  const paseo = usePaseo();
  const cached = cwd ? providerCache.get(paseo)?.get(cwd) ?? null : null;
  const [providers, setProviders] = useState<ProviderOption[] | null>(cached);
  const [error, setError] = useState<string | null>(null);
  const [preferred, setPreferred] = useState<Partial<LaunchChoice> | null>(null);

  useEffect(() => {
    if (!cwd) return;
    let cancelled = false;
    // Show what's cached right away and refresh it in the background.
    loadProviders(paseo, cwd).then(
      (loaded) => {
        const byCwd = providerCache.get(paseo) ?? new Map<string, ProviderOption[]>();
        byCwd.set(cwd, loaded);
        providerCache.set(paseo, byCwd);
        if (!cancelled) { setProviders(loaded); setError(null); }
      },
      (reason: unknown) => { if (!cancelled) setError(reason instanceof Error ? reason.message : String(reason)); },
    );
    paseo.agents
      .list({ sort: [{ key: "updated_at", direction: "desc" }], page: { limit: 200 } })
      .then(
        ({ entries }) => { if (!cancelled) setPreferred(workspaceChoice(entries.map((entry) => entry.agent), workspaceId)); },
        () => {},
      );
    return () => { cancelled = true; };
  }, [paseo, cwd, workspaceId]);

  return { providers, error, preferred };
}
