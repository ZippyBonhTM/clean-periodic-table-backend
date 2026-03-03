type NodeEnv = "development" | "test" | "production";
type DataSource = "memory" | "mongo";

type AppEnv = {
  nodeEnv: NodeEnv;
  host: string;
  port: number;
  mongoUri: string | null;
  dataSource: DataSource;
};

const validNodeEnvs: NodeEnv[] = ["development", "test", "production"];
const validDataSources: DataSource[] = ["memory", "mongo"];
type EnvInput = Partial<Record<string, string | undefined>>;

function parseNodeEnv(value: string | undefined): NodeEnv {
  const normalized = value ?? "development";

  if (!validNodeEnvs.includes(normalized as NodeEnv)) {
    throw new Error(`Invalid NODE_ENV: "${normalized}". Use development | test | production.`);
  }

  return normalized as NodeEnv;
}

function parsePort(value: string | undefined): number {
  const parsed = Number.parseInt(value ?? "3000", 10);

  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65535) {
    throw new Error(`Invalid PORT: "${value}".`);
  }

  return parsed;
}

function parseDataSource(value: string | undefined, mongoUri: string | null): DataSource {
  const inferred = value ?? (mongoUri ? "mongo" : "memory");

  if (!validDataSources.includes(inferred as DataSource)) {
    throw new Error(`Invalid DATA_SOURCE: "${inferred}". Use memory | mongo.`);
  }

  return inferred as DataSource;
}

function readMongoUri(input: EnvInput): string | null {
  const uri = input.MONGODB_URI ?? input.MONGODB_URL ?? input.MONGO_URL ?? input.DATABASE_URL ?? null;

  if (uri === null) {
    return null;
  }

  const trimmed = uri.trim();

  return trimmed.length > 0 ? trimmed : null;
}

function buildEnv(input: EnvInput = process.env): AppEnv {
  const nodeEnv = parseNodeEnv(input.NODE_ENV);
  const mongoUri = readMongoUri(input);
  const dataSource = parseDataSource(input.DATA_SOURCE, mongoUri);

  if (nodeEnv === "production" && dataSource === "mongo" && mongoUri === null) {
    throw new Error("Mongo URI is required in production when DATA_SOURCE=mongo.");
  }

  if (dataSource === "mongo" && mongoUri === null) {
    throw new Error(
      "DATA_SOURCE is set to mongo but no Mongo URI was provided. Set MONGODB_URI (or fallback name).",
    );
  }

  return {
    nodeEnv,
    host: input.HOST ?? "0.0.0.0",
    port: parsePort(input.PORT),
    mongoUri,
    dataSource,
  };
}

const env = buildEnv();

export default env;
export { buildEnv };
export type { AppEnv, DataSource, NodeEnv };
