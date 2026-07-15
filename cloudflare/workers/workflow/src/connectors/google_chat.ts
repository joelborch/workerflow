export async function postToGoogleChat(webhookUrl: string, text: string) {
  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ text })
  });

  await requireOk(response, "Google Chat webhook failed");
}
import { requireOk } from "./http_retry";

