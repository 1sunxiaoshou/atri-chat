import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import App from './App';
import { BootstrapGate } from './BootstrapGate';
import StyleGuide from './pages/StyleGuide';
import { LanguageProvider } from './contexts/LanguageContext';
import { ThemeProvider } from './contexts/ThemeContext';
import './src/index.css';

const rootElement = document.getElementById('root');
if (!rootElement) { throw new Error('Failed to find the root element'); }

const root = createRoot(rootElement);
root.render(
  <ThemeProvider>
    <LanguageProvider>
      <BootstrapGate>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<App />} />
            <Route path="/style-guide" element={<StyleGuide />} />
          </Routes>
        </BrowserRouter>
      </BootstrapGate>
    </LanguageProvider>
  </ThemeProvider>
);
