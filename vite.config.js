import { resolve } from 'path'
import fs from 'fs'
import { defineConfig } from 'vite'
import { createApiApp } from './server.js'

export default defineConfig({
  plugins: [
    {
      name: 'api-and-admin',
      configureServer(server) {
        // Rewrite /admin and clean URLs → .html before Vite serves files
        server.middlewares.use((req, _res, next) => {
          const urlPath = req.url.split('?')[0].split('#')[0]
          if (urlPath === '/admin' || urlPath === '/admin/') {
            req.url = '/admin/index.html'
          } else if (!urlPath.includes('.') && urlPath !== '/' && !urlPath.startsWith('/api')) {
            const candidate = resolve(__dirname, '.' + urlPath + '.html')
            if (fs.existsSync(candidate)) req.url = urlPath + '.html'
          }
          next()
        })
        // Mount Express API routes
        server.middlewares.use(createApiApp())
        // Post-hook: runs after Vite's own middleware — catch unknown routes as 404
        return () => {
          server.middlewares.use((_req, res) => {
            res.statusCode = 404
            res.setHeader('Content-Type', 'text/html')
            res.end(fs.readFileSync(resolve(__dirname, '404.html'), 'utf-8'))
          })
        }
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
