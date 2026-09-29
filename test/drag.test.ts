import assert from "node:assert/strict";
import test from "node:test";
import { dropTargetAt } from "../shared/drag.ts";

// Inbox 100–200 (holding the dragged card, 80 tall with spacing), Next 212–250, Waiting 262–300.
const layout = {
  zones: [
    { key: "inbox", top: 100, bottom: 200 },
    { key: "next", top: 212, bottom: 250 },
    { key: "waiting", top: 262, bottom: 300 },
  ],
  source: "inbox",
  gap: 80,
};
// The card coming from Waiting instead, which then holds it: Waiting is 262–380.
const fromWaiting = {
  ...layout,
  zones: [...layout.zones.slice(0, 2), { key: "waiting", top: 262, bottom: 380 }],
  source: "waiting",
};

test("finds the section under the pointer, across the space between sections", () => {
  assert.equal(dropTargetAt(layout, 150, "inbox"), "inbox");
  assert.equal(dropTargetAt(layout, 205, "inbox"), "inbox");
  assert.equal(dropTargetAt(layout, 220, "inbox"), "next");
  assert.equal(dropTargetAt(layout, 50, "inbox"), null);
  assert.equal(dropTargetAt(layout, 500, "inbox"), null);
});

test("once the card leaves its section, sections below its old spot move up", () => {
  // With Next's slot open, Inbox is 100–132 and Next 132–262 (its slot included).
  assert.equal(dropTargetAt(layout, 120, "next"), "inbox");
  assert.equal(dropTargetAt(layout, 140, "next"), "next");
  assert.equal(dropTargetAt(layout, 255, "next"), "next");
  // Waiting is back where it was measured, 262–300.
  assert.equal(dropTargetAt(layout, 270, "next"), "waiting");
});

test("a collapsed section below an open slot is reachable where it is drawn", () => {
  // Slot in Inbox: Inbox is 100–292 and the collapsed Next is drawn at 292–342.
  assert.equal(dropTargetAt(fromWaiting, 300, "inbox"), "next");
  // Slot in Next: Next is 212–342 and Waiting, without the card, is just its heading at 342–380.
  assert.equal(dropTargetAt(fromWaiting, 300, "next"), "next");
  assert.equal(dropTargetAt(fromWaiting, 345, "next"), "waiting");
  assert.equal(dropTargetAt(fromWaiting, 385, "next"), null);
});
