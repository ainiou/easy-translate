import { describe, expect, it } from 'vitest'
import { createEmptyEngine } from '../shared/engine-meta'
import {
  errorMessage,
  resolveSecret,
  stripEngineSecrets,
  toPublicEngine,
  validateEngine,
} from './model'

describe('VS Code 引擎配置', () => {
  it('编辑时保留、替换或清除密钥', () => {
    expect(resolveSecret('', 'saved-key')).toBe('saved-key')
    expect(resolveSecret(' new-key ', 'saved-key')).toBe('new-key')
    expect(resolveSecret('new-key', 'saved-key', true)).toBe('')
  })

  it('规范化 OpenAI 兼容引擎并校验模型', () => {
    const engine = {
      ...createEmptyEngine(),
      id: 'openai',
      name: ' OpenAI ',
      baseUrl: 'https://api.openai.com/v1/',
      model: ' gpt-4o-mini ',
      apiKey: ' secret ',
    }
    expect(validateEngine(engine)).toMatchObject({
      name: 'OpenAI',
      baseUrl: 'https://api.openai.com/v1',
      model: 'gpt-4o-mini',
      apiKey: 'secret',
    })
    expect(() => validateEngine({ ...engine, model: '' })).toThrow('请填写模型名称')
  })

  it('校验有道引擎的应用凭证', () => {
    const engine = {
      ...createEmptyEngine('youdao'),
      id: 'youdao',
      name: '有道',
      appId: 'app-key',
      appSecret: '',
    }
    expect(() => validateEngine(engine)).toThrow('请填写有道 appKey 和 appSecret')
    expect(validateEngine({ ...engine, appSecret: 'app-secret' }).appSecret).toBe('app-secret')
  })

  it('保留非标准异常的具体信息', () => {
    expect(errorMessage({ message: 'SecretStorage is unavailable' })).toBe(
      'SecretStorage is unavailable',
    )
    expect(errorMessage('storage write failed')).toBe('storage write failed')
    expect(errorMessage({ name: 'StorageError', code: 'EPERM' })).toBe(
      'StorageError（错误码：EPERM）',
    )
    expect(errorMessage(null)).toContain('null')
  })

  it('公开配置不包含任何密钥内容', () => {
    const engine = validateEngine({
      ...createEmptyEngine('deepl'),
      id: 'deepl',
      name: 'DeepL',
      apiKey: 'auth-key',
    })
    const stored = stripEngineSecrets(engine)
    const publicEngine = toPublicEngine(stored, true, false)

    expect(stored).not.toHaveProperty('apiKey')
    expect(stored).not.toHaveProperty('appSecret')
    expect(publicEngine).toMatchObject({ id: 'deepl', hasApiKey: true, hasAppSecret: false })
    expect(JSON.stringify(publicEngine)).not.toContain('auth-key')
  })
})
