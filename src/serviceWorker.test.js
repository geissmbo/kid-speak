/** @jest-environment node */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

let handlers;
let cache;
let context;
beforeEach(() => {
  handlers = {};
  cache = { put: jest.fn() };
  context = {
    URL,
    self: {
      location: { origin: 'https://geissmbo.github.io' },
      registration: { scope: 'https://geissmbo.github.io/kid-speak/' },
      addEventListener: (type, handler) => { handlers[type] = handler; },
    },
    fetch: jest.fn().mockRejectedValue(new Error('Offline')),
    caches: { match: jest.fn(), open: jest.fn().mockResolvedValue(cache) },
    Response: { error: () => 'network-error' },
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../public/service-worker.js'), 'utf8'), context);
});

const eventFor = (url, mode = 'cors') => ({
  request: { method: 'GET', url, mode },
  respondWith: jest.fn(), waitUntil: jest.fn(),
});

test('does not intercept dictionary requests or other apps on the same host', () => {
  for (const url of ['https://api.dictionaryapi.dev/api/v2/entries/en/dog', 'https://geissmbo.github.io/other/']) {
    const event = eventFor(url);
    handlers.fetch(event);
    expect(event.respondWith).not.toHaveBeenCalled();
  }
});

test('uses the offline shell only for navigation', async () => {
  context.caches.match.mockImplementation(async (key) => key === './index.html' ? 'shell' : undefined);
  const navigation = eventFor('https://geissmbo.github.io/kid-speak/', 'navigate');
  handlers.fetch(navigation);
  await expect(navigation.respondWith.mock.calls[0][0]).resolves.toBe('shell');
  const asset = eventFor('https://geissmbo.github.io/kid-speak/missing.js');
  handlers.fetch(asset);
  await expect(asset.respondWith.mock.calls[0][0]).resolves.toBe('network-error');
});

test('does not cache failed HTTP responses', async () => {
  const response = { ok: false, status: 503 };
  context.fetch.mockResolvedValue(response);
  const event = eventFor('https://geissmbo.github.io/kid-speak/');
  handlers.fetch(event);
  await expect(event.respondWith.mock.calls[0][0]).resolves.toBe(response);
  expect(cache.put).not.toHaveBeenCalled();
});
