import { fetchDictionaryEntries, normalizeEntries } from './dictionary';

const payload = {
  word: 'dog',
  entries: [{ language: { code: 'en' }, partOfSpeech: 'noun',
    pronunciations: [{ type: 'ipa', text: '/dɒɡ/' }],
    senses: [{ definition: 'A domestic animal.' }] }],
};
const entries = [{ word: 'dog', phonetics: [{ text: '/dɒɡ/', audio: '' }],
  meanings: [{ partOfSpeech: 'noun', definitions: [{ definition: 'A domestic animal.' }] }],
  sourceUrls: ['https://en.wiktionary.org/wiki/dog'] }];
const success = () => ({ ok: true, status: 200, json: async () => payload });
const originalFetch = global.fetch;

beforeEach(() => { global.fetch = jest.fn(); });
afterEach(() => { global.fetch = originalFetch; jest.useRealTimers(); });

test('returns dictionary entries on success', async () => {
  fetch.mockResolvedValue(success());
  await expect(fetchDictionaryEntries('dog')).resolves.toEqual(entries);
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(fetch.mock.calls[0][0]).toBe('https://freedictionaryapi.com/api/v1/entries/en/dog');
});

test('keeps distinct meanings and handles entries without pronunciations', () => {
  const data = { word: 'test', entries: [
    { language: { code: 'en' }, partOfSpeech: 'noun', senses: [{ definition: 'A trial.' }] },
    { language: { code: 'en' }, partOfSpeech: 'verb', senses: [{ definition: 'To examine.' }] },
  ] };
  expect(normalizeEntries(data).map((entry) => entry.meanings[0].partOfSpeech)).toEqual(['noun', 'verb']);
  expect(normalizeEntries(data)[0].phonetics).toEqual([]);
});

test('reports a valid empty entry list as missing without retrying', async () => {
  fetch.mockResolvedValue({ ok: true, status: 200, json: async () => ({ word: 'zzzz', entries: [] }) });
  await expect(fetchDictionaryEntries('zzzz')).rejects.toMatchObject({ kind: 'not-found' });
  expect(fetch).toHaveBeenCalledTimes(1);
});

test('retries a browser CORS/network failure with a fresh URL', async () => {
  fetch.mockRejectedValueOnce(new TypeError('Failed to fetch')).mockResolvedValueOnce(success());
  await expect(fetchDictionaryEntries('dog')).resolves.toEqual(entries);
  expect(fetch.mock.calls[1][0]).toMatch(/\/dog\?retry=\d+$/);
});

test('reports an actual missing word without retrying', async () => {
  fetch.mockResolvedValue({ ok: false, status: 404 });
  await expect(fetchDictionaryEntries('zzzz')).rejects.toMatchObject({ kind: 'not-found' });
  expect(fetch).toHaveBeenCalledTimes(1);
});

test.each([
  { ok: false, status: 522 },
  { ok: true, status: 200, json: async () => { throw new SyntaxError('HTML instead of JSON'); } },
  { ok: true, status: 200, json: async () => [] },
])('reports failed or invalid responses as service outages', async (response) => {
  fetch.mockResolvedValue(response);
  await expect(fetchDictionaryEntries('dog')).rejects.toMatchObject({ kind: 'unavailable' });
  expect(fetch).toHaveBeenCalledTimes(2);
});

test('bounds waiting when both requests hang', async () => {
  jest.useFakeTimers();
  fetch.mockImplementation((url, { signal }) => new Promise((resolve, reject) => {
    signal.addEventListener('abort', () => reject(new Error('Aborted')));
  }));
  const result = expect(fetchDictionaryEntries('dog')).rejects.toMatchObject({ kind: 'unavailable' });
  jest.advanceTimersByTime(8000);
  await Promise.resolve();
  jest.advanceTimersByTime(8000);
  await result;
  expect(fetch).toHaveBeenCalledTimes(2);
});
