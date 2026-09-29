import type { PluginWorkspacePanelProps } from "@getpaseo/plugin/client";
import { useRpc } from "@getpaseo/plugin/client";
import { ScrollView, TextInput, useToast } from "@getpaseo/plugin/client/react-native";
import { useMemo, useRef, useState } from "react";
import { Animated, Pressable, Text, View } from "react-native";
import { describeError } from "./describe-error.ts";
import { IconButton } from "./icon-button.tsx";
import { TaskCard } from "./task-card.tsx";
import { ContinueDialog } from "./continue-dialog.tsx";
import { StartDialog } from "./start-dialog.tsx";
import { TaskEditor } from "./task-editor.tsx";
import { makeStyles } from "./theme.ts";
import { useProject } from "./use-project.ts";
import { CARD_SPACING, useCardDrag } from "./use-card-drag.ts";
import { useLaunchOptions } from "./use-launch-options.ts";
import { useRunHere } from "./use-run-here.ts";
import { useTasks } from "./use-tasks.ts";
import { completeTask, createTask, updateTask } from "../shared/contracts.ts";
import type { TaskRun } from "../shared/runs.ts";
import { normalizeTaskKey } from "../shared/task-key.ts";
import {
  groupTasks, isIsoDate, moveOptions, SECTION_ORDER, startsCollapsed, STATUS_LABELS, taskTitle,
  type MoveOption, type SectionStatus, type Task,
} from "../shared/tasks.ts";

type DropKey = SectionStatus | "done";

export function TasksPanel(props: PluginWorkspacePanelProps) {
  const styles = useMemo(() => makeStyles(props.theme), [props.theme]);
  const toast = useToast();
  const project = useProject(props.workspaceId);
  const { state, reload, replace } = useTasks(project?.taskKey ?? null);
  const create = useRpc(createTask);
  const update = useRpc(updateTask);
  const complete = useRpc(completeTask);
  const launch = useLaunchOptions(props.workspaceId, project?.projectRootPath ?? null);
  const runHereRequest = useRunHere({ workspaceId: props.workspaceId, host: props.host, launch });

  const [draft, setDraft] = useState("");
  const [collapsed, setCollapsed] = useState<Partial<Record<SectionStatus | "done", boolean>>>({});
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [scheduling, setScheduling] = useState<{ task: Task; date: string } | null>(null);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  // The New workspace dialog keeps the exact task it was opened with (the editor passes the
  // version it just saved), so a refresh can't swap in older text.
  const [startingTask, setStartingTask] = useState<Task | null>(null);
  const [continuing, setContinuing] = useState<{ task: Task; run: TaskRun } | null>(null);
  // Enter both submits and blurs the key field; save once.
  const savingKey = useRef(false);
  // Dragging a card onto another section moves it there.
  const drag = useCardDrag<DropKey, Task>({
    resolveDrop(task, target) {
      const option = moveOptions(task.status).find((candidate) => candidate.status === target);
      if (!option) return null;
      // Scheduling asks for a date first, so the card goes back until one is given.
      if (option.needsDate) {
        setScheduling({ task, date: "" });
        return null;
      }
      return () => void move(task, option);
    },
  });

  if (!project) return <View style={styles.screen} />;

  async function add() {
    const content = draft.trim();
    if (!content || !project) return;
    const result = await create({ taskKey: project.taskKey, content });
    if (!result.ok) return toast.error(describeError(result.error));
    setDraft("");
    replace(result.value);
    setCollapsed((current) => ({ ...current, inbox: false }));
  }

  async function move(task: Task, option: MoveOption, date?: string) {
    if (option.needsDate && !date) return setScheduling({ task, date: "" });
    // Show the move right away; a failure reloads the list from Postgram.
    replace({ ...task, status: option.status, updatedAt: new Date().toISOString() });
    const result =
      option.status === "done"
        ? await complete({ id: task.id, version: task.version })
        : await update({
            id: task.id,
            version: task.version,
            patch: {
              status: option.status,
              ...(date ? { metadata: { ...task.metadata, scheduled_for: date } } : {}),
            },
          });
    if (!result.ok) {
      toast.error(describeError(result.error));
      void reload();
      return;
    }
    replace(result.value);
  }

  async function runHere(task: Task) {
    const sent = await runHereRequest(task);
    if (!sent) return;
    if (sent.task) replace(sent.task);
    setEditingTaskId(null);
    props.navigation?.openAgent({ agentId: sent.agentId, serverId: props.host.id });
  }

  function openAgent(run: TaskRun) {
    props.navigation?.openAgent({ agentId: run.agentId, serverId: run.serverId });
  }

  async function saveTaskKey(value: string) {
    if (!project || savingKey.current) return;
    savingKey.current = true;
    try {
      const key = normalizeTaskKey(value);
      if (key !== project.taskKey) {
        const ok = await project.saveProjectSettings({ taskKey: key || undefined, defaultProfileId: project.defaultProfileId });
        if (!ok) toast.error("Couldn't save the task key.");
      }
      setEditingKey(null);
    } finally {
      savingKey.current = false;
    }
  }

  // A slot under a section's heading that opens while a card is dragged over the section.
  const dropSlot = (key: DropKey) => (
    <Animated.View ref={drag.slotRef(key)} style={{ height: drag.slotHeight(key), overflow: "hidden" }}>
      <View style={[styles.dropSlot, { marginTop: CARD_SPACING, height: drag.ghost?.height ?? 0 }]} />
    </Animated.View>
  );

  const addBox = (
    <View style={styles.addBox}>
      <TextInput
        style={styles.addInput}
        value={draft}
        multiline
        numberOfLines={5}
        placeholder="Add a task…"
        onChangeText={setDraft}
        onKeyPress={(event) => {
          // Enter starts a new line; Cmd or Ctrl+Enter adds the task.
          const key = event.nativeEvent as { key: string; metaKey?: boolean; ctrlKey?: boolean };
          if (key.key === "Enter" && (key.metaKey || key.ctrlKey)) {
            event.preventDefault();
            void add();
          }
        }}
      />
      <View style={styles.actions}>
        <IconButton styles={styles} icon="Plus" label="Add task" variant={draft.trim() ? "primary" : "default"} onPress={() => void add()} />
      </View>
    </View>
  );

  // A card in a section, with the space it leaves and the outline that stays while it's dragged.
  const renderCard = (task: Task, section: DropKey) => (
    <Animated.View
      key={task.id}
      ref={drag.cardRef(task.id)}
      style={[
        { paddingTop: CARD_SPACING },
        drag.draggingId === task.id ? { height: drag.sourceSpace, overflow: "hidden" } : null,
      ]}
    >
      {/* The lifted card stays mounted, since it owns the gesture, but only its outline shows. */}
      {/* Done cards are dimmed. */}
      <View style={{ opacity: drag.draggingId === task.id ? 0 : section === "done" ? 0.55 : 1 }}>
        <TaskCard
          task={task}
          styles={styles}
          drag={drag.handlers(task, section)}
          onOpen={() => setEditingTaskId(task.id)}
          onStart={() => setStartingTask(task)}
          onRunHere={() => void runHere(task)}
          onContinue={(run) => setContinuing({ task, run })}
          onMove={(option) => void move(task, option)}
          onOpenAgent={openAgent}
          onDelete={() => void move(task, { status: "archived", label: "Delete", needsDate: false })}
        />
      </View>
      {drag.draggingId === task.id && drag.ghost ? (
        <View style={[styles.dropSlot, { position: "absolute", top: CARD_SPACING, left: 0, right: 0, height: drag.ghost.height }]} />
      ) : null}
    </Animated.View>
  );

  const isCollapsed = (status: SectionStatus, count: number) => collapsed[status] ?? startsCollapsed(status, count);

  const allTasks = state.status === "ready" ? [...state.open, ...state.done] : [];
  const editingTask = allTasks.find((task) => task.id === editingTaskId);
  const dialog = startingTask ? (
    <StartDialog
      task={startingTask}
      project={project}
      host={props.host}
      launch={launch}
      styles={styles}
      onClose={() => setStartingTask(null)}
      onStarted={(task, agentId) => {
        if (task) replace(task);
        setStartingTask(null);
        setEditingTaskId(null);
        props.navigation?.openAgent({ agentId, serverId: props.host.id });
      }}
    />
  ) : continuing ? (
    <ContinueDialog
      task={continuing.task}
      run={continuing.run}
      styles={styles}
      onClose={() => setContinuing(null)}
      onContinued={(task) => {
        if (task) replace(task);
        else void reload();
        setContinuing(null);
        setEditingTaskId(null);
        openAgent(continuing.run);
      }}
    />
  ) : null;
  if (editingTask) {
    return (
      <>
        {dialog}
        <TaskEditor
          task={editingTask}
          styles={styles}
          onChange={replace}
          onBack={() => setEditingTaskId(null)}
          onStart={setStartingTask}
          onRunHere={(task) => void runHere(task)}
          onContinue={(task, run) => setContinuing({ task, run })}
          onOpenAgent={openAgent}
        />
      </>
    );
  }

  return (
    <View ref={drag.rootRef} style={[styles.screen, drag.ghost ? styles.screenDragging : null]}>
      <ScrollView style={styles.screen} contentContainerStyle={styles.content} {...drag.scrollProps}>
      {dialog}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Text style={styles.label}>Task list</Text>
          {editingKey === null ? (
            <>
              <Text style={styles.value}>project:{project.taskKey}</Text>
              <Pressable accessibilityRole="button" onPress={() => setEditingKey(project.taskKey)}>
                <Text style={styles.link}>Change</Text>
              </Pressable>
            </>
          ) : (
            <TextInput
              style={[styles.input, { flex: 1 }]}
              value={editingKey}
              autoFocus
              autoCapitalize="none"
              onChangeText={setEditingKey}
              onSubmitEditing={() => void saveTaskKey(editingKey)}
              onBlur={() => void saveTaskKey(editingKey)}
            />
          )}
        </View>
      </View>

      {addBox}

      {scheduling ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Schedule “{taskTitle(scheduling.task.content)}”</Text>
          <TextInput
            style={styles.input}
            value={scheduling.date}
            placeholder="YYYY-MM-DD"
            autoFocus
            onChangeText={(date) => setScheduling({ ...scheduling, date })}
          />
          <View style={styles.actions}>
            <Pressable
              accessibilityRole="button"
              style={isIsoDate(scheduling.date) ? styles.primaryButton : styles.button}
              disabled={!isIsoDate(scheduling.date)}
              onPress={() => {
                const { task, date } = scheduling;
                setScheduling(null);
                void move(task, { status: "scheduled", label: "Schedule", needsDate: true }, date);
              }}
            >
              <Text style={isIsoDate(scheduling.date) ? styles.primaryText : styles.buttonText}>Schedule</Text>
            </Pressable>
            <Pressable accessibilityRole="button" style={styles.button} onPress={() => setScheduling(null)}>
              <Text style={styles.buttonText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      {state.status === "loading" ? <Text style={styles.mutedText}>Loading tasks…</Text> : null}

      {state.status === "ready" && state.refreshError ? (
        <View style={styles.notice}>
          <Text style={styles.noticeText}>Couldn't refresh: {describeError(state.refreshError)}</Text>
          <Pressable accessibilityRole="button" style={styles.button} onPress={() => void reload()}>
            <Text style={styles.buttonText}>Retry</Text>
          </Pressable>
        </View>
      ) : null}

      {state.status === "error" ? (
        <View style={styles.notice}>
          <Text style={styles.noticeText}>{describeError(state.error)}</Text>
          <Pressable accessibilityRole="button" style={styles.button} onPress={() => void reload()}>
            <Text style={styles.buttonText}>Retry</Text>
          </Pressable>
        </View>
      ) : null}

      {state.status === "ready"
        ? (() => {
            const groups = groupTasks(state.open);
            return (
              <>
                {SECTION_ORDER.map((status) => {
                  const tasks = groups[status];
                  const closed = isCollapsed(status, tasks.length);
                  return (
                    <View key={status} ref={drag.sectionRef(status)}>
                      <Pressable
                        accessibilityRole="button"
                        style={styles.sectionHeader}
                        onPress={() => setCollapsed({ ...collapsed, [status]: !closed })}
                      >
                        <Text style={styles.sectionTitle}>{closed ? "▸" : "▾"} {STATUS_LABELS[status]}</Text>
                        <Text style={styles.count}>{tasks.length}</Text>
                      </Pressable>
                      {dropSlot(status)}
                      {!closed
                        ? tasks.map((task) => renderCard(task, status))
                        : null}
                    </View>
                  );
                })}
                <View ref={drag.sectionRef("done")}>
                  <Pressable
                    accessibilityRole="button"
                    style={styles.sectionHeader}
                    onPress={() => setCollapsed({ ...collapsed, done: !(collapsed.done ?? true) })}
                  >
                    <Text style={styles.sectionTitle}>{collapsed.done ?? true ? "▸" : "▾"} Done</Text>
                    <Text style={styles.count}>{state.done.length}</Text>
                  </Pressable>
                  {dropSlot("done")}
                  {!(collapsed.done ?? true)
                    ? state.done.map((task) => renderCard(task, "done"))
                    : null}
                </View>
              </>
            );
          })()
        : null}
    </ScrollView>
      {drag.ghost ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.ghost,
            { left: drag.ghost.left, top: drag.ghost.top, width: drag.ghost.width },
            drag.ghostStyle,
          ]}
        >
          <TaskCard
            task={drag.ghost.item}
            styles={styles}
            onOpen={() => {}}
            onStart={() => {}}
            onRunHere={() => {}}
            onContinue={() => {}}
            onMove={() => {}}
            onOpenAgent={() => {}}
            onDelete={() => {}}
          />
        </Animated.View>
      ) : null}
    </View>
  );
}
