import type { NormalizedApiError } from '../models/apiError'
import type { PersonalInformationFormValues } from '../models/personalInformation'
import { hasCompleteAcceptedCoverage } from '../models/quote'
import type { QuoteResponse } from '../models/quote'
import type { SubmissionOutcome } from '../models/submission'

export type QuoteStep = 'personal' | 'coverage' | 'review' | 'result'

export type QuoteFlowState = Readonly<{
  currentStep: QuoteStep
  personalInformation: PersonalInformationFormValues
  submittedPersonalInformation: PersonalInformationFormValues | undefined
  quote: QuoteResponse | undefined
  activeRequest: 'create' | 'coverage' | 'submit' | undefined
  globalError: NormalizedApiError | undefined
  submissionOutcome: SubmissionOutcome | undefined
}>

export type QuoteFlowAction =
  | Readonly<{ type: 'PERSONAL_INFORMATION_COMMITTED'; payload: PersonalInformationFormValues }>
  | Readonly<{ type: 'QUOTE_CREATION_STARTED' }>
  | Readonly<{
      type: 'QUOTE_CREATED'
      payload: { quote: QuoteResponse; submittedPersonalInformation: PersonalInformationFormValues }
    }>
  | Readonly<{ type: 'QUOTE_CREATION_FAILED'; payload: NormalizedApiError }>
  | Readonly<{ type: 'COVERAGE_UPDATE_STARTED' }>
  | Readonly<{ type: 'COVERAGE_UPDATED'; payload: QuoteResponse }>
  | Readonly<{ type: 'COVERAGE_UPDATE_FAILED'; payload: NormalizedApiError }>
  | Readonly<{ type: 'SUBMISSION_STARTED' }>
  | Readonly<{ type: 'SUBMISSION_SUCCEEDED'; payload: QuoteResponse }>
  | Readonly<{ type: 'SUBMITTED_QUOTE_RECONCILED'; payload: QuoteResponse }>
  | Readonly<{
      type: 'SUBMISSION_FAILED'
      payload: { error: NormalizedApiError; quote?: QuoteResponse }
    }>
  | Readonly<{ type: 'SUBMISSION_IN_PROGRESS'; payload: NormalizedApiError }>
  | Readonly<{
      type: 'QUOTE_EXPIRED'
      payload: { error?: NormalizedApiError; quote?: QuoteResponse }
    }>
  | Readonly<{ type: 'QUOTE_NOT_FOUND'; payload: NormalizedApiError }>
  | Readonly<{
      type: 'INCOMPLETE_QUOTE'
      payload: { error: NormalizedApiError; quote?: QuoteResponse }
    }>
  | Readonly<{ type: 'SUBMISSION_REQUEST_FAILED'; payload: NormalizedApiError }>
  | Readonly<{ type: 'GO_TO_PERSONAL' }>
  | Readonly<{ type: 'GO_TO_COVERAGE' }>
  | Readonly<{ type: 'GO_TO_REVIEW' }>
  | Readonly<{ type: 'CLEAR_ERROR' }>
  | Readonly<{ type: 'RESET_FLOW' }>

export const emptyPersonalInformation: PersonalInformationFormValues = {
  name: '',
  email: '',
  age: 0,
  zipCode: '',
}

export const initialQuoteFlowState: QuoteFlowState = {
  currentStep: 'personal',
  personalInformation: emptyPersonalInformation,
  submittedPersonalInformation: undefined,
  quote: undefined,
  activeRequest: undefined,
  globalError: undefined,
  submissionOutcome: undefined,
}

function hasAcceptedCoverage(quote: QuoteResponse | undefined): quote is QuoteResponse {
  return quote !== undefined && hasCompleteAcceptedCoverage(quote)
}

function isCoverageEditable(quote: QuoteResponse | undefined): boolean {
  return quote?.status === 'DRAFT' || quote?.status === 'SUBMISSION_FAILED'
}

export function quoteFlowReducer(
  state: QuoteFlowState,
  action: QuoteFlowAction,
): QuoteFlowState {
  switch (action.type) {
    case 'PERSONAL_INFORMATION_COMMITTED':
      if (state.activeRequest !== undefined) return state
      return { ...state, personalInformation: action.payload }
    case 'QUOTE_CREATION_STARTED':
      if (state.activeRequest !== undefined || state.currentStep !== 'personal') return state
      return { ...state, activeRequest: 'create', globalError: undefined }
    case 'QUOTE_CREATED':
      if (state.activeRequest !== 'create') return state
      return {
        ...state,
        currentStep: 'coverage',
        personalInformation: action.payload.submittedPersonalInformation,
        submittedPersonalInformation: action.payload.submittedPersonalInformation,
        quote: action.payload.quote,
        activeRequest: undefined,
        globalError: undefined,
        submissionOutcome: undefined,
      }
    case 'QUOTE_CREATION_FAILED':
      if (state.activeRequest !== 'create') return state
      return {
        ...state,
        currentStep: 'personal',
        activeRequest: undefined,
        globalError: action.payload,
      }
    case 'COVERAGE_UPDATE_STARTED':
      if (state.activeRequest !== undefined || state.currentStep !== 'coverage' || !isCoverageEditable(state.quote)) return state
      return { ...state, activeRequest: 'coverage', globalError: undefined, submissionOutcome: undefined }
    case 'COVERAGE_UPDATED':
      if (state.activeRequest !== 'coverage' || !isCoverageEditable(action.payload) ||
        action.payload.id !== state.quote?.id || !hasCompleteAcceptedCoverage(action.payload)) return state
      return {
        ...state,
        currentStep: 'review',
        quote: action.payload,
        activeRequest: undefined,
        globalError: undefined,
        submissionOutcome: undefined,
      }
    case 'COVERAGE_UPDATE_FAILED':
      if (state.activeRequest !== 'coverage') return state
      return { ...state, currentStep: 'coverage', activeRequest: undefined, globalError: action.payload }
    case 'SUBMISSION_STARTED':
      if (
        state.activeRequest !== undefined ||
        state.currentStep !== 'review' && state.currentStep !== 'result' ||
        !isCoverageEditable(state.quote) ||
        !hasAcceptedCoverage(state.quote)
      ) return state
      return {
        ...state,
        activeRequest: 'submit',
        globalError: undefined,
      }
    case 'SUBMISSION_SUCCEEDED':
      if (
        state.activeRequest !== 'submit' ||
        action.payload.id !== state.quote?.id ||
        action.payload.status !== 'SUBMITTED' ||
        !hasCompleteAcceptedCoverage(action.payload)
      ) return state
      return {
        ...state,
        currentStep: 'result',
        quote: action.payload,
        activeRequest: undefined,
        globalError: undefined,
        submissionOutcome: undefined,
      }
    case 'SUBMITTED_QUOTE_RECONCILED':
      if (
        state.activeRequest !== 'coverage' ||
        action.payload.id !== state.quote?.id ||
        action.payload.status !== 'SUBMITTED' ||
        !hasCompleteAcceptedCoverage(action.payload)
      ) return state
      return {
        ...state,
        currentStep: 'result',
        quote: action.payload,
        activeRequest: undefined,
        globalError: undefined,
        submissionOutcome: undefined,
      }
    case 'SUBMISSION_FAILED': {
      if (state.activeRequest !== 'submit') return state
      const reconciledQuote = action.payload.quote
      if (reconciledQuote !== undefined && (
        reconciledQuote.id !== state.quote?.id || reconciledQuote.status !== 'SUBMISSION_FAILED'
      )) return state
      return {
        ...state,
        currentStep: 'result',
        quote: reconciledQuote ?? state.quote,
        activeRequest: undefined,
        globalError: undefined,
        submissionOutcome: { kind: 'retryable-failure', error: action.payload.error },
      }
    }
    case 'SUBMISSION_IN_PROGRESS':
      if (state.activeRequest !== 'submit') return state
      return {
        ...state,
        currentStep: 'result',
        activeRequest: undefined,
        globalError: undefined,
        submissionOutcome: { kind: 'in-progress', error: action.payload },
      }
    case 'QUOTE_EXPIRED': {
      if (
        state.activeRequest !== 'submit' &&
        state.activeRequest !== 'coverage' &&
        state.activeRequest !== undefined
      ) return state
      const reconciledQuote = action.payload.quote
      if (reconciledQuote !== undefined && (
        reconciledQuote.id !== state.quote?.id || reconciledQuote.status !== 'EXPIRED'
      )) return state
      return {
        ...state,
        currentStep: 'result',
        quote: reconciledQuote ?? state.quote,
        activeRequest: undefined,
        globalError: undefined,
        submissionOutcome: {
          kind: 'expired',
          ...(action.payload.error === undefined ? {} : { error: action.payload.error }),
        },
      }
    }
    case 'QUOTE_NOT_FOUND':
      if (state.activeRequest !== 'submit') return state
      return {
        ...state,
        currentStep: 'result',
        activeRequest: undefined,
        globalError: undefined,
        submissionOutcome: { kind: 'not-found', error: action.payload },
      }
    case 'INCOMPLETE_QUOTE':
      if (state.activeRequest !== 'submit' && state.activeRequest !== undefined) return state
      if (action.payload.quote !== undefined && action.payload.quote.id !== state.quote?.id) return state
      if (!isCoverageEditable(action.payload.quote ?? state.quote)) return state
      return {
        ...state,
        currentStep: 'coverage',
        quote: action.payload.quote ?? state.quote,
        activeRequest: undefined,
        globalError: action.payload.error,
        submissionOutcome: undefined,
      }
    case 'SUBMISSION_REQUEST_FAILED':
      if (state.activeRequest !== 'submit') return state
      return {
        ...state,
        currentStep: state.quote?.status === 'SUBMISSION_FAILED' ? 'result' : 'review',
        activeRequest: undefined,
        globalError: action.payload,
        submissionOutcome: undefined,
      }
    case 'GO_TO_PERSONAL':
      if (state.activeRequest !== undefined || state.currentStep !== 'coverage' || state.quote?.status !== 'DRAFT') return state
      return { ...state, currentStep: 'personal', globalError: undefined }
    case 'GO_TO_COVERAGE':
      if (
        state.activeRequest !== undefined ||
        !isCoverageEditable(state.quote) ||
        state.submittedPersonalInformation === undefined
      ) return state
      return {
        ...state,
        currentStep: 'coverage',
        globalError: undefined,
        submissionOutcome: undefined,
      }
    case 'GO_TO_REVIEW':
      if (state.activeRequest !== undefined || state.quote === undefined || !isCoverageEditable(state.quote) ||
        !hasCompleteAcceptedCoverage(state.quote)) return state
      return { ...state, currentStep: 'review', globalError: undefined }
    case 'CLEAR_ERROR':
      if (state.globalError === undefined) return state
      return { ...state, globalError: undefined }
    case 'RESET_FLOW':
      if (state.activeRequest !== undefined) return state
      return initialQuoteFlowState
  }
}
