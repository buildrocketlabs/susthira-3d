/**
 * Can this browser place the bottle in the room?
 *   Android Chrome (and Chrome custom tabs, which is what WhatsApp opens): Google
 *     Scene Viewer through an intent link.
 *   iPhone and iPad: AR Quick Look.
 * A bare Android WebView cannot follow intent links, so the button is hidden there.
 */
export function arSupported(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent
  if (new URLSearchParams(location.search).has('ar')) return true // for testing the sheet on a desktop
  if (/Android/i.test(ua)) return !/; wv\)/.test(ua) && /Chrome\//.test(ua)
  const ios = /iPhone|iPad|iPod/.test(ua) || (navigator.maxTouchPoints > 1 && /Macintosh/.test(ua))
  if (ios) { try { return document.createElement('a').relList.supports('ar') } catch { return false } }
  return false
}
