import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

type ServiceRegistry = {
  version: number;
  updatedAt: string;
  services: Array<{
    rank: number | null;
    connectorName: string;
    officialVendorName: string;
    officialApiDocsUrl: string | null;
    bestBaseLink: string | null;
    bestBaseLinkScore: number | null;
    bestBaseLinkReason: string | null;
    authType: string | null;
    authDocsUrl: string | null;
    webhookDocsUrl: string | null;
    rateLimitDocsUrl: string | null;
    openapiUrl: string | null;
    officialSdkUrl: string | null;
    changelogUrl: string | null;
    docsRequiresLogin: boolean | "unknown" | null;
    confidence: string | null;
    notes: string | null;
    sources: string[];
  }>;
};

function isHttpsUrl(value: string | null | undefined) {
  return typeof value === "string" && value.startsWith("https://");
}

function run() {
  const filePath = join(process.cwd(), "connector-registry", "services.json");
  const raw = readFileSync(filePath, "utf8");
  const parsed = JSON.parse(raw) as ServiceRegistry;

  assert.equal(parsed.version, 1, "services.json: version must be 1");
  assert.ok(typeof parsed.updatedAt === "string" && parsed.updatedAt.length >= 10, "services.json: updatedAt is required");
  assert.ok(Array.isArray(parsed.services), "services.json: services must be an array");
  assert.equal(parsed.services.length, 100, "services.json: expected exactly 100 rows");

  const names = parsed.services.map((service) => service.connectorName.trim().toLowerCase());
  assert.equal(new Set(names).size, names.length, "services.json: connectorName values must be unique");
  const ranks = parsed.services.map((service) => service.rank).filter((rank): rank is number => typeof rank === "number");
  assert.equal(ranks.length, 100, "services.json: all services should include numeric rank");
  assert.equal(new Set(ranks).size, 100, "services.json: rank values must be unique");
  assert.ok(Math.min(...ranks) === 1 && Math.max(...ranks) === 100, "services.json: rank range must be 1..100");

  for (const service of parsed.services) {
    assert.ok(service.connectorName.trim().length > 0, "services.json: connectorName is required");
    assert.ok(service.officialVendorName.trim().length > 0, "services.json: officialVendorName is required");
    assert.ok(isHttpsUrl(service.officialApiDocsUrl), `${service.connectorName}: officialApiDocsUrl must be https`);
    assert.ok(isHttpsUrl(service.bestBaseLink), `${service.connectorName}: bestBaseLink must be https`);
    assert.ok(
      service.bestBaseLinkScore === null || Number.isFinite(service.bestBaseLinkScore),
      `${service.connectorName}: bestBaseLinkScore must be number or null`
    );
    assert.ok(service.authType === null || service.authType.trim().length > 0, `${service.connectorName}: authType must not be empty`);
    assert.ok(Array.isArray(service.sources), `${service.connectorName}: sources must be an array`);
    assert.ok(service.sources.length > 0, `${service.connectorName}: sources must include at least one URL`);
    for (const source of service.sources) {
      assert.ok(isHttpsUrl(source), `${service.connectorName}: source URL must be https`);
    }
  }

  console.log(`service registry JSON tests passed: services=${parsed.services.length}`);
}

run();
