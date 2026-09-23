export const BASE_URL = __ENV.BASE_URL || 'https://dummyjson.com';

export const DEFAULT_HEADERS = {
  'Content-Type': 'application/json',
};

export const COMMON_THRESHOLDS = {
  http_req_duration: ['p(95)<500', 'p(99)<1000'],
  http_req_failed: ['rate<0.01'],
};
