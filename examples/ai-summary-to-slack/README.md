# Example: AI Summary To Slack

Uses `openai_chat` to summarize text, then sends summary via `slack_message`.

## Required Secrets

- `API_INGRESS_TOKEN` (workers/api)
- `OPENAI_API_KEY` (workers/workflow)
- `SLACK_WEBHOOK_URL` (workers/workflow)

## Run

```bash
export API_BASE_URL="https://your-workerflow-api.example.com"
export API_INGRESS_TOKEN="replace-me"
./run.sh
```
