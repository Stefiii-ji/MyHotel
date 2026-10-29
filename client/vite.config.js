import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { resolveApiBaseUrl } from './src/utils/apiBaseUrl.js';

export default defineConfig(({ command, mode }) => {
  const fileEnv = loadEnv(mode, process.cwd(), 'VITE_');
  resolveApiBaseUrl(
    process.env.VITE_API_BASE_URL ?? fileEnv.VITE_API_BASE_URL,
    command === 'serve',
  );

  return {
    plugins: [react(), tailwindcss()],
  };
});
