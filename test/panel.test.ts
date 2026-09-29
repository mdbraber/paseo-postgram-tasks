import assert from "node:assert/strict";
import { test } from "node:test";
import { tasksPanelLocation } from "../shared/panel.ts";

// The iOS/Android app's right-hand panel only has Changes, Files and PR; a request to
// open a plugin panel there changes a desktop layout the phone never shows.
test("opens in the right-hand panel on desktop and in the browser", () => {
  assert.equal(tasksPanelLocation("web"), "explorer");
});

test("opens as a workspace tab on iPhone, iPad and Android", () => {
  assert.equal(tasksPanelLocation("ios"), "workspace");
  assert.equal(tasksPanelLocation("android"), "workspace");
});
