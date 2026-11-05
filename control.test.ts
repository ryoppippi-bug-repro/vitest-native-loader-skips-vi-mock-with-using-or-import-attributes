import { expect, test, vi } from "vitest";

import { add } from "./math.ts";

vi.mock("./math.ts", () => ({ add: () => 42 }));

// The same mock in a file with neither `using` nor import attributes.
test("vi.mock applies in a file with plain syntax", () => {
  const spy = vi.fn();
  spy();
  expect(add(1, 2)).toBe(42);
});
