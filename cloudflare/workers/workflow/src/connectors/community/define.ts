import type { ConnectorDefinition, ConnectorAuthStrategy, ConnectorOperation } from "./types";

type OperationInput = {
  key: string;
  title: string;
  summary: string;
};

type ConnectorScaffoldInput = {
  id: string;
  displayName: string;
  description: string;
  providerUrl: string;
  docsUrl: string;
  categories: string[];
  authStrategy: ConnectorAuthStrategy;
  requiredSecrets: string[];
  authNotes?: string;
  triggers: OperationInput[];
  actions: OperationInput[];
};

function unique(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function toOperations(
  direction: "trigger" | "action",
  operations: OperationInput[]
): ConnectorOperation[] {
  return operations.map((operation) => ({
    key: operation.key,
    title: operation.title,
    summary: operation.summary,
    direction
  }));
}

export function createConnectorScaffold(input: ConnectorScaffoldInput): ConnectorDefinition {
  return {
    id: input.id,
    displayName: input.displayName,
    description: input.description,
    providerUrl: input.providerUrl,
    docsUrl: input.docsUrl,
    categories: unique(input.categories),
    auth: {
      strategy: input.authStrategy,
      requiredSecrets: unique(input.requiredSecrets),
      ...(input.authNotes ? { notes: input.authNotes } : {})
    },
    operations: [...toOperations("trigger", input.triggers), ...toOperations("action", input.actions)],
    status: "scaffold"
  };
}
