import assert from "node:assert/strict";
import { decodePathParameter } from "../shared/http";
import { parseRouteRateLimits } from "../shared/runtime_config";
import { isSecretsStoreBinding, timingSafeStringEqual } from "../shared/security";
import { isRouteEnabled, parseRouteSet } from "../shared/task_enablement";

assert.equal(timingSafeStringEqual("token", "token"), true);
assert.equal(timingSafeStringEqual("token", "t0ken"), false);
assert.equal(timingSafeStringEqual("short", "longer"), false);
assert.equal(isSecretsStoreBinding({ get: async () => "secret" }), true);
assert.equal(isSecretsStoreBinding({ get: "secret" }), false);
assert.equal(isSecretsStoreBinding(null), false);

assert.deepEqual(parseRouteRateLimits(undefined), {});
assert.deepEqual(parseRouteRateLimits("not-json"), {});
assert.deepEqual(parseRouteRateLimits("[]"), {});
assert.deepEqual(
  parseRouteRateLimits(JSON.stringify({
    route_a: { rpm: 10.9, burst: 2.8 },
    route_b: { rpm: 0, burst: 4 },
    route_c: { rpm: 5, burst: -2 },
    route_d: "invalid"
  })),
  {
    route_a: { rpm: 10, burst: 2 },
    route_c: { rpm: 5, burst: 0 }
  }
);

assert.deepEqual(parseRouteSet(" route_a, route_b, route_a "), new Set(["route_a", "route_b"]));
assert.equal(isRouteEnabled("route_a", { ENABLED_HTTP_ROUTES: "route_a" }), true);
assert.equal(isRouteEnabled("route_b", { ENABLED_HTTP_ROUTES: "route_a" }), false);
assert.equal(isRouteEnabled("route_a", { DISABLED_HTTP_ROUTES: "route_a" }), false);

assert.equal(decodePathParameter("/api/replay/trace%20one", /^\/api\/replay\/([^/]+)$/), "trace one");
assert.equal(decodePathParameter("/api/replay/trace/one", /^\/api\/replay\/([^/]+)$/), undefined);

console.log("shared runtime helper tests passed");
