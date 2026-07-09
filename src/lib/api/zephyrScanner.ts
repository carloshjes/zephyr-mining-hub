// Zephyr Scanner API — https://zephyrprotocol.com/documentation/scanner-api
// GET, sem autenticação. O servidor mantém cache de 30s por endpoint, então
// nenhum consumidor deve fazer polling mais rápido que SCANNER_CACHE_SECONDS.
//
// Endpoints implementados por demanda dos módulos; os demais (/pricingrecords,
// /apyhistory, ...) entram quando algum módulo precisar.

import { fetchJson } from './http'

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

export type StatsScale = 'day' | 'hour' | 'block'

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

export async function getLatestBlockReward(
  signal?: AbortSignal,
): Promise<BlockReward | undefined> {
  const response = await fetchJson<BlockRewardsResponse>(
    `${BASE_URL}/blockrewards?order=desc&limit=1`,
    { signal },
  )
  return response.results?.[0]
}
