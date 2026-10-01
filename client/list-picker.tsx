import { useRpc } from "@getpaseo/plugin/client";
import { TextInput } from "@getpaseo/plugin/client/react-native";
import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { describeError } from "./describe-error.ts";
import type { Styles } from "./theme.ts";
import { listProjects } from "../shared/contracts.ts";
import { cleanTags } from "../shared/filter.ts";
import { normalizeTaskKey } from "../shared/task-key.ts";

// Picks which tasks the panel shows: one project, and any number of tags to narrow it by.
// Every choice is applied straight away.
export function ListPicker(props: {
  styles: Styles;
  taskKey: string;
  /** The key the project's folder gives it. */
  defaultKey: string;
  filterTags: string[];
  /** The tags found on the chosen project's tasks. */
  availableTags: string[];
  onSelect(taskKey: string, filterTags: string[]): void;
  onClose(): void;
}) {
  const { styles, taskKey, filterTags } = props;
  const loadProjects = useRpc(listProjects);
  const [known, setKnown] = useState<string[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [typedKey, setTypedKey] = useState("");
  const [typedTag, setTypedTag] = useState("");

  useEffect(() => {
    let current = true;
    void loadProjects({}).then((result) => {
      if (!current) return;
      if (result.ok) setKnown(result.value);
      else setLoadError(describeError(result.error));
    });
    return () => {
      current = false;
    };
  }, [loadProjects]);

  const sorted = (values: string[]) => [...new Set(values)].sort((a, b) => a.localeCompare(b));
  // The folder's key and the current one may have no tasks yet.
  const keys = sorted([...known, props.defaultKey, taskKey]);
  // Chosen tags stay listed even when no task carries them.
  const tags = sorted([...props.availableTags, ...filterTags]);

  const toggle = (label: string, selected: boolean, onPress: () => void) => (
    <Pressable
      key={label}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={selected ? styles.selectedButton : styles.button}
      onPress={onPress}
    >
      <Text style={selected ? styles.selectedText : styles.buttonText}>{label}</Text>
    </Pressable>
  );

  // Another project has other tags, so switching starts without any.
  function pickProject(key: string) {
    if (key && key !== taskKey) props.onSelect(key, []);
  }

  function toggleTag(tag: string) {
    props.onSelect(taskKey, filterTags.includes(tag) ? filterTags.filter((other) => other !== tag) : [...filterTags, tag]);
  }

  function submitKey() {
    pickProject(normalizeTaskKey(typedKey));
    setTypedKey("");
  }

  function submitTag() {
    const next = cleanTags([...filterTags, typedTag]);
    if (next.length !== filterTags.length) props.onSelect(taskKey, next);
    setTypedTag("");
  }

  return (
    <View style={styles.card}>
      <Text style={styles.label}>Project</Text>
      <View style={styles.actions}>{keys.map((key) => toggle(key, key === taskKey, () => pickProject(key)))}</View>
      {loadError ? <Text style={styles.warningText}>Couldn't load the other projects: {loadError}</Text> : null}
      <TextInput
        style={styles.input}
        value={typedKey}
        placeholder="Other project…"
        autoCapitalize="none"
        onChangeText={setTypedKey}
        onSubmitEditing={submitKey}
      />

      <Text style={styles.label}>Only tasks tagged</Text>
      {tags.length ? (
        <View style={styles.actions}>{tags.map((tag) => toggle(tag, filterTags.includes(tag), () => toggleTag(tag)))}</View>
      ) : (
        <Text style={styles.mutedText}>This project's tasks have no other tags.</Text>
      )}
      <TextInput
        style={styles.input}
        value={typedTag}
        placeholder="Other tag…"
        autoCapitalize="none"
        onChangeText={setTypedTag}
        onSubmitEditing={submitTag}
      />

      <View style={styles.actions}>
        <Pressable accessibilityRole="button" style={styles.button} onPress={props.onClose}>
          <Text style={styles.buttonText}>Close</Text>
        </Pressable>
      </View>
    </View>
  );
}
