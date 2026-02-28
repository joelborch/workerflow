type ClickupCreateTaskArgs = {
  token: string;
  listId: string;
  name: string;
  description: string;
  status?: string;
};

export async function fetchClickupTask(token: string, taskId: string) {
  const response = await fetch(`https://api.clickup.com/api/v2/task/${taskId}`, {
    headers: {
      Authorization: token
    }
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`ClickUp task fetch failed: ${response.status} ${response.statusText} ${errorText}`);
  }

  return (await response.json()) as Record<string, unknown>;
}

export async function createClickupTask(args: ClickupCreateTaskArgs) {
  const response = await fetch(`https://api.clickup.com/api/v2/list/${args.listId}/task`, {
    method: "POST",
    headers: {
      Authorization: args.token,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      name: args.name,
      description: args.description,
      ...(args.status ? { status: args.status } : {})
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`ClickUp create task failed: ${response.status} ${response.statusText} ${errorText}`);
  }

  return await response.json();
}

export async function addClickupTaskComment(taskId: string, commentText: string, token: string) {
  const response = await fetch(`https://api.clickup.com/api/v2/task/${taskId}/comment`, {
    method: "POST",
    headers: {
      Authorization: token,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ comment_text: commentText })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`ClickUp API failed: ${response.status} ${response.statusText} ${errorText}`);
  }
}

