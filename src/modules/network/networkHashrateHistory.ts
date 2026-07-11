// Histórico local do hashrate da rede pro mini-gráfico de tendência do Pulso
// da Rede (v3). Não existe série histórica de hashrate em NENHUMA API
// confirmada do projeto (Explorer é só snapshot — ver CLAUDE.md), então a
// tendência é COLETADA por este navegador enquanto a página fica aberta —
// dado real acumulado localmente, nunca inventado (a UI diz isso ao lado).
//
// Mesmo padrão do luckHistory da Bússola de Pools: localStorage com validação
// entrada a entrada, gap mínimo entre leituras, cap fixo; sem localStorage
// (modo privado, cota cheia) degrada pra memória da sessão — nunca quebra.
//
// Parâmetros (decisão v3, registrada em NOTES.md):
// - gap 115 s: o hash_rate do explorer deriva da dificuldade, que só muda
//   quando entra bloco (~120 s) — amostrar mais rápido que isso duplicaria
//   valores; 115 s (e não 120) evita perder a leitura de um bloco novo por
//   jitter do polling de 30 s.
// - cap 360 leituras ≈ 12 h de tendência acumulável (~9 KB no localStorage).

export interface NetworkHashrateReading {
  /** Quando a leitura foi feita (epoch ms). */
  t: number
  /** Hashrate da rede em H/s. */
  h: number
}

export const NETWORK_HASHRATE_LIMIT = 360
export const NETWORK_READING_GAP_MS = 115_000

const STORAGE_KEY = 'zephyr-hub.network.hashrate-history.v1'

function isValidReading(value: unknown): value is NetworkHashrateReading {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as NetworkHashrateReading).t === 'number' &&
    typeof (value as NetworkHashrateReading).h === 'number' &&
    Number.isFinite((value as NetworkHashrateReading).h)
  )
}

export function loadNetworkHashrateHistory(): NetworkHashrateReading[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    // Valida entrada a entrada: dado corrompido é descartado, não propagado
    return parsed.filter(isValidReading).slice(-NETWORK_HASHRATE_LIMIT)
  } catch {
    return []
  }
}

/**
 * Anexa uma leitura ao histórico persistido e devolve a lista nova (imutável,
 * pronta pro setState). Leituras a menos de NETWORK_READING_GAP_MS da
 * anterior são ignoradas (reload, volta de aba, double-effect do StrictMode).
 */
export function appendNetworkHashrateReading(
  hashrate: number,
  now: number = Date.now(),
): NetworkHashrateReading[] {
  const history = loadNetworkHashrateHistory()
  const last = history[history.length - 1]
  if (last && now - last.t < NETWORK_READING_GAP_MS) return history
  const next = [...history, { t: now, h: hashrate }].slice(-NETWORK_HASHRATE_LIMIT)
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    // Sem localStorage a tendência vive só na memória — aceitável
  }
  return next
}
