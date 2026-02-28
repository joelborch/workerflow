import { WorkerFlowClient } from "./generated/client";

async function run() {
  const client = new WorkerFlowClient({
    baseUrl: process.env.WORKERFLOW_API_BASE_URL || "http://127.0.0.1:8787",
    token: process.env.API_INGRESS_TOKEN || ""
  });

  const health = await client.getApiHealth();
  console.log("health", health);

  const routeResult = await client.postApiRoutePath("webhook_echo", {
    hello: "from generated sdk"
  });
  console.log("route result", routeResult);
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
