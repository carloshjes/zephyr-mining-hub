// Histórico simples do "luck" por pool em localStorage, pro mini-gráfico de
// tendência da tabela. Guarda as últimas LUCK_HISTORY_LIMIT leituras por pool;
// localStorage indisponível (modo privado, cota cheia) degrada pra histórico
// só em memória da sessão — nunca quebra a página.

export interface LuckReading {
  /** Quando a leitura foi feita (epoch ms). */
  t: number
  /** Luck/effort em % no momento da leitura. */
  luck: number
}

export type LuckHistoryMap = Record<string, LuckReading[]>

export const LUCK_HISTORY_LIMIT = 20

// Leituras mais próximas que isso são ignoradas — evita encher o histórico
// com duplicatas em recarregamentos seguidos ou no refetch ao voltar pra aba
// (o polling normal é de 60 s).
const MIN_READING_GAP_MS = 55_000

const STORAGE_KEY = 'zephyr-hub.pools.luck-history.v1'

function isValidReading(value: unknown): value is LuckReading {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as LuckReading).t === 'number' &&
    typeof (value as LuckReading).luck === 'number' &&
    Number.isFinite((value as LuckReading).luck)
  )
}

export function loadLuckHistory(): LuckHistoryMap {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return {}
    // Valida entrada a entrada: dado corrompido é descartado, não propagado
    const history: LuckHistoryMap = {}
    for (const [poolId, readings] of Object.entries(parsed)) {
      if (Array.isArray(readings)) {
        history[poolId] = readings.filter(isValidReading).slice(-LUCK_HISTORY_LIMIT)
      }
    }
    return history
  } catch {
    return {}
  }
}

function saveLuckHistory(history: LuckHistoryMap): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(history))
  } catch {
    // Sem localStorage o histórico vive só na memória — comportamento aceitável
  }
}

/**
 * Anexa uma leitura por pool ao histórico persistido e devolve o mapa novo
 * (imutável, pronto pra setState). Leituras muito próximas da anterior são
 * ignoradas (ver MIN_READING_GAP_MS).
 */
export function appendLuckReadings(
  readings: { poolId: string; luck: number }[],
  now: number = Date.now(),
): LuckHistoryMap {
  const history = loadLuckHistory()
  let changed = false

  for (const { poolId, luck } of readings) {
    const previous = history[poolId] ?? []
    const last = previous[previous.length - 1]
    if (last && now - last.t < MIN_READING_GAP_MS) continue
    history[poolId] = [...previous, { t: now, luck }].slice(-LUCK_HISTORY_LIMIT)
    changed = true
  }

  if (changed) saveLuckHistory(history)
  return history
}
