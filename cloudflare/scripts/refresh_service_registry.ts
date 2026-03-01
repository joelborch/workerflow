import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

type ServiceRecord = {
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
};

type ServiceRegistry = {
  version: number;
  updatedAt: string;
  notes: string | null;
  services: ServiceRecord[];
};

const URL_FIELDS: Array<keyof ServiceRecord> = [
  "officialApiDocsUrl",
  "bestBaseLink",
  "authDocsUrl",
  "webhookDocsUrl",
  "rateLimitDocsUrl",
  "openapiUrl",
  "officialSdkUrl",
  "changelogUrl"
];

function normalizeText(value: string | null | undefined) {
  if (value == null) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeHttpsUrl(value: string | null | undefined) {
  const normalized = normalizeText(value);
  if (normalized == null) {
    return null;
  }
  return normalized.startsWith("https://") ? normalized : null;
}

function unique(values: string[]) {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) {
      continue;
    }
    seen.add(value);
    out.push(value);
  }
  return out;
}

function getServiceSortRank(rank: number | null) {
  return typeof rank === "number" ? rank : Number.MAX_SAFE_INTEGER;
}

function refreshService(service: ServiceRecord): ServiceRecord {
  const next: ServiceRecord = {
    ...service,
    connectorName: service.connectorName.trim(),
    officialVendorName: service.officialVendorName.trim(),
    bestBaseLinkReason: normalizeText(service.bestBaseLinkReason),
    authType: normalizeText(service.authType),
    docsRequiresLogin: service.docsRequiresLogin,
    confidence: normalizeText(service.confidence),
    notes: normalizeText(service.notes),
    sources: Array.isArray(service.sources) ? service.sources : []
  };

  for (const field of URL_FIELDS) {
    next[field] = normalizeHttpsUrl(next[field]);
  }

  // Keep docs/base in sync so the canonical entry stays usable for agents.
  if (next.officialApiDocsUrl == null && next.bestBaseLink != null) {
    next.officialApiDocsUrl = next.bestBaseLink;
  }
  if (next.bestBaseLink == null && next.officialApiDocsUrl != null) {
    next.bestBaseLink = next.officialApiDocsUrl;
  }

  const sourceCandidates = [
    ...next.sources.map((value) => value.trim()),
    next.officialApiDocsUrl,
    next.bestBaseLink,
    next.authDocsUrl,
    next.webhookDocsUrl,
    next.rateLimitDocsUrl,
    next.openapiUrl,
    next.officialSdkUrl,
    next.changelogUrl
  ];

  next.sources = unique(sourceCandidates.filter((value): value is string => typeof value === "string" && value.startsWith("https://")));
  return next;
}

function run() {
  const filePath = join(process.cwd(), "connector-registry", "services.json");
  const raw = readFileSync(filePath, "utf8");
  const parsed = JSON.parse(raw) as ServiceRegistry;

  const services = parsed.services.map(refreshService);
  services.sort((a, b) => {
    const rankDiff = getServiceSortRank(a.rank) - getServiceSortRank(b.rank);
    if (rankDiff !== 0) {
      return rankDiff;
    }
    return a.connectorName.localeCompare(b.connectorName);
  });

  const output: ServiceRegistry = {
    ...parsed,
    services
  };

  writeFileSync(filePath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
  console.log(`service registry refreshed: services=${output.services.length}`);
}

run();
