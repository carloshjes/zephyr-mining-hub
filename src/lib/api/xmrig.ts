// API HTTP local do XMRig — GET http://<host:porta>/1/summary, sem auth por
// padrão. CORS aberto no binário real (Access-Control-Allow-Origin: *,
// conferido no código-fonte em 2026-07-08 — ver NOTES.md). Chamada é local:
// timeout curto e SEM retentativa — quem cuida do "tentar de novo" é o
// polling da página, e a ausência do XMRig degrada graciosamente na UI.

import { fetchJson } from './http'

const XMRIG_TIMEOUT_MS = 4_000

/**
 * Resumo normalizado do /1/summary. hashrate.total do XMRig vem como
 * [10s, 60s, 15m] e as janelas ainda não preenchidas chegam como null.
 */
export interface XmrigSummary {
  hashrate10s?: number
  hashrate60s?: number
  hashrate15m?: number
  sharesGood?: number
  sharesTotal?: number
  uptimeSeconds?: number
  version?: string
  workerId?: string
}

interface XmrigSummaryResponse {
  version?: string
  worker_id?: string
  uptime?: number
  hashrate?: { total?: (number | null)[] }
  results?: { shares_good?: number; shares_total?: number }
}

function windowValue(total: (number | null)[] | undefined, index: number): number | undefined {
  const value = total?.[index]
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

/**
 * Normaliza a entrada do usuário pra "host:porta", ou undefined se inválida.
 * Aceita "16000" (vira 127.0.0.1:16000), "host:porta" e cola com "http://".
 */
export function normalizeXmrigAddress(input: string): string | undefined {
  let value = input.trim().replace(/^https?:\/\//i, '').replace(/\/.*$/, '')
  if (value === '') return undefined
  // Só a porta: assume o próprio computador do visitante
  if (/^\d+$/.test(value)) value = `127.0.0.1:${value}`
  const match = value.match(/^([a-zA-Z0-9.-]+|\[[0-9a-fA-F:]+\]):(\d{1,5})$/)
  if (!match) return undefined
  const port = Number(match[2])
  if (port < 1 || port > 65_535) return undefined
  return `${match[1]}:${port}`
}

export async function fetchXmrigSummary(
  hostPort: string,
  signal: AbortSignal,
): Promise<XmrigSummary> {
  const response = await fetchJson<XmrigSummaryResponse>(`http://${hostPort}/1/summary`, {
    signal,
    timeoutMs: XMRIG_TIMEOUT_MS,
    retries: 0,
  })
  return {
    hashrate10s: windowValue(response.hashrate?.total, 0),
    hashrate60s: windowValue(response.hashrate?.total, 1),
    hashrate15m: windowValue(response.hashrate?.total, 2),
    sharesGood: response.results?.shares_good,
    sharesTotal: response.results?.shares_total,
    uptimeSeconds: response.uptime,
    version: response.version,
    workerId: response.worker_id,
  }
}
