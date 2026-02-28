import type { RouteDefinition } from "./types";

export const ROUTES: RouteDefinition[] = [
  {
    routePath: "webhook_echo",
    requestType: "async",
    flowPath: "f/examples/webhook_echo",
    wrapBody: false
  },
  {
    routePath: "chat_notify",
    requestType: "async",
    flowPath: "f/examples/chat_notify",
    wrapBody: true
  },
  {
    routePath: "lead_normalizer",
    requestType: "sync",
    flowPath: "f/examples/lead_normalizer",
    wrapBody: true
  }
];

const routeMap = new Map(ROUTES.map((route) => [route.routePath, route]));

export function getRoute(routePath: string) {
  return routeMap.get(routePath);
}
