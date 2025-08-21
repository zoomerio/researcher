import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
  },
  build: {
    outDir: 'dist',
    sourcemap: true, // Enable source maps for bundle analysis
    rollupOptions: {
      output: {
        manualChunks: {
          // Split large dependencies into separate chunks for better analysis
          'tiptap': ['@tiptap/core', '@tiptap/react', '@tiptap/starter-kit'],
          'tiptap-extensions': [
            '@tiptap/extension-mathematics',
            '@tiptap/extension-table',
            '@tiptap/extension-image',
            '@tiptap/extension-drag-handle-react'
          ],
          'plotly': ['plotly.js', 'react-plotly.js'],
          'math': ['katex', 'react-katex'],
          'vendor': ['react', 'react-dom'],
          'icons': ['react-icons']
        }
      }
    }
  },
});


