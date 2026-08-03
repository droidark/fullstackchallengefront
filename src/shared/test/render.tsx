import { render } from '@testing-library/react'
import type { ReactElement } from 'react'
import { AppProviders } from '../../app/AppProviders'

export function renderWithProviders(ui: ReactElement) {
  return render(ui, { wrapper: AppProviders })
}
