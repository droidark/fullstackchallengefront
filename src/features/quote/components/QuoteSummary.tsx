import { Box, Divider, Stack, Typography } from '@mui/material'
import { useId, type ReactNode } from 'react'
import type { QuoteResponse } from '../models/quote'
import {
  formatBooleanAnswer,
  formatCoverageType,
  formatHealthConditions,
  formatPremium,
  formatQuoteStatus,
} from '../utils/quotePresentation'

type SummaryFieldProps = Readonly<{
  label: string
  value: ReactNode
}>

function SummaryField({ label, value }: SummaryFieldProps) {
  return (
    <Box sx={{ minWidth: 0 }}>
      <Typography component="dt" variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>
        {label}
      </Typography>
      <Typography
        component="dd"
        sx={{ m: 0, mt: 0.5, overflowWrap: 'anywhere' }}
      >
        {value}
      </Typography>
    </Box>
  )
}

type SummarySectionProps = Readonly<{
  headingId: string
  heading: string
  children: ReactNode
}>

function SummarySection({ headingId, heading, children }: SummarySectionProps) {
  return (
    <Stack component="section" spacing={2} aria-labelledby={headingId}>
      <Typography id={headingId} component="h3" variant="h6">
        {heading}
      </Typography>
      <Box
        component="dl"
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'repeat(2, minmax(0, 1fr))' },
          gap: 2,
          m: 0,
          minWidth: 0,
        }}
      >
        {children}
      </Box>
    </Stack>
  )
}

export type QuoteSummaryProps = Readonly<{
  quote: QuoteResponse
}>

export function QuoteSummary({ quote }: QuoteSummaryProps) {
  const id = useId()

  return (
    <Stack spacing={3} aria-label="Quote details">
      <SummarySection headingId={`${id}-personal`} heading="Personal Information">
        <SummaryField label="Name" value={quote.name} />
        <SummaryField label="Email" value={quote.email} />
        <SummaryField label="Age" value={String(quote.age)} />
        <SummaryField label="ZIP code" value={quote.zipCode} />
      </SummarySection>

      <Divider />

      <SummarySection headingId={`${id}-coverage`} heading="Coverage">
        <SummaryField label="Coverage type" value={formatCoverageType(quote.coverageType)} />
        <SummaryField label="Monthly premium" value={formatPremium(quote.monthlyPremium)} />
        <SummaryField
          label="Quote status"
          value={<Box component="span" sx={{ fontWeight: 700 }}>{formatQuoteStatus(quote.status)}</Box>}
        />
      </SummarySection>

      {quote.age > 65 && (
        <>
          <Divider />
          <SummarySection headingId={`${id}-supplemental`} heading="Supplemental Answers">
            <SummaryField
              label="Pre-existing conditions"
              value={formatBooleanAnswer(quote.hasPreexistingConditions)}
            />
            <SummaryField label="Conditions" value={formatHealthConditions(quote.conditions)} />
            <SummaryField
              label="Prescription medication"
              value={formatBooleanAnswer(quote.takesPrescriptionMedication)}
            />
            <SummaryField label="Tobacco use" value={formatBooleanAnswer(quote.usesTobacco)} />
            <SummaryField
              label="Spouse coverage"
              value={formatBooleanAnswer(quote.needsSpouseCoverage)}
            />
          </SummarySection>
        </>
      )}
    </Stack>
  )
}
