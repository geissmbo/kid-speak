import React from 'react';

function SearchHistory({ history, clearHistory, selectHistoryItem }) {
  return (
    <div className="history-container">
      <h2>Search History</h2>
      <button onClick={clearHistory} className="danger-button">Clear history</button>
      <div id="history-list">
        {history.length === 0 ? (
          <p>Your word adventure hasn't started yet! Try searching for a word.</p>
        ) : (
          history.map((item, index) => (
            <button
              key={`${item.word}-${index}`}
              className="history-item"
              onClick={() => selectHistoryItem(item)}
            >
              <div className="history-word">{item.word}</div>
              <div>{item.definition}</div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}

export default SearchHistory;
