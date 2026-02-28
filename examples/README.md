# WorkerFlow Examples

Copy/paste starter examples for common automation patterns.

## Included

- `slack-alert/`: send an alert message to Slack via `slack_message`
- `github-issue-from-webhook/`: create GitHub issue via `github_issue_create`
- `ai-summary-to-slack/`: summarize text with `openai_chat` then send to Slack

## Usage Pattern

1. Deploy WorkerFlow runtime (`cloudflare/`).
2. Set `API_BASE_URL` and `API_INGRESS_TOKEN`.
3. Configure required connector secrets for each example.
4. Run the provided script in each example folder.
