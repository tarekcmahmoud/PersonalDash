/**
 * Turn what a person typed into a web link: trims, adds `https://` when there is no scheme, and accepts only
 * http(s) links with a real-looking host. Returns null when it is not a usable web link.
 */
export function normalizeUrl(input: string): string | null {
  const text = input.trim()
  if (!text || /\s/.test(text)) return null
  // "mailto:…", "javascript:…" and the like are schemes, not hosts (but "localhost:3000" is a host and port).
  if (/^[a-z][a-z0-9+.-]*:(?!\/\/|\d)/i.test(text)) return null
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(text) ? text : `https://${text}`
  try {
    const url = new URL(withScheme)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
    if (!url.hostname.includes('.') && url.hostname !== 'localhost') return null
    return withScheme
  } catch {
    return null
  }
}

/** The hostname of a link without a leading "www." ("" when the link cannot be parsed). */
export function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return ''
  }
}

/** An image link the page may show: http(s) or an inline data:image URI. */
export function isImageUrl(input: string): boolean {
  const text = input.trim()
  if (/^data:image\//i.test(text)) return true
  try {
    const url = new URL(text)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}
