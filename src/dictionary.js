export class DictionaryError extends Error {
  constructor(kind) {
    super(kind);
    this.kind = kind;
  }
}

export async function fetchDictionaryEntries(word) {
  const url = `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    try {
      // A fresh URL on retry avoids reusing a cached error without CORS headers.
      const requestUrl = attempt ? `${url}?retry=${Date.now()}` : url;
      const response = await fetch(requestUrl, { signal: controller.signal });
      if (response.status === 404) throw new DictionaryError('not-found');
      if (!response.ok) throw new DictionaryError('unavailable');
      const data = await response.json();
      if (!Array.isArray(data) || !data.length || !data.every((entry) =>
        typeof entry?.word === 'string' && entry.meanings?.some((meaning) =>
          meaning.definitions?.some((item) => typeof item.definition === 'string')
        )
      )) throw new DictionaryError('unavailable');
      return data;
    } catch (error) {
      if (error.kind === 'not-found') throw error;
      if (attempt === 1) throw new DictionaryError('unavailable');
    } finally {
      clearTimeout(timer);
    }
  }
}
