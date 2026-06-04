import { estimateTokens } from "./text";
import type {
  ActionGuardReport,
  CodebaseScope,
  CodingContextPack,
  EngineeringMemoryClassifier,
  EngineeringMemoryKind,
  EngineeringMemoryMetadata,
  Memory,
  MemoryInput,
  PatchEvidenceTrail,
  Provenance,
  SearchResult
} from "./types";

const ENGINEERING_KINDS: EngineeringMemoryKind[] = [
  "repo_policy",
  "architecture_decision",
  "review_correction",
  "tool_outcome",
  "procedure",
  "forbidden_action",
  "migration_note",
  "test_strategy",
  "dependency_rule",
  "generated_file_rule"
];

const HIGH_IMPACT_KINDS = new Set<EngineeringMemoryKind>([
  "repo_policy",
  "architecture_decision",
  "forbidden_action",
  "migration_note",
  "test_strategy",
  "dependency_rule",
  "generated_file_rule"
]);

export function isEngineeringMemoryKind(value: unknown): value is EngineeringMemoryKind {
  return typeof value === "string" && ENGINEERING_KINDS.includes(value as EngineeringMemoryKind);
}

export function classifyEngineeringMemory(content: string, metadata: Record<string, unknown> = {}, classifier?: EngineeringMemoryClassifier): EngineeringMemoryKind | undefined {
  const requestedKind = (metadata.engineeringKind ?? (metadata.engineering as { kind?: unknown } | undefined)?.kind) as unknown;
  if (isEngineeringMemoryKind(requestedKind)) return requestedKind;
  const action = metadata.action as { command?: unknown; tests?: unknown } | undefined;
  if (action?.command || Array.isArray(action?.tests)) return "tool_outcome";
  const providerKind = classifier?.classifyEngineering({ content, metadata, now: new Date() }).kind;
  if (isEngineeringMemoryKind(providerKind)) return providerKind;
  return undefined;
}

export function withEngineeringMemoryMetadata(input: MemoryInput, classifier?: EngineeringMemoryClassifier): MemoryInput {
  const providerDecision = classifier?.classifyEngineering({ content: input.content, metadata: input.metadata ?? {}, now: new Date() });
  const kind = classifyEngineeringMemory(input.content, input.metadata ?? {}, providerDecision?.kind ? undefined : classifier) ?? providerDecision?.kind;
  if (!kind) return input;
  const existing = (input.metadata?.engineering ?? {}) as Partial<EngineeringMemoryMetadata>;
  const now = new Date();
  const codebase = normalizeCodebaseScope({ ...deriveCodebaseScope(input), ...(existing.codebase ?? {}) });
  const engineering: EngineeringMemoryMetadata = {
    kind,
    codebase,
    confidence: existing.confidence ?? providerDecision?.confidence ?? input.confidence ?? input.source?.confidence ?? 0.76,
    correctionOfMemoryId: existing.correctionOfMemoryId ?? stringMetadata(input.metadata, "correctionOfMemoryId"),
    previousWrongAction: existing.previousWrongAction ?? stringMetadata(input.metadata, "previousWrongAction") ?? providerDecision?.previousWrongAction,
    correctAction: existing.correctAction ?? stringMetadata(input.metadata, "correctAction") ?? providerDecision?.correctAction,
    forbiddenAction: existing.forbiddenAction ?? stringMetadata(input.metadata, "forbiddenAction") ?? providerDecision?.forbiddenAction,
    command: existing.command ?? stringMetadata(input.metadata, "command") ?? providerDecision?.command ?? commandFromAction(input.metadata),
    cwd: existing.cwd ?? stringMetadata(input.metadata, "cwd"),
    envRequirements: existing.envRequirements ?? stringArrayMetadata(input.metadata, "envRequirements"),
    environmentHints: existing.environmentHints ?? stringArrayMetadata(input.metadata, "environmentHints"),
    exitCode: existing.exitCode ?? numberMetadata(input.metadata, "exitCode"),
    durationMs: existing.durationMs ?? numberMetadata(input.metadata, "durationMs"),
    outputSummary: existing.outputSummary ?? stringMetadata(input.metadata, "outputSummary"),
    failureReason: existing.failureReason ?? stringMetadata(input.metadata, "failureReason"),
    successReason: existing.successReason ?? stringMetadata(input.metadata, "successReason"),
    successPattern: existing.successPattern ?? stringMetadata(input.metadata, "successPattern") ?? providerDecision?.successPattern,
    filesChanged: existing.filesChanged ?? stringArrayMetadata(input.metadata, "filesChanged"),
    filesTouched: existing.filesTouched ?? stringArrayMetadata(input.metadata, "filesTouched"),
    testOutputSummary: existing.testOutputSummary ?? stringMetadata(input.metadata, "testOutputSummary"),
    evidenceIds: existing.evidenceIds ?? stringArrayMetadata(input.metadata, "evidenceIds"),
    verificationDueAt: existing.verificationDueAt ?? input.temporal?.verificationDueAt
  };
  const verificationDueAt = engineering.verificationDueAt ?? (HIGH_IMPACT_KINDS.has(kind) ? plusDays(now, 30).toISOString() : undefined);
  const tags = new Set([...(input.tags ?? []), "engineering-memory", `engineering:${kind}`]);
  if (kind === "review_correction") tags.add("correction");
  if (kind === "tool_outcome") tags.add("tool-outcome");
  if (kind === "forbidden_action" || kind === "generated_file_rule") tags.add("forbidden-action");
  if (codebase.repo) tags.add(`repo:${codebase.repo}`);
  if (codebase.branch) tags.add(`branch:${codebase.branch}`);
  if (codebase.filePattern) tags.add(`file-pattern:${codebase.filePattern}`);
  const relations = [...(input.relations ?? [])];
  if (engineering.correctionOfMemoryId && !relations.some((relation) => relation.type === "supersedes" && relation.targetId === engineering.correctionOfMemoryId)) {
    relations.push({ type: "supersedes", targetId: engineering.correctionOfMemoryId, confidence: 0.86, evidence: "engineering correction supersedes previous wrong action" });
  }
  return {
    ...input,
    type: kind === "tool_outcome" ? input.type ?? "episodic" : kind === "review_correction" ? input.type ?? "feedback" : kind === "procedure" || kind === "test_strategy" ? input.type ?? "procedural" : input.type ?? "project",
    layer: kind === "tool_outcome" ? input.layer ?? "episodic" : kind === "procedure" || kind === "test_strategy" ? input.layer ?? "procedural" : input.layer ?? "long_term",
    tags: [...tags],
    entities: [...new Set([...(input.entities ?? []), ...engineeringEntities(input.content, engineering)])],
    relations,
    temporal: { ...(input.temporal ?? {}), verificationDueAt },
    metadata: { ...(input.metadata ?? {}), engineering: { ...engineering, verificationDueAt } }
  };
}

export function getEngineeringMetadata(memory: Memory): EngineeringMemoryMetadata | undefined {
  const engineering = memory.metadata.engineering as EngineeringMemoryMetadata | undefined;
  return engineering && isEngineeringMemoryKind(engineering.kind) ? engineering : undefined;
}

export function codebaseScopeMatches(memory: Memory, scope?: CodebaseScope): { matches: boolean; warnings: string[] } {
  if (!scope) return { matches: true, warnings: [] };
  const engineering = getEngineeringMetadata(memory);
  if (!engineering) return { matches: true, warnings: [] };
  const memoryScope = normalizeCodebaseScope(engineering.codebase);
  const queryScope = normalizeCodebaseScope(scope);
  const warnings: string[] = [];
  if (queryScope.repo && memoryScope.repo && queryScope.repo !== memoryScope.repo) return { matches: false, warnings: [`repo mismatch: memory=${memoryScope.repo} current=${queryScope.repo}`] };
  if (queryScope.branch && memoryScope.branch && queryScope.branch !== memoryScope.branch) warnings.push(`branch mismatch: memory=${memoryScope.branch} current=${queryScope.branch}`);
  if (queryScope.workspace && memoryScope.workspace && queryScope.workspace !== memoryScope.workspace) return { matches: false, warnings: [`workspace mismatch: memory=${memoryScope.workspace} current=${queryScope.workspace}`] };
  if (queryScope.language && memoryScope.language && queryScope.language !== memoryScope.language) return { matches: false, warnings: [`language mismatch: memory=${memoryScope.language} current=${queryScope.language}`] };
  if (queryScope.framework && memoryScope.framework && queryScope.framework !== memoryScope.framework) warnings.push(`framework mismatch: memory=${memoryScope.framework} current=${queryScope.framework}`);
  if (queryScope.currentPath && memoryScope.directory && !queryScope.currentPath.startsWith(memoryScope.directory)) warnings.push(`directory scope mismatch: ${memoryScope.directory}`);
  if (queryScope.currentPath && memoryScope.filePattern && !filePatternMatches(queryScope.currentPath, memoryScope.filePattern)) warnings.push(`file pattern mismatch: ${memoryScope.filePattern}`);
  return { matches: true, warnings };
}

export function engineeringQueryWeights(queryType: string): Partial<Record<EngineeringMemoryKind, number>> {
  const defaults: Partial<Record<EngineeringMemoryKind, number>> = {
    repo_policy: 1,
    procedure: 0.95,
    review_correction: 0.95,
    tool_outcome: 0.9,
    architecture_decision: 0.9,
    forbidden_action: 0.9
  };
  if (queryType === "command_selection" || queryType === "failed_last_time") return { tool_outcome: 1, test_strategy: 0.95, procedure: 0.9, repo_policy: 0.85 };
  if (queryType === "change_location" || queryType === "architecture_decision") return { architecture_decision: 1, dependency_rule: 0.9, repo_policy: 0.75, review_correction: 0.7 };
  if (queryType === "reviewer_correction") return { review_correction: 1, repo_policy: 0.9, procedure: 0.75 };
  if (queryType === "dangerous_file") return { forbidden_action: 1, generated_file_rule: 1, repo_policy: 0.8 };
  if (queryType === "repo_change") return { migration_note: 1, repo_policy: 0.9, architecture_decision: 0.85, test_strategy: 0.8 };
  return defaults;
}

export function buildCodingContextPackFromResults(input: {
  id: string;
  query: string;
  userId: string;
  results: SearchResult[];
  tokenBudget: number;
  scope?: CodingContextPack["scope"];
  evidencePackId?: string;
}): CodingContextPack {
  const sections = codingSections();
  const excludedStaleRules: CodingContextPack["excludedStaleRules"] = [];
  let spent = 0;
  for (const result of input.results) {
    const engineering = getEngineeringMetadata(result.memory);
    if (!engineering) continue;
    if (result.memory.beliefState === "superseded" || result.memory.beliefState === "retracted" || result.decision === "exclude") {
      excludedStaleRules.push({ memoryId: result.memory.id, reason: `belief=${result.memory.beliefState} decision=${result.decision ?? "include"}`, kind: engineering.kind });
      continue;
    }
    if ((result.stale || result.memory.beliefState === "stale" || result.memory.beliefState === "needs_verification") && HIGH_IMPACT_KINDS.has(engineering.kind)) {
      excludedStaleRules.push({ memoryId: result.memory.id, reason: `high-impact ${engineering.kind} requires revalidation before injection`, kind: engineering.kind });
      continue;
    }
    const delivery = result.unsafeToInject ? "review_required" as const : "injectable" as const;
    const reviewReason = result.unsafeToInject
      ? result.risk?.verificationRequests?.join("; ") || result.verification?.reason || "unsafe to inject without review"
      : undefined;
    const section = sectionForKind(engineering.kind);
    const line = `[${result.memory.id}] ${engineering.kind}: ${result.memory.content}`;
    const cost = estimateTokens(line);
    if (spent + cost > input.tokenBudget) break;
    spent += cost;
    sections.get(section)!.evidence.push({
      memoryId: result.memory.id,
      kind: engineering.kind,
      content: result.memory.content,
      score: result.score,
      trust: result.memory.trust,
      source: result.memory.source,
      stale: result.stale || result.memory.beliefState === "stale" || result.memory.beliefState === "needs_verification",
      unsafeToInject: result.unsafeToInject,
      delivery,
      reviewReason,
      verification: result.verification,
      graphPaths: result.graphPaths
    });
  }
  const activeSections = [...sections.values()].filter((section) => section.evidence.length);
  const context = activeSections
    .map((section) => {
      const injectable = section.evidence.filter((item) => item.delivery !== "review_required" && !item.unsafeToInject);
      if (!injectable.length) return "";
      return [`## ${section.title}`, ...injectable.map((item) => `- [${item.memoryId}] ${item.kind}: ${item.content}`)].join("\n");
    })
    .filter(Boolean)
    .join("\n\n");
  return {
    schemaVersion: "1.0",
    id: input.id,
    generatedAt: new Date().toISOString(),
    query: input.query,
    userId: input.userId,
    scope: input.scope,
    tokenBudget: input.tokenBudget,
    context,
    sections: activeSections,
    excludedStaleRules,
    evidencePackId: input.evidencePackId
  };
}

export function evaluateForbiddenAction(input: { userId: string; action: string; results: SearchResult[] }): ActionGuardReport {
  const action = normalizeComparableAction(input.action);
  const blockedBy: ActionGuardReport["blockedBy"] = [];
  const warnings: string[] = [];
  const alternatives = new Set<string>();
  for (const result of input.results) {
    const engineering = getEngineeringMetadata(result.memory);
    if (!engineering) continue;
    const forbidden = engineering.forbiddenAction ? normalizeComparableAction(engineering.forbiddenAction) : undefined;
    const relevant = forbidden ? actionPhraseMatches(action, forbidden) : explicitEngineeringActionMatches(action, engineering);
    if (!relevant) continue;
    if (engineering.kind === "forbidden_action" || engineering.kind === "generated_file_rule") {
      blockedBy.push({ memoryId: result.memory.id, kind: engineering.kind, reason: engineering.forbiddenAction ?? result.memory.content });
    } else if (engineering.kind === "repo_policy" || engineering.kind === "test_strategy" || engineering.kind === "procedure") {
      warnings.push(result.memory.content);
    }
    if (engineering.correctAction) alternatives.add(engineering.correctAction);
    if (engineering.successPattern) alternatives.add(engineering.successPattern);
  }
  return {
    schemaVersion: "1.0",
    generatedAt: new Date().toISOString(),
    userId: input.userId,
    action: input.action,
    allowed: blockedBy.length === 0,
    severity: blockedBy.length ? "block" : warnings.length ? "warn" : "allow",
    warnings,
    blockedBy,
    alternatives: [...alternatives],
    evidenceIds: [...new Set([...blockedBy.map((item) => item.memoryId), ...input.results.filter((result) => warnings.includes(result.memory.content)).map((result) => result.memory.id)])]
  };
}

export function buildPatchEvidenceTrail(input: {
  id: string;
  userId: string;
  task: string;
  results: SearchResult[];
  contextPackId?: string;
  filesChanged?: string[];
  commandsRun?: string[];
  excludedStaleRules?: Array<{ memoryId: string; reason: string }>;
}): PatchEvidenceTrail {
  const engineeringResults = input.results.filter((result) => getEngineeringMetadata(result.memory));
  const idsFor = (kind: EngineeringMemoryKind) => engineeringResults.filter((result) => getEngineeringMetadata(result.memory)?.kind === kind).map((result) => result.memory.id);
  const itemsFor = (kind: EngineeringMemoryKind) => engineeringResults.filter((result) => getEngineeringMetadata(result.memory)?.kind === kind);
  const correctionResults = engineeringResults.filter((result) => result.memory.tags.includes("engineering-correction") || Boolean(getEngineeringMetadata(result.memory)?.correctionOfMemoryId) || getEngineeringMetadata(result.memory)?.kind === "review_correction");
  const procedureResults = engineeringResults.filter((result) => ["procedure", "repo_policy", "test_strategy"].includes(getEngineeringMetadata(result.memory)?.kind ?? ""));
  const forbiddenResults = engineeringResults.filter((result) => ["forbidden_action", "generated_file_rule"].includes(getEngineeringMetadata(result.memory)?.kind ?? ""));
  const toolResults = itemsFor("tool_outcome");
  const staleMemoriesExcluded = input.excludedStaleRules ?? [];
  return {
    schemaVersion: "1.0",
    id: input.id,
    generatedAt: new Date().toISOString(),
    userId: input.userId,
    task: input.task,
    contextPackId: input.contextPackId,
    memoryIds: [...new Set(engineeringResults.map((result) => result.memory.id))],
    correctionIds: [...new Set([...idsFor("review_correction"), ...engineeringResults.filter((result) => result.memory.tags.includes("engineering-correction") || Boolean(getEngineeringMetadata(result.memory)?.correctionOfMemoryId)).map((result) => result.memory.id)])],
    procedureIds: [...new Set([...idsFor("procedure"), ...idsFor("repo_policy"), ...idsFor("test_strategy")])],
    toolOutcomeIds: idsFor("tool_outcome"),
    graphPaths: [...new Set(engineeringResults.flatMap((result) => result.graphPaths ?? []))],
    excludedStaleRules: staleMemoriesExcluded,
    memoriesUsed: engineeringResults.map((result) => ({
      memoryId: result.memory.id,
      kind: getEngineeringMetadata(result.memory)?.kind,
      content: result.memory.content,
      trust: result.memory.trust,
      citation: result.citation,
      graphPaths: result.graphPaths ?? []
    })),
    correctionsApplied: correctionResults.map((result) => ({
      memoryId: result.memory.id,
      content: result.memory.content,
      correctAction: getEngineeringMetadata(result.memory)?.correctAction
    })),
    proceduresRecalled: procedureResults.map((result) => ({
      memoryId: result.memory.id,
      content: result.memory.content,
      command: getEngineeringMetadata(result.memory)?.command ?? getEngineeringMetadata(result.memory)?.successPattern
    })),
    forbiddenActionsAvoided: forbiddenResults.map((result) => ({
      memoryId: result.memory.id,
      content: result.memory.content,
      forbiddenAction: getEngineeringMetadata(result.memory)?.forbiddenAction,
      alternative: getEngineeringMetadata(result.memory)?.correctAction ?? getEngineeringMetadata(result.memory)?.successPattern
    })),
    toolOutcomes: toolResults.map((result) => {
      const engineering = getEngineeringMetadata(result.memory);
      return {
        memoryId: result.memory.id,
        command: engineering?.command,
        cwd: engineering?.cwd,
        exitCode: engineering?.exitCode,
        durationMs: engineering?.durationMs,
        outputSummary: engineering?.outputSummary ?? engineering?.testOutputSummary,
        failureReason: engineering?.failureReason,
        successReason: engineering?.successReason ?? engineering?.successPattern,
        filesTouched: engineering?.filesTouched ?? engineering?.filesChanged ?? []
      };
    }),
    staleMemoriesExcluded,
    summary: {
      filesChanged: input.filesChanged ?? [],
      commandsRun: input.commandsRun ?? [],
      evidenceCount: engineeringResults.length
    }
  };
}

function codingSections(): Map<CodingContextPack["sections"][number]["id"], CodingContextPack["sections"][number]> {
  return new Map([
    ["repo_policies", { id: "repo_policies", title: "Relevant repo policies", evidence: [] }],
    ["procedures_before_action", { id: "procedures_before_action", title: "Procedures before action", evidence: [] }],
    ["previous_corrections", { id: "previous_corrections", title: "Previous corrections", evidence: [] }],
    ["known_pitfalls", { id: "known_pitfalls", title: "Known pitfalls", evidence: [] }],
    ["architecture_decisions", { id: "architecture_decisions", title: "Architecture decisions", evidence: [] }],
    ["tool_commands", { id: "tool_commands", title: "Tool commands", evidence: [] }],
    ["forbidden_actions", { id: "forbidden_actions", title: "Forbidden actions", evidence: [] }],
    ["graph_temporal_notes", { id: "graph_temporal_notes", title: "Graph and temporal notes", evidence: [] }]
  ]);
}

function sectionForKind(kind: EngineeringMemoryKind): CodingContextPack["sections"][number]["id"] {
  if (kind === "repo_policy") return "repo_policies";
  if (kind === "procedure" || kind === "test_strategy") return "procedures_before_action";
  if (kind === "review_correction") return "previous_corrections";
  if (kind === "architecture_decision" || kind === "dependency_rule") return "architecture_decisions";
  if (kind === "tool_outcome") return "tool_commands";
  if (kind === "forbidden_action" || kind === "generated_file_rule") return "forbidden_actions";
  if (kind === "migration_note") return "graph_temporal_notes";
  return "known_pitfalls";
}

function deriveCodebaseScope(input: MemoryInput): CodebaseScope {
  const metadata = input.metadata ?? {};
  const action = metadata.action as { filesChanged?: unknown; command?: unknown; cwd?: unknown } | undefined;
  const firstFile = (Array.isArray(action?.filesChanged) ? action?.filesChanged.find((item) => typeof item === "string") : undefined) as string | undefined;
  const sourceUri = input.source?.uri;
  const currentPath = firstFile ?? sourceUri;
  return normalizeCodebaseScope({
    orgId: input.orgId,
    repo: stringMetadata(metadata, "repo") ?? input.projectId,
    branch: stringMetadata(metadata, "branch"),
    commit: input.source?.commit ?? stringMetadata(metadata, "commit"),
    packageName: stringMetadata(metadata, "packageName"),
    workspace: stringMetadata(metadata, "workspace"),
    directory: currentPath ? directoryOf(currentPath) : stringMetadata(metadata, "directory"),
    filePattern: stringMetadata(metadata, "filePattern") ?? inferFilePattern(currentPath),
    language: stringMetadata(metadata, "language") ?? inferLanguage(currentPath),
    framework: stringMetadata(metadata, "framework"),
    harness: input.agentId ?? input.appId ?? stringMetadata(metadata, "harness"),
    currentPath,
    commitRange: stringMetadata(metadata, "commitRange")
  });
}

function normalizeCodebaseScope(scope: CodebaseScope = {}): CodebaseScope {
  return Object.fromEntries(
    Object.entries({
      ...scope,
      repo: scope.repo ?? scope.repository,
      orgId: scope.orgId ?? scope.org
    }).filter(([, value]) => value !== undefined && value !== "")
  ) as CodebaseScope;
}

function engineeringEntities(content: string, engineering: EngineeringMemoryMetadata): string[] {
  return [
    engineering.kind,
    engineering.codebase.repo,
    engineering.codebase.branch,
    engineering.codebase.directory,
    engineering.codebase.filePattern,
    engineering.codebase.language,
    engineering.codebase.framework,
    firstCommandToken(engineering.command)
  ].filter((value): value is string => typeof value === "string" && value.length > 1);
}

function stringMetadata(metadata: Record<string, unknown> | undefined, key: string): string | undefined {
  const value = metadata?.[key];
  return typeof value === "string" && value.trim() ? value : undefined;
}

function stringArrayMetadata(metadata: Record<string, unknown> | undefined, key: string): string[] | undefined {
  const value = metadata?.[key];
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0) : undefined;
}

function numberMetadata(metadata: Record<string, unknown> | undefined, key: string): number | undefined {
  const value = metadata?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function commandFromAction(metadata: Record<string, unknown> | undefined): string | undefined {
  const action = metadata?.action as { command?: unknown } | undefined;
  return typeof action?.command === "string" ? action.command : undefined;
}

function inferFilePattern(currentPath?: string): string | undefined {
  if (currentPath) {
    const lastSlash = currentPath.lastIndexOf("/");
    return lastSlash >= 0 ? `**/${currentPath.slice(lastSlash + 1)}` : currentPath;
  }
  return undefined;
}

function inferLanguage(currentPath?: string): string | undefined {
  const value = currentPath?.toLowerCase() ?? "";
  if (value.endsWith(".ts") || value.endsWith(".tsx")) return "typescript";
  if (value.endsWith(".py")) return "python";
  if (value.endsWith(".go")) return "go";
  if (value.endsWith(".jsx") || value.endsWith(".js")) return "javascript";
  return undefined;
}

function firstCommandToken(command?: string): string | undefined {
  const trimmed = command?.trim();
  if (!trimmed) return undefined;
  for (let index = 0; index < trimmed.length; index += 1) {
    if (isWhitespace(trimmed.charCodeAt(index))) return trimmed.slice(0, index);
  }
  return trimmed;
}

function directoryOf(path: string): string | undefined {
  if (!path.includes("/")) return undefined;
  const lastSlash = path.lastIndexOf("/");
  return lastSlash > 0 ? path.slice(0, lastSlash) : undefined;
}

function filePatternMatches(path: string, pattern: string): boolean {
  if (pattern.startsWith("**/")) return path.endsWith(pattern.slice(3));
  if (pattern.includes("*")) return wildcardMatch(path, pattern);
  return path.includes(pattern);
}

function wildcardMatch(value: string, pattern: string): boolean {
  const parts = pattern.split("*");
  if (!parts.length) return value === pattern;
  let cursor = 0;
  if (parts[0] && !value.startsWith(parts[0])) return false;
  cursor = parts[0]?.length ?? 0;
  for (const part of parts.slice(1, -1)) {
    if (!part) continue;
    const index = value.indexOf(part, cursor);
    if (index < 0) return false;
    cursor = index + part.length;
  }
  const tail = parts.at(-1) ?? "";
  return tail ? value.endsWith(tail) : true;
}

function explicitEngineeringActionMatches(action: string, engineering: EngineeringMemoryMetadata): boolean {
  return [
    engineering.command,
    engineering.correctAction,
    engineering.successPattern,
    engineering.previousWrongAction
  ].some((candidate) => candidate ? actionPhraseMatches(action, normalizeComparableAction(candidate)) : false);
}

function actionPhraseMatches(left: string, right: string): boolean {
  if (!left || !right) return false;
  if (left === right) return true;
  const leftTokens = actionTokens(left);
  const rightTokens = actionTokens(right);
  const shorter = Math.min(leftTokens.length, rightTokens.length);
  if (shorter < 2) return false;
  if (left.includes(right) || right.includes(left)) return true;
  const overlap = rightTokens.filter((token) => leftTokens.includes(token)).length;
  return overlap / Math.max(1, rightTokens.length) >= 0.8 && overlap >= 2;
}

function normalizeComparableAction(value: string): string {
  return collapseWhitespace(value.toLowerCase()).trim();
}

function actionTokens(value: string): string[] {
  return normalizeComparableAction(value).split(/\W+/).filter((token) => token.length > 2);
}

function collapseWhitespace(value: string): string {
  let output = "";
  let previousWasWhitespace = false;
  for (const char of value) {
    const whitespace = isWhitespace(char.charCodeAt(0));
    if (whitespace) {
      if (!previousWasWhitespace) output += " ";
      previousWasWhitespace = true;
      continue;
    }
    output += char;
    previousWasWhitespace = false;
  }
  return output;
}

function isWhitespace(code: number): boolean {
  return code === 9 || code === 10 || code === 11 || code === 12 || code === 13 || code === 32;
}

function plusDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

export type { EngineeringMemoryKind };
