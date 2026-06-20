import express from 'express'
import multer from 'multer'
import cors from 'cors'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import nodemailer from 'nodemailer'
import { ImapFlow } from 'imapflow'
import { simpleParser } from 'mailparser'
import { ingestHandler, analyticsRouter } from './analytics-server.js'
import { restoreFromDb, patchFsWrites } from './src/content-persist.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PORT = process.env.PORT || 3001

const DEFAULT_PASS  = process.env.ADMIN_PASS  || 'admin2024'
const DEFAULT_EMAIL = process.env.ADMIN_EMAIL || 'admin@eyuelmulat.com'

const CONTENT_DIR = path.join(__dirname, 'content')
const UPLOADS_DIR = path.join(__dirname, 'public', 'uploads')
const BRIEFS_DIR  = path.join(__dirname, 'content', 'briefs')
fs.mkdirSync(CONTENT_DIR, { recursive: true })
fs.mkdirSync(UPLOADS_DIR, { recursive: true })
fs.mkdirSync(BRIEFS_DIR,  { recursive: true })

function getAccount () {
  const f = path.join(CONTENT_DIR, 'account.json')
  const d = { email: DEFAULT_EMAIL, password: DEFAULT_PASS, recoveryEmail: '', smtpHost: '', smtpPort: '587', smtpUser: '', smtpPass: '', imapHost: '', imapPort: '993', imapUser: '', imapPass: '' }
  if (!fs.existsSync(f)) return d
  try { return { ...d, ...JSON.parse(fs.readFileSync(f, 'utf8')) } } catch { return d }
}

function makeTransporter (acct) {
  if (acct.smtpHost) {
    return nodemailer.createTransport({ host: acct.smtpHost, port: Number(acct.smtpPort) || 587, secure: Number(acct.smtpPort) === 465, auth: { user: acct.smtpUser, pass: acct.smtpPass } })
  }
  return nodemailer.createTransport({ service: 'gmail', auth: { user: acct.smtpUser, pass: acct.smtpPass } })
}

// ── Messages (IMAP inbox + local sent/drafts) ─────────────────────────────────
const SENT_FILE   = () => path.join(CONTENT_DIR, 'messages-sent.json')
const DRAFTS_FILE = () => path.join(CONTENT_DIR, 'messages-drafts.json')
const READ_FILE   = () => path.join(CONTENT_DIR, 'messages-read.json')

function readSent()   { const f=SENT_FILE();   return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f)) : [] }
function readDrafts() { const f=DRAFTS_FILE(); return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f)) : [] }
function readUids()   { const f=READ_FILE();   return new Set(fs.existsSync(f) ? JSON.parse(fs.readFileSync(f)) : []) }
function markUidRead(uid) {
  const f = READ_FILE(); const s = readUids(); s.add(String(uid))
  fs.writeFileSync(f, JSON.stringify([...s]))
}

let _inboxCache = null
async function fetchInbox(acct) {
  if (!acct.imapHost || !acct.imapUser || !acct.imapPass) return []
  if (_inboxCache && (Date.now() - _inboxCache.at) < 90000) return _inboxCache.msgs
  const client = new ImapFlow({ host: acct.imapHost, port: parseInt(acct.imapPort)||993, secure: true, auth: { user: acct.imapUser, pass: acct.imapPass }, logger: false, tls: { rejectUnauthorized: false } })
  await client.connect()
  const messages = []
  const lock = await client.getMailboxLock('INBOX')
  try {
    const total = client.mailbox.exists
    if (total > 0) {
      const start = Math.max(1, total - 74) // fetch up to 75 newest
      for await (const msg of client.fetch(`${start}:*`, { uid: true, envelope: true, source: true })) {
        try {
          const parsed = await simpleParser(msg.source)
          messages.push({
            uid: String(msg.uid),
            from: msg.envelope.from?.[0] || null,
            to:   msg.envelope.to   || [],
            cc:   msg.envelope.cc   || [],
            subject: msg.envelope.subject || '(no subject)',
            date: msg.envelope.date,
            text: parsed.text || '',
            html: parsed.html || null,
          })
        } catch { /* skip unparseable */ }
      }
    }
  } finally { lock.release() }
  await client.logout()
  messages.reverse()
  const readSet = readUids()
  messages.forEach(m => { m.read = readSet.has(m.uid) })
  _inboxCache = { msgs: messages, at: Date.now() }
  return messages
}
function makeToken (pw) {
  return 'em-' + Buffer.from(pw + ':eyuelmulat').toString('base64')
}

// ── Seed content files if they don't exist ───────────────────────────────────
function seedIfMissing(filename, data) {
  const file = path.join(CONTENT_DIR, filename)
  if (!fs.existsSync(file)) fs.writeFileSync(file, JSON.stringify(data, null, 2))
}

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

seedIfMissing('slides.json', [])
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

  // Dynamic project/insight page serving — generates HTML on demand for any
  // slug that doesn't have a hand-crafted static file. Never written to disk
  // so template changes take effect immediately on every request.
  // Handles both /work/slug.html and /work/slug (clean URL after .html is stripped).
  app.use((req, res, next) => {
    const serve404 = () => res.status(404).sendFile(path.join(__dirname, '404.html'))
    let m
    if ((m = req.url.match(/^\/work\/([a-z0-9][a-z0-9-]*)(?:\.html)?(\?.*)?$/i))) {
      const slug = m[1]
      const qs   = m[2] || ''
      req.url = `/work/${slug}.html${qs}`             // normalise so static server can find hand-crafted files
      const filePath = path.join(__dirname, 'work', `${slug}.html`)
      if (fs.existsSync(filePath)) return next()      // hand-crafted static file → let static server serve it
      try {
        const pf = path.join(CONTENT_DIR, 'portfolio.json')
        if (!fs.existsSync(pf)) return serve404()
        const portfolio = JSON.parse(fs.readFileSync(pf))
        const items = portfolio.items || []
        const idx = items.findIndex(p => p.slug === slug)
        if (idx < 0) return serve404()
        const item = items[idx]
        const nextItem = items.length > 1 ? items[(idx + 1) % items.length] : null
        res.setHeader('Content-Type', 'text/html; charset=utf-8')
        return res.send(buildProjectPage(item, nextItem))
      } catch { return serve404() }
    }
    if ((m = req.url.match(/^\/insights\/([a-z0-9][a-z0-9-]*)(?:\.html)?(\?.*)?$/i))) {
      const slug = m[1]
      const qs   = m[2] || ''
      req.url = `/insights/${slug}.html${qs}`         // normalise so static server can find hand-crafted files
      const filePath = path.join(__dirname, 'insights', `${slug}.html`)
      if (fs.existsSync(filePath)) return next()      // hand-crafted static file → let static server serve it
      try {
        const af = path.join(CONTENT_DIR, 'insights-data.json')
        if (!fs.existsSync(af)) return serve404()
        const insightsData = JSON.parse(fs.readFileSync(af))
        const items = insightsData.items || []
        const idx = items.findIndex(a => a.slug === slug)
        if (idx < 0) return serve404()
        const item = items[idx]
        const nextItem = items.length > 1 ? items[(idx + 1) % items.length] : null
        res.setHeader('Content-Type', 'text/html; charset=utf-8')
        return res.send(buildInsightPage(item, nextItem))
      } catch { return serve404() }
    }
    next()
  })

  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      fs.mkdirSync(UPLOADS_DIR, { recursive: true })
      cb(null, UPLOADS_DIR)
    },
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

  const briefStorage = multer.diskStorage({
    destination: BRIEFS_DIR,
    filename: (req, file, cb) => {
      const ext  = path.extname(file.originalname).toLowerCase()
      const name = path.basename(file.originalname, ext)
        .replace(/[^a-z0-9]/gi, '-').toLowerCase().slice(0, 50)
      cb(null, `${name}-${Date.now()}${ext}`)
    },
  })
  const briefUpload = multer({
    storage: briefStorage,
    limits: { fileSize: 6 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
      const ok = /\.(pdf|docx?)$/i.test(file.originalname)
      cb(ok ? null : new Error('Only PDF/DOC/DOCX allowed'), ok)
    },
  })

  function auth(req, res, next) {
    if (req.headers['x-token'] === makeToken(getAccount().password)) return next()
    res.status(401).json({ error: 'Unauthorized' })
  }

  // ── Routes ────────────────────────────────────────────────────────────────

  // Login
  app.post('/api/login', (req, res) => {
    const acct = getAccount()
    if (req.body.email === acct.email && req.body.password === acct.password) {
      res.json({ token: makeToken(acct.password) })
    } else {
      res.status(401).json({ error: 'Invalid email or password' })
    }
  })

  // ── Account settings ───────────────────────────────────────────────────────
  app.get('/api/account', auth, (req, res) => {
    const { password: _, ...safe } = getAccount()
    res.json(safe)
  })
  app.put('/api/account', auth, (req, res) => {
    const acct = getAccount()
    const updated = { ...acct,
      email:         req.body.email         ?? acct.email,
      recoveryEmail: req.body.recoveryEmail ?? acct.recoveryEmail,
      smtpHost:      req.body.smtpHost      ?? acct.smtpHost,
      smtpPort:      req.body.smtpPort      ?? acct.smtpPort,
      smtpUser:      req.body.smtpUser      ?? acct.smtpUser,
      smtpPass:      req.body.smtpPass      ?? acct.smtpPass,
      imapHost:      req.body.imapHost      ?? acct.imapHost,
      imapPort:      req.body.imapPort      ?? acct.imapPort,
      imapUser:      req.body.imapUser      ?? acct.imapUser,
      imapPass:      req.body.imapPass      ?? acct.imapPass,
    }
    _inboxCache = null // invalidate on credential change
    fs.writeFileSync(path.join(CONTENT_DIR, 'account.json'), JSON.stringify(updated, null, 2))
    res.json({ ok: true })
  })
  app.put('/api/account/password', auth, (req, res) => {
    const { currentPassword, newPassword } = req.body
    const acct = getAccount()
    if (!newPassword || newPassword.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters.' })
    if (currentPassword !== acct.password) return res.status(401).json({ error: 'Current password is incorrect.' })
    const updated = { ...acct, password: newPassword }
    fs.writeFileSync(path.join(CONTENT_DIR, 'account.json'), JSON.stringify(updated, null, 2))
    res.json({ ok: true, token: makeToken(newPassword) })
  })
  app.post('/api/account/test-email', auth, async (req, res) => {
    const acct = getAccount()
    if (!acct.recoveryEmail) return res.status(400).json({ error: 'No recovery email configured.' })
    if (!acct.smtpUser || !acct.smtpPass) return res.status(400).json({ error: 'SMTP credentials not saved yet.' })
    try {
      const t = makeTransporter(acct)
      await t.sendMail({
        from: `"Eyuel Mulat Admin" <${acct.smtpUser}>`,
        to: acct.recoveryEmail,
        subject: 'Test email — Eyuel Mulat Admin',
        html: '<div style="font-family:sans-serif;padding:24px;max-width:420px"><h2>Test email</h2><p>Your email configuration is working correctly.</p></div>',
      })
      res.json({ ok: true })
    } catch(e) { res.status(500).json({ error: e.message || 'Send failed.' }) }
  })

  // ── Forgot / reset password ────────────────────────────────────────────────
  const resetCodes  = new Map()  // code  → { expires }
  const resetTokens = new Map()  // token → { expires }

  async function sendResetEmail (toAddress, code) {
    const acct = getAccount()
    if (!acct.smtpUser || !acct.smtpPass) throw new Error('Email sending is not configured. Set up Gmail SMTP in Account Settings first.')
    const t = makeTransporter(acct)
    await t.sendMail({
      from: `"Eyuel Mulat Admin" <${acct.smtpUser}>`,
      to: toAddress,
      subject: 'Password reset code',
      text:  `Your reset code is: ${code}\n\nExpires in 15 minutes.`,
      html:  `<div style="font-family:sans-serif;max-width:440px;padding:32px"><h2 style="margin:0 0 20px">Reset your password</h2><p style="color:#555;margin:0 0 16px">Your reset code is:</p><p style="font-size:40px;font-weight:700;letter-spacing:.35em;font-family:monospace;margin:0 0 20px;color:#111">${code}</p><p style="color:#9CA3AF;font-size:13px">Expires in 15 minutes. If you did not request this, ignore this email.</p></div>`,
    })
  }

  app.post('/api/auth/forgot', async (req, res) => {
    const acct = getAccount()
    const email = (req.body.email || '').trim().toLowerCase()
    if (email !== acct.email.toLowerCase()) return res.status(400).json({ error: 'No account found with that email.' })
    if (!acct.recoveryEmail) return res.status(400).json({ error: 'No recovery email configured. Set one in Account Settings.' })
    const code = String(Math.floor(100000 + Math.random() * 900000))
    resetCodes.set(code, { expires: Date.now() + 15 * 60 * 1000 })
    try {
      await sendResetEmail(acct.recoveryEmail, code)
      res.json({ ok: true })
    } catch(e) { resetCodes.delete(code); res.status(500).json({ error: e.message || 'Failed to send email.' }) }
  })
  app.post('/api/auth/verify-code', (req, res) => {
    const code = String(req.body.code || '').trim()
    const entry = resetCodes.get(code)
    if (!entry) return res.status(400).json({ error: 'Invalid code.' })
    if (Date.now() > entry.expires) { resetCodes.delete(code); return res.status(400).json({ error: 'Code has expired. Please request a new one.' }) }
    resetCodes.delete(code)
    const token = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2)
    resetTokens.set(token, { expires: Date.now() + 10 * 60 * 1000 })
    res.json({ ok: true, resetToken: token })
  })
  app.post('/api/auth/reset-password', (req, res) => {
    const { resetToken, newPassword } = req.body
    const entry = resetTokens.get(resetToken)
    if (!entry) return res.status(400).json({ error: 'Invalid or expired reset session. Please start over.' })
    if (Date.now() > entry.expires) { resetTokens.delete(resetToken); return res.status(400).json({ error: 'Reset session expired. Please start over.' }) }
    if (!newPassword || newPassword.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters.' })
    const acct = getAccount()
    fs.writeFileSync(path.join(CONTENT_DIR, 'account.json'), JSON.stringify({ ...acct, password: newPassword }, null, 2))
    resetTokens.delete(resetToken)
    res.json({ ok: true })
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

  // ── Slideshow Speed ────────────────────────────────────────────────────────
  app.get('/api/slideshow-speed', (req, res) => {
    const f = path.join(CONTENT_DIR, 'slideshow-speed.json')
    res.json(fs.existsSync(f) ? JSON.parse(fs.readFileSync(f)) : { speed: 40 })
  })
  app.put('/api/slideshow-speed', auth, (req, res) => {
    fs.writeFileSync(path.join(CONTENT_DIR, 'slideshow-speed.json'), JSON.stringify(req.body, null, 2))
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

  // ── Terms ─────────────────────────────────────────────────────────────────
  function getDefaultTermsContent() {
    try {
      const html = fs.readFileSync(path.join(__dirname, 'terms.html'), 'utf8')
      const m = html.match(/id="terms-body"[^>]*>([\s\S]+?)\s*<\/div>\s*<\/div>\s*<\/div>\s*<\/section>/)
      return m ? m[1].trim() : ''
    } catch { return '' }
  }
  app.get('/api/terms', (req, res) => {
    const f = path.join(CONTENT_DIR, 'terms.json')
    if (!fs.existsSync(f)) return res.json({ content: getDefaultTermsContent(), visible: true, updatedAt: null })
    try {
      const saved = JSON.parse(fs.readFileSync(f, 'utf8'))
      if (!saved.content) saved.content = getDefaultTermsContent()
      res.json(saved)
    } catch { res.json({ content: getDefaultTermsContent(), visible: true, updatedAt: null }) }
  })
  app.put('/api/terms', auth, (req, res) => {
    const data = { content: req.body.content || '', visible: req.body.visible !== false, updatedAt: new Date().toISOString() }
    fs.writeFileSync(path.join(CONTENT_DIR, 'terms.json'), JSON.stringify(data, null, 2))
    res.json({ ok: true })
  })

  // ── Testimonials ───────────────────────────────────────────────────────────
  function readTestimonials() {
    const f = path.join(CONTENT_DIR, 'testimonials.json')
    return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : []
  }
  function writeTestimonials(list) {
    fs.writeFileSync(path.join(CONTENT_DIR, 'testimonials.json'), JSON.stringify(list, null, 2))
  }

  app.get('/api/testimonials', (req, res) => {
    res.json(readTestimonials().filter(t => t.status === 'approved'))
  })
  app.get('/api/admin/testimonials', auth, (req, res) => {
    res.json(readTestimonials())
  })
  app.post('/api/admin/testimonials', auth, (req, res) => {
    const list = readTestimonials()
    const item = {
      id: Date.now(),
      name: req.body.name || '',
      email: req.body.email || '',
      company: req.body.company || '',
      role: req.body.role || '',
      rating: Number(req.body.rating) || 5,
      comment: req.body.comment || '',
      extra: req.body.extra || '',
      project: req.body.project || '',
      source: 'manual',
      status: 'approved',
      submittedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    }
    list.unshift(item)
    writeTestimonials(list)
    res.json({ ok: true, item })
  })
  app.patch('/api/admin/testimonials/:id', auth, (req, res) => {
    const list = readTestimonials()
    const idx = list.findIndex(t => String(t.id) === String(req.params.id))
    if (idx < 0) return res.status(404).json({ error: 'Not found' })
    list[idx] = { ...list[idx], ...req.body, id: list[idx].id }
    writeTestimonials(list)
    res.json({ ok: true, item: list[idx] })
  })
  app.delete('/api/admin/testimonials/:id', auth, (req, res) => {
    writeTestimonials(readTestimonials().filter(t => String(t.id) !== String(req.params.id)))
    res.json({ ok: true })
  })
  app.post('/api/admin/testimonials/request', auth, async (req, res) => {
    const { name, email, project } = req.body
    if (!name || !email) return res.status(400).json({ error: 'Name and email are required.' })
    const token = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2) + Date.now().toString(36)
    const list = readTestimonials()
    const item = {
      id: Date.now(),
      name,
      email,
      company: '',
      role: '',
      rating: null,
      comment: '',
      project: project || '',
      source: 'email',
      status: 'pending-submission',
      token,
      requestedAt: new Date().toISOString(),
      submittedAt: null,
      createdAt: new Date().toISOString(),
    }
    list.unshift(item)
    writeTestimonials(list)
    const acct = getAccount()
    if (acct.smtpUser && acct.smtpPass) {
      try {
        const origin = process.env.SITE_URL || `http://localhost:${PORT}`
        const link = `${origin}/testimonial.html?token=${token}`
        const t = makeTransporter(acct)
        await t.sendMail({
          from: `"Eyuel Mulat" <${acct.smtpUser}>`,
          to: email,
          subject: 'Share your experience working with Eyuel Mulat',
          html: `<div style="font-family:sans-serif;max-width:520px;padding:40px;color:#111;line-height:1.6"><h2 style="font-size:24px;font-weight:700;margin:0 0 16px">Hi ${name},</h2><p style="margin:0 0 16px;color:#444">Thank you for working with me. I'd love to hear your feedback — it only takes a minute.</p><a href="${link}" style="display:inline-block;background:#0F0F0F;color:#fff;text-decoration:none;padding:14px 28px;border-radius:4px;font-weight:600;font-size:14px;letter-spacing:.05em;margin:8px 0 24px">Share Your Testimonial</a><p style="font-size:12px;color:#999;margin:0">Or copy this link: ${link}</p></div>`,
        })
      } catch(e) { console.warn('Testimonial email failed:', e.message) }
    }
    res.json({ ok: true, item })
  })
  app.post('/api/testimonials/submit/:token', (req, res) => {
    const list = readTestimonials()
    const idx = list.findIndex(t => t.token === req.params.token && t.status === 'pending-submission')
    if (idx < 0) return res.status(404).json({ error: 'Invalid or expired token.' })
    list[idx] = {
      ...list[idx],
      role: req.body.role || list[idx].role,
      rating: Number(req.body.rating) || 5,
      comment: req.body.comment || '',
      status: 'pending',
      submittedAt: new Date().toISOString(),
      token: undefined,
    }
    writeTestimonials(list)
    res.json({ ok: true })
  })

  // ── Enquiries ──────────────────────────────────────────────────────────────
  app.post('/api/enquiry', (req, res) => {
    const f = path.join(CONTENT_DIR, 'enquiries.json')
    const list = fs.existsSync(f) ? JSON.parse(fs.readFileSync(f)) : []
    list.unshift({ ...req.body, id: Date.now(), submittedAt: new Date().toISOString(), read: false })
    fs.writeFileSync(f, JSON.stringify(list, null, 2))
    res.json({ ok: true })
  })
  app.get('/api/enquiries', auth, (req, res) => {
    const f = path.join(CONTENT_DIR, 'enquiries.json')
    res.json(fs.existsSync(f) ? JSON.parse(fs.readFileSync(f)) : [])
  })
  app.patch('/api/enquiry/:id/read', auth, (req, res) => {
    const f = path.join(CONTENT_DIR, 'enquiries.json')
    const list = fs.existsSync(f) ? JSON.parse(fs.readFileSync(f)) : []
    const e = list.find(x => String(x.id) === String(req.params.id))
    if (e) e.read = true
    fs.writeFileSync(f, JSON.stringify(list, null, 2))
    res.json({ ok: true })
  })
  app.delete('/api/enquiry/:id', auth, (req, res) => {
    const f = path.join(CONTENT_DIR, 'enquiries.json')
    const list = fs.existsSync(f) ? JSON.parse(fs.readFileSync(f)) : []
    fs.writeFileSync(f, JSON.stringify(list.filter(x => String(x.id) !== String(req.params.id)), null, 2))
    res.json({ ok: true })
  })
  // Upload a brief/attachment from the public contact form (no auth — submitted before login)
  app.post('/api/enquiry/brief', briefUpload.single('brief'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file received' })
    res.json({ filename: req.file.filename, originalName: req.file.originalname })
  })
  // Download a brief — auth required so only admin can fetch files
  app.get('/api/enquiry/brief/:filename', auth, (req, res) => {
    const safe = path.basename(req.params.filename)
    const filePath = path.join(BRIEFS_DIR, safe)
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Not found' })
    res.download(filePath, safe)
  })

  // ── Messages ──────────────────────────────────────────────────────────────
  app.get('/api/messages/inbox', auth, async (req, res) => {
    try {
      if (req.query.refresh === '1') _inboxCache = null
      const msgs = await fetchInbox(getAccount())
      res.json(msgs)
    } catch(e) { res.status(500).json({ error: e.message || 'IMAP fetch failed.' }) }
  })
  app.get('/api/messages/unread-count', auth, async (req, res) => {
    try {
      const msgs = await fetchInbox(getAccount())
      res.json({ count: msgs.filter(m => !m.read).length })
    } catch { res.json({ count: 0 }) }
  })
  app.patch('/api/messages/inbox/:uid/read', auth, (req, res) => {
    markUidRead(req.params.uid)
    if (_inboxCache) { const m = _inboxCache.msgs.find(x => x.uid === req.params.uid); if (m) m.read = true }
    res.json({ ok: true })
  })
  app.get('/api/messages/sent', auth, (req, res) => { res.json(readSent()) })
  app.delete('/api/messages/sent/:id', auth, (req, res) => {
    const list = readSent().filter(x => String(x.id) !== String(req.params.id))
    fs.writeFileSync(SENT_FILE(), JSON.stringify(list, null, 2))
    res.json({ ok: true })
  })
  app.get('/api/messages/drafts', auth, (req, res) => { res.json(readDrafts()) })
  app.post('/api/messages/draft', auth, (req, res) => {
    const list = readDrafts()
    const draft = { ...req.body, id: Date.now(), savedAt: new Date().toISOString() }
    list.unshift(draft)
    fs.writeFileSync(DRAFTS_FILE(), JSON.stringify(list, null, 2))
    res.json({ ok: true, id: draft.id })
  })
  app.put('/api/messages/draft/:id', auth, (req, res) => {
    const list = readDrafts()
    const idx = list.findIndex(x => String(x.id) === String(req.params.id))
    if (idx < 0) return res.status(404).json({ error: 'Draft not found.' })
    list[idx] = { ...list[idx], ...req.body, id: list[idx].id, savedAt: new Date().toISOString() }
    fs.writeFileSync(DRAFTS_FILE(), JSON.stringify(list, null, 2))
    res.json({ ok: true })
  })
  app.delete('/api/messages/draft/:id', auth, (req, res) => {
    fs.writeFileSync(DRAFTS_FILE(), JSON.stringify(readDrafts().filter(x => String(x.id) !== String(req.params.id)), null, 2))
    res.json({ ok: true })
  })
  app.post('/api/messages/send', auth, async (req, res) => {
    const { to = [], cc = [], subject = '', body = '', draftId } = req.body || {}
    if (!to.length) return res.status(400).json({ error: 'At least one recipient is required.' })
    if (!body.trim()) return res.status(400).json({ error: 'Message body is required.' })
    const acct = getAccount()
    if (!acct.smtpUser || !acct.smtpPass) return res.status(400).json({ error: 'SMTP not configured. Set up Gmail credentials in Account Settings.' })
    try {
      const t = makeTransporter(acct)
      await t.sendMail({
        from: `"Eyuel Mulat" <${acct.smtpUser}>`,
        replyTo: acct.smtpUser,
        to: to.join(', '),
        cc: cc.length ? cc.join(', ') : undefined,
        subject: subject || '(no subject)',
        html: `<div style="font-family:sans-serif;max-width:600px;padding:32px;color:#111;line-height:1.7"><div style="white-space:pre-wrap">${body.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</div><hr style="margin:32px 0;border:none;border-top:1px solid #eee"/><p style="font-size:12px;color:#999;margin:0">Eyuel Mulat · hello@eyuelmulat.com</p></div>`,
      })
      const sent = readSent()
      sent.unshift({ id: Date.now(), to, cc, subject, body, sentAt: new Date().toISOString() })
      fs.writeFileSync(SENT_FILE(), JSON.stringify(sent, null, 2))
      if (draftId) {
        fs.writeFileSync(DRAFTS_FILE(), JSON.stringify(readDrafts().filter(x => String(x.id) !== String(draftId)), null, 2))
      }
      res.json({ ok: true })
    } catch(e) { res.status(500).json({ error: e.message || 'Send failed.' }) }
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

  // ── Sitemap & Robots ───────────────────────────────────────────────────────
  app.get('/robots.txt', (req, res) => {
    const origin = process.env.SITE_URL || `https://eyuelmulat.com`
    res.setHeader('Content-Type', 'text/plain; charset=utf-8')
    res.send(`User-agent: *\nDisallow: /admin/\nDisallow: /api/\n\nSitemap: ${origin}/sitemap.xml\n`)
  })
  app.get('/sitemap.xml', (req, res) => {
    const origin = process.env.SITE_URL || `https://eyuelmulat.com`
    const staticPages = ['/', '/about.html', '/work.html', '/insights.html', '/contact.html', '/terms.html']
    const urls = staticPages.map(p => `  <url><loc>${origin}${p}</loc><changefreq>weekly</changefreq></url>`)
    try {
      const pf = path.join(CONTENT_DIR, 'portfolio.json')
      if (fs.existsSync(pf)) {
        const portfolio = JSON.parse(fs.readFileSync(pf, 'utf8'))
        ;(portfolio.items || []).filter(p => !p.status || p.status === 'published').forEach(p => {
          urls.push(`  <url><loc>${origin}/work/${p.slug}.html</loc><changefreq>monthly</changefreq></url>`)
        })
      }
    } catch {}
    try {
      const af = path.join(CONTENT_DIR, 'insights-data.json')
      if (fs.existsSync(af)) {
        const insightsData = JSON.parse(fs.readFileSync(af, 'utf8'))
        ;(insightsData.items || []).forEach(a => {
          urls.push(`  <url><loc>${origin}/insights/${a.slug}.html</loc><changefreq>monthly</changefreq></url>`)
        })
      }
    } catch {}
    res.setHeader('Content-Type', 'application/xml; charset=utf-8')
    res.send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`)
  })

  // ── Analytics ──────────────────────────────────────────────────────────────
  app.post('/api/analytics/ingest', ingestHandler)
  app.use('/api/analytics', auth, analyticsRouter)

  // JSON error handler — only for API routes; non-API 404s fall through to static serving
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    console.log('[DIAG] error handler hit, path:', req.path, 'status:', err.status, 'msg:', err.message)
    if (req.path.startsWith('/api/')) {
      res.status(err.status || 500).json({ error: err.message || 'Internal server error' })
    } else if (err.status === 404) {
      next()
    } else {
      res.status(err.status || 500).json({ error: err.message || 'Internal server error' })
    }
  })

  return app
}

// ── Page Templates ──────────────────────────────────────────────────────────

function navHTML() {
  return `  <nav class="fixed top-0 w-full z-50 bg-background/80 backdrop-blur-sm">
    <div class="flex justify-between items-center px-10 md:px-[80px] py-8">
      <a href="/" class="font-display text-2xl text-primary uppercase tracking-wide" data-nav-logo>EYUEL MULAT</a>
      <div class="hidden md:flex gap-12 items-center">
        <a href="/about.html" class="nav-link" data-nav="about">About</a>
        <a href="/work.html" class="nav-link" data-nav="work">Work</a>
        <a href="/insights.html" class="nav-link" data-nav="insights">Insights</a>
      </div>
      <a href="/contact.html" class="hidden md:inline-flex nav-cta" data-nav="contact">Contact</a>
      <button id="mob-menu-btn" aria-label="Open menu" aria-expanded="false" style="display:none;background:none;border:none;cursor:pointer;padding:4px;z-index:51;position:relative;flex-direction:column;gap:5px;align-items:flex-end;justify-content:center;width:32px;height:28px">
        <span id="hb-1" style="display:block;width:24px;height:1.5px;background:#0F0F0F;transition:transform .3s,opacity .3s;transform-origin:center"></span>
        <span id="hb-2" style="display:block;width:24px;height:1.5px;background:#0F0F0F;transition:transform .3s,opacity .3s"></span>
        <span id="hb-3" style="display:block;width:16px;height:1.5px;background:#0F0F0F;transition:transform .3s,width .3s;transform-origin:center"></span>
      </button>
    </div>
  </nav>
  <div id="mob-menu" aria-hidden="true" style="position:fixed;inset:0;z-index:49;background:#0F0F0F;transform:translateX(100%);transition:transform .35s cubic-bezier(.4,0,.2,1);display:flex;flex-direction:column;padding:100px 40px 48px;overflow-y:auto">
    <nav style="display:flex;flex-direction:column">
      <a href="/" style="font-family:Anton,sans-serif;font-size:clamp(36px,9vw,56px);text-transform:uppercase;color:rgba(245,242,238,.9);text-decoration:none;display:block;padding:14px 0;border-bottom:1px solid rgba(255,255,255,.07);transition:color .2s" onmouseover="this.style.color='#FF4F00'" onmouseout="this.style.color='rgba(245,242,238,.9)'">Home</a>
      <a href="/about.html" style="font-family:Anton,sans-serif;font-size:clamp(36px,9vw,56px);text-transform:uppercase;color:rgba(245,242,238,.9);text-decoration:none;display:block;padding:14px 0;border-bottom:1px solid rgba(255,255,255,.07);transition:color .2s" onmouseover="this.style.color='#FF4F00'" onmouseout="this.style.color='rgba(245,242,238,.9)'">About</a>
      <a href="/work.html" style="font-family:Anton,sans-serif;font-size:clamp(36px,9vw,56px);text-transform:uppercase;color:rgba(245,242,238,.9);text-decoration:none;display:block;padding:14px 0;border-bottom:1px solid rgba(255,255,255,.07);transition:color .2s" onmouseover="this.style.color='#FF4F00'" onmouseout="this.style.color='rgba(245,242,238,.9)'">Work</a>
      <a href="/insights.html" style="font-family:Anton,sans-serif;font-size:clamp(36px,9vw,56px);text-transform:uppercase;color:rgba(245,242,238,.9);text-decoration:none;display:block;padding:14px 0;border-bottom:1px solid rgba(255,255,255,.07);transition:color .2s" onmouseover="this.style.color='#FF4F00'" onmouseout="this.style.color='rgba(245,242,238,.9)'">Insights</a>
      <a href="/contact.html" style="font-family:Anton,sans-serif;font-size:clamp(36px,9vw,56px);text-transform:uppercase;color:rgba(245,242,238,.9);text-decoration:none;display:block;padding:14px 0;border-bottom:1px solid rgba(255,255,255,.07);transition:color .2s" onmouseover="this.style.color='#FF4F00'" onmouseout="this.style.color='rgba(245,242,238,.9)'">Contact</a>
      <a href="/terms.html" style="font-family:Anton,sans-serif;font-size:clamp(20px,4vw,28px);text-transform:uppercase;color:rgba(245,242,238,.35);text-decoration:none;display:block;padding:12px 0;margin-top:20px;transition:color .2s" onmouseover="this.style.color='rgba(245,242,238,.7)'" onmouseout="this.style.color='rgba(245,242,238,.35)'">Terms</a>
    </nav>
    <div style="margin-top:auto;padding-top:32px;border-top:1px solid rgba(255,255,255,.1)">
      <a href="mailto:hello@eyuelmulat.com" style="font-size:11px;letter-spacing:.25em;text-transform:uppercase;color:rgba(245,242,238,.4);text-decoration:none">hello@eyuelmulat.com</a>
    </div>
  </div>
  <script>
  ;(function(){
    var btn=document.getElementById('mob-menu-btn');
    var menu=document.getElementById('mob-menu');
    if(!btn||!menu)return;
    var l1=document.getElementById('hb-1'),l2=document.getElementById('hb-2'),l3=document.getElementById('hb-3');
    var isOpen=false;
    function checkMobile(){btn.style.display=window.innerWidth<768?'flex':'none';}
    checkMobile();window.addEventListener('resize',checkMobile);
    function openMenu(){isOpen=true;menu.style.transform='translateX(0)';menu.setAttribute('aria-hidden','false');btn.setAttribute('aria-expanded','true');document.body.style.overflow='hidden';if(l1)l1.style.transform='translateY(6.75px) rotate(45deg)';if(l2)l2.style.opacity='0';if(l3){l3.style.width='24px';l3.style.transform='translateY(-6.75px) rotate(-45deg)';}}
    function closeMenu(){isOpen=false;menu.style.transform='translateX(100%)';menu.setAttribute('aria-hidden','true');btn.setAttribute('aria-expanded','false');document.body.style.overflow='';if(l1)l1.style.transform='';if(l2)l2.style.opacity='1';if(l3){l3.style.width='16px';l3.style.transform='';}}
    btn.addEventListener('click',function(){isOpen?closeMenu():openMenu();});
    menu.querySelectorAll('a').forEach(function(a){a.addEventListener('click',closeMenu);});
  })();
  </script>`
}

function footerHTML() {
  return `  <footer class="bg-primary text-background px-10 md:px-[80px]">
    <div class="pt-20 pb-16 grid grid-cols-12 gap-8">
      <div class="col-span-12 md:col-span-3 flex flex-col gap-3">
        <a href="mailto:hello@eyuelmulat.com" class="label-caps text-[11px] tracking-[0.25em] text-background/90 hover:text-background transition-colors" data-footer-email>hello@eyuelmulat.com</a>
        <span class="label-caps text-[11px] tracking-[0.25em] text-background/60" data-footer-phone>+251 95 355 3856</span>
      </div>
      <div class="col-span-12 md:col-span-3 flex flex-col gap-4">
        <span class="label-caps text-[11px] tracking-[0.25em] text-background/60" data-footer-address>Addis Ababa, Ethiopia</span>
        <a href="/contact.html" class="inline-flex items-center gap-3 label-caps text-[11px] tracking-[0.25em] text-background hover:text-accent transition-colors">Get in Touch<span class="material-symbols-outlined text-accent" style="font-size:14px;line-height:1">arrow_forward</span></a>
      </div>
      <div class="col-span-6 md:col-span-3 flex flex-col gap-3" data-footer-pages>
        <span class="label-caps text-[10px] tracking-[0.3em] text-background/50 mb-3 block">Pages</span>
        <a href="/about.html" class="label-caps text-[11px] tracking-[0.2em] text-background/80 hover:text-background transition-colors">About</a>
        <a href="/work.html" class="label-caps text-[11px] tracking-[0.2em] text-background/80 hover:text-background transition-colors">Work</a>
        <a href="/insights.html" class="label-caps text-[11px] tracking-[0.2em] text-background/80 hover:text-background transition-colors">Insights</a>
        <a href="/contact.html" class="label-caps text-[11px] tracking-[0.2em] text-background/80 hover:text-background transition-colors">Contact</a>
        <a href="/terms.html" class="label-caps text-[11px] tracking-[0.2em] text-background/80 hover:text-background transition-colors">Terms</a>
      </div>
      <div class="col-span-6 md:col-span-3 flex flex-col gap-3" data-footer-social>
        <span class="label-caps text-[10px] tracking-[0.3em] text-background/50 mb-3 block">Follow</span>
        <a href="#" class="label-caps text-[11px] tracking-[0.2em] text-background/80 hover:text-background transition-colors">Instagram</a>
        <a href="#" class="label-caps text-[11px] tracking-[0.2em] text-background/80 hover:text-background transition-colors">LinkedIn</a>
        <a href="#" class="label-caps text-[11px] tracking-[0.2em] text-background/80 hover:text-background transition-colors">Behance</a>
      </div>
    </div>
    <div class="overflow-hidden" data-footer-logo><div class="footer-brand font-display uppercase leading-none text-background">EYUEL MULAT</div></div>
    <div class="py-6 text-center"><span class="text-[10px] text-background/50 uppercase tracking-widest" data-footer-copyright>© 2024 Eyuel Mulat</span></div>
  </footer>`
}

function getSiteSettings() {
  const f = path.join(CONTENT_DIR, 'site.json')
  try { return fs.existsSync(f) ? (JSON.parse(fs.readFileSync(f, 'utf8')).fields || {}) : {} }
  catch { return {} }
}

function headHTML(title, description = '') {
  const site = getSiteSettings()
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;')
  const favicon = site.favicon ? `\n  <link rel="icon" href="${site.favicon}"/>` : ''
  const ogTitle = `\n  <meta property="og:title" content="${esc(site.siteTitle || (title + ' — Eyuel Mulat'))}"/>`
  const ogDesc = (site.metaDescription || description) ? `\n  <meta property="og:description" content="${esc(site.metaDescription || description)}"/>` : ''
  const ogImage = site.ogImage ? `\n  <meta property="og:image" content="${site.ogImage}"/>` : ''
  return `  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>${title} — Eyuel Mulat</title>
  ${description ? `<meta name="description" content="${esc(description)}"/>` : ''}${favicon}${ogTitle}${ogDesc}${ogImage}
  <link rel="preconnect" href="https://fonts.googleapis.com"/>
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
  <link href="https://fonts.googleapis.com/css2?family=Anton&family=Hanken+Grotesk:wght@400;600;700&display=block" rel="stylesheet"/>
  <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0,0&display=swap" rel="stylesheet"/>
  <link rel="manifest" href="/manifest.json"/>
  <meta name="theme-color" content="#0F0F0F"/>
  <link rel="stylesheet" href="/src/css/main.css"/>`
}

function ctaHTML() {
  return `  <section class="py-40 px-10 md:px-[80px] border-t border-black/10 text-center bg-background dot-grid">
    <p class="label-caps text-on-surface-variant tracking-[0.4em] mb-10" data-cta-label>Have a project in mind?</p>
    <h2 class="font-display text-[48px] md:text-[72px] uppercase leading-[0.9] mb-16 max-w-3xl mx-auto" data-cta-heading>
      Let's make the<br><span class="text-accent">next great brand.</span>
    </h2>
    <a href="/contact.html" class="btn-link text-lg" data-cta-btn>
      Start a Project
      <span class="material-symbols-outlined text-accent" style="font-size:18px;line-height:1">north_east</span>
    </a>
  </section>`
}

function buildProjectPage({ slug, title, category, year, client, scope, description, role, overviewH2, overviewText, img1, deliverables, thumbnail }, nextItem) {
  const dv = (deliverables && deliverables.length) ? deliverables : [{title:'',desc:''},{title:'',desc:''},{title:'',desc:''}]
  while (dv.length < 3) dv.push({title:'',desc:''})
  const heroSrc = thumbnail || ''
  const secondarySrc = img1 || ''
  const nextSection = nextItem ? `
    <section class="border-t border-black/10 bg-background">
      <a href="/work/${nextItem.slug}.html" class="group block px-10 md:px-[80px] py-24">
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-8">
          <div>
            <span class="label-caps text-[10px] text-on-surface-variant/60 tracking-[0.3em] block mb-4">Next Project</span>
            <h2 class="font-display text-[48px] md:text-[72px] uppercase leading-none group-hover:text-accent transition-colors duration-300">${nextItem.title}</h2>
          </div>
          <span class="material-symbols-outlined text-accent text-5xl md:text-7xl transform group-hover:translate-x-3 group-hover:-translate-y-3 transition-transform duration-300">north_east</span>
        </div>
      </a>
    </section>` : ''
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
        <img data-editable="${slug}-hero-img" data-editable-type="image" src="${heroSrc}" alt="${title}" class="w-full h-full object-cover"${heroSrc ? '' : ' style="display:none"'}/>
      </div>
    </section>

    <section class="px-10 md:px-[80px] mb-32">
      <div class="section-header reveal"><span class="label-caps tracking-[0.4em]">01 / Overview</span></div>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-16 md:gap-24">
        <div class="reveal">
          <h2 class="font-display text-[40px] md:text-[52px] uppercase leading-tight" data-editable="${slug}-overview-h2">${overviewH2 || 'Project Overview'}</h2>
        </div>
        <div class="reveal reveal-delay-2" data-editable="${slug}-overview-text" data-editable-type="html">${overviewText || `<p class="text-base text-on-surface-variant leading-relaxed">${description || ''}</p>`}</div>
      </div>
    </section>

    <!-- ── Secondary Image ──────────────────────────────────────────────── -->
    <section class="px-10 md:px-[80px] mb-32 bg-background">
      <div class="w-full overflow-hidden aspect-[21/9] border-l border-black/10 reveal">
        <img data-editable="${slug}-img-1" data-editable-type="image" src="${secondarySrc}" alt="${title}" class="w-full h-full object-cover"${secondarySrc ? '' : ' style="display:none"'}/>
      </div>
    </section>

    <!-- ── Deliverables ──────────────────────────────────────────────────── -->
    <section class="px-10 md:px-[80px] mb-40">
      <div class="section-header reveal"><span class="label-caps tracking-[0.4em]">02 / Deliverables</span></div>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-x-16 gap-y-0">
        <div class="border-t border-black/10 py-8 reveal">
          <span class="label-caps text-[10px] text-accent tracking-[0.3em] block mb-3">01</span>
          <h3 class="font-display text-2xl uppercase mb-3" data-editable="${slug}-del-1-title">${dv[0].title || ''}</h3>
          <p class="text-sm text-on-surface-variant leading-relaxed" data-editable="${slug}-del-1-desc">${dv[0].desc || ''}</p>
        </div>
        <div class="border-t border-black/10 py-8 reveal reveal-delay-2">
          <span class="label-caps text-[10px] text-accent tracking-[0.3em] block mb-3">02</span>
          <h3 class="font-display text-2xl uppercase mb-3" data-editable="${slug}-del-2-title">${dv[1].title || ''}</h3>
          <p class="text-sm text-on-surface-variant leading-relaxed" data-editable="${slug}-del-2-desc">${dv[1].desc || ''}</p>
        </div>
        <div class="border-t border-black/10 py-8 reveal reveal-delay-3">
          <span class="label-caps text-[10px] text-accent tracking-[0.3em] block mb-3">03</span>
          <h3 class="font-display text-2xl uppercase mb-3" data-editable="${slug}-del-3-title">${dv[2].title || ''}</h3>
          <p class="text-sm text-on-surface-variant leading-relaxed" data-editable="${slug}-del-3-desc">${dv[2].desc || ''}</p>
        </div>
      </div>
    </section>

    <!-- Custom blocks added via admin -->
    <div id="admin-blocks" class="px-10 md:px-[80px]"></div>
  </main>
${nextSection}
${ctaHTML()}
${footerHTML()}
  <script type="module" src="/src/js/main.js"></script>
  <script type="module" src="/src/js/content-loader.js"></script>
  <script type="module" src="/src/js/analytics-sdk.js"></script>
  <script src="/src/js/cookie-consent.js"></script>
  <script>if('serviceWorker'in navigator)navigator.serviceWorker.register('/sw.js').catch(()=>{})</script>
</body>
</html>`
}

function buildInsightPage({ slug, title, category, date, excerpt, body }, nextItem) {
  const nextSection = nextItem ? `
    <section class="border-t border-black/10 bg-background">
      <a href="/insights/${nextItem.slug}.html" class="group block px-10 md:px-[80px] py-24">
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-8">
          <div>
            <span class="label-caps text-[10px] text-on-surface-variant/60 tracking-[0.3em] block mb-4">Next Insight</span>
            <h2 class="font-display text-[48px] md:text-[72px] uppercase leading-none group-hover:text-accent transition-colors duration-300">${nextItem.title}</h2>
          </div>
          <span class="material-symbols-outlined text-accent text-5xl md:text-7xl transform group-hover:translate-x-3 group-hover:-translate-y-3 transition-transform duration-300">north_east</span>
        </div>
      </a>
    </section>` : ''
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
${nextSection}
${ctaHTML()}
${footerHTML()}
  <script type="module" src="/src/js/main.js"></script>
  <script type="module" src="/src/js/content-loader.js"></script>
  <script type="module" src="/src/js/analytics-sdk.js"></script>
  <script src="/src/js/cookie-consent.js"></script>
  <script>if('serviceWorker'in navigator)navigator.serviceWorker.register('/sw.js').catch(()=>{})</script>
</body>
</html>`
}

// ── Standalone mode (npm run admin) ─────────────────────────────────────────
const isMain = process.argv[1] === fileURLToPath(import.meta.url) || process.env.NODE_ENV === 'production'
if (isMain) {
  patchFsWrites(CONTENT_DIR)        // intercept writes → mirror to DB
  await restoreFromDb(CONTENT_DIR)  // pull saved content from DB on startup
  const app = createApiApp()
  app.use('/admin', express.static(path.join(__dirname, 'admin')))
  // Serve pre-compiled Tailwind CSS if available (production).
  // In dev, Vite intercepts /src/css/main.css before Express touches it.
  const compiledCss = path.join(__dirname, 'public', 'css', 'main.css')
  if (fs.existsSync(compiledCss)) {
    app.get('/src/css/main.css', (_req, res) => res.sendFile(compiledCss))
  }
  app.get('/:page.html', (req, res, next) => {
    const filePath = path.join(__dirname, req.params.page + '.html')
    if (fs.existsSync(filePath)) return res.sendFile(filePath)
    next()
  })

  // Rewrite clean URLs → .html before static serving
  app.use((req, res, next) => {
    const p = req.path
    if (!path.extname(p) && p !== '/' && !p.startsWith('/api')) {
      const candidate = path.join(__dirname, p + '.html')
      if (fs.existsSync(candidate)) { req.url = p + '.html'; return next() }
    }
    next()
  })
  // Server-side HTML enrichment: title, OG tags, favicon, SSR content data + image src injection
  app.use((req, res, next) => {
    const p = req.path
    const resolved = p === '/' ? '/index.html' : p
    if (!resolved.endsWith('.html') || resolved.startsWith('/admin')) return next()
    const filePath = path.join(__dirname, resolved)
    if (!fs.existsSync(filePath)) return next()
    try {
      let html = fs.readFileSync(filePath, 'utf8')
      const site = getSiteSettings()
      const esc = s => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;')

      // Fix <title> tag
      if (site.siteTitle) {
        html = html.replace(/<title>[^<]*<\/title>/, `<title>${esc(site.siteTitle)}</title>`)
      }

      // Build head injection tags
      let headTags = ''
      if (site.favicon) headTags += `\n  <link rel="icon" href="${site.favicon}"/>`
      if (site.siteTitle) headTags += `\n  <meta property="og:title" content="${esc(site.siteTitle)}"/>`
      if (site.metaDescription) headTags += `\n  <meta property="og:description" content="${esc(site.metaDescription)}"/>`
      if (site.ogImage) headTags += `\n  <meta property="og:image" content="${site.ogImage}"/>`

      // Determine page key and load content files for SSR data injection
      const pageKey = resolved === '/index.html' ? 'home'
        : resolved.replace(/^\//, '').replace(/\.html$/, '')
      const ssrData = {}
      for (const key of [pageKey, 'navigation', 'footer']) {
        const cf = path.join(CONTENT_DIR, `${key}.json`)
        if (fs.existsSync(cf)) {
          try { ssrData[key] = JSON.parse(fs.readFileSync(cf, 'utf8')) } catch {}
        }
      }

      // Server-side image src replacement — eliminates image FOUC entirely
      const pageFields = (ssrData[pageKey] || {}).fields || {}
      for (const [key, value] of Object.entries(pageFields)) {
        const val = typeof value === 'object' && value !== null ? value.value : value
        if (!val || typeof val !== 'string') continue
        // Replace src and remove display:none on <img data-editable="key"> elements
        html = html.replace(
          new RegExp(`(<img(?=[^>]*data-editable="${key}")[^>]*\\bsrc=")[^"]*"`, 'g'),
          `$1${val}"`
        )
        html = html.replace(
          new RegExp(`(<img(?=[^>]*data-editable="${key}")[^>]*)\\sstyle="display:none"`, 'g'),
          '$1'
        )
      }

      // Server-side nav logo replacement — eliminates logo FOUC
      const navFields = (ssrData['navigation'] || {}).fields || {}
      if (navFields.logoImage || navFields.logoText) {
        const logoInner = navFields.logoImage
          ? `<img src="${navFields.logoImage}" alt="${esc(navFields.logoText || '')}" style="height:${navFields.logoHeight || 28}px;object-fit:contain;display:block">`
          : esc(navFields.logoText)
        html = html.replace(
          /(<[^>]*\bdata-nav-logo\b[^>]*>)[^<]*(<\/[^>]+>)/g,
          `$1${logoInner}$2`
        )
      }

      // Server-side footer logo replacement — eliminates footer logo FOUC
      const footerFields = (ssrData['footer'] || {}).fields || {}
      if (footerFields.footerLogo) {
        const footerLogoImg = `<img src="${footerFields.footerLogo}" alt="" style="width:100%;height:auto;display:block;object-fit:contain">`
        html = html.replace(
          /(<[^>]*\bdata-footer-logo\b[^>]*>)[\s\S]*?<\/div>\s*(<\/div>)/,
          `$1${footerLogoImg}$2`
        )
      }

      // Inject SSR data as inline script so content-loader.js can apply it synchronously
      const ssrScript = Object.keys(ssrData).length
        ? `\n  <script>window.__SSR_DATA__=${JSON.stringify(ssrData)}</script>`
        : ''

      if (!headTags && !ssrScript) return next()
      html = html.replace('</head>', headTags + ssrScript + '\n</head>')
      res.setHeader('Content-Type', 'text/html; charset=utf-8')
      return res.send(html)
    } catch { return next() }
  })
  app.use(express.static(path.join(__dirname), {
    setHeaders(res, fp) {
      if (fp.includes('/uploads/') || fp.includes('/src/css/') || fp.includes('/src/js/')) {
        res.setHeader('Cache-Control', 'public, max-age=86400')
      }
    },
  }))
  app.use((req, res) => res.status(404).sendFile(path.join(__dirname, '404.html')))
  app.listen(PORT, () => {
    console.log(`\n  ◆ Site + Admin  →  http://localhost:${PORT}`)
    console.log(`    Password      →  ${DEFAULT_PASS}\n`)
  })
}
