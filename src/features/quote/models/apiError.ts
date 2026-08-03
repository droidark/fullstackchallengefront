export type ApiFieldError = Readonly<{
  field: string
  message: string
}>

export type BackendApiError = Readonly<{
  timestamp: string
  status: number
  error: string
  code: string
  message: string
  path: string
  fieldErrors: ApiFieldError[]
}>

export type NormalizedApiError =
  | Readonly<{
      kind: 'backend'
      status: number
      code?: string
      message: string
      fieldErrors: ApiFieldError[]
    }>
  | Readonly<{ kind: 'network'; message: string }>
  | Readonly<{ kind: 'configuration'; message: string }>
  | Readonly<{ kind: 'invalid-response'; message: string }>
  | Readonly<{ kind: 'aborted'; message: string }>

export function isNormalizedApiError(value: unknown): value is NormalizedApiError {
  if (typeof value !== 'object' || value === null || !('kind' in value) || !('message' in value)) {
    return false
  }
  if (typeof value.kind !== 'string' || typeof value.message !== 'string') return false
  if (value.kind === 'backend') {
    return 'status' in value && typeof value.status === 'number' &&
      'fieldErrors' in value && Array.isArray(value.fieldErrors)
  }
  return value.kind === 'network' || value.kind === 'configuration' ||
    value.kind === 'invalid-response' || value.kind === 'aborted'
}
