import type { Env } from "../../../../../shared/types";
import { createGithubIssue } from "../../connectors/github";
import { unwrapBody } from "../../lib/payload";

type HandlerContext = {
  env: Env;
};

type GithubIssueCreateResult = {
  ok: true;
  route: "github_issue_create";
  issueNumber: number;
  issueUrl: string;
  repository: string;
};

function asObject(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {} as Record<string, unknown>;
  }
  return value as Record<string, unknown>;
}

function envString(env: Env, key: string) {
  const raw = (env as unknown as Record<string, unknown>)[key];
  return typeof raw === "string" ? raw.trim() : "";
}

function normalizeLabels(value: unknown) {
  if (!Array.isArray(value)) {
    return [] as string[];
  }
  return value
    .filter((item) => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
}

export async function handle(
  requestPayload: unknown,
  traceId: string,
  context?: HandlerContext
): Promise<GithubIssueCreateResult> {
  const env = context?.env;
  if (!env) {
    throw new Error("Execution context missing env");
  }

  const body = asObject(unwrapBody(requestPayload));
  const token = envString(env, "GITHUB_TOKEN");
  const defaultRepo = envString(env, "GITHUB_REPO");
  const bodyRepo = typeof body.repo === "string" ? body.repo.trim() : "";
  const repository = bodyRepo || defaultRepo;

  if (!token) {
    throw new Error("GITHUB_TOKEN is required");
  }

  if (!repository) {
    throw new Error("github_issue_create requires body.repo or GITHUB_REPO");
  }

  const title =
    typeof body.title === "string" && body.title.trim().length > 0
      ? body.title.trim()
      : `WorkerFlow automation issue (${traceId})`;
  const issueBody = typeof body.body === "string" ? body.body : "";
  const labels = normalizeLabels(body.labels);

  const issue = await createGithubIssue({
    token,
    repo: repository,
    title,
    body: issueBody,
    labels
  });

  return {
    ok: true,
    route: "github_issue_create",
    issueNumber: issue.issueNumber,
    issueUrl: issue.issueUrl,
    repository: issue.repo
  };
}
