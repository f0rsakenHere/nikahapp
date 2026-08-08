import { describe, expect, it } from "vitest";
import { safeNext } from "./redirect";

/* Only `safeNext` is unit-testable here — the rest of actions.ts touches
 * cookies and the database, and is covered end to end by
 * scripts/auth-flow.cjs against a real browser. */
describe("safeNext", () => {
  it("keeps a path on this site", () => {
    expect(safeNext("/settings")).toBe("/settings");
    expect(safeNext("/conversations?id=1")).toBe("/conversations?id=1");
  });

  it("falls back when there is nothing to go back to", () => {
    expect(safeNext(null)).toBe("/onboarding");
    expect(safeNext("")).toBe("/onboarding");
    expect(safeNext(undefined)).toBe("/onboarding");
  });

  it("refuses an absolute URL to another origin", () => {
    expect(safeNext("https://evil.example/phish")).toBe("/onboarding");
    expect(safeNext("http://evil.example")).toBe("/onboarding");
  });

  it("refuses a protocol-relative URL, which browsers treat as off-site", () => {
    expect(safeNext("//evil.example")).toBe("/onboarding");
    expect(safeNext("/\\evil.example")).toBe("/onboarding");
  });

  it("refuses a bare path with no leading slash", () => {
    expect(safeNext("evil.example")).toBe("/onboarding");
  });
});
