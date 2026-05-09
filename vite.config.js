import { resolve } from 'path'
import { defineConfig } from 'vite'

export default defineConfig({
  server: {
    port: 3000,
  },
  build: {
    rollupOptions: {
      input: {
        index:          resolve(__dirname, 'index.html'),
        about:          resolve(__dirname, 'about.html'),
        work:           resolve(__dirname, 'work.html'),
        contact:        resolve(__dirname, 'contact.html'),
        insights:       resolve(__dirname, 'insights.html'),
        'work-nexus':   resolve(__dirname, 'work/nexus-dashboard.html'),
        'work-vanguard':resolve(__dirname, 'work/vanguard-capital.html'),
      },
    },
  },
})
