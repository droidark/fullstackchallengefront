export type SyntheticApplicant = Readonly<{
  name: string
  email: string
  age: number
  zipCode: string
}>

export function syntheticApplicant(age: number, label: string): SyntheticApplicant {
  const suffix = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
  return {
    name: `Browser E2E ${label}`,
    email: `browser.e2e.${label.toLowerCase()}.${suffix}@example.invalid`,
    age,
    zipCode: '00123',
  }
}
