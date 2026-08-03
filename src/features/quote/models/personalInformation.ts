import type { CreateQuoteRequest } from './quote'

export interface PersonalInformationFormValues {
  name: string
  email: string
  age: number
  zipCode: string
}

export function normalizePersonalInformation(
  values: PersonalInformationFormValues,
): PersonalInformationFormValues {
  return {
    name: values.name.trim(),
    email: values.email.trim(),
    age: values.age,
    zipCode: values.zipCode.trim(),
  }
}

export function personalInformationEquals(
  first: PersonalInformationFormValues,
  second: PersonalInformationFormValues,
): boolean {
  return first.name === second.name &&
    first.email === second.email &&
    first.age === second.age &&
    first.zipCode === second.zipCode
}

export function toCreateQuoteRequest(
  values: PersonalInformationFormValues,
): CreateQuoteRequest {
  return {
    name: values.name,
    email: values.email,
    age: values.age,
    zipCode: values.zipCode,
  }
}
