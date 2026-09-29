import type { PluginTheme } from "@getpaseo/plugin";

export function makeStyles(theme: PluginTheme) {
  const c = theme.colors;
  return {
    screen: { flex: 1, backgroundColor: c.surface0 },
    content: { padding: 12, gap: 12 },
    header: { gap: 4 },
    headerRow: { flexDirection: "row" as const, alignItems: "center" as const, gap: 8 },
    label: { color: c.foregroundMuted, fontSize: 12 },
    value: { color: c.foreground, fontSize: 13, fontWeight: "600" as const },
    link: { color: c.accent, fontSize: 12 },
    input: {
      borderWidth: 1, borderColor: c.border, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8,
      color: c.foreground, backgroundColor: c.surface1, fontSize: 14,
    },
    addBox: { gap: 6 },
    // Five lines of text.
    addInput: {
      minHeight: 5 * 20 + 16, borderWidth: 1, borderColor: c.border, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8,
      color: c.foreground, backgroundColor: c.surface1, fontSize: 14, lineHeight: 20, textAlignVertical: "top" as const,
    },
    editorInput: {
      flex: 1, minHeight: 200, borderWidth: 1, borderColor: c.border, borderRadius: 8, padding: 10,
      color: c.foreground, backgroundColor: c.surface1, fontSize: 14, textAlignVertical: "top" as const,
    },
    sectionHeader: { flexDirection: "row" as const, alignItems: "center" as const, gap: 6, paddingVertical: 4 },
    sectionTitle: { color: c.foreground, fontSize: 16, fontWeight: "700" as const },
    count: { color: c.foregroundMuted, fontSize: 13 },
    // Sections carry a border so the drop target can light up without shifting the layout.
    dropSlot: { borderWidth: 1, borderStyle: "dashed" as const, borderColor: c.accent, borderRadius: 8, backgroundColor: c.surface1 },
    // The floating copy of a dragged card.
    ghost: {
      position: "absolute" as const, zIndex: 100, shadowColor: "#000000", shadowRadius: 16,
      shadowOffset: { width: 0, height: 8 }, elevation: 8,
    },
    card: { borderWidth: 1, borderColor: c.border, borderRadius: 8, padding: 10, gap: 6, backgroundColor: c.surface1 },
    cardTitle: { color: c.foreground, fontSize: 12, fontWeight: "600" as const },
    cardBody: { color: c.foregroundMuted, fontSize: 11, lineHeight: 16 },
    cardHeader: { flexDirection: "row" as const, alignItems: "flex-start" as const, gap: 6 },
    dragHandle: { color: c.foregroundMuted, fontSize: 14, paddingRight: 4, userSelect: "none" as const },
    dragging: { borderColor: c.accent },
    // Stops text selection on the web while a card is dragged.
    screenDragging: { flex: 1, userSelect: "none" as const },
    chips: { flexDirection: "row" as const, flexWrap: "wrap" as const, gap: 4 },
    chip: { color: c.foregroundMuted, fontSize: 11, backgroundColor: c.surface2, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
    actions: { flexDirection: "row" as const, flexWrap: "wrap" as const, gap: 6, alignItems: "center" as const },
    primaryButton: { backgroundColor: c.accent, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 6 },
    primaryText: { color: c.accentForeground, fontSize: 12, fontWeight: "600" as const },
    button: { backgroundColor: c.surface2, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 6 },
    buttonText: { color: c.foreground, fontSize: 12 },
    iconButton: { flexDirection: "row" as const, alignItems: "center" as const, gap: 6 },
    // A card's buttons, in a row under its text.
    cardButtons: { flexDirection: "row" as const, flexWrap: "wrap" as const, alignItems: "center" as const, gap: 6, marginTop: 8 },
    compactButton: { paddingHorizontal: 8, paddingVertical: 6 },
    tooltip: {
      position: "absolute" as const, bottom: "100%" as const, left: 0, marginBottom: 4, zIndex: 50,
      backgroundColor: c.foreground, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 3,
    },
    tooltipText: { color: c.surface0, fontSize: 11 },
    dangerButton: { backgroundColor: c.statusDanger, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 6 },
    dangerText: { color: "#ffffff", fontSize: 12, fontWeight: "600" as const },
    selectedButton: { backgroundColor: c.accent, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 6 },
    selectedText: { color: c.accentForeground, fontSize: 12 },
    // The New workspace dialog, after Paseo's own screen.
    chipRow: { flexDirection: "row" as const, flexWrap: "wrap" as const, alignItems: "center" as const, gap: 4 },
    launchChip: {
      flexDirection: "row" as const, alignItems: "center" as const, gap: 6, borderRadius: 6,
      paddingHorizontal: 8, paddingVertical: 5,
    },
    chipOpen: { backgroundColor: c.surface2 },
    chipText: { color: c.foreground, fontSize: 13 },
    projectBadge: {
      width: 16, height: 16, borderRadius: 4, backgroundColor: c.accent, color: c.accentForeground,
      fontSize: 10, fontWeight: "700" as const, textAlign: "center" as const, lineHeight: 16, overflow: "hidden" as const,
    },
    onlineDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: c.statusSuccess },
    composer: { borderWidth: 1, borderColor: c.border, borderRadius: 12, backgroundColor: c.surface1, padding: 10, gap: 8 },
    composerInput: { minHeight: 120, maxHeight: 360, color: c.foreground, fontSize: 14, textAlignVertical: "top" as const, padding: 4 },
    sendButton: {
      width: 30, height: 30, borderRadius: 15, backgroundColor: c.accent,
      alignItems: "center" as const, justifyContent: "center" as const,
    },
    sendButtonDisabled: { backgroundColor: c.surface2 },
    menu: { borderWidth: 1, borderColor: c.border, borderRadius: 8, backgroundColor: c.surface1, paddingVertical: 4, maxHeight: 280 },
    menuHeading: { color: c.foregroundMuted, fontSize: 11, paddingHorizontal: 10, paddingTop: 6, paddingBottom: 2 },
    menuItem: { paddingHorizontal: 10, paddingVertical: 6 },
    menuItemSelected: { backgroundColor: c.surface2 },
    menuItemText: { color: c.foreground, fontSize: 13 },
    notice: { borderRadius: 8, padding: 10, gap: 6, backgroundColor: c.surface1, borderWidth: 1, borderColor: c.statusDanger },
    noticeText: { color: c.foreground, fontSize: 13 },
    warningText: { color: c.statusWarning, fontSize: 12 },
    mutedText: { color: c.foregroundMuted, fontSize: 12 },
  };
}
export type Styles = ReturnType<typeof makeStyles>;
