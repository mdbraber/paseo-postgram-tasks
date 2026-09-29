import { Icon } from "@getpaseo/plugin/client/react-native";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import type { Styles } from "./theme.ts";

const VARIANTS = {
  default: { button: "button", text: "buttonText" },
  primary: { button: "primaryButton", text: "primaryText" },
  danger: { button: "dangerButton", text: "dangerText" },
} as const;

// A button with a Lucide icon before its label, in the icon's colour. A compact button shows only
// the icon; its label appears above it on hover, or on a long press where there's no pointer.
export function IconButton(props: {
  styles: Styles;
  icon: string;
  label: string;
  variant?: keyof typeof VARIANTS;
  compact?: boolean;
  onPress(): void;
}) {
  const { styles } = props;
  const [showLabel, setShowLabel] = useState(false);
  const variant = VARIANTS[props.variant ?? "default"];
  const text = styles[variant.text];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={props.label}
      style={[styles[variant.button], styles.iconButton, props.compact && styles.compactButton]}
      onPress={() => {
        setShowLabel(false);
        props.onPress();
      }}
      onHoverIn={() => setShowLabel(true)}
      onHoverOut={() => setShowLabel(false)}
      onLongPress={props.compact ? () => setShowLabel(true) : undefined}
      onPressOut={() => setShowLabel(false)}
    >
      <Icon name={props.icon} size={props.compact ? 16 : 14} color={text.color} />
      {props.compact ? null : <Text style={text}>{props.label}</Text>}
      {props.compact && showLabel ? (
        <View pointerEvents="none" style={styles.tooltip}>
          <Text style={styles.tooltipText} numberOfLines={1}>{props.label}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}
