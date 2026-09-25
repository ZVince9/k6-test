import http from 'k6/http';
import { check, sleep } from 'k6';

import {
  BASE_URL,
  COMMON_THRESHOLDS,
  DEFAULT_HEADERS,
} from '../../src/config.js';
import { randomInt, logIfFailure } from '../../src/helpers.js';

export const options = {
  scenarios: {
    stress_test: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '5s', target: 20 },
        { duration: '5s', target: 50 },
        { duration: '5s', target: 100 },
        { duration: '10s', target: 200 },
        { duration: '10s', target: 0 },
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
  const loginResponse = http.post(
    `${BASE_URL}/auth/login`,
    JSON.stringify({
      username: 'emilys',
      password: 'emilyspass',
    }),
    {
      headers: DEFAULT_HEADERS,
    },
  );

  const token = loginResponse.json('accessToken');
  const userId = loginResponse.json('id');
  const payload = JSON.stringify({
    userId,
    products: [
      {
        id: randomInt(1, 100),
        quantity: 1,
      },
    ],
  });

  const response = http.post(`${BASE_URL}/carts/add`, payload, {
    headers: {
      ...DEFAULT_HEADERS,
      Authorization: `Bearer ${token}`,
    },
  });

  logIfFailure(response, 'POST /carts/add', 0.05);

  check(response, {
    'status is 200 or 201': (r) => r.status === 200 || r.status === 201,
    'response body contains id': (r) => r.body.includes('id'),
  });

  sleep(0.5);
}
