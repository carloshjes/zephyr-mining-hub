// Explorer oficial do Zephyr (fork do onion-explorer do Monero).
// Necessário porque a Scanner API não expõe hashrate/dificuldade/altura —
// validado em 2026-07-08 varrendo /livestats e /stats (ver NOTES.md).
// Envia Access-Control-Allow-Origin: * (verificado), então funciona direto
// do navegador.

import { ApiError, fetchJson } from './http'

const BASE_URL = 'https://explorer.zephyrprotocol.com/api'

// Todas as respostas do explorer vêm no envelope { data, status }
interface ExplorerEnvelope<T> {
  data?: T
  status?: string
}

export interface NetworkInfo {
  height?: number
  /** uint64 no daemon — chega como string; converter com Number() só pra exibir. */
  difficulty?: string
  /** H/s */
  hash_rate?: number
  target?: number
  tx_count?: number
  tx_pool_size?: number
  top_block_hash?: string
}

export async function getNetworkInfo(signal?: AbortSignal): Promise<NetworkInfo> {
  const response = await fetchJson<ExplorerEnvelope<NetworkInfo>>(
    `${BASE_URL}/networkinfo`,
    { signal },
  )
  if (response.status !== 'success' || !response.data) {
    throw new ApiError(`Explorer returned status="${response.status}"`, `${BASE_URL}/networkinfo`)
  }
  return response.data
}
