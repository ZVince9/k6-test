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
npm run test:baseline

# realistic shopping journey
npm run test:journey

# shopping journey under load
npm run test:load:shopping

# load test
k6 run tests/load/load.js

# stress test
k6 run tests/stress/stress.js
```

## Run the local performance API

This repository includes a small in-memory API for load testing without DummyJSON rate limits. It does not require frontend pages or a database.

`http://localhost:3000` is now the default `BASE_URL`, so all test commands target the local API unless you explicitly override it.

Start it in a separate terminal:

```bash
npm run api
```

Verify it:

```bash
curl http://localhost:3000/products
```

Then run the shopping journey against it:

```bash
npm run test:journey
npm run test:load:shopping
```

All existing k6 entrypoints can use the local API by setting `BASE_URL`:

```bash
npm run test:smoke
npm run test:baseline
npm run test:load
npm run test:stress
npm run test:load:peak
npm run test:load:soak
npm run test:stress:spike
npm run test:stress:breakpoint
```

The local API supports:

```text
GET  /products
GET  /products/:id
POST /auth/login
POST /carts/add
GET  /carts/user/:id
POST /checkout
GET  /orders/:id
```

`GET /orders/:id` requires a bearer token and an order created by `POST /checkout`; `/orders/1` will not exist immediately after restarting the API.

Data is stored in memory and resets when the API process restarts.

To target another API for a specific run:

```bash
BASE_URL=https://your-staging-api.example.com npm run test:journey
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
npm run test:journey
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

### Step 7: Add business metrics — Implemented

The shopping journey now records business outcomes separately from HTTP outcomes:

- Successful checkouts
- Successful logins
- Cart completion rate
- Created simulated orders
- Journey duration

The metrics are:

```js
login_success
cart_completion
checkout_success
orders_created
shopping_journey_duration
```

The journey profile applies thresholds such as:

```js
thresholds: {
  login_success: ['rate>0.99'],
  cart_completion: ['rate>0.99'],
  checkout_success: ['rate>0.99'],
  shopping_journey_duration: ['p(95)<2500'],
}
```

### Step 8: Add traffic models — Implemented

The same shopping journey now has separate runnable traffic profiles:

| Profile | Command | Purpose |
|---|---|---|
| Average load | `npm run test:load:shopping` | Expected traffic ramp |
| Peak load | `npm run test:load:peak` | Sustained high traffic |
| Spike | `npm run test:stress:spike` | Sudden traffic increase and recovery |
| Soak | `npm run test:load:soak` | Long-running stability test |
| Breakpoint | `npm run test:stress:breakpoint` | Increase load in steps to find capacity |

The profiles reuse the same journey but change only the traffic model and, for stress tests, the acceptable failure thresholds. Run them against a controlled staging or performance environment rather than a public shared API.

For a quick validation without running a full profile:

```bash
k6 run --duration 2s tests/stress/shopping-spike.js
```

### Step 9: Model users and throughput separately

Use `constant-vus` when the requirement is concurrent users. Use `constant-arrival-rate` when the requirement is a known number of transactions or requests per second:

```js
npm run test:load:throughput
```

This profile starts two complete shopping journeys per second for one minute. It pre-allocates 10 virtual users, can scale to 50, and fails if k6 has to drop an iteration because it cannot start it on time. Tune the rate and VU limits for the target system; a journey is a sequence of requests, not one request.

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

This repository does not include an application metrics backend or infrastructure dashboards. When testing a deployed service, open its existing monitoring dashboards during the run and correlate the k6 run time with application, database, cache, queue, and host/container metrics. To save k6 time-series locally for later analysis:

```bash
mkdir -p results
k6 run --out json=results/throughput-metrics.json tests/load/shopping-throughput.js
```

Use the k6 output backend supported by your observability stack when you want live dashboards; configure that backend separately rather than treating k6 response metrics as a substitute for server-side telemetry.

### Step 11: Compare performance across builds

Run a short smoke or baseline test for important pull requests, larger load tests nightly, and peak or soak tests before release:

```text
Every pull request: smoke and small baseline test
Nightly: normal load and user-journey tests
Before release: peak, spike, soak, and breakpoint tests
```

Compare p50, p95, p99, throughput, error rate, check rate, business success rate, and resource usage. Do not rely only on average response time because averages can hide tail latency.

The GitHub Actions workflow in `.github/workflows/performance.yml` runs smoke and baseline tests when a pull request is opened. It does not run on later pushes to that pull request or on a schedule. You can also start it manually from the GitHub Actions tab using **Run workflow**; manual runs execute the same smoke and baseline tests. It uploads the k6 summary JSON as an artifact named with the commit SHA and run ID. The existing k6 thresholds also gate results against the configured latency and success targets.

By default CI uses the included local API. To test a deployed staging API instead, set the repository Actions variable `K6_BASE_URL` to its base URL and ensure it provides the API routes and test accounts expected by this project. Keep heavier peak, spike, soak, and breakpoint runs for a controlled environment and run them manually or before a release.

### Recommended implementation order for this repository

1. [x] Establish a repeatable baseline test.
2. [x] Add `checks` thresholds.
3. [x] Build a realistic user journey.
4. [x] Add endpoint and journey tags.
5. [x] Add custom business metrics.
6. [x] Add realistic users, products, payloads, and authentication.
7. [x] Add peak, spike, soak, and breakpoint traffic profiles.
8. [x] Add a `constant-arrival-rate` throughput test.
9. [ ] Connect k6 output and application telemetry to Grafana, Prometheus, InfluxDB, or another metrics backend.
10. [ ] Configure a staging API and representative test accounts for automated runs.
11. [x] Add CI performance thresholds and retain summaries for comparison between builds.
