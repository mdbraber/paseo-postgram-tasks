export interface DropZone<Key> {
  key: Key;
  top: number;
  bottom: number;
}

export interface DropLayout<Key> {
  /** Sections as measured when the drag started, before any drop slot opened. */
  zones: readonly DropZone<Key>[];
  /** The section the card comes from. */
  source: Key;
  /** The space the card takes up: the slot that opens under the target's heading is this tall. */
  gap: number;
}

// The section a card dragged to `y` (window coordinates) drops into, or null outside all sections.
// `current` is the section whose slot is open now. Once the card leaves its own section, that section
// gives up the card's space and the target gains it as a slot, so sections below the source move up
// and sections below the target move down. The answer is whichever section is drawn under the pointer.
export function dropTargetAt<Key>(layout: DropLayout<Key>, y: number, current: Key | null): Key | null {
  const sorted = [...layout.zones].sort((a, b) => a.top - b.top);
  const moved = current !== null && current !== layout.source;
  const slot = moved ? sorted.findIndex((zone) => zone.key === current) : -1;
  const source = moved ? sorted.findIndex((zone) => zone.key === layout.source) : -1;
  const drawn = sorted.map((zone, index) => {
    // Sections sit apart; closing the gaps keeps the target while the pointer crosses them.
    const bottom = sorted[index + 1]?.top ?? zone.bottom;
    const shift = (slot !== -1 && index > slot ? layout.gap : 0) - (source !== -1 && index > source ? layout.gap : 0);
    const grow = (index === slot ? layout.gap : 0) - (index === source ? layout.gap : 0);
    return { key: zone.key, top: zone.top + shift, bottom: bottom + shift + grow };
  });
  return drawn.find((zone) => y >= zone.top && y < zone.bottom)?.key ?? null;
}
