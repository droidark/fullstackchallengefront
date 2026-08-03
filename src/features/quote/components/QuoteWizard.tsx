import { Stack } from '@mui/material'
import { useQuoteFlowState } from '../context/useQuoteFlow'
import { PersonalInformationStep } from '../steps/PersonalInformationStep'
import { CoverageStep } from '../steps/CoverageStep'
import { QuoteReviewStep } from '../steps/QuoteReviewStep'
import { QuoteProgress } from './QuoteProgress'
import { SubmissionResult } from './SubmissionResult'

export function QuoteWizard() {
  const { currentStep } = useQuoteFlowState()

  return (
    <Stack spacing={{ xs: 3, sm: 4 }} sx={{ minWidth: 0 }}>
      <QuoteProgress currentStep={currentStep} />
      {currentStep === 'personal' && <PersonalInformationStep />}
      {currentStep === 'coverage' && <CoverageStep />}
      {currentStep === 'review' && <QuoteReviewStep />}
      {currentStep === 'result' && <SubmissionResult />}
    </Stack>
  )
}
