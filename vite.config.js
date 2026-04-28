import { defineConfig } from 'vite'

export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    rollupOptions: {
      output: {
        manualChunks: {
          leaflet: ['leaflet'],
          d3: ['d3']
        }
      }
    }
  },
  server: {
    port: 5173,
    open: true
  }
})
