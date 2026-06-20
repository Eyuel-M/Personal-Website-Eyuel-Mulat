// ─── Clean URLs — strip .html from address bar ───────────────────────────────
if (location.pathname.endsWith('.html')) {
  history.replaceState(null, '', location.pathname.slice(0, -5) + location.search + location.hash)
}

// ─── Scroll reveal ────────────────────────────────────────────────────────────
const revealObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible')
        revealObserver.unobserve(entry.target)
      }
    })
  },
  { threshold: 0.08, rootMargin: '0px 0px -60px 0px' }
)

document.querySelectorAll('.reveal').forEach((el) => revealObserver.observe(el))

// ─── Active nav state ─────────────────────────────────────────────────────────
const path = window.location.pathname

document.querySelectorAll('[data-nav]').forEach((link) => {
  const page = link.dataset.nav
  const isHome     = page === 'home'     && (path === '/' || path.endsWith('/index.html'))
  const isAbout    = page === 'about'    && path.includes('/about')
  const isWork     = page === 'work'     && path.includes('/work') && !path.endsWith('/index.html')
  const isContact  = page === 'contact'  && path.includes('/contact')
  const isInsights = page === 'insights' && path.includes('/insights')

  if (isHome || isAbout || isWork || isContact || isInsights) link.classList.add('is-active')
})

// ─── Hero image: scroll-expand to full screen ────────────────────────────────
const expandWrapper = document.querySelector('.scroll-expand-wrapper')
if (expandWrapper) {
  let rafId = null
  const expandSection = expandWrapper.closest('section')

  function updateExpand() {
    rafId = null
    const rect = expandSection.getBoundingClientRect()
    const scrollRoom = expandSection.offsetHeight - window.innerHeight
    // No scroll room (mobile / short section) → remove clip entirely
    if (scrollRoom <= 0) {
      expandWrapper.style.clipPath = 'none'
      return
    }
    const progress = Math.max(0, Math.min(1, -rect.top / scrollRoom))
    const vInset = (15 * (1 - progress)).toFixed(2)
    const hInset = (22 * (1 - progress)).toFixed(2)
    const radius = (20 * (1 - progress)).toFixed(1)
    expandWrapper.style.clipPath =
      `inset(${vInset}% ${hInset}% round ${radius}px)`
  }

  window.addEventListener('scroll', () => {
    if (!rafId) rafId = requestAnimationFrame(updateExpand)
  }, { passive: true })

  updateExpand()
}

// ─── Footer brand: scale text to exactly fill container width ─────────────────
let fitBrandRaf = null

function fitFooterBrand() {
  const el = document.querySelector('.footer-brand')
  if (!el) return
  // Reset to known size, then measure actual text width via inline-block getBoundingClientRect
  el.style.fontSize = '100px'
  const textWidth  = el.getBoundingClientRect().width
  const boxWidth   = el.parentElement.getBoundingClientRect().width
  if (textWidth > 0 && boxWidth > 0) {
    el.style.fontSize = (boxWidth / textWidth * 100) + 'px'
  }
}

// Run immediately (cached fonts) AND after font load (fresh load)
fitFooterBrand()
document.fonts.ready.then(fitFooterBrand)

window.addEventListener('resize', () => {
  if (fitBrandRaf) return
  fitBrandRaf = requestAnimationFrame(() => { fitBrandRaf = null; fitFooterBrand() })
}, { passive: true })

// ─── Contact: file upload UI ─────────────────────────────────────────────────
const fileInput = document.querySelector('#brief-file')
const fileZone  = document.querySelector('#file-upload-zone')
const fileLabel = document.querySelector('#file-label-text')

if (fileInput && fileZone && fileLabel) {
  fileInput.addEventListener('change', () => {
    const file = fileInput.files[0]
    if (!file) return
    if (file.size > 6 * 1024 * 1024) {
      alert('File exceeds 6 MB. Please choose a smaller file.')
      fileInput.value = ''
      return
    }
    fileLabel.textContent = file.name
    fileZone.classList.add('has-file')
  })

  fileZone.addEventListener('dragover', (e) => { e.preventDefault(); fileZone.style.borderColor = '#FF4F00' })
  fileZone.addEventListener('dragleave', () => { if (!fileInput.files.length) fileZone.style.borderColor = '' })
  fileZone.addEventListener('drop', (e) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (!file) return
    if (file.size > 6 * 1024 * 1024) { alert('File exceeds 6 MB.'); return }
    const dt = new DataTransfer()
    dt.items.add(file)
    fileInput.files = dt.files
    fileLabel.textContent = file.name
    fileZone.classList.add('has-file')
  })
}

// ─── Custom cursor (ring lags, dot is instant for precise clicking) ──────────
if (window.matchMedia('(pointer: fine)').matches) {
  const ring = document.createElement('div')
  ring.id = 'cursor-ring'
  const dot = document.createElement('div')
  dot.id = 'cursor-dot'
  document.body.appendChild(ring)
  document.body.appendChild(dot)

  let rx = -200, ry = -200
  let mx = -200, my = -200
  let ringRaf = null

  function animateRing() {
    ringRaf = null
    rx += (mx - rx) * 0.11
    ry += (my - ry) * 0.11
    ring.style.transform = `translate(calc(${rx.toFixed(2)}px - 50%), calc(${ry.toFixed(2)}px - 50%))`
    if (Math.abs(mx - rx) > 0.2 || Math.abs(my - ry) > 0.2) {
      ringRaf = requestAnimationFrame(animateRing)
    }
  }

  document.addEventListener('mousemove', (e) => {
    mx = e.clientX; my = e.clientY
    dot.style.transform = `translate(calc(${mx}px - 50%), calc(${my}px - 50%))`
    if (!ringRaf) ringRaf = requestAnimationFrame(animateRing)
  })

  document.addEventListener('mousedown', () => ring.classList.add('is-pressed'))
  document.addEventListener('mouseup',   () => ring.classList.remove('is-pressed'))

  document.addEventListener('mouseover', (e) => {
    const el = e.target.closest('a, button, [role="button"], label, select, input[type="range"]')
    ring.classList.toggle('is-hover', !!el)
  })
}

// ─── Dot grid: fluid glow with motion trail (JS lerp, no CSS transition) ─────
document.querySelectorAll('.dot-grid').forEach((section) => {
  let gx = 50, gy = 50
  let tx = 50, ty = 50
  let glowing = false
  let rafId = null

  function animateGlow() {
    rafId = null
    gx += (tx - gx) * 0.052
    gy += (ty - gy) * 0.052
    section.style.setProperty('--dot-x', gx.toFixed(3) + '%')
    section.style.setProperty('--dot-y', gy.toFixed(3) + '%')
    if (glowing || Math.abs(tx - gx) + Math.abs(ty - gy) > 0.05) {
      rafId = requestAnimationFrame(animateGlow)
    }
  }

  section.addEventListener('mousemove', (e) => {
    const rect = section.getBoundingClientRect()
    tx = (e.clientX - rect.left) / rect.width  * 100
    ty = (e.clientY - rect.top)  / rect.height * 100
    glowing = true
    section.style.setProperty('--dot-glow', '1')
    if (!rafId) rafId = requestAnimationFrame(animateGlow)
  })

  section.addEventListener('mouseleave', () => {
    glowing = false
    section.style.setProperty('--dot-glow', '0')
  })
})

// ─── Footer social links: load from admin and apply ──────────────────────────
;(async () => {
  try {
    const res = await fetch('/api/content/footer')
    if (!res.ok) return
    const data = await res.json()
    const links = data?.fields?.socialLinks
    if (!Array.isArray(links) || !links.length) return

    // ── Footer Follow column ──────────────────────────────────────────────────
    const footer = document.querySelector('footer')
    if (footer) {
      const followSpan = Array.from(footer.querySelectorAll('span')).find(el => el.textContent.trim() === 'Follow')
      if (followSpan) {
        const container = followSpan.parentElement
        container.querySelectorAll('a').forEach(a => a.remove())
        links.forEach(link => {
          if (!link.label) return
          const a = document.createElement('a')
          a.href = link.url || '#'
          a.target = '_blank'
          a.rel = 'noopener noreferrer'
          a.className = 'label-caps text-[11px] tracking-[0.2em] text-background/80 hover:text-background transition-colors'
          a.textContent = link.label
          container.appendChild(a)
        })
      }
    }

    // ── Contact page Follow list ──────────────────────────────────────────────
    const contactSocial = document.querySelector('[data-contact-social]')
    if (contactSocial) {
      contactSocial.innerHTML = ''
      links.forEach(link => {
        if (!link.label) return
        const a = document.createElement('a')
        a.href = link.url || '#'
        a.target = '_blank'
        a.rel = 'noopener noreferrer'
        a.className = 'flex items-center justify-between border-b border-black/10 py-4 group'
        a.innerHTML = `<span class="text-base text-on-surface-variant group-hover:text-primary transition-colors">${link.label}</span><span class="material-symbols-outlined text-accent opacity-0 group-hover:opacity-100 transition-opacity" style="font-size:14px;line-height:1">north_east</span>`
        contactSocial.appendChild(a)
      })
    }
  } catch(e) {}
})()
