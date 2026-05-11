import express from 'express'
import multer from 'multer'
import cors from 'cors'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PORT = process.env.PORT || 3001

const ADMIN_PASS  = process.env.ADMIN_PASS  || 'admin2024'
const ADMIN_TOKEN = 'em-' + Buffer.from(ADMIN_PASS + ':eyuelmulat').toString('base64')

const CONTENT_DIR = path.join(__dirname, 'content')
const UPLOADS_DIR = path.join(__dirname, 'public', 'uploads')
fs.mkdirSync(CONTENT_DIR, { recursive: true })
fs.mkdirSync(UPLOADS_DIR, { recursive: true })

// ── Build API middleware (used by both Vite plugin and standalone) ───────────
export function createApiApp() {
  const app = express()
  app.use(cors())
  app.use(express.json({ limit: '10mb' }))

  // Serve uploaded files
  app.use('/public/uploads', express.static(UPLOADS_DIR))

  const storage = multer.diskStorage({
    destination: UPLOADS_DIR,
    filename: (req, file, cb) => {
      const ext  = path.extname(file.originalname).toLowerCase()
      const name = path.basename(file.originalname, ext)
        .replace(/[^a-z0-9]/gi, '-').toLowerCase().slice(0, 40)
      cb(null, `${name}-${Date.now()}${ext}`)
    },
  })
  const upload = multer({
    storage,
    limits: { fileSize: 30 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
      const ok = /\.(jpe?g|png|gif|webp|svg|mp4|webm|mov)$/i.test(file.originalname)
      cb(ok ? null : new Error('Unsupported file type'), ok)
    },
  })

  function auth(req, res, next) {
    if (req.headers['x-token'] === ADMIN_TOKEN) return next()
    res.status(401).json({ error: 'Unauthorized' })
  }

  // ── Routes ────────────────────────────────────────────────────────────────

  // Login
  app.post('/api/login', (req, res) => {
  if (req.body.password === ADMIN_PASS) {
    res.json({ token: ADMIN_TOKEN })
  } else {
    res.status(401).json({ error: 'Wrong password' })
  }
})

// Get content for a page
app.get('/api/content/:page', (req, res) => {
  const file = path.join(CONTENT_DIR, `${req.params.page}.json`)
  if (!fs.existsSync(file)) return res.json({ fields: {}, blocks: [] })
  try {
    res.json(JSON.parse(fs.readFileSync(file, 'utf8')))
  } catch {
    res.json({ fields: {}, blocks: [] })
  }
})

// Save content for a page
app.put('/api/content/:page', auth, (req, res) => {
  const file = path.join(CONTENT_DIR, `${req.params.page}.json`)
  fs.writeFileSync(file, JSON.stringify(req.body, null, 2))
  res.json({ ok: true })
})

// Upload file
app.post('/api/upload', auth, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' })
  res.json({ url: `/public/uploads/${req.file.filename}` })
})

// Create new project page
app.post('/api/project', auth, (req, res) => {
  const { slug, title, category, year, client, scope, description, role } = req.body
  if (!slug || !title) return res.status(400).json({ error: 'slug and title required' })

  const workDir = path.join(__dirname, 'work')
  fs.mkdirSync(workDir, { recursive: true })

  const filePath = path.join(workDir, `${slug}.html`)
  fs.writeFileSync(filePath, buildProjectPage({ slug, title, category, year, client, scope, description, role }))

  // Register project in projects.json
  const projectsFile = path.join(CONTENT_DIR, 'projects.json')
  const projects = fs.existsSync(projectsFile) ? JSON.parse(fs.readFileSync(projectsFile)) : []
  const existing = projects.findIndex(p => p.slug === slug)
  const entry = { slug, title, category, year, client, scope, description, role, createdAt: new Date().toISOString() }
  if (existing >= 0) projects[existing] = entry
  else projects.push(entry)
  fs.writeFileSync(projectsFile, JSON.stringify(projects, null, 2))

  res.json({ ok: true, url: `/work/${slug}.html` })
})

// List projects
app.get('/api/projects', auth, (req, res) => {
  const file = path.join(CONTENT_DIR, 'projects.json')
  res.json(fs.existsSync(file) ? JSON.parse(fs.readFileSync(file)) : [])
})

// Create new insight article page
app.post('/api/insight', auth, (req, res) => {
  const { slug, title, category, date, excerpt, body } = req.body
  if (!slug || !title) return res.status(400).json({ error: 'slug and title required' })

  const insightDir = path.join(__dirname, 'insights')
  fs.mkdirSync(insightDir, { recursive: true })

  const filePath = path.join(insightDir, `${slug}.html`)
  fs.writeFileSync(filePath, buildInsightPage({ slug, title, category, date, excerpt, body }))

  // Register in insights.json
  const insightsFile = path.join(CONTENT_DIR, 'insights.json')
  const articles = fs.existsSync(insightsFile) ? JSON.parse(fs.readFileSync(insightsFile)) : []
  const entry = { slug, title, category, date, excerpt, createdAt: new Date().toISOString() }
  const idx = articles.findIndex(a => a.slug === slug)
  if (idx >= 0) articles[idx] = entry
  else articles.push(entry)
  fs.writeFileSync(insightsFile, JSON.stringify(articles, null, 2))

  res.json({ ok: true, url: `/insights/${slug}.html` })
  })

  return app
}

// ── Page Templates ──────────────────────────────────────────────────────────

function navHTML() {
  return `  <nav class="fixed top-0 w-full z-50 bg-background/80 backdrop-blur-sm">
    <div class="flex justify-between items-center px-10 md:px-[80px] py-8">
      <a href="/" class="font-display text-2xl text-primary uppercase tracking-wide">EYUEL MULAT</a>
      <div class="hidden md:flex gap-12 items-center">
        <a href="/about.html" class="nav-link" data-nav="about">About</a>
        <a href="/work.html" class="nav-link" data-nav="work">Work</a>
        <a href="/insights.html" class="nav-link" data-nav="insights">Insights</a>
      </div>
      <a href="/contact.html" class="nav-cta" data-nav="contact">Contact</a>
    </div>
  </nav>`
}

function footerHTML() {
  return `  <footer class="bg-primary text-background px-10 md:px-[80px]">
    <div class="pt-20 pb-16 grid grid-cols-12 gap-8">
      <div class="col-span-12 md:col-span-3 flex flex-col gap-3">
        <a href="mailto:hello@eyuelmulat.com" class="label-caps text-[11px] tracking-[0.25em] text-background/90 hover:text-background transition-colors">hello@eyuelmulat.com</a>
        <span class="label-caps text-[11px] tracking-[0.25em] text-background/60">+251 95 355 3856</span>
      </div>
      <div class="col-span-12 md:col-span-3 flex flex-col gap-4">
        <span class="label-caps text-[11px] tracking-[0.25em] text-background/60">Addis Ababa, Ethiopia</span>
        <a href="/contact.html" class="inline-flex items-center gap-3 label-caps text-[11px] tracking-[0.25em] text-background hover:text-accent transition-colors">Get in Touch<span class="material-symbols-outlined text-accent" style="font-size:14px;line-height:1">arrow_forward</span></a>
      </div>
      <div class="col-span-6 md:col-span-3 flex flex-col gap-3">
        <span class="label-caps text-[10px] tracking-[0.3em] text-background/50 mb-3 block">Pages</span>
        <a href="/about.html" class="label-caps text-[11px] tracking-[0.2em] text-background/80 hover:text-background transition-colors">About</a>
        <a href="/work.html" class="label-caps text-[11px] tracking-[0.2em] text-background/80 hover:text-background transition-colors">Work</a>
        <a href="/insights.html" class="label-caps text-[11px] tracking-[0.2em] text-background/80 hover:text-background transition-colors">Insights</a>
        <a href="/contact.html" class="label-caps text-[11px] tracking-[0.2em] text-background/80 hover:text-background transition-colors">Contact</a>
      </div>
      <div class="col-span-6 md:col-span-3 flex flex-col gap-3">
        <span class="label-caps text-[10px] tracking-[0.3em] text-background/50 mb-3 block">Follow</span>
        <a href="#" class="label-caps text-[11px] tracking-[0.2em] text-background/80 hover:text-background transition-colors">Instagram</a>
        <a href="#" class="label-caps text-[11px] tracking-[0.2em] text-background/80 hover:text-background transition-colors">LinkedIn</a>
        <a href="#" class="label-caps text-[11px] tracking-[0.2em] text-background/80 hover:text-background transition-colors">Behance</a>
      </div>
    </div>
    <div class="overflow-hidden"><div class="footer-brand font-display uppercase leading-none text-background">EYUEL MULAT</div></div>
    <div class="py-6"><span class="text-[10px] text-background/50 uppercase tracking-widest">© 2024 Eyuel Mulat</span></div>
  </footer>`
}

function headHTML(title, description = '') {
  return `  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>${title} — Eyuel Mulat</title>
  ${description ? `<meta name="description" content="${description}"/>` : ''}
  <link rel="preconnect" href="https://fonts.googleapis.com"/>
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
  <link href="https://fonts.googleapis.com/css2?family=Anton&family=Hanken+Grotesk:wght@400;600;700&display=swap" rel="stylesheet"/>
  <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0,0&display=swap" rel="stylesheet"/>
  <link rel="stylesheet" href="/src/css/main.css"/>`
}

function buildProjectPage({ slug, title, category, year, client, scope, description, role }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
${headHTML(title)}
</head>
<body class="bg-background text-on-surface grain-overlay min-h-screen">
${navHTML()}
  <main>
    <section class="px-10 md:px-[80px] pt-48 pb-16">
      <a href="/work.html" class="inline-flex items-center gap-3 label-caps text-[10px] text-on-surface-variant hover:text-primary transition-colors mb-16 tracking-[0.3em]">
        <span class="material-symbols-outlined" style="font-size:14px;line-height:1">arrow_back</span>
        All Work
      </a>
      <div class="flex flex-wrap items-center gap-6 mb-12 reveal-hero">
        <span class="label-caps text-[10px] text-accent tracking-[0.3em]" data-editable="${slug}-category">${category || 'Design'}</span>
        <span class="w-px h-4 bg-black/20"></span>
        <span class="label-caps text-[10px] text-on-surface-variant tracking-[0.3em]" data-editable="${slug}-year">${year || '2024'}</span>
      </div>
      <h1 class="font-display text-[72px] md:text-[120px] leading-[0.88] uppercase mb-16 reveal-hero delay-1" data-editable="${slug}-title">${title}</h1>
      <div class="grid grid-cols-2 md:grid-cols-4 border-t border-black/10 pt-10 gap-8 reveal-hero delay-2">
        <div>
          <span class="label-caps text-[10px] text-on-surface-variant/60 tracking-[0.3em] block mb-2">Client</span>
          <span class="text-base text-on-surface" data-editable="${slug}-client">${client || ''}</span>
        </div>
        <div>
          <span class="label-caps text-[10px] text-on-surface-variant/60 tracking-[0.3em] block mb-2">Year</span>
          <span class="text-base text-on-surface" data-editable="${slug}-year2">${year || '2024'}</span>
        </div>
        <div>
          <span class="label-caps text-[10px] text-on-surface-variant/60 tracking-[0.3em] block mb-2">Scope</span>
          <span class="text-base text-on-surface" data-editable="${slug}-scope">${scope || category || ''}</span>
        </div>
        <div>
          <span class="label-caps text-[10px] text-on-surface-variant/60 tracking-[0.3em] block mb-2">Role</span>
          <span class="text-base text-on-surface" data-editable="${slug}-role">${role || 'Creative Director'}</span>
        </div>
      </div>
    </section>

    <section class="px-10 md:px-[80px] mb-24 bg-background">
      <div class="w-full overflow-hidden aspect-[16/9] border-l border-black/10">
        <img data-editable="${slug}-hero-img" data-editable-type="image" src="" alt="${title}" class="w-full h-full object-cover"/>
      </div>
    </section>

    <section class="px-10 md:px-[80px] mb-32">
      <div class="section-header reveal"><span class="label-caps tracking-[0.4em]">01 / Overview</span></div>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-16 md:gap-24">
        <div class="reveal">
          <h2 class="font-display text-[40px] md:text-[52px] uppercase leading-tight" data-editable="${slug}-overview-h2">Project Overview</h2>
        </div>
        <div class="reveal reveal-delay-2">
          <p class="text-base text-on-surface-variant leading-relaxed" data-editable="${slug}-overview-text">${description || ''}</p>
        </div>
      </div>
    </section>

    <!-- Custom blocks added via admin -->
    <div id="admin-blocks" class="px-10 md:px-[80px]"></div>
  </main>

${footerHTML()}
  <script type="module" src="/src/js/main.js"></script>
  <script type="module" src="/src/js/content-loader.js"></script>
</body>
</html>`
}

function buildInsightPage({ slug, title, category, date, excerpt, body }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
${headHTML(title)}
</head>
<body class="bg-background text-on-surface grain-overlay min-h-screen">
${navHTML()}
  <main>
    <section class="px-10 md:px-[80px] pt-48 pb-16">
      <a href="/insights.html" class="inline-flex items-center gap-3 label-caps text-[10px] text-on-surface-variant hover:text-primary transition-colors mb-16 tracking-[0.3em]">
        <span class="material-symbols-outlined" style="font-size:14px;line-height:1">arrow_back</span>
        All Insights
      </a>
      <div class="flex flex-wrap items-center gap-6 mb-12 reveal-hero">
        <span class="label-caps text-[10px] text-accent tracking-[0.3em]" data-editable="${slug}-category">${category || ''}</span>
        <span class="w-px h-4 bg-black/20"></span>
        <span class="label-caps text-[10px] text-on-surface-variant tracking-[0.3em]" data-editable="${slug}-date">${date || ''}</span>
      </div>
      <h1 class="font-display text-[56px] md:text-[100px] leading-[0.88] uppercase mb-16 reveal-hero delay-1" data-editable="${slug}-title">${title}</h1>
      <div class="grid grid-cols-1 md:grid-cols-12 gap-8 border-t border-black/10 pt-10 reveal-hero delay-2">
        <div class="md:col-span-8">
          <p class="text-xl leading-relaxed text-on-surface-variant max-w-2xl" data-editable="${slug}-excerpt">${excerpt || ''}</p>
        </div>
      </div>
    </section>

    <section class="px-10 md:px-[80px] mb-24 bg-background">
      <div class="w-full overflow-hidden aspect-[16/9] border-l border-black/10">
        <img data-editable="${slug}-hero-img" data-editable-type="image" src="" alt="${title}" class="w-full h-full object-cover"/>
      </div>
    </section>

    <section class="px-10 md:px-[80px] mb-32">
      <div class="grid grid-cols-1 md:grid-cols-12 gap-16">
        <div class="md:col-span-7 md:col-start-3">
          <div class="reveal" data-editable="${slug}-body" data-editable-type="html">
            ${body || '<p class="text-base text-on-surface-variant leading-relaxed">Article content goes here.</p>'}
          </div>
        </div>
      </div>
    </section>

    <!-- Custom blocks added via admin -->
    <div id="admin-blocks" class="px-10 md:px-[80px]"></div>
  </main>

${footerHTML()}
  <script type="module" src="/src/js/main.js"></script>
  <script type="module" src="/src/js/content-loader.js"></script>
</body>
</html>`
}

// ── Standalone mode (npm run admin) ─────────────────────────────────────────
const isMain = process.argv[1] === fileURLToPath(import.meta.url)
if (isMain) {
  const app = createApiApp()
  app.use('/admin', express.static(path.join(__dirname, 'admin')))
  app.use(express.static(path.join(__dirname)))
  app.listen(PORT, () => {
    console.log(`\n  ◆ Site + Admin  →  http://localhost:${PORT}`)
    console.log(`    Password      →  ${ADMIN_PASS}\n`)
  })
}
