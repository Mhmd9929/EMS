export const EMPLOYMENT_TYPES = [
  { value: "FULL_TIME", label: "Full-time" },
  { value: "PART_TIME", label: "Part-time" },
  { value: "CONTRACT", label: "Contract" },
] as const;

export const EMPLOYEE_STATUSES = [
  { value: "ACTIVE", label: "Active" },
  { value: "ON_LEAVE", label: "On leave" },
  { value: "TERMINATED", label: "Terminated" },
] as const;

export const GENDERS = [
  { value: "MALE", label: "Male" },
  { value: "FEMALE", label: "Female" },
] as const;

export const TERMINATION_REASONS = [
  "Resignation",
  "End of contract",
  "Termination by employer",
  "Termination during probation",
  "Retirement",
  "Absconding",
  "Death",
  "Other",
] as const;

export const UAE_EMIRATES = ["Abu Dhabi", "Dubai", "Sharjah", "Ajman", "Umm Al Quwain", "Ras Al Khaimah", "Fujairah"] as const;

export const CURRENCIES = ["AED", "SAR", "QAR", "KWD", "BHD", "OMR", "USD", "EUR", "GBP"] as const;

export const TIMEZONES = [
  "Asia/Dubai",
  "Asia/Riyadh",
  "Asia/Qatar",
  "Asia/Kuwait",
  "Asia/Bahrain",
  "Asia/Muscat",
  "Europe/London",
  "UTC",
] as const;

export const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
] as const;

export function labelOf<T extends readonly { value: string; label: string }[]>(list: T, value: string | null | undefined) {
  return list.find((i) => i.value === value)?.label ?? value ?? "—";
}
