type NodeEnv = "development" | "test" | "production";
type DataSource = "memory" | "mongo";

type AppEnv = {
  nodeEnv: NodeEnv;
  host: string;
  port: number;
  mongoUri: string | null;
  dataSource: DataSource;
  authRequired: boolean;
  authServiceUrl: string | null;
  authValidatePath: string;
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

function parseBoolean(
  value: string | undefined,
  defaultValue: boolean,
  fieldName: string,
): boolean {
  if (value === undefined) {
    return defaultValue;
  }

  if (value === "true") {
    return true;
  }

  if (value === "false") {
    return false;
  }

  throw new Error(`Invalid ${fieldName}: "${value}". Use true | false.`);
}

function readMongoUri(input: EnvInput): string | null {
  const uri =
    input.MONGO_URI ??
    input.MONGODB_URI ??
    input.MONGODB_URL ??
    input.MONGO_URL ??
    input.DATABASE_URL ??
    null;

  if (uri === null) {
    return null;
  }

  const trimmed = uri.trim();

  return trimmed.length > 0 ? trimmed : null;
}

function readAuthServiceUrl(input: EnvInput): string | null {
  const url = input.AUTH_SERVICE_URL ?? null;

  if (url === null) {
    return null;
  }

  const trimmed = url.trim();

  return trimmed.length > 0 ? trimmed : null;
}

function buildEnv(input: EnvInput = process.env): AppEnv {
  const nodeEnv = parseNodeEnv(input.NODE_ENV);
  const mongoUri = readMongoUri(input);
  const dataSource = parseDataSource(input.DATA_SOURCE, mongoUri);
  const authRequired = parseBoolean(input.AUTH_REQUIRED, false, "AUTH_REQUIRED");
  const authServiceUrl = readAuthServiceUrl(input);
  const authValidatePath = input.AUTH_VALIDATE_PATH?.trim() || "/validate-token";

  if (nodeEnv === "production" && dataSource === "mongo" && mongoUri === null) {
    throw new Error("Mongo URI is required in production when DATA_SOURCE=mongo.");
  }

  if (dataSource === "mongo" && mongoUri === null) {
    throw new Error(
      "DATA_SOURCE is set to mongo but no Mongo URI was provided. Set MONGODB_URI (or fallback name).",
    );
  }

  if (authRequired && authServiceUrl === null) {
    throw new Error("AUTH_SERVICE_URL is required when AUTH_REQUIRED=true.");
  }

  return {
    nodeEnv,
    host: input.HOST ?? "0.0.0.0",
    port: parsePort(input.PORT),
    mongoUri,
    dataSource,
    authRequired,
    authServiceUrl,
    authValidatePath,
  };
}

const env = buildEnv();

export default env;
export { buildEnv };
export type { AppEnv, DataSource, NodeEnv };
