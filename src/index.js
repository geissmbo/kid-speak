import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './components/App';
import './css/styles.css';

const root = createRoot(document.getElementById('root'));

// Render the App component
const renderApp = () => {
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
};

// Initial render
renderApp();

// Enable Hot Module Replacement (HMR)
if (module.hot) {
  module.hot.accept('./components/App', renderApp);
}

if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${process.env.PUBLIC_URL}/service-worker.js`).catch((error) => {
      console.error('Service worker registration failed:', error);
    });
  });
}
