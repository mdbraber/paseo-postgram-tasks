import { useLayoutEffect, useRef, useState } from "react";
import { Animated, Easing, type ScrollView as NativeScrollView, type View } from "react-native";
import { dropTargetAt, type DropLayout, type DropZone } from "../shared/drag.ts";

/** Space above each card in a section; a slot or a lifted card's spot includes it. */
export const CARD_SPACING = 6;
const SETTLE = { duration: 180, easing: Easing.out(Easing.cubic), useNativeDriver: false } as const;
// Auto-scroll starts this close to the list's top or bottom edge and speeds up towards it.
const SCROLL_EDGE = 56;
const SCROLL_SPEED = 14;

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

function measure(view: View | null | undefined): Promise<Rect | null> {
  return new Promise((resolve) => {
    if (!view) return resolve(null);
    view.measureInWindow((x, y, width, height) => resolve({ x, y, width, height }));
  });
}

export interface DragGhost<Item> {
  item: Item;
  left: number;
  top: number;
  width: number;
  height: number;
}

interface Session<Key, Item> {
  item: Item;
  source: Key;
  target: Key | null;
  layout: DropLayout<Key>;
  root: Rect;
  card: Rect;
  startScroll: number;
  dy: number;
  /** Pointer position in the window; NaN until the pointer first moves. */
  pointerY: number;
  ready: boolean;
  ending: boolean;
  frame: number | null;
}

// Drag and drop between sections of a scrolling list, built on React Native's Animated so that
// moving the pointer never re-renders the list:
// - a floating copy of the card follows the pointer above the list, lifted with a shadow;
// - the card's own spot and a slot under the target section's heading open and close smoothly,
//   so sections move aside to show where the card will land;
// - the list scrolls when the pointer nears its top or bottom edge;
// - on release the copy glides into the slot (or back home) before the move is applied.
export function useCardDrag<Key extends string, Item extends { id: string }>(options: {
  /** Decides a drop on another section: return the move to apply once the card has landed, or null to send it back. */
  resolveDrop(item: Item, target: Key): (() => void) | null;
}) {
  const rootRef = useRef<View>(null);
  const scrollRef = useRef<NativeScrollView>(null);
  const sectionViews = useRef(new Map<Key, View>());
  const slotViews = useRef(new Map<Key, View>());
  const cardViews = useRef(new Map<string, View>());
  const slots = useRef(new Map<Key, Animated.Value>());
  const sourceSpace = useRef(new Animated.Value(0)).current;
  const ghostY = useRef(new Animated.Value(0)).current;
  const lift = useRef(new Animated.Value(0)).current;
  const scroll = useRef({ y: 0, contentHeight: 0 });
  const session = useRef<Session<Key, Item> | null>(null);
  const [ghost, setGhost] = useState<DragGhost<Item> | null>(null);
  const latest = useRef(options);
  latest.current = options;

  function slotHeight(key: Key): Animated.Value {
    let value = slots.current.get(key);
    if (!value) {
      value = new Animated.Value(0);
      slots.current.set(key, value);
    }
    return value;
  }

  // Once a drop has re-rendered the list, close every slot before that frame is painted, so the
  // card appears exactly where its slot was.
  useLayoutEffect(() => {
    if (!ghost) for (const value of slots.current.values()) value.setValue(0);
  }, [ghost]);

  const opensSlot = (s: Session<Key, Item>, key: Key | null) => key !== null && key !== s.source;

  function retarget(s: Session<Key, Item>) {
    if (!s.ready || s.ending || Number.isNaN(s.pointerY)) return;
    const y = s.pointerY + (scroll.current.y - s.startScroll);
    const target = dropTargetAt(s.layout, y, s.target);
    if (target === s.target) return;
    if (opensSlot(s, s.target)) Animated.timing(slotHeight(s.target as Key), { ...SETTLE, toValue: 0 }).start();
    if (opensSlot(s, target)) Animated.timing(slotHeight(target as Key), { ...SETTLE, toValue: s.layout.gap }).start();
    Animated.timing(sourceSpace, { ...SETTLE, toValue: opensSlot(s, target) ? 0 : s.layout.gap }).start();
    s.target = target;
  }

  function autoScroll() {
    const s = session.current;
    if (!s || s.ending) return;
    const top = s.root.y;
    const bottom = s.root.y + s.root.height;
    let speed = 0;
    if (s.pointerY < top + SCROLL_EDGE) speed = -Math.min(1, (top + SCROLL_EDGE - s.pointerY) / SCROLL_EDGE);
    else if (s.pointerY > bottom - SCROLL_EDGE) speed = Math.min(1, (s.pointerY - bottom + SCROLL_EDGE) / SCROLL_EDGE);
    if (speed !== 0) {
      const max = Math.max(0, scroll.current.contentHeight - s.root.height);
      const next = Math.min(max, Math.max(0, scroll.current.y + speed * SCROLL_SPEED));
      if (next !== scroll.current.y) {
        scroll.current.y = next;
        scrollRef.current?.scrollTo({ y: next, animated: false });
        retarget(s);
      }
    }
    s.frame = requestAnimationFrame(autoScroll);
  }

  function finish(apply?: () => void) {
    session.current = null;
    apply?.();
    setGhost(null);
    lift.setValue(0);
  }

  function start(item: Item, source: Key) {
    if (session.current) return;
    const s: Session<Key, Item> = {
      item, source, target: source, layout: { zones: [], source, gap: 0 },
      root: { x: 0, y: 0, width: 0, height: 0 }, card: { x: 0, y: 0, width: 0, height: 0 },
      startScroll: scroll.current.y, dy: 0, pointerY: Number.NaN, ready: false, ending: false, frame: null,
    };
    session.current = s;
    const keys = [...sectionViews.current.keys()];
    void Promise.all([
      measure(rootRef.current),
      measure(cardViews.current.get(item.id)),
      ...keys.map((key) => measure(sectionViews.current.get(key))),
    ]).then(([root, spot, ...sections]) => {
      if (session.current !== s || s.ending || !root || !spot) return;
      const zones = keys.flatMap((key, index): DropZone<Key>[] => {
        const rect = sections[index];
        return rect ? [{ key, top: rect.y, bottom: rect.y + rect.height }] : [];
      });
      s.root = root;
      // The card sits below its spacing within its spot.
      s.card = { x: spot.x, y: spot.y + CARD_SPACING, width: spot.width, height: spot.height - CARD_SPACING };
      s.layout = { zones, source, gap: spot.height };
      s.startScroll = scroll.current.y;
      s.ready = true;
      sourceSpace.setValue(spot.height);
      ghostY.setValue(s.dy);
      setGhost({ item, left: s.card.x - root.x, top: s.card.y - root.y, width: s.card.width, height: s.card.height });
      Animated.spring(lift, { toValue: 1, speed: 24, bounciness: 6, useNativeDriver: false }).start();
      retarget(s);
      s.frame = requestAnimationFrame(autoScroll);
    });
  }

  function move(dy: number, y: number) {
    const s = session.current;
    if (!s || s.ending) return;
    s.dy = dy;
    s.pointerY = y;
    if (!s.ready) return;
    ghostY.setValue(dy);
    retarget(s);
  }

  function end(dropped: boolean) {
    const s = session.current;
    if (!s || s.ending) return;
    s.ending = true;
    if (s.frame !== null) cancelAnimationFrame(s.frame);
    if (!s.ready) return finish();
    Animated.spring(lift, { toValue: 0, speed: 24, bounciness: 0, useNativeDriver: false }).start();
    const target = s.target;
    const apply = dropped && target !== null && target !== s.source ? latest.current.resolveDrop(s.item, target) : null;
    if (apply && target !== null) {
      void measure(slotViews.current.get(target)).then((slot) => {
        const toValue = slot ? slot.y + CARD_SPACING - s.card.y : s.dy;
        Animated.timing(ghostY, { ...SETTLE, duration: 160, toValue }).start(() => finish(apply));
      });
      return;
    }
    // Back to its own spot, which moved if the list scrolled.
    if (opensSlot(s, target)) Animated.timing(slotHeight(target as Key), { ...SETTLE, toValue: 0 }).start();
    Animated.timing(sourceSpace, { ...SETTLE, toValue: s.layout.gap }).start();
    Animated.timing(ghostY, { ...SETTLE, toValue: s.startScroll - scroll.current.y }).start(() => finish());
  }

  return {
    ghost,
    draggingId: ghost?.item.id ?? null,
    rootRef,
    scrollProps: {
      ref: scrollRef,
      scrollEnabled: ghost === null,
      scrollEventThrottle: 16,
      onScroll: (event: { nativeEvent: { contentOffset: { y: number } } }) => {
        scroll.current.y = event.nativeEvent.contentOffset.y;
      },
      onContentSizeChange: (_width: number, height: number) => {
        scroll.current.contentHeight = height;
      },
    },
    sectionRef: (key: Key) => (view: View | null) => {
      if (view) sectionViews.current.set(key, view);
      else sectionViews.current.delete(key);
    },
    slotRef: (key: Key) => (view: View | null) => {
      if (view) slotViews.current.set(key, view);
      else slotViews.current.delete(key);
    },
    cardRef: (id: string) => (view: View | null) => {
      if (view) cardViews.current.set(id, view);
      else cardViews.current.delete(id);
    },
    slotHeight,
    sourceSpace,
    ghostStyle: {
      transform: [{ translateY: ghostY }, { scale: lift.interpolate({ inputRange: [0, 1], outputRange: [1, 1.02] }) }],
      shadowOpacity: lift.interpolate({ inputRange: [0, 1], outputRange: [0, 0.35] }),
    },
    handlers: (item: Item, source: Key) => ({
      onStart: () => start(item, source),
      onMove: move,
      onEnd: end,
    }),
  };
}
