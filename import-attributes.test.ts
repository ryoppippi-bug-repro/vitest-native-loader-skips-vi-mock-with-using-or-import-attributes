import { expect, test, vi } from "vitest";

import data from "./data.json" with { type: "json" };
import { add } from "./math.ts";

vi.mock("./math.ts", () => ({ add: () => 42 }));

test("a JSON import keeps its import attributes in a file with vi.mock", () => {
  expect(data.name).toBe("repro");
  expect(add(1, 2)).toBe(42);
});
