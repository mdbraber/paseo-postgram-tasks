import assert from "node:assert/strict";
import { test } from "node:test";
import * as contracts from "../shared/contracts.ts";

// Paseo's daemon rejects any other RPC name when installing the plugin.
const RPC_NAME = /^[a-z][a-z0-9._-]*$/;

test("every RPC name is one Paseo accepts", () => {
  const names = (Object.values(contracts) as unknown[])
    .filter((value): value is { name: string } => typeof value === "object" && value !== null && "input" in value && "output" in value)
    .map((contract) => contract.name);
  assert.ok(names.length >= 6);
  for (const name of names) assert.match(name, RPC_NAME);
});
