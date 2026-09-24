import http from 'k6/http';
import { check, sleep } from 'k6';

import { BASE_URL, COMMON_THRESHOLDS } from '../../src/config.js';

export const options = {
  vus: 1,
  duration: '30s',
  thresholds: {
    ...COMMON_THRESHOLDS,
    http_req_duration: ['p(95)<300'],
  },
};

export default function () {
  const response = http.get(`${BASE_URL}/products/1`, {
    tags: { endpoint: 'product-details' },
  });

  check(response, {
    'product details return 200': (r) => r.status === 200,
    'product details contain a title': (r) => r.body.includes('title'),
  });

  sleep(1);
}
