# Example: GitHub Issue From Webhook

Creates a GitHub issue using the `github_issue_create` route.

## Required Secrets

- `API_INGRESS_TOKEN` (workers/api)
- `GITHUB_TOKEN` (workers/workflow)
- optional `GITHUB_REPO` (workers/workflow), otherwise send `repo` in payload

## Run

```bash
export API_BASE_URL="https://your-workerflow-api.example.com"
export API_INGRESS_TOKEN="replace-me"
export TARGET_REPO="owner/repo"
./run.sh
```
