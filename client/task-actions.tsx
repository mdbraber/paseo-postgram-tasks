import { IconButton } from "./icon-button.tsx";
import type { Styles } from "./theme.ts";
import { useAgentState } from "./use-agent-state.ts";
import { latestRun, readRuns, taskActions, type TaskRun } from "../shared/runs.ts";
import type { Task } from "../shared/tasks.ts";

// The actions that fit what the task's latest agent is doing.
export function TaskActionButtons(props: {
  task: Task;
  styles: Styles;
  onStart(): void;
  /** Sends the task to this workspace's agent. */
  onRunHere(): void;
  onContinue(run: TaskRun): void;
  onOpenAgent(run: TaskRun): void;
  /** Icons only, with labels on hover. */
  compact?: boolean;
}) {
  const { styles } = props;
  const actions = taskActions(props.task, useAgentState(props.task));
  const run = latestRun(readRuns(props.task.metadata));
  const runHere = <IconButton styles={styles} compact={props.compact} icon="CornerDownRight" label="Run in this workspace" onPress={props.onRunHere} />;

  if (actions === "open" && run) {
    return <IconButton styles={styles} compact={props.compact} icon="Bot" label="Open agent" variant="primary" onPress={() => props.onOpenAgent(run)} />;
  }
  if (actions === "continue" && run) {
    return (
      <>
        <IconButton styles={styles} compact={props.compact} icon="MessageSquare" label="Continue" variant="primary" onPress={() => props.onContinue(run)} />
        <IconButton styles={styles} compact={props.compact} icon="Plus" label="Run in new workspace" onPress={props.onStart} />
        {runHere}
      </>
    );
  }
  return (
    <>
      <IconButton styles={styles} compact={props.compact} icon="Play" label="Run in new workspace" variant="primary" onPress={props.onStart} />
      {runHere}
    </>
  );
}
