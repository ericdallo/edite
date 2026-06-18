import { defineConfig } from 'vite';
import { fileURLToPath, URL } from 'node:url';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Served from the custom domain https://edite.video (see public/CNAME), so the
// app lives at the root path. BASE_URL ('/') is used for ffmpeg core loading too.
export default defineConfig({
  base: '/',
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
