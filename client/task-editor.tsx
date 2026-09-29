import { useRpc } from "@getpaseo/plugin/client";
import { ScrollView, TextInput, useToast } from "@getpaseo/plugin/client/react-native";
import { useEffect, useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { describeError } from "./describe-error.ts";
import { TaskActionButtons } from "./task-actions.tsx";
import type { Styles } from "./theme.ts";
import type { TaskRun } from "../shared/runs.ts";
import { completeTask, getTask, updateTask } from "../shared/contracts.ts";
import {
  DATE_FIELDS, draftFromTask, draftPatch, isDraftChanged, isIsoDate, STATUS_LABELS, TASK_STATUSES,
  type Task, type TaskDraft,
} from "../shared/tasks.ts";

const EDIT_STATUSES = TASK_STATUSES.filter((s) => s !== "archived" && s !== "done");
const META_FIELDS = [
  { key: "context", label: "Context", placeholder: "@computer" },
  { key: "due_date", label: "Due date", placeholder: "YYYY-MM-DD" },
  { key: "scheduled_for", label: "Scheduled date", placeholder: "YYYY-MM-DD" },
  { key: "priority", label: "Priority", placeholder: "1" },
] as const;
const FIELD_KEYS = META_FIELDS.map((field) => field.key);

export function TaskEditor(props: {
  task: Task;
  styles: Styles;
  onChange(task: Task): void;
  onBack(): void;
  onStart(task: Task): void;
  onRunHere(task: Task): void;
  onContinue(task: Task, run: TaskRun): void;
  onOpenAgent(run: TaskRun): void;
}) {
  const { styles } = props;
  const toast = useToast();
  const update = useRpc(updateTask);
  const load = useRpc(getTask);
  const complete = useRpc(completeTask);
  // The version the draft was based on; saving sends only what changed since.
  const [saved, setSaved] = useState(props.task);
  const [draft, setDraft] = useState<TaskDraft>(() => draftFromTask(props.task, FIELD_KEYS));
  const [saving, setSaving] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const busy = useRef(false);

  const changed = isDraftChanged(saved, draft);

  // Follow changes made elsewhere (e.g. an agent moving the task) while nothing is unsaved;
  // with unsaved edits, saving reports the conflict instead.
  useEffect(() => {
    if (props.task.version <= saved.version || changed) return;
    setSaved(props.task);
    setDraft(draftFromTask(props.task, FIELD_KEYS));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.task]);

  function accept(task: Task) {
    setSaved(task);
    props.onChange(task);
  }

  function edit(change: Partial<TaskDraft>) {
    setDraft((current) => ({ ...current, ...change }));
    setConfirmLeave(false);
  }

  // Saves the draft over `base`. Resolves to the saved task, or null when it wasn't saved.
  async function save(base: Task = saved): Promise<Task | null> {
    const planned = draftPatch(base, draft);
    if (!planned.ok) {
      toast.error(planned.message);
      return null;
    }
    if (Object.keys(planned.patch).length === 0) return base;
    if (busy.current) return null;
    busy.current = true;
    setSaving(true);
    try {
      const result = await update({ id: base.id, version: base.version, patch: planned.patch });
      if (!result.ok) {
        if (result.error.kind === "conflict") setConflict(true);
        else setSaveError(describeError(result.error));
        return null;
      }
      setConflict(false);
      setSaveError(null);
      accept(result.value);
      return result.value;
    } finally {
      busy.current = false;
      setSaving(false);
    }
  }

  async function reloadFromServer(keepMine: boolean) {
    const result = await load({ id: saved.id });
    if (!result.ok) return toast.error(describeError(result.error));
    accept(result.value);
    setConflict(false);
    if (keepMine) {
      await save(result.value);
    } else {
      setDraft(draftFromTask(result.value, FIELD_KEYS));
    }
  }

  async function markDone() {
    const task = await save();
    if (!task) return;
    const result = await complete({ id: task.id, version: task.version });
    if (!result.ok) return toast.error(describeError(result.error));
    props.onChange(result.value);
    props.onBack();
  }

  async function remove() {
    const result = await update({ id: saved.id, version: saved.version, patch: { status: "archived" } });
    if (!result.ok) return toast.error(describeError(result.error));
    props.onChange(result.value);
    props.onBack();
  }

  // Starting or continuing uses the task as saved, so unsaved edits are saved first.
  async function start() {
    const task = await save();
    if (task) props.onStart(task);
  }

  async function runHere() {
    const task = await save();
    if (task) props.onRunHere(task);
  }

  async function continueAgent(run: TaskRun) {
    const task = await save();
    if (task) props.onContinue(task, run);
  }

  async function saveAndLeave() {
    if (await save()) props.onBack();
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={[styles.content, { flexGrow: 1 }]}>
      <View style={styles.headerRow}>
        <Pressable accessibilityRole="button" style={styles.button} onPress={() => (changed ? setConfirmLeave(true) : props.onBack())}>
          <Text style={styles.buttonText}>Back</Text>
        </Pressable>
        <Text style={changed ? styles.warningText : styles.mutedText}>{saving ? "Saving…" : changed ? "Unsaved changes" : "Saved"}</Text>
        <View style={{ flex: 1 }} />
        <Pressable
          accessibilityRole="button"
          style={changed && !saving ? styles.primaryButton : styles.button}
          disabled={!changed || saving}
          onPress={() => void save()}
        >
          <Text style={changed && !saving ? styles.primaryText : styles.buttonText}>Save</Text>
        </Pressable>
      </View>

      {confirmLeave ? (
        <View style={styles.notice}>
          <Text style={styles.noticeText}>You have unsaved changes.</Text>
          <View style={styles.actions}>
            <Pressable accessibilityRole="button" style={styles.primaryButton} onPress={() => void saveAndLeave()}>
              <Text style={styles.primaryText}>Save</Text>
            </Pressable>
            <Pressable accessibilityRole="button" style={styles.button} onPress={props.onBack}>
              <Text style={styles.buttonText}>Discard</Text>
            </Pressable>
            <Pressable accessibilityRole="button" style={styles.button} onPress={() => setConfirmLeave(false)}>
              <Text style={styles.buttonText}>Keep editing</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
      {conflict ? (
        <View style={styles.notice}>
          <Text style={styles.noticeText}>This task was changed somewhere else since you opened it.</Text>
          <View style={styles.actions}>
            <Pressable accessibilityRole="button" style={styles.button} onPress={() => void reloadFromServer(false)}>
              <Text style={styles.buttonText}>Reload</Text>
            </Pressable>
            <Pressable accessibilityRole="button" style={styles.button} onPress={() => void reloadFromServer(true)}>
              <Text style={styles.buttonText}>Keep my version</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
      {saveError ? (
        <View style={styles.notice}>
          <Text style={styles.noticeText}>Not saved: {saveError}</Text>
          <Pressable accessibilityRole="button" style={styles.button} onPress={() => void save()}>
            <Text style={styles.buttonText}>Retry</Text>
          </Pressable>
        </View>
      ) : null}

      <TextInput
        style={styles.editorInput}
        value={draft.content}
        multiline
        placeholder="Describe the task, then refine it into the prompt you want to send…"
        onChangeText={(content) => edit({ content })}
      />

      <View style={styles.actions}>
        {EDIT_STATUSES.map((status) => (
          <Pressable
            key={status}
            accessibilityRole="button"
            style={draft.status === status ? styles.selectedButton : styles.button}
            onPress={() => {
              edit({ status });
              if (status === "scheduled") setShowMore(true);
            }}
          >
            <Text style={draft.status === status ? styles.selectedText : styles.buttonText}>{STATUS_LABELS[status]}</Text>
          </Pressable>
        ))}
        <Pressable accessibilityRole="button" style={styles.button} onPress={() => void markDone()}>
          <Text style={styles.buttonText}>Done</Text>
        </Pressable>
        <Pressable accessibilityRole="button" style={styles.dangerButton} onPress={() => void remove()}>
          <Text style={styles.dangerText}>Delete</Text>
        </Pressable>
      </View>

      <Pressable accessibilityRole="button" style={styles.sectionHeader} onPress={() => setShowMore(!showMore)}>
        <Text style={styles.sectionTitle}>{showMore ? "▾" : "▸"} More</Text>
      </Pressable>
      {showMore
        ? META_FIELDS.map((field) => (
            <MetaField
              key={field.key}
              styles={styles}
              label={field.label}
              placeholder={field.placeholder}
              value={draft.fields[field.key] ?? ""}
              isDate={(DATE_FIELDS as readonly string[]).includes(field.key)}
              onChange={(value) => edit({ fields: { ...draft.fields, [field.key]: value } })}
            />
          ))
        : null}

      <View style={styles.actions}>
        <TaskActionButtons
          task={props.task}
          styles={styles}
          onStart={() => void start()}
          onRunHere={() => void runHere()}
          onContinue={(run) => void continueAgent(run)}
          onOpenAgent={props.onOpenAgent}
        />
      </View>
    </ScrollView>
  );
}

function MetaField(props: {
  styles: Styles;
  label: string;
  placeholder: string;
  value: string;
  isDate: boolean;
  onChange(value: string): void;
}) {
  const invalid = props.isDate && props.value.trim() !== "" && !isIsoDate(props.value.trim());
  return (
    <View style={{ gap: 4 }}>
      <Text style={props.styles.label}>{props.label}</Text>
      <TextInput
        style={props.styles.input}
        value={props.value}
        placeholder={props.placeholder}
        autoCapitalize="none"
        onChangeText={props.onChange}
      />
      {invalid ? <Text style={props.styles.warningText}>Use YYYY-MM-DD</Text> : null}
    </View>
  );
}
