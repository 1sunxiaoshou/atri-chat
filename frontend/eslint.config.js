import js from '@eslint/js';
import typescript from '@typescript-eslint/eslint-plugin';
import typescriptParser from '@typescript-eslint/parser';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';

export default [
  js.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parser: typescriptParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: {
          jsx: true,
        },
      },
      globals: {
        // Browser globals
        window: 'readonly',
        document: 'readonly',
        navigator: 'readonly',
        localStorage: 'readonly',
        sessionStorage: 'readonly',
        fetch: 'readonly',
        console: 'readonly',
        alert: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        requestAnimationFrame: 'readonly',
        cancelAnimationFrame: 'readonly',
        // Browser APIs
        HTMLElement: 'readonly',
        HTMLDivElement: 'readonly',
        HTMLInputElement: 'readonly',
        HTMLTextAreaElement: 'readonly',
        HTMLButtonElement: 'readonly',
        HTMLCanvasElement: 'readonly',
        MouseEvent: 'readonly',
        Node: 'readonly',
        File: 'readonly',
        Blob: 'readonly',
        FileReader: 'readonly',
        FormData: 'readonly',
        URL: 'readonly',
        Response: 'readonly',
        RequestInit: 'readonly',
        ReadableStream: 'readonly',
        TextDecoder: 'readonly',
        // Audio APIs
        AudioContext: 'readonly',
        GainNode: 'readonly',
        AudioBufferSourceNode: 'readonly',
        AnalyserNode: 'readonly',
        MediaRecorder: 'readonly',
        MediaStream: 'readonly',
        // Other
        ResizeObserver: 'readonly',
        // Node.js (for scripts)
        process: 'readonly',
      },
    },
    plugins: {
      '@typescript-eslint': typescript,
      'react': react,
      'react-hooks': reactHooks,
    },
    settings: {
      react: {
        version: 'detect',
      },
    },
    rules: {
      // TypeScript 规则
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-non-null-assertion': 'warn',

      // React 规则
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',

      // 通用规则
      'no-unused-vars': 'off',
      'no-console': 'warn',
      'no-debugger': 'error',
      'no-magic-numbers': [
        'warn',
        {
          ignore: [0, 1, -1, 2],
          ignoreArrayIndexes: true,
          ignoreDefaultValues: true,
          enforceConst: true,
        },
      ],
      'prefer-const': 'error',
      'no-var': 'error',
      'eqeqeq': ['error', 'always'],
      'curly': ['error', 'all'],
      'no-duplicate-imports': 'error',
    },
  },
  {
    ignores: ['dist/**', 'node_modules/**', '*.config.js', '*.config.ts'],
  },
];
