import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Allow Vite to read the shared stylesheet in ../../public/css
    fs: { allow: ['../..'] },
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
});
