export {
  connectorAuthHeaders,
  createConnectorManifest,
  createPlatformIntegration,
  createWritebackPlan,
  mapPlatformRecord,
  normalizeConnectorEvent,
  runConnectorPoll
} from "../../src/connectors/sdk";

export type {
  ConnectorAdapter,
  ConnectorEventInput,
  ConnectorRuntimeContext,
  ConnectorWritebackPlan,
  PlatformIntegration,
  PlatformIntegrationConfig,
  PlatformIntegrationHandlers,
  PlatformIntegrationOptions,
  PlatformRecord
} from "../../src/connectors/sdk";

export { createWritebackPlan as createDryRunWritebackPlan } from "../../src/connectors/sdk";
