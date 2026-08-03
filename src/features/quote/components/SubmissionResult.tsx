import { Alert, AlertTitle, Button, Stack, Typography } from '@mui/material'
import { useEffect, useRef } from 'react'
import { LoadingButton } from '../../../shared/components/LoadingButton'
import { useQuoteFlowActions, useQuoteFlowState } from '../context/useQuoteFlow'
import { submissionErrorMessage } from '../models/submission'
import { QuoteSummary } from './QuoteSummary'

type ResultKind = 'success' | 'failure' | 'in-progress' | 'expired' | 'not-found' | 'unexpected'

export function SubmissionResult() {
  const state = useQuoteFlowState()
  const { goToCoverage, resetFlow, submitActiveQuote } = useQuoteFlowActions()
  const headingRef = useRef<HTMLHeadingElement>(null)
  const alertRef = useRef<HTMLDivElement>(null)
  const quote = state.quote
  const outcome = state.submissionOutcome
  const loading = state.activeRequest === 'submit'

  let kind: ResultKind = 'unexpected'
  if (quote?.status === 'SUBMITTED') kind = 'success'
  else if (quote?.status === 'EXPIRED' || outcome?.kind === 'expired') kind = 'expired'
  else if (outcome?.kind === 'not-found') kind = 'not-found'
  else if (outcome?.kind === 'in-progress') kind = 'in-progress'
  else if (quote?.status === 'SUBMISSION_FAILED' || outcome?.kind === 'retryable-failure') kind = 'failure'

  const headings = {
    success: 'Quote submitted',
    failure: 'Submission failed',
    'in-progress': 'Submission in progress',
    expired: 'Quote expired',
    'not-found': 'Quote unavailable',
    unexpected: 'Unable to confirm submission',
  } satisfies Record<ResultKind, string>

  useEffect(() => {
    if (loading) return
    if (kind === 'failure' || kind === 'in-progress' || kind === 'unexpected') {
      alertRef.current?.focus()
    } else {
      headingRef.current?.focus()
    }
  }, [kind, loading])

  const error = outcome?.kind === 'retryable-failure' || outcome?.kind === 'in-progress' ||
    outcome?.kind === 'not-found' || outcome?.kind === 'unexpected-state'
    ? outcome.error
    : outcome?.kind === 'expired'
      ? outcome.error
      : state.globalError

  const retry = async () => {
    await submitActiveQuote()
  }

  const startNewQuote = () => {
    resetFlow()
    requestAnimationFrame(() => { document.getElementById('personal-information-heading')?.focus() })
  }

  const canRetry = kind === 'failure' || kind === 'in-progress'
  const canEditCoverage = kind === 'failure' && quote?.status === 'SUBMISSION_FAILED'

  return (
    <Stack component="section" spacing={3} aria-labelledby="submission-result-heading">
      <div>
        <Typography
          ref={headingRef}
          id="submission-result-heading"
          component="h2"
          variant="h5"
          tabIndex={-1}
          gutterBottom
        >
          {headings[kind]}
        </Typography>
        {kind === 'success' && (
          <Typography color="text.secondary">
            The quote service confirmed your submission.
          </Typography>
        )}
      </div>

      {kind !== 'success' && !loading && (
        <Alert
          ref={alertRef}
          severity={kind === 'expired' ? 'warning' : 'error'}
          role="alert"
          tabIndex={-1}
          sx={{ minWidth: 0, overflowWrap: 'anywhere' }}
        >
          <AlertTitle>{headings[kind]}</AlertTitle>
          {kind === 'expired'
            ? 'This quote can no longer be edited or submitted. Start a new quote to continue.'
            : error === undefined
              ? 'The quote service returned an unexpected submission state.'
              : submissionErrorMessage(error)}
        </Alert>
      )}

      {quote?.coverageType != null && quote.monthlyPremium !== null && (
        <QuoteSummary quote={quote} />
      )}

      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        sx={{ gap: 2, flexWrap: 'wrap' }}
        aria-busy={loading}
      >
        {canRetry && (
          <LoadingButton
            type="button"
            variant="contained"
            loading={loading}
            loadingLabel="Retrying submission…"
            onClick={() => { void retry() }}
            sx={{ width: { xs: '100%', sm: 'auto' }, minWidth: { sm: 190 } }}
          >
            Retry Submission
          </LoadingButton>
        )}
        {canEditCoverage && (
          <Button
            variant="outlined"
            disabled={loading}
            onClick={goToCoverage}
            sx={{ width: { xs: '100%', sm: 'auto' } }}
          >
            Back to Coverage
          </Button>
        )}
        <Button
          variant={kind === 'success' ? 'contained' : 'text'}
          disabled={loading}
          onClick={startNewQuote}
          sx={{ width: { xs: '100%', sm: 'auto' } }}
        >
          Start New Quote
        </Button>
      </Stack>
    </Stack>
  )
}
