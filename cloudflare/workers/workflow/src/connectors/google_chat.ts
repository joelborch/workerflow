export async function postToGoogleChat(webhookUrl: string, text: string) {
  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ text })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Google Chat webhook failed: ${response.status} ${response.statusText} ${errorText}`);
  }
}

