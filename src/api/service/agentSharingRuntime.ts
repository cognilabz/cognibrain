import type { AgentRegistration, AuditEvent, Memory, PersonaProfile, WebhookDelivery, WebhookRegistration } from "../../core";
import { contentHash } from "./helpers";

export function registerAgent(service: any, input: Omit<AgentRegistration, "createdAt" | "updatedAt">): AgentRegistration {
  const now = new Date().toISOString();
  const agent = { ...input, createdAt: now, updatedAt: now };
  service.agents.set(agent.id, agent);
  service.recordAudit("agent.register", { actorId: agent.id, metadata: { resource: "agent", namespace: agent.namespace, brainIds: agent.brainIds, permissions: agent.permissions } });
  service.persist();
  return agent;
}

export function listAgents(service: any): AgentRegistration[] {
  return [...service.agents.values()].sort((a, b) => a.namespace.localeCompare(b.namespace));
}

export function assignAgentPersona(service: any, agentId: string, personaId: string): AgentRegistration {
  const agent = service.agents.get(agentId);
  if (!agent) throw new Error(`Agent not found: ${agentId}`);
  if (!service.personas.has(personaId)) throw new Error(`Persona not found: ${personaId}`);
  const updated = { ...agent, personaId, updatedAt: new Date().toISOString() };
  service.agents.set(agentId, updated);
  service.recordAudit("agent.register", { actorId: agentId, metadata: { resource: "agent-persona", personaId } });
  service.persist();
  return updated;
}

export function setPersona(service: any, input: Omit<PersonaProfile, "createdAt" | "updatedAt">): PersonaProfile {
  const now = new Date().toISOString();
  const persona = { ...input, createdAt: now, updatedAt: now };
  service.personas.set(persona.id, persona);
  service.recordAudit("persona.set", { metadata: { personaId: persona.id, domain: persona.domain, privacyDefault: persona.privacyDefault } });
  service.persist();
  return persona;
}

export function listPersonas(service: any): PersonaProfile[] {
  return [...service.personas.values()].sort((a, b) => a.label.localeCompare(b.label));
}

export function promoteSharedMemory(service: any, memoryId: string, orgId: string): Memory {
  const memory = service.store.get(memoryId);
  return service.reviewSharedMemory(memoryId, { orgId, reviewerId: memory.userId, decision: "approve" });
}

export function reviewSharedMemory(service: any, memoryId: string, input: { orgId: string; reviewerId: string; decision: "approve" | "reject"; note?: string }): Memory {
  const memory = service.store.get(memoryId);
  if (!service.canReviewSharedMemory(memory, input.reviewerId, input.orgId)) throw new Error(`Reviewer ${input.reviewerId} cannot review memory ${memoryId}`);
  const approved = input.decision === "approve";
  const updated = service.store.update(memoryId, {
    orgId: approved ? input.orgId : memory.orgId,
    consent: approved ? { ...memory.consent, visibility: "org" } : memory.consent,
    metadata: {
      shared: {
        ...(memory.metadata.shared as Record<string, unknown> | undefined),
        status: approved ? "approved" : "rejected",
        orgId: input.orgId,
        reviewedAt: new Date().toISOString(),
        reviewedBy: input.reviewerId,
        note: input.note
      }
    }
  });
  service.recordAudit(approved ? "memory.share" : "memory.share.revoke", { actorId: input.reviewerId, userId: updated.userId, brainId: updated.brainId, sourceId: updated.sourceId, memoryId: updated.id, metadata: { orgId: input.orgId, decision: input.decision, note: input.note } });
  service.persist();
  return updated;
}

export function requestSharedMemory(service: any, memoryId: string, orgId: string, requestedBy?: string, note?: string): Memory {
  const updated = service.store.update(memoryId, {
    metadata: {
      shared: {
        status: "pending",
        orgId,
        requestedBy,
        requestedAt: new Date().toISOString(),
        note
      }
    }
  });
  service.recordAudit("memory.share.request", { actorId: requestedBy, userId: updated.userId, brainId: updated.brainId, sourceId: updated.sourceId, memoryId: updated.id, metadata: { orgId, note } });
  service.persist();
  return updated;
}

export function revokeSharedMemory(service: any, memoryId: string, actorId?: string, reason?: string): Memory {
  const memory = service.store.get(memoryId);
  const updated = service.store.update(memoryId, {
    consent: { ...memory.consent, visibility: "user" },
    metadata: {
      shared: {
        ...(memory.metadata.shared as Record<string, unknown> | undefined),
        status: "revoked",
        revokedAt: new Date().toISOString(),
        revokedBy: actorId,
        reason
      }
    }
  });
  service.recordAudit("memory.share.revoke", { actorId, userId: updated.userId, brainId: updated.brainId, sourceId: updated.sourceId, memoryId: updated.id, metadata: { reason } });
  service.persist();
  return updated;
}

export function registerWebhook(service: any, input: Omit<WebhookRegistration, "id" | "createdAt"> & { id?: string }): WebhookRegistration {
  const webhook: WebhookRegistration = {
    ...input,
    id: input.id ?? `wh_${contentHash(`${input.url}:${input.events.join(",")}`).slice(2)}`,
    createdAt: new Date().toISOString()
  };
  service.webhooks.set(webhook.id, webhook);
  service.recordAudit("webhook.register", { metadata: { webhookId: webhook.id, events: webhook.events } });
  service.persist();
  return webhook;
}

export function eventFeed(service: any, filter: { agentId?: string; brainId?: string; sourceId?: string; type?: AuditEvent["type"] } = {}): { auditEvents: AuditEvent[]; deliveries: WebhookDelivery[] } {
  const agent = filter.agentId ? service.agents.get(filter.agentId) : undefined;
  const subscriptionEvents = new Set(agent?.subscriptions?.events ?? []);
  const subscriptionBrainIds = new Set(agent?.subscriptions?.brainIds ?? agent?.brainIds ?? []);
  const subscriptionSourceIds = new Set(agent?.subscriptions?.sourceIds ?? []);
  const auditEvents = service.auditEvents
    .filter((event: AuditEvent) => !filter.type || event.type === filter.type)
    .filter((event: AuditEvent) => !filter.brainId || event.brainId === filter.brainId)
    .filter((event: AuditEvent) => !filter.sourceId || event.sourceId === filter.sourceId)
    .filter((event: AuditEvent) => {
      if (!agent) return true;
      if (subscriptionEvents.size && !subscriptionEvents.has(event.type)) return false;
      if (event.brainId && subscriptionBrainIds.size && !subscriptionBrainIds.has(event.brainId) && !agent.permissions.includes("admin")) return false;
      if (event.sourceId && subscriptionSourceIds.size && !subscriptionSourceIds.has(event.sourceId)) return false;
      return true;
    });
  const visibleEventIds = new Set(auditEvents.map((event: AuditEvent) => event.id));
  return { auditEvents, deliveries: service.webhookDeliveries.filter((delivery: WebhookDelivery) => visibleEventIds.has(delivery.eventId)) };
}
