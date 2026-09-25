import {
  shoppingJourney,
  SHOPPING_THRESHOLDS,
} from '../journeys/shopping.js';

export const options = {
  scenarios: {
    shopping_soak: {
      executor: 'constant-vus',
      vus: 10,
      duration: '2h',
    },
  },
  thresholds: SHOPPING_THRESHOLDS,
};

export default function () {
  shoppingJourney();
}
