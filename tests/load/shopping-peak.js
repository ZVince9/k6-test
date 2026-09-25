import {
  shoppingJourney,
  SHOPPING_THRESHOLDS,
} from '../journeys/shopping.js';

export const options = {
  scenarios: {
    shopping_peak: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '5s', target: 25 },
        { duration: '15s', target: 50 },
        { duration: '5s', target: 0 },
      ],
      gracefulRampDown: '1m',
    },
  },
  thresholds: SHOPPING_THRESHOLDS,
};

export default function () {
  shoppingJourney();
}
