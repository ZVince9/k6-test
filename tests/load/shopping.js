import {
  shoppingJourney,
  SHOPPING_THRESHOLDS,
} from '../journeys/shopping.js';

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
  thresholds: SHOPPING_THRESHOLDS,
};

export default function () {
  shoppingJourney();
}
