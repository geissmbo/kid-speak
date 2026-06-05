import React from 'react';

const backgroundOptions = [
  { id: 'knight', name: 'Knight' },
  { id: 'stormy', name: 'Stormy' },
  { id: 'rainbow', name: 'Rainbow' },
];

function BackgroundSelector({ selectedBackground, onBackgroundChange }) {
  return (
    <section className="background-selector" aria-labelledby="theme-title">
      <h2 id="theme-title">Theme</h2>
      <div className="background-buttons">
        {backgroundOptions.map((background) => (
          <button
            key={background.id}
            className={`background-button ${selectedBackground === background.id ? 'selected' : ''}`}
            onClick={() => onBackgroundChange(background.id)}
            aria-pressed={selectedBackground === background.id}
          >
            {background.name}
          </button>
        ))}
      </div>
    </section>
  );
}

export default BackgroundSelector;
