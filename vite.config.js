import { resolve } from 'path'
import fs from 'fs'
import { defineConfig } from 'vite'
import { createApiApp } from './server.js'

export default defineConfig({
  plugins: [
    {
      name: 'api-and-admin',
      configureServer(server) {
        // Must run BEFORE Vite's spaFallbackMiddleware which serves index.html for 404s
        server.middlewares.use((req, res, next) => {
          const urlPath = req.url.split('?')[0].split('#')[0]

          // Skip Vite internals and API routes unconditionally
          if (
            urlPath.startsWith('/api') ||
            urlPath.startsWith('/@') ||
            urlPath.startsWith('/node_modules')
          ) return next()

          // URLs with extensions: only pass through if the file actually exists on disk.
          // Unknown dotted URLs (e.g. /about.typo) would otherwise fall through to
          // Vite's SPA fallback and serve index.html instead of a 404.
          if (urlPath.includes('.')) {
            const filePath = resolve(__dirname, '.' + urlPath)
            if (fs.existsSync(filePath)) return next()
            res.statusCode = 404
            res.setHeader('Content-Type', 'text/html; charset=utf-8')
            res.end(fs.readFileSync(resolve(__dirname, '404.html'), 'utf-8'))
            return
          }

          // /admin rewrite
          if (urlPath === '/admin' || urlPath === '/admin/') {
            req.url = '/admin/index.html'
            return next()
          }

          // Root is always valid
          if (urlPath === '/') return next()

          // Clean URL: check if matching .html exists
          const candidate = resolve(__dirname, '.' + urlPath + '.html')
          if (fs.existsSync(candidate)) {
            req.url = urlPath + '.html'
            return next()
          }

          // /work/slug and /insights/slug without a static file — rewrite to .html
          // and let the dynamic page handler in createApiApp() generate them on demand.
          if (/^\/work\/[a-z0-9][a-z0-9-]*$/i.test(urlPath) || /^\/insights\/[a-z0-9][a-z0-9-]*$/i.test(urlPath)) {
            req.url = urlPath + '.html'
            return next()
          }

          // No matching page found — serve 404 now before Vite's fallback kicks in
          res.statusCode = 404
          res.setHeader('Content-Type', 'text/html; charset=utf-8')
          res.end(fs.readFileSync(resolve(__dirname, '404.html'), 'utf-8'))
        })

        // Mount Express API routes
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
