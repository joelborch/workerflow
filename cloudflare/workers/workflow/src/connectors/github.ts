import { fetchWithRetry } from "./http_retry";

type CreateGithubIssueArgs = {
  token: string;
  repo: string;
  title: string;
  body?: string;
  labels?: string[];
};

type CreateGithubIssueResponse = {
  number?: unknown;
  html_url?: unknown;
};

function normalizeRepo(repo: string) {
  return repo.trim().replace(/^\/+/, "").replace(/\/+$/, "");
}

export async function createGithubIssue(args: CreateGithubIssueArgs) {
  const repo = normalizeRepo(args.repo);
  const url = `https://api.github.com/repos/${repo}/issues`;
  const response = await fetchWithRetry(url, {
    method: "POST",
    headers: {
      authorization: `Bearer ${args.token}`,
      accept: "application/vnd.github+json",
      "content-type": "application/json",
      "user-agent": "workerflow-runtime"
    },
    body: JSON.stringify({
      title: args.title,
      ...(args.body ? { body: args.body } : {}),
      ...(args.labels && args.labels.length > 0 ? { labels: args.labels } : {})
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`GitHub issue create failed: ${response.status} ${response.statusText} ${errorText}`);
  }

  const data = (await response.json()) as CreateGithubIssueResponse;
  return {
    issueNumber: typeof data.number === "number" ? data.number : 0,
    issueUrl: typeof data.html_url === "string" ? data.html_url : "",
    repo
  };
}
