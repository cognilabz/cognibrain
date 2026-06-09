import type { KeyProviderReport, KeyRotationReport, Memory, MemoryInput, MemoryPolicyOperation, MemoryPolicyRule, MemoryScope, PolicyDecision, RetentionEnforcementReport, RetentionReviewReport, RetentionRule, SecurityKeyReport, TransportSecurityReport } from "../../core";
import { contentHash, deploymentModeFromEnv, policyRuleMatches, productionPolicyMode, retentionRuleMatches } from "./helpers";

export function setRetentionRule(service: any, input: Omit<RetentionRule, "id" | "createdAt" | "updatedAt"> & { id?: string }): RetentionRule {
    if (input.retentionDays < 0) throw new Error("Retention days must be non-negative.");
    const now = new Date().toISOString();
    const existing = input.id ? service.retentionRules.get(input.id) : undefined;
    const scope = input.scope ? { ...input.scope, entity: input.scope.entity?.toLowerCase(), tag: input.scope.tag?.toLowerCase() } : undefined;
    const rule: RetentionRule = {
      ...input,
      scope,
      id: input.id ?? `ret_${contentHash(`${input.label}:${now}`).slice(2)}`,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now
    };
    service.retentionRules.set(rule.id, rule);
    service.recordAudit("retention.enforce", { metadata: { action: "rule.set", rule } });
    service.persist();
    return rule;
  }

export function listRetentionRules(service: any): RetentionRule[] {
    return [...service.retentionRules.values()].sort((a, b) => a.label.localeCompare(b.label));
  }

export function enforceRetention(service: any, now = new Date(), userId?: string): RetentionEnforcementReport {
    const report: RetentionEnforcementReport = {
      generatedAt: now.toISOString(),
      evaluated: 0,
      archived: [],
      deleted: [],
      episodeArchived: [],
      episodeDeleted: [],
      rulesMatched: {}
    };
    const memories = (service.store.list(userId) as Memory[]).filter((memory: Memory) => !memory.archivedAt);
    for (const memory of memories) {
      report.evaluated += 1;
      const consentExpired = memory.consent.retentionUntil && new Date(memory.consent.retentionUntil).getTime() <= now.getTime();
      const matchedRules = ([...service.retentionRules.values()] as RetentionRule[]).filter((rule: RetentionRule) => retentionRuleMatches(memory, rule, now));
      for (const rule of matchedRules) report.rulesMatched[rule.id] = (report.rulesMatched[rule.id] ?? 0) + 1;
      const deleteRule = matchedRules.find((rule) => rule.action === "delete");
      if (deleteRule) {
        service.store.delete(memory.id);
        service.applyEpisodeRetention(memory.id, "delete", "retention.rule", deleteRule.id, now, report);
        report.deleted.push(memory.id);
        service.recordAudit("retention.enforce", { userId: memory.userId, brainId: memory.brainId, sourceId: memory.sourceId, memoryId: memory.id, metadata: { action: "delete", ruleId: deleteRule.id, before: memory } });
        continue;
      }
      const archiveRule = matchedRules[0];
      if (consentExpired || archiveRule) {
        const archived = service.store.archive(memory.id);
        service.applyEpisodeRetention(memory.id, "archive", consentExpired ? "consent.retentionUntil" : "retention.rule", archiveRule?.id, now, report);
        report.archived.push(memory.id);
        service.recordAudit("retention.enforce", { userId: memory.userId, brainId: memory.brainId, sourceId: memory.sourceId, memoryId: memory.id, metadata: { action: "archive", reason: consentExpired ? "consent.retentionUntil" : "retention.rule", ruleId: archiveRule?.id, after: archived } });
      }
    }
    if (report.archived.length || report.deleted.length) service.persist();
    return report;
  }

export async function enforceRetentionAsync(service: any, now = new Date(), userId?: string): Promise<RetentionEnforcementReport> {
    const report: RetentionEnforcementReport = {
      generatedAt: now.toISOString(),
      evaluated: 0,
      archived: [],
      deleted: [],
      episodeArchived: [],
      episodeDeleted: [],
      rulesMatched: {}
    };
    const memories = (service.store.list(userId) as Memory[]).filter((memory: Memory) => !memory.archivedAt);
    for (const memory of memories) {
      report.evaluated += 1;
      const consentExpired = memory.consent.retentionUntil && new Date(memory.consent.retentionUntil).getTime() <= now.getTime();
      const matchedRules = ([...service.retentionRules.values()] as RetentionRule[]).filter((rule: RetentionRule) => retentionRuleMatches(memory, rule, now));
      for (const rule of matchedRules) report.rulesMatched[rule.id] = (report.rulesMatched[rule.id] ?? 0) + 1;
      const deleteRule = matchedRules.find((rule) => rule.action === "delete");
      if (deleteRule) {
        const deleted = await service.deleteAsync(memory.id);
        if (!deleted) continue;
        service.applyEpisodeRetention(memory.id, "delete", "retention.rule", deleteRule.id, now, report);
        report.deleted.push(memory.id);
        service.recordAudit("retention.enforce", { userId: memory.userId, brainId: memory.brainId, sourceId: memory.sourceId, memoryId: memory.id, metadata: { action: "delete", ruleId: deleteRule.id, before: memory, productionUnitOfWork: Boolean(service.productionAsyncRepository?.executeUnitOfWork) } });
        continue;
      }
      const archiveRule = matchedRules[0];
      if (consentExpired || archiveRule) {
        const archived = await service.archiveAsync(memory.id);
        service.applyEpisodeRetention(memory.id, "archive", consentExpired ? "consent.retentionUntil" : "retention.rule", archiveRule?.id, now, report);
        report.archived.push(memory.id);
        service.recordAudit("retention.enforce", { userId: memory.userId, brainId: memory.brainId, sourceId: memory.sourceId, memoryId: memory.id, metadata: { action: "archive", reason: consentExpired ? "consent.retentionUntil" : "retention.rule", ruleId: archiveRule?.id, after: archived, productionUnitOfWork: Boolean(service.productionAsyncRepository?.executeUnitOfWork) } });
      }
    }
    if (report.archived.length || report.deleted.length) service.persist();
    return report;
  }

export function retentionReview(service: any, now = new Date(), userId?: string): RetentionReviewReport {
    const expiredMemories: RetentionReviewReport["expiredMemories"] = [];
    const episodeRiskMap = new Map<string, RetentionReviewReport["episodeRisks"][number]>();
    for (const memory of (service.store.list(userId) as Memory[]).filter((item: Memory) => !item.archivedAt)) {
      const consentExpired = memory.consent.retentionUntil && new Date(memory.consent.retentionUntil).getTime() <= now.getTime();
      const matchedRules = [...service.retentionRules.values()].filter((rule) => retentionRuleMatches(memory, rule, now));
      if (!consentExpired && !matchedRules.length) continue;
      const deleteRule = matchedRules.find((rule) => rule.action === "delete");
      const archiveRule = matchedRules[0];
      const action = deleteRule ? "delete" : "archive";
      const reason = consentExpired ? "consent.retentionUntil" : "retention.rule";
      expiredMemories.push({ memoryId: memory.id, reason, ruleId: deleteRule?.id ?? archiveRule?.id, action });
      for (const episode of service.episodes.values()) {
        if (!episode.memoryIds.includes(memory.id)) continue;
        const existing = episodeRiskMap.get(episode.id);
        const memoryIds = [...new Set([...(existing?.memoryIds ?? []), memory.id])];
        episodeRiskMap.set(episode.id, { episodeId: episode.id, memoryIds, reason, action: existing?.action === "delete" || action === "delete" ? "delete" : "archive" });
      }
    }
    const episodeRisks = [...episodeRiskMap.values()];
    return {
      generatedAt: now.toISOString(),
      userId,
      rules: service.listRetentionRules(),
      expiredMemories,
      episodeRisks,
      summary: {
        memoriesAtRisk: expiredMemories.length,
        episodesAtRisk: episodeRisks.length,
        deleteActions: expiredMemories.filter((item) => item.action === "delete").length + episodeRisks.filter((item) => item.action === "delete").length,
        archiveActions: expiredMemories.filter((item) => item.action === "archive").length + episodeRisks.filter((item) => item.action === "archive").length
      }
    };
  }

export function securityKeyReport(service: any): SecurityKeyReport {
    const report: SecurityKeyReport = { encrypted: 0, keyIds: {}, keyVersions: {}, rotated: 0, missingKeyMetadata: 0, backupRefs: [] };
    for (const memory of service.store.list()) {
      const privacy = memory.metadata.privacy as { encrypted?: boolean; keyId?: string; keyVersion?: string; rotatedAt?: string; rotationHistory?: unknown[]; backupRef?: string } | undefined;
      if (!privacy?.encrypted) continue;
      report.encrypted += 1;
      if (privacy.keyId) report.keyIds[privacy.keyId] = (report.keyIds[privacy.keyId] ?? 0) + 1;
      if (privacy.keyVersion) report.keyVersions[privacy.keyVersion] = (report.keyVersions[privacy.keyVersion] ?? 0) + 1;
      if (!privacy.keyId || !privacy.keyVersion) report.missingKeyMetadata += 1;
      if (privacy.rotatedAt || privacy.rotationHistory?.length) report.rotated += 1;
      if (privacy.backupRef && !report.backupRefs.includes(privacy.backupRef)) report.backupRefs.push(privacy.backupRef);
    }
    return report;
  }

export function keyProviderReport(service: any): KeyProviderReport {
    const security = service.securityKeyReport();
    const configuredProvider = process.env.MEMORY_KEY_PROVIDER;
    const provider: KeyProviderReport["provider"] = configuredProvider ? "external" : service.redactionPolicy.encryptionKey || process.env.MEMORY_ENCRYPTION_KEY ? "local-env" : "unconfigured";
    const scope = (process.env.MEMORY_KEY_SCOPE === "org" || process.env.MEMORY_KEY_SCOPE === "user" ? process.env.MEMORY_KEY_SCOPE : "local") as KeyProviderReport["scope"];
    const rotationPolicyDays = process.env.MEMORY_KEY_ROTATION_DAYS ? Math.max(1, Number(process.env.MEMORY_KEY_ROTATION_DAYS)) : undefined;
    const activeKeyId = service.redactionPolicy.encryptionKeyId ?? process.env.MEMORY_ENCRYPTION_KEY_ID;
    const activeKeyVersion = service.redactionPolicy.encryptionKeyVersion ?? process.env.MEMORY_ENCRYPTION_KEY_VERSION;
    const notes = [
      provider === "external" ? `Key material is expected from ${configuredProvider}.` : provider === "local-env" ? "Local env key provider is active; move production keys to a secret manager." : "No encryption key material is configured.",
      scope === "org" ? "Keys are scoped for organization-level rotation." : scope === "user" ? "Keys are scoped for per-user rotation." : "Keys are scoped to the local runtime."
    ];
    return {
      provider,
      scope,
      activeKeyId,
      activeKeyVersion,
      encryptedMemories: security.encrypted,
      knownKeyIds: Object.keys(security.keyIds),
      knownKeyVersions: Object.keys(security.keyVersions),
      hasEncryptionMaterial: Boolean(service.defaultKeyring().length),
      rotationPolicyDays,
      backupRefs: security.backupRefs,
      notes
    };
  }

export function setPolicyRule(service: any, input: Omit<MemoryPolicyRule, "id" | "createdAt" | "updatedAt"> & { id?: string }): MemoryPolicyRule {
    if (!input.label?.trim()) throw new Error("Policy rule label is required.");
    if (!input.operations?.length) throw new Error("Policy rule operations are required.");
    const now = new Date().toISOString();
    const existing = input.id ? service.policyRules.get(input.id) : undefined;
    const rule: MemoryPolicyRule = {
      id: input.id ?? `policy_${contentHash(`${input.label}:${now}:${service.policyRules.size}`).slice(2, 12)}`,
      label: input.label.trim(),
      effect: input.effect,
      operations: [...new Set(input.operations)],
      scope: input.scope,
      priority: input.priority ?? existing?.priority ?? 0,
      reason: input.reason,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now
    };
    service.policyRules.set(rule.id, rule);
    service.recordAudit("policy.violation", { actorId: "policy-engine", metadata: { operation: "rule.set", rule } });
    service.persist();
    return rule;
  }

export function listPolicyRules(service: any): MemoryPolicyRule[] {
    return [...service.policyRules.values()].sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0) || a.label.localeCompare(b.label));
  }

export function evaluatePolicy(service: any, operation: MemoryPolicyOperation, target: Memory | MemoryInput, actor: Partial<MemoryScope> = {}): PolicyDecision {
    const matching = (service.listPolicyRules() as MemoryPolicyRule[])
      .filter((rule: MemoryPolicyRule) => rule.operations.includes("all") || rule.operations.includes(operation))
      .filter((rule: MemoryPolicyRule) => policyRuleMatches(rule, target, actor));
    const decisive = matching[0];
    const allowed = decisive ? decisive.effect === "allow" : !productionPolicyMode();
    return {
      operation,
      allowed,
      memoryId: "id" in target ? target.id : undefined,
      matchedRules: matching.map((rule: MemoryPolicyRule) => ({ id: rule.id, label: rule.label, effect: rule.effect, reason: rule.reason })),
      reasons: matching.length ? matching.map((rule: MemoryPolicyRule) => rule.reason ?? `${rule.effect} by ${rule.label}`) : [productionPolicyMode() ? "no matching policy rule in production mode" : "no matching policy rule"]
    };
  }

export function canRead(service: any, memory: Memory, actor: Partial<MemoryScope> = {}): boolean {
    return service.evaluatePolicy("retrieve", memory, actor).allowed;
  }

export function canWrite(service: any, input: MemoryInput, actor: Partial<MemoryScope> = {}): boolean {
    return service.evaluatePolicy("write", input, actor).allowed;
  }

export function canDelete(service: any, memory: Memory, actor: Partial<MemoryScope> = {}): boolean {
    return service.evaluatePolicy("delete", memory, actor).allowed;
  }

export function canPromote(service: any, memory: Memory, actor: Partial<MemoryScope> = {}): boolean {
    return service.evaluatePolicy("write", memory, actor).allowed && service.evaluatePolicy("retrieve", memory, actor).allowed;
  }

export function canUseInContext(service: any, memory: Memory, actor: Partial<MemoryScope> = {}): boolean {
    return service.evaluatePolicy("retrieve", memory, actor).allowed && memory.beliefState !== "retracted";
  }

export function transportSecurityReport(service: any, options: { publicUrl?: string; mode?: TransportSecurityReport["mode"]; tlsTerminatedBy?: string } = {}): TransportSecurityReport {
    const publicUrl = options.publicUrl ?? process.env.MEMORY_PUBLIC_URL;
    const mode = options.mode ?? deploymentModeFromEnv(publicUrl);
    const tlsTerminatedBy = options.tlsTerminatedBy ?? process.env.MEMORY_TLS_TERMINATED_BY;
    const inTransitEncrypted = Boolean(publicUrl?.startsWith("https://") || tlsTerminatedBy);
    return {
      generatedAt: new Date().toISOString(),
      mode,
      publicUrl,
      tlsTerminatedBy,
      inTransitEncrypted,
      ...(!inTransitEncrypted && mode !== "local" ? { warning: "Non-local deployments must terminate TLS before exposing the API or dashboard." } : {})
    };
  }
