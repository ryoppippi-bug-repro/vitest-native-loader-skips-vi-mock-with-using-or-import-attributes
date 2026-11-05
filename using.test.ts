import { expect, test, vi } from "vitest";

import { add } from "./math.ts";

vi.mock("./math.ts", () => ({ add: () => 42 }));

test("vi.mock applies in a file that uses `using`", () => {
  using spy = vi.fn();
  spy();
  expect(add(1, 2)).toBe(42);
});
