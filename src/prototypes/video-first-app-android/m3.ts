/**
 * Material Web registration for the Android (M3) prototype: the elements used,
 * the M3 type scale classes, and Roboto. Imported once from AndroidShell.
 */
import '@material/web/button/filled-button.js'
import '@material/web/button/filled-tonal-button.js'
import '@material/web/button/outlined-button.js'
import '@material/web/button/text-button.js'
import '@material/web/chips/assist-chip.js'
import '@material/web/chips/chip-set.js'
import '@material/web/chips/input-chip.js'
import '@material/web/dialog/dialog.js'
import '@material/web/divider/divider.js'
import '@material/web/elevation/elevation.js'
import '@material/web/fab/fab.js'
import '@material/web/focus/md-focus-ring.js'
import '@material/web/icon/icon.js'
import '@material/web/iconbutton/filled-tonal-icon-button.js'
import '@material/web/iconbutton/icon-button.js'
import '@material/web/list/list-item.js'
import '@material/web/list/list.js'
import '@material/web/progress/circular-progress.js'
import '@material/web/progress/linear-progress.js'
import '@material/web/radio/radio.js'
import '@material/web/ripple/ripple.js'
import '@material/web/textfield/outlined-text-field.js'
import typescaleCss from '@material/web/typography/md-typescale-styles.css?raw'

/**
 * M3 type scale classes (`md-typescale-title-large`, …). Material ships them in
 * an anonymous `@layer`, which loses to ProtoWiki's global (unlayered) heading
 * styles, so inject them unlayered: the class then beats a bare `h2` rule.
 */
const TYPESCALE_ID = 'vfa-typescale'
if (typeof document !== 'undefined' && !document.getElementById(TYPESCALE_ID)) {
  const style = document.createElement('style')
  style.id = TYPESCALE_ID
  style.textContent = typescaleCss
    .replace(/\/\*#\s*sourceMappingURL=.*?\*\//, '')
    .trim()
    .replace(/^@layer\s*\{/, '')
    .replace(/\}$/, '')
  document.head.appendChild(style)
}

/** Roboto (Android's UI face) and Droid Serif (article titles), so desktop previews match a phone. */
const FONT_ID = 'vfa-roboto'
if (typeof document !== 'undefined' && !document.getElementById(FONT_ID)) {
  const link = document.createElement('link')
  link.id = FONT_ID
  link.rel = 'stylesheet'
  link.href =
    'https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&family=Droid+Serif&display=swap'
  document.head.appendChild(link)
}
