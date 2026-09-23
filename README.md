# k6 performance test project

This project is organized for k6 performance testing with separate scenarios for smoke, load, and stress testing.

## Structure

```text
.
├── src/
│   ├── config.js
│   └── helpers.js
├── tests/
│   ├── smoke/
│   │   └── smoke.js
│   ├── load/
│   │   └── load.js
│   └── stress/
│       └── stress.js
├── package.json
├── .gitignore
└── README.md
```

## Prerequisites

- Install k6: https://grafana.com/docs/k6/latest/set-up/install/
- Node.js is only used for local linting/formatting in this repo.

## Run the tests

```bash
# smoke test
k6 run tests/smoke/smoke.js

# load test
BASE_URL=https://dummyjson.com k6 run tests/load/load.js

# stress test
BASE_URL=https://dummyjson.com k6 run tests/stress/stress.js
```

## Common commands

```bash
npm run lint
npm run format
```

## Scenario notes

- Smoke: validates the app is healthy with minimal traffic.
- Load: increases concurrency gradually to observe normal usage conditions.
- Stress: pushes beyond expected production load to find breaking points and system limits.

## Suggested thresholds

- HTTP latency: keep p(95) under target values for each scenario.
- Error rate: keep failed requests under 1% in normal conditions.
- For stress tests, more lenient error thresholds are acceptable while identifying system limits.
