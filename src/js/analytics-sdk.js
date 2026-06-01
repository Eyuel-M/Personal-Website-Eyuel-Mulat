/**
 * Lightweight analytics SDK — auto-tracks pageviews, sessions,
 * Core Web Vitals, and exposes window.EMAnalytics.track() / window.track().
 *
 * Drop-in: included via <script type="module"> on all public pages.
 * Never runs inside /admin.
 */
;(function () {
  'use strict'

  // Skip admin pages and non-browser envs
  if (typeof window === 'undefined') return
  if (location.pathname.startsWith('/admin')) return

  // Respect Do Not Track
  if (navigator.doNotTrack === '1') return

  // Respect cookie consent — decline means no analytics
  if (localStorage.getItem('em_consent') === 'false') return

  const INGEST = '/api/analytics/ingest'
  const HEARTBEAT_MS = 30_000

  // ── Visitor + session identity ───────────────────────────────────────────────
  function getOrCreate(key, factory) {
    let v = localStorage.getItem(key)
    if (!v) { v = factory(); localStorage.setItem(key, v) }
    return v
  }
  function uid() {
    return 'v' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
  }
  const visitorId = getOrCreate('em_vid', uid)

  let sessionId = sessionStorage.getItem('em_sid')
  let sessionStart = parseInt(sessionStorage.getItem('em_sid_start') || '0', 10)
  const isNew = !sessionId

  if (!sessionId) {
    sessionId = uid()
    sessionStart = Date.now()
    sessionStorage.setItem('em_sid', sessionId)
    sessionStorage.setItem('em_sid_start', String(sessionStart))
    sessionStorage.setItem('em_entry', location.pathname)
  }

  // ── UTM params ───────────────────────────────────────────────────────────────
  const sp = new URLSearchParams(location.search)
  const utm = {
    source:   sp.get('utm_source')   || undefined,
    medium:   sp.get('utm_medium')   || undefined,
    campaign: sp.get('utm_campaign') || undefined,
  }

  // ── Send helper ──────────────────────────────────────────────────────────────
  function send(payload) {
    const body = JSON.stringify({ ...payload, sessionId, visitorId })
    if (navigator.sendBeacon) {
      navigator.sendBeacon(INGEST, new Blob([body], { type: 'application/json' }))
    } else {
      fetch(INGEST, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive: true }).catch(() => {})
    }
  }

  // ── session_start ────────────────────────────────────────────────────────────
  if (isNew) {
    send({
      type: 'session_start',
      entryPage: location.pathname,
      referrer: document.referrer || undefined,
      utmSource: utm.source,
      utmMedium: utm.medium,
      utmCampaign: utm.campaign,
      isNew: true,
    })
  }

  // ── pageview ─────────────────────────────────────────────────────────────────
  let pageViewStart = Date.now()
  let lastPath = location.pathname

  function trackPageView(path) {
    send({
      type: 'pageview',
      path,
      title: document.title,
      referrer: document.referrer || undefined,
    })
  }
  trackPageView(location.pathname)

  // View Transitions API: fire pageview on each navigation
  document.addEventListener('pagereveal', () => {
    const path = location.pathname
    if (path !== lastPath) {
      // record duration for previous page
      send({ type: 'pageview_duration', path: lastPath, duration: Math.round((Date.now() - pageViewStart) / 1000) })
      pageViewStart = Date.now()
      lastPath = path
      trackPageView(path)
    }
  })

  // ── Heartbeat pings (keep session alive) ─────────────────────────────────────
  setInterval(() => {
    send({ type: 'ping', path: location.pathname })
  }, HEARTBEAT_MS)

  // ── Exit tracking ────────────────────────────────────────────────────────────
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      send({
        type: 'exit',
        exitPage: location.pathname,
        duration: Math.round((Date.now() - sessionStart) / 1000),
      })
    }
  })

  // ── Core Web Vitals ──────────────────────────────────────────────────────────
  const vitals = {}

  function sendVitals() {
    if (Object.keys(vitals).length) {
      send({ type: 'performance', path: location.pathname, ...vitals })
    }
  }

  if ('PerformanceObserver' in window) {
    // FCP
    try {
      new PerformanceObserver(list => {
        for (const e of list.getEntries()) {
          if (e.name === 'first-contentful-paint') vitals.fcp = Math.round(e.startTime)
        }
      }).observe({ type: 'paint', buffered: true })
    } catch {}

    // LCP
    try {
      new PerformanceObserver(list => {
        const entries = list.getEntries()
        if (entries.length) vitals.lcp = Math.round(entries[entries.length - 1].startTime)
      }).observe({ type: 'largest-contentful-paint', buffered: true })
    } catch {}

    // CLS
    try {
      let clsValue = 0
      new PerformanceObserver(list => {
        for (const e of list.getEntries()) {
          if (!e.hadRecentInput) clsValue += e.value
        }
        vitals.cls = Math.round(clsValue * 1000) / 1000
      }).observe({ type: 'layout-shift', buffered: true })
    } catch {}

    // FID
    try {
      new PerformanceObserver(list => {
        for (const e of list.getEntries()) {
          vitals.fid = Math.round(e.processingStart - e.startTime)
        }
      }).observe({ type: 'first-input', buffered: true })
    } catch {}

    // INP (Interaction to Next Paint)
    try {
      new PerformanceObserver(list => {
        for (const e of list.getEntries()) {
          if (e.duration > (vitals.inp || 0)) vitals.inp = Math.round(e.duration)
        }
      }).observe({ type: 'event', buffered: true, durationThreshold: 16 })
    } catch {}

    // TTFB via navigation timing
    try {
      new PerformanceObserver(list => {
        for (const e of list.getEntries()) {
          vitals.ttfb = Math.round(e.responseStart - e.requestStart)
          vitals.loadTime = Math.round(e.loadEventEnd - e.startTime)
        }
        sendVitals()
      }).observe({ type: 'navigation', buffered: true })
    } catch {}
  }

  // Flush vitals on page hide
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') sendVitals()
  })

  // ── Public API ───────────────────────────────────────────────────────────────
  function track(name, properties) {
    if (!name) return
    send({ type: 'event', name, properties: properties || {}, path: location.pathname })
  }

  window.EMAnalytics = { track }
  window.track = track

  // ── Auto-track CTA / portfolio clicks ───────────────────────────────────────
  document.addEventListener('click', e => {
    const a = e.target.closest('a[href]')
    if (!a) return
    const href = a.getAttribute('href') || ''
    if (href.startsWith('/work/')) track('portfolio_click', { url: href, text: a.textContent.trim().slice(0, 80) })
    if (href === '/contact.html' || href.includes('contact')) track('cta_click', { url: href, text: a.textContent.trim().slice(0, 80) })
  }, true)

  // Auto-track form submissions
  document.addEventListener('submit', e => {
    const form = e.target
    if (form.tagName === 'FORM') {
      track('form_submit', { id: form.id || undefined, action: form.action || undefined })
    }
  }, true)
})()
