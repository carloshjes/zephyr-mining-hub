// Formatação de valores pra exibição (locale pt-BR).
// Convenção do projeto: valor ausente vira "—" na tela, nunca 0 nem mock.

export const DASH = '—'

const HASHRATE_UNITS = ['H/s', 'kH/s', 'MH/s', 'GH/s', 'TH/s', 'PH/s']

export function formatNumber(value: number, maxDigits = 2, minDigits = 0): string {
  return value.toLocaleString('pt-BR', {
    maximumFractionDigits: maxDigits,
    minimumFractionDigits: minDigits,
  })
}

export function formatInteger(value: number): string {
  return formatNumber(Math.round(value), 0)
}

export function formatUsd(value: number, digits = 4): string {
  return `US$ ${formatNumber(value, digits, digits)}`
}

export function formatZeph(value: number, digits = 3): string {
  return `${formatNumber(value, digits, digits)} ZEPH`
}

export function formatHashrate(hashesPerSecond: number): string {
  let value = hashesPerSecond
  let unit = 0
  while (value >= 1_000 && unit < HASHRATE_UNITS.length - 1) {
    value /= 1_000
    unit += 1
  }
  return `${formatNumber(value, 2, unit === 0 ? 0 : 2)} ${HASHRATE_UNITS[unit]}`
}

// Dificuldade em notação compacta ("8,56 bi") — o valor exato vai no title/sub
export function formatCompact(value: number): string {
  return value.toLocaleString('pt-BR', { notation: 'compact', maximumFractionDigits: 2 })
}

export function formatDateTime(date: Date): string {
  return date.toLocaleString('pt-BR', { dateStyle: 'long', timeStyle: 'short' })
}

export function formatTime(date: Date): string {
  return date.toLocaleTimeString('pt-BR')
}

/** Aplica o formatador só se o valor existir; senão devolve "—". */
export function orDash<T>(
  value: T | null | undefined,
  format: (value: T) => string,
): string {
  return value === null || value === undefined ? DASH : format(value)
}

/** Variação percentual entre o valor atual e uma referência (ex.: fechamento de ontem). */
export function percentChange(current: number, reference: number): number | undefined {
  if (!Number.isFinite(reference) || reference === 0) return undefined
  return ((current - reference) / reference) * 100
}
