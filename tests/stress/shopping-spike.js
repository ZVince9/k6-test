import {
  shoppingJourney,
  SHOPPING_THRESHOLDS,
} from '../journeys/shopping.js';

export const options = {
  scenarios: {
    shopping_spike: {
      executor: 'ramping-vus',
      startVUs: 1,
      stages: [
        { duration: '1m', target: 10 },
        { duration: '10s', target: 100 },
        { duration: '2m', target: 100 },
        { duration: '10s', target: 10 },
        { duration: '1m', target: 0 },
      ],
      gracefulRampDown: '1m',
    },
  },
  thresholds: {
    ...SHOPPING_THRESHOLDS,
    checks: ['rate>0.95'],
    http_req_failed: ['rate<0.05'],
  },
};

export default function () {
  shoppingJourney();
}
