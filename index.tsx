import React from 'react';
import ReactDOM from 'react-dom/client';
// FIX: Corrected import paths to point into the 'src' directory.
import App from './src/App';
import { AppProvider } from './src/context/AppContext';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);

root.render(
  <React.StrictMode>
    <AppProvider>
      <App />
    </AppProvider>
  </React.StrictMode>
);