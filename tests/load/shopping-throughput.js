import {
  shoppingJourney,
  SHOPPING_THRESHOLDS,
} from '../journeys/shopping.js';

export const options = {
  scenarios: {
    shopping_throughput: {
      executor: 'constant-arrival-rate',
      rate: 2,
      timeUnit: '1s',
      duration: '1m',
      preAllocatedVUs: 10,
      maxVUs: 50,
      exec: 'runShoppingJourney',
    },
  },
  thresholds: {
    ...SHOPPING_THRESHOLDS,
    dropped_iterations: ['count==0'],
  },
};

export function runShoppingJourney() {
  shoppingJourney();
}
