import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

export type ConnectorConfigSource = "env" | "file" | "missing";

export type ConnectorConfigSummary = {
  path: string;
  keys: Array<{
    key: string;
    aliases: string[];
    configured: boolean;
    source: ConnectorConfigSource;
    secret: boolean;
    valueRef?: string;
  }>;
};

type ConnectorConfigFile = {
  schemaVersion: "1.0";
  updatedAt: string;
  values: Record<string, string>;
};

export function connectorConfigPath(env: NodeJS.ProcessEnv = process.env): string {
  const runtimeRoot = resolve(env.COGNIBRAIN_RUNTIME_ROOT ?? env.COGNIBRAIN_HOME ?? process.cwd());
  return resolve(env.MEMORY_CONNECTOR_CONFIG_PATH ?? join(runtimeRoot, ".cognibrain", "connector-config.json"));
}

export function connectorConfigValue(key: string, env: NodeJS.ProcessEnv = process.env): string | undefined {
  const value = readConnectorConfig(env).values[key];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

export function connectorConfigSummary(keys: string[], env: NodeJS.ProcessEnv = process.env): ConnectorConfigSummary {
  const config = readConnectorConfig(env);
  const uniqueKeys = [...new Set(keys)].sort();
  return {
    path: connectorConfigPath(env),
    keys: uniqueKeys.map((key) => {
      const aliases = connectorConfigAliases(key);
      const envKey = aliases.find((alias) => env[alias]);
      const fileKey = aliases.find((alias) => config.values[alias]);
      const source: ConnectorConfigSource = envKey ? "env" : fileKey ? "file" : "missing";
      const sourceKey = envKey ?? fileKey;
      return {
        key,
        aliases: aliases.filter((alias) => alias !== key),
        configured: source !== "missing",
        source,
        secret: isSecretConnectorKey(key),
        valueRef: sourceKey ? `${source}:${sourceKey}` : undefined
      };
    })
  };
}

export function upsertConnectorConfigValues(values: Record<string, string | undefined>, env: NodeJS.ProcessEnv = process.env): ConnectorConfigSummary {
  const config = readConnectorConfig(env);
  const nextValues = { ...config.values };
  for (const [key, value] of Object.entries(values)) {
    if (!isAllowedConnectorConfigKey(key)) throw new Error(`Unsupported connector config key: ${key}`);
    const trimmed = typeof value === "string" ? value.trim() : "";
    if (trimmed) nextValues[key] = trimmed;
    else delete nextValues[key];
  }
  writeConnectorConfig({ schemaVersion: "1.0", updatedAt: new Date().toISOString(), values: nextValues }, env);
  return connectorConfigSummary(Object.keys(values), env);
}

export function isSecretConnectorKey(key: string): boolean {
  return /(TOKEN|SECRET|PASSWORD|API_KEY|APP_KEY|PRIVATE_KEY|PAT|OAUTH)/i.test(key);
}

export function connectorConfigAliases(key: string): string[] {
  if (key === "MEMORY_SLACK_TOKEN") return ["MEMORY_SLACK_TOKEN", "MEMORY_SLACK_BOT_TOKEN"];
  if (key === "MEMORY_DISCORD_BOT_TOKEN") return ["MEMORY_DISCORD_BOT_TOKEN", "MEMORY_DISCORD_TOKEN"];
  if (key === "MEMORY_GITHUB_TOKEN") return ["MEMORY_GITHUB_TOKEN", "GITHUB_TOKEN", "GH_TOKEN"];
  if (key === "MEMORY_JIRA_API_TOKEN") return ["MEMORY_JIRA_API_TOKEN", "JIRA_API_TOKEN"];
  if (key === "MEMORY_CONFLUENCE_API_TOKEN") return ["MEMORY_CONFLUENCE_API_TOKEN", "CONFLUENCE_API_TOKEN", "MEMORY_JIRA_API_TOKEN"];
  if (key === "MEMORY_NOTION_TOKEN") return ["MEMORY_NOTION_TOKEN", "NOTION_TOKEN"];
  if (key === "MEMORY_LINEAR_API_KEY") return ["MEMORY_LINEAR_API_KEY", "LINEAR_API_KEY"];
  if (key === "MEMORY_GITLAB_TOKEN") return ["MEMORY_GITLAB_TOKEN", "GITLAB_TOKEN"];
  if (key === "MEMORY_AZURE_DEVOPS_TOKEN") return ["MEMORY_AZURE_DEVOPS_TOKEN", "AZURE_DEVOPS_EXT_PAT"];
  if (key === "MEMORY_TEAMS_TOKEN") return ["MEMORY_TEAMS_TOKEN", "MICROSOFT_GRAPH_TOKEN"];
  if (key === "MEMORY_GOOGLE_TOKEN") return ["MEMORY_GOOGLE_TOKEN", "GOOGLE_OAUTH_TOKEN"];
  if (key === "MEMORY_ASANA_TOKEN") return ["MEMORY_ASANA_TOKEN", "ASANA_ACCESS_TOKEN"];
  if (key === "MEMORY_CLICKUP_TOKEN") return ["MEMORY_CLICKUP_TOKEN", "CLICKUP_API_TOKEN"];
  if (key === "MEMORY_SENTRY_TOKEN") return ["MEMORY_SENTRY_TOKEN", "SENTRY_AUTH_TOKEN"];
  if (key === "MEMORY_DATADOG_API_KEY") return ["MEMORY_DATADOG_API_KEY", "DD_API_KEY", "DATADOG_API_KEY"];
  if (key === "MEMORY_DATADOG_APP_KEY") return ["MEMORY_DATADOG_APP_KEY", "DD_APP_KEY", "DATADOG_APP_KEY"];
  if (key === "MEMORY_PAGERDUTY_TOKEN") return ["MEMORY_PAGERDUTY_TOKEN", "PAGERDUTY_TOKEN"];
  if (key === "MEMORY_POSTHOG_TOKEN") return ["MEMORY_POSTHOG_TOKEN", "POSTHOG_PERSONAL_API_KEY"];
  return [key];
}

function readConnectorConfig(env: NodeJS.ProcessEnv): ConnectorConfigFile {
  const path = connectorConfigPath(env);
  if (!existsSync(path)) return emptyConfig();
  try {
    const parsed = JSON.parse(readFileSync(path, "utf8")) as Partial<ConnectorConfigFile>;
    return {
      schemaVersion: "1.0",
      updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : new Date(0).toISOString(),
      values: sanitizeValues(parsed.values)
    };
  } catch {
    return emptyConfig();
  }
}

function writeConnectorConfig(config: ConnectorConfigFile, env: NodeJS.ProcessEnv): void {
  const path = connectorConfigPath(env);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(config, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
  try {
    chmodSync(path, 0o600);
  } catch {
    // Best effort on platforms that do not support chmod semantics.
  }
}

function sanitizeValues(values: unknown): Record<string, string> {
  if (!values || typeof values !== "object") return {};
  const next: Record<string, string> = {};
  for (const [key, value] of Object.entries(values as Record<string, unknown>)) {
    if (isAllowedConnectorConfigKey(key) && typeof value === "string" && value.trim()) next[key] = value.trim();
  }
  return next;
}

function isAllowedConnectorConfigKey(key: string): boolean {
  return /^MEMORY_[A-Z0-9_]+$/.test(key) || /^(GH_TOKEN|GITHUB_TOKEN|JIRA_API_TOKEN|CONFLUENCE_API_TOKEN|NOTION_TOKEN|LINEAR_API_KEY|GITLAB_TOKEN|AZURE_DEVOPS_EXT_PAT|MICROSOFT_GRAPH_TOKEN|GOOGLE_OAUTH_TOKEN|ASANA_ACCESS_TOKEN|CLICKUP_API_TOKEN|SENTRY_AUTH_TOKEN|DD_API_KEY|DD_APP_KEY|DATADOG_API_KEY|DATADOG_APP_KEY|PAGERDUTY_TOKEN|POSTHOG_PERSONAL_API_KEY)$/.test(key);
}

function emptyConfig(): ConnectorConfigFile {
  return { schemaVersion: "1.0", updatedAt: new Date(0).toISOString(), values: {} };
}
