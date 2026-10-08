import http from 'k6/http';
import { SharedArray } from 'k6/data';
import { check, sleep } from 'k6';

import {
  BASE_URL,
  COMMON_THRESHOLDS,
  DEFAULT_HEADERS,
} from '../../src/config.js';
import { randomInt, logIfFailure } from '../../src/helpers.js';

const users = new SharedArray('stress test users', () =>
  JSON.parse(open('../../data/users.json')),
);

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
  const user = users[(__VU + __ITER) % users.length];
  const loginResponse = http.post(
    `${BASE_URL}/auth/login`,
    JSON.stringify({
      username: user.username,
      password: user.password,
    }),
    {
      headers: DEFAULT_HEADERS,
    },
  );

  const loginPassed = check(loginResponse, {
    'login returns 200': (r) => r.status === 200,
    'login returns an access token and user id': (r) =>
      r.status === 200 &&
      Boolean(r.json('accessToken')) &&
      Boolean(r.json('id')),
  });
  if (!loginPassed) {
    logIfFailure(loginResponse, 'POST /auth/login', 0.05);
    sleep(0.5);
    return;
  }

  const token = loginResponse.json('accessToken');
  const userId = loginResponse.json('id');
  const productId = randomInt(1, 100);
  const payload = JSON.stringify({
    userId,
    products: [
      {
        id: productId,
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
    'cart contains an id and the selected product': (r) =>
      (r.status === 200 || r.status === 201) &&
      Boolean(r.json('id')) &&
      r.json('products.0.id') === productId,
  });

  sleep(0.5);
}
