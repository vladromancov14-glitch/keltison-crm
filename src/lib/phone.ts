/** Последние 10 цифр номера без кода страны (+7 / 8 / 7). */
export function phoneLookupKey(input: string): string {
  const digits = input.replace(/\D/g, "")
  if (!digits) return ""
  if (digits.length >= 10) return digits.slice(-10)
  return digits
}

/** Единый формат хранения: +7XXXXXXXXXX. */
export function normalizePhone(input: string): string | null {
  const national = phoneLookupKey(input)
  if (national.length !== 10) return null
  return `+7${national}`
}

export function phonesMatch(a: string, b: string): boolean {
  const left = phoneLookupKey(a)
  const right = phoneLookupKey(b)
  return left.length === 10 && right.length === 10 && left === right
}
