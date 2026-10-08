import promptDoc from '../../../docs/breakdown-prompt.md?raw'

/** The first ````text fenced block of docs/breakdown-prompt.md: the copy-paste LLM prompt. */
export function extractPrompt(markdown: string): string {
  const match = /^````text\r?\n([\s\S]*?)\r?\n````[ \t]*$/m.exec(markdown)
  return (match?.[1] ?? markdown).trim()
}

export const BREAKDOWN_PROMPT = extractPrompt(promptDoc)

/** Copy text to the clipboard; resolves false when no clipboard is available or copying fails. */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    // fall through to the legacy path
  }
  try {
    const area = document.createElement('textarea')
    area.value = text
    area.setAttribute('readonly', '')
    area.style.position = 'fixed'
    area.style.opacity = '0'
    document.body.appendChild(area)
    area.select()
    const ok = typeof document.execCommand === 'function' && document.execCommand('copy')
    area.remove()
    return ok
  } catch {
    return false
  }
}
