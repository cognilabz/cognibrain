type CognibrainContextPack = {
  context: string;
  evidence: Array<{ memoryId: string; reason: string; trust: number }>;
};

export async function cognibrainContextPack(input: {
  apiUrl?: string;
  userId: string;
  query: string;
  appId?: string;
  projectId?: string;
  orgId?: string;
  tokenBudget?: number;
}): Promise<CognibrainContextPack> {
  const response = await fetch(`${input.apiUrl ?? "http://localhost:8787"}/evidence-pack`, {
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
  if (!response.ok) throw new Error(`cognibrain evidence pack failed: ${response.status}`);
  return response.json() as Promise<CognibrainContextPack>;
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
