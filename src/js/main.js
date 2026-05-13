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

// ─── Hero image: scroll-expand (completes after 500px of scroll) ──────────────
const expandWrapper = document.querySelector('.scroll-expand-wrapper')
if (expandWrapper) {
  let rafId = null

  function updateExpand() {
    rafId = null
    const progress = Math.max(0, Math.min(1, window.scrollY / 500))

    const vInset = (10 * (1 - progress)).toFixed(2)
    const hInset = (22 * (1 - progress)).toFixed(2)
    const radius = (16 * (1 - progress)).toFixed(1)

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

// ─── Work: paginate at 5 per page with numbered buttons ──────────────────────
;(function () {
  const PER_PAGE = 5
  const items  = [...document.querySelectorAll('[data-work-item]')]
  const pagDiv = document.getElementById('work-pagination')
  if (!items.length || !pagDiv) return

  function goTo(page) {
    items.forEach((el, i) => {
      const on = i >= (page - 1) * PER_PAGE && i < page * PER_PAGE
      if (on) {
        el.classList.remove('hidden', 'is-visible')
        void el.offsetWidth
        setTimeout(() => el.classList.add('is-visible'), (i % PER_PAGE) * 80)
      } else {
        el.classList.add('hidden')
        el.classList.remove('is-visible')
      }
    })
    pagDiv.querySelectorAll('.work-page-btn').forEach(b => {
      b.classList.toggle('is-active', Number(b.dataset.page) === page)
    })
    if (page > 1) items[0].closest('section')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const totalPages = Math.ceil(items.length / PER_PAGE)
  if (totalPages > 1) {
    for (let p = 1; p <= totalPages; p++) {
      const b = document.createElement('button')
      b.className = 'work-page-btn'
      b.dataset.page = p
      b.textContent = String(p).padStart(2, '0')
      b.addEventListener('click', () => goTo(p))
      pagDiv.appendChild(b)
    }
    pagDiv.classList.remove('hidden')
  }

  goTo(1)
})()

// ─── Dot grid: cursor glow wave effect ───────────────────────────────────────
document.querySelectorAll('.dot-grid').forEach((section) => {
  section.addEventListener('mousemove', (e) => {
    const rect = section.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width  * 100).toFixed(2) + '%'
    const y = ((e.clientY - rect.top)  / rect.height * 100).toFixed(2) + '%'
    section.style.setProperty('--dot-x', x)
    section.style.setProperty('--dot-y', y)
    section.style.setProperty('--dot-glow', '1')
  })

  section.addEventListener('mouseleave', () => {
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
    const footer = document.querySelector('footer')
    if (!footer) return
    const followSpan = Array.from(footer.querySelectorAll('span')).find(el => el.textContent.trim() === 'Follow')
    if (!followSpan) return
    const container = followSpan.parentElement
    container.querySelectorAll('a').forEach(a => a.remove())
    links.forEach(link => {
      if (!link.label) return
      const a = document.createElement('a')
      a.href = link.url || '#'
      if (link.url) { a.target = '_blank'; a.rel = 'noopener noreferrer' }
      a.className = 'label-caps text-[11px] tracking-[0.2em] text-background/80 hover:text-background transition-colors'
      a.textContent = link.label
      container.appendChild(a)
    })
  } catch(e) {}
})()
