import { fetchWithRetry, requireOk } from "./http_retry";

type PostSlackMessageArgs = {
  webhookUrl: string;
  text: string;
  blocks?: unknown;
};

export async function postSlackMessage(args: PostSlackMessageArgs) {
  const response = await fetchWithRetry(args.webhookUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({
      text: args.text,
      ...(args.blocks !== undefined ? { blocks: args.blocks } : {})
    })
  });

  await requireOk(response, "Slack webhook failed");

  return {
    ok: true as const
  };
}
