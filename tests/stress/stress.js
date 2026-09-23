import http from 'k6/http';
import { check, sleep } from 'k6';

import {
  BASE_URL,
  COMMON_THRESHOLDS,
  DEFAULT_HEADERS,
} from '../../src/config.js';
import { randomInt, logIfFailure, wait } from '../../src/helpers.js';

export const options = {
  scenarios: {
    stress_test: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 20 },
        { duration: '1m', target: 50 },
        { duration: '1m', target: 100 },
        { duration: '1m', target: 200 },
        { duration: '30s', target: 0 },
      ],
      gracefulRampDown: '30s',
    },
  },
  thresholds: {
    ...COMMON_THRESHOLDS,
    http_req_duration: ['p(95)<800', 'p(99)<1500'],
    http_req_failed: ['rate<0.02'],
  },
};

export default function () {
  const payload = JSON.stringify({
    userId: randomInt(1, 100),
    products: [
      {
        id: randomInt(1, 100),
        quantity: 1,
      },
    ],
  });

  const response = http.post(`${BASE_URL}/carts/add`, payload, {
    headers: DEFAULT_HEADERS,
  });

  logIfFailure(response, 'POST /carts/add');

  check(response, {
    'status is 200 or 201': (r) => r.status === 200 || r.status === 201,
    'response body contains id': (r) => r.body.includes('id'),
  });

  sleep(0.5);
}
