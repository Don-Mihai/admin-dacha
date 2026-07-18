import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: { outDir: 'build' },
  server: {
    port: 5174,
    proxy: {
      '/api': { target: 'http://localhost:3333', changeOrigin: true },
      '/graphql': { target: 'http://localhost:3333', changeOrigin: true },
    },
  },
});
