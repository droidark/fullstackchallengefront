import { Container, Paper, Stack, Typography } from '@mui/material'
import type { QuoteApi } from '../features/quote/api/quoteApi'
import { QuoteWizard } from '../features/quote/components/QuoteWizard'
import { QuoteFlowProvider } from '../features/quote/context/QuoteFlowContext'

type AppProps = Readonly<{
  quoteApi?: QuoteApi
}>

export function App({ quoteApi }: AppProps) {
  return (
    <Container
      component="main"
      maxWidth="md"
      sx={{ px: { xs: 1.5, sm: 3 }, py: { xs: 2, sm: 5, md: 7 }, minWidth: 0 }}
    >
      <Paper elevation={2} sx={{ p: { xs: 2, sm: 4, md: 5 }, minWidth: 0, overflow: 'hidden' }}>
        <Stack spacing={3}>
          <div>
            <Typography component="h1" variant="h3" gutterBottom>
              Insurance quote
            </Typography>
            <Typography color="text.secondary">
              A guided flow for creating and submitting an insurance quote.
            </Typography>
          </div>
          <QuoteFlowProvider {...(quoteApi === undefined ? {} : { api: quoteApi })}>
            <QuoteWizard />
          </QuoteFlowProvider>
        </Stack>
      </Paper>
    </Container>
  )
}
