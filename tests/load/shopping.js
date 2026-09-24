import { shoppingJourney } from '../journeys/shopping.js';

export const options = {
  scenarios: {
    shopping_load: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '3s', target: 1 },
        { duration: '5s', target: 5 },
        { duration: '7s', target: 10 },
        { duration: '5s', target: 0 },
      ],
      gracefulRampDown: '30s',
    },
  },
  thresholds: {
    checks: ['rate>0.99'],
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<1000', 'p(99)<1500'],
  },
};

export default function () {
  shoppingJourney();
}
