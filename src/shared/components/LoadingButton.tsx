import { Button, CircularProgress } from '@mui/material'
import type { ButtonProps } from '@mui/material/Button'

type LoadingButtonProps = ButtonProps & Readonly<{
  loading: boolean
  loadingLabel?: string
}>

export function LoadingButton({ loading, loadingLabel = 'Creating quote…', children, disabled, ...buttonProps }: LoadingButtonProps) {
  return (
    <Button
      {...buttonProps}
      disabled={disabled === true || loading}
      aria-busy={loading}
      startIcon={loading ? <CircularProgress size={18} color="inherit" aria-hidden /> : undefined}
    >
      {loading ? loadingLabel : children}
    </Button>
  )
}
