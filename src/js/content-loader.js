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

  // ── Page-specific field/block overrides ──────────────────────────────────
  try {
    const res = await fetch(`${apiBase}/${page}`)
    if (res.ok) {
      const data = await res.json()
      const { fields = {}, blocks = [] } = data

      // Apply field overrides to [data-editable] elements
      document.querySelectorAll('[data-editable]').forEach(el => {
        const id   = el.dataset.editable
        const type = el.dataset.editableType || 'text'
        const override = fields[id]
        if (!override) return

        // Apply content
        if (type === 'image') {
          if (override.value) {
            el.src = override.value
            el.style.display = override.value ? '' : 'none'
          }
        } else if (type === 'html') {
          if (override.value) el.innerHTML = override.value
        } else {
          if (override.value !== undefined) el.textContent = override.value
        }

        // Apply spacing
        const m = override.margin  || {}
        const p = override.padding || {}
        if (m.top    !== undefined) el.style.marginTop    = m.top    + 'px'
        if (m.right  !== undefined) el.style.marginRight  = m.right  + 'px'
        if (m.bottom !== undefined) el.style.marginBottom = m.bottom + 'px'
        if (m.left   !== undefined) el.style.marginLeft   = m.left   + 'px'
        if (p.top    !== undefined) el.style.paddingTop    = p.top    + 'px'
        if (p.right  !== undefined) el.style.paddingRight  = p.right  + 'px'
        if (p.bottom !== undefined) el.style.paddingBottom = p.bottom + 'px'
        if (p.left   !== undefined) el.style.paddingLeft   = p.left   + 'px'

        // Apply extra text styles
        if (override.fontSize)   el.style.fontSize   = override.fontSize
        if (override.fontWeight) el.style.fontWeight  = override.fontWeight
        if (override.color)      el.style.color       = override.color
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
              h.className = 'font-display text-[32px] md:text-[40px] uppercase leading-tight mb-6 reveal'
              h.textContent = block.title
              el.appendChild(h)
            }
            const div = document.createElement('div')
            div.className = 'text-base text-on-surface-variant leading-relaxed max-w-2xl reveal'
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
  } catch {}

  // ── Navigation / logo override — runs on every page independently ─────────
  try {
    const navRes = await fetch(`${apiBase}/navigation`)
    if (navRes.ok) {
      const navData = await navRes.json()
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
