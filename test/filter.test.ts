import assert from "node:assert/strict";
import { test } from "node:test";
import { cleanTags, matchesTags, narrowingTags, projectKeys, selectionTags } from "../shared/filter.ts";

const tagged = (...tags: string[]) => ({ tags });

test("collects each project key once, sorted", () => {
  const tasks = [tagged("project:ops", "spiff"), tagged("project:blink"), tagged("project:devops", "project:ops"), tagged("todo")];
  assert.deepEqual(projectKeys(tasks), ["blink", "devops", "ops"]);
});

test("skips a project tag without a key", () => {
  assert.deepEqual(projectKeys([tagged("project:")]), []);
});

test("collects the other tags once, sorted, without project tags", () => {
  const tasks = [tagged("project:ops", "zark", "todo"), tagged("project:ops", "spiff", "todo")];
  assert.deepEqual(narrowingTags(tasks), ["spiff", "todo", "zark"]);
});

test("a task matches when it carries every tag", () => {
  const task = tagged("project:ops", "naggon", "todo");
  assert.equal(matchesTags(task, ["naggon", "todo"]), true);
  assert.equal(matchesTags(task, ["naggon", "spiff"]), false);
  assert.equal(matchesTags(task, []), true);
});

test("cleans typed tags: trimmed, no blanks, no duplicates, no project tags", () => {
  assert.deepEqual(cleanTags([" naggon ", "", "naggon", "project:ops", "todo"]), ["naggon", "todo"]);
});

test("a selection is the project tag followed by its narrowing tags", () => {
  assert.deepEqual(selectionTags("ops", ["naggon"]), ["project:ops", "naggon"]);
  assert.deepEqual(selectionTags("ops", []), ["project:ops"]);
});
