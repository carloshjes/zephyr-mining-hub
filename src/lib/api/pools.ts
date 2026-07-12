// Bússola de Pools — adaptadores por pool + registro central.
//
// Cada API foi confirmada CAMPO A CAMPO com requisição real (curl com header
// Origin, 2026-07-08 — ver NOTES.md, seção do Prompt 2). Os nomes de campo
// variam entre pools mesmo dentro da família cryptonote-nodejs-pool: NÃO
// generalizar um adaptador pra outra pool sem confirmar de novo.

import { fetchJson } from './http'

/**
 * Snapshot normalizado de uma pool. Campo que a API não expõe fica undefined
 * e vira "—" na tela (convenção do projeto: nunca inventar valor).
 */
export interface PoolSnapshot {
  /** Taxa da pool em % (ex.: 0.9). */
  fee?: number
  /** Hashrate da pool em H/s. */
  hashrate?: number
  /** Mineradores únicos conectados. */
  miners?: number
  /** Workers (conexões) — quase toda pool separa de miners. */
  workers?: number
  /** Pagamento mínimo em ZEPH. */
  minPayout?: number
  /** Luck/effort em % — 100 = neutro, abaixo de 100 = sorte acima do esperado. */
  luck?: number
  /** Altura de bloco que a pool reporta (compara com a rede pra ver dessincronia). */
  height?: number
}

interface PoolBase {
  id: string
  name: string
  /** Site da pool, usado como link na tabela. */
  website: string
}

interface IntegratedPool extends PoolBase {
  kind: 'integrated'
  /** Como o "luck" dessa pool é medido — a semântica varia por pool. */
  luckNote: string
  fetchSnapshot: (signal: AbortSignal) => Promise<PoolSnapshot>
}

interface UnavailablePool extends PoolBase {
  kind: 'unavailable'
  /** Por que não dá pra consultar do navegador (aparece na linha da tabela). */
  reason: string
}

export type PoolDefinition = IntegratedPool | UnavailablePool

// ---------------------------------------------------------------------------
// 2Miners — https://zeph.2miners.com/api/stats
// CORS liberado (Access-Control-Allow-Origin: *), confirmado na Fase 0 e hoje.
// Resposta completa conferida: NÃO expõe fee nem pagamento mínimo → "—".
// height/difficulty chegam como string (uint64 serializado).
interface TwoMinersStats {
  hashrate?: number
  luck?: number
  minersTotal?: number
  workersTotal?: number
  nodes?: {
    height?: string
    difficulty?: string
    networkhashps?: string
  }[]
}

async function fetchTwoMiners(signal: AbortSignal): Promise<PoolSnapshot> {
  const stats = await fetchJson<TwoMinersStats>('https://zeph.2miners.com/api/stats', {
    signal,
  })
  const node = stats.nodes?.[0]
  return {
    hashrate: stats.hashrate,
    miners: stats.minersTotal,
    workers: stats.workersTotal,
    luck: stats.luck,
    height: node?.height !== undefined ? Number(node.height) : undefined,
  }
}

// ---------------------------------------------------------------------------
// HeroMiners — https://zephyr.herominers.com/api/stats
// (de.zephyr.herominers.com é só host de stratum; /api/stats lá responde 301.)
// CORS liberado (Access-Control-Allow-Origin: *), confirmado em 2026-07-08.
// cryptonote-nodejs-pool clássico: fee e minPaymentThreshold vêm em config;
// atenção: coinUnits chega como STRING ("1000000000000").
interface HeroMinersStats {
  config?: {
    fee?: number
    minPaymentThreshold?: number
    coinUnits?: number | string
  }
  pool?: {
    hashrate?: number
    miners?: number
    workers?: number
    /** Effort médio das últimas 24 h como razão (1.05 = 105%). */
    effort_1d?: number
  }
  network?: {
    height?: number
  }
}

async function fetchHeroMiners(signal: AbortSignal): Promise<PoolSnapshot> {
  const stats = await fetchJson<HeroMinersStats>('https://zephyr.herominers.com/api/stats', {
    signal,
  })
  const { config, pool, network } = stats
  const coinUnits = config?.coinUnits !== undefined ? Number(config.coinUnits) : undefined
  return {
    fee: config?.fee,
    hashrate: pool?.hashrate,
    miners: pool?.miners,
    workers: pool?.workers,
    minPayout:
      config?.minPaymentThreshold !== undefined && coinUnits
        ? config.minPaymentThreshold / coinUnits
        : undefined,
    // effort_1d é razão; normalizamos pra % pra comparar com o luck das outras
    luck: pool?.effort_1d !== undefined ? pool.effort_1d * 100 : undefined,
    height: network?.height,
  }
}

// ---------------------------------------------------------------------------
// Registro central. Ordem = ordem padrão de exibição antes de ordenar.
export const POOLS: PoolDefinition[] = [
  {
    kind: 'integrated',
    id: '2miners',
    name: '2Miners',
    website: 'https://zeph.2miners.com',
    luckNote: 'luck as reported by the pool API',
    fetchSnapshot: fetchTwoMiners,
  },
  {
    kind: 'integrated',
    id: 'herominers',
    name: 'HeroMiners',
    website: 'https://zephyr.herominers.com',
    luckNote: 'average effort over the last 24 hours (effort_1d × 100)',
    fetchSnapshot: fetchHeroMiners,
  },
  // TODO(K1Pool): https://k1pool.com/api/stats/zeph responde JSON válido
  // (poolHashrate, minersTotal, poolLuck, networkBlock, coinPoolFee=1) mas SEM
  // Access-Control-Allow-Origin (conferido em 2026-07-08 com curl + Origin) —
  // o navegador bloqueia. Integrar quando houver proxy de CORS (mesma solução
  // do rewrite do Vercel usado pra Scanner API).
  {
    kind: 'unavailable',
    id: 'k1pool',
    name: 'K1Pool',
    website: 'https://k1pool.com/pool/zeph',
    reason: 'API blocks browser requests (CORS) — proxy integration required',
  },
  // TODO(MiningOcean): zephyr.miningocean.org não expõe REST JSON — o front
  // deles usa protobuf sobre server-sent events (visto no bundle
  // main.a43d9a33.js em 2026-07-08; /api/stats responde 404). Sem endpoint
  // JSON público confirmado; reavaliar se publicarem API REST.
  {
    kind: 'unavailable',
    id: 'miningocean',
    name: 'MiningOcean',
    website: 'https://zephyr.miningocean.org',
    reason: 'no confirmed public REST API',
  },
  // TODO(RavenMiner): zeph.ravenminer.com/api/stats respondeu
  // {"error":"method not found"} e em seguida o host parou de resolver (DNS
  // instável em 2026-07-08). Nenhum endpoint de stats confirmado; reavaliar.
  {
    kind: 'unavailable',
    id: 'ravenminer',
    name: 'RavenMiner',
    website: 'https://www.ravenminer.com',
    reason: 'stats endpoint not confirmed',
  },
]

/** Resultado por pool de um ciclo de busca — erro fica isolado na pool. */
export interface PoolFetchResult {
  poolId: string
  snapshot?: PoolSnapshot
  errorMessage?: string
}

function isIntegrated(pool: PoolDefinition): pool is IntegratedPool {
  return pool.kind === 'integrated'
}

/**
 * Busca todas as pools integradas em paralelo. Promise.allSettled garante que
 * uma pool fora do ar não derruba as outras: a falha vira errorMessage só
 * naquela linha.
 */
export async function fetchAllPoolSnapshots(signal: AbortSignal): Promise<PoolFetchResult[]> {
  const integrated = POOLS.filter(isIntegrated)
  const settled = await Promise.allSettled(integrated.map((pool) => pool.fetchSnapshot(signal)))
  return integrated.map((pool, index) => {
    const result = settled[index]
    return result.status === 'fulfilled'
      ? { poolId: pool.id, snapshot: result.value }
      : {
          poolId: pool.id,
          errorMessage: result.reason instanceof Error ? result.reason.message : String(result.reason),
        }
  })
}
