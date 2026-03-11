import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import App from './App';
import StyleGuide from './pages/StyleGuide';
import { LanguageProvider } from './contexts/LanguageContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { initApiConfig } from './utils/constants';
import './src/index.css';

async function bootstrap() {
  const rootElement = document.getElementById('root');
  if (!rootElement) { throw new Error('Failed to find the root element'); }

  // 必须等待后端动态端口解析并注册完成
  await initApiConfig();

  const root = createRoot(rootElement);
  root.render(
    <ThemeProvider>
      <LanguageProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<App />} />
            <Route path="/style-guide" element={<StyleGuide />} />
          </Routes>
        </BrowserRouter>
      </LanguageProvider>
    </ThemeProvider>
  );
}

bootstrap();
