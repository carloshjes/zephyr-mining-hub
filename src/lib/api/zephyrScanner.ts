// Zephyr Scanner API — https://zephyrprotocol.com/documentation/scanner-api
// GET, sem autenticação. O servidor mantém cache de 30s por endpoint, então
// nenhum consumidor deve fazer polling mais rápido que SCANNER_CACHE_SECONDS.
//
// Endpoints implementados por demanda dos módulos; os demais (/pricingrecords,
// /apyhistory, ...) entram quando algum módulo precisar.

import { ApiError, fetchJson } from './http'
import { getNetworkInfo } from './zephyrExplorer'

// Caminho relativo de propósito: a Scanner API não envia header CORS (testado
// em 2026-07-08 — fetch direto do navegador é bloqueado, ver NOTES.md), então
// as chamadas passam pelo proxy do Vite em dev (/zephyr-api → zephyrprotocol.com/api)
// e precisarão de um rewrite equivalente no deploy de produção.
const BASE_URL = '/zephyr-api/v1'

export const SCANNER_CACHE_SECONDS = 30

// Campos opcionais de propósito: a UI mostra "—" quando a API omitir algum
// (convenção do projeto — ver CLAUDE.md), então nada aqui pode ser assumido.
export interface LiveStats {
  zeph_price?: number
  reserve_ratio?: number
  reserve_ratio_ma?: number
  zeph_circ?: number
  zsd_circ?: number
  zrs_circ?: number
  zys_circ?: number
  zeph_in_reserve?: number
  zeph_in_reserve_percent?: number
  zeph_in_reserve_value?: number
  zys_current_variable_apy?: number
}

// scale=block NÃO entra aqui: nessa escala a resposta troca `timestamp` por
// `block_height` e o from/to vira ALTURA, não timestamp (testado em
// 2026-07-09) — use getBlockStats, que tem o tipo certo.
export type StatsScale = 'day' | 'hour'

// A série vem como [{ timestamp, data: { <campo pedido>: valor } }].
// O genérico amarra os campos pedidos em `fields` aos campos tipados em `data`.
export interface StatsPoint<F extends string> {
  timestamp: number
  data: Partial<Record<F, number>>
}

export interface GetStatsParams<F extends string> {
  scale: StatsScale
  fields: readonly F[]
  /** Unix em segundos (inclusive). */
  from?: number
  /** Unix em segundos (inclusive). */
  to?: number
}

// Recompensa por bloco. O split atual (HF v2.0.0) é 65% minerador /
// 30% reserva / 5% yield; base_reward_atoms é a recompensa cheia da fórmula
// de emissão, em átomos (1 ZEPH = 10^12 átomos), serializada como string
// porque não cabe com segurança em number pra alturas antigas.
export interface BlockReward {
  height: number
  miner_reward?: number
  governance_reward?: number
  reserve_reward?: number
  yield_reward?: number
  miner_reward_atoms?: string
  governance_reward_atoms?: string
  reserve_reward_atoms?: string
  yield_reward_atoms?: string
  base_reward_atoms?: string
  fee_adjustment_atoms?: string
}

export interface BlockRewardsResponse {
  total: number
  limit: number
  order: 'asc' | 'desc'
  results: BlockReward[]
}

export function getLiveStats(signal?: AbortSignal): Promise<LiveStats> {
  return fetchJson<LiveStats>(`${BASE_URL}/livestats`, { signal })
}

export function getStats<F extends string>(
  params: GetStatsParams<F>,
  signal?: AbortSignal,
): Promise<StatsPoint<F>[]> {
  const search = new URLSearchParams({
    scale: params.scale,
    fields: params.fields.join(','),
  })
  if (params.from !== undefined) search.set('from', String(params.from))
  if (params.to !== undefined) search.set('to', String(params.to))
  return fetchJson<StatsPoint<F>[]>(`${BASE_URL}/stats?${search}`, { signal })
}

// Série do /stats em scale=block: cada ponto vem com `block_height` (não
// `timestamp`), e from/to são ALTURAS de bloco — confirmado com chamadas
// reais em 2026-07-09. É o que permite alinhar essa série com /blockrewards
// no mesmo eixo x.
export interface BlockStatsPoint<F extends string> {
  block_height: number
  data: Partial<Record<F, number>>
}

export function getBlockStats<F extends string>(
  fields: readonly F[],
  fromHeight: number,
  toHeight: number,
  signal?: AbortSignal,
): Promise<BlockStatsPoint<F>[]> {
  const search = new URLSearchParams({
    scale: 'block',
    fields: fields.join(','),
    from: String(fromHeight),
    to: String(toHeight),
  })
  return fetchJson<BlockStatsPoint<F>[]>(`${BASE_URL}/stats?${search}`, { signal })
}

// from/to do /blockrewards são ALTURAS (inclusive). Alturas além do topo da
// chain são ignoradas sem erro (clamp confirmado por teste em 2026-07-09).
export async function getBlockRewardsRange(
  fromHeight: number,
  toHeight: number,
  signal?: AbortSignal,
): Promise<BlockReward[]> {
  const search = new URLSearchParams({
    from: String(Math.max(fromHeight, 0)),
    to: String(toHeight),
    order: 'asc',
  })
  const response = await fetchJson<BlockRewardsResponse>(
    `${BASE_URL}/blockrewards?${search}`,
    { signal },
  )
  return response.results ?? []
}

// Altura atual da rede (explorer) usada como âncora das janelas "últimos N
// blocos". Necessária porque `order=desc&limit=` SEM from/to é
// não-determinístico no servidor: em 2026-07-09 a mesma chamada devolveu ora
// um snapshot ~58 dias atrasado, ora ~15 h — nunca confiar nele pra "mais
// recente".
//
// ÂNCORA COMPARTILHADA (v2, 2026-07-10): os consumidores paralelos da página
// (série de recompensas E série de ratio; ×2 com o StrictMode em dev) pediam
// cada um a PRÓPRIA âncora — probe real registrou 6 chamadas de networkinfo
// numa única carga (NOTES.md). Quando só a chamada do ratio pendurava
// (flakiness conhecida do explorer), o rail ficava dezenas de segundos em
// skeleton com o resto da página viva — o "retângulo vazio". Uma promise
// compartilhada por janela curta colapsa a rajada numa chamada só e amarra as
// duas séries à MESMA âncora (o rótulo [ MESMA JANELA DE BLOCOS ] vira
// literal, não aproximado).
let sharedAnchor: { at: number; promise: Promise<number> } | undefined
const ANCHOR_SHARE_MS = 5_000

async function getAnchorHeight(_signal?: AbortSignal): Promise<number> {
  const now = Date.now()
  if (!sharedAnchor || now - sharedAnchor.at > ANCHOR_SHARE_MS) {
    // Sem o signal do caller de propósito: o abort de um consumidor
    // (unmount/refresh) não pode matar a âncora dos outros. Quem abortou
    // descarta o resultado sozinho — o fetch seguinte dele recebe o signal
    // já abortado e lança na hora.
    const promise = getNetworkInfo().then((info) => {
      if (info.height === undefined) {
        throw new ApiError(
          'Explorer did not return the current network height',
          `${BASE_URL}/blockrewards`,
        )
      }
      // `height` do daemon é a CONTAGEM de blocos (a próxima altura a
      // minerar); o bloco mais novo minerado é height-1 — confirmado em
      // 2026-07-09 (com âncora em `height`, janelas voltavam com N-1)
      return info.height - 1
    })
    // Falha não fica cacheada: a próxima chamada tenta de novo (e o catch
    // aqui evita unhandledrejection quando todos os awaiters já abortaram)
    promise.catch(() => {
      if (sharedAnchor?.promise === promise) sharedAnchor = undefined
    })
    sharedAnchor = { at: now, promise }
  }
  return sharedAnchor.promise
}

// Folga acima da âncora: o indexador do Scanner pode estar alguns blocos à
// frente/atrás do explorer; alturas inexistentes são só ignoradas (clamp).
const ANCHOR_CUSHION_BLOCKS = 30

/** Últimos `count` blocos com recompensa, em ordem ascendente de altura. */
export async function getRecentBlockRewards(
  count: number,
  signal?: AbortSignal,
): Promise<BlockReward[]> {
  const anchor = await getAnchorHeight(signal)
  const results = await getBlockRewardsRange(
    anchor - count + 1,
    anchor + ANCHOR_CUSHION_BLOCKS,
    signal,
  )
  if (results.length > 0) return results.slice(-count)
  // Janela vazia = indexador do Scanner atrasado além da janela pedida.
  // Melhor mostrar dado antigo com a altura visível do que nada — o desc sem
  // âncora devolve o snapshot que o servidor tiver.
  const fallback = await fetchJson<BlockRewardsResponse>(
    `${BASE_URL}/blockrewards?order=desc&limit=${count}`,
    { signal },
  )
  return (fallback.results ?? []).slice().reverse()
}

/** Série de reserve_ratio dos últimos `count` blocos, ascendente por altura. */
export async function getRecentReserveRatios(
  count: number,
  signal?: AbortSignal,
): Promise<BlockStatsPoint<'reserve_ratio'>[]> {
  const anchor = await getAnchorHeight(signal)
  const points = await getBlockStats(
    ['reserve_ratio'] as const,
    anchor - count + 1,
    anchor + ANCHOR_CUSHION_BLOCKS,
    signal,
  )
  return points.slice(-count)
}

export async function getLatestBlockReward(
  signal?: AbortSignal,
): Promise<BlockReward | undefined> {
  const recent = await getRecentBlockRewards(1, signal)
  return recent.at(-1)
}
