import http from 'k6/http';
import { check } from 'k6';

import {
  BASE_URL,
  COMMON_THRESHOLDS,
  DEFAULT_HEADERS,
} from '../../src/config.js';
import { randomInt, logIfFailure, wait } from '../../src/helpers.js';

export const options = {
  scenarios: {
    load_test: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 10 },
        { duration: '2m', target: 25 },
        { duration: '3m', target: 50 },
        { duration: '1m', target: 25 },
        { duration: '30s', target: 0 },
      ],
      gracefulRampDown: '30s',
    },
  },
  thresholds: {
    ...COMMON_THRESHOLDS,
    http_req_duration: ['p(95)<600', 'p(99)<1000'],
  },
};

export default function () {
  const productId = randomInt(1, 100);
  const response = http.get(`${BASE_URL}/products/${productId}`, {
    headers: DEFAULT_HEADERS,
  });

  logIfFailure(response, 'GET /products/{id}');

  check(response, {
    'status is 200': (r) => r.status === 200,
    'has product title': (r) => r.body.includes('title'),
    'has product description': (r) => r.body.includes('description'),
  });

  wait(1);
}
