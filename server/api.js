import http from 'node:http';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { URL } from 'node:url';

const port = Number(process.env.PORT || 3000);
const users = JSON.parse(
  await readFile(new URL('../data/users.json', import.meta.url), 'utf8'),
);

const products = Array.from({ length: 100 }, (_, index) => ({
  id: index + 1,
  title: `Test product ${index + 1}`,
  description: `Performance test product ${index + 1}`,
  price: (index + 1) * 10,
}));

const carts = new Map();
const orders = new Map();
const tokens = new Map();
let nextCartId = 1;
let nextOrderId = 1;

function sendJson(response, statusCode, body) {
  response.writeHead(statusCode, {
    'Content-Type': 'application/json',
  });
  response.end(JSON.stringify(body));
}

function readJson(request) {
  return new Promise((resolve, reject) => {
    let body = '';

    request.on('data', (chunk) => {
      body += chunk;
    });
    request.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (error) {
        reject(error);
      }
    });
    request.on('error', reject);
  });
}

function authenticatedUser(request) {
  const authorization = request.headers.authorization || '';
  const token = authorization.replace('Bearer ', '');
  return tokens.get(token);
}

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host}`);
  const path = url.pathname;

  try {
    if (request.method === 'GET' && path === '/products') {
      const limit = Number(url.searchParams.get('limit') || products.length);
      return sendJson(response, 200, {
        products: products.slice(0, Math.max(0, limit)),
        total: products.length,
        skip: 0,
        limit,
      });
    }

    const productMatch = path.match(/^\/products\/(\d+)$/);
    if (request.method === 'GET' && productMatch) {
      const product = products.find(
        (item) => item.id === Number(productMatch[1]),
      );
      return product
        ? sendJson(response, 200, product)
        : sendJson(response, 404, { message: 'Product not found' });
    }

    if (request.method === 'POST' && path === '/auth/login') {
      const body = await readJson(request);
      const user = users.find(
        (item) =>
          item.username === body.username && item.password === body.password,
      );

      if (!user) {
        return sendJson(response, 401, { message: 'Invalid credentials' });
      }

      const accessToken = randomUUID();
      tokens.set(accessToken, user);
      return sendJson(response, 200, {
        id: user.id,
        username: user.username,
        accessToken,
      });
    }

    if (request.method === 'POST' && path === '/carts/add') {
      const user = authenticatedUser(request);
      if (!user) {
        return sendJson(response, 401, { message: 'Authentication required' });
      }

      const body = await readJson(request);
      const requestedProducts = Array.isArray(body.products)
        ? body.products
        : [];
      const cartProducts = requestedProducts
        .map((item) => {
          const product = products.find((value) => value.id === item.id);
          return product
            ? {
                id: product.id,
                title: product.title,
                price: product.price,
                quantity: item.quantity || 1,
                total: product.price * (item.quantity || 1),
              }
            : null;
        })
        .filter(Boolean);

      if (cartProducts.length === 0) {
        return sendJson(response, 400, { message: 'No valid products' });
      }

      const cart = {
        id: nextCartId++,
        userId: user.id,
        products: cartProducts,
        total: cartProducts.reduce((sum, item) => sum + item.total, 0),
      };
      carts.set(cart.id, cart);
      return sendJson(response, 201, cart);
    }

    const userCartMatch = path.match(/^\/carts\/user\/(\d+)$/);
    if (request.method === 'GET' && userCartMatch) {
      const user = authenticatedUser(request);
      if (!user) {
        return sendJson(response, 401, { message: 'Authentication required' });
      }

      const userId = Number(userCartMatch[1]);
      if (user.id !== userId) {
        return sendJson(response, 403, { message: 'Forbidden' });
      }

      return sendJson(response, 200, {
        carts: [...carts.values()].filter((cart) => cart.userId === userId),
        total: carts.size,
        skip: 0,
        limit: carts.size,
      });
    }

    if (request.method === 'POST' && path === '/checkout') {
      const user = authenticatedUser(request);
      if (!user) {
        return sendJson(response, 401, { message: 'Authentication required' });
      }

      const body = await readJson(request);
      const cart = carts.get(Number(body.cartId));
      if (!cart || cart.userId !== user.id) {
        return sendJson(response, 404, { message: 'Cart not found' });
      }

      const order = {
        id: nextOrderId++,
        userId: user.id,
        cartId: cart.id,
        products: cart.products,
        total: cart.total,
        status: 'confirmed',
      };
      orders.set(order.id, order);
      return sendJson(response, 201, order);
    }

    const orderMatch = path.match(/^\/orders\/(\d+)$/);
    if (request.method === 'GET' && orderMatch) {
      const user = authenticatedUser(request);
      if (!user) {
        return sendJson(response, 401, { message: 'Authentication required' });
      }

      const order = orders.get(Number(orderMatch[1]));
      if (!order || order.userId !== user.id) {
        return sendJson(response, 404, { message: 'Order not found' });
      }

      return sendJson(response, 200, order);
    }

    return sendJson(response, 404, { message: 'Route not found' });
  } catch (error) {
    console.error(error);
    return sendJson(response, 500, { message: 'Internal server error' });
  }
});

server.listen(port, () => {
  console.log(`Local performance API listening on http://localhost:${port}`);
});
