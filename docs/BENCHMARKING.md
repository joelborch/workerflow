# Benchmarking And Cost Profiling

WorkerFlow includes a benchmark script that exercises representative API routes and generates a markdown cost/performance report.

## Generate Report

```bash
cd cloudflare
npm run bench:report
```

Default output:

- `docs/BENCHMARK_COST_PROFILE.md`

## Override Assumptions

```bash
cd cloudflare
npx tsx scripts/bench_route_throughput.ts \
  --iterations=500 \
  --runs-per-day=120000 \
  --free-requests-per-day=100000 \
  --out ../docs/BENCHMARK_COST_PROFILE.md
```

## How To Interpret

1. Compare `p95` latency and error rate before and after runtime changes.
2. Keep a history of reports per release tag to spot regressions.
3. Use run-volume assumptions to estimate whether you stay within free-tier request envelopes.
4. Re-run with payloads/routes that match your production traffic profile for accurate planning.

Latest generated report:

- [BENCHMARK_COST_PROFILE.md](./BENCHMARK_COST_PROFILE.md)
