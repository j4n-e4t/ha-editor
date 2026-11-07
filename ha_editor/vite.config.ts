import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';
export default defineConfig({
  base: './', plugins: [react(), tailwindcss()],
  resolve: { alias: {
    '@': fileURLToPath(new URL('./src', import.meta.url)),
    // monaco-vim's "browser" build is UMD with its own copy of Monaco internals; use the ESM build,
    // which imports the app's Monaco.
    'monaco-vim': fileURLToPath(new URL('./node_modules/monaco-vim/dist/index.mjs', import.meta.url)),
  } },
  server: { host: '127.0.0.1', port: 5173, strictPort: true, proxy: { '/api': 'http://127.0.0.1:8099' } },
});
