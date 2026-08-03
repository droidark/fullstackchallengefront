import { Alert, AlertTitle, IconButton, Stack, Typography } from '@mui/material'
import { useEffect, useRef } from 'react'
import type { NormalizedApiError } from '../models/apiError'

const mappedFields = new Set([
  'name', 'email', 'age', 'zipCode', 'coverageType', 'hasPreexistingConditions',
  'conditions', 'takesPrescriptionMedication', 'usesTobacco', 'needsSpouseCoverage',
])

type ApiErrorAlertProps = Readonly<{
  error: NormalizedApiError | undefined
  onDismiss(): void
  onDismissFocus?(): void
  title?: string
}>

function errorMessage(error: NormalizedApiError): string {
  if (error.kind === 'backend' && (
    error.code === 'AUTHENTICATION_REQUIRED' || error.code === 'INVALID_API_KEY'
  )) {
    return 'The quote service authentication is not configured correctly.'
  }
  return error.message.trim() === ''
    ? 'We could not complete this request. Please try again.'
    : error.message
}

export function ApiErrorAlert({
  error,
  onDismiss,
  onDismissFocus,
  title = 'We could not complete that request',
}: ApiErrorAlertProps) {
  const alertRef = useRef<HTMLDivElement>(null)
  const unknownFieldErrors = error?.kind === 'backend'
    ? error.fieldErrors.filter(({ field }) => !mappedFields.has(field))
    : []
  const hasMappedFieldOnly = error?.kind === 'backend' &&
    error.fieldErrors.length > 0 &&
    unknownFieldErrors.length === 0

  useEffect(() => {
    if (error !== undefined && !hasMappedFieldOnly) alertRef.current?.focus()
  }, [error, hasMappedFieldOnly])

  if (error === undefined) return null

  return (
    <Alert
      ref={alertRef}
      severity="error"
      role="alert"
      tabIndex={-1}
      sx={{ minWidth: 0, overflowWrap: 'anywhere' }}
      action={
        <IconButton
          aria-label="Dismiss error"
          color="inherit"
          size="small"
          onClick={() => {
            onDismiss()
            onDismissFocus?.()
          }}
        >
          <span aria-hidden>×</span>
        </IconButton>
      }
    >
      <AlertTitle>{title}</AlertTitle>
      <Stack spacing={0.5}>
        <Typography component="p">{errorMessage(error)}</Typography>
        {unknownFieldErrors.map(({ field, message }) => (
          <Typography component="p" key={`${field}-${message}`}>
            {field}: {message}
          </Typography>
        ))}
      </Stack>
    </Alert>
  )
}
