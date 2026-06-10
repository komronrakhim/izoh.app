import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("design tokens", () => {
  it("defines OpenRunde and core semantic Tailwind tokens", async () => {
    const css = await readFile(path.join(process.cwd(), "src/assets/styles/tokens.css"), "utf8");

    expect(css).toContain('font-family: "OpenRunde"');
    expect(css).toContain("--color-surface");
    expect(css).toContain("--color-foreground");
    expect(css).toContain("--color-module-review");
    expect(css).toContain("--iz-content-safe-bottom");
  });
});
