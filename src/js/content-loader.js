// Content-loader: fetches page-specific overrides from the admin API
// and applies them to data-editable elements on the page.
;(async () => {
  // Determine page key from URL
  const path = window.location.pathname
  let page = 'home'
  if (path.includes('/about'))    page = 'about'
  else if (path.includes('/work') && !path.includes('/work/')) page = 'work'
  else if (path.includes('/work/')) page = path.split('/work/')[1].replace('.html', '')
  else if (path.includes('/contact')) page = 'contact'
  else if (path.includes('/insights') && !path.includes('/insights/')) page = 'insights'
  else if (path.includes('/insights/')) page = path.split('/insights/')[1].replace('.html', '')

  const isPreview = new URLSearchParams(window.location.search).has('preview')
  const apiBase = isPreview ? '/api/preview' : '/api/content'

  // sessionStorage cache helper — eliminates content flash on repeat visits
  function getCached(key) { try { const v = sessionStorage.getItem('em_cl_' + key); return v ? JSON.parse(v) : null } catch { return null } }
  function setCache(key, data) { try { sessionStorage.setItem('em_cl_' + key, JSON.stringify(data)) } catch {} }

  // ── Page-specific field/block overrides ──────────────────────────────────
  function applyPageData(data) {
      const { fields = {}, blocks = [] } = data

      // Apply field overrides to [data-editable] elements
      document.querySelectorAll('[data-editable]').forEach(el => {
        const id   = el.dataset.editable
        const type = el.dataset.editableType || 'text'
        const raw = fields[id]
        if (raw === null || raw === undefined || raw === '') return
        const ov = (raw !== null && typeof raw === 'object') ? raw : { value: raw }

        // Apply content
        if (type === 'image') {
          if (ov.value) {
            el.src = ov.value
            el.style.display = ''
          }
        } else if (type === 'html') {
          if (ov.value) el.innerHTML = ov.value
        } else {
          if (ov.value !== undefined) el.textContent = ov.value
        }

        // Apply spacing
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

        // Apply extra text styles
        if (ov.fontSize)   el.style.fontSize   = ov.fontSize
        if (ov.fontWeight) el.style.fontWeight  = ov.fontWeight
        if (ov.color)      el.style.color       = ov.color
      })

      // Render custom blocks into #admin-blocks
      const blockZone = document.getElementById('admin-blocks')
      if (blockZone && blocks.length) {
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
            el.appendChild(div)

          } else if (block.type === 'grid2') {
            const grid = document.createElement('div')
            grid.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:16px'
            ;(block.images || []).slice(0, 2).forEach(src => {
              if (!src) return
              const img = document.createElement('img')
              img.src = src; img.className = 'w-full object-cover aspect-square'
              grid.appendChild(img)
            })
            el.appendChild(grid)

          } else if (block.type === 'grid2x2') {
            const grid = document.createElement('div')
            grid.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:16px'
            ;(block.images || []).slice(0, 4).forEach(src => {
              if (!src) return
              const img = document.createElement('img')
              img.src = src; img.className = 'w-full object-cover aspect-square'
              grid.appendChild(img)
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

  const cachedPage = getCached(page)
  if (cachedPage) applyPageData(cachedPage)

  try {
    const res = await fetch(`${apiBase}/${page}`)
    if (res.ok) {
      const data = await res.json()
      setCache(page, data)
      applyPageData(data)
    }
  } catch {}

  // ── Navigation / logo override — runs on every page independently ─────────
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

  const cachedNav = getCached('navigation')
  if (cachedNav) applyNavData(cachedNav)

  try {
    const navRes = await fetch(`${apiBase}/navigation`)
    if (navRes.ok) {
      const navData = await navRes.json()
      setCache('navigation', navData)
      applyNavData(navData)
    }
  } catch {}

  // ── Footer — email, phone, address, copyright, social links, pages ────────
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
      const selected = ff.footerLinks.map(href => {
        const found = allNavLinks.find(l => l.href === href)
        return found || { href, label: href.replace(/\//g, '').replace('.html', '') }
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

  const cachedFooter = getCached('footer')
  if (cachedFooter) applyFooterData(cachedFooter.fields || {})

  try {
    const footerRes = await fetch(`${apiBase}/footer`)
    if (footerRes.ok) {
      const footerData = await footerRes.json()
      setCache('footer', footerData)
      applyFooterData(footerData.fields || {})
    }
  } catch {}

  // ── Site settings — apply favicon and OG image ───────────────────────────
  try {
    const siteRes = await fetch(`${apiBase}/site`)
    if (siteRes.ok) {
      const siteData = await siteRes.json()
      const sf = siteData.fields || {}
      if (sf.favicon) {
        let link = document.querySelector("link[rel~='icon']")
        if (!link) { link = document.createElement('link'); link.rel = 'icon'; document.head.appendChild(link) }
        link.href = sf.favicon
      }
      if (sf.ogImage) {
        let meta = document.querySelector("meta[property='og:image']")
        if (!meta) { meta = document.createElement('meta'); meta.setAttribute('property', 'og:image'); document.head.appendChild(meta) }
        meta.setAttribute('content', sf.ogImage)
      }
    }
  } catch {}
})()
