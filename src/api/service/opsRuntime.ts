import { createHmac } from "node:crypto";
import { buildApiDescription } from "../apiDescription";
import type { ApiDescriptionAuth } from "../apiDescription";
import { decryptMemoryContent, type DecryptionKeyMaterial } from "../../core/privacy";
import type { BackupRecoveryReport, ComplianceReport, ConnectorManifest, CrossBrainPrivacyComputeReport, DifferentialPrivacyReport, EpisodeRecord, KeyRotationReport, ManagedControlPlaneReport, ManagedDeploymentPlan, ManagedMigrationBundle, ManagedTenant, MarketplaceModule, Memory, MemoryPolicyRule, MetricsReport, PersonaProfile, RetentionRule, RetrievalProfile } from "../../core";
import { contentHash, deploymentModeFromEnv, deterministicLaplaceNoise, privacyComputeTokens, roundMetric, uniqueStrings } from "./helpers";

export function apiDescription(service: any, auth?: ApiDescriptionAuth) {
    return buildApiDescription(auth);
  }

export function managedMigrationBundle(service: any, options: { target?: ManagedMigrationBundle["target"]; backupRef?: string; ssoProvider?: string; secretManager?: string } = {}): ManagedMigrationBundle {
    const target = options.target ?? "backup";
    const keyReport = service.securityKeyReport();
    return {
      generatedAt: new Date().toISOString(),
      target,
      counts: {
        memories: service.store.list().length,
        episodes: service.episodes.size,
        profiles: service.retrievalProfiles.size,
        personas: service.personas.size,
        connectors: service.connectorManifests.size,
        policyRules: service.policyRules.size,
        retentionRules: service.retentionRules.size
      },
      backup: {
        recommended: target !== "backup",
        encryptionKeyIds: Object.keys(keyReport.keyIds),
        backupRef: options.backupRef
      },
      placeholders: {
        sso: { required: target === "managed", provider: options.ssoProvider, note: "Provision SCIM/OIDC externally; this local bundle carries only the provider label." },
        secretManager: { required: keyReport.encrypted > 0, provider: options.secretManager, note: "Move MEMORY_ENCRYPTION_KEY into the target secret manager before importing encrypted memories." }
      },
      deployment: service.managedDeploymentPlan({ target, ssoProvider: options.ssoProvider, secretManager: options.secretManager }),
      manifest: {
        memories: service.store.export(),
        episodes: [...service.episodes.values()],
        retrievalProfiles: [...service.retrievalProfiles.values()],
        personas: [...service.personas.values()],
        connectors: [...service.connectorManifests.values()],
        marketplaceModules: [...service.marketplaceModules.values()],
        policyRules: [...service.policyRules.values()],
        retentionRules: [...service.retentionRules.values()],
        compliance: service.complianceReport()
      }
    };
  }

export function importMigrationBundle(service: any, bundle: ManagedMigrationBundle): { importedMemories: number; importedEpisodes: number; importedProfiles: number; importedPersonas: number; importedConnectors: number; importedPolicyRules: number; importedRetentionRules: number } {
    const manifest = bundle.manifest as {
      memories?: Memory[];
      episodes?: EpisodeRecord[];
      retrievalProfiles?: RetrievalProfile[];
      personas?: PersonaProfile[];
      connectors?: ConnectorManifest[];
      marketplaceModules?: MarketplaceModule[];
      policyRules?: MemoryPolicyRule[];
      retentionRules?: RetentionRule[];
    };
    const imported = manifest.memories?.length ? service.store.import(manifest.memories) : [];
    for (const episode of manifest.episodes ?? []) service.episodes.set(episode.id, episode);
    for (const profile of manifest.retrievalProfiles ?? []) service.setRetrievalProfile({ ...profile, updatedAt: new Date(profile.updatedAt).toISOString() });
    for (const persona of manifest.personas ?? []) service.personas.set(persona.id, persona);
    for (const connector of manifest.connectors ?? []) service.connectorManifests.set(connector.id, connector);
    for (const module of manifest.marketplaceModules ?? []) service.marketplaceModules.set(module.id, module);
    for (const rule of manifest.policyRules ?? []) service.policyRules.set(rule.id, rule);
    for (const rule of manifest.retentionRules ?? []) service.retentionRules.set(rule.id, rule);
    service.recordAudit("sync.run", { metadata: { action: "migration.import", importedMemories: imported.length, target: bundle.target } });
    service.persist();
    return {
      importedMemories: imported.length,
      importedEpisodes: manifest.episodes?.length ?? 0,
      importedProfiles: manifest.retrievalProfiles?.length ?? 0,
      importedPersonas: manifest.personas?.length ?? 0,
      importedConnectors: manifest.connectors?.length ?? 0,
      importedPolicyRules: manifest.policyRules?.length ?? 0,
      importedRetentionRules: manifest.retentionRules?.length ?? 0
    };
  }

export function verifyBackupRecovery(service: any, bundle?: ManagedMigrationBundle, options: { keyring?: DecryptionKeyMaterial[] } = {}): BackupRecoveryReport {
    const manifest = bundle?.manifest as { memories?: Memory[] } | undefined;
    const memories = manifest?.memories ?? service.store.export();
    const keyring = options.keyring ?? service.defaultKeyring();
    const recovered: string[] = [];
    const failed: Array<{ memoryId: string; reason: string }> = [];
    for (const memory of memories) {
      const privacy = memory.metadata.privacy as { encrypted?: boolean } | undefined;
      if (!privacy?.encrypted) continue;
      const decrypted = decryptMemoryContent(memory, keyring);
      if (decrypted.ok) recovered.push(memory.id);
      else failed.push({ memoryId: memory.id, reason: decrypted.error ?? "decryption failed" });
    }
    return {
      generatedAt: new Date().toISOString(),
      backupRef: bundle?.backup.backupRef ?? service.securityKeyReport().backupRefs[0],
      encryptedMemories: recovered.length + failed.length,
      recovered,
      failed,
      verified: failed.length === 0
    };
  }

export function managedDeploymentPlan(service: any, options: { target?: ManagedMigrationBundle["target"]; ssoProvider?: string; secretManager?: string } = {}): ManagedDeploymentPlan {
    const mode = options.target ?? "backup";
    return {
      mode,
      artifacts: {
        dockerfile: "docker/Dockerfile",
        dockerCompose: "docker/docker-compose.yml",
        kubernetes: "deploy/kubernetes/cognibrain.yaml"
      },
      environment: [
        "MEMORY_STORAGE_BACKEND",
        "MEMORY_ENCRYPTION_KEY_ID",
        "MEMORY_ENCRYPTION_KEY_VERSION",
        "MEMORY_KEY_PROVIDER",
        "MEMORY_PUBLIC_URL",
        "MEMORY_TLS_TERMINATED_BY",
        "MEMORY_SSO_PROVIDER",
        "MEMORY_SECRET_MANAGER"
      ],
      secretManager: options.secretManager,
      ssoProvider: options.ssoProvider,
      importWorkflow: [
        "Run /migration/export or `cognibrain memory migration-export managed` on the source runtime.",
        "Copy the bundle to the target deployment through an encrypted channel.",
        "Provision the listed key ids in the configured secret manager before import.",
        "POST the bundle to /migration/import or run `cognibrain memory migration-import <bundle.json>`.",
        "Run /backup/verify and /compliance/export before serving production traffic."
      ],
      transport: service.transportSecurityReport({ mode: mode === "managed" ? "managed" : mode === "self_hosted" ? "self_hosted" : "local" })
    };
  }

export function createManagedTenant(service: any, input: {
    id?: string;
    name: string;
    orgId: string;
    plan?: ManagedTenant["plan"];
    region?: string;
    status?: ManagedTenant["status"];
    ssoProvider?: string;
    secretManager?: string;
    dataResidency?: string;
    autoscaling?: ManagedTenant["autoscaling"];
    backup?: ManagedTenant["backup"];
  }): ManagedTenant {
    if (!input.name.trim()) throw new Error("Managed tenant name is required.");
    if (!input.orgId.trim()) throw new Error("Managed tenant orgId is required.");
    const now = new Date().toISOString();
    const existing = input.id ? service.managedTenants.get(input.id) : undefined;
    const tenant: ManagedTenant = {
      id: input.id ?? `tenant_${contentHash(`${input.orgId}:${input.name}:${now}`).slice(2, 12)}`,
      name: input.name,
      orgId: input.orgId,
      plan: input.plan ?? "team",
      region: input.region ?? process.env.MEMORY_REGION ?? "local-dev",
      status: input.status ?? "active",
      ssoProvider: input.ssoProvider ?? process.env.MEMORY_SSO_PROVIDER,
      secretManager: input.secretManager ?? process.env.MEMORY_SECRET_MANAGER,
      dataResidency: input.dataResidency ?? process.env.MEMORY_DATA_RESIDENCY,
      autoscaling: input.autoscaling ?? {
        minReplicas: Number(process.env.MEMORY_AUTOSCALE_MIN_REPLICAS ?? 1),
        maxReplicas: Number(process.env.MEMORY_AUTOSCALE_MAX_REPLICAS ?? 3),
        targetCpuUtilization: Number(process.env.MEMORY_AUTOSCALE_TARGET_CPU ?? 70)
      },
      backup: input.backup ?? {
        enabled: Boolean(process.env.MEMORY_BACKUP_REF),
        backupRef: process.env.MEMORY_BACKUP_REF
      },
      createdAt: existing?.createdAt ?? now,
      updatedAt: now
    };
    service.managedTenants.set(tenant.id, tenant);
    service.recordAudit("managed.tenant", { userId: tenant.orgId, metadata: { action: existing ? "update" : "create", tenant } });
    service.persist();
    return tenant;
  }

export function listManagedTenants(service: any): ManagedTenant[] {
    return ([...service.managedTenants.values()] as ManagedTenant[]).sort((a, b) => a.name.localeCompare(b.name));
  }

export function managedControlPlaneReport(service: any): ManagedControlPlaneReport {
    const tenants = service.listManagedTenants();
    const storage = service.storageStatus();
    const keyProvider = service.keyProviderReport();
    const transport = service.transportSecurityReport();
    const migration = service.managedMigrationBundle({
      target: "managed",
      backupRef: process.env.MEMORY_BACKUP_REF,
      ssoProvider: process.env.MEMORY_SSO_PROVIDER,
      secretManager: process.env.MEMORY_SECRET_MANAGER
    });
    const autoscalingValues = tenants.map((tenant: ManagedTenant) => tenant.autoscaling).filter(Boolean) as NonNullable<ManagedTenant["autoscaling"]>[];
    const maxReplicas = Math.max(0, ...autoscalingValues.map((policy) => policy.maxReplicas));
    const minReplicas = Math.max(0, ...autoscalingValues.map((policy) => policy.minReplicas));
    const targetCpuUtilization = autoscalingValues.length
      ? Math.round(autoscalingValues.reduce((sum, policy) => sum + policy.targetCpuUtilization, 0) / autoscalingValues.length)
      : Number(process.env.MEMORY_AUTOSCALE_TARGET_CPU ?? 70);
    const readiness = {
      storage: storage.adapters.some((adapter: any) => adapter.kind === storage.active && adapter.durable && (adapter.distributedReady || storage.active !== "memory")),
      backup: tenants.length === 0 ? Boolean(process.env.MEMORY_BACKUP_REF) : tenants.every((tenant: ManagedTenant) => tenant.backup?.enabled),
      sso: tenants.length === 0 ? Boolean(process.env.MEMORY_SSO_PROVIDER) : tenants.every((tenant: ManagedTenant) => tenant.ssoProvider),
      secretManager: keyProvider.provider === "external" || tenants.some((tenant: ManagedTenant) => tenant.secretManager),
      transport: transport.inTransitEncrypted || transport.mode === "local",
      migrationBundle: migration.target === "managed" && Boolean(migration.deployment)
    };
    const notes = [
      readiness.storage ? "Storage has a durable adapter for hosted mode." : "Configure a durable hosted adapter before production traffic.",
      readiness.backup ? "Backup references are present for managed recovery." : "Set MEMORY_BACKUP_REF or tenant backup settings before claiming managed recovery.",
      readiness.sso ? "SSO provider metadata is configured." : "Set MEMORY_SSO_PROVIDER or tenant-level SSO before enterprise rollout.",
      readiness.secretManager ? "External secret-manager metadata is configured." : "Set MEMORY_SECRET_MANAGER or MEMORY_KEY_PROVIDER for production key custody.",
      readiness.transport ? "Transport security is ready for the current deployment mode." : "Expose HTTPS or set MEMORY_TLS_TERMINATED_BY before public managed service use."
    ];
    return {
      generatedAt: new Date().toISOString(),
      deploymentMode: deploymentModeFromEnv(process.env.MEMORY_PUBLIC_URL),
      tenants: {
        total: tenants.length,
        active: tenants.filter((tenant: ManagedTenant) => tenant.status === "active").length,
        provisioning: tenants.filter((tenant: ManagedTenant) => tenant.status === "provisioning").length,
        paused: tenants.filter((tenant: ManagedTenant) => tenant.status === "paused").length,
        regions: [...new Set(tenants.map((tenant: ManagedTenant) => tenant.region))].filter((region): region is string => typeof region === "string").sort(),
        plans: {
          developer: tenants.filter((tenant: ManagedTenant) => tenant.plan === "developer").length,
          team: tenants.filter((tenant: ManagedTenant) => tenant.plan === "team").length,
          enterprise: tenants.filter((tenant: ManagedTenant) => tenant.plan === "enterprise").length
        }
      },
      readiness,
      autoscaling: {
        enabled: autoscalingValues.length > 0 && maxReplicas > minReplicas,
        minReplicas,
        maxReplicas,
        targetCpuUtilization
      },
      storage,
      transport,
      keyProvider,
      migration: {
        generatedAt: migration.generatedAt,
        target: migration.target,
        counts: migration.counts,
        backup: migration.backup,
        placeholders: migration.placeholders
      },
      notes
    };
  }

export function rotateEncryptionKeyMetadata(service: any, input: { keyId: string; keyVersion: string; backupRef?: string; actorId?: string }): KeyRotationReport {
    const now = new Date().toISOString();
    const rotated: string[] = [];
    const skipped: string[] = [];
    for (const memory of service.store.list() as Memory[]) {
      const privacy = memory.metadata.privacy as Record<string, unknown> | undefined;
      if (!privacy?.encrypted) {
        skipped.push(memory.id);
        continue;
      }
      const history = Array.isArray(privacy.rotationHistory) ? privacy.rotationHistory : [];
      service.store.update(memory.id, {
        metadata: {
          ...memory.metadata,
          privacy: {
            ...privacy,
            previousKeyId: privacy.keyId,
            previousKeyVersion: privacy.keyVersion,
            keyId: input.keyId,
            keyVersion: input.keyVersion,
            rotatedAt: now,
            backupRef: input.backupRef,
            rotationHistory: [...history, { rotatedAt: now, keyId: input.keyId, keyVersion: input.keyVersion, backupRef: input.backupRef }]
          }
        }
      });
      rotated.push(memory.id);
    }
    service.recordAudit("security.key.rotate", { actorId: input.actorId, metadata: { rotated: rotated.length, skipped: skipped.length, keyId: input.keyId, keyVersion: input.keyVersion, backupRef: input.backupRef } });
    service.persist();
    return { generatedAt: now, rotated, skipped, keyId: input.keyId, keyVersion: input.keyVersion, backupRef: input.backupRef };
  }

export function privacyInsights(service: any, options: { epsilon?: number; kAnonymity?: number; includeExact?: boolean } = {}): DifferentialPrivacyReport {
    const epsilon = Math.max(0.1, options.epsilon ?? 1);
    const kAnonymity = Math.max(2, Math.round(options.kAnonymity ?? 3));
    const groups = new Map<string, number>();
    const add = (dimension: string, key: string | undefined) => {
      const safeKey = key || "none";
      groups.set(`${dimension}:${safeKey}`, (groups.get(`${dimension}:${safeKey}`) ?? 0) + 1);
    };
    for (const memory of service.store.list() as Memory[]) {
      add("consent", memory.consent.visibility);
      add("sourceKind", memory.source.kind);
      add("brain", memory.brainId);
      add("source", memory.sourceId);
    }
    for (const event of service.searchEvents) {
      add("searchSession", event.sessionId);
      add("searchProject", event.projectId);
    }
    let suppressedGroups = 0;
    const aggregates = [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([compound, exactCount]) => {
      const [dimension, ...keyParts] = compound.split(":");
      const key = keyParts.join(":");
      const suppressed = exactCount < kAnonymity;
      if (suppressed) suppressedGroups += 1;
      const noisyCount = suppressed ? 0 : Math.max(0, Math.round(exactCount + deterministicLaplaceNoise(`${compound}:${exactCount}`, epsilon)));
      return {
        dimension,
        key,
        noisyCount,
        ...(options.includeExact ? { exactCount } : {}),
        suppressed
      };
    });
    const report: DifferentialPrivacyReport = {
      generatedAt: new Date().toISOString(),
      epsilon,
      kAnonymity,
      suppressedGroups,
      aggregates,
      notes: ["Groups below k-anonymity are suppressed.", "Counts use deterministic Laplace-style noise for local reproducibility."]
    };
    service.recordAudit("privacy.insights", { metadata: { epsilon, kAnonymity, suppressedGroups, aggregates: aggregates.length } });
    service.persist();
    return report;
  }

export function privacyPreservingCrossBrainCompute(service: any, options: {
    brainIds: string[];
    salt?: string;
    minK?: number;
    dimensions?: Array<"entities" | "tags" | "relations">;
  }): CrossBrainPrivacyComputeReport {
    const brainIds = [...new Set(options.brainIds.filter(Boolean))].sort();
    if (brainIds.length < 2) throw new Error("At least two brainIds are required for cross-brain compute.");
    const dimensions = options.dimensions?.length ? [...new Set(options.dimensions)] : ["entities", "tags", "relations"] as Array<"entities" | "tags" | "relations">;
    const minK = Math.max(2, Math.round(options.minK ?? 2));
    const salt = options.salt ?? process.env.MEMORY_PRIVACY_COMPUTE_SALT ?? "local-cross-brain-compute";
    const saltHash = contentHash(salt);
    const byHash = new Map<string, { dimensions: Set<"entities" | "tags" | "relations">; brainIds: Set<string>; memoryIds: Set<string> }>();
    const brainStats = new Map<string, { memoriesScanned: number; hashes: Set<string> }>();

    for (const brainId of brainIds) {
      const memories = (service.store.list() as Memory[]).filter((memory) => memory.brainId === brainId && !memory.archivedAt);
      const hashes = new Set<string>();
      for (const memory of memories) {
        for (const token of privacyComputeTokens(memory, dimensions)) {
          const hash = createHmac("sha256", salt).update(`${token.dimension}:${token.value}`).digest("hex");
          hashes.add(hash);
          const aggregate = byHash.get(hash) ?? { dimensions: new Set(), brainIds: new Set(), memoryIds: new Set() };
          aggregate.dimensions.add(token.dimension);
          aggregate.brainIds.add(brainId);
          aggregate.memoryIds.add(memory.id);
          byHash.set(hash, aggregate);
        }
      }
      brainStats.set(brainId, { memoriesScanned: memories.length, hashes });
    }

    const intersections = [...byHash.entries()]
      .filter(([, aggregate]) => aggregate.brainIds.size >= minK)
      .sort((a, b) => b[1].brainIds.size - a[1].brainIds.size || a[0].localeCompare(b[0]))
      .map(([hash, aggregate]) => ({
        hash,
        dimensions: [...aggregate.dimensions].sort(),
        participantBrainIds: [...aggregate.brainIds].sort(),
        brainCount: aggregate.brainIds.size,
        memoryCount: aggregate.memoryIds.size
      }));
    const releasedHashes = new Set(intersections.map((item) => item.hash));
    const brains = [...brainStats.entries()].map(([brainId, stats]) => {
      const released = [...stats.hashes].filter((hash) => releasedHashes.has(hash)).length;
      return {
        brainId,
        memoriesScanned: stats.memoriesScanned,
        contributedHashes: stats.hashes.size,
        releasedHashes: released,
        suppressedHashes: stats.hashes.size - released
      };
    });
    const candidateHashes = byHash.size;
    const report: CrossBrainPrivacyComputeReport = {
      generatedAt: new Date().toISOString(),
      brainIds,
      dimensions,
      minK,
      hashAlgorithm: "hmac-sha256",
      saltHash,
      noRawMemoryData: true,
      totals: {
        memoriesScanned: brains.reduce((sum, brain) => sum + brain.memoriesScanned, 0),
        candidateHashes,
        releasedHashes: releasedHashes.size,
        suppressedHashes: candidateHashes - releasedHashes.size
      },
      brains,
      intersections,
      notes: [
        "Only HMAC hashes, counts, and participant brain ids are returned.",
        "Raw memory content, entity labels, tags, and relation labels are never included in this report.",
        "Hashes below minK participant brains are suppressed."
      ]
    };
    service.recordAudit("privacy.compute", { metadata: { brainIds, dimensions, minK, releasedHashes: report.totals.releasedHashes, suppressedHashes: report.totals.suppressedHashes } });
    service.persist();
    return report;
  }

export function complianceReport(service: any, now = new Date()): ComplianceReport {
    const memories = service.store.list() as Memory[];
    const consent: ComplianceReport["consent"] = { private: 0, user: 0, org: 0, public: 0 };
    let encrypted = 0;
    let retentionExpired = 0;
    let deleteOnRequest = 0;
    for (const memory of memories) {
      consent[memory.consent.visibility as keyof ComplianceReport["consent"]] += 1;
      if ((memory.metadata.privacy as { action?: string } | undefined)?.action === "encrypt") encrypted += 1;
      if (memory.consent.retentionUntil && new Date(memory.consent.retentionUntil).getTime() <= now.getTime()) retentionExpired += 1;
      if (memory.consent.deleteOnRequest) deleteOnRequest += 1;
    }
    const auditByType: Record<string, number> = {};
    for (const event of service.auditEvents as Array<{ type: string }>) auditByType[event.type] = (auditByType[event.type] ?? 0) + 1;
    const encryption = service.securityKeyReport();
    const keyProvider = service.keyProviderReport();
    const backup = service.verifyBackupRecovery();
    const transportSecurity = service.transportSecurityReport();
    const dataFlows = Object.entries(auditByType)
      .map(([type, count]) => ({
        type,
        count,
        lastSeenAt: (service.auditEvents as Array<{ type: string; timestamp: string }>).filter((event) => event.type === type).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0]?.timestamp
      }))
      .sort((a, b) => b.count - a.count || a.type.localeCompare(b.type));
    return {
      generatedAt: now.toISOString(),
      totals: { memories: memories.length, auditEvents: service.auditEvents.length, brains: service.brains.size, sources: service.sources.size },
      consent,
      encrypted,
      retentionExpired,
      deleteOnRequest,
      auditByType,
      policyRules: service.listPolicyRules(),
      retentionRules: service.listRetentionRules(),
      encryption,
      keyProvider,
      backup,
      transportSecurity,
      dataFlows,
      risks: [
        ...(retentionExpired ? [`${retentionExpired} memories are past retention and should be archived or deleted.`] : []),
        ...(encryption.missingKeyMetadata ? [`${encryption.missingKeyMetadata} encrypted memories are missing key id/version metadata.`] : []),
        ...(!backup.verified ? [`${backup.failed.length} encrypted memories failed backup recovery verification.`] : []),
        ...(transportSecurity.warning ? [transportSecurity.warning] : []),
        ...(memories.some((memory) => memory.consent.visibility === "public" && memory.trust < 0.5) ? ["Low-trust public memories require operator review."] : [])
      ]
    };
  }

export function metricsReport(service: any): MetricsReport {
    return { ...service.metrics, sessions: { ...(service.metrics.sessions ?? {}) }, dreamActions: { ...(service.metrics.dreamActions ?? {}) } };
  }
