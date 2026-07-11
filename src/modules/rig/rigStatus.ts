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
  /** Saldo pendente na pool (ZEPH) na mesma leitura — só o histórico DIÁRIO
      amostra (2026-07-11); opcional porque nem toda pool expõe o campo
      (HeroMiners pode vir "—") e leituras antigas não o têm. Atenção de
      leitura: o saldo ZERA quando a pool paga — a serra é o pagamento. */
  b?: number
}

export const HASHRATE_HISTORY_LIMIT = 30

// Polling da pool é 60 s; o gap evita duplicar leitura em reload/volta de aba
const MIN_READING_GAP_MS = 55_000

const STORAGE_KEY = 'zephyr-hub.rig.hashrate-history.v1'

export function historyKey(poolId: string, wallet: string, source: 'pool' | 'xmrig'): string {
  return `${poolId}:${wallet}:${source}`
}

function isValidReading(value: unknown): value is HashrateReading {
  const reading = value as HashrateReading
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof reading.t === 'number' &&
    typeof reading.h === 'number' &&
    Number.isFinite(reading.h) &&
    // b é opcional; presente, precisa ser número finito
    (reading.b === undefined || (typeof reading.b === 'number' && Number.isFinite(reading.b)))
  )
}

export function loadHashrateHistory(key: string): HashrateReading[] {
  return loadAllFrom(STORAGE_KEY, HASHRATE_HISTORY_LIMIT)[key] ?? []
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
  return appendTo(STORAGE_KEY, key, { h: hashrate }, MIN_READING_GAP_MS, HASHRATE_HISTORY_LIMIT, now)
}

/** Média das leituras, ou undefined com menos de 3 (referência fraca demais). */
export function referenceAverage(readings: HashrateReading[]): number | undefined {
  if (readings.length < 3) return undefined
  return readings.reduce((sum, reading) => sum + reading.h, 0) / readings.length
}

// ---------------------------------------------------------------------------
// Histórico DIÁRIO de hashrate (v3) — alimenta o gráfico de tendência de 24 h
// do dashboard. STORE SEPARADO do histórico de status acima de propósito: a
// régua do "abaixo do esperado" é a média de ~30 min (30 leituras / 55 s) e
// mudar a cadência dela mudaria a semântica do estado (e o rig-e2e semeia
// aquele storage direto). Parâmetros do diário (decisão v3, NOTES.md):
// - gap 290 s (~5 min): sobrevive ao jitter do polling de 60 s da pool e
//   deixa o dia inteiro caber num payload pequeno;
// - cap 288 leituras = 24 h exatas em passos de 5 min (~7 KB por chave).
// Fonte: SÓ o hashrate da pool (carteira inteira) — o XMRig mede um rig e
// misturar escalas falsearia a curva (mesma regra do histórico de status).
//
// A implementação virou motor genérico compartilhado com o histórico de
// status (mesmo formato de storage: mapa chave → leituras).

export const DAILY_HASHRATE_LIMIT = 288
export const DAILY_READING_GAP_MS = 290_000

const DAILY_STORAGE_KEY = 'zephyr-hub.rig.hashrate-daily.v1'

export function loadDailyHashrateHistory(key: string): HashrateReading[] {
  return loadAllFrom(DAILY_STORAGE_KEY, DAILY_HASHRATE_LIMIT)[key] ?? []
}

/** Anexa leitura ao histórico diário (gap de ~5 min, cap de 24 h). O saldo
    pendente (ZEPH) entra na MESMA leitura quando a pool o expõe — dado real
    do mesmo poll, nunca inventado; ausente, a leitura vai só com hashrate. */
export function appendDailyHashrateReading(
  key: string,
  hashrate: number,
  pendingBalance?: number,
  now: number = Date.now(),
): HashrateReading[] {
  return appendTo(
    DAILY_STORAGE_KEY,
    key,
    { h: hashrate, ...(pendingBalance !== undefined ? { b: pendingBalance } : {}) },
    DAILY_READING_GAP_MS,
    DAILY_HASHRATE_LIMIT,
    now,
  )
}

// ---------------------------------------------------------------------------
// Motor comum dos dois históricos (status e diário)

function loadAllFrom(storageKey: string, limit: number): Record<string, HashrateReading[]> {
  try {
    const raw = window.localStorage.getItem(storageKey)
    if (!raw) return {}
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return {}
    const histories: Record<string, HashrateReading[]> = {}
    for (const [key, readings] of Object.entries(parsed)) {
      if (Array.isArray(readings)) {
        histories[key] = readings.filter(isValidReading).slice(-limit)
      }
    }
    return histories
  } catch {
    return {}
  }
}

function appendTo(
  storageKey: string,
  key: string,
  entry: Omit<HashrateReading, 't'>,
  gapMs: number,
  limit: number,
  now: number,
): HashrateReading[] {
  const histories = loadAllFrom(storageKey, limit)
  const previous = histories[key] ?? []
  const last = previous[previous.length - 1]
  if (last && now - last.t < gapMs) return previous
  const next = [...previous, { t: now, ...entry }].slice(-limit)
  histories[key] = next
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(histories))
  } catch {
    // Sem localStorage o histórico vive só na sessão — aceitável
  }
  return next
}
