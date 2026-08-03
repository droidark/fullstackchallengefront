import * as yup from 'yup'
import type { PersonalInformationFormValues } from '../models/personalInformation'

export const personalInformationSchema: yup.ObjectSchema<PersonalInformationFormValues> = yup.object({
  name: yup.string().trim().required('Full name is required.'),
  email: yup.string().trim().required('Email is required.').email('Enter a valid email address.'),
  age: yup.number()
    .transform((value: unknown, originalValue: unknown) => originalValue === '' ? undefined : value)
    .typeError('Age must be a number.')
    .required('Age is required.')
    .integer('Age must be a whole number.'),
  zipCode: yup.string().trim().required('ZIP code is required.'),
})
