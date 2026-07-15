import assert from "node:assert/strict";
import { readEnvString, requireContextEnv } from "../workers/workflow/src/lib/env";
import { asObject, readString, toScalarMetadata, unwrapObjectBody } from "../workers/workflow/src/lib/payload";

assert.equal(readEnvString({ FIRST: "  primary  ", SECOND: "fallback" }, ["FIRST", "SECOND"]), "primary");
assert.equal(readEnvString({ FIRST: " ", SECOND: " fallback " }, ["FIRST", "SECOND"]), "fallback");
assert.equal(readEnvString({ FIRST: 123 }, ["FIRST"]), "");
assert.deepEqual(requireContextEnv({ env: { TOKEN: "ok" } }), { TOKEN: "ok" });
assert.throws(() => requireContextEnv(undefined), /Execution context missing env/);
assert.throws(() => requireContextEnv(undefined, "Cron execution context missing env"), /Cron execution context missing env/);

assert.deepEqual(asObject(null), {});
assert.deepEqual(asObject([]), {});
assert.deepEqual(unwrapObjectBody({ body: { key: "value" } }), { key: "value" });
assert.deepEqual(unwrapObjectBody({ body: ["not", "an", "object"] }), {});
assert.equal(readString({ value: "  text  " }, "value"), "text");
assert.equal(readString({ value: 42 }, "value"), "");
assert.deepEqual(toScalarMetadata({ text: "ok", count: 2, enabled: false, nested: {}, empty: null }), {
  text: "ok",
  count: "2",
  enabled: "false"
});
assert.equal(toScalarMetadata({ nested: {} }), undefined);

console.log("handler helper tests passed");
