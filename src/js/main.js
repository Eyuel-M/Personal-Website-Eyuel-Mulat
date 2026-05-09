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
