# Example: Slack Alert

Sends a message through the `slack_message` route.

## Required Secrets

- `API_INGRESS_TOKEN` (workers/api)
- `SLACK_WEBHOOK_URL` (workers/workflow)

## Run

```bash
export API_BASE_URL="https://your-workerflow-api.example.com"
export API_INGRESS_TOKEN="replace-me"
./run.sh
```
