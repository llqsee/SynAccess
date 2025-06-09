import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

const container = document.getElementById('root');

// Ensure the container exists before creating root
if (!container) {
  throw new Error(
    'Failed to find the root element. Did you forget to add it to your index.html? Or maybe the DOM is not yet loaded?'
  );
}

const root = ReactDOM.createRoot(container);

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
); 