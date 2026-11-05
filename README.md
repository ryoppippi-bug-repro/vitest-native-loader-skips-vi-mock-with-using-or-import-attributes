# vi.mock is silently skipped under `viteModuleRunner: false` when the file uses `using` or import attributes

Reproduction for <ISSUE_URL> — vitest 5.1.0, Node.js 24.21.0, pnpm 10.20.0.

## Steps

```sh
pnpm install --frozen-lockfile
pnpm repro:official   # Vite module runner: 3 passed
pnpm repro            # native loader (NATIVE=1): using.test.ts and import-attributes.test.ts fail
```

## What happens

With `experimental.viteModuleRunner: false`, a `vi.mock` call is silently not applied when the test file contains a `using` declaration or an import with import attributes. The test then runs against the real module. Nothing is printed. The same files pass with the Vite module runner (the default).

```ts
// using.test.ts
import { expect, test, vi } from "vitest";

import { add } from "./math.ts";

vi.mock("./math.ts", () => ({ add: () => 42 }));

test("vi.mock applies in a file that uses `using`", () => {
  using spy = vi.fn();
  spy();
  expect(add(1, 2)).toBe(42); // AssertionError: expected 3 to be 42
});
```

```ts
// import-attributes.test.ts
import { expect, test, vi } from "vitest";

import data from "./data.json" with { type: "json" };
import { add } from "./math.ts";

vi.mock("./math.ts", () => ({ add: () => 42 }));

test("a JSON import keeps its import attributes in a file with vi.mock", () => {
  expect(data.name).toBe("repro");
  expect(add(1, 2)).toBe(42); // AssertionError: expected 3 to be 42
});
```

`control.test.ts` has the same mock with neither construct and passes on both runners.

## Cause

The native loader hoists `vi.mock` by parsing the test file with acorn: `packages/vitest/src/runtime/workers/native.ts` (`import { parse } from 'acorn'`, used by `hoistMocks`), and automocking does the same in `packages/vitest/src/runtime/moduleRunner/nativeModuleMocker.ts`. `packages/vitest/package.json` pins `"acorn": "8.11.3"` (the bundled `dist/chunks/acorn.*.js` in vitest 5.1.0 reports `version = "8.11.3"`). acorn 8.11 cannot parse `using` declarations or import attributes. `hoistMocks` in `packages/mocker/src/node/hoistMocks.ts` catches the parse error, logs it with `console.error`, and returns without transforming, so the file is loaded with the mock never registered. In this reproduction that `console.error` does not reach the terminal either.

The Vite module runner path parses with Vite's `parseAst`, which handles both constructs, which is why the default runner passes.

## A second problem behind the first

Once the parser accepts import attributes, the hoisting itself drops them. `hoistMocks` rewrites every hoisted import as

```js
const __vi_import_0__ = await globalThis["__vitest_mocker__"].wrapDynamicImport(() => import("./data.json"));
```

(`packages/mocker/src/node/hoistMocks.ts`, the loop after `// hoist actual dynamic imports last`, lines 589–598), without the `{ with: { type: "json" } }` option. Under Node's loader the JSON import then fails:

```
TypeError: Module "file://<repo>/data.json" needs an import attribute of "type: json"
```

I saw this by replacing `parse` with Vite's `parseAst` in a copied install of vitest 5.1.0 (`dist/chunks/native.*.js`) and running `import-attributes.test.ts`; the mock then applied and the JSON import failed as above. This repository does not include that modified copy, so the stock install shows only the first problem.

## Analysis

Read on `vitest-dev/vitest` main at 71ad4dfa1d8fb0753faaa55afc55ade021d0b395. Likely fixes, not patched and rebuilt upstream:

- Parse with a parser that supports current syntax in `native.ts` and `nativeModuleMocker.ts`, e.g. a newer acorn (8.15+ parses both) or Vite's `parseAst` as the module-runner path does.
- Carry `importNode.attributes` into the generated `import(...)` call in `hoistMocks`.
- Surface the parse failure instead of only logging it, since a skipped hoist turns into an unrelated assertion failure.

## How it was found

A monorepo's API test project was switched to `experimental.viteModuleRunner: false` to measure Node's loader against the Vite module runner. Every mock-heavy test file there uses `using` (its lint rules require `using` for spies), and one imports JSON with `with { type: "json" }`; those files ran against the real modules. Replacing the parser in a patched Vitest fixed the mocks and exposed the dropped import attributes. No framework is needed to reproduce either problem.

## Files

`vitest.config.ts` sets `experimental.viteModuleRunner` to `false` when `NATIVE=1` and leaves it on otherwise; `pnpm repro` and `pnpm repro:official` differ only in that variable.
