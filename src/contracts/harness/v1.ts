import contract from "./v1.json";

export type HarnessLifecycleCommand = keyof typeof contract.commands;
export type HarnessCommandSchema = {
  required: string[];
  properties: string[];
  apiMapping?: {
    endpoint: string;
    fields: Record<string, string>;
  };
};

export const harnessLifecycleContract = contract;
export const harnessLifecycleContractVersion = contract.contract;
export const harnessExitCodes = contract.exitCodes;
export const harnessMcpParity = contract.mcpParity;
export const harnessCommandSchemas = contract.commands satisfies Record<string, HarnessCommandSchema>;

export function harnessCommandJsonSchema(command: HarnessLifecycleCommand) {
  const schema = harnessCommandSchemas[command];
  return {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    title: `cognibrain ${command}`,
    type: "object",
    required: schema.required,
    additionalProperties: false,
    properties: Object.fromEntries(schema.properties.map((property) => [property, {}]))
  };
}
