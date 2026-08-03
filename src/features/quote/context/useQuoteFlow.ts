import { use } from 'react'
import { QuoteFlowActionsContext, QuoteFlowStateContext } from './quoteFlowContexts'
import type { QuoteFlowActions } from './quoteFlowContexts'
import type { QuoteFlowState } from './quoteFlowReducer'

export function useQuoteFlowState(): QuoteFlowState {
  const context = use(QuoteFlowStateContext)
  if (context === null) throw new Error('useQuoteFlowState must be used within QuoteFlowProvider.')
  return context
}

export function useQuoteFlowActions(): QuoteFlowActions {
  const context = use(QuoteFlowActionsContext)
  if (context === null) throw new Error('useQuoteFlowActions must be used within QuoteFlowProvider.')
  return context
}
