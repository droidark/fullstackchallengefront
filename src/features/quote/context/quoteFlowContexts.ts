import { createContext } from 'react'
import type { NormalizedApiError } from '../models/apiError'
import type { PersonalInformationFormValues } from '../models/personalInformation'
import type { CoverageFormValues } from '../models/coverage'
import type { QuoteFlowState } from './quoteFlowReducer'

export type CreateQuoteResult =
  | Readonly<{ ok: true; reused: boolean }>
  | Readonly<{ ok: false; error: NormalizedApiError }>

export type CoverageUpdateResult = Readonly<{ ok: true }> | Readonly<{ ok: false; error: NormalizedApiError }>
export type SubmitQuoteResult = Readonly<{ ok: true }> | Readonly<{ ok: false; error: NormalizedApiError }>

export type QuoteFlowActions = Readonly<{
  createOrReuseQuote(values: PersonalInformationFormValues): Promise<CreateQuoteResult>
  updateCoverage(values: CoverageFormValues): Promise<CoverageUpdateResult>
  submitActiveQuote(): Promise<SubmitQuoteResult>
  goToPersonal(): void
  goToCoverage(): void
  clearError(): void
  resetFlow(): void
}>

export const QuoteFlowStateContext = createContext<QuoteFlowState | null>(null)
export const QuoteFlowActionsContext = createContext<QuoteFlowActions | null>(null)
