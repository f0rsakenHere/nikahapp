import { defineConfig } from "vitest/config";

/* Unit tests for `src/lib/domain` — the state machines, authorisation
   rules and validation that carry the product's actual logic.

   Deliberately `node`, not `jsdom`: nothing in `lib/domain` may touch the
   DOM, the database or the network. That constraint is what makes the
   introduction lifecycle exhaustively testable, so the test environment
   enforces it rather than trusting a convention. Component tests, when
   they arrive, get their own project with jsdom.

   `.mts` rather than `.ts` because the nearest package.json has no
   `"type": "module"` — the scripts/ checkers are CommonJS `.cjs` and
   should stay that way.

   See docs/APP-PLAN.md §4.3 and §11. */
export default defineConfig({
  resolve: {
    // resolves the `@/*` alias from tsconfig.json — native, no plugin
    tsconfigPaths: true,
  },
  test: {
    environment: "node",
    include: ["src/lib/**/*.test.ts"],
    /* A run that finds no tests is a failure, not a pass — the same rule
       the Playwright checkers in scripts/ follow. */
    passWithNoTests: false,
  },
});
