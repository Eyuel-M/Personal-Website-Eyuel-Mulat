import { resolve } from 'path'
import { defineConfig } from 'vite'
import { createApiApp } from './server.js'

export default defineConfig({
  plugins: [
    {
      name: 'api-and-admin',
      configureServer(server) {
        // Rewrite /admin → /admin/index.html so Vite serves the right file
        server.middlewares.use((req, _res, next) => {
          if (req.url === '/admin' || req.url === '/admin/') {
            req.url = '/admin/index.html'
          }
          next()
        })
        // Mount Express API routes directly on Vite's server
        server.middlewares.use(createApiApp())
      },
    },
  ],
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
        admin:          resolve(__dirname, 'admin/index.html'),
        'work-nexus':      resolve(__dirname, 'work/nexus-dashboard.html'),
        'work-vanguard':   resolve(__dirname, 'work/vanguard-capital.html'),
        'insight-systems': resolve(__dirname, 'insights/why-brand-systems-outlast-assets.html'),
        'insight-grid':    resolve(__dirname, 'insights/the-grid-beneath-everything.html'),
        'insight-restraint': resolve(__dirname, 'insights/restraint-as-a-design-strategy.html'),
      },
    },
  },
})
