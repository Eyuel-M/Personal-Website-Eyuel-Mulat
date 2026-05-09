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
  const isHome   = page === 'home'    && (path === '/' || path.endsWith('/index.html'))
  const isAbout  = page === 'about'   && path.includes('/about')
  const isWork   = page === 'work'    && (path.includes('/work') && !path.endsWith('/index.html'))
  const isContact= page === 'contact' && path.includes('/contact')

  if (isHome || isAbout || isWork || isContact) {
    link.classList.add('is-active')
  }
})
