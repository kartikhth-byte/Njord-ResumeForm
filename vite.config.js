/* global process */
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  define: { 'import.meta.env.VITE_APP_VERSION': JSON.stringify(process.env.VERCEL_GIT_COMMIT_SHA || process.env.VITE_APP_VERSION || 'local') },
  server: {
    port: 3000,
    strictPort: true,
    // AI search in local dev: forward /ai/* to a Needle service, as
    // vercel.json does in deployments. Set NEEDLE_DEV_URL (for example a
    // local hosted Needle at http://127.0.0.1:5000).
    proxy: process.env.NEEDLE_DEV_URL
      ? { '/ai': { target: process.env.NEEDLE_DEV_URL, changeOrigin: true } }
      : undefined,
  },
  build: {
    chunkSizeWarningLimit: 1200
  }
})
