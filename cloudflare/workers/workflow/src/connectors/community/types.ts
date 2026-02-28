export type ConnectorAuthStrategy = "oauth2" | "api_key" | "token" | "webhook" | "basic" | "none";

export type ConnectorOperationDirection = "trigger" | "action";

export type ConnectorOperation = {
  key: string;
  title: string;
  summary: string;
  direction: ConnectorOperationDirection;
};

export type ConnectorAuthProfile = {
  strategy: ConnectorAuthStrategy;
  requiredSecrets: string[];
  notes?: string;
};

export type ConnectorDefinition = {
  id: string;
  displayName: string;
  description: string;
  providerUrl: string;
  docsUrl: string;
  categories: string[];
  auth: ConnectorAuthProfile;
  operations: ConnectorOperation[];
  status: "scaffold" | "beta" | "ga";
};
