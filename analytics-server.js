/**
 * Analytics API — ingest + dashboard read endpoints
 *
 * Mounted in server.js:
 *   app.post('/api/analytics/ingest', ingestHandler)   ← public
 *   app.use('/api/analytics', auth, analyticsRouter)   ← protected
 */
import express from 'express'
import crypto  from 'crypto'

let prisma = null
try {
  const { PrismaClient } = await import('@prisma/client')
  prisma = new PrismaClient()
} catch {
  console.warn('[analytics] Prisma not available — analytics data will not be persisted. Set DATABASE_URL and run `npx prisma migrate deploy`.')
}

function dbOk() { return !!prisma }

// ── Bot patterns ──────────────────────────────────────────────────────────────
const BOT_RE = /bot|crawl|spider|slurp|mediapartners|googlebot|bingbot|yandex|baidu|duckduckbot|facebookexternalhit|linkedinbot|twitterbot|applebot|pingdom|uptimerobot|semrush|ahrefs|mj12bot|dotbot|petalbot|bytespider/i

// ── Rate limiter (in-memory, per IP) ─────────────────────────────────────────
const rateStore = new Map()
setInterval(() => {
  const now = Date.now()
  for (const [k, v] of rateStore) if (now > v.reset) rateStore.delete(k)
}, 5 * 60_000)

function isRateLimited(ip, limit = 120, windowMs = 60_000) {
  const now = Date.now()
  const entry = rateStore.get(ip)
  if (!entry || now > entry.reset) { rateStore.set(ip, { count: 1, reset: now + windowMs }); return false }
  if (entry.count >= limit) return true
  entry.count++
  return false
}

// ── Geo lookup ────────────────────────────────────────────────────────────────
const _geoCache = new Map()
const _PRIVATE_RE = /^(127\.|10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|::1$|fd|fc)/i

async function lookupCountry(ip) {
  if (!ip || _PRIVATE_RE.test(ip)) return null
  if (_geoCache.has(ip)) return _geoCache.get(ip)
  try {
    const r = await fetch(`http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,country`, {
      signal: AbortSignal.timeout(3000),
    })
    if (!r.ok) { _geoCache.set(ip, null); return null }
    const d = await r.json()
    const country = (d.status === 'success' && d.country) ? d.country : null
    _geoCache.set(ip, country)
    if (_geoCache.size > 2000) _geoCache.delete(_geoCache.keys().next().value)
    return country
  } catch {
    _geoCache.set(ip, null)
    return null
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function anonymizeIp(ip = '') {
  const masked = ip.includes(':')
    ? ip.split(':').slice(0, 4).join(':') + '::'          // IPv6 — keep /64
    : ip.split('.').slice(0, 3).join('.') + '.0'          // IPv4 — zero last octet
  return crypto.createHash('sha256').update(masked).digest('hex').slice(0, 16)
}

function parseDevice(ua = '') {
  if (/mobile|android|iphone|ipod|blackberry|opera mini|iemobile/i.test(ua)) return 'mobile'
  if (/ipad|tablet|kindle|playbook|silk/i.test(ua)) return 'tablet'
  return 'desktop'
}

function parseBrowser(ua = '') {
  if (/edg\//i.test(ua))                            return 'Edge'
  if (/opr\/|opera/i.test(ua))                      return 'Opera'
  if (/chrome\/\d/i.test(ua))                       return 'Chrome'
  if (/firefox\/\d/i.test(ua))                      return 'Firefox'
  if (/safari\/\d/i.test(ua) && !/chrome/i.test(ua)) return 'Safari'
  if (/msie|trident/i.test(ua))                     return 'IE'
  return 'Other'
}

function parseOs(ua = '') {
  if (/windows/i.test(ua))          return 'Windows'
  if (/android/i.test(ua))          return 'Android'
  if (/iphone|ipad|ipod/i.test(ua)) return 'iOS'
  if (/mac os x|macos/i.test(ua))   return 'macOS'
  if (/linux/i.test(ua))            return 'Linux'
  return 'Other'
}

function parseSource(referrer = '') {
  if (!referrer) return 'Direct'
  try {
    const host = new URL(referrer).hostname.replace(/^www\./, '')
    if (/google\./i.test(host))     return 'Google'
    if (/bing\.com/i.test(host))    return 'Bing'
    if (/facebook|fb\.com/i.test(host)) return 'Facebook'
    if (/instagram\.com/i.test(host))   return 'Instagram'
    if (/twitter\.com|x\.com/i.test(host)) return 'Twitter/X'
    if (/linkedin\.com/i.test(host))    return 'LinkedIn'
    if (/behance\.net/i.test(host))     return 'Behance'
    if (/dribbble\.com/i.test(host))    return 'Dribbble'
    return host
  } catch { return 'Direct' }
}

function getDateRange(range = '30d') {
  const days = range === '7d' ? 7 : range === '90d' ? 90 : 30
  const from = new Date(Date.now() - days * 86_400_000)
  return { from, to: new Date() }
}

// ══════════════════════════════════════════════════════════════════════════════
// PUBLIC — ingest handler (no auth required, called from the live site)
// ══════════════════════════════════════════════════════════════════════════════
export async function ingestHandler(req, res) {
  const ip = ((req.headers['x-forwarded-for'] || '') + ',' + (req.socket?.remoteAddress || ''))
    .split(',')[0].trim()
  const ua = req.headers['user-agent'] || ''

  if (BOT_RE.test(ua))              return res.status(204).end()
  if (isRateLimited(ip))            return res.status(429).end()
  if (req.headers['dnt'] === '1')   return res.status(204).end()

  const { type, sessionId, visitorId, path, title, referrer, duration,
          name, properties, fcp, lcp, cls, fid, inp, ttfb, loadTime,
          utmSource, utmMedium, utmCampaign, isNew, entryPage } = req.body || {}

  if (!type || !visitorId) return res.status(400).end()
  if (!dbOk()) return res.status(204).end()

  const ipHash = anonymizeIp(ip)

  try {
    if (type === 'session_start') {
      await prisma.session.upsert({
        where:  { id: sessionId },
        create: {
          id: sessionId, visitorId, ipHash,
          device:      parseDevice(ua),
          browser:     parseBrowser(ua),
          os:          parseOs(ua),
          referrer:    referrer || null,
          utmSource:   utmSource  || null,
          utmMedium:   utmMedium  || null,
          utmCampaign: utmCampaign || null,
          entryPage:   path || '/',
          isNew:       isNew !== false,
          lastSeenAt:  new Date(),
        },
        update: { lastSeenAt: new Date() },
      })
      // Async geo lookup — don't block the response
      lookupCountry(ip).then(country => {
        if (country) prisma.session.updateMany({ where: { id: sessionId }, data: { country } }).catch(() => {})
      }).catch(() => {})

    } else if (type === 'pageview') {
      if (!sessionId) return res.status(400).end()
      await prisma.$transaction([
        prisma.pageView.create({
          data: { sessionId, visitorId, path, title: title || null, referrer: referrer || null },
        }),
        prisma.session.updateMany({
          where: { id: sessionId },
          data:  { lastSeenAt: new Date(), exitPage: path, pageViewCount: { increment: 1 } },
        }),
      ])

    } else if (type === 'event') {
      if (!sessionId || !name) return res.status(400).end()
      await prisma.event.create({
        data: { sessionId, visitorId, name, properties: properties || null, path: path || '/' },
      })

    } else if (type === 'performance') {
      if (!sessionId) return res.status(400).end()
      await prisma.performanceMetric.create({
        data: {
          sessionId, path: path || '/',
          fcp: fcp || null, lcp: lcp || null, cls: cls || null,
          fid: fid || null, inp: inp || null, ttfb: ttfb || null,
          loadTime: loadTime || null,
        },
      })

    } else if (type === 'ping' || type === 'exit') {
      if (!sessionId) return res.status(400).end()
      await prisma.session.updateMany({
        where: { id: sessionId },
        data:  {
          lastSeenAt: new Date(),
          ...(duration != null  && { duration }),
          ...(type === 'exit' && path && { exitPage: path }),
        },
      })
    }

    res.status(204).end()
  } catch (err) {
    console.error('[Analytics] ingest error:', err.message)
    res.status(500).end()
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// PROTECTED READ ROUTER (auth middleware applied in server.js)
// ══════════════════════════════════════════════════════════════════════════════
export const analyticsRouter = express.Router()

// GET /api/analytics/overview?range=30d
analyticsRouter.get('/overview', async (req, res) => {
  if (!dbOk()) return res.json({ totalVisitors:0,totalSessions:0,pageViews:0,newVisitors:0,returningVisitors:0,avgDuration:0,bounceRate:0,changes:{visitors:0,pageViews:0} })
  try {
    const { from, to } = getDateRange(req.query.range)
    const prevFrom = new Date(from - (to - from))

    const [sessions, prevSessions, pageViews, prevPageViews] = await Promise.all([
      prisma.session.findMany({
        where:  { startedAt: { gte: from, lte: to } },
        select: { visitorId: true, isNew: true, duration: true, pageViewCount: true },
      }),
      prisma.session.findMany({
        where:  { startedAt: { gte: prevFrom, lt: from } },
        select: { visitorId: true },
      }),
      prisma.pageView.count({ where: { timestamp: { gte: from, lte: to } } }),
      prisma.pageView.count({ where: { timestamp: { gte: prevFrom, lt: from } } }),
    ])

    const totalVisitors     = new Set(sessions.map(s => s.visitorId)).size
    const prevTotalVisitors = new Set(prevSessions.map(s => s.visitorId)).size
    const totalSessions     = sessions.length
    const newVisitors       = sessions.filter(s => s.isNew).length
    const durSessions       = sessions.filter(s => s.duration != null && s.duration > 0)
    const avgDuration       = durSessions.length
      ? Math.round(durSessions.reduce((a, s) => a + s.duration, 0) / durSessions.length)
      : 0
    const bounceRate = totalSessions > 0
      ? Math.round(sessions.filter(s => s.pageViewCount <= 1).length / totalSessions * 100)
      : 0

    const pct = (c, p) => p > 0 ? Math.round((c - p) / p * 100) : c > 0 ? 100 : 0

    res.json({
      totalVisitors, totalSessions, pageViews, newVisitors,
      returningVisitors: totalSessions - newVisitors,
      avgDuration, bounceRate,
      changes: { visitors: pct(totalVisitors, prevTotalVisitors), pageViews: pct(pageViews, prevPageViews) },
    })
  } catch (err) {
    console.error('[Analytics] overview error:', err.message)
    res.status(500).json({ error: 'Internal error' })
  }
})

// GET /api/analytics/timeseries?range=30d
analyticsRouter.get('/timeseries', async (req, res) => {
  if (!dbOk()) return res.json([])
  try {
    const { from } = getDateRange(req.query.range)
    const [pageViews, sessions] = await Promise.all([
      prisma.pageView.findMany({
        where:   { timestamp: { gte: from } },
        select:  { timestamp: true },
        orderBy: { timestamp: 'asc' },
      }),
      prisma.session.findMany({
        where:   { startedAt: { gte: from } },
        select:  { startedAt: true, visitorId: true },
        orderBy: { startedAt: 'asc' },
      }),
    ])

    const dayMap = {}
    pageViews.forEach(pv => {
      const day = pv.timestamp.toISOString().slice(0, 10)
      if (!dayMap[day]) dayMap[day] = { pageViews: 0, visitors: new Set() }
      dayMap[day].pageViews++
    })
    sessions.forEach(s => {
      const day = s.startedAt.toISOString().slice(0, 10)
      if (!dayMap[day]) dayMap[day] = { pageViews: 0, visitors: new Set() }
      dayMap[day].visitors.add(s.visitorId)
    })

    res.json(Object.entries(dayMap)
      .map(([date, d]) => ({ date, pageViews: d.pageViews, visitors: d.visitors.size }))
      .sort((a, b) => a.date.localeCompare(b.date)))
  } catch (err) {
    console.error('[Analytics] timeseries error:', err.message)
    res.status(500).json({ error: 'Internal error' })
  }
})

// GET /api/analytics/pages?range=30d
analyticsRouter.get('/pages', async (req, res) => {
  if (!dbOk()) return res.json([])
  try {
    const { from } = getDateRange(req.query.range)
    const pages = await prisma.pageView.groupBy({
      by:      ['path'],
      where:   { timestamp: { gte: from } },
      _count:  { path: true },
      orderBy: { _count: { path: 'desc' } },
      take:    20,
    })
    res.json(pages.map(p => ({ path: p.path, views: p._count.path })))
  } catch (err) {
    console.error('[Analytics] pages error:', err.message)
    res.status(500).json({ error: 'Internal error' })
  }
})

// GET /api/analytics/sources?range=30d
analyticsRouter.get('/sources', async (req, res) => {
  if (!dbOk()) return res.json([])
  try {
    const { from } = getDateRange(req.query.range)
    const sessions = await prisma.session.findMany({
      where:  { startedAt: { gte: from } },
      select: { referrer: true, utmSource: true },
    })
    const map = {}
    sessions.forEach(s => {
      const src = s.utmSource || parseSource(s.referrer || '')
      map[src] = (map[src] || 0) + 1
    })
    res.json(Object.entries(map)
      .map(([source, count]) => ({ source, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10))
  } catch (err) {
    console.error('[Analytics] sources error:', err.message)
    res.status(500).json({ error: 'Internal error' })
  }
})

// GET /api/analytics/devices?range=30d
analyticsRouter.get('/devices', async (req, res) => {
  if (!dbOk()) return res.json({ devices: [], browsers: [] })
  try {
    const { from } = getDateRange(req.query.range)
    const [devices, browsers] = await Promise.all([
      prisma.session.groupBy({
        by:      ['device'],
        where:   { startedAt: { gte: from } },
        _count:  { device: true },
        orderBy: { _count: { device: 'desc' } },
      }),
      prisma.session.groupBy({
        by:      ['browser'],
        where:   { startedAt: { gte: from } },
        _count:  { browser: true },
        orderBy: { _count: { browser: 'desc' } },
        take:    6,
      }),
    ])
    res.json({
      devices:  devices.map(d => ({ device: d.device || 'Unknown', count: d._count.device })),
      browsers: browsers.map(b => ({ browser: b.browser || 'Unknown', count: b._count.browser })),
    })
  } catch (err) {
    console.error('[Analytics] devices error:', err.message)
    res.status(500).json({ error: 'Internal error' })
  }
})

// GET /api/analytics/events?range=30d
analyticsRouter.get('/events', async (req, res) => {
  if (!dbOk()) return res.json([])
  try {
    const { from } = getDateRange(req.query.range)
    const events = await prisma.event.groupBy({
      by:      ['name'],
      where:   { timestamp: { gte: from } },
      _count:  { name: true },
      orderBy: { _count: { name: 'desc' } },
      take:    10,
    })
    res.json(events.map(e => ({ name: e.name, count: e._count.name })))
  } catch (err) {
    console.error('[Analytics] events error:', err.message)
    res.status(500).json({ error: 'Internal error' })
  }
})

// GET /api/analytics/performance?range=30d
analyticsRouter.get('/performance', async (req, res) => {
  if (!dbOk()) return res.json({ fcp:0, lcp:0, cls:'0.000', ttfb:0, loadTime:0 })
  try {
    const { from } = getDateRange(req.query.range)
    const agg = await prisma.performanceMetric.aggregate({
      where: { timestamp: { gte: from } },
      _avg:  { fcp: true, lcp: true, cls: true, ttfb: true, loadTime: true },
    })
    res.json({
      fcp:      Math.round(agg._avg.fcp      || 0),
      lcp:      Math.round(agg._avg.lcp      || 0),
      cls:      (agg._avg.cls || 0).toFixed(3),
      ttfb:     Math.round(agg._avg.ttfb     || 0),
      loadTime: Math.round(agg._avg.loadTime || 0),
    })
  } catch (err) {
    console.error('[Analytics] performance error:', err.message)
    res.status(500).json({ error: 'Internal error' })
  }
})

// GET /api/analytics/locations?range=30d
analyticsRouter.get('/locations', async (req, res) => {
  if (!dbOk()) return res.json([])
  try {
    const { from } = getDateRange(req.query.range)
    const rows = await prisma.session.groupBy({
      by:      ['country'],
      where:   { startedAt: { gte: from }, country: { not: null } },
      _count:  { country: true },
      orderBy: { _count: { country: 'desc' } },
      take:    15,
    })
    res.json(rows.map(r => ({ country: r.country, count: r._count.country })))
  } catch (err) {
    console.error('[Analytics] locations error:', err.message)
    res.status(500).json({ error: 'Internal error' })
  }
})

// GET /api/analytics/realtime
analyticsRouter.get('/realtime', async (req, res) => {
  if (!dbOk()) return res.json({ activeVisitors: 0, activePages: [] })
  try {
    const since = new Date(Date.now() - 5 * 60_000)
    const active = await prisma.session.findMany({
      where:   { lastSeenAt: { gte: since } },
      select:  { exitPage: true, entryPage: true },
      orderBy: { lastSeenAt: 'desc' },
    })
    const pageMap = {}
    active.forEach(s => {
      const p = s.exitPage || s.entryPage
      pageMap[p] = (pageMap[p] || 0) + 1
    })
    res.json({
      activeVisitors: active.length,
      activePages: Object.entries(pageMap)
        .map(([page, count]) => ({ page, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5),
    })
  } catch (err) {
    console.error('[Analytics] realtime error:', err.message)
    res.status(500).json({ error: 'Internal error' })
  }
})
