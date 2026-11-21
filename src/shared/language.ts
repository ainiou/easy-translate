const LANGUAGE_ALIASES: Record<string, string> = {
  '简体中文': 'zh',
  中文: 'zh',
  汉语: 'zh',
  Chinese: 'zh',
  Mandarin: 'zh',
  zh: 'zh',
  'zh-cn': 'zh',
  'zh_cn': 'zh',
  'zh-hans': 'zh',
  '繁体中文': 'zh-TW',
  '繁體中文': 'zh-TW',
  'Traditional Chinese': 'zh-TW',
  'zh-tw': 'zh-TW',
  'zh-hant': 'zh-TW',
  英语: 'en',
  英文: 'en',
  English: 'en',
  en: 'en',
  'en-us': 'en',
  'en-gb': 'en',
  日语: 'ja',
  日文: 'ja',
  Japanese: 'ja',
  ja: 'ja',
  韩语: 'ko',
  韩文: 'ko',
  Korean: 'ko',
  ko: 'ko',
  法语: 'fr',
  法文: 'fr',
  French: 'fr',
  fr: 'fr',
  德语: 'de',
  德文: 'de',
  German: 'de',
  de: 'de',
  西班牙语: 'es',
  西班牙文: 'es',
  Spanish: 'es',
  es: 'es',
  俄语: 'ru',
  俄文: 'ru',
  Russian: 'ru',
  ru: 'ru',
  葡萄牙语: 'pt',
  Portuguese: 'pt',
  pt: 'pt',
  'pt-br': 'pt-BR',
  'pt-pt': 'pt-PT',
  意大利语: 'it',
  Italian: 'it',
  it: 'it',
  泰语: 'th',
  Thai: 'th',
  th: 'th',
  越南语: 'vi',
  Vietnamese: 'vi',
  vi: 'vi',
  阿拉伯语: 'ar',
  Arabic: 'ar',
  ar: 'ar',
}

export function resolveTargetLanguageCode(input: string): string | null {
  const trimmed = input.trim()
  if (!trimmed) return null
  if (LANGUAGE_ALIASES[trimmed]) return LANGUAGE_ALIASES[trimmed]
  if (LANGUAGE_ALIASES[trimmed.toLowerCase()]) return LANGUAGE_ALIASES[trimmed.toLowerCase()]
  if (/^[A-Za-z]{2,3}(?:-[A-Za-z]{2,4})?$/.test(trimmed)) return trimmed
  return null
}

export function googleTargetCode(code: string): string {
  return code === 'zh' ? 'zh-CN' : code
}

export function youdaoTargetCode(code: string): string {
  return code === 'zh' ? 'zh-CHS' : code === 'zh-TW' ? 'zh-CHT' : code
}

export function baiduTargetCode(code: string): string {
  if (code === 'zh') return 'zh'
  if (code === 'zh-TW') return 'cht'
  return code.toLowerCase()
}

export function deeplTargetCode(code: string): string {
  if (code === 'zh') return 'ZH'
  if (code === 'zh-TW') return 'ZH-HANT'
  return code.toUpperCase()
}
