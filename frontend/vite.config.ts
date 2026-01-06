import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    const apiBaseUrl = env.VITE_API_BASE_URL || 'http://localhost:8000';
    
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
        proxy: {
          '/api': {
            target: apiBaseUrl,
            changeOrigin: true,
          },
          '/uploads': {
            target: apiBaseUrl,
            changeOrigin: true,
          },
          '/static': {
            target: apiBaseUrl,
            changeOrigin: true,
          }
        }
      },
      plugins: [react()],
      define: {
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
