# Architecture Notes

## Components

- API Worker: validates ingress, enforces auth/gating, creates tasks.
- Queue Consumer: drains async tasks and invokes workflow execution.
- Workflow Worker: dispatches to route/schedule handlers.
- Scheduler Worker: enqueues scheduled tasks.
- Ops Dashboard Worker: exposes operational endpoints and dashboard UI.
- D1: persistent state for runs, dead letters, idempotency, cursor data.

## Task Lifecycles

HTTP route (async):

1. `POST /api/{route}`
2. API validates + writes idempotency
3. API enqueues `http_route` task
4. queue consumer forwards task to workflow
5. workflow executes handler and writes run state

Schedule:

1. scheduler matches cron
2. scheduler enqueues `scheduled_job`
3. queue consumer forwards to workflow
4. workflow executes cron handler and writes run state

## Failure Handling

- execution errors are persisted as dead letters
- retry API allows controlled replay
- idempotency prevents duplicate double-processing from repeated deliveries
