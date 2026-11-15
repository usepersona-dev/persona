// How the Billing page writes and reads credits and dollars: whole numbers without decimals, others with two
export function formatCredits(credits: number) {
  const whole = Number.isInteger(credits)
  const number = Math.abs(credits).toLocaleString("en-US", { minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: 2 })
  if (credits < 0) return `−${number}`
  return number
}

export function formatDollars(dollars: number) {
  const whole = Number.isInteger(dollars)
  const text = dollars.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: whole ? 0 : 2 })
  return text
}

export function formatTopUp(credits: number, creditUsd: number) {
  return `${formatCredits(credits)} credits — ${formatDollars(credits * creditUsd)}`
}

export function parseCredits(text: string) {
  const digits = text.replaceAll(",", "").trim()
  if (digits === "") return Number.NaN
  const credits = Number(digits)
  return credits
}

export function isReloadLine(credits: number) {
  const valid = Number.isInteger(credits) && credits >= 1 && credits <= 1_000
  return valid
}
