import React, { useEffect, useMemo, useRef, useState } from 'react';
import SearchContainer from './SearchContainer';
import SearchHistory from './SearchHistory';
import BackgroundSelector from './BackgroundSelector';

const REQUIRED_TYPING_COUNT = 3;
const HISTORY_LIMIT = 10;

const normalizeWord = (value) => value.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
const speechRecognitionSupported = () => 'SpeechRecognition' in window || 'webkitSpeechRecognition' in window;

function App() {
  const [word, setWord] = useState('');
  const [definition, setDefinition] = useState('');
  const [status, setStatus] = useState('Type a word to start your dictionary adventure.');
  const [isLoading, setIsLoading] = useState(false);
  const [typedWords, setTypedWords] = useState(() => new Set());
  const [speechEnabled, setSpeechEnabled] = useState(false);
  const [searchHistory, setSearchHistory] = useState([]);
  const [showTrophy, setShowTrophy] = useState(false);
  const [showKeepTrying, setShowKeepTrying] = useState(false);
  const [availableVoices, setAvailableVoices] = useState([]);
  const [selectedVoiceName, setSelectedVoiceName] = useState('');
  const [selectedBackground, setSelectedBackground] = useState('knight');
  const [wrongWordReported, setWrongWordReported] = useState(false);
  const [spellingSuggestions, setSpellingSuggestions] = useState([]);
  const [lastApiResponse, setLastApiResponse] = useState(null);
  const [homographOptions, setHomographOptions] = useState([]);
  const [showHelp, setShowHelp] = useState(false);
  const [lastAudioUrl, setLastAudioUrl] = useState('');
  const recognitionRef = useRef(null);

  const selectedVoice = useMemo(
    () => availableVoices.find((voice) => voice.name === selectedVoiceName) || null,
    [availableVoices, selectedVoiceName]
  );

  useEffect(() => {
    if (!('speechSynthesis' in window)) return;

    const loadVoices = () => {
      const voices = window.speechSynthesis.getVoices();
      const englishVoices = voices.filter((voice) => voice.lang.includes('en') || voice.name.includes('English'));
      const sortedVoices = (englishVoices.length > 0 ? englishVoices : voices).sort((a, b) => {
        const aAustralian = a.lang.toLowerCase().includes('en-au') || a.name.toLowerCase().includes('australia');
        const bAustralian = b.lang.toLowerCase().includes('en-au') || b.name.toLowerCase().includes('australia');
        if (aAustralian && !bAustralian) return -1;
        if (!aAustralian && bAustralian) return 1;
        return a.name.localeCompare(b.name);
      });

      setAvailableVoices(sortedVoices);
      setSelectedVoiceName((current) => current || sortedVoices[0]?.name || '');
    };

    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;

    return () => {
      window.speechSynthesis.onvoiceschanged = null;
    };
  }, []);

  useEffect(() => {
    document.body.classList.remove('bg-knight', 'bg-stormy', 'bg-rainbow');
    document.body.classList.add(`bg-${selectedBackground}`);
    localStorage.setItem('selectedBackground', selectedBackground);
  }, [selectedBackground]);

  useEffect(() => {
    if (!speechRecognitionSupported()) {
      setStatus('Speech search is not available in this browser. You can still type words and hear definitions.');
    }

    const savedHistory = localStorage.getItem('dictionaryHistory');
    if (savedHistory) {
      try {
        setSearchHistory(JSON.parse(savedHistory));
      } catch {
        localStorage.removeItem('dictionaryHistory');
      }
    }

    const savedBackground = localStorage.getItem('selectedBackground');
    if (savedBackground) setSelectedBackground(savedBackground);
  }, []);

  useEffect(() => {
    if (!showTrophy) return undefined;
    const timer = setTimeout(() => setShowTrophy(false), 4500);
    return () => clearTimeout(timer);
  }, [showTrophy]);

  useEffect(() => {
    if (!showKeepTrying) return undefined;
    const timer = setTimeout(() => setShowKeepTrying(false), 4500);
    return () => clearTimeout(timer);
  }, [showKeepTrying]);

  const addToHistory = (historyWord, meaning) => {
    setSearchHistory((currentHistory) => {
      const newHistory = [
        { word: historyWord, definition: meaning, timestamp: new Date().toISOString() },
        ...currentHistory.filter((item) => item.word !== historyWord),
      ].slice(0, HISTORY_LIMIT);

      localStorage.setItem('dictionaryHistory', JSON.stringify(newHistory));
      return newHistory;
    });
  };

  const updateSpeechProgress = (searchWord) => {
    if (speechEnabled || !speechRecognitionSupported()) return;

    setTypedWords((currentWords) => {
      const nextWords = new Set(currentWords);
      nextWords.add(searchWord);
      const remaining = Math.max(0, REQUIRED_TYPING_COUNT - nextWords.size);

      if (nextWords.size >= REQUIRED_TYPING_COUNT) {
        setSpeechEnabled(true);
        setStatus(`Great work. You typed ${REQUIRED_TYPING_COUNT} different words, so speech search is ready.`);
      } else if (currentWords.has(searchWord)) {
        setStatus(`You already tried "${searchWord}". Type ${remaining} different word${remaining === 1 ? '' : 's'} to unlock speech. (${nextWords.size}/${REQUIRED_TYPING_COUNT})`);
      } else {
        setStatus(`"${searchWord}" added. Type ${remaining} more different word${remaining === 1 ? '' : 's'} to unlock speech. (${nextWords.size}/${REQUIRED_TYPING_COUNT})`);
      }

      return nextWords;
    });
  };

  const extractEntryOption = (entry, index) => {
    const phonetic = entry.phonetic || entry.phonetics?.find((item) => item.text)?.text || '';
    const audio = entry.phonetics?.find((item) => item.audio)?.audio || '';
    const firstMeaning = entry.meanings?.[0];
    return {
      id: index,
      word: entry.word,
      phonetic,
      audio,
      definition: firstMeaning?.definitions?.[0]?.definition || 'No definition available.',
      partOfSpeech: firstMeaning?.partOfSpeech || '',
    };
  };

  const lookupWord = async (searchWord) => {
    if (!searchWord) {
      setDefinition('');
      setStatus('Please enter a word to search.');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setDefinition('');
    setLastAudioUrl('');
    setWrongWordReported(false);
    setSpellingSuggestions([]);
    setHomographOptions([]);

    try {
      const response = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${searchWord}`);
      if (!response.ok) throw new Error(`Not found (${response.status})`);

      const data = await response.json();
      setLastApiResponse(data);

      if (data.length > 1) {
        setHomographOptions(data.map(extractEntryOption));
        setStatus('This word has more than one pronunciation. Choose the one you want.');
        return;
      }

      const option = extractEntryOption(data[0], 0);
      setDefinition(`Meaning: ${option.definition}`);
      setStatus('Found the word.');
      setShowTrophy(true);
      setShowKeepTrying(false);
      setLastAudioUrl(option.audio);
      addToHistory(searchWord, option.definition);
    } catch {
      setDefinition('');
      setStatus("Couldn't find that word. Try another.");
      setShowKeepTrying(true);
      setShowTrophy(false);
    } finally {
      setIsLoading(false);
    }
  };

  const manualSearch = (searchInput) => {
    const originalWord = searchInput.trim();
    const searchWord = normalizeWord(originalWord);

    if (!searchWord) {
      setStatus('Please enter a word to search.');
      return;
    }

    setWord(`You searched: ${originalWord}`);
    updateSpeechProgress(searchWord);
    lookupWord(searchWord);
  };

  const startListening = () => {
    if (!speechRecognitionSupported()) {
      setStatus('Speech search is not available in this browser. Type a word instead.');
      return;
    }

    if (!speechEnabled) {
      const remaining = Math.max(0, REQUIRED_TYPING_COUNT - typedWords.size);
      setStatus(`Type ${remaining} different word${remaining === 1 ? '' : 's'} to unlock speech search.`);
      return;
    }

    if (!recognitionRef.current) {
      recognitionRef.current = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
    }

    const recognition = recognitionRef.current;
    recognition.lang = 'en-AU';
    recognition.interimResults = false;
    setStatus('Listening. Say one word clearly.');
    setIsLoading(false);
    setWord('');
    setDefinition('');
    recognition.start();

    recognition.onresult = (event) => {
      const spokenWord = event.results[0][0].transcript.trim().split(' ')[0];
      const searchWord = normalizeWord(spokenWord);
      setWord(`You said: ${spokenWord}`);
      setSpeechEnabled(false);
      setTypedWords(new Set());
      setStatus('Looking up the word...');
      lookupWord(searchWord);
    };

    recognition.onerror = (event) => {
      setStatus(`Speech error: ${event.error}`);
      setIsLoading(false);
    };
  };

  const clearHistory = () => {
    setSearchHistory([]);
    localStorage.removeItem('dictionaryHistory');
    setStatus('Search history cleared.');
  };

  const selectHistoryItem = (item) => {
    setWord(`You selected: ${item.word}`);
    setDefinition(`Meaning: ${item.definition}`);
    setStatus('Retrieved from history.');
    setLastAudioUrl('');
  };

  const speakWordAndDefinition = () => {
    const cleanWord = word.replace('You said: ', '').replace('You searched: ', '').replace('You selected: ', '');
    const definitionText = definition.replace('Meaning: ', '');

    if (lastAudioUrl) {
      const pronunciationAudio = new Audio(lastAudioUrl);
      setStatus('Playing pronunciation.');
      pronunciationAudio.play();
      pronunciationAudio.onended = () => speakText(definitionText);
      return;
    }

    speakText(`${cleanWord}. ${definitionText}`);
  };

  const speakText = (text) => {
    if (!('speechSynthesis' in window) || !text) {
      setStatus('Speech playback is not supported in this browser.');
      return;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.9;
    if (selectedVoice) utterance.voice = selectedVoice;
    utterance.onend = () => setStatus('Done speaking.');
    setStatus('Speaking...');
    speechSynthesis.cancel();
    speechSynthesis.speak(utterance);
  };

  const reportWrongWord = () => {
    setWrongWordReported(true);
    const currentWord = word.replace('You said: ', '').replace('You searched: ', '').replace('You selected: ', '');
    const suggestions = [];

    lastApiResponse?.forEach((entry) => {
      entry.sourceUrls?.forEach((url) => {
        const suggestion = decodeURIComponent(url.split('/').filter(Boolean).pop() || '').replace(/[#?_]/g, '').trim();
        if (suggestion && suggestion.toLowerCase() !== currentWord.toLowerCase()) suggestions.push(suggestion);
      });
    });

    setSpellingSuggestions([...new Set(suggestions)]);
    setStatus(suggestions.length ? 'Here are some other words you might be looking for.' : 'No alternatives found. Try another search.');
  };

  const selectSpellingSuggestion = (suggestion) => {
    setSpellingSuggestions([]);
    setWrongWordReported(false);
    manualSearch(suggestion);
  };

  const selectHomograph = (option) => {
    const meaning = option.partOfSpeech ? `(${option.partOfSpeech}) ${option.definition}` : option.definition;
    setHomographOptions([]);
    setDefinition(`Meaning: ${meaning}`);
    setStatus('Found the word.');
    setWord(`You selected: ${option.word}${option.phonetic ? ` (${option.phonetic})` : ''}`);
    setLastAudioUrl(option.audio);
    setShowTrophy(true);
    setShowKeepTrying(false);
    addToHistory(option.phonetic ? `${option.word} (${option.phonetic})` : option.word, option.definition);
  };

  return (
    <main className="app-shell">
      <header className="header-section">
        <div>
          <p className="eyebrow">Kid-friendly word lookup</p>
          <h1>KidSpeak Dictionary</h1>
        </div>
        <button className="secondary-button" onClick={() => setShowHelp(true)} aria-label="Show help instructions">
          Help
        </button>
      </header>

      <SearchContainer
        speechEnabled={speechEnabled}
        speechSupported={speechRecognitionSupported()}
        startListening={startListening}
        manualSearch={manualSearch}
        currentCount={typedWords.size}
        requiredCount={REQUIRED_TYPING_COUNT}
      />

      <section className="result-panel" aria-live="polite">
        <div id="status">{status}</div>
        {showTrophy && <div className="trophy-animation">Trophy!</div>}
        {showKeepTrying && <div className="keep-trying-animation">Keep trying!</div>}
        {isLoading && <div className="spinner" aria-label="Loading"></div>}
        {word && <p id="word">{word}</p>}
        {definition && <p id="definition">{definition}</p>}
      </section>

      {homographOptions.length > 0 && (
        <section className="homograph-selector">
          <h2>Choose a pronunciation</h2>
          <div className="homograph-options">
            {homographOptions.map((option) => (
              <button key={option.id} className="homograph-option" onClick={() => selectHomograph(option)}>
                <span className="homograph-title">
                  {option.word} {option.phonetic && <span className="phonetic">{option.phonetic}</span>}
                  {option.partOfSpeech && <span className="part-of-speech">({option.partOfSpeech})</span>}
                </span>
                <span className="homograph-definition">{option.definition}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {spellingSuggestions.length > 0 && (
        <section className="spelling-suggestions">
          <h2>Did you mean one of these?</h2>
          <div className="suggestion-buttons">
            {spellingSuggestions.map((suggestion) => (
              <button key={suggestion} className="suggestion-button" onClick={() => selectSpellingSuggestion(suggestion)}>
                {suggestion}
              </button>
            ))}
          </div>
          <button className="secondary-button" onClick={() => setSpellingSuggestions([])}>Close</button>
        </section>
      )}

      {word && definition && spellingSuggestions.length === 0 && (
        <section className="speak-section">
          <button className="success-button" onClick={speakWordAndDefinition} disabled={isLoading}>
            Read word aloud
          </button>
          <button className="danger-button" onClick={reportWrongWord} disabled={isLoading || wrongWordReported}>
            That is the wrong word
          </button>
          {availableVoices.length > 0 && (
            <label className="voice-selector" htmlFor="voice-select">
              Voice
              <select id="voice-select" value={selectedVoiceName} onChange={(event) => setSelectedVoiceName(event.target.value)}>
                {availableVoices.map((voice) => (
                  <option key={voice.name} value={voice.name}>{voice.name}</option>
                ))}
              </select>
            </label>
          )}
        </section>
      )}

      <SearchHistory history={searchHistory} clearHistory={clearHistory} selectHistoryItem={selectHistoryItem} />
      <BackgroundSelector selectedBackground={selectedBackground} onBackgroundChange={setSelectedBackground} />

      {showHelp && (
        <div className="help-modal" role="dialog" aria-modal="true" aria-labelledby="help-title">
          <div className="help-content">
            <button className="close-help" onClick={() => setShowHelp(false)} aria-label="Close help">x</button>
            <h2 id="help-title">How to use KidSpeak</h2>
            <div className="help-sections">
              <section>
                <h3>Text search</h3>
                <ol>
                  <li>Type one word in the search box.</li>
                  <li>Tap Search or press Enter.</li>
                  <li>Read the meaning, then tap Read word aloud if you want to hear it.</li>
                </ol>
              </section>
              <section>
                <h3>Speech search</h3>
                <ol>
                  <li>Type three different words to unlock speech search.</li>
                  <li>Tap Speak and say one word clearly.</li>
                  <li>Speech search works best in Chrome or Edge. Some iPad browsers may only support typed search.</li>
                </ol>
              </section>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

export default App;
