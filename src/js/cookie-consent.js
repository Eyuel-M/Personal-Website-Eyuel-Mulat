;(function () {
  'use strict'
  if (typeof window === 'undefined') return
  if (location.pathname.startsWith('/admin')) return

  var KEY = 'em_consent'
  var current = localStorage.getItem(KEY)
  if (current === 'true' || current === 'false') return

  // Inject banner
  var banner = document.createElement('div')
  banner.id = 'em-cookie-banner'
  banner.setAttribute('role', 'dialog')
  banner.setAttribute('aria-label', 'Cookie consent')
  banner.style.cssText = [
    'position:fixed',
    'bottom:0',
    'left:0',
    'right:0',
    'z-index:9999',
    'background:#0F0F0F',
    'color:#F5F2EE',
    'padding:16px 24px',
    'display:flex',
    'align-items:center',
    'justify-content:space-between',
    'gap:16px',
    'flex-wrap:wrap',
    'font-family:Hanken Grotesk,-apple-system,BlinkMacSystemFont,sans-serif',
    'font-size:12px',
    'line-height:1.5',
    'letter-spacing:.01em',
    'box-shadow:0 -1px 0 rgba(255,255,255,.08)',
    'transition:opacity .35s ease,transform .35s ease',
  ].join(';')

  var text = document.createElement('p')
  text.style.cssText = 'margin:0;color:rgba(245,242,238,.7);max-width:640px;flex:1'
  text.textContent = 'We use analytics cookies to understand how visitors use this site.'
  banner.appendChild(text)

  var btns = document.createElement('div')
  btns.style.cssText = 'display:flex;gap:10px;align-items:center;flex-shrink:0'

  var decline = document.createElement('button')
  decline.textContent = 'Decline'
  decline.style.cssText = [
    'background:none',
    'border:1px solid rgba(245,242,238,.3)',
    'color:rgba(245,242,238,.7)',
    'padding:7px 16px',
    'border-radius:4px',
    'cursor:pointer',
    'font-size:11px',
    'font-weight:600',
    'letter-spacing:.08em',
    'text-transform:uppercase',
    'font-family:inherit',
    'transition:border-color .15s,color .15s',
  ].join(';')
  decline.onmouseover = function () { decline.style.borderColor = 'rgba(245,242,238,.6)'; decline.style.color = '#F5F2EE' }
  decline.onmouseout = function () { decline.style.borderColor = 'rgba(245,242,238,.3)'; decline.style.color = 'rgba(245,242,238,.7)' }

  var accept = document.createElement('button')
  accept.textContent = 'Accept'
  accept.style.cssText = [
    'background:#F5F2EE',
    'border:1px solid #F5F2EE',
    'color:#0F0F0F',
    'padding:7px 16px',
    'border-radius:4px',
    'cursor:pointer',
    'font-size:11px',
    'font-weight:600',
    'letter-spacing:.08em',
    'text-transform:uppercase',
    'font-family:inherit',
    'transition:opacity .15s',
  ].join(';')
  accept.onmouseover = function () { accept.style.opacity = '.85' }
  accept.onmouseout = function () { accept.style.opacity = '1' }

  btns.appendChild(decline)
  btns.appendChild(accept)
  banner.appendChild(btns)

  function dismiss () {
    banner.style.opacity = '0'
    banner.style.transform = 'translateY(8px)'
    setTimeout(function () {
      if (banner.parentNode) banner.parentNode.removeChild(banner)
    }, 380)
  }

  accept.onclick = function () {
    localStorage.setItem(KEY, 'true')
    dismiss()
    try { window.dispatchEvent(new CustomEvent('em:consent', { detail: { granted: true } })) } catch (e) {}
  }

  decline.onclick = function () {
    localStorage.setItem(KEY, 'false')
    dismiss()
  }

  // Append after DOM is ready
  if (document.body) {
    document.body.appendChild(banner)
  } else {
    document.addEventListener('DOMContentLoaded', function () {
      document.body.appendChild(banner)
    })
  }
})()
