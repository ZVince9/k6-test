import http from 'k6/http';
import { SharedArray } from 'k6/data';
import { check, group, sleep } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';

import {
  BASE_URL,
  COMMON_THRESHOLDS,
  DEFAULT_HEADERS,
} from '../../src/config.js';
import { logIfFailure, randomInt, randomItem } from '../../src/helpers.js';

const users = new SharedArray('shopping users', () =>
  JSON.parse(open('../../data/users.json')),
);

export const loginSuccess = new Rate('login_success');
export const cartCompletion = new Rate('cart_completion');
export const checkoutSuccess = new Rate('checkout_success');
export const ordersCreated = new Counter('orders_created');
export const journeyDuration = new Trend('shopping_journey_duration');

export function shoppingJourney() {
  const journeyStart = Date.now();
  const user = users[(__VU + __ITER) % users.length];
  let productId;
  let userId;
  let token;
  let cartId;
  let orderId;

  group('1. browse products', () => {
    const response = http.get(`${BASE_URL}/products?limit=10`, {
      headers: DEFAULT_HEADERS,
      tags: { endpoint: 'products', journey: 'shopping' },
    });

    logIfFailure(response, 'GET /products', 0.1);

    check(response, {
      'product list returns 200': (r) => r.status === 200,
      'product list contains products': (r) =>
        r.status === 200 &&
        Array.isArray(r.json('products')) &&
        r.json('products').length > 0,
    });

    const products =
      response.status === 200 ? response.json('products') : null;
    if (Array.isArray(products) && products.length > 0) {
      productId = randomItem(products).id;
    }
  });

  if (!productId) {
    journeyDuration.add(Date.now() - journeyStart);
    sleep(1);
    return;
  }

  group('2. view product details', () => {
    const response = http.get(`${BASE_URL}/products/${productId}`, {
      headers: DEFAULT_HEADERS,
      tags: { endpoint: 'product-details', journey: 'shopping' },
    });

    logIfFailure(response, 'GET /products/{id}', 0.1);

    check(response, {
      'product details return 200': (r) => r.status === 200,
      'product details contain a title': (r) =>
        r.status === 200 && Boolean(r.json('title')),
    });
  });

  group('3. log in', () => {
    const response = http.post(
      `${BASE_URL}/auth/login`,
      JSON.stringify({
        username: user.username,
        password: user.password,
      }),
      {
        headers: DEFAULT_HEADERS,
        tags: { endpoint: 'login', journey: 'shopping' },
      },
    );

    logIfFailure(response, 'POST /auth/login', 0.1);

    const loginPassed = check(response, {
      'login returns 200': (r) => r.status === 200,
      'login returns an access token': (r) =>
        r.status === 200 && Boolean(r.json('accessToken')),
    });
    loginSuccess.add(loginPassed);

    if (response.status === 200) {
      token = response.json('accessToken');
      userId = response.json('id');
    }
  });

  if (!token || !userId) {
    journeyDuration.add(Date.now() - journeyStart);
    sleep(1);
    return;
  }

  const authHeaders = {
    ...DEFAULT_HEADERS,
    Authorization: `Bearer ${token}`,
  };

  group('4. add product to cart', () => {
    const response = http.post(
      `${BASE_URL}/carts/add`,
      JSON.stringify({
        userId,
        products: [{ id: productId, quantity: randomInt(1, 3) }],
      }),
      {
        headers: authHeaders,
        tags: { endpoint: 'cart-add', journey: 'shopping' },
      },
    );

    logIfFailure(response, 'POST /carts/add', 0.1);

    const cartPassed = check(response, {
      'cart is created': (r) => r.status === 200 || r.status === 201,
      'cart contains an id': (r) =>
        (r.status === 200 || r.status === 201) && Boolean(r.json('id')),
      'cart contains the selected product': (r) =>
        (r.status === 200 || r.status === 201) &&
        r.json('products.0.id') === productId,
    });
    cartCompletion.add(cartPassed);

    if (response.status === 200 || response.status === 201) {
      cartId = response.json('id');
    }
  });

  if (!cartId) {
    journeyDuration.add(Date.now() - journeyStart);
    sleep(1);
    return;
  }

  group('5. view cart', () => {
    const response = http.get(`${BASE_URL}/carts/user/${userId}`, {
      headers: authHeaders,
      tags: { endpoint: 'cart-view', journey: 'shopping' },
    });

    logIfFailure(response, 'GET /carts/user/{id}', 0.1);

    check(response, {
      'user carts return 200': (r) => r.status === 200,
      'user carts contain carts': (r) =>
        r.status === 200 &&
        Array.isArray(r.json('carts')) &&
        r.json('carts').length > 0,
    });
  });

  group('6. checkout', () => {
    const response = http.post(
      `${BASE_URL}/checkout`,
      JSON.stringify({ cartId }),
      {
        headers: authHeaders,
        tags: { endpoint: 'checkout', journey: 'shopping' },
      },
    );

    logIfFailure(response, 'POST /checkout', 0.1);

    const checkoutPassed = check(response, {
      'checkout returns 201': (r) => r.status === 201,
      'checkout returns an order id': (r) =>
        r.status === 201 && Boolean(r.json('id')),
      'checkout references the cart': (r) =>
        r.status === 201 && r.json('cartId') === cartId,
    });
    checkoutSuccess.add(checkoutPassed);
    if (checkoutPassed) {
      ordersCreated.add(1);
      orderId = response.json('id');
    }
  });

  group('7. verify order', () => {
    const response = http.get(`${BASE_URL}/orders/${orderId}`, {
      headers: authHeaders,
      tags: { endpoint: 'order-view', journey: 'shopping' },
    });

    logIfFailure(response, 'GET /orders/{id}', 0.1);

    check(response, {
      'order returns 200': (r) => r.status === 200,
      'order references the cart': (r) =>
        r.status === 200 && r.json('cartId') === cartId,
      'order contains the selected product': (r) =>
        r.status === 200 && r.json('products.0.id') === productId,
    });
  });

  journeyDuration.add(Date.now() - journeyStart);
  sleep(1);
}

export const SHOPPING_THRESHOLDS = {
  ...COMMON_THRESHOLDS,
  http_req_duration: ['p(95)<1000', 'p(99)<1500'],
  'http_req_duration{endpoint:products}': ['p(95)<400'],
  'http_req_duration{endpoint:product-details}': ['p(95)<400'],
  'http_req_duration{endpoint:login}': ['p(95)<800'],
  'http_req_duration{endpoint:cart-add}': ['p(95)<800'],
  'http_req_duration{endpoint:cart-view}': ['p(95)<800'],
  'http_req_duration{endpoint:checkout}': ['p(95)<800'],
  'http_req_duration{endpoint:order-view}': ['p(95)<800'],
  login_success: ['rate>0.99'],
  cart_completion: ['rate>0.99'],
  checkout_success: ['rate>0.99'],
  shopping_journey_duration: ['p(95)<2500'],
};

export const options = {
  vus: 1,
  duration: '30s',
  thresholds: SHOPPING_THRESHOLDS,
};

export default function () {
  shoppingJourney();
}
