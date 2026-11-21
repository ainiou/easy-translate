import { describe, expect, it } from 'vitest'
import { getOriginPattern, normalizeBaseUrl } from './permissions'

describe('permissions', () => {
  it('normalizes HTTP base URLs and removes trailing slashes', () => {
    expect(normalizeBaseUrl(' http://localhost:11434/v1/ ')).toBe(
      'http://localhost:11434/v1',
    )
  })

  it('normalizes HTTPS base URLs', () => {
    expect(normalizeBaseUrl('https://api.openai.com/v1/')).toBe(
      'https://api.openai.com/v1',
    )
  })

  it('creates an origin-only match pattern', () => {
    expect(getOriginPattern('https://api.openai.com/v1')).toBe(
      'https://api.openai.com/*',
    )
  })

  it('rejects unsupported protocols and malformed URLs', () => {
    expect(() => normalizeBaseUrl('ftp://example.com/v1')).toThrow('仅支持')
    expect(() => normalizeBaseUrl('not a url')).toThrow('格式无效')
  })

  it('rejects a full chat completions endpoint', () => {
    expect(() =>
      normalizeBaseUrl('https://api.openai.com/v1/chat/completions'),
    ).toThrow('不要包含')
  })
})
