import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const expectedHashes: Record<string, string> = {
  "docs/AGENT_CONNECTOR_PLAYBOOK.md": "0a05b61079c29a7a5e9dfd425780a932f4528232a63201d0f31d1c89ac556db8",
  "docs/AGENT_CLONE_TO_DEPLOY_RUNBOOK.md": "85e13d132cec0307d6734e116f811a1f8989d0ba8b5feaaa8231eac0cf4ae0d3",
  "examples/ai-summary-to-slack/run.sh": "345944192cc3c6af1baa118e04af3efba522ccb93764412ddfb015a9467fb70f",
  "cloudflare/workers/workflow/src/connectors/openai.ts": "6c7af4321f11d4bedbafe935b5b8b423ee665156b741749b488c6e82764280d0",
  "cloudflare/workers/workflow/src/connectors/google_ai.ts": "ae2d576f34907a1d85b711c50137e78142c370732203591f34d3b4c4f5162dd5",
  "cloudflare/workers/workflow/src/handlers/http/openai_chat.ts": "17e8b49c42e6f0e5f40cb05fb7f110198d6888e12771ddc6312a584cda3e93c6",
  "cloudflare/shared/route_validation.ts": "0bd45541df87801691e51acc8d3e341a62ad0fce13f0863471b1b0a6c2547e71",
  "cloudflare/scripts/test_handler_fixtures.ts": "7808c946aff97d5a17e8b4215af7456db4386d760d4be05ffcb5a71af6b61804",
  "cloudflare/scripts/test_route_fixtures.ts": "97ec9d9d658b96a7902c82174cc5a61f8056a09f9370814655b76f081b86d58e",
  "cloudflare/scripts/test_connector_harness.ts": "fbf114e5c3083185711ecb3a483022e6bf07baaf7be9ecfba64bc66fcc2e3f1a",
  "cloudflare/scripts/smoke_workflow_handlers.ts": "60cd8241ea3df529b7da97d923b9dbebe6e824543fe596bd3d4f8eebb2548272",
  "cloudflare/scripts/test_e2e_runtime.ts": "6835033373c868e214f08501977d8439ef9d548e0e81a0dfe8ddb89cc7c03d84",
  "cloudflare/scripts/bench_route_throughput.ts": "637ae07cab812f90496689d29c0133ddd42509c15878265d9773d5c941b3bec9"
};

const repositoryRoot = resolve(process.cwd(), "..");
const mismatches: string[] = [];

for (const [path, expected] of Object.entries(expectedHashes)) {
  const actual = createHash("sha256").update(readFileSync(resolve(repositoryRoot, path))).digest("hex");
  if (actual !== expected) {
    mismatches.push(`${path}: expected ${expected}, received ${actual}`);
  }
}

if (mismatches.length > 0) {
  throw new Error(`Prompt integrity check failed:\n${mismatches.join("\n")}`);
}

console.log(`prompt integrity tests passed: files=${Object.keys(expectedHashes).length}`);
