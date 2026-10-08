import { describe, expect, it } from 'vitest'
import { hostnameOf, isImageUrl, normalizeUrl } from './resourceUrl'

describe('normalizeUrl', () => {
  it('adds https:// when there is no scheme and trims', () => {
    expect(normalizeUrl('  example.com/page ')).toBe('https://example.com/page')
    expect(normalizeUrl('www.example.com')).toBe('https://www.example.com')
  })

  it('keeps http and https links as typed', () => {
    expect(normalizeUrl('http://example.com/a')).toBe('http://example.com/a')
    expect(normalizeUrl('https://example.com')).toBe('https://example.com')
    expect(normalizeUrl('localhost:3000/x')).toBe('https://localhost:3000/x')
  })

  it('rejects empty input, other schemes and things that are not links', () => {
    for (const bad of [
      '',
      '   ',
      'ftp://example.com',
      'javascript:alert(1)',
      'mailto:a@b.co',
      'two words.com',
      'nodots',
    ]) {
      expect(normalizeUrl(bad)).toBeNull()
    }
  })
})

describe('hostnameOf', () => {
  it('drops www. and survives garbage', () => {
    expect(hostnameOf('https://www.example.com/a?b=1')).toBe('example.com')
    expect(hostnameOf('not a url')).toBe('')
  })
})

describe('isImageUrl', () => {
  it('accepts http(s) and data:image links only', () => {
    expect(isImageUrl('https://img.example.com/a.png')).toBe(true)
    expect(isImageUrl('data:image/svg+xml;utf8,%3Csvg%3E')).toBe(true)
    expect(isImageUrl('javascript:alert(1)')).toBe(false)
    expect(isImageUrl('example.com/a.png')).toBe(false)
  })
})
