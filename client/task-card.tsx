import { copyText, useToast } from "@getpaseo/plugin/client/react-native";
import { useRef, useState } from "react";
import { PanResponder, Pressable, Text, View } from "react-native";
import { IconButton } from "./icon-button.tsx";
import { TaskActionButtons } from "./task-actions.tsx";
import type { Styles } from "./theme.ts";
import { readRuns, type TaskRun } from "../shared/runs.ts";
import { moveOptions, taskBody, taskTitle, visibleTags, type MoveOption, type Task } from "../shared/tasks.ts";

export interface CardDrag {
  onStart(): void;
  /** `dy` is how far the pointer moved since the drag started; `y` is its position in the window. */
  onMove(dy: number, y: number): void;
  /** `dropped` is false when the gesture was cancelled. */
  onEnd(dropped: boolean): void;
}

export function TaskCard(props: {
  task: Task;
  styles: Styles;
  /** Absent on the floating copy that follows the pointer. */
  drag?: CardDrag;
  onOpen(): void;
  onStart(): void;
  onRunHere(): void;
  onContinue(run: TaskRun): void;
  onMove(option: MoveOption): void;
  onOpenAgent(run: TaskRun): void;
  onDelete(): void;
}) {
  const { task, styles } = props;
  const toast = useToast();
  const [menuOpen, setMenuOpen] = useState(false);
  const body = taskBody(task.content);
  const context = typeof task.metadata.context === "string" ? task.metadata.context : null;
  const chips = [...(context ? [context] : []), ...visibleTags(task.tags)];
  const runs = readRuns(task.metadata);

  // The responder is created once, so it reads the latest drag callbacks through a ref.
  const drag = useRef(props.drag);
  drag.current = props.drag;
  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => drag.current !== undefined,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => drag.current?.onStart(),
      onPanResponderMove: (_, gesture) => drag.current?.onMove(gesture.dy, gesture.moveY),
      onPanResponderRelease: () => drag.current?.onEnd(true),
      onPanResponderTerminate: () => drag.current?.onEnd(false),
    }),
  ).current;

  return (
    <View style={[styles.card, !props.drag && styles.dragging]}>
      <View style={styles.cardHeader}>
        <View accessibilityLabel="Drag to another status" {...responder.panHandlers}>
          <Text style={styles.dragHandle}>⠿</Text>
        </View>
        <Pressable accessibilityRole="button" style={{ flex: 1, gap: 4 }} onPress={props.onOpen}>
          <Text style={styles.cardTitle}>{taskTitle(task.content)}</Text>
          {body ? <Text style={styles.cardBody}>{body}</Text> : null}
        </Pressable>
      </View>
      {chips.length > 0 ? (
        <View style={styles.chips}>
          {chips.map((chip) => <Text key={chip} style={styles.chip}>{chip}</Text>)}
        </View>
      ) : null}
      <View style={styles.cardButtons}>
        <TaskActionButtons
          task={task}
          styles={styles}
          onStart={props.onStart}
          onRunHere={props.onRunHere}
          onContinue={props.onContinue}
          onOpenAgent={props.onOpenAgent}
          compact
        />
        {runs.map((run) => (
          <IconButton
            key={run.agentId}
            styles={styles}
            compact
            icon="ExternalLink"
            label={`Open agent (${run.hostLabel})`}
            onPress={() => props.onOpenAgent(run)}
          />
        ))}
        <IconButton
          styles={styles}
          compact
          icon="Copy"
          label="Copy text"
          onPress={() =>
            void copyText(task.content).then(
              () => toast.show("Task text copied."),
              () => toast.error("Couldn't copy the task text."),
            )
          }
        />
        <IconButton styles={styles} compact icon="ArrowRightLeft" label="Move to…" onPress={() => setMenuOpen((open) => !open)} />
        <IconButton styles={styles} compact icon="Trash2" label="Delete" variant="danger" onPress={props.onDelete} />
      </View>
      {menuOpen ? (
        <View style={styles.actions}>
          {moveOptions(task.status).map((option) => (
            <Pressable
              key={option.status}
              accessibilityRole="button"
              style={styles.button}
              onPress={() => {
                setMenuOpen(false);
                props.onMove(option);
              }}
            >
              <Text style={styles.buttonText}>{option.label}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}
