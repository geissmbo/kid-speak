import React, { useState } from 'react';

function SearchContainer({ speechEnabled, speechSupported, currentCount, requiredCount, startListening, manualSearch }) {
  const [searchInput, setSearchInput] = useState('');
  const remainingCount = Math.max(0, requiredCount - currentCount);

  const handleSearch = () => {
    manualSearch(searchInput);
    setSearchInput('');
  };

  return (
    <section className="search-card" aria-label="Dictionary search">
      <button
        onClick={startListening}
        className="primary-button start-speaking-btn"
        disabled={!speechSupported || !speechEnabled}
      >
        Speak
      </button>

      <div className="manual-search">
        <label className="search-label" htmlFor="search-input">Word</label>
        <input
          type="text"
          id="search-input"
          placeholder="Type a word"
          value={searchInput}
          autoComplete="off"
          autoCapitalize="none"
          spellCheck="false"
          onChange={(event) => setSearchInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') handleSearch();
          }}
        />
        <button className="primary-button" onClick={handleSearch}>Search</button>
      </div>

      <p className="speech-progress">
        {speechSupported
          ? speechEnabled
            ? 'Speech search is ready for one word.'
            : `Type ${remainingCount} different word${remainingCount === 1 ? '' : 's'} to unlock speech.`
          : 'Speech search is not available in this browser.'}
      </p>
    </section>
  );
}

export default SearchContainer;
