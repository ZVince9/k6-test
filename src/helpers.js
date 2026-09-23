import { sleep } from 'k6';

export function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function wait(seconds) {
  sleep(seconds);
}

export function logIfFailure(response, label = 'request') {
  if (response.status >= 400) {
    console.log(`[${label}] status=${response.status} body=${response.body}`);
  }
}

export function randomItem(items) {
  return items[Math.floor(Math.random() * items.length)];
}
