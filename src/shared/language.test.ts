import { describe, expect, it } from 'vitest'
import {
  baiduTargetCode,
  deeplTargetCode,
  googleTargetCode,
  resolveTargetLanguageCode,
  youdaoTargetCode,
} from './language'

describe('language', () => {
  it('resolves common Chinese target names and aliases', () => {
    expect(resolveTargetLanguageCode('简体中文')).toBe('zh')
    expect(resolveTargetLanguageCode('Chinese')).toBe('zh')
    expect(resolveTargetLanguageCode('zh-CN')).toBe('zh')
  })

  it('resolves common English and Japanese target names', () => {
    expect(resolveTargetLanguageCode('English')).toBe('en')
    expect(resolveTargetLanguageCode('日语')).toBe('ja')
    expect(resolveTargetLanguageCode('Korean')).toBe('ko')
  })

  it('passes through valid language codes', () => {
    expect(resolveTargetLanguageCode('fr')).toBe('fr')
    expect(resolveTargetLanguageCode('pt-BR')).toBe('pt-BR')
  })

  it('rejects unsupported arbitrary text', () => {
    expect(resolveTargetLanguageCode('火星文')).toBeNull()
    expect(resolveTargetLanguageCode('   ')).toBeNull()
  })

  it('converts target codes for provider-specific APIs', () => {
    expect(googleTargetCode('zh')).toBe('zh-CN')
    expect(youdaoTargetCode('zh')).toBe('zh-CHS')
    expect(youdaoTargetCode('zh-TW')).toBe('zh-CHT')
    expect(baiduTargetCode('zh-TW')).toBe('cht')
    expect(deeplTargetCode('zh')).toBe('ZH')
    expect(deeplTargetCode('en')).toBe('EN')
  })
})
