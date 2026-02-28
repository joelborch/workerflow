import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { ROUTES } from "../shared/routes";
import { SCHEDULES } from "../shared/schedules";

type RoutesContract = typeof ROUTES;
type SchedulesContract = typeof SCHEDULES;

function readJsonFile<T>(relativePath: string) {
  const absolute = resolve(process.cwd(), relativePath);
  return JSON.parse(readFileSync(absolute, "utf8")) as T;
}

function sortRoutes(routes: RoutesContract) {
  return [...routes].sort((a, b) => a.routePath.localeCompare(b.routePath));
}

function sortSchedules(schedules: SchedulesContract) {
  return [...schedules].sort((a, b) => a.id.localeCompare(b.id));
}

function run() {
  const routesContract = readJsonFile<RoutesContract>("contracts/routes.v1.json");
  const schedulesContract = readJsonFile<SchedulesContract>("contracts/schedules.v1.json");

  assert.deepEqual(
    sortRoutes(ROUTES),
    sortRoutes(routesContract),
    "Route compatibility contract mismatch. Update routes.v1.json only for intentional breaking changes."
  );

  assert.deepEqual(
    sortSchedules(SCHEDULES),
    sortSchedules(schedulesContract),
    "Schedule compatibility contract mismatch. Update schedules.v1.json only for intentional breaking changes."
  );

  console.log(
    `compat contract tests passed: routes=${routesContract.length} schedules=${schedulesContract.length}`
  );
}

run();
