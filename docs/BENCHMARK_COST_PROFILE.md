# WorkerFlow Benchmark And Cost Profile

Generated: `2026-02-28T20:39:49.729Z`

## Benchmark Configuration

- iterations per scenario: **200**
- scenarios: `webhook_echo`, `chat_notify`, `lead_normalizer`, `openai_chat`
- total requests: **800**
- weighted error rate: **0.00%**

## Route Latency And Throughput

| Route | Requests | Successes | Failures | Error Rate | Mean (ms) | P50 (ms) | P95 (ms) | Throughput (req/s) |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `webhook_echo` | 200 | 200 | 0 | 0.00% | 0.10 | 0.06 | 0.21 | 5312.66 |
| `chat_notify` | 200 | 200 | 0 | 0.00% | 0.06 | 0.04 | 0.12 | 13542.07 |
| `lead_normalizer` | 200 | 200 | 0 | 0.00% | 0.07 | 0.05 | 0.13 | 12226.36 |
| `openai_chat` | 200 | 200 | 0 | 0.00% | 0.06 | 0.05 | 0.12 | 13470.59 |

## Run Volume Assumptions

| Assumption | Value |
| --- | ---: |
| Runs per day | 50000 |
| Runs per month (30d) | 1500000 |
| Free request allowance/day (assumed) | 100000 |
| Free-tier utilization/day | 50.00% |
| Estimated overage requests/day | 0 |

## Interpretation Guidance

1. Treat latency numbers as comparative baselines, not production SLA guarantees.
2. A non-zero error rate in this synthetic benchmark indicates regressions worth investigating before deploy.
3. If free-tier utilization is consistently above 100%, run this benchmark with production-like payload sizes and model paid-plan overage.
4. Re-generate this report after runtime, connector, or rate-limit changes.
