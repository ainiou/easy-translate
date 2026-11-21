export function normalizeBaseUrl(input: string): string {
  const normalized = input.trim().replace(/\/+$/, '')
  if (!normalized) throw new Error('请输入 Base URL')

  let url: URL
  try {
    url = new URL(normalized)
  } catch {
    throw new Error('Base URL 格式无效')
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('Base URL 仅支持 HTTP 或 HTTPS')
  }

  if (url.pathname.replace(/\/+$/, '').endsWith('/chat/completions')) {
    throw new Error('请填写 API 根路径，不要包含 /chat/completions')
  }

  return normalized
}

export function getOriginPattern(baseUrl: string): string {
  return `${new URL(normalizeBaseUrl(baseUrl)).origin}/*`
}

export async function requestEnginePermission(baseUrl: string): Promise<boolean> {
  return chrome.permissions.request({ origins: [getOriginPattern(baseUrl)] })
}

export async function hasEnginePermission(baseUrl: string): Promise<boolean> {
  return chrome.permissions.contains({ origins: [getOriginPattern(baseUrl)] })
}
