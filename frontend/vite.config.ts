import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // 加载上级目录（项目根目录）的环境变量
  const env = loadEnv(mode, path.resolve(__dirname, '..'), '');
  const backendPort = env.BACKEND_PORT || env.VITE_BACKEND_PORT || '9099';
  const frontendPort = parseInt(env.FRONTEND_PORT || env.VITE_FRONTEND_PORT || '9900');
  const apiBaseUrl = env.VITE_API_BASE_URL || `http://localhost:${backendPort}`;

  return {
    envDir: '..', // 通知 Vite 去根目录加载注入客户端的变量
    envPrefix: ['VITE_', 'BACKEND_PORT'], // 允许前端读取 BACKEND_PORT
    server: {
      port: frontendPort,
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
