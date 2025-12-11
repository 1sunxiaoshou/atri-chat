import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { LanguageProvider } from './contexts/LanguageContext';
import { ASRProvider } from './contexts/ASRContext';
import { ThemeProvider } from './contexts/ThemeContext';

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Failed to find the root element');

const root = ReactDOM.createRoot(rootElement);
root.render(
  <ThemeProvider>
    <LanguageProvider>
      <ASRProvider>
        <App />
      </ASRProvider>
    </LanguageProvider>
  </ThemeProvider>
);
