#!/usr/bin/env node
import { resolve } from "node:path";
import { MemoryService } from "../api/service";
import { handleConnectorCommand } from "./memctl/connectorCommands";
import { handleReflectionCommands } from "./memctl/reflectionCommands";
import { handleWorkspaceCommands } from "./memctl/workspaceCommands";
import { handleGovernanceCommands } from "./memctl/governanceCommands";
import { handleOpsCommands } from "./memctl/opsCommands";
import { handleMemoryCommands } from "./memctl/memoryCommands";
import { fail } from "./memctl/env";

const userId = process.env.MEMORY_USER_ID ?? process.env.USER ?? "local";
const dbPath = resolve(process.env.MEMORY_DB_PATH ?? ".memory-harness.json");
const service = new MemoryService({
  persistencePath: dbPath,
  autoDream: {
    enabled: process.env.MEMORY_AUTO_DREAM !== "false",
    intervalHours: Number(process.env.MEMORY_DREAM_INTERVAL_HOURS ?? 6),
    writeThreshold: Number(process.env.MEMORY_DREAM_WRITE_THRESHOLD ?? 12)
  },
  configPath: process.env.MEMORY_CONFIG_PATH
});

const [command, ...args] = process.argv.slice(2);

if (await handleConnectorCommand(command, args, { service, userId })) process.exit(0);

if (await handleMemoryCommands(command, args, { service, userId })) process.exit(0);
if (await handleReflectionCommands(command, args, { service, userId })) process.exit(0);
if (await handleWorkspaceCommands(command, args, { service, userId })) process.exit(0);
if (await handleGovernanceCommands(command, args, { service, userId })) process.exit(0);
if (await handleOpsCommands(command, args, { service, userId })) process.exit(0);

fail("Usage: memctl <add|list|extract|action|coding-context|context-enrich|context-explain|code-correction|action-guard|patch-evidence|search|inspect|edit|archive|route|intent|evidence|evidence-pack|why-used|truth-current|truth-explain|truth-conflicts|truth-resolve|reflect|dream|dream-plan|dream-run|dream-start|dream-jobs|dream-cancel|dream-retry|dream-verify|dream-conflicts|dream-resolve|health|maintenance|verify|confirm|retract|feedback|feedback-injection|metrics|profiles|profile-set|profile-learn|profile-sample|identity-link|timeline|timeline-summarize|temporal|patterns|graph|entities|entity-enrich|entity-merge|entity-split|graph-path|explain|graph-activate|graph-export|graph-query|graph-changes|infer|agent-register|agents|agent-persona|persona-set|personas|brain-create|brains|source-create|events|episodes|episode|federated-search|share-request|share-approve|promote|review|share-revoke|revoke|audit|audit-chain|compliance|compliance-export|policy-rules|policy-rule|policy-evaluate|retention-rule|retention-rules|retention-review|retention-enforce|key-report|key-rotate|privacy-insights|privacy-cross-brain|storage|marketplace|marketplace-plan|marketplace-install|marketplace-submit|marketplace-submissions|marketplace-scan|marketplace-review|marketplace-publish|marketplace-rate|api-spec|migration-export|managed-tenant-create|managed-tenants|managed-control-plane|benchmark-nextgen|leaderboard|provider-status|translate|connectors|connector-register|connector-configure|connector-test|connector-preview|connector-sync|connector-review|connector-approve|connector-reject|connector-sync-records|connector-health|connector-auth|connector-auth-begin|connector-auth-callback|connector-auth-revoke|connector-auth-refresh|connector-list|connector-poll|connector-writeback|connector-feedback|connector-telemetry|benchmark-proof|production-certify|media-ingest|webhook-deliver|consent|revert|offline-add|offline-update|sync|sync-status|lifecycle-preview|dream-policy|observations|predictions|export|delete-user> ...");
