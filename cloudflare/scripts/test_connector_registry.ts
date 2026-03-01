import assert from "node:assert/strict";

import { RUNTIME_CONNECTOR_SPECS } from "../shared/connector_registry";
import { ROUTES } from "../shared/routes";

const ROUTE_IDS = new Set(ROUTES.map((route) => route.routePath));
const SECRET_KEY_PATTERN = /^[A-Z0-9_]+$/;

function run() {
  assert.ok(RUNTIME_CONNECTOR_SPECS.length >= 6, `expected at least 6 runtime connector specs, got ${RUNTIME_CONNECTOR_SPECS.length}`);

  const ids = RUNTIME_CONNECTOR_SPECS.map((connector) => connector.id);
  assert.equal(new Set(ids).size, ids.length, "runtime connector ids must be unique");

  for (const connector of RUNTIME_CONNECTOR_SPECS) {
    assert.ok(connector.displayName.trim().length > 0, `${connector.id}: missing displayName`);
    assert.ok(connector.docsUrl.startsWith("https://"), `${connector.id}: docsUrl must be https`);
    assert.ok(connector.routeRequirements.length > 0, `${connector.id}: expected at least one route requirement`);

    for (const requirement of connector.routeRequirements) {
      assert.ok(ROUTE_IDS.has(requirement.routePath), `${connector.id}: unknown routePath "${requirement.routePath}"`);
      assert.ok(requirement.label.trim().length > 0, `${connector.id}:${requirement.routePath} missing label`);
      assert.ok(
        requirement.requiredSecrets.length > 0,
        `${connector.id}:${requirement.routePath} expected at least one required secret`
      );
      for (const secretKey of requirement.requiredSecrets) {
        assert.ok(
          SECRET_KEY_PATTERN.test(secretKey),
          `${connector.id}:${requirement.routePath} invalid secret key "${secretKey}"`
        );
      }
    }
  }

  console.log(`connector registry tests passed: connectors=${RUNTIME_CONNECTOR_SPECS.length}`);
}

run();
