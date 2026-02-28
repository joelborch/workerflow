import assert from "node:assert/strict";

import { CONNECTOR_DEFINITIONS } from "../workers/workflow/src/connectors/community/definitions";

function run() {
  assert.ok(CONNECTOR_DEFINITIONS.length >= 30, `expected at least 30 connectors, got ${CONNECTOR_DEFINITIONS.length}`);

  const ids = CONNECTOR_DEFINITIONS.map((connector) => connector.id);
  const uniqueIds = new Set(ids);
  assert.equal(uniqueIds.size, ids.length, "connector ids must be unique");

  for (const connector of CONNECTOR_DEFINITIONS) {
    assert.ok(connector.displayName.trim().length > 0, `${connector.id}: missing displayName`);
    assert.ok(connector.description.trim().length > 0, `${connector.id}: missing description`);
    assert.ok(connector.providerUrl.startsWith("https://"), `${connector.id}: providerUrl must be https`);
    assert.ok(connector.docsUrl.startsWith("https://"), `${connector.id}: docsUrl must be https`);
    assert.ok(connector.categories.length > 0, `${connector.id}: expected at least one category`);
    assert.ok(connector.operations.length >= 2, `${connector.id}: expected trigger + action scaffold`);
    assert.ok(
      connector.operations.some((operation) => operation.direction === "trigger"),
      `${connector.id}: missing trigger scaffold`
    );
    assert.ok(
      connector.operations.some((operation) => operation.direction === "action"),
      `${connector.id}: missing action scaffold`
    );
  }

  console.log(`connector catalog tests passed: connectors=${CONNECTOR_DEFINITIONS.length}`);
}

run();
