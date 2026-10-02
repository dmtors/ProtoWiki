/**
 * Wikipedia article previews for any website — the "article panel" prototype.
 *
 *   <script src="https://…/embeds/article-panel.js" defer></script>
 *
 * Links to *.wikipedia.org/wiki/… (and elements with data-wikipedia="Title",
 * optional data-lang="en") get a preview:
 * - pointer + hover (desktop): a popover beside the link after a short pause;
 *   moving into the popover keeps it open. Clicking the link still opens Wikipedia.
 * - touch (mobile): tapping opens a bottom sheet instead of navigating.
 * Escape, the backdrop (sheet) or the close button dismisses it.
 *
 * The preview itself is a page we host, shown in an iframe — the host site's
 * styles can't reach it, and it updates for every site at once. It reports its
 * height and close requests over postMessage.
 *
 * Programmatic use: WikipediaArticlePanel.open({ title: 'Moon', lang: 'en', anchor })
 *                   WikipediaArticlePanel.close()
 *
 * Plain ES5-ish JavaScript, no build step: host sites include it as-is. Visual
 * values mirror Codex tokens (named alongside), since host pages don't load Codex.
 */
;(function () {
  'use strict'
  if (window.WikipediaArticlePanel) return

  var script = document.currentScript
  var base = script ? script.src.replace(/embeds\/article-panel\.js(?:[?#].*)?$/, '') : ''
  var panelUrl = (script && script.getAttribute('data-panel-url')) || base + 'article-panel/panel'
  var panelOrigin = new URL(panelUrl, location.href).origin

  var POPOVER_WIDTH = 520
  var GAP = 8 // between link and popover; also the viewport margin
  var OPEN_DELAY = 350 // hover intent
  var CLOSE_DELAY = 250 // time to travel from link to popover
  var Z = 2147483000

  // Codex tokens, as literal values.
  var SHADOW = '0 4px 8px 0 rgba(0,0,0,0.06), 0 0 16px 0 rgba(0,0,0,0.06)' // --box-shadow-large
  var BACKDROP = 'rgba(0,0,0,0.65)' // --background-color-backdrop-dark
  var EASE = '250ms ease' // --transition-duration-medium, --transition-timing-function-system

  var canHover = window.matchMedia('(hover: hover) and (pointer: fine)')
  var active = true // false after destroy()

  /* ---------- Which elements get previews ---------- */

  var SKIP_NAMESPACE = /^(special|file|image|media|category|help|wikipedia|template|portal|talk|user|draft|module|mediawiki)(\s|_)?(talk)?:/i

  /** { title, lang } for a previewable element, or null. */
  function target(el) {
    if (!el || !el.closest) return null
    var marked = el.closest('[data-wikipedia]')
    if (marked) {
      return {
        el: marked,
        title: marked.getAttribute('data-wikipedia'),
        lang: marked.getAttribute('data-lang') || 'en',
      }
    }
    var link = el.closest('a[href]')
    if (!link) return null
    var match = link.href.match(/^https?:\/\/([a-z-]+)\.(?:m\.)?wikipedia\.org\/wiki\/([^?#]+)/i)
    if (!match) return null
    var title
    try {
      title = decodeURIComponent(match[2]).replace(/_/g, ' ')
    } catch (e) {
      return null
    }
    if (!title || SKIP_NAMESPACE.test(title)) return null
    return { el: link, title: title, lang: match[1].toLowerCase() }
  }

  /* ---------- State ---------- */

  var current = null // { el, frame, backdrop, layout, key }
  var openTimer = 0
  var closeTimer = 0

  function clearTimers() {
    clearTimeout(openTimer)
    clearTimeout(closeTimer)
  }

  /* ---------- Open / close ---------- */

  function buildFrame(t, layout) {
    var frame = document.createElement('iframe')
    var params = new URLSearchParams({ title: t.title, lang: t.lang, layout: layout })
    frame.src = panelUrl + '?' + params.toString()
    frame.title = 'Wikipedia preview: ' + t.title
    frame.setAttribute(
      'sandbox',
      'allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox',
    )
    frame.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin')
    var s = frame.style
    s.position = 'fixed'
    s.border = '0'
    s.margin = '0'
    s.padding = '0'
    s.zIndex = String(Z + 1)
    s.background = 'transparent'
    s.colorScheme = 'normal'
    s.opacity = '0'
    s.visibility = 'hidden'
    s.height = '0'
    return frame
  }

  function open(t, layout) {
    var key = t.lang + ':' + t.title + ':' + layout
    if (current && current.key === key && current.el === t.el) return
    close(true)

    var frame = buildFrame(t, layout)
    var backdrop = null

    if (layout === 'sheet') {
      backdrop = document.createElement('div')
      var b = backdrop.style
      b.position = 'fixed'
      b.inset = '0'
      b.zIndex = String(Z)
      b.background = BACKDROP
      b.opacity = '0'
      b.transition = 'opacity ' + EASE
      backdrop.addEventListener('click', function () {
        close()
      })
      document.body.appendChild(backdrop)
      requestAnimationFrame(function () {
        backdrop.style.opacity = '1'
      })

      var f = frame.style
      f.left = '0'
      f.right = '0'
      f.bottom = '0'
      f.width = '100%'
      f.maxHeight = '90vh'
      f.borderRadius = '8px 8px 0 0'
      f.transform = 'translateY(100%)'
      f.transition = 'transform ' + EASE
      document.documentElement.style.overflow = 'hidden' // keep the page still behind the sheet
    } else {
      var p = frame.style
      p.width = Math.min(POPOVER_WIDTH, window.innerWidth - GAP * 2) + 'px'
      p.borderRadius = '4px'
      p.boxShadow = SHADOW
      p.transition = 'opacity ' + EASE
      frame.addEventListener('mouseenter', function () {
        clearTimeout(closeTimer)
      })
      frame.addEventListener('mouseleave', scheduleClose)
    }

    document.body.appendChild(frame)
    current = { el: t.el, frame: frame, backdrop: backdrop, layout: layout, key: key }
  }

  /** Size + reveal once the panel reports its height. */
  function show(height) {
    if (!current) return
    var frame = current.frame
    frame.style.height = height + 'px'
    if (current.layout === 'popover') position()
    if (frame.style.visibility === 'hidden') {
      frame.style.visibility = 'visible'
      requestAnimationFrame(function () {
        frame.style.opacity = '1'
        if (current && current.layout === 'sheet') {
          frame.style.transform = 'translateY(0)'
          frame.focus() // sheets are modal-ish: move focus in
        }
      })
    }
  }

  /** Below the link if it fits, otherwise above; clamped inside the viewport. */
  function position() {
    if (!current || current.layout !== 'popover') return
    var frame = current.frame
    var rect = current.el.getBoundingClientRect()
    var width = Math.min(POPOVER_WIDTH, window.innerWidth - GAP * 2)
    var height = parseFloat(frame.style.height) || 0
    var left = Math.min(Math.max(rect.left, GAP), window.innerWidth - width - GAP)
    var top = rect.bottom + GAP
    if (top + height > window.innerHeight - GAP && rect.top - GAP - height >= GAP) {
      top = rect.top - GAP - height
    }
    frame.style.width = width + 'px'
    frame.style.left = left + 'px'
    frame.style.top = top + 'px'
  }

  function close(immediate) {
    clearTimers()
    if (!current) return
    var closing = current
    current = null
    var remove = function () {
      if (closing.frame.parentNode) closing.frame.parentNode.removeChild(closing.frame)
      if (closing.backdrop && closing.backdrop.parentNode) closing.backdrop.parentNode.removeChild(closing.backdrop)
    }
    if (closing.layout === 'sheet') {
      document.documentElement.style.overflow = ''
      if (closing.el && closing.el.focus) closing.el.focus() // return focus to the link
    }
    if (immediate) return remove()
    closing.frame.style.opacity = '0'
    if (closing.layout === 'sheet') closing.frame.style.transform = 'translateY(100%)'
    if (closing.backdrop) closing.backdrop.style.opacity = '0'
    setTimeout(remove, 250)
  }

  function scheduleClose() {
    clearTimeout(openTimer)
    clearTimeout(closeTimer)
    closeTimer = setTimeout(function () {
      if (current && current.layout === 'popover') close()
    }, CLOSE_DELAY)
  }

  /* ---------- Messages from the panel ---------- */

  window.addEventListener('message', function (event) {
    if (!active || !current || event.origin !== panelOrigin || event.source !== current.frame.contentWindow) return
    var data = event.data || {}
    if (data.source !== 'wikipedia-article-panel') return
    if (data.type === 'height' && typeof data.height === 'number') show(data.height)
    if (data.type === 'close') close()
  })

  /* ---------- Desktop: hover and keyboard focus ---------- */

  var hovered = null

  document.addEventListener('mouseover', function (event) {
    if (!active || !canHover.matches) return
    var t = target(event.target)
    if (!t) return
    if (hovered === t.el) return
    hovered = t.el
    clearTimers()
    openTimer = setTimeout(function () {
      open(t, 'popover')
    }, OPEN_DELAY)
  })

  document.addEventListener('mouseout', function (event) {
    if (!canHover.matches || !hovered) return
    if (event.relatedTarget && hovered.contains(event.relatedTarget)) return
    if (!hovered.contains(event.target)) return
    hovered = null
    scheduleClose()
  })

  document.addEventListener('focusin', function (event) {
    if (!active || !canHover.matches) return
    var t = target(event.target)
    if (!t) return
    clearTimers()
    openTimer = setTimeout(function () {
      open(t, 'popover')
    }, OPEN_DELAY)
  })

  document.addEventListener('focusout', function (event) {
    if (!canHover.matches || !target(event.target)) return
    scheduleClose()
  })

  /* ---------- Touch: tap opens the sheet instead of navigating ---------- */

  document.addEventListener('click', function (event) {
    if (!active || canHover.matches || event.defaultPrevented || event.button !== 0) return
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    var t = target(event.target)
    if (!t) return
    event.preventDefault()
    open(t, 'sheet')
  })

  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape' && current) close()
  })

  window.addEventListener('scroll', position, { passive: true })
  window.addEventListener('resize', function () {
    if (current && current.layout === 'popover') position()
  })

  /* ---------- Public API ---------- */

  window.WikipediaArticlePanel = {
    /** Open a preview. On hover-capable screens, `anchor` places the popover (default: the viewport's top-left). */
    open: function (options) {
      var anchor = (options && options.anchor) || document.body
      open(
        { el: anchor, title: options.title, lang: options.lang || 'en' },
        canHover.matches && options.anchor ? 'popover' : 'sheet',
      )
    },
    close: function () {
      close()
    },
    /** Stop previewing (e.g. a single-page app leaving the page); including the script again re-enables it. */
    destroy: function () {
      close(true)
      active = false
      delete window.WikipediaArticlePanel
    },
  }
})()
