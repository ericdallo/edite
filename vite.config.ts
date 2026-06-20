/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import { fileURLToPath, URL } from 'node:url';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Served from the custom domain https://edite.video (see public/CNAME), so the
// app lives at the root path. BASE_URL ('/') is used for ffmpeg core loading too.
export default defineConfig({
  base: '/',
  plugins: [react(), tailwindcss()],
  // Cross-origin isolation so SharedArrayBuffer (the multi-thread ffmpeg core)
  // is available during local dev/preview. Production runs on GitHub Pages, which
  // can't set headers, so it relies on public/coi-serviceworker.js instead.
  // `credentialless` keeps cross-origin captions model downloads (HuggingFace
  // CDN) working without requiring CORP headers on them.
  server: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'credentialless',
    },
  },
  preview: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'credentialless',
    },
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  optimizeDeps: {
    // ffmpeg.wasm and transformers.js (Whisper) load their own wasm / workers;
    // keep them out of pre-bundling so they resolve their assets at runtime.
    exclude: ['@ffmpeg/ffmpeg', '@ffmpeg/util', '@huggingface/transformers'],
  },
  build: {
    target: 'esnext',
  },
  test: {
    environment: 'node',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.ts'],
  },
});
