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

// ─── Hero image: scroll-expand (small box → full width, completes at 500px) ──
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
