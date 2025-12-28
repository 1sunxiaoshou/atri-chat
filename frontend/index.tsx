import { createRoot } from 'react-dom/client';
import App from './App';
import { LanguageProvider } from './contexts/LanguageContext';
import { ASRProvider } from './contexts/ASRContext';
import { ThemeProvider } from './contexts/ThemeContext';
import './src/index.css';

const rootElement = document.getElementById('root');
if (!rootElement) {throw new Error('Failed to find the root element');}

const root = createRoot(rootElement);
root.render(
  <ThemeProvider>
    <LanguageProvider>
      <ASRProvider>
        <App />
      </ASRProvider>
    </LanguageProvider>
  </ThemeProvider>
);
