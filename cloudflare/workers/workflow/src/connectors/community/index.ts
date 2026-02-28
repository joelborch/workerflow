export * from "./types";
export * from "./define";
export * from "./definitions";

import { CONNECTOR_DEFINITIONS } from "./definitions";

const BY_ID = new Map(CONNECTOR_DEFINITIONS.map((definition) => [definition.id, definition]));

export function listCommunityConnectors() {
  return CONNECTOR_DEFINITIONS;
}

export function getCommunityConnector(connectorId: string) {
  return BY_ID.get(connectorId);
}

export function listCommunityConnectorSecrets() {
  return [...new Set(CONNECTOR_DEFINITIONS.flatMap((connector) => connector.auth.requiredSecrets))].sort();
}
