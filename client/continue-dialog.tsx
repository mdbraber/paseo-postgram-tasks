import { getPaseoClient, useRpc } from "@getpaseo/plugin/client";
import { Modal, TextInput, useToast } from "@getpaseo/plugin/client/react-native";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { describeError } from "./describe-error.ts";
import type { Styles } from "./theme.ts";
import { activateTask } from "../shared/contracts.ts";
import type { TaskRun } from "../shared/runs.ts";
import type { Task } from "../shared/tasks.ts";

// Sends a message to the task's agent; Paseo restores the agent first if it was archived.
export function ContinueDialog(props: {
  task: Task;
  run: TaskRun;
  styles: Styles;
  onClose(): void;
  onContinued(task: Task | null): void;
}) {
  const { styles } = props;
  const toast = useToast();
  const activate = useRpc(activateTask);
  const [message, setMessage] = useState("Continue with this task.");
  const [busy, setBusy] = useState(false);

  async function send() {
    const text = message.trim();
    if (!text) return;
    setBusy(true);
    try {
      await getPaseoClient(props.run.serverId).agents.ref(props.run.agentId).send(text);
    } catch (error) {
      setBusy(false);
      return toast.error(`Couldn't continue the agent on ${props.run.hostLabel}: ${error instanceof Error ? error.message : String(error)}`);
    }
    // The agent is running again; a failed status update only leaves the task where it was.
    const result = await activate({ id: props.task.id });
    if (!result.ok) toast.error(`The agent continued, but the task couldn't be moved to Active: ${describeError(result.error)}`);
    setBusy(false);
    props.onContinued(result.ok ? result.value : null);
  }

  return (
    <Modal title="Continue agent" open onOpenChange={(open) => { if (!open && !busy) props.onClose(); }}>
      <Modal.Content>
        <Text style={styles.label}>Message</Text>
        <TextInput style={styles.input} value={message} multiline autoFocus onChangeText={setMessage} />
        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            style={message.trim() && !busy ? styles.primaryButton : styles.button}
            disabled={!message.trim() || busy}
            onPress={() => void send()}
          >
            <Text style={message.trim() && !busy ? styles.primaryText : styles.buttonText}>{busy ? "Sending…" : "Send"}</Text>
          </Pressable>
          <Pressable accessibilityRole="button" style={styles.button} disabled={busy} onPress={props.onClose}>
            <Text style={styles.buttonText}>Cancel</Text>
          </Pressable>
        </View>
      </Modal.Content>
    </Modal>
  );
}
