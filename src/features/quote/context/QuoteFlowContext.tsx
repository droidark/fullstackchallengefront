import { useCallback, useMemo, useReducer, useRef } from 'react'
import type { PropsWithChildren } from 'react'
import { getQuoteApi } from '../api/quoteApi'
import type { QuoteApi } from '../api/quoteApi'
import { isNormalizedApiError } from '../models/apiError'
import type { NormalizedApiError } from '../models/apiError'
import type { PersonalInformationFormValues } from '../models/personalInformation'
import type { CoverageFormValues } from '../models/coverage'
import { toUpdateCoverageRequest } from '../models/coverage'
import { hasCompleteAcceptedCoverage } from '../models/quote'
import type { QuoteResponse } from '../models/quote'
import {
  isQuoteNotFoundError,
  isRetryableSubmissionError,
  isSubmissionInProgressError,
  shouldReconcileSubmissionError,
  submissionErrorMessage,
} from '../models/submission'
import {
  normalizePersonalInformation,
  personalInformationEquals,
  toCreateQuoteRequest,
} from '../models/personalInformation'
import {
  initialQuoteFlowState,
  quoteFlowReducer,
} from './quoteFlowReducer'
import {
  QuoteFlowActionsContext,
  QuoteFlowStateContext,
} from './quoteFlowContexts'
import type {
  CoverageUpdateResult,
  CreateQuoteResult,
  QuoteFlowActions,
  SubmitQuoteResult,
} from './quoteFlowContexts'

function unexpectedError(): NormalizedApiError {
  return { kind: 'network', message: 'Unable to create the quote right now.' }
}

function unexpectedCoverageError(): NormalizedApiError {
  return { kind: 'network', message: 'Unable to update coverage right now.' }
}

function unexpectedSubmissionError(): NormalizedApiError {
  return { kind: 'network', message: 'Unable to submit the quote right now.' }
}

function invalidSubmissionResponse(): NormalizedApiError {
  return { kind: 'invalid-response', message: 'The quote service returned an unexpected submission response.' }
}

function incompleteQuoteError(): NormalizedApiError {
  return {
    kind: 'invalid-response',
    message: 'Complete accepted coverage and all applicable supplemental answers before submitting this quote.',
  }
}

function isCompleteQuote(quote: QuoteResponse): boolean {
  return hasCompleteAcceptedCoverage(quote)
}

function withSafeSubmissionMessage(error: NormalizedApiError): NormalizedApiError {
  const message = submissionErrorMessage(error)
  return error.kind === 'backend'
    ? { ...error, message, fieldErrors: [] }
    : { ...error, message }
}

type QuoteFlowProviderProps = PropsWithChildren<{
  api?: QuoteApi | undefined
}>

export function QuoteFlowProvider({ api, children }: QuoteFlowProviderProps) {
  const [state, dispatch] = useReducer(quoteFlowReducer, initialQuoteFlowState)
  const apiRef = useRef<QuoteApi | null>(null)
  const requestActiveRef = useRef(false)

  apiRef.current ??= api ?? getQuoteApi()
  const quoteApi = apiRef.current

  const createOrReuseQuote = useCallback(async (
    values: PersonalInformationFormValues,
  ): Promise<CreateQuoteResult> => {
    if (requestActiveRef.current) {
      return { ok: false, error: { kind: 'aborted', message: 'Quote creation is already in progress.' } }
    }

    const normalized = normalizePersonalInformation(values)
    dispatch({ type: 'PERSONAL_INFORMATION_COMMITTED', payload: normalized })

    if (
      state.quote?.status === 'DRAFT' &&
      state.submittedPersonalInformation !== undefined &&
      personalInformationEquals(normalized, state.submittedPersonalInformation)
    ) {
      dispatch({ type: 'GO_TO_COVERAGE' })
      return { ok: true, reused: true }
    }

    requestActiveRef.current = true
    dispatch({ type: 'QUOTE_CREATION_STARTED' })
    try {
      const quote = await quoteApi.createQuote(toCreateQuoteRequest(normalized))
      dispatch({
        type: 'QUOTE_CREATED',
        payload: { quote, submittedPersonalInformation: normalized },
      })
      return { ok: true, reused: false }
    } catch (error: unknown) {
      const normalizedError = isNormalizedApiError(error) ? error : unexpectedError()
      dispatch({ type: 'QUOTE_CREATION_FAILED', payload: normalizedError })
      return { ok: false, error: normalizedError }
    } finally {
      requestActiveRef.current = false
    }
  }, [quoteApi, state.quote, state.submittedPersonalInformation])

  const updateCoverage = useCallback(async (values: CoverageFormValues): Promise<CoverageUpdateResult> => {
    if (requestActiveRef.current ||
      state.quote === undefined ||
      state.quote.status !== 'DRAFT' && state.quote.status !== 'SUBMISSION_FAILED' ||
      state.currentStep !== 'coverage') {
      return { ok: false, error: { kind: 'backend', status: 409, message: 'This quote cannot be updated right now.', fieldErrors: [] } }
    }
    requestActiveRef.current = true
    dispatch({ type: 'COVERAGE_UPDATE_STARTED' })
    try {
      const quote = await quoteApi.updateCoverage(
        state.quote.id,
        toUpdateCoverageRequest(state.quote.age, values),
      )
      if (
        quote.id !== state.quote.id ||
        quote.status !== 'DRAFT' && quote.status !== 'SUBMISSION_FAILED' ||
        !hasCompleteAcceptedCoverage(quote)
      ) {
        throw Object.assign(new Error('The quote service returned an unexpected response.'), {
          kind: 'invalid-response' as const,
          message: 'The quote service returned an unexpected response.',
        })
      }
      dispatch({ type: 'COVERAGE_UPDATED', payload: quote })
      return { ok: true }
    } catch (error: unknown) {
      const normalizedError = isNormalizedApiError(error) ? error : unexpectedCoverageError()
      if (normalizedError.kind === 'backend' && normalizedError.code === 'INVALID_QUOTE_STATE') {
        try {
          const reconciledQuote = await quoteApi.getQuote(state.quote.id)
          if (
            reconciledQuote.id === state.quote.id &&
            reconciledQuote.status === 'SUBMITTED' &&
            hasCompleteAcceptedCoverage(reconciledQuote)
          ) {
            dispatch({ type: 'SUBMITTED_QUOTE_RECONCILED', payload: reconciledQuote })
            return { ok: false, error: normalizedError }
          }
          if (reconciledQuote.id === state.quote.id && reconciledQuote.status === 'EXPIRED') {
            dispatch({
              type: 'QUOTE_EXPIRED',
              payload: { error: normalizedError, quote: reconciledQuote },
            })
            return { ok: false, error: normalizedError }
          }
        } catch {
          // Preserve the primary Coverage error when bounded reconciliation fails.
        }
      }
      dispatch({ type: 'COVERAGE_UPDATE_FAILED', payload: normalizedError })
      return { ok: false, error: normalizedError }
    } finally {
      requestActiveRef.current = false
    }
  }, [quoteApi, state.currentStep, state.quote])

  const submitActiveQuote = useCallback(async (): Promise<SubmitQuoteResult> => {
    if (requestActiveRef.current) {
      return { ok: false, error: { kind: 'aborted', message: 'Quote submission is already in progress.' } }
    }

    const activeQuote = state.quote
    if (activeQuote === undefined || !isCompleteQuote(activeQuote)) {
      const error = incompleteQuoteError()
      dispatch({ type: 'INCOMPLETE_QUOTE', payload: { error } })
      return { ok: false, error }
    }
    if (activeQuote.status === 'EXPIRED') {
      const error: NormalizedApiError = {
        kind: 'backend', status: 409, code: 'INVALID_QUOTE_STATE',
        message: 'This quote has expired and can no longer be submitted.', fieldErrors: [],
      }
      dispatch({ type: 'QUOTE_EXPIRED', payload: { error, quote: activeQuote } })
      return { ok: false, error }
    }
    if (
      state.currentStep !== 'review' && state.currentStep !== 'result' ||
      activeQuote.status !== 'DRAFT' && activeQuote.status !== 'SUBMISSION_FAILED'
    ) {
      const error: NormalizedApiError = {
        kind: 'backend', status: 409,
        message: 'This quote cannot be submitted from its current state.', fieldErrors: [],
      }
      return { ok: false, error }
    }

    requestActiveRef.current = true
    dispatch({ type: 'SUBMISSION_STARTED' })
    try {
      const submittedQuote = await quoteApi.submitQuote(activeQuote.id)
      if (
        submittedQuote.id !== activeQuote.id ||
        submittedQuote.status !== 'SUBMITTED' ||
        !isCompleteQuote(submittedQuote)
      ) {
        throw Object.assign(new Error(invalidSubmissionResponse().message), invalidSubmissionResponse())
      }
      dispatch({ type: 'SUBMISSION_SUCCEEDED', payload: submittedQuote })
      return { ok: true }
    } catch (error: unknown) {
      const primaryError = withSafeSubmissionMessage(
        isNormalizedApiError(error) ? error : unexpectedSubmissionError(),
      )

      let reconciledQuote: QuoteResponse | undefined
      if (shouldReconcileSubmissionError(primaryError)) {
        try {
          const candidate = await quoteApi.getQuote(activeQuote.id)
          if (candidate.id === activeQuote.id) reconciledQuote = candidate
        } catch {
          // The primary submit error remains authoritative and actionable.
        }
      }

      if (reconciledQuote?.status === 'SUBMITTED' && isCompleteQuote(reconciledQuote)) {
        dispatch({ type: 'SUBMISSION_SUCCEEDED', payload: reconciledQuote })
        return { ok: true }
      }
      if (reconciledQuote?.status === 'EXPIRED') {
        dispatch({ type: 'QUOTE_EXPIRED', payload: { error: primaryError, quote: reconciledQuote } })
        return { ok: false, error: primaryError }
      }
      if (primaryError.kind === 'backend' && primaryError.code === 'INCOMPLETE_QUOTE') {
        dispatch({
          type: 'INCOMPLETE_QUOTE',
          payload: {
            error: primaryError,
            ...(reconciledQuote?.status === 'DRAFT' || reconciledQuote?.status === 'SUBMISSION_FAILED'
              ? { quote: reconciledQuote }
              : {}),
          },
        })
        return { ok: false, error: primaryError }
      }
      if (reconciledQuote?.status === 'SUBMISSION_FAILED') {
        dispatch({ type: 'SUBMISSION_FAILED', payload: { error: primaryError, quote: reconciledQuote } })
        return { ok: false, error: primaryError }
      }
      if (isRetryableSubmissionError(primaryError)) {
        dispatch({ type: 'SUBMISSION_FAILED', payload: { error: primaryError } })
      } else if (isSubmissionInProgressError(primaryError)) {
        dispatch({ type: 'SUBMISSION_IN_PROGRESS', payload: primaryError })
      } else if (isQuoteNotFoundError(primaryError)) {
        dispatch({ type: 'QUOTE_NOT_FOUND', payload: primaryError })
      } else {
        dispatch({ type: 'SUBMISSION_REQUEST_FAILED', payload: primaryError })
      }
      return { ok: false, error: primaryError }
    } finally {
      requestActiveRef.current = false
    }
  }, [quoteApi, state.currentStep, state.quote])

  const actions = useMemo<QuoteFlowActions>(() => ({
    createOrReuseQuote,
    updateCoverage,
    submitActiveQuote,
    goToPersonal: () => { dispatch({ type: 'GO_TO_PERSONAL' }) },
    goToCoverage: () => { dispatch({ type: 'GO_TO_COVERAGE' }) },
    clearError: () => { dispatch({ type: 'CLEAR_ERROR' }) },
    resetFlow: () => { dispatch({ type: 'RESET_FLOW' }) },
  }), [createOrReuseQuote, submitActiveQuote, updateCoverage])

  return (
    <QuoteFlowStateContext value={state}>
      <QuoteFlowActionsContext value={actions}>
        {children}
      </QuoteFlowActionsContext>
    </QuoteFlowStateContext>
  )
}
