import { yupResolver } from '@hookform/resolvers/yup'
import { Stack, TextField, Typography } from '@mui/material'
import { useEffect, useRef } from 'react'
import { useForm } from 'react-hook-form'
import { ApiErrorAlert } from '../components/ApiErrorAlert'
import { useQuoteFlowActions, useQuoteFlowState } from '../context/useQuoteFlow'
import type { ApiFieldError } from '../models/apiError'
import type { PersonalInformationFormValues } from '../models/personalInformation'
import { personalInformationSchema } from '../schemas/personalInformationSchema'
import { LoadingButton } from '../../../shared/components/LoadingButton'

const knownFields = new Set<keyof PersonalInformationFormValues>([
  'name',
  'email',
  'age',
  'zipCode',
])

function isKnownField(field: string): field is keyof PersonalInformationFormValues {
  return knownFields.has(field as keyof PersonalInformationFormValues)
}

export function PersonalInformationStep() {
  const state = useQuoteFlowState()
  const { createOrReuseQuote, clearError } = useQuoteFlowActions()
  const headingRef = useRef<HTMLHeadingElement>(null)
  const defaults = state.personalInformation
  const form = useForm<PersonalInformationFormValues>({
    resolver: yupResolver(personalInformationSchema),
    defaultValues: {
      name: defaults.name,
      email: defaults.email,
      zipCode: defaults.zipCode,
      ...(state.submittedPersonalInformation === undefined ? {} : { age: defaults.age }),
    },
    shouldFocusError: true,
  })
  const { clearErrors, formState: { errors }, handleSubmit, register, setError, setFocus } = form
  const loading = state.activeRequest === 'create'

  useEffect(() => {
    if (state.quote !== undefined) headingRef.current?.focus()
  }, [state.quote])

  const mapBackendErrors = (fieldErrors: ApiFieldError[]) => {
    const mapped = fieldErrors.filter(({ field }) => isKnownField(field))
    mapped.forEach(({ field, message }) => {
      if (isKnownField(field)) setError(field, { type: 'server', message })
    })
    const first = mapped[0]
    if (first !== undefined && isKnownField(first.field)) setFocus(first.field)
  }

  const submit = handleSubmit(async (values) => {
    const result = await createOrReuseQuote(values)
    if (!result.ok && result.error.kind === 'backend') {
      mapBackendErrors(result.error.fieldErrors)
    }
  })

  return (
    <Stack component="section" spacing={3} aria-labelledby="personal-information-heading">
      <div>
        <Typography
          ref={headingRef}
          id="personal-information-heading"
          component="h2"
          variant="h5"
          tabIndex={-1}
          gutterBottom
        >
          Personal Information
        </Typography>
        <Typography color="text.secondary">
          Tell us who this quote is for. All fields are required.
        </Typography>
      </div>

      <ApiErrorAlert
        error={state.globalError}
        title="We could not create your quote"
        onDismiss={clearError}
        onDismissFocus={() => { headingRef.current?.focus() }}
      />

      <Stack
        component="form"
        noValidate
        spacing={2.5}
        aria-label="Personal information"
        aria-busy={loading}
        onSubmit={(event) => { void submit(event) }}
      >
        <TextField
          label="Full name"
          required
          autoComplete="name"
          error={errors.name !== undefined}
          helperText={errors.name?.message ?? 'Enter your full name.'}
          {...register('name', { onChange: () => { clearErrors('name') } })}
        />
        <TextField
          label="Email"
          type="email"
          required
          autoComplete="email"
          error={errors.email !== undefined}
          helperText={errors.email?.message ?? 'We will use this for your quote.'}
          {...register('email', { onChange: () => { clearErrors('email') } })}
        />
        <TextField
          label="Age"
          type="number"
          required
          slotProps={{ htmlInput: { inputMode: 'numeric', step: 1 } }}
          error={errors.age !== undefined}
          helperText={errors.age?.message ?? 'Enter your age as a whole number.'}
          {...register('age', {
            setValueAs: (value: unknown) => value === '' ? undefined : Number(value),
            onChange: () => { clearErrors('age') },
          })}
        />
        <TextField
          label="ZIP code"
          type="text"
          required
          autoComplete="postal-code"
          slotProps={{ htmlInput: { inputMode: 'numeric' } }}
          error={errors.zipCode !== undefined}
          helperText={errors.zipCode?.message ?? 'Enter your ZIP code.'}
          {...register('zipCode', { onChange: () => { clearErrors('zipCode') } })}
        />
        <LoadingButton
          type="submit"
          variant="contained"
          size="large"
          loading={loading}
          sx={{ width: { xs: '100%', sm: 'auto' }, alignSelf: { sm: 'flex-end' }, minWidth: { sm: 150 } }}
        >
          Continue
        </LoadingButton>
      </Stack>
    </Stack>
  )
}
