// Formatação de valores pra exibição (locale en-US explícito).
// Convenção do projeto: valor ausente vira "—" na tela, nunca 0 nem mock.

export const DASH = '—'
export const DISPLAY_LOCALE = 'en-US'

const HASHRATE_UNITS = ['H/s', 'kH/s', 'MH/s', 'GH/s', 'TH/s', 'PH/s']

export function formatNumber(value: number, maxDigits = 2, minDigits = 0): string {
  return value.toLocaleString(DISPLAY_LOCALE, {
    maximumFractionDigits: maxDigits,
    minimumFractionDigits: minDigits,
  })
}

export function formatInteger(value: number): string {
  return formatNumber(Math.round(value), 0)
}

export function formatUsd(value: number, digits = 4): string {
  return `$${formatNumber(value, digits, digits)}`
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
  return value.toLocaleString(DISPLAY_LOCALE, { notation: 'compact', maximumFractionDigits: 2 })
}

export function formatDateTime(date: Date): string {
  return date.toLocaleString(DISPLAY_LOCALE, { dateStyle: 'long', timeStyle: 'short' })
}

export function formatTime(date: Date): string {
  return date.toLocaleTimeString(DISPLAY_LOCALE)
}

/** Duração compacta em duas unidades: "2 d 3 h", "3 h 12 min", "45 s". */
export function formatDuration(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds))
  const days = Math.floor(seconds / 86_400)
  const hours = Math.floor((seconds % 86_400) / 3_600)
  const minutes = Math.floor((seconds % 3_600) / 60)
  if (days > 0) return `${days} d ${hours} h`
  if (hours > 0) return `${hours} h ${minutes} min`
  if (minutes > 0) return `${minutes} min`
  return `${seconds % 60} s`
}

/** Tempo relativo curto pra "último share": "agora", "há 3 min", "há 2 h". */
export function formatAgo(unixSeconds: number, nowMs: number = Date.now()): string {
  const elapsedSeconds = Math.max(0, Math.floor(nowMs / 1_000 - unixSeconds))
  if (elapsedSeconds < 60) return 'now'
  return `${formatDuration(elapsedSeconds)} ago`
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
