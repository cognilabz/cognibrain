import { readFileSync } from "node:fs";
import type { MemoryService } from "../../api/service";
import { buildLeaderboardArtifact } from "../../eval/leaderboard";
import { runNextgenBenchmarkSuites } from "../../eval/nextgenBenchmarks";
import {
  codebaseScopeFromEnv,
  csvList,
  engineeringKindFromEnv,
  fail,
  graphExplainStrategyFromEnv,
  isFeedbackKind,
  managedPlanFromEnv,
  managedTenantStatusFromEnv,
  metadataFromEnv,
  observationStyleFromEnv,
  optionValue,
  permissionsFromEnv,
  privacyComputeDimensionsFromEnv,
  privacyDefaultFromEnv,
  relationTypesFromEnv,
  retrievalModeFromEnv,
  searchFiltersFromEnv,
  summaryStyleFromEnv
} from "./env";

type CommandContext = { service: MemoryService; userId: string };

export async function handleWorkspaceCommands(command: string | undefined, args: string[], context: CommandContext): Promise<boolean> {
  const { service, userId } = context;
  switch (command) {
  case "agent-register": {
    const [id, namespace = "default", ...brainIds] = args;
    if (!id || brainIds.length === 0) fail("Usage: memctl agent-register <agent-id> [namespace] <brain-id...>");
    console.log(
      JSON.stringify(
        service.registerAgent({
          id,
          name: process.env.MEMORY_AGENT_NAME ?? id,
          namespace,
          brainIds,
          permissions: permissionsFromEnv(),
          personaId: process.env.MEMORY_PERSONA_ID,
          subscriptions: process.env.MEMORY_AGENT_SUBSCRIPTIONS_JSON ? JSON.parse(process.env.MEMORY_AGENT_SUBSCRIPTIONS_JSON) : undefined
        }),
        null,
        2
      )
    );
    return true;
  }
  case "agents": {
    console.log(JSON.stringify(service.listAgents(), null, 2));
    return true;
  }
  case "agent-persona": {
    const [agentId, personaId] = args;
    if (!agentId || !personaId) fail("Usage: memctl agent-persona <agent-id> <persona-id>");
    console.log(JSON.stringify(service.assignAgentPersona(agentId, personaId), null, 2));
    return true;
  }
  case "persona-set": {
    const [id, label = id] = args;
    if (!id) fail("Usage: memctl persona-set <persona-id> [label]");
    console.log(
      JSON.stringify(
        service.setPersona({
          id,
          label,
          summaryStyle: summaryStyleFromEnv(),
          retrievalWeights: process.env.MEMORY_PERSONA_WEIGHTS_JSON ? JSON.parse(process.env.MEMORY_PERSONA_WEIGHTS_JSON) : undefined,
          privacyDefault: privacyDefaultFromEnv(),
          domain: process.env.MEMORY_PERSONA_DOMAIN
        }),
        null,
        2
      )
    );
    return true;
  }
  case "personas": {
    console.log(JSON.stringify(service.listPersonas(), null, 2));
    return true;
  }
  case "brain-create": {
    const [name, visibility = "private"] = args;
    if (!name || !["private", "team", "org", "public"].includes(visibility)) fail("Usage: memctl brain-create <name> [private|team|org|public]");
    console.log(JSON.stringify(service.createBrain({ name, ownerUserId: userId, orgId: process.env.MEMORY_ORG_ID, visibility: visibility as "private" | "team" | "org" | "public" }), null, 2));
    return true;
  }
  case "brains": {
    console.log(JSON.stringify(service.listBrains(), null, 2));
    return true;
  }
  case "source-create": {
    const [brainId, name, kind = "manual"] = args;
    if (!brainId || !name || !["manual", "chat", "code", "docs", "calendar", "connector", "import"].includes(kind)) fail("Usage: memctl source-create <brain-id> <name> [manual|chat|code|docs|calendar|connector|import]");
    console.log(JSON.stringify(service.createSource({ brainId, name, kind: kind as "manual" | "chat" | "code" | "docs" | "calendar" | "connector" | "import" }), null, 2));
    return true;
  }
  case "events": {
    console.log(JSON.stringify(service.eventFeed({ agentId: process.env.MEMORY_AGENT_ID, brainId: process.env.MEMORY_BRAIN_ID, sourceId: process.env.MEMORY_SOURCE_ID }), null, 2));
    return true;
  }
  case "episodes": {
    console.log(JSON.stringify(service.listEpisodes(userId), null, 2));
    return true;
  }
  case "episode": {
    const id = args[0];
    if (!id) fail("Usage: memctl episode <episode-id>");
    console.log(JSON.stringify(service.getEpisode(id), null, 2));
    return true;
  }
  case "federated-search": {
    const query = args.join(" ");
    if (!query) fail("Usage: memctl federated-search <query>");
    const brainIds = process.env.MEMORY_BRAIN_IDS?.split(",").map((item) => item.trim()).filter(Boolean);
    if (!brainIds?.length) fail("Set MEMORY_BRAIN_IDS for federated-search");
    console.log(JSON.stringify(service.federatedSearch({ userId, query, brainIds, orgId: process.env.MEMORY_ORG_ID, agentId: process.env.MEMORY_AGENT_ID, includeSharedBrains: true }), null, 2));
    return true;
  }
  case "share-request": {
    const [memoryId, orgId, ...note] = args;
    if (!memoryId || !orgId) fail("Usage: memctl share-request <memory-id> <org-id> [note]");
    console.log(JSON.stringify(service.requestSharedMemory(memoryId, orgId, process.env.MEMORY_AGENT_ID ?? userId, note.join(" ") || undefined), null, 2));
    return true;
  }
  case "share-approve": {
    const [memoryId, orgId, ...note] = args;
    if (!memoryId || !orgId) fail("Usage: memctl share-approve <memory-id> <org-id>");
    const reviewerId = process.env.MEMORY_REVIEWER_ID ?? process.env.MEMORY_AGENT_ID ?? userId;
    console.log(JSON.stringify(service.reviewSharedMemory(memoryId, { orgId, reviewerId, decision: "approve", note: note.join(" ") || undefined }), null, 2));
    return true;
  }
  case "promote":
  case "review": {
    const [memoryId, orgId = process.env.MEMORY_ORG_ID ?? "org", ...note] = args;
    if (!memoryId || !orgId) fail(`Usage: memctl ${command} <memory-id> <org-id>`);
    const reviewerId = process.env.MEMORY_REVIEWER_ID ?? process.env.MEMORY_AGENT_ID ?? userId;
    console.log(JSON.stringify(service.reviewSharedMemory(memoryId, { orgId, reviewerId, decision: "approve", note: note.join(" ") || undefined }), null, 2));
    return true;
  }
  case "share-revoke": {
    const [memoryId, ...reason] = args;
    if (!memoryId) fail("Usage: memctl share-revoke <memory-id> [reason]");
    console.log(JSON.stringify(service.revokeSharedMemory(memoryId, process.env.MEMORY_AGENT_ID ?? userId, reason.join(" ") || undefined), null, 2));
    return true;
  }
  case "revoke": {
    const [memoryId, ...reason] = args;
    if (!memoryId) fail("Usage: memctl revoke <memory-id> [reason]");
    console.log(JSON.stringify(service.revokeSharedMemory(memoryId, process.env.MEMORY_AGENT_ID ?? userId, reason.join(" ") || undefined), null, 2));
    return true;
  }
  case "audit": {
    console.log(JSON.stringify(service.auditTrail({ memoryId: args[0], userId: process.env.MEMORY_AUDIT_USER_ID }), null, 2));
    return true;
  }
  case "audit-chain": {
    console.log(JSON.stringify(service.auditChain({ memoryId: args[0], userId: process.env.MEMORY_AUDIT_USER_ID }), null, 2));
    return true;
  }
  }
  return false;
}
