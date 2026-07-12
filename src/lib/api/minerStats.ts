// Monitor do Rig — stats POR MINERADOR nas pools integráveis do navegador.
//
// Formatos confirmados em 2026-07-09 (ver NOTES.md, seção do Prompt 4):
// - 2Miners: GET /api/accounts/<endereço> conferido com requisição real
//   (CORS `*`). Endereço desconhecido OU malformado → HTTP 404 com corpo
//   vazio (não há como distinguir os dois casos pela resposta).
// - HeroMiners: GET /api/stats_address?address=<endereço> — CORS `*` e o
//   formato de erro ({"error":"Not found"} com HTTP 200!) confirmados ao
//   vivo. O formato de SUCESSO veio do código-fonte do upstream
//   (dvandal/cryptonote-nodejs-pool v1.3.5, versão que a própria pool reporta
//   em config.version): {stats, payments, charts, workers}, com os valores
//   vindos do hash do redis serializados como STRING. Sem endereço real
//   minerando lá pra conferir ao vivo — parsing defensivo, campo ausente
//   vira "—" na tela (convenção do projeto).

import { ApiError, fetchJson } from './http'
import { ATOMS_PER_ZEPH } from '../emission'

// ZEPH tem 12 casas atômicas (coinUnits "1000000000000", confirmado na HeroMiners)
// — ATOMS_PER_ZEPH vem de emission.ts, dono único do fator de conversão
// (achado da auditoria de estrutura 2026-07-12: este arquivo redefinia o
// mesmo valor em vez de importar).

/** Endereço nunca visto pela pool — erro distinto pra UI orientar o usuário. */
export class MinerNotFoundError extends Error {
  constructor(poolName: string) {
    super(
      `Wallet address not found at ${poolName} — check that it is correct and that your rig has submitted its first share to this pool.`,
    )
    this.name = 'MinerNotFoundError'
  }
}

export interface MinerWorker {
  name: string
  /** Hashrate atual reportado pela pool, em H/s. */
  hashrate?: number
  /** true quando a própria pool marca o worker como offline (só a 2Miners expõe). */
  offline?: boolean
  /** Último sinal do worker (share/beat), em unix segundos. */
  lastSeenAt?: number
  sharesValid?: number
  sharesInvalid?: number
  sharesStale?: number
}

/**
 * Snapshot normalizado do minerador numa pool. Campo que a API não expõe
 * fica undefined e vira "—" na tela — nunca inventar valor.
 */
export interface MinerSnapshot {
  /** Hashrate na janela curta da pool, em H/s. */
  currentHashrate?: number
  /** Hashrate na janela longa da pool, em H/s (janela varia por pool). */
  averageHashrate?: number
  workers: MinerWorker[]
  workersOnline?: number
  workersTotal?: number
  sharesValid?: number
  sharesInvalid?: number
  sharesStale?: number
  /** Último share aceito pela pool, em unix segundos. */
  lastShareAt?: number
  /** Saldo ainda não pago (inclui imaturo quando a pool separa), em ZEPH. */
  pendingBalance?: number
  /** Total já pago pela pool, em ZEPH. */
  totalPaid?: number
  blocksFound?: number
}

export interface MinerPool {
  id: string
  name: string
  website: string
  /** Semântica das janelas de hashrate — varia por pool, vai no sub do card. */
  hashrateNote: string
  fetchMinerStats: (address: string, signal: AbortSignal) => Promise<MinerSnapshot>
}

/** Converte valor possivelmente string (redis serializado) em número, ou undefined. */
function toNumber(value: unknown): number | undefined {
  if (value === undefined || value === null || value === '') return undefined
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

function atomsToZeph(value: unknown): number | undefined {
  const atoms = toNumber(value)
  return atoms === undefined ? undefined : atoms / ATOMS_PER_ZEPH
}

// ---------------------------------------------------------------------------
// 2Miners — GET https://zeph.2miners.com/api/accounts/<endereço>
// Resposta real conferida campo a campo em 2026-07-09: currentHashrate (janela
// curta) e hashrate (janela longa) em H/s; workers como mapa nome → detalhe;
// stats.{balance,immature,paid} em átomos; shares da rodada no topo.
interface TwoMinersWorker {
  hr?: number
  hr2?: number
  offline?: boolean
  lastBeat?: number
  sharesValid?: number
  sharesInvalid?: number
  sharesStale?: number
}

interface TwoMinersAccount {
  currentHashrate?: number
  hashrate?: number
  workers?: Record<string, TwoMinersWorker>
  workersOnline?: number
  workersTotal?: number
  sharesValid?: number
  sharesInvalid?: number
  sharesStale?: number
  stats?: {
    balance?: number
    immature?: number
    paid?: number
    lastShare?: number
    blocksFound?: number
  }
}

async function fetchTwoMinersAccount(
  address: string,
  signal: AbortSignal,
): Promise<MinerSnapshot> {
  let account: TwoMinersAccount
  try {
    account = await fetchJson<TwoMinersAccount>(
      `https://zeph.2miners.com/api/accounts/${encodeURIComponent(address)}`,
      { signal },
    )
  } catch (err) {
    // 404 = endereço desconhecido/malformado (corpo vazio, confirmado real)
    if (err instanceof ApiError && err.status === 404) throw new MinerNotFoundError('2Miners')
    throw err
  }

  const workers = Object.entries(account.workers ?? {}).map(
    ([name, worker]): MinerWorker => ({
      name,
      hashrate: toNumber(worker.hr),
      offline: worker.offline,
      lastSeenAt: toNumber(worker.lastBeat),
      sharesValid: toNumber(worker.sharesValid),
      sharesInvalid: toNumber(worker.sharesInvalid),
      sharesStale: toNumber(worker.sharesStale),
    }),
  )

  const balance = toNumber(account.stats?.balance)
  const immature = toNumber(account.stats?.immature)
  const pendingAtoms =
    balance === undefined && immature === undefined ? undefined : (balance ?? 0) + (immature ?? 0)

  return {
    currentHashrate: toNumber(account.currentHashrate),
    averageHashrate: toNumber(account.hashrate),
    workers,
    workersOnline: toNumber(account.workersOnline),
    workersTotal: toNumber(account.workersTotal),
    sharesValid: toNumber(account.sharesValid),
    sharesInvalid: toNumber(account.sharesInvalid),
    sharesStale: toNumber(account.sharesStale),
    lastShareAt: toNumber(account.stats?.lastShare),
    pendingBalance: pendingAtoms === undefined ? undefined : pendingAtoms / ATOMS_PER_ZEPH,
    totalPaid: atomsToZeph(account.stats?.paid),
    blocksFound: toNumber(account.stats?.blocksFound),
  }
}

// ---------------------------------------------------------------------------
// HeroMiners — GET https://zephyr.herominers.com/api/stats_address?address=…
// stats.hashrate é número; o resto do hash stats.* chega como string (redis).
// Workers: [{name, hashrate, lastShare, hashes, hashrate_1h/6h/24h}] — sem
// flag de offline nem contagem de shares válidas/inválidas por conta.
interface HeroMinersWorker {
  name?: string
  hashrate?: number
  lastShare?: number | string
}

interface HeroMinersAddressStats {
  error?: string
  stats?: {
    hashrate?: number
    hashrate_1h?: number
    hashrate_6h?: number
    hashrate_24h?: number
    lastShare?: number | string
    balance?: number | string
    paid?: number | string
    blocksFound?: number | string
  }
  workers?: HeroMinersWorker[]
}

async function fetchHeroMinersAccount(
  address: string,
  signal: AbortSignal,
): Promise<MinerSnapshot> {
  const response = await fetchJson<HeroMinersAddressStats>(
    `https://zephyr.herominers.com/api/stats_address?address=${encodeURIComponent(address)}&longpoll=false`,
    { signal },
  )
  // Erro vem no corpo com HTTP 200 (confirmado real): {"error":"Not found"}
  if (response.error !== undefined) {
    if (/not found/i.test(response.error)) throw new MinerNotFoundError('HeroMiners')
    throw new ApiError(`HeroMiners: ${response.error}`, 'stats_address')
  }

  const stats = response.stats
  const workers = (response.workers ?? []).flatMap((worker): MinerWorker[] =>
    worker.name === undefined
      ? []
      : [
          {
            name: worker.name,
            hashrate: toNumber(worker.hashrate),
            lastSeenAt: toNumber(worker.lastShare),
          },
        ],
  )

  return {
    currentHashrate: toNumber(stats?.hashrate),
    // Janela longa: 1 h é a mais próxima do "hashrate" (~3 h) da 2Miners
    averageHashrate: toNumber(stats?.hashrate_1h),
    workers,
    workersTotal: workers.length > 0 ? workers.length : undefined,
    lastShareAt: toNumber(stats?.lastShare),
    pendingBalance: atomsToZeph(stats?.balance),
    totalPaid: atomsToZeph(stats?.paid),
    blocksFound: toNumber(stats?.blocksFound),
  }
}

// ---------------------------------------------------------------------------
// Registro: SÓ as pools com integração confirmada do navegador (Prompt 2).
// K1Pool/MiningOcean/RavenMiner ficam de fora até os TODOs em pools.ts.
export const MINER_POOLS: MinerPool[] = [
  {
    id: '2miners',
    name: '2Miners',
    website: 'https://zeph.2miners.com',
    hashrateNote: 'short (recent) and long (multi-hour average) windows reported by the pool',
    fetchMinerStats: fetchTwoMinersAccount,
  },
  {
    id: 'herominers',
    name: 'HeroMiners',
    website: 'https://zephyr.herominers.com',
    hashrateNote: 'current hashrate and 1-hour average reported by the pool',
    fetchMinerStats: fetchHeroMinersAccount,
  },
]

export function getMinerPool(poolId: string): MinerPool | undefined {
  return MINER_POOLS.find((pool) => pool.id === poolId)
}
