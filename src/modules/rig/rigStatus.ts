// Estado visual único do rig ("minerando normal" / "hashrate abaixo do
// esperado" / "offline") + histórico de hashrate em localStorage que serve de
// régua pro "esperado". Mesmo padrão do luckHistory da Bússola de Pools:
// leituras espaçadas, cap fixo, dado corrompido descartado na leitura.

export type RigStatusKind = 'normal' | 'below' | 'offline'

export interface RigStatusInput {
  /** Hashrate "atual" da fonte escolhida (XMRig local se alcançável, senão pool). */
  currentHashrate?: number
  /** Média das últimas leituras da MESMA fonte (undefined = sem referência ainda). */
  referenceAverage?: number
  /** Último share aceito pela pool, unix segundos (evidência de vida). */
  lastShareAt?: number
  nowMs?: number
}

// Abaixo de 70% da média das últimas leituras = "abaixo do esperado".
// Folga proposital: hashrate de pool oscila por variância de share.
const BELOW_THRESHOLD = 0.7
// Share aceito há menos de 10 min ainda conta como "vivo" mesmo com a janela
// de hashrate da pool zerada (rig recém-ligado demora a consolidar hashrate).
const ALIVE_SHARE_WINDOW_MS = 10 * 60_000

export function computeRigStatus({
  currentHashrate,
  referenceAverage,
  lastShareAt,
  nowMs = Date.now(),
}: RigStatusInput): RigStatusKind {
  const hasHashrate = currentHashrate !== undefined && currentHashrate > 0
  const hasRecentShare =
    lastShareAt !== undefined && nowMs - lastShareAt * 1_000 < ALIVE_SHARE_WINDOW_MS

  if (!hasHashrate && !hasRecentShare) return 'offline'
  if (!hasHashrate) {
    // Vivo só pelo share recente: com referência histórica isso é queda;
    // sem referência, dá o benefício da dúvida (rig consolidando hashrate)
    return referenceAverage !== undefined ? 'below' : 'normal'
  }
  if (referenceAverage !== undefined && currentHashrate < referenceAverage * BELOW_THRESHOLD) {
    return 'below'
  }
  return 'normal'
}

// ---------------------------------------------------------------------------
// Histórico de leituras de hashrate por fonte.
// A chave separa pool/carteira/fonte: o XMRig mede UM rig, a pool mede TODOS
// os workers da carteira — misturar as duas escalas falsearia a média.

export interface HashrateReading {
  /** Quando a leitura foi feita (epoch ms). */
  t: number
  /** Hashrate em H/s. */
  h: number
}

export const HASHRATE_HISTORY_LIMIT = 30

// Polling da pool é 60 s; o gap evita duplicar leitura em reload/volta de aba
const MIN_READING_GAP_MS = 55_000

const STORAGE_KEY = 'zephyr-hub.rig.hashrate-history.v1'

export function historyKey(poolId: string, wallet: string, source: 'pool' | 'xmrig'): string {
  return `${poolId}:${wallet}:${source}`
}

function isValidReading(value: unknown): value is HashrateReading {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as HashrateReading).t === 'number' &&
    typeof (value as HashrateReading).h === 'number' &&
    Number.isFinite((value as HashrateReading).h)
  )
}

function loadAllHistories(): Record<string, HashrateReading[]> {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return {}
    const histories: Record<string, HashrateReading[]> = {}
    for (const [key, readings] of Object.entries(parsed)) {
      if (Array.isArray(readings)) {
        histories[key] = readings.filter(isValidReading).slice(-HASHRATE_HISTORY_LIMIT)
      }
    }
    return histories
  } catch {
    return {}
  }
}

export function loadHashrateHistory(key: string): HashrateReading[] {
  return loadAllHistories()[key] ?? []
}

/**
 * Anexa uma leitura ao histórico da fonte e devolve a lista nova (pronta pro
 * setState). Leituras a menos de MIN_READING_GAP_MS da anterior são ignoradas.
 */
export function appendHashrateReading(
  key: string,
  hashrate: number,
  now: number = Date.now(),
): HashrateReading[] {
  const histories = loadAllHistories()
  const previous = histories[key] ?? []
  const last = previous[previous.length - 1]
  if (last && now - last.t < MIN_READING_GAP_MS) return previous
  const next = [...previous, { t: now, h: hashrate }].slice(-HASHRATE_HISTORY_LIMIT)
  histories[key] = next
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(histories))
  } catch {
    // Sem localStorage a régua vive só na sessão — aceitável
  }
  return next
}

/** Média das leituras, ou undefined com menos de 3 (referência fraca demais). */
export function referenceAverage(readings: HashrateReading[]): number | undefined {
  if (readings.length < 3) return undefined
  return readings.reduce((sum, reading) => sum + reading.h, 0) / readings.length
}
