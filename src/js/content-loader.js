// Content-loader: applies page content overrides to data-editable elements.
// Server injects window.__SSR_DATA__ so content is applied synchronously
// (before any network fetch) to eliminate content flash on page load.

// ── Page key detection ────────────────────────────────────────────────────────
const _pathname = window.location.pathname
let _page = 'home'
if (_pathname.includes('/about'))        _page = 'about'
else if (_pathname.includes('/work') && !_pathname.includes('/work/')) _page = 'work'
else if (_pathname.includes('/work/'))   _page = _pathname.split('/work/')[1].replace('.html', '')
else if (_pathname.includes('/contact')) _page = 'contact'
else if (_pathname.includes('/insights') && !_pathname.includes('/insights/')) _page = 'insights'
else if (_pathname.includes('/insights/')) _page = _pathname.split('/insights/')[1].replace('.html', '')

const _isPreview = new URLSearchParams(window.location.search).has('preview')
const _apiBase = _isPreview ? '/api/preview' : '/api/content'

// ── sessionStorage cache helpers ──────────────────────────────────────────────
function getCached(key) { try { const v = sessionStorage.getItem('em_cl_' + key); return v ? JSON.parse(v) : null } catch { return null } }
function setCache(key, data) { try { sessionStorage.setItem('em_cl_' + key, JSON.stringify(data)) } catch {} }

// ── Apply page content ────────────────────────────────────────────────────────
function applyPageData(data) {
  const { fields = {}, blocks = [] } = data

  document.querySelectorAll('[data-editable]').forEach(el => {
    const id   = el.dataset.editable
    const type = el.dataset.editableType || 'text'
    const raw  = fields[id]
    if (raw === null || raw === undefined || raw === '') return
    const ov = (raw !== null && typeof raw === 'object') ? raw : { value: raw }

    if (type === 'image') {
      if (ov.value) { el.src = ov.value; el.style.display = '' }
    } else if (type === 'html') {
      if (ov.value) {
        el.innerHTML = ov.value
        el.querySelectorAll('a').forEach(a => { a.target = '_blank'; a.rel = 'noopener noreferrer' })
      }
    } else {
      if (ov.value !== undefined) el.textContent = ov.value
    }

    const m = ov.margin  || {}
    const p = ov.padding || {}
    if (m.top    !== undefined) el.style.marginTop    = m.top    + 'px'
    if (m.right  !== undefined) el.style.marginRight  = m.right  + 'px'
    if (m.bottom !== undefined) el.style.marginBottom = m.bottom + 'px'
    if (m.left   !== undefined) el.style.marginLeft   = m.left   + 'px'
    if (p.top    !== undefined) el.style.paddingTop    = p.top    + 'px'
    if (p.right  !== undefined) el.style.paddingRight  = p.right  + 'px'
    if (p.bottom !== undefined) el.style.paddingBottom = p.bottom + 'px'
    if (p.left   !== undefined) el.style.paddingLeft   = p.left   + 'px'
    if (ov.fontSize)   el.style.fontSize   = ov.fontSize
    if (ov.fontWeight) el.style.fontWeight  = ov.fontWeight
    if (ov.color)      el.style.color       = ov.color
  })

  const blockZone = document.getElementById('admin-blocks')
  if (blockZone) {
    blockZone.innerHTML = ''
    blocks.forEach(block => {
      const el = document.createElement('div')
      el.style.cssText = [
        block.margin?.top    ? `margin-top:${block.margin.top}px`       : '',
        block.margin?.right  ? `margin-right:${block.margin.right}px`   : '',
        block.margin?.bottom ? `margin-bottom:${block.margin.bottom}px` : 'margin-bottom:40px',
        block.margin?.left   ? `margin-left:${block.margin.left}px`     : '',
        block.padding?.top    ? `padding-top:${block.padding.top}px`    : '',
        block.padding?.right  ? `padding-right:${block.padding.right}px`: '',
        block.padding?.bottom ? `padding-bottom:${block.padding.bottom}px`: '',
        block.padding?.left   ? `padding-left:${block.padding.left}px`  : '',
      ].filter(Boolean).join(';')

      if (block.type === 'image') {
        if (!block.value) return
        const img = document.createElement('img')
        img.src = block.value
        img.alt = block.label || ''
        img.className = 'w-full object-cover'
        if (block.height) img.style.height = block.height + 'px'
        el.appendChild(img)

      } else if (block.type === 'html') {
        if (block.title) {
          const h = document.createElement('h2')
          h.className = 'font-display text-[32px] md:text-[40px] uppercase leading-tight mb-6'
          h.textContent = block.title
          el.appendChild(h)
        }
        const div = document.createElement('div')
        div.className = 'text-base text-on-surface-variant leading-relaxed max-w-2xl'
        div.innerHTML = block.value || ''
        div.querySelectorAll('a').forEach(a => { a.target = '_blank'; a.rel = 'noopener noreferrer' })
        el.appendChild(div)

      } else if (block.type === 'grid2' || block.type === 'grid2x2') {
        const maxCells = block.type === 'grid2' ? 2 : 4
        const grid = document.createElement('div')
        grid.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,280px),1fr));gap:32px'
        const cells = block.cells || (block.images || []).map(u => ({ type: 'image', url: u }))
        cells.slice(0, maxCells).forEach(cell => {
          const wrapper = document.createElement('div')
          if (cell.type === 'text') {
            if (cell.title) {
              const h = document.createElement('h3')
              h.className = 'font-display text-[24px] uppercase leading-tight mb-3'
              h.textContent = cell.title
              wrapper.appendChild(h)
            }
            const div = document.createElement('div')
            div.className = 'text-base text-on-surface-variant leading-relaxed prose-article'
            div.innerHTML = cell.html || ''
            div.querySelectorAll('a').forEach(a => { a.target = '_blank'; a.rel = 'noopener noreferrer' })
            wrapper.appendChild(div)
          } else {
            if (!cell.url) return
            const img = document.createElement('img')
            img.src = cell.url
            img.className = 'w-full object-cover aspect-square'
            wrapper.appendChild(img)
          }
          grid.appendChild(wrapper)
        })
        el.appendChild(grid)

      } else if (block.type === 'heading') {
        const h = document.createElement('h2')
        h.className = 'font-display text-[40px] md:text-[56px] uppercase leading-tight reveal'
        h.textContent = block.value || ''
        el.appendChild(h)

      } else if (block.type === 'divider') {
        el.className = 'border-t border-black/10 my-12'

      } else {
        const p = document.createElement('p')
        p.className = 'text-base text-on-surface-variant leading-relaxed max-w-2xl reveal'
        if (block.fontSize) p.style.fontSize = block.fontSize
        if (block.color)    p.style.color    = block.color
        p.textContent = block.value || ''
        el.appendChild(p)
      }

      blockZone.appendChild(el)
    })
  }
}

// ── Apply navigation data ─────────────────────────────────────────────────────
function applyNavData(navData) {
  const nf = navData.fields || {}
  const logoText   = nf.logoText
  const logoImage  = nf.logoImage
  const logoHeight = nf.logoHeight || 28
  const lm         = nf.logoMargins || {}
  if (logoText || logoImage) {
    document.querySelectorAll('[data-nav-logo]').forEach(el => {
      if (lm.marginTop    !== undefined) el.style.marginTop    = lm.marginTop    + 'px'
      if (lm.marginRight  !== undefined) el.style.marginRight  = lm.marginRight  + 'px'
      if (lm.marginBottom !== undefined) el.style.marginBottom = lm.marginBottom + 'px'
      if (lm.marginLeft   !== undefined) el.style.marginLeft   = lm.marginLeft   + 'px'
      el.innerHTML = ''
      if (logoImage) {
        const img = document.createElement('img')
        img.src = logoImage
        img.alt = logoText || ''
        img.style.cssText = `height:${logoHeight}px;object-fit:contain;display:block`
        el.appendChild(img)
      } else {
        el.textContent = logoText
      }
    })
  }
  const links = Array.isArray(nf.navLinks) ? nf.navLinks : []
  if (links.length) {
    const midNav = document.querySelector('nav .hidden.md\\:flex')
    if (midNav) {
      const currentPage = window.location.pathname
      midNav.innerHTML = ''
      links.filter(l => l.href !== '/contact.html').forEach(l => {
        const a = document.createElement('a')
        a.href = l.href
        a.textContent = l.label
        a.className = 'nav-link'
        if (currentPage === l.href || currentPage.startsWith(l.href.replace('.html',''))) a.classList.add('is-active')
        midNav.appendChild(a)
      })
    }
    const ctaLink = links.find(l => l.href === '/contact.html')
    if (ctaLink) {
      document.querySelectorAll('[data-nav="contact"]').forEach(el => {
        el.href = ctaLink.href
        el.textContent = ctaLink.label
      })
    }
  }
}

// ── Apply footer data ─────────────────────────────────────────────────────────
function applyFooterData(ff) {
  if (ff.footerLogo) {
    document.querySelectorAll('[data-footer-logo]').forEach(el => {
      el.innerHTML = `<img src="${ff.footerLogo}" alt="" style="width:100%;height:auto;display:block;object-fit:contain">`
    })
  }
  if (ff.email) {
    document.querySelectorAll('[data-footer-email]').forEach(el => {
      el.textContent = ff.email
      if (el.tagName === 'A') el.href = 'mailto:' + ff.email
    })
  }
  if (ff.phone) {
    document.querySelectorAll('[data-footer-phone]').forEach(el => el.textContent = ff.phone)
  }
  if (ff.address) {
    document.querySelectorAll('[data-footer-address]').forEach(el => el.textContent = ff.address)
  }
  if (ff.copyright) {
    document.querySelectorAll('[data-footer-copyright]').forEach(el => el.textContent = ff.copyright)
  }
  if (Array.isArray(ff.socialLinks) && ff.socialLinks.length) {
    document.querySelectorAll('[data-footer-social]').forEach(el => {
      const header = el.querySelector('span')
      el.innerHTML = ''
      if (header) el.appendChild(header)
      ff.socialLinks.forEach(link => {
        if (!link.label) return
        const a = document.createElement('a')
        a.href = link.url || '#'
        a.target = '_blank'
        a.rel = 'noopener noreferrer'
        a.textContent = link.label
        a.className = 'label-caps text-[11px] tracking-[0.2em] text-background/80 hover:text-background transition-colors'
        el.appendChild(a)
      })
    })
  }
  if (Array.isArray(ff.footerLinks) && ff.footerLinks.length) {
    let allNavLinks = []
    try {
      const nc = JSON.parse(localStorage.getItem('em_nav_cache') || '{}')
      allNavLinks = Array.isArray(nc.navLinks) ? nc.navLinks : []
    } catch {}
    const KNOWN_LABELS = { '/terms.html': 'Terms & Conditions', '/privacy.html': 'Privacy' }
    const selected = ff.footerLinks
      .filter(href => href !== '/terms.html' && href !== '/privacy.html')
      .map(href => {
        const found = allNavLinks.find(l => l.href === href)
        return found || { href, label: KNOWN_LABELS[href] || href.replace(/\//g, '').replace('.html', '') }
      })
    document.querySelectorAll('[data-footer-pages]').forEach(el => {
      el.innerHTML = ''
      const header = document.createElement('span')
      header.className = 'label-caps text-[10px] tracking-[0.3em] text-background/50 mb-3 block'
      header.textContent = 'Pages'
      el.appendChild(header)
      const row = document.createElement('div')
      row.style.cssText = 'display:flex;flex-direction:row;gap:32px;align-items:flex-start'
      for (let c = 0; c < selected.length; c += 4) {
        const col = document.createElement('div')
        col.style.cssText = 'display:flex;flex-direction:column;gap:12px'
        selected.slice(c, c + 4).forEach(l => {
          const a = document.createElement('a')
          a.href = l.href
          a.textContent = l.label
          a.className = 'label-caps text-[11px] tracking-[0.2em] text-background/80 hover:text-background transition-colors'
          col.appendChild(a)
        })
        row.appendChild(col)
      }
      el.appendChild(row)
    })
  }
  if (ff.ctaLabel) {
    document.querySelectorAll('[data-cta-label]').forEach(el => el.textContent = ff.ctaLabel)
  }
  if (ff.ctaHeading) {
    document.querySelectorAll('[data-cta-heading]').forEach(el => el.innerHTML = ff.ctaHeading)
  }
  if (ff.ctaBtn || ff.ctaHref) {
    document.querySelectorAll('[data-cta-btn]').forEach(el => {
      if (ff.ctaHref) el.href = ff.ctaHref
      if (ff.ctaBtn) el.innerHTML = `${ff.ctaBtn} <span class="material-symbols-outlined text-accent" style="font-size:18px;line-height:1">north_east</span>`
    })
  }
}

// ── Synchronous: apply SSR-injected data to eliminate network-wait FOUC ───────
if (window.__SSR_DATA__) {
  const _d = window.__SSR_DATA__
  if (_d[_page])     applyPageData(_d[_page])
  if (_d.navigation) applyNavData(_d.navigation)
  if (_d.footer)     applyFooterData((_d.footer || {}).fields || {})
}

// ── Async: fetch fresh data and update sessionStorage cache ───────────────────
;(async () => {
  // On first session visit (no SSR data), fall back to cache to reduce flash
  if (!window.__SSR_DATA__) {
    const cp = getCached(_page);        if (cp) applyPageData(cp)
    const cn = getCached('navigation'); if (cn) applyNavData(cn)
    const cf = getCached('footer');     if (cf) applyFooterData(cf.fields || {})
  }

  try {
    const r = await fetch(`${_apiBase}/${_page}`)
    if (r.ok) { const d = await r.json(); setCache(_page, d); applyPageData(d) }
  } catch {}

  try {
    const r = await fetch(`${_apiBase}/navigation`)
    if (r.ok) { const d = await r.json(); setCache('navigation', d); applyNavData(d) }
  } catch {}

  try {
    const r = await fetch(`${_apiBase}/footer`)
    if (r.ok) { const d = await r.json(); setCache('footer', d); applyFooterData(d.fields || {}) }
  } catch {}

  try {
    const r = await fetch(`${_apiBase}/site`)
    if (r.ok) {
      const sd = await r.json()
      const sf = sd.fields || {}
      if (sf.favicon) {
        let link = document.querySelector("link[rel~='icon']")
        if (!link) { link = document.createElement('link'); link.rel = 'icon'; document.head.appendChild(link) }
        link.href = sf.favicon
      }
      if (sf.siteTitle) document.title = sf.siteTitle
      if (sf.ogImage) {
        let meta = document.querySelector("meta[property='og:image']")
        if (!meta) { meta = document.createElement('meta'); meta.setAttribute('property', 'og:image'); document.head.appendChild(meta) }
        meta.setAttribute('content', sf.ogImage)
      }
    }
  } catch {}
})()
