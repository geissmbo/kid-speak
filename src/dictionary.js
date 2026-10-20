export class DictionaryError extends Error {
  constructor(kind) {
    super(kind);
    this.kind = kind;
  }
}

export function normalizeEntries(data) {
  if (typeof data?.word !== 'string' || !Array.isArray(data.entries)) {
    throw new DictionaryError('unavailable');
  }
  if (!data.entries.length) throw new DictionaryError('not-found');
  const entries = data.entries.filter((entry) => entry.language?.code === 'en').map((entry) => ({
    word: data.word,
    phonetics: (entry.pronunciations || [])
      .filter((item) => item.type === 'ipa' && typeof item.text === 'string')
      .map((item) => ({ text: item.text, audio: '' })),
    meanings: [{
      partOfSpeech: entry.partOfSpeech || '',
      definitions: (entry.senses || [])
        .filter((sense) => typeof sense.definition === 'string' && sense.definition.trim())
        .map((sense) => ({ definition: sense.definition })),
    }],
    sourceUrls: [`https://en.wiktionary.org/wiki/${encodeURIComponent(data.word)}`],
  })).filter((entry) => entry.meanings[0].definitions.length);
  if (!entries.length) throw new DictionaryError('unavailable');
  return entries;
}

export async function fetchDictionaryEntries(word) {
  const url = `https://freedictionaryapi.com/api/v1/entries/en/${encodeURIComponent(word)}`;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    try {
      // A fresh URL on retry avoids reusing a cached error without CORS headers.
      const requestUrl = attempt ? `${url}?retry=${Date.now()}` : url;
      const response = await fetch(requestUrl, { signal: controller.signal });
      if (response.status === 404) throw new DictionaryError('not-found');
      if (!response.ok) throw new DictionaryError('unavailable');
      return normalizeEntries(await response.json());
    } catch (error) {
      if (error.kind === 'not-found') throw error;
      if (attempt === 1) throw new DictionaryError('unavailable');
    } finally {
      clearTimeout(timer);
    }
  }
}
