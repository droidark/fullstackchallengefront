import { Alert, Button, Stack, Typography } from '@mui/material'
import { useEffect, useRef, useState } from 'react'
import { LoadingButton } from '../../../shared/components/LoadingButton'
import { ApiErrorAlert } from '../components/ApiErrorAlert'
import { QuoteSummary } from '../components/QuoteSummary'
import { useQuoteFlowActions, useQuoteFlowState } from '../context/useQuoteFlow'
import { hasCompleteAcceptedCoverage } from '../models/quote'

export function QuoteReviewStep() {
  const state = useQuoteFlowState()
  const { clearError, goToCoverage, resetFlow, submitActiveQuote } = useQuoteFlowActions()
  const headingRef = useRef<HTMLHeadingElement>(null)
  const [retrying, setRetrying] = useState(false)
  const quote = state.quote
  const loading = state.activeRequest === 'submit'
  const complete = quote !== undefined && hasCompleteAcceptedCoverage(quote)
  const editable = quote?.status === 'DRAFT' || quote?.status === 'SUBMISSION_FAILED'

  useEffect(() => {
    headingRef.current?.focus()
  }, [])

  const submit = async () => {
    setRetrying(state.globalError !== undefined)
    try {
      await submitActiveQuote()
    } finally {
      setRetrying(false)
    }
  }

  const startNewQuote = () => {
    resetFlow()
    requestAnimationFrame(() => { document.getElementById('personal-information-heading')?.focus() })
  }

  return (
    <Stack component="section" spacing={3} aria-labelledby="review-heading">
      <div>
        <Typography
          ref={headingRef}
          id="review-heading"
          component="h2"
          variant="h5"
          tabIndex={-1}
          gutterBottom
        >
          Review and Submit
        </Typography>
        <Typography color="text.secondary">
          Review the information accepted by the quote service before submitting.
        </Typography>
      </div>

      <ApiErrorAlert
        error={state.globalError}
        title="We could not submit your quote"
        onDismiss={clearError}
        onDismissFocus={() => { headingRef.current?.focus() }}
      />

      {!complete ? (
        <Alert severity="error" role="alert">
          Accepted coverage, a server premium, and all required supplemental answers are needed before submission.
        </Alert>
      ) : (
        <QuoteSummary quote={quote} />
      )}

      {!complete ? (
        <Stack direction={{ xs: 'column', sm: 'row' }} sx={{ gap: 2 }}>
          {editable && (
            <Button variant="outlined" onClick={goToCoverage} sx={{ width: { xs: '100%', sm: 'auto' } }}>
              Return to Coverage
            </Button>
          )}
          <Button variant="contained" onClick={startNewQuote} sx={{ width: { xs: '100%', sm: 'auto' } }}>
            Start New Quote
          </Button>
        </Stack>
      ) : (
        <Stack
          component="form"
          aria-label="Submit quote"
          aria-busy={loading}
          onSubmit={(event) => {
            event.preventDefault()
            void submit()
          }}
          direction={{ xs: 'column', sm: 'row' }}
          sx={{ justifyContent: 'space-between', gap: 2 }}
        >
          <Button
            type="button"
            variant="outlined"
            disabled={loading || !editable}
            onClick={goToCoverage}
            sx={{ width: { xs: '100%', sm: 'auto' } }}
          >
            Back to Coverage
          </Button>
          <LoadingButton
            type="submit"
            variant="contained"
            loading={loading}
            loadingLabel={retrying ? 'Retrying submission…' : 'Submitting quote…'}
            disabled={!editable}
            sx={{ width: { xs: '100%', sm: 'auto' }, minWidth: { sm: 180 } }}
          >
            {state.globalError === undefined ? 'Submit Quote' : 'Retry Submission'}
          </LoadingButton>
        </Stack>
      )}
    </Stack>
  )
}
