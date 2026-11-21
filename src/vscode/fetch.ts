import { fetch as undiciFetch } from 'undici'
import { translateWithEngine } from '../shared/translate'
import type { EngineConfig } from '../shared/types'

const fetchImplementation = (
  typeof globalThis.fetch === 'function'
    ? globalThis.fetch.bind(globalThis)
    : undiciFetch
) as unknown as typeof fetch

export function translateText(
  engine: EngineConfig,
  text: string,
  targetLanguage: string,
): Promise<string> {
  return translateWithEngine(engine, text, targetLanguage, fetchImplementation)
}
