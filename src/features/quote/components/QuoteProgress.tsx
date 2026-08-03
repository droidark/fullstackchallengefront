import { Box, Step, StepLabel, Stepper, Typography } from '@mui/material'
import type { QuoteStep } from '../context/quoteFlowReducer'

const steps = [
  { key: 'personal', label: 'Personal Information' },
  { key: 'coverage', label: 'Coverage' },
  { key: 'review', label: 'Review and Submit' },
] as const

type QuoteProgressProps = Readonly<{
  currentStep: QuoteStep
}>

export function QuoteProgress({ currentStep }: QuoteProgressProps) {
  const activeStep = currentStep === 'result'
    ? steps.length - 1
    : steps.findIndex(({ key }) => key === currentStep)
  const currentLabel = steps[activeStep]?.label ?? 'Unknown step'
  const progressLabel = `Quote progress: step ${String(activeStep + 1)} of ${String(steps.length)}, ${currentLabel}`
  const progressValue = ((activeStep + 1) / steps.length) * 100

  return (
    <Box component="nav" aria-label="Quote progress" sx={{ minWidth: 0 }}>
      <Box sx={{ display: { xs: 'block', sm: 'none' } }}>
        <Typography variant="overline" color="text.secondary">
          Step {activeStep + 1} of {steps.length}
        </Typography>
        <Typography component="p" variant="body2" sx={{ fontWeight: 700 }} aria-current="step" gutterBottom>
          Current step: {currentLabel}
        </Typography>
        <Box
          role="progressbar"
          aria-label={progressLabel}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progressValue}
          sx={{ height: 6, borderRadius: 999, bgcolor: 'action.hover', overflow: 'hidden' }}
        >
          <Box sx={{ width: `${String(progressValue)}%`, height: '100%', bgcolor: 'primary.main' }} />
        </Box>
      </Box>
      <Stepper activeStep={activeStep} sx={{ display: { xs: 'none', sm: 'flex' } }}>
        {steps.map(({ key, label }, index) => (
          <Step key={key} completed={index < activeStep}>
            <StepLabel>
              <Typography
                component="span"
                variant="body2"
                aria-current={index === activeStep ? 'step' : undefined}
              >
                {label}
              </Typography>
            </StepLabel>
          </Step>
        ))}
      </Stepper>
      <Typography
        role="status"
        sx={{
          position: 'absolute',
          width: '1px',
          height: '1px',
          p: 0,
          m: '-1px',
          border: 0,
          overflow: 'hidden',
          clip: 'rect(0 0 0 0)',
          whiteSpace: 'nowrap',
        }}
      >
        Current step: {currentLabel}
      </Typography>
    </Box>
  )
}
