export type AppConfig = Readonly<{
  apiBaseUrl: string
  apiKey: string
}>

type EnvironmentInput = Readonly<{
  VITE_API_BASE_URL?: unknown
  VITE_API_KEY?: unknown
}>

export class ConfigurationError extends Error {
  readonly kind = 'configuration'

  constructor(message: string) {
    super(message)
    this.name = 'ConfigurationError'
  }
}

export function parseEnvironment(input: EnvironmentInput): AppConfig {
  const rawBaseUrl = typeof input.VITE_API_BASE_URL === 'string'
    ? input.VITE_API_BASE_URL.trim()
    : ''

  if (rawBaseUrl.length === 0) {
    throw new ConfigurationError('VITE_API_BASE_URL is required.')
  }

  let url: URL
  try {
    url = new URL(rawBaseUrl)
  } catch {
    throw new ConfigurationError('VITE_API_BASE_URL must be a valid HTTP or HTTPS URL.')
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new ConfigurationError('VITE_API_BASE_URL must use HTTP or HTTPS.')
  }

  const apiKey = typeof input.VITE_API_KEY === 'string' ? input.VITE_API_KEY.trim() : ''
  if (apiKey.length === 0) {
    throw new ConfigurationError('VITE_API_KEY is required and must not be blank.')
  }

  return {
    apiBaseUrl: url.toString().replace(/\/$/, ''),
    apiKey,
  }
}

export function getAppConfig(): AppConfig {
  return parseEnvironment(import.meta.env)
}
