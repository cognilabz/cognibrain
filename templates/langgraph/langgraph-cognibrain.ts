type CognibrainCodingContextPack = {
  context: string;
  sections?: Array<{ id: string; title: string; evidence: Array<{ memoryId: string; reason?: string; trust?: number; delivery?: "injectable" | "review_required"; unsafeToInject?: boolean; content?: string }> }>;
  evidence?: Array<{ memoryId: string; reason: string; trust: number }>;
};

export async function cognibrainCodingContextPack(input: {
  apiUrl?: string;
  userId: string;
  query: string;
  appId?: string;
  projectId?: string;
  orgId?: string;
  tokenBudget?: number;
}): Promise<CognibrainCodingContextPack> {
  const response = await fetch(`${input.apiUrl ?? "http://localhost:8787"}/coding-context-pack`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      userId: input.userId,
      query: input.query,
      appId: input.appId ?? "langgraph",
      projectId: input.projectId,
      orgId: input.orgId,
      tokenBudget: input.tokenBudget ?? 1200
    })
  });
  if (!response.ok) throw new Error(`cognibrain coding context pack failed: ${response.status}`);
  return response.json() as Promise<CognibrainCodingContextPack>;
}

export const cognibrainContextPack = cognibrainCodingContextPack;

export function cognibrainReviewRequiredMemories(pack: CognibrainCodingContextPack) {
  return (pack.sections ?? [])
    .flatMap((section) => section.evidence.map((item) => ({ section: section.id, sectionTitle: section.title, ...item })))
    .filter((item) => item.delivery === "review_required" || item.unsafeToInject);
}

export function cognibrainUsableContext(pack: CognibrainCodingContextPack): string {
  const reviewRequired = cognibrainReviewRequiredMemories(pack);
  if (!pack.context && reviewRequired.length) {
    return [
      "Cognibrain delivered review_required memories. Verify each memory against current code, tests, generated artifacts, CI, or source systems before using it.",
      ...reviewRequired.map((item) => `- [${item.memoryId}] ${item.section}: ${item.content ?? item.reason ?? "review required"}`)
    ].join("\n");
  }
  return pack.context;
}

export async function guardLangGraphAction(input: {
  apiUrl?: string;
  userId: string;
  action: string;
  agentId?: string;
  sessionId?: string;
  projectId?: string;
  orgId?: string;
}) {
  const response = await fetch(`${input.apiUrl ?? "http://localhost:8787"}/code/action-guard`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      userId: input.userId,
      action: input.action,
      appId: "langgraph",
      agentId: input.agentId,
      sessionId: input.sessionId,
      projectId: input.projectId,
      orgId: input.orgId
    })
  });
  if (!response.ok) throw new Error(`cognibrain action guard failed: ${response.status}`);
  return response.json();
}

export async function recordLangGraphToolOutcome(input: {
  apiUrl?: string;
  userId: string;
  command: string;
  content?: string;
  filesChanged?: string[];
  metadata?: Record<string, unknown>;
}) {
  const response = await fetch(`${input.apiUrl ?? "http://localhost:8787"}/connectors/telemetry`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      connectorId: "official-code",
      harnessId: "langgraph",
      userId: input.userId,
      kind: "tool_outcome",
      command: input.command,
      content: input.content,
      filesChanged: input.filesChanged,
      metadata: input.metadata
    })
  });
  if (!response.ok) throw new Error(`cognibrain telemetry failed: ${response.status}`);
  return response.json();
}

export async function recordLangGraphPatchEvidence(input: {
  apiUrl?: string;
  userId: string;
  task: string;
  filesChanged?: string[];
  commandsRun?: string[];
  memoryIds?: string[];
  projectId?: string;
  orgId?: string;
}) {
  const response = await fetch(`${input.apiUrl ?? "http://localhost:8787"}/patch-evidence`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      userId: input.userId,
      task: input.task,
      appId: "langgraph",
      filesChanged: input.filesChanged,
      commandsRun: input.commandsRun,
      memoryIds: input.memoryIds,
      projectId: input.projectId,
      orgId: input.orgId
    })
  });
  if (!response.ok) throw new Error(`cognibrain patch evidence failed: ${response.status}`);
  return response.json();
}
