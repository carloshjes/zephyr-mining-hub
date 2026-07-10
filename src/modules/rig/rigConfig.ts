// Configuração do Monitor do Rig — por VISITANTE, salva só no localStorage do
// navegador dele (sem conta, sem backend). Nunca guardamos chave privada ou
// seed: as APIs de pool só precisam do endereço PÚBLICO de carteira.
// localStorage indisponível (modo privado, cota) degrada pra sessão em
// memória — a página nunca quebra por isso.

import { getMinerPool } from '../../lib/api/minerStats'

export interface RigConfig {
  poolId: string
  wallet: string
  /** host:porta da API local do XMRig — opcional. */
  xmrigAddress?: string
}

const STORAGE_KEY = 'zephyr-hub.rig.config.v1'

/**
 * Checagem de plausibilidade do endereço ZEPH, deliberadamente frouxa: pega
 * erro de digitação óbvio sem rejeitar formato legítimo. Medido em endereços
 * reais (lista pública da 2Miners, 2026-07-09): padrão "ZEPHYR…" com 101
 * caracteres e subendereço "ZEPHs…" com 99 — base58 nos dois casos.
 */
export function isPlausibleZephAddress(address: string): boolean {
  return /^ZEPH[1-9A-HJ-NP-Za-km-z]{90,116}$/.test(address)
}

export function loadRigConfig(): RigConfig | undefined {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return undefined
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) return undefined
    const { poolId, wallet, xmrigAddress } = parsed as Partial<RigConfig>
    // Valida campo a campo: config corrompida ou de pool removida é descartada
    if (typeof poolId !== 'string' || getMinerPool(poolId) === undefined) return undefined
    if (typeof wallet !== 'string' || wallet === '') return undefined
    return {
      poolId,
      wallet,
      xmrigAddress: typeof xmrigAddress === 'string' && xmrigAddress !== '' ? xmrigAddress : undefined,
    }
  } catch {
    return undefined
  }
}

export function saveRigConfig(config: RigConfig): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(config))
  } catch {
    // Sem localStorage a config vive só nesta sessão — aceitável
  }
}

export function clearRigConfig(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY)
  } catch {
    // idem
  }
}
