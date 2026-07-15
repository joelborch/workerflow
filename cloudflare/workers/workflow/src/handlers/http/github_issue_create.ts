import type { Env } from "../../../../../shared/types";
import { createGithubIssue } from "../../connectors/github";
import { readEnvString, requireContextEnv, type EnvContext } from "../../lib/env";
import { unwrapObjectBody } from "../../lib/payload";

type GithubIssueCreateResult = {
  ok: true;
  route: "github_issue_create";
  issueNumber: number;
  issueUrl: string;
  repository: string;
};

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
  context?: EnvContext<Env>
): Promise<GithubIssueCreateResult> {
  const env = requireContextEnv(context);
  const body = unwrapObjectBody(requestPayload);
  const token = readEnvString(env, ["GITHUB_TOKEN"]);
  const defaultRepo = readEnvString(env, ["GITHUB_REPO"]);
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
