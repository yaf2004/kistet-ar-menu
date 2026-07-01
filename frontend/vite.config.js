import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import path from 'path'

// Plain Vite + React config — no Base44 plugin needed anymore.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  server: {
    port: 5173
  }
});
