import { defineConfig } from 'vite';
import { fileURLToPath, URL } from 'node:url';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// `base` targets a GitHub Pages project site (https://<user>.github.io/edite/).
// For the future custom domain (edite.video) set base to '/' and add a CNAME file.
export default defineConfig({
  base: '/edite/',
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  optimizeDeps: {
    // ffmpeg.wasm spawns its own worker / loads wasm; keep it out of pre-bundling.
    exclude: ['@ffmpeg/ffmpeg', '@ffmpeg/util'],
  },
  build: {
    target: 'esnext',
  },
});
