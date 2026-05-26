import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

type Provider =
  | "github"
  | "slack"
  | "discord"
  | "jira"
  | "confluence"
  | "notion"
  | "linear"
  | "gitlab"
  | "azure-devops"
  | "teams"
  | "gmail"
  | "google-drive"
  | "google-calendar"
  | "asana"
  | "clickup"
  | "sentry"
  | "datadog"
  | "pagerduty"
  | "posthog";

interface VendorHttpCall {
  provider?: string;
  method?: string;
  path?: string;
  search?: string;
  hasAuthorization?: boolean;
  authorizationScheme?: string;
  contentType?: string;
  body?: string;
}

interface EndpointExpectation {
  id: string;
  purpose: "list" | "poll" | "writeback" | "graph-query";
  method: string;
  path: RegExp;
  auth: string;
  bodyIncludes?: string[];
}

interface ProviderSpec {
  provider: Provider;
  docs: string;
  authModel: string;
  expected: EndpointExpectation[];
}

interface SpecRow {
  provider: Provider;
  docs: string;
  authModel: string;
  checked: boolean;
  passed: boolean;
  endpoints: Array<{
    id: string;
    purpose: string;
    method: string;
    path: string;
    auth: string;
    matched: boolean;
    matchedCall?: Pick<VendorHttpCall, "method" | "path" | "authorizationScheme">;
  }>;
  capabilities: {
    listOrPoll: boolean;
    writeback: boolean;
    authorization: boolean;
  };
  gaps: string[];
}

interface VendorApiSpecReport {
  schemaVersion: "1.0";
  generatedAt: string;
  sourceArtifact: string;
  mode: "api-spec-contract";
  rows: SpecRow[];
  summary: {
    total: number;
    passed: number;
    failed: number;
    writebackReady: number;
    authReady: number;
  };
  passed: boolean;
}

const specs: ProviderSpec[] = [
  spec("github", "https://docs.github.com/en/rest", "Bearer token", [
    endpoint("pulls.list", "list", "GET", /^\/github\/repos\/[^/]+\/[^/]+\/pulls$/, "Bearer"),
    endpoint("actions.runs", "poll", "GET", /^\/github\/repos\/[^/]+\/[^/]+\/actions\/runs$/, "Bearer"),
    endpoint("issues.comments.create", "writeback", "POST", /^\/github\/repos\/[^/]+\/[^/]+\/issues\/\d+\/comments$/, "Bearer")
  ]),
  spec("slack", "https://api.slack.com/methods", "Bearer bot token", [
    endpoint("conversations.list", "list", "GET", /^\/slack\/api\/conversations\.list$/, "Bearer"),
    endpoint("conversations.history", "poll", "GET", /^\/slack\/api\/conversations\.history$/, "Bearer"),
    endpoint("chat.postMessage", "writeback", "POST", /^\/slack\/api\/chat\.postMessage$/, "Bearer")
  ]),
  spec("discord", "https://discord.com/developers/docs/reference", "Bot token", [
    endpoint("channel.messages", "list", "GET", /^\/discord\/api\/v\d+\/channels\/[^/]+\/messages$/, "Bot"),
    endpoint("channel.messages.create", "writeback", "POST", /^\/discord\/api\/v\d+\/channels\/[^/]+\/messages$/, "Bot")
  ]),
  spec("jira", "https://developer.atlassian.com/cloud/jira/platform/rest/v3/", "Basic email plus API token", [
    endpoint("issue.search", "list", "GET", /^\/jira\/rest\/api\/3\/search$/, "Basic"),
    endpoint("issue.comment.create", "writeback", "POST", /^\/jira\/rest\/api\/3\/issue\/[^/]+\/comment$/, "Basic")
  ]),
  spec("confluence", "https://developer.atlassian.com/cloud/confluence/rest/v1/", "Basic email plus API token", [
    endpoint("content.search", "list", "GET", /^\/confluence\/wiki\/rest\/api\/content$/, "Basic"),
    endpoint("content.comment.create", "writeback", "POST", /^\/confluence\/wiki\/rest\/api\/content\/[^/]+\/child\/comment$/, "Basic")
  ]),
  spec("notion", "https://developers.notion.com/reference/intro", "Bearer integration token", [
    endpoint("database.query", "list", "POST", /^\/notion\/v1\/databases\/[^/]+\/query$/, "Bearer"),
    endpoint("block.children.append", "writeback", "PATCH", /^\/notion\/v1\/blocks\/[^/]+\/children$/, "Bearer")
  ]),
  spec("linear", "https://developers.linear.app/docs/graphql/working-with-the-graphql-api", "Linear API key", [
    endpoint("graphql.issues", "list", "POST", /^\/linear\/graphql$/, "Raw"),
    endpoint("graphql.commentCreate", "writeback", "POST", /^\/linear\/graphql$/, "Raw", ["commentCreate"])
  ]),
  spec("gitlab", "https://docs.gitlab.com/api/rest/", "PRIVATE-TOKEN header", [
    endpoint("merge_requests.list", "list", "GET", /^\/gitlab\/api\/v4\/projects\/.+\/merge_requests$/, "Token"),
    endpoint("merge_requests.notes.create", "writeback", "POST", /^\/gitlab\/api\/v4\/projects\/.+\/merge_requests\/\d+\/notes$/, "Token")
  ]),
  spec("azure-devops", "https://learn.microsoft.com/en-us/rest/api/azure/devops/", "Basic PAT", [
    endpoint("git.pullrequests.list", "list", "GET", /^\/azure\/[^/]+\/[^/]+\/_apis\/git\/pullrequests$/, "Basic"),
    endpoint("git.pullrequestthreads.create", "writeback", "POST", /^\/azure\/[^/]+\/[^/]+\/_apis\/git\/repositories\/[^/]+\/pullRequests\/\d+\/threads$/, "Basic")
  ]),
  spec("teams", "https://learn.microsoft.com/en-us/graph/api/resources/teams-api-overview", "Microsoft Graph Bearer token", [
    endpoint("channel.messages.list", "list", "GET", /^\/teams\/v1\.0\/teams\/[^/]+\/channels\/[^/]+\/messages$/, "Bearer"),
    endpoint("channel.messages.create", "writeback", "POST", /^\/teams\/v1\.0\/teams\/[^/]+\/channels\/[^/]+\/messages$/, "Bearer")
  ]),
  spec("gmail", "https://developers.google.com/gmail/api/reference/rest", "Google OAuth Bearer token", [
    endpoint("messages.list", "list", "GET", /^\/google\/gmail\/v1\/users\/[^/]+\/messages$/, "Bearer"),
    endpoint("messages.modify", "writeback", "POST", /^\/google\/gmail\/v1\/users\/[^/]+\/messages\/[^/]+\/modify$/, "Bearer")
  ]),
  spec("google-drive", "https://developers.google.com/drive/api/reference/rest/v3", "Google OAuth Bearer token", [
    endpoint("files.list", "list", "GET", /^\/google\/drive\/v3\/files$/, "Bearer"),
    endpoint("files.update", "writeback", "PATCH", /^\/google\/drive\/v3\/files\/[^/]+$/, "Bearer")
  ]),
  spec("google-calendar", "https://developers.google.com/calendar/api/v3/reference", "Google OAuth Bearer token", [
    endpoint("events.list", "list", "GET", /^\/google\/calendar\/v3\/calendars\/[^/]+\/events$/, "Bearer"),
    endpoint("events.patch", "writeback", "PATCH", /^\/google\/calendar\/v3\/calendars\/[^/]+\/events\/[^/]+$/, "Bearer")
  ]),
  spec("asana", "https://developers.asana.com/reference/rest-api-reference", "Bearer token", [
    endpoint("tasks.list", "list", "GET", /^\/asana\/api\/1\.0\/tasks$/, "Bearer"),
    endpoint("stories.create", "writeback", "POST", /^\/asana\/api\/1\.0\/tasks\/[^/]+\/stories$/, "Bearer")
  ]),
  spec("clickup", "https://clickup.com/api", "ClickUp token header", [
    endpoint("tasks.list", "list", "GET", /^\/clickup\/api\/v2\/list\/[^/]+\/task$/, "Raw"),
    endpoint("task.comment.create", "writeback", "POST", /^\/clickup\/api\/v2\/task\/[^/]+\/comment$/, "Raw")
  ]),
  spec("sentry", "https://docs.sentry.io/api/", "Bearer token", [
    endpoint("project.issues.list", "list", "GET", /^\/sentry\/api\/0\/projects\/[^/]+\/[^/]+\/issues\/$/, "Bearer"),
    endpoint("issue.comments.create", "writeback", "POST", /^\/sentry\/api\/0\/issues\/[^/]+\/comments\/$/, "Bearer")
  ]),
  spec("datadog", "https://docs.datadoghq.com/api/latest/", "DD-API-KEY plus DD-APPLICATION-KEY", [
    endpoint("monitors.list", "list", "GET", /^\/datadog\/api\/v1\/monitor$/, "DD"),
    endpoint("events.create", "writeback", "POST", /^\/datadog\/api\/v1\/events$/, "DD")
  ]),
  spec("pagerduty", "https://developer.pagerduty.com/api-reference/", "Bearer token", [
    endpoint("incidents.list", "list", "GET", /^\/pagerduty\/incidents$/, "Bearer"),
    endpoint("incident.notes.create", "writeback", "POST", /^\/pagerduty\/incidents\/[^/]+\/notes$/, "Bearer")
  ]),
  spec("posthog", "https://posthog.com/docs/api", "Bearer personal API key", [
    endpoint("feature_flags.list", "list", "GET", /^\/posthog\/api\/projects\/[^/]+\/feature_flags\/$/, "Bearer"),
    endpoint("feature_flags.patch", "writeback", "PATCH", /^\/posthog\/api\/projects\/[^/]+\/feature_flags\/[^/]+\/$/, "Bearer")
  ])
];

export function verifyVendorApiSpecs(options: { input?: string; out?: string } = {}): VendorApiSpecReport {
  const sourceArtifact = options.input ?? "artifacts/vendor-connectors-live.json";
  const artifact = readJson(sourceArtifact, { calls: [] }) as { calls?: VendorHttpCall[] };
  const calls = Array.isArray(artifact.calls) ? artifact.calls : [];
  const rows = specs.map((providerSpec) => specRow(providerSpec, calls));
  const report: VendorApiSpecReport = {
    schemaVersion: "1.0",
    generatedAt: new Date().toISOString(),
    sourceArtifact,
    mode: "api-spec-contract",
    rows,
    summary: {
      total: rows.length,
      passed: rows.filter((row) => row.passed).length,
      failed: rows.filter((row) => !row.passed).length,
      writebackReady: rows.filter((row) => row.capabilities.writeback).length,
      authReady: rows.filter((row) => row.capabilities.authorization).length
    },
    passed: rows.length === specs.length && rows.every((row) => row.passed)
  };
  if (options.out) {
    mkdirSync(dirname(options.out), { recursive: true });
    writeFileSync(options.out, `${JSON.stringify(report, null, 2)}\n`);
  }
  return report;
}

function spec(provider: Provider, docs: string, authModel: string, expected: EndpointExpectation[]): ProviderSpec {
  return { provider, docs, authModel, expected };
}

function endpoint(id: string, purpose: EndpointExpectation["purpose"], method: string, path: RegExp, auth: string, bodyIncludes: string[] = []): EndpointExpectation {
  return { id, purpose, method, path, auth, bodyIncludes };
}

function specRow(providerSpec: ProviderSpec, calls: VendorHttpCall[]): SpecRow {
  const endpoints = providerSpec.expected.map((expected) => {
    const matchedCall = calls.find((call) => matches(call, providerSpec.provider, expected));
    return {
      id: expected.id,
      purpose: expected.purpose,
      method: expected.method,
      path: expected.path.source,
      auth: expected.auth,
      matched: Boolean(matchedCall),
      matchedCall: matchedCall ? { method: matchedCall.method, path: matchedCall.path, authorizationScheme: matchedCall.authorizationScheme } : undefined
    };
  });
  const listOrPoll = endpoints.some((endpoint) => ["list", "poll", "graph-query"].includes(endpoint.purpose) && endpoint.matched);
  const writeback = endpoints.some((endpoint) => endpoint.purpose === "writeback" && endpoint.matched);
  const authorization = endpoints.every((endpoint) => endpoint.matched);
  const gaps = [
    ...endpoints.filter((endpoint) => !endpoint.matched).map((endpoint) => `missing ${endpoint.id}`),
    ...(!listOrPoll ? ["missing list/poll API proof"] : []),
    ...(!writeback ? ["missing writeback API proof"] : []),
    ...(!authorization ? ["missing expected authorization proof"] : [])
  ];
  return {
    provider: providerSpec.provider,
    docs: providerSpec.docs,
    authModel: providerSpec.authModel,
    checked: true,
    passed: gaps.length === 0,
    endpoints,
    capabilities: {
      listOrPoll,
      writeback,
      authorization
    },
    gaps
  };
}

function matches(call: VendorHttpCall, provider: Provider, expected: EndpointExpectation): boolean {
  return call.provider === provider &&
    String(call.method ?? "").toUpperCase() === expected.method &&
    expected.path.test(String(call.path ?? "")) &&
    call.hasAuthorization === true &&
    call.authorizationScheme === expected.auth &&
    (expected.bodyIncludes ?? []).every((needle) => String(call.body ?? "").includes(needle));
}

function readJson(path: string, fallback: unknown): unknown {
  if (!existsSync(path)) return fallback;
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return fallback;
  }
}

function cliOptions(argv: string[]): { input?: string; out?: string } {
  const inputIndex = argv.indexOf("--input");
  const outIndex = argv.indexOf("--out");
  return {
    input: inputIndex >= 0 ? argv[inputIndex + 1] : "artifacts/vendor-connectors-live.json",
    out: outIndex >= 0 ? argv[outIndex + 1] : "artifacts/vendor-api-specs.json"
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const report = verifyVendorApiSpecs(cliOptions(process.argv.slice(2)));
  console.log(JSON.stringify(report, null, 2));
  if (!report.passed) process.exit(1);
}
