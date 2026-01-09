import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    fs: {
      // Allow serving files from WASM output directory
      allow: ['..'],
    },
  },
  optimizeDeps: {
    exclude: ['@wasm'],
  },
  build: {
    target: 'esnext',
  },
})
