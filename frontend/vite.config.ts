import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react-swc';

export default defineConfig(({ mode }) => {
  // 加载上级目录（项目根目录）的环境变量
  const env = loadEnv(mode, path.resolve(__dirname, '..'), '');
  const backendPort = env.VITE_BACKEND_PORT || '9099';
  const frontendPort = parseInt(env.FRONTEND_PORT || env.VITE_FRONTEND_PORT || '9900');
  const apiBaseUrl = env.VITE_API_BASE_URL || `http://localhost:${backendPort}`;
  const enableWarmup = env.VITE_ENABLE_WARMUP === 'true';

  return {
    envDir: '..', // 通知 Vite 去根目录加载注入客户端的变量
    envPrefix: ['VITE_'],
    optimizeDeps: {
      include: [
        'react',
        'react-dom/client',
        'react/jsx-runtime',
        'react-router-dom',
        'zustand',
        'zustand/middleware',
        '@tauri-apps/api/core',
        'lucide-react',
        'clsx',
        'tailwind-merge',
      ],
    },
    server: {
      port: frontendPort,
      host: '0.0.0.0',
      ...(enableWarmup
        ? {
            // Keep warmup focused on the app shell. Warming chat/VRM/markdown paths
            // defeats the existing lazy-loading strategy and slows cold starts.
            warmup: {
              clientFiles: [
                './index.tsx',
                './App.tsx',
                './contexts/LanguageContext.tsx',
                './contexts/ThemeContext.tsx',
                './components/ui/Button.tsx',
                './components/ui/Toast.tsx',
                './utils/cn.ts',
              ],
            },
          }
        : {}),
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
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules/react') || id.includes('node_modules/react-dom') || id.includes('node_modules/zustand')) {
              return 'vendor-react';
            }
            if (id.includes('node_modules/three') || id.includes('node_modules/@react-three') || id.includes('node_modules/@pixiv')) {
              return 'vendor-three';
            }
            if (id.includes('node_modules/highlight.js') || id.includes('node_modules/rehype-highlight')) {
              return 'vendor-highlight';
            }
            return undefined;
          }
        }
      }
    }
  };
});
