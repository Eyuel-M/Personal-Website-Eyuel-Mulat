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

// ── Seed content files if they don't exist ───────────────────────────────────
function seedIfMissing(filename, data) {
  const file = path.join(CONTENT_DIR, filename)
  if (!fs.existsSync(file)) fs.writeFileSync(file, JSON.stringify(data, null, 2))
}

seedIfMissing('portfolio.json', {
  title: 'Work', subtitle: 'Selected Projects',
  items: [
    { id: 1716000000001, slug: 'nexus-dashboard', title: 'Nexus Dashboard', category: 'Branding & UI', client: 'Nexus Technologies', year: '2024', tags: ['Brand Identity', 'UI Design'], description: 'A high-performance SaaS interface designed for complex data visualization and seamless user workflows — precision at enterprise scale.', thumbnail: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBga90sr654rVPGPEaB3kJeifl98bSDxlZBsKWfUjsSFqSEteMcDzxZ2X8DI9wNnkiRQXmSPw2yPmztXBYxqj0GuDwUG1Acgtf8ZsPJYMCoHKuPOAdAK38hAzLpvGLwdL5W3U-6cG6Sc8hV6n30pgK_smwSP8kievA0z2dr8GJOsyctxdUC5RCqkfCnoZM-gaS6sG0aXQwWmbDLjY9nGrNFCRA_fLcJJEN4pNxaLHdDkwIZkpTEijUa6bP7s3cbA-WYecL_HK6Yg_0', scope: 'Brand Identity · UI Design', role: 'Creative Director', overviewH2: 'Data at scale. Clarity by design.', overviewText: '<p class="text-base text-on-surface-variant leading-relaxed mb-6">Nexus Technologies needed an interface that could handle enterprise-scale data while remaining immediately legible to any user. The challenge: complexity without confusion.</p><p class="text-base text-on-surface-variant leading-relaxed">We built a visual language rooted in spatial hierarchy — clear typographic scales, a restrained color palette, and a grid system precise enough to hold hundreds of data points without visual noise.</p>', img1: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDOWQNwCA_Sy3BPn64hPnpoO02uP_2_I6oW5rpYeyhmhbJcwdODE21QCKmNBnLYpjNRQvkZI7H-37UsPWD4dPdVF7KLHyKL4fMT6LjMz1R1Riqe4PDbEd8ECAxfvke5UBMQ2RnMElW_xDtjq2oan1PCWh863-eSkEa-k_8ihQV0Ww3edsCB43nZJJJqts4HseBRGEvomTagI29z3PqwNDUNQddqSueZb4rURX2KArszCjq8N-BVQXNl1h9vIjUAO0ihvRIynh-y3AM', deliverables: [{title:'Brand Identity',desc:'Logo system, color palette, typography scale, and brand guidelines for digital and print.'},{title:'UI Design System',desc:'Component library, layout patterns, and interaction states for the full dashboard product.'},{title:'Marketing Assets',desc:'Landing page design, social templates, and pitch deck visual system.'}], gallery: [], blocks: [], archivedBlocks: [] },
    { id: 1716000000002, slug: 'vanguard-capital', title: 'Vanguard Capital', category: 'Identity System', client: 'Vanguard Capital Group', year: '2023', tags: ['Identity', 'Strategy', 'Print'], description: 'A comprehensive visual identity system for a category-defining brand. Structural rigour meets modern expression.', thumbnail: 'https://lh3.googleusercontent.com/aida-public/AB6AXuApiyh_3aaVjPbYqtnEYBYYCxdU270rhO_lQ0MlcPYGhxDlpPR1GJwvBolsdfXepO0m06UPWAFYvjKsHqwNyFnFZ8UzBq5qUYEMMzTm-PNLwhrRHkmHx-0UsTIVuo9CyfbyQq9j_TjkVdQJRQWNO7S__j6X-y8v3yxbf9p0MDfFO-3s9aIJzbpP4pDagWdhgpBHAFHN_BxkoMOkfgk9ur5yvt6DpaCaGorEo70Rhca1Zi8Pwd7VKUoRiXpeOMhV3pwXoZA8xxFUikw', scope: 'Identity · Strategy · Print', role: 'Brand Director', overviewH2: 'Authority built from the ground up.', overviewText: '<p class="text-base text-on-surface-variant leading-relaxed mb-6">Vanguard Capital was entering a crowded market with a differentiated thesis but a brand that didn\'t reflect it. They needed an identity that projected the same structural confidence as their investment philosophy.</p><p class="text-base text-on-surface-variant leading-relaxed">We built a system grounded in architectural geometry — a mark that works at billboard scale and business card scale, a typographic hierarchy that commands trust, and a color vocabulary that signals precision without coldness.</p>', img1: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDOWQNwCA_Sy3BPn64hPnpoO02uP_2_I6oW5rpYeyhmhbJcwdODE21QCKmNBnLYpjNRQvkZI7H-37UsPWD4dPdVF7KLHyKL4fMT6LjMz1R1Riqe4PDbEd8ECAxfvke5UBMQ2RnMElW_xDtjq2oan1PCWh863-eSkEa-k_8ihQV0Ww3edsCB43nZJJJqts4HseBRGEvomTagI29z3PqwNDUNQddqSueZb4rURX2KArszCjq8N-BVQXNl1h9vIjUAO0ihvRIynh-y3AM', deliverables: [{title:'Logo System',desc:'Primary mark, wordmark, and responsive lockups for all scales from digital favicon to exterior signage.'},{title:'Brand Standards',desc:'Comprehensive brand guidelines covering color, typography, photography style, and usage rules.'},{title:'Collateral Suite',desc:'Business cards, letterhead, pitch deck template, and investor report design system.'}], gallery: [], blocks: [], archivedBlocks: [] },
  ],
  archivedItems: [],
})

seedIfMissing('insights-data.json', {
  items: [
    { id: 1716000000003, slug: 'why-brand-systems-outlast-assets', title: 'Why Brand Systems Outlast Assets', category: 'Brand Strategy', date: '2024-05-01', excerpt: 'The difference between a brand that scales and one that fragments isn\'t budget — it\'s whether the thinking behind every visual decision is systematic or intuitive. Systems compound. Assets decay.', image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDOWQNwCA_Sy3BPn64hPnpoO02uP_2_I6oW5rpYeyhmhbJcwdODE21QCKmNBnLYpjNRQvkZI7H-37UsPWD4dPdVF7KLHyKL4fMT6LjMz1R1Riqe4PDbEd8ECAxfvke5UBMQ2RnMElW_xDtjq2oan1PCWh863-eSkEa-k_8ihQV0Ww3edsCB43nZJJJqts4HseBRGEvomTagI29z3PqwNDUNQddqSueZb4rURX2KArszCjq8N-BVQXNl1h9vIjUAO0ihvRIynh-y3AM', body: '', blocks: [], archivedBlocks: [] },
    { id: 1716000000004, slug: 'the-grid-beneath-everything', title: 'The Grid Beneath Everything', category: 'Typography', date: '2024-02-01', excerpt: 'Typographic grids aren\'t about constraint — they\'re about creating a framework flexible enough to hold any content while maintaining visual authority. How spatial systems become creative tools.', image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBga90sr654rVPGPEaB3kJeifl98bSDxlZBsKWfUjsSFqSEteMcDzxZ2X8DI9wNnkiRQXmSPw2yPmztXBYxqj0GuDwUG1Acgtf8ZsPJYMCoHKuPOAdAK38hAzLpvGLwdL5W3U-6cG6Sc8hV6n30pgK_smwSP8kievA0z2dr8GJOsyctxdUC5RCqkfCnoZM-gaS6sG0aXQwWmbDLjY9nGrNFCRA_fLcJJEN4pNxaLHdDkwIZkpTEijUa6bP7s3cbA-WYecL_HK6Yg_0', body: '', blocks: [], archivedBlocks: [] },
    { id: 1716000000005, slug: 'restraint-as-a-design-strategy', title: 'Restraint as a Design Strategy', category: 'Identity Design', date: '2023-10-01', excerpt: 'The hardest design decisions aren\'t what to add — they\'re what to remove. Architectural restraint as a discipline means trusting negative space, trusting the reader, and trusting the work itself.', image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuApiyh_3aaVjPbYqtnEYBYYCxdU270rhO_lQ0MlcPYGhxDlpPR1GJwvBolsdfXepO0m06UPWAFYvjKsHqwNyFnFZ8UzBq5qUYEMMzTm-PNLwhrRHkmHx-0UsTIVuo9CyfbyQq9j_TjkVdQJRQWNO7S__j6X-y8v3yxbf9p0MDfFO-3s9aIJzbpP4pDagWdhgpBHAFHN_BxkoMOkfgk9ur5yvt6DpaCaGorEo70Rhca1Zi8Pwd7VKUoRiXpeOMhV3pwXoZA8xxFUikw', body: '', blocks: [], archivedBlocks: [] },
  ],
  archivedItems: [],
})

seedIfMissing('home.json', {
  fields: {
    'hero-label': { value: 'Strategy & Design' },
    'hero-heading': { value: 'Design as <span class="text-on-surface/25">Strategy.</span><br>\nIdentity as <span class="text-accent">System.</span>' },
    'hero-subtitle': { value: 'Creative Direction & Brand Identity for forward-thinking brands. Building architectural visual systems that transcend temporary trends through geometric precision.' },
    'featured-title': { value: 'Nexus Dashboard' },
    'featured-desc': { value: 'A high-performance SaaS interface designed for complex data visualization and seamless user workflows — precision at enterprise scale.' },
    'featured-img': { value: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBga90sr654rVPGPEaB3kJeifl98bSDxlZBsKWfUjsSFqSEteMcDzxZ2X8DI9wNnkiRQXmSPw2yPmztXBYxqj0GuDwUG1Acgtf8ZsPJYMCoHKuPOAdAK38hAzLpvGLwdL5W3U-6cG6Sc8hV6n30pgK_smwSP8kievA0z2dr8GJOsyctxdUC5RCqkfCnoZM-gaS6sG0aXQwWmbDLjY9nGrNFCRA_fLcJJEN4pNxaLHdDkwIZkpTEijUa6bP7s3cbA-WYecL_HK6Yg_0' },
  },
})

seedIfMissing('about.json', {
  fields: {
    'about-hero-label': 'Creative Director',
    'about-h1': 'Making brands that endure.',
    'about-intro': "I'm a creative director and brand strategist working at the intersection of visual identity and strategic thinking. Every project is an opportunity to build something that lasts.",
    'about-img': '',
    philosophyItems: [
      {title:'Listen before designing',desc:"Understanding the problem space deeply before reaching for solutions. The best visual systems emerge from genuine understanding of a brand's truth — not from decoration applied over uncertainty."},
      {title:'Build systems, not assets',desc:"Every visual decision exists within a framework. Scalable identity systems outlast individual deliverables — they adapt to every touchpoint with consistency, from digital to print to environment."},
      {title:'Precision over decoration',desc:"Remove everything that doesn't earn its place. Architectural restraint isn't minimalism by default — it's intentionality at every scale, knowing when to add and when to hold back."},
    ],
    archivedPhilosophyItems: [],
    serviceItems: [
      {title:'Brand Strategy',desc:'Positioning audits, competitive landscapes, brand architecture, and the narrative frameworks that guide every visual and verbal decision.'},
      {title:'Visual Identity',desc:"Logo systems, color palettes, typeface selection, and the full visual language that makes a brand instantly recognisable across every touchpoint."},
      {title:'Creative Direction',desc:"Art directing photo shoots, campaign visuals, and cross-channel brand moments — ensuring every image and execution is consistent with the brand's core idea."},
      {title:'Typography',desc:'Type system design, custom lettering, and hierarchical scales that carry meaning and voice — from display headlines to dense body copy.'},
      {title:'Digital Systems',desc:'Design systems, component libraries, and UI frameworks that translate brand logic into scalable digital products with precision and consistency.'},
      {title:'Editorial Design',desc:'Annual reports, brand books, and publication design — structured grid layouts that give written content the authority and clarity it deserves.'},
    ],
    archivedServiceItems: [],
    processItems: [
      {heading:'Choose the Strategy',accentWord:'Strategy',stepLabel:'00-1 Step',desc:'Selecting the optimal path for brand growth through intensive research and structural auditing of market landscapes.'},
      {heading:'Define the Identity',accentWord:'Identity',stepLabel:'00-2 Step',desc:'Developing the core visual grammar and systemic logic that will underpin every future brand touchpoint.'},
    ],
    archivedProcessItems: [],
  },
})

seedIfMissing('slides.json', [
  {media:'https://lh3.googleusercontent.com/aida-public/AB6AXuDOWQNwCA_Sy3BPn64hPnpoO02uP_2_I6oW5rpYeyhmhbJcwdODE21QCKmNBnLYpjNRQvkZI7H-37UsPWD4dPdVF7KLHyKL4fMT6LjMz1R1Riqe4PDbEd8ECAxfvke5UBMQ2RnMElW_xDtjq2oan1PCWh863-eSkEa-k_8ihQV0Ww3edsCB43nZJJJqts4HseBRGEvomTagI29z3PqwNDUNQddqSueZb4rURX2KArszCjq8N-BVQXNl1h9vIjUAO0ihvRIynh-y3AM',title:''},
  {media:'https://lh3.googleusercontent.com/aida-public/AB6AXuBga90sr654rVPGPEaB3kJeifl98bSDxlZBsKWfUjsSFqSEteMcDzxZ2X8DI9wNnkiRQXmSPw2yPmztXBYxqj0GuDwUG1Acgtf8ZsPJYMCoHKuPOAdAK38hAzLpvGLwdL5W3U-6cG6Sc8hV6n30pgK_smwSP8kievA0z2dr8GJOsyctxdUC5RCqkfCnoZM-gaS6sG0aXQwWmbDLjY9nGrNFCRA_fLcJJEN4pNxaLHdDkwIZkpTEijUa6bP7s3cbA-WYecL_HK6Yg_0',title:''},
  {media:'https://lh3.googleusercontent.com/aida-public/AB6AXuApiyh_3aaVjPbYqtnEYBYYCxdU270rhO_lQ0MlcPYGhxDlpPR1GJwvBolsdfXepO0m06UPWAFYvjKsHqwNyFnFZ8UzBq5qUYEMMzTm-PNLwhrRHkmHx-0UsTIVuo9CyfbyQq9j_TjkVdQJRQWNO7S__j6X-y8v3yxbf9p0MDfFO-3s9aIJzbpP4pDagWdhgpBHAFHN_BxkoMOkfgk9ur5yvt6DpaCaGorEo70Rhca1Zi8Pwd7VKUoRiXpeOMhV3pwXoZA8xxFUikw',title:''},
])
seedIfMissing('clients.json', [
  {id:'1',name:'Nexus Technologies',logo:'',url:''},
  {id:'2',name:'Vanguard Capital',logo:'',url:''},
  {id:'3',name:'Orion Group',logo:'',url:''},
  {id:'4',name:'Meridian Studio',logo:'',url:''},
  {id:'5',name:'Apex Ventures',logo:'',url:''},
  {id:'6',name:'Summit Advisory',logo:'',url:''},
])

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
    limits: { fileSize: 50 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
      const ok = /\.(jpe?g|png|gif|webp|svg|mp4|webm|mov|avi|mkv)$/i.test(file.originalname)
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

// Save content for a page (merges fields to avoid wiping unrelated sections)
app.put('/api/content/:page', auth, (req, res) => {
  const file = path.join(CONTENT_DIR, `${req.params.page}.json`)
  const existing = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {}
  const merged = { ...existing, ...req.body }
  if (req.body.fields) merged.fields = { ...(existing.fields || {}), ...req.body.fields }
  if (req.body.blocks !== undefined) merged.blocks = req.body.blocks
  if (req.body.archivedBlocks !== undefined) merged.archivedBlocks = req.body.archivedBlocks
  fs.writeFileSync(file, JSON.stringify(merged, null, 2))
  res.json({ ok: true })
})

// Preview cache (in-memory, not persisted to disk)
const previewCache = {}
app.put('/api/preview/:page', auth, (req, res) => {
  previewCache[req.params.page] = req.body
  res.json({ ok: true })
})
app.get('/api/preview/:page', (req, res) => {
  const cached = previewCache[req.params.page]
  if (cached) return res.json(cached)
  // Fall back to saved content if no preview exists
  const file = path.join(CONTENT_DIR, `${req.params.page}.json`)
  if (!fs.existsSync(file)) return res.json({ fields: {}, blocks: [] })
  try { res.json(JSON.parse(fs.readFileSync(file, 'utf8'))) }
  catch { res.json({ fields: {}, blocks: [] }) }
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

  // ── Categories ────────────────────────────────────────────────────────────
  const defaultCats = [
    { id: 'brand', name: 'Brand Identity', slug: 'brand' },
    { id: 'web', name: 'Web Design', slug: 'web' },
    { id: 'motion', name: 'Motion', slug: 'motion' },
    { id: 'editorial', name: 'Editorial', slug: 'editorial' },
    { id: 'branding-ui', name: 'Branding & UI', slug: 'branding-ui' },
    { id: 'identity', name: 'Identity System', slug: 'identity' },
  ]
  app.get('/api/categories', (req, res) => {
    const f = path.join(CONTENT_DIR, 'categories.json')
    res.json(fs.existsSync(f) ? JSON.parse(fs.readFileSync(f)) : defaultCats)
  })
  app.put('/api/categories', auth, (req, res) => {
    fs.writeFileSync(path.join(CONTENT_DIR, 'categories.json'), JSON.stringify(req.body, null, 2))
    res.json({ ok: true })
  })

  // ── Clients ───────────────────────────────────────────────────────────────
  const defaultClients = [
    { id: '1', name: 'Nexus Technologies', logo: '', url: '' },
    { id: '2', name: 'Vanguard Capital', logo: '', url: '' },
    { id: '3', name: 'Orion Group', logo: '', url: '' },
    { id: '4', name: 'Meridian Studio', logo: '', url: '' },
    { id: '5', name: 'Apex Ventures', logo: '', url: '' },
    { id: '6', name: 'Summit Advisory', logo: '', url: '' },
  ]
  app.get('/api/clients', (req, res) => {
    const f = path.join(CONTENT_DIR, 'clients.json')
    res.json(fs.existsSync(f) ? JSON.parse(fs.readFileSync(f)) : defaultClients)
  })
  app.put('/api/clients', auth, (req, res) => {
    fs.writeFileSync(path.join(CONTENT_DIR, 'clients.json'), JSON.stringify(req.body, null, 2))
    res.json({ ok: true })
  })

  // ── Capabilities ──────────────────────────────────────────────────────────
  const defaultCaps = [
    { id: '1', icon: '<svg class="w-full h-full stroke-current fill-none" style="stroke-width:1.5" viewBox="0 0 100 100"><circle cx="50" cy="50" r="40"/><circle cx="50" cy="50" r="25"/><line x1="50" x2="50" y1="10" y2="90"/><line x1="10" x2="90" y1="50" y2="50"/></svg>', title: 'Brand Strategy', description: 'Defining the core essence, positioning, and architectural narrative of your brand through rigorous analysis.' },
    { id: '2', icon: '<svg class="w-full h-full stroke-current fill-none" style="stroke-width:1.5" viewBox="0 0 100 100"><rect x="20" y="20" width="60" height="60"/><rect x="10" y="10" width="80" height="80" opacity="0.3"/><path d="M20 20 L80 80"/><path d="M80 20 L20 80"/></svg>', title: 'Identity Design', description: 'Visual systems built on grid-based precision and timeless modernist principles for lasting impact.' },
    { id: '3', icon: '<svg class="w-full h-full stroke-current fill-none" style="stroke-width:1.5" viewBox="0 0 100 100"><path d="M50 10 L90 80 H10 Z"/><path d="M50 30 L75 70 H25 Z" opacity="0.5"/><circle cx="50" cy="55" r="5" fill="currentColor" stroke="none"/></svg>', title: 'Digital Build', description: 'High-performance digital experiences that prioritize clarity, structural integrity, and user flow.' },
  ]
  app.get('/api/capabilities', (req, res) => {
    const f = path.join(CONTENT_DIR, 'capabilities.json')
    res.json(fs.existsSync(f) ? JSON.parse(fs.readFileSync(f)) : defaultCaps)
  })
  app.put('/api/capabilities', auth, (req, res) => {
    fs.writeFileSync(path.join(CONTENT_DIR, 'capabilities.json'), JSON.stringify(req.body, null, 2))
    res.json({ ok: true })
  })

  // ── Slides ────────────────────────────────────────────────────────────────
  app.get('/api/slides', (req, res) => {
    const f = path.join(CONTENT_DIR, 'slides.json')
    res.json(fs.existsSync(f) ? JSON.parse(fs.readFileSync(f)) : [])
  })
  app.put('/api/slides', auth, (req, res) => {
    fs.writeFileSync(path.join(CONTENT_DIR, 'slides.json'), JSON.stringify(req.body, null, 2))
    res.json({ ok: true })
  })

  // ── Contact Services ──────────────────────────────────────────────────────
  const defaultSvcs = ['Brand Strategy','Visual Identity','Creative Direction','Typography','Digital Systems','Editorial Design','Campaign & Art Direction','Print & Packaging']
  app.get('/api/contact-services', (req, res) => {
    const f = path.join(CONTENT_DIR, 'contact-services.json')
    res.json(fs.existsSync(f) ? JSON.parse(fs.readFileSync(f)) : defaultSvcs)
  })
  app.put('/api/contact-services', auth, (req, res) => {
    fs.writeFileSync(path.join(CONTENT_DIR, 'contact-services.json'), JSON.stringify(req.body, null, 2))
    res.json({ ok: true })
  })

  // ── Delete / Update project ───────────────────────────────────────────────
  app.put('/api/project/:slug', auth, (req, res) => {
    const { slug } = req.params
    const pf = path.join(CONTENT_DIR, 'projects.json')
    if (!fs.existsSync(pf)) return res.status(404).json({ error: 'Not found' })
    const ps = JSON.parse(fs.readFileSync(pf))
    const idx = ps.findIndex(p => p.slug === slug)
    if (idx < 0) return res.status(404).json({ error: 'Not found' })
    ps[idx] = { ...ps[idx], ...req.body, slug }
    fs.writeFileSync(pf, JSON.stringify(ps, null, 2))
    res.json({ ok: true })
  })
  app.delete('/api/project/:slug', auth, (req, res) => {
    const { slug } = req.params
    const htmlFile = path.join(__dirname, 'work', `${slug}.html`)
    if (fs.existsSync(htmlFile)) fs.unlinkSync(htmlFile)
    const pf = path.join(CONTENT_DIR, 'projects.json')
    if (fs.existsSync(pf)) {
      const ps = JSON.parse(fs.readFileSync(pf))
      fs.writeFileSync(pf, JSON.stringify(ps.filter(p => p.slug !== slug), null, 2))
    }
    const cf = path.join(CONTENT_DIR, `${slug}.json`)
    if (fs.existsSync(cf)) fs.unlinkSync(cf)
    res.json({ ok: true })
  })

  // ── Delete insight ────────────────────────────────────────────────────────
  app.delete('/api/insight/:slug', auth, (req, res) => {
    const { slug } = req.params
    const htmlFile = path.join(__dirname, 'insights', `${slug}.html`)
    if (fs.existsSync(htmlFile)) fs.unlinkSync(htmlFile)
    const af = path.join(CONTENT_DIR, 'insights.json')
    if (fs.existsSync(af)) {
      const as_ = JSON.parse(fs.readFileSync(af))
      fs.writeFileSync(af, JSON.stringify(as_.filter(a => a.slug !== slug), null, 2))
    }
    res.json({ ok: true })
  })
  // ── List insights ─────────────────────────────────────────────────────────
  app.get('/api/insights', auth, (req, res) => {
    const f = path.join(CONTENT_DIR, 'insights.json')
    res.json(fs.existsSync(f) ? JSON.parse(fs.readFileSync(f)) : [])
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
