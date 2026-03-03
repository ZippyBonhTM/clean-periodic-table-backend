import { createInterface } from "node:readline/promises";
import { pathToFileURL } from "node:url";

import env from "../../config/env.js";
import type { AppEnv } from "../../config/env.js";
import { loadPeriodicTableFixture } from "../repositories/periodicTableFixture.js";
import { connectMongo, disconnectMongo } from "./connect.js";
import ElementModel from "./models/ElementModel.js";

type PromptMongoUri = (question: string) => Promise<string>;

async function promptMongoUri(question: string): Promise<string> {
  const cli = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  try {
    return (await cli.question(question)).trim();
  } finally {
    cli.close();
  }
}

async function resolveMongoUri(
  appEnv: Pick<AppEnv, "mongoUri">,
  askMongoUri: PromptMongoUri,
): Promise<string> {
  if (appEnv.mongoUri !== null && appEnv.mongoUri.trim().length > 0) {
    return appEnv.mongoUri;
  }

  const promptedUri = (await askMongoUri("MONGO_URI: ")).trim();

  if (promptedUri.length === 0) {
    throw new Error("Missing Mongo URI. Set MONGO_URI (or fallback equivalent) before seeding.");
  }

  return promptedUri;
}

async function seedPeriodicTable(
  appEnv: Pick<AppEnv, "mongoUri"> = env,
  askMongoUri: PromptMongoUri = promptMongoUri,
): Promise<void> {
  const mongoUri = await resolveMongoUri(appEnv, askMongoUri);
  const fixtureElements = loadPeriodicTableFixture();

  await connectMongo(mongoUri);

  for (const element of fixtureElements) {
    await ElementModel.updateOne(
      {
        symbol: element.symbol,
        name: element.name,
      },
      {
        $set: element,
      },
      { upsert: true },
    );
  }

  await disconnectMongo();
}

async function runSeedScript(
  appEnv: Pick<AppEnv, "mongoUri"> = env,
  askMongoUri: PromptMongoUri = promptMongoUri,
): Promise<number> {
  try {
    await seedPeriodicTable(appEnv, askMongoUri);
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

export { isExecutedDirectly, promptMongoUri, resolveMongoUri, runSeedScript, seedPeriodicTable };
export type { PromptMongoUri };
