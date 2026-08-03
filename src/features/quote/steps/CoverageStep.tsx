import { yupResolver } from '@hookform/resolvers/yup'
import {
  Alert, AlertTitle, Button, Checkbox, FormControl, FormControlLabel, FormGroup, FormHelperText,
  FormLabel, Radio, RadioGroup, Stack, Typography,
} from '@mui/material'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { useEffect, useRef } from 'react'
import { LoadingButton } from '../../../shared/components/LoadingButton'
import { ApiErrorAlert } from '../components/ApiErrorAlert'
import { useQuoteFlowActions, useQuoteFlowState } from '../context/useQuoteFlow'
import type { ApiFieldError } from '../models/apiError'
import { coverageDefaults } from '../models/coverage'
import type { CoverageFormValues } from '../models/coverage'
import { COVERAGE_TYPES, HEALTH_CONDITIONS } from '../models/quote'
import type { QuoteResponse } from '../models/quote'
import { createCoverageSchema } from '../schemas/coverageSchema'

const labels = {
  DIABETES: 'Diabetes', HEART_DISEASE: 'Heart disease', HYPERTENSION: 'Hypertension',
  CANCER_HISTORY: 'Cancer history', OTHER: 'Other',
} as const
const knownFields = new Set<keyof CoverageFormValues>([
  'coverageType', 'hasPreexistingConditions', 'conditions', 'takesPrescriptionMedication',
  'usesTobacco', 'needsSpouseCoverage',
])
function isKnownField(field: string): field is keyof CoverageFormValues {
  return knownFields.has(field as keyof CoverageFormValues)
}

type BooleanQuestionProps = Readonly<{
  name: 'hasPreexistingConditions' | 'takesPrescriptionMedication' | 'usesTobacco' | 'needsSpouseCoverage'
  label: string
  control: ReturnType<typeof useForm<CoverageFormValues>>['control']
  error: string | undefined
}>

function BooleanQuestion({ name, label, control, error }: BooleanQuestionProps) {
  const helperId = `coverage-${name}-helper`
  return (
    <FormControl
      required
      error={error !== undefined}
      component="fieldset"
      aria-describedby={error === undefined ? undefined : helperId}
    >
      <FormLabel component="legend">{label}</FormLabel>
      <Controller name={name} control={control} render={({ field }) => (
        <RadioGroup
          row
          name={field.name}
          value={field.value === undefined ? '' : String(field.value)}
          onBlur={field.onBlur}
          onChange={(_, value) => { field.onChange(value === 'true') }}
          aria-describedby={error === undefined ? undefined : helperId}
          aria-invalid={error === undefined ? undefined : true}
          sx={{ flexWrap: 'wrap', columnGap: 1 }}
        >
          <FormControlLabel
            value="true"
            control={<Radio slotProps={{ input: { ref: field.ref } }} />}
            label="Yes"
          />
          <FormControlLabel value="false" control={<Radio />} label="No" />
        </RadioGroup>
      )} />
      {error !== undefined && <FormHelperText id={helperId}>{error}</FormHelperText>}
    </FormControl>
  )
}

type CoverageFormProps = Readonly<{
  quote: QuoteResponse
}>

function CoverageForm({ quote }: CoverageFormProps) {
  const state = useQuoteFlowState()
  const { updateCoverage, goToPersonal, clearError } = useQuoteFlowActions()
  const headingRef = useRef<HTMLHeadingElement>(null)
  const form = useForm<CoverageFormValues>({
    resolver: yupResolver(createCoverageSchema(quote.age)),
    defaultValues: coverageDefaults(quote),
    shouldFocusError: true,
  })
  const { control, formState: { errors }, handleSubmit, setError, setFocus, setValue } = form
  const loading = state.activeRequest === 'coverage'
  const over65 = quote.age > 65
  const hasConditions = useWatch({ control, name: 'hasPreexistingConditions' })

  useEffect(() => {
    if (hasConditions === false) setValue('conditions', [], { shouldValidate: true })
  }, [hasConditions, setValue])

  useEffect(() => {
    headingRef.current?.focus()
  }, [])

  const submit = handleSubmit(async (values) => {
    const result = await updateCoverage(values)
    if (!result.ok && result.error.kind === 'backend') {
      const mapped = result.error.fieldErrors.filter(({ field }) => isKnownField(field))
      mapped.forEach(({ field, message }: ApiFieldError) => {
        if (isKnownField(field)) setError(field, { type: 'server', message })
      })
      const first = mapped[0]
      if (first !== undefined && isKnownField(first.field)) setFocus(first.field)
    }
  })

  return (
    <Stack component="section" spacing={3} aria-labelledby="coverage-heading">
      <div>
        <Typography
          ref={headingRef}
          id="coverage-heading"
          component="h2"
          variant="h5"
          tabIndex={-1}
          gutterBottom
        >
          Coverage
        </Typography>
        <Typography color="text.secondary">Choose the coverage to send to the quote service.</Typography>
      </div>
      <ApiErrorAlert
        error={state.globalError}
        title="We could not update coverage"
        onDismiss={clearError}
        onDismissFocus={() => { headingRef.current?.focus() }}
      />
      <Stack component="form" spacing={3} noValidate aria-label="Coverage" aria-busy={loading} onSubmit={(event) => { void submit(event) }}>
        <FormControl
          required
          error={errors.coverageType !== undefined}
          component="fieldset"
          aria-describedby="coverage-type-helper"
        >
          <FormLabel component="legend">Coverage type</FormLabel>
          <Controller name="coverageType" control={control} render={({ field }) => (
            <RadioGroup
              name={field.name}
              value={field.value}
              onBlur={field.onBlur}
              onChange={field.onChange}
              row
              aria-label="Coverage type"
              aria-describedby="coverage-type-helper"
              aria-invalid={errors.coverageType === undefined ? undefined : true}
              sx={{ flexWrap: 'wrap', columnGap: 1 }}
            >
              {COVERAGE_TYPES.map((type, index) => (
                <FormControlLabel
                  key={type}
                  value={type}
                  control={<Radio slotProps={index === 0 ? { input: { ref: field.ref } } : undefined} />}
                  label={type}
                  sx={{ mr: 2 }}
                />
              ))}
            </RadioGroup>
          )} />
          <FormHelperText id="coverage-type-helper">
            {errors.coverageType?.message ?? 'Select one coverage type.'}
          </FormHelperText>
        </FormControl>

        {over65 && <>
          <BooleanQuestion name="hasPreexistingConditions" label="Do you have pre-existing conditions?" control={control} error={errors.hasPreexistingConditions?.message} />
          {hasConditions === true && (
            <FormControl
              required
              error={errors.conditions !== undefined}
              component="fieldset"
              aria-describedby="coverage-conditions-helper"
            >
              <FormLabel component="legend">Conditions</FormLabel>
              <Controller name="conditions" control={control} render={({ field }) => (
                <FormGroup aria-describedby="coverage-conditions-helper">
                  {HEALTH_CONDITIONS.map((condition, index) => <FormControlLabel key={condition} label={labels[condition]} sx={{ alignItems: 'flex-start', minWidth: 0 }} control={<Checkbox slotProps={index === 0 ? { input: { ref: field.ref } } : undefined} checked={field.value.includes(condition)} onChange={(_, checked) => {
                    field.onChange(checked ? [...field.value, condition] : field.value.filter((item) => item !== condition))
                  }} />} />)}
                </FormGroup>
              )} />
              <FormHelperText id="coverage-conditions-helper">
                {errors.conditions?.message ?? 'Select all that apply.'}
              </FormHelperText>
            </FormControl>
          )}
          <BooleanQuestion name="takesPrescriptionMedication" label="Do you take prescription medication?" control={control} error={errors.takesPrescriptionMedication?.message} />
          <BooleanQuestion name="usesTobacco" label="Do you use tobacco?" control={control} error={errors.usesTobacco?.message} />
          <BooleanQuestion name="needsSpouseCoverage" label="Do you need spouse coverage?" control={control} error={errors.needsSpouseCoverage?.message} />
        </>}
        <Stack direction={{ xs: 'column', sm: 'row' }} sx={{ justifyContent: 'space-between', gap: 2 }}>
          {quote.status === 'DRAFT' && (
            <Button
              variant="outlined"
              disabled={loading}
              onClick={goToPersonal}
              sx={{ width: { xs: '100%', sm: 'auto' } }}
            >
              Back to personal information
            </Button>
          )}
          <LoadingButton
            type="submit"
            variant="contained"
            loading={loading}
            loadingLabel="Updating coverage…"
            sx={{ width: { xs: '100%', sm: 'auto' }, minWidth: { sm: 190 } }}
          >
            Continue to Review
          </LoadingButton>
        </Stack>
      </Stack>
    </Stack>
  )
}

export function CoverageStep() {
  const state = useQuoteFlowState()
  const { resetFlow } = useQuoteFlowActions()
  const headingRef = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    if (state.quote === undefined) headingRef.current?.focus()
  }, [state.quote])

  const startNewQuote = () => {
    resetFlow()
    requestAnimationFrame(() => { document.getElementById('personal-information-heading')?.focus() })
  }

  if (state.quote !== undefined) {
    return <CoverageForm quote={state.quote} />
  }

  return (
    <Stack component="section" spacing={3} aria-labelledby="coverage-heading">
      <Typography
        ref={headingRef}
        id="coverage-heading"
        component="h2"
        variant="h5"
        tabIndex={-1}
      >
        Coverage unavailable
      </Typography>
      <Alert severity="error" role="alert" sx={{ overflowWrap: 'anywhere' }}>
        <AlertTitle>Start a new quote to continue</AlertTitle>
        No active quote is available for coverage selection.
      </Alert>
      <Button variant="contained" onClick={startNewQuote} sx={{ alignSelf: 'flex-start', width: { xs: '100%', sm: 'auto' } }}>
        Start New Quote
      </Button>
    </Stack>
  )
}
