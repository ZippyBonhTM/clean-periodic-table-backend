import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

type PackageJson = {
  scripts?: Record<string, string>;
};

const packageJson = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8")) as PackageJson;

describe("runtime scripts", () => {
  it("defines build with tsc + tsc-alias for path aliases", () => {
    expect(packageJson.scripts?.build).toBe("tsc -p tsconfig.json && tsc-alias -p tsconfig.json");
  });

  it("defines postbuild to copy PeriodicTable.json into dist", () => {
    expect(packageJson.scripts?.postbuild).toContain("PeriodicTable.json");
    expect(packageJson.scripts?.postbuild).toContain("dist/src/infrastructure/repositories");
  });

  it("defines start and seed scripts from dist output", () => {
    expect(packageJson.scripts?.start).toBe("node --env-file=.env dist/main.js");
    expect(packageJson.scripts?.["seed:periodic-table"]).toBe(
      "node --env-file=.env dist/infrastructure/mongoose/seedPeriodicTable.js",
    );
  });
});
