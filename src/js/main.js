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
  const isHome    = page === 'home'    && (path === '/' || path.endsWith('/index.html'))
  const isAbout   = page === 'about'   && path.includes('/about')
  const isWork    = page === 'work'    && path.includes('/work') && !path.endsWith('/index.html')
  const isContact = page === 'contact' && path.includes('/contact')

  if (isHome || isAbout || isWork || isContact) link.classList.add('is-active')
})

// ─── Hero image: scroll-expand (small box → full width as you scroll) ─────────
const expandWrapper = document.querySelector('.scroll-expand-wrapper')
if (expandWrapper) {
  let rafId = null

  function updateExpand() {
    rafId = null
    const rect  = expandWrapper.getBoundingClientRect()
    const viewH = window.innerHeight
    // 0 = element just entering from bottom, 1 = element top at viewport top
    const progress = Math.max(0, Math.min(1, (viewH - rect.top) / viewH))

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

// ─── Methodology cards: bottom-to-top clip reveal tied to scroll ──────────────
const methodCards = document.querySelectorAll('.method-reveal')
if (methodCards.length) {
  let rafId = null

  function updateMethodReveal() {
    rafId = null
    const viewH = window.innerHeight

    methodCards.forEach((card) => {
      const rect = card.getBoundingClientRect()
      // Fully revealed when card top is 30% down the viewport
      const progress  = Math.max(0, Math.min(1, (viewH - rect.top) / (viewH * 0.75)))
      const topInset  = (100 * (1 - progress)).toFixed(1)
      card.style.clipPath = `inset(${topInset}% 0 0 0)`
    })
  }

  window.addEventListener('scroll', () => {
    if (!rafId) rafId = requestAnimationFrame(updateMethodReveal)
  }, { passive: true })

  updateMethodReveal()
}
