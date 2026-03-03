import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

import env from "../../config/env.js";
import type { AppEnv } from "../../config/env.js";
import { connectMongo, disconnectMongo } from "./connect.js";
import PeriodicTableModel from "./models/PeriodicTableModel.js";

type PeriodicTableFixture = {
  elements: Array<Record<string, unknown>>;
};

async function seedPeriodicTable(appEnv: Pick<AppEnv, "mongoUri"> = env): Promise<void> {
  if (appEnv.mongoUri === null) {
    throw new Error("Missing Mongo URI. Set MONGODB_URI (or fallback equivalent) before seeding.");
  }

  const fixture = JSON.parse(
    readFileSync(new URL("../repositories/PeriodicTable.json", import.meta.url), "utf8"),
  ) as PeriodicTableFixture;

  await connectMongo(appEnv.mongoUri);

  await PeriodicTableModel.updateOne({}, { $set: { elements: fixture.elements } }, { upsert: true });

  await disconnectMongo();
}

async function runSeedScript(appEnv: Pick<AppEnv, "mongoUri"> = env): Promise<number> {
  try {
    await seedPeriodicTable(appEnv);
    process.stdout.write("Periodic table seed completed.\n");
    return 0;
  } catch (error: unknown) {
    process.stderr.write(`Seed failed: ${String(error)}\n`);

    try {
      await disconnectMongo();
    } catch {
      // ignore cleanup error
    }

    return 1;
  }
}

function isExecutedDirectly(importMetaUrl: string): boolean {
  const entrypointPath = process.argv[1];

  if (entrypointPath === undefined) {
    return false;
  }

  return pathToFileURL(entrypointPath).href === importMetaUrl;
}

if (isExecutedDirectly(import.meta.url)) {
  runSeedScript().then((exitCode) => process.exit(exitCode));
}

export { isExecutedDirectly, runSeedScript, seedPeriodicTable };
