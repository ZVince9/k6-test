import http from 'k6/http';
import { check, sleep } from 'k6';
import exec from 'k6/execution'; // Import k6 execution context

// Change this configuration depending on whether you want to run Scenario A or B
export const options = {
  // SCENARIO A: LOAD TEST PROFILE (Default active)
  //   stages: [
  //     { duration: '10s', target: 10 }, // Ramp-up from 0 to 10 VUs
  //     { duration: '30s', target: 10 }, // Stay at 10 VUs (Normal expected load)
  //     { duration: '5s', target: 0 },   // Ramp-down back to 0 VUs
  //   ],

  // SCENARIO B: STRESS TEST PROFILE
  stages: [
    { duration: '10s', target: 10 }, // Level 1: Baseline (10 VUs)
    { duration: '15s', target: 10 },
    { duration: '10s', target: 50 }, // Level 2: Heavy Load (50 VUs)
    { duration: '15s', target: 50 },
    { duration: '10s', target: 100 }, // Level 3: Extreme Stress (100 VUs)
    { duration: '15s', target: 100 },
    { duration: '10s', target: 0 }, // Ramp-down
  ],

  // Quality Gates / SLAs
  thresholds: {
    http_req_duration: ['p(95)<300'], // 95% of requests must complete under 300ms
    http_req_failed: ['rate<0.01'], // Errors must stay below 1%
  },
};

export default function () {
  // Target Endpoint
  const url = 'https://dummyjson.com/carts/add';

  // Payment Payload Simulation
  const payload = JSON.stringify({
    userId: Math.floor(Math.random() * 100) + 1,
    products: [
      {
        id: Math.floor(Math.random() * 100) + 1,
        quantity: 1,
      },
    ],
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
    },
  };

  const response = http.post(url, payload, params);

// Example: Only log 5% of failures to keep logs clean
if (response.status !== 200 && response.status !== 201) {
  if (Math.random() < 0.05) {
    console.log(
      `[FAILED REQUEST Sample] Active VUs: ${exec.instance.vusActive} | Status: ${response.status}`
    );
  }
}

  check(response, {
    'status is 200 or 201': (r) => r.status === 200 || r.status === 201,
    'latency < 300ms': (r) => r.timings.duration < 300,
  });

  sleep(1); // 1-second think time between requests
}
