# k6 performance test project

This project is organized for k6 performance testing with separate scenarios for smoke, load, and stress testing.

## Structure

```text
.
├── src/
│   ├── config.js
│   └── helpers.js
├── tests/
│   ├── baseline/
│   │   └── baseline.js
│   ├── journeys/
│   │   └── shopping.js
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

# baseline test
BASE_URL=https://dummyjson.com npm run test:baseline

# realistic shopping journey
BASE_URL=https://dummyjson.com npm run test:journey

# shopping journey under load
BASE_URL=https://dummyjson.com npm run test:load:shopping

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

## Step-by-step performance testing roadmap

Use the following progression to expand this project safely. Do not increase traffic significantly until the earlier step produces reliable results.

### Step 1: Establish a baseline — Implemented

Run the smoke test against a controlled staging environment:

```bash
BASE_URL=https://your-staging-api.example.com npm run test:smoke
```

Record:

- p50, p95, and p99 response times
- HTTP failure rate
- Check success rate
- Requests per second
- CPU, memory, database, and connection-pool usage

Treat this run as the baseline for future comparisons.

This repository also provides a repeatable 30-second baseline command:

```bash
BASE_URL=https://your-staging-api.example.com npm run test:baseline
```

Save the output for each build and compare p50, p95, p99, failure rate, and throughput.

### Step 2: Make checks fail the test — Implemented

Add a `checks` threshold to each scenario so that a technically successful HTTP response with an invalid body also fails:

```js
thresholds: {
  checks: ['rate>0.99'],
  http_req_failed: ['rate<0.01'],
  http_req_duration: ['p(95)<500', 'p(99)<1000'],
}
```

Use thresholds that reflect the actual service-level objective rather than copying values from another system.

### Step 3: Build realistic user journeys — Implemented

Replace isolated endpoint calls with sequences that represent users, for example:

1. Browse products.
2. View product details.
3. Log in.
4. Add a product to a cart.
5. View the cart.
6. Check out.
7. Verify the order.

Use `group()` for each business step and validate both HTTP status codes and response data. A `200` response is not sufficient if the expected product, token, cart, or order is missing.

Run the initial DummyJSON journey with:

```bash
BASE_URL=https://dummyjson.com npm run test:journey
```

The journey uses DummyJSON for browsing, login, and cart operations. Checkout and order verification are intentionally simulated because DummyJSON does not provide persistent checkout or order endpoints. Replace those two groups when connecting the test to your own API.

To run the same journey as a load test, use:

```bash
BASE_URL=https://your-staging-api.example.com npm run test:load:shopping
```

The load version ramps from 0 to 5, then 10, then 25 concurrent virtual users. It tests the same behavior as `test:journey`; only the traffic profile changes.

### Step 4: Add endpoint and journey tags — Implemented

Tag requests so results can be analyzed by endpoint:

```js
http.get(`${BASE_URL}/products`, {
  tags: { endpoint: 'products', journey: 'shopping' },
});
```

The shopping journey now tags each HTTP request with both `endpoint` and `journey`. Its runnable profiles also define endpoint-specific thresholds:

```js
thresholds: {
  'http_req_duration{endpoint:products}': ['p(95)<400'],
  'http_req_duration{endpoint:login}': ['p(95)<800'],
  'http_req_duration{endpoint:cart-add}': ['p(95)<800'],
  checks: ['rate>0.99'],
}
```

Checkout and order verification currently do not have HTTP endpoint thresholds because DummyJSON does not provide real checkout or order endpoints; those steps are simulated locally.

### Step 5: Use realistic test data

Create test users, products, search terms, cart sizes, and payloads that resemble production behavior. Avoid making every virtual user use the same account or record unless that is intentional.

For larger datasets, load data once with `SharedArray`:

```js
import { SharedArray } from 'k6/data';

const users = new SharedArray('users', () =>
  JSON.parse(open('./data/users.json')),
);

export default function () {
  const user = users[__VU % users.length];
  // Use user credentials in the journey.
}
```

### Step 6: Use realistic test data, authentication, and correlation — Implemented

The shopping journey now loads a shared pool of DummyJSON users from `data/users.json`, selects a different user across iterations, chooses a product from the returned product list, varies the cart quantity, and uses the login token and returned IDs in later requests.

Test the complete login flow, extract the token or cookie, and use it in later requests. Extract IDs from responses and pass them to subsequent requests so the test exercises real dependencies between operations.

Do not put real credentials in `data/users.json`. Use dedicated test accounts only.

Example:

```js
const login = http.post(
  `${BASE_URL}/login`,
  JSON.stringify({ username: user.username, password: user.password }),
  { headers: { 'Content-Type': 'application/json' } },
);

const token = login.json('token');

const profile = http.get(`${BASE_URL}/profile`, {
  headers: { Authorization: 'Bearer ' + token },
});
```

### Step 7: Add business metrics

Track business outcomes separately from HTTP outcomes:

- Successful checkouts
- Failed checkouts
- Created orders
- Successful logins
- Cart completion rate
- Journey duration

Use k6 `Rate`, `Counter`, and `Trend` metrics, then add thresholds such as:

```js
thresholds: {
  checkout_success: ['rate>0.99'],
  checkout_duration: ['p(95)<1500'],
}
```

### Step 8: Add traffic models

Keep the existing smoke, load, and stress tests, then add these scenarios:

#### Baseline test

One or two virtual users for a short duration to measure normal behavior.

#### Average load test

Expected production traffic:

```text
10 minutes ramp-up
30 minutes at normal traffic
10 minutes ramp-down
```

#### Peak load test

Expected traffic during a sale, campaign, or other known peak.

#### Spike test

Rapidly increase traffic to test autoscaling, connection pools, caches, queues, and recovery:

```js
stages: [
  { duration: '1m', target: 10 },
  { duration: '10s', target: 200 },
  { duration: '2m', target: 200 },
  { duration: '10s', target: 10 },
]
```

#### Soak test

Run at normal traffic for several hours to detect memory leaks, connection leaks, queue buildup, and gradual latency degradation.

#### Breakpoint test

Increase traffic in controlled steps and record the maximum stable load, the first degradation point, the first error-rate increase, the failure point, and recovery behavior.

### Step 9: Model users and throughput separately

Use `constant-vus` when the requirement is concurrent users. Use `constant-arrival-rate` when the requirement is a known number of transactions or requests per second:

```js
export const options = {
  scenarios: {
    checkout_users: {
      executor: 'constant-arrival-rate',
      rate: 5,
      timeUnit: '1s',
      duration: '5m',
      preAllocatedVUs: 10,
      maxVUs: 50,
      exec: 'checkout',
    },
  },
};
```

Use `ramping-arrival-rate` when throughput should increase gradually.

### Step 10: Monitor the system while testing

Record k6 metrics together with application and infrastructure metrics:

- Application latency and 4xx/5xx rates
- CPU and memory
- Database CPU, slow queries, locks, and connections
- Cache hit ratio
- Queue depth
- Thread and connection pools
- Garbage collection
- Container restarts
- Network throughput
- Rate limiting

The goal is to answer both “what did the user experience?” and “which component caused the degradation?”

### Step 11: Compare performance across builds

Run a short smoke or baseline test for important pull requests, larger load tests nightly, and peak or soak tests before release:

```text
Every pull request: smoke and small baseline test
Nightly: normal load and user-journey tests
Before release: peak, spike, soak, and breakpoint tests
```

Compare p50, p95, p99, throughput, error rate, check rate, business success rate, and resource usage. Do not rely only on average response time because averages can hide tail latency.

### Recommended implementation order for this repository

1. [x] Establish a repeatable baseline test.
2. [x] Add `checks` thresholds.
3. [x] Build a realistic user journey.
4. [x] Add endpoint and journey tags.
5. [ ] Add custom business metrics.
6. [x] Add realistic users, products, payloads, and authentication.
7. [ ] Add a `constant-arrival-rate` throughput test.
8. [ ] Add spike and soak tests.
9. [ ] Connect k6 output to Grafana, Prometheus, InfluxDB, or another metrics backend.
10. [ ] Run tests against your own staging environment instead of `dummyjson.com`.
11. [ ] Add CI regression thresholds and compare results between builds.
