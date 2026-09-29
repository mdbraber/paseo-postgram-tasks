import { usePaseo, useRpc } from "@getpaseo/plugin/client";
import { Icon, Modal, ScrollView, TextInput, useToast } from "@getpaseo/plugin/client/react-native";
import { useState, type ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import { describeError } from "./describe-error.ts";
import type { Styles } from "./theme.ts";
import type { LaunchOptions } from "./use-launch-options.ts";
import type { ProjectInfo } from "./use-project.ts";
import { recordRun } from "../shared/contracts.ts";
import { agentConfig, resolveChoice, type LaunchChoice } from "../shared/launch.ts";
import { TASK_LABEL } from "../shared/runs.ts";
import { agentTitle, availableTargets, START_TARGET_LABELS, workspaceSource, type StartTarget } from "../shared/start.ts";
import type { Task } from "../shared/tasks.ts";

type Menu = "isolation" | "model" | "thinking" | "mode";

// Laid out like Paseo's New workspace screen, with the task text as the first message.
export function StartDialog(props: {
  task: Task;
  project: ProjectInfo;
  host: { id: string; label: string };
  launch: LaunchOptions;
  styles: Styles;
  onClose(): void;
  onStarted(task: Task | null, agentId: string): void;
}) {
  const { styles, project, task, launch } = props;
  const paseo = usePaseo();
  const toast = useToast();
  const record = useRpc(recordRun);
  const targets = availableTargets(project.projectKind);
  const [target, setTarget] = useState<StartTarget>("local");
  const [baseRef, setBaseRef] = useState("");
  // The task text is the starting point; edits here only change what the agent is sent.
  const [prompt, setPrompt] = useState(task.content);
  const [wanted, setWanted] = useState<Partial<LaunchChoice> | null>(null);
  const [menu, setMenu] = useState<Menu | null>(null);
  const [busy, setBusy] = useState(false);
  const [recordError, setRecordError] = useState<{ agentId: string; workspaceId: string; message: string } | null>(null);

  const providers = launch.providers ?? [];
  const choice = resolveChoice(providers, wanted ?? launch.preferred);
  const provider = providers.find((entry) => entry.provider === choice?.provider);
  const model = provider?.models.find((entry) => entry.id === choice?.model);
  const thinking = model?.thinkingOptions.find((entry) => entry.id === choice?.thinkingOptionId);
  const mode = provider?.modes.find((entry) => entry.id === choice?.modeId);
  const canLaunch = choice !== null && !busy && prompt.trim() !== "";
  const muted = props.styles.label.color;

  function pick(change: Partial<LaunchChoice>) {
    setWanted({ ...choice, ...change });
    setMenu(null);
  }

  async function saveRun(agentId: string, workspaceId: string) {
    const result = await record({
      id: task.id,
      run: {
        agentId, workspaceId, serverId: props.host.id, hostLabel: props.host.label,
        profileId: null, startedAt: new Date().toISOString(),
      },
    });
    if (!result.ok) {
      setRecordError({ agentId, workspaceId, message: describeError(result.error) });
      return;
    }
    props.onStarted(result.value, agentId);
  }

  async function launchWorkspace() {
    const text = prompt.trim();
    if (!choice || !text) return;
    setBusy(true);
    try {
      // Paseo names the workspace from the prompt, as its own screen does.
      const workspace = await paseo.workspaces.create({
        source: workspaceSource(target, project, baseRef),
        firstAgentContext: { prompt: text },
      });
      const agent = await workspace.agents.create({
        config: agentConfig(choice),
        prompt: text,
        title: agentTitle(text),
        labels: { [TASK_LABEL]: task.id },
      });
      await saveRun(agent.id, workspace.id);
    } catch (error) {
      // Nothing was recorded, so the task is unchanged.
      toast.error(`Couldn't start the workspace: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setBusy(false);
    }
  }

  const chip = (key: Menu | null, icon: ReactNode, label: string, dropdown = true) => (
    <Pressable
      accessibilityRole="button"
      disabled={!key}
      style={[styles.launchChip, key !== null && menu === key && styles.chipOpen]}
      onPress={() => key && setMenu(menu === key ? null : key)}
    >
      {icon}
      <Text style={styles.chipText}>{label}</Text>
      {dropdown ? <Icon name="ChevronDown" size={14} color={muted} /> : null}
    </Pressable>
  );

  const menuItem = (key: string, label: string, selected: boolean, onPress: () => void) => (
    <Pressable key={key} accessibilityRole="button" style={[styles.menuItem, selected && styles.menuItemSelected]} onPress={onPress}>
      <Text style={styles.menuItemText}>{label}</Text>
    </Pressable>
  );

  return (
    <Modal title="New workspace" open onOpenChange={(open) => { if (!open && !busy) props.onClose(); }}>
      <Modal.Content>
        {recordError ? (
          <View style={styles.notice}>
            <Text style={styles.noticeText}>
              The agent is running, but the task couldn't be updated: {recordError.message}
            </Text>
            <View style={styles.actions}>
              <Pressable accessibilityRole="button" style={styles.button} onPress={() => void saveRun(recordError.agentId, recordError.workspaceId)}>
                <Text style={styles.buttonText}>Retry</Text>
              </Pressable>
              <Pressable accessibilityRole="button" style={styles.button} onPress={() => props.onStarted(null, recordError.agentId)}>
                <Text style={styles.buttonText}>Skip</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <>
            <View style={styles.chipRow}>
              {chip(null, <Text style={styles.projectBadge}>{project.displayName.slice(0, 1).toUpperCase()}</Text>, project.displayName, false)}
              {chip(null, <View style={styles.onlineDot} />, props.host.label, false)}
              {chip(
                targets.length > 1 ? "isolation" : null,
                <Icon name={target === "worktree" ? "GitBranch" : "Folder"} size={14} color={muted} />,
                START_TARGET_LABELS[target],
                targets.length > 1,
              )}
              {target === "worktree" ? (
                <TextInput
                  style={[styles.input, { paddingVertical: 4, minWidth: 140 }]}
                  value={baseRef}
                  placeholder="Start from (default branch)"
                  autoCapitalize="none"
                  onChangeText={setBaseRef}
                />
              ) : null}
              <View style={{ flex: 1 }} />
              {chip(null, <Icon name="MessageSquare" size={14} color={muted} />, "Chat", false)}
            </View>
            {menu === "isolation" ? (
              <View style={styles.menu}>
                {targets.map((option) =>
                  menuItem(option, START_TARGET_LABELS[option], option === target, () => {
                    setTarget(option);
                    setMenu(null);
                  }),
                )}
              </View>
            ) : null}

            <View style={styles.composer}>
              <TextInput
                style={styles.composerInput}
                value={prompt}
                multiline
                autoFocus
                placeholder="Message the agent, tag @files, or use /commands and /skills"
                onChangeText={setPrompt}
              />
              <View style={styles.chipRow}>
                {launch.providers === null ? (
                  <Text style={styles.mutedText}>{launch.error ?? "Loading models…"}</Text>
                ) : !choice ? (
                  <Text style={styles.warningText}>No agent providers are available on this host.</Text>
                ) : (
                  <>
                    {chip("model", <Icon name="Sparkles" size={14} color={muted} />, model?.label ?? choice.model)}
                    {model && model.thinkingOptions.length > 0
                      ? chip("thinking", <Icon name="Brain" size={14} color={muted} />, thinking?.label ?? "Thinking")
                      : null}
                    {provider && provider.modes.length > 0
                      ? chip("mode", <Icon name="Shield" size={14} color={muted} />, mode?.label ?? "Mode")
                      : null}
                  </>
                )}
                <View style={{ flex: 1 }} />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Launch"
                  style={[styles.sendButton, !canLaunch && styles.sendButtonDisabled]}
                  disabled={!canLaunch}
                  onPress={() => void launchWorkspace()}
                >
                  {busy ? <Text style={styles.primaryText}>…</Text> : <Icon name="CornerDownLeft" size={16} color={canLaunch ? "#ffffff" : muted} />}
                </Pressable>
              </View>
            </View>

            {menu === "model" ? (
              <ScrollView style={styles.menu}>
                {providers.map((entry) => (
                  <View key={entry.provider}>
                    {providers.length > 1 ? <Text style={styles.menuHeading}>{entry.label}</Text> : null}
                    {entry.models.map((option) =>
                      menuItem(
                        `${entry.provider}/${option.id}`,
                        option.label,
                        entry.provider === choice?.provider && option.id === choice?.model,
                        () => pick({ provider: entry.provider, model: option.id }),
                      ),
                    )}
                  </View>
                ))}
              </ScrollView>
            ) : null}
            {menu === "thinking" && model ? (
              <View style={styles.menu}>
                {model.thinkingOptions.map((option) =>
                  menuItem(option.id, option.label, option.id === choice?.thinkingOptionId, () => pick({ thinkingOptionId: option.id })),
                )}
              </View>
            ) : null}
            {menu === "mode" && provider ? (
              <View style={styles.menu}>
                {provider.modes.map((option) =>
                  menuItem(option.id, option.label, option.id === choice?.modeId, () => pick({ modeId: option.id })),
                )}
              </View>
            ) : null}
          </>
        )}
      </Modal.Content>
    </Modal>
  );
}
