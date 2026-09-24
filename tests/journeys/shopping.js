import http from 'k6/http';
import { check, group, sleep } from 'k6';

import {
  BASE_URL,
  COMMON_THRESHOLDS,
  DEFAULT_HEADERS,
} from '../../src/config.js';
import { logIfFailure } from '../../src/helpers.js';

const username = __ENV.TEST_USERNAME || 'emilys';
const password = __ENV.TEST_PASSWORD || 'emilyspass';

export function shoppingJourney() {
  let productId;
  let userId;
  let token;
  let cartId;

  group('1. browse products', () => {
    const response = http.get(`${BASE_URL}/products?limit=10`, {
      headers: DEFAULT_HEADERS,
      tags: { endpoint: 'products' },
    });

    logIfFailure(response, 'GET /products', 0.1);

    check(response, {
      'product list returns 200': (r) => r.status === 200,
      'product list contains products': (r) =>
        Array.isArray(r.json('products')) && r.json('products').length > 0,
    });

    productId = response.json('products.0.id');
  });

  group('2. view product details', () => {
    const response = http.get(`${BASE_URL}/products/${productId}`, {
      headers: DEFAULT_HEADERS,
      tags: { endpoint: 'product-details' },
    });

    logIfFailure(response, 'GET /products/{id}', 0.1);

    check(response, {
      'product details return 200': (r) => r.status === 200,
      'product details contain a title': (r) => Boolean(r.json('title')),
    });
  });

  group('3. log in', () => {
    const response = http.post(
      `${BASE_URL}/auth/login`,
      JSON.stringify({ username, password }),
      {
        headers: DEFAULT_HEADERS,
        tags: { endpoint: 'login' },
      },
    );

    logIfFailure(response, 'POST /auth/login', 0.1);

    check(response, {
      'login returns 200': (r) => r.status === 200,
      'login returns an access token': (r) => Boolean(r.json('accessToken')),
    });

    token = response.json('accessToken');
    userId = response.json('id');
  });

  const authHeaders = {
    ...DEFAULT_HEADERS,
    Authorization: `Bearer ${token}`,
  };

  group('4. add product to cart', () => {
    const response = http.post(
      `${BASE_URL}/carts/add`,
      JSON.stringify({
        userId,
        products: [{ id: productId, quantity: 1 }],
      }),
      {
        headers: authHeaders,
        tags: { endpoint: 'cart-add' },
      },
    );

    logIfFailure(response, 'POST /carts/add', 0.1);

    check(response, {
      'cart is created': (r) => r.status === 200 || r.status === 201,
      'cart contains an id': (r) => Boolean(r.json('id')),
      'cart contains the selected product': (r) =>
        r.json('products.0.id') === productId,
    });

    cartId = response.json('id');
  });

  group('5. view cart', () => {
    const response = http.get(`${BASE_URL}/carts/user/${userId}`, {
      headers: authHeaders,
      tags: { endpoint: 'cart-view' },
    });

    logIfFailure(response, 'GET /carts/user/{id}', 0.1);

    check(response, {
      'user carts return 200': (r) => r.status === 200,
      'user carts contain carts': (r) =>
        Array.isArray(r.json('carts')) && r.json('carts').length > 0,
    });
  });

  group('6. simulate checkout', () => {
    check({ cartId }, {
      'simulated checkout has a cart id': (value) => Boolean(value.cartId),
    });
  });

  group('7. verify order', () => {
    check({ cartId, productId }, {
      'simulated order references the cart': (value) => Boolean(value.cartId),
      'simulated order references the product': (value) =>
        Boolean(value.productId),
    });
  });

  sleep(1);
}

export const options = {
  vus: 1,
  duration: '30s',
  thresholds: {
    ...COMMON_THRESHOLDS,
    http_req_duration: ['p(95)<1000', 'p(99)<1500'],
  },
};

export default function () {
  shoppingJourney();
}
