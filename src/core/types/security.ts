import type { ConsentVisibility, MemoryPolicyRule, RetentionRule } from "./base";
import type { AuditEvent } from "./integrations";

export interface ComplianceReport {
  generatedAt: Date | string;
  totals: { memories: number; auditEvents: number; brains: number; sources: number };
  consent: Record<ConsentVisibility, number>;
  encrypted: number;
  retentionExpired: number;
  deleteOnRequest: number;
  auditByType: Record<string, number>;
  policyRules?: MemoryPolicyRule[];
  retentionRules?: RetentionRule[];
  encryption?: {
    keyIds: Record<string, number>;
    keyVersions: Record<string, number>;
    rotated: number;
    missingKeyMetadata: number;
    backupRefs: string[];
  };
  keyProvider?: KeyProviderReport;
  backup?: BackupRecoveryReport;
  transportSecurity?: TransportSecurityReport;
  dataFlows?: Array<{ type: string; count: number; lastSeenAt?: Date | string }>;
  risks: string[];
}

export interface KeyProviderReport {
  provider: "local-env" | "external" | "unconfigured";
  scope: "local" | "user" | "org";
  activeKeyId?: string;
  activeKeyVersion?: string;
  encryptedMemories: number;
  knownKeyIds: string[];
  knownKeyVersions: string[];
  hasEncryptionMaterial: boolean;
  rotationPolicyDays?: number;
  backupRefs: string[];
  notes: string[];
}

export interface SecurityKeyReport {
  encrypted: number;
  keyIds: Record<string, number>;
  keyVersions: Record<string, number>;
  rotated: number;
  missingKeyMetadata: number;
  backupRefs: string[];
}

export interface KeyRotationReport {
  generatedAt: Date | string;
  rotated: string[];
  skipped: string[];
  keyId: string;
  keyVersion: string;
  backupRef?: string;
}

export interface BackupRecoveryReport {
  generatedAt: Date | string;
  backupRef?: string;
  encryptedMemories: number;
  recovered: string[];
  failed: Array<{ memoryId: string; reason: string }>;
  importedMemories?: number;
  verified: boolean;
}

export interface TransportSecurityReport {
  generatedAt: Date | string;
  mode: "local" | "self_hosted" | "managed" | "production";
  publicUrl?: string;
  tlsTerminatedBy?: string;
  inTransitEncrypted: boolean;
  warning?: string;
}

export interface DifferentialPrivacyReport {
  generatedAt: Date | string;
  epsilon: number;
  kAnonymity: number;
  suppressedGroups: number;
  aggregates: Array<{
    dimension: string;
    key: string;
    noisyCount: number;
    exactCount?: number;
    suppressed: boolean;
  }>;
  notes: string[];
}

export interface CrossBrainPrivacyComputeReport {
  generatedAt: Date | string;
  brainIds: string[];
  dimensions: Array<"entities" | "tags" | "relations">;
  minK: number;
  hashAlgorithm: "hmac-sha256";
  saltHash: string;
  noRawMemoryData: true;
  totals: {
    memoriesScanned: number;
    candidateHashes: number;
    releasedHashes: number;
    suppressedHashes: number;
  };
  brains: Array<{
    brainId: string;
    memoriesScanned: number;
    contributedHashes: number;
    releasedHashes: number;
    suppressedHashes: number;
  }>;
  intersections: Array<{
    hash: string;
    dimensions: Array<"entities" | "tags" | "relations">;
    participantBrainIds: string[];
    brainCount: number;
    memoryCount: number;
  }>;
  notes: string[];
}
