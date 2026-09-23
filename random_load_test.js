import http from 'k6/http';
import { check, sleep } from 'k6';

// 1. CONFIGURE THE LOAD PROFILE
export const options = {
  // Load scenario: 10 virtual users for 15 seconds
  vus: 10,
  duration: '20s',

  // SLA Quality Gates (Fail test if performance drops)
  thresholds: {
    // 95% of requests must complete in under 500ms
    http_req_duration: ['p(95)<600'],
    // Error rate must stay under 1%
    http_req_failed: ['rate<0.01'],
  },
};

// Helper function to generate random integers
function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// 2. THE SCENARIO EVERY VIRTUAL USER EXECUTES
export default function () {
  // Generate a random product ID between 1 and 100
  const productId = getRandomInt(1, 100);

  // Make the dynamic API call
  const url = `https://dummyjson.com/products/${productId}`;
  const response = http.get(url);

  // If status is not 200, log the exact status code and response body
  if (response.status !== 200) {
    console.log(
      `[FAILED REQUEST] Status Code: ${response.status} | Body: ${response.body}`
    );
  }

  // Assert response validity
  check(response, {
    'status is 200': (r) => r.status === 200,
    'has product body': (r) => r.body.includes('title'),
    'response time < 500ms': (r) => r.timings.duration < 500,
    'has a product description': (r) => r.body.includes('description'),
  });

  // Pause for 1 second between requests (simulates real user think time)
  sleep(1);
}
