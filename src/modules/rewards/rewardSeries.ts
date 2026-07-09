// As 4 fatias do prêmio de bloco e a matemática de divisão compartilhada por
// gráfico, manchete e tabela — um único lugar pra ordem, rótulos e cores.
//
// Cores: paleta categórica validada pra superfície slate-900 (#0f172a) com
// scripts/validate_palette.js da skill de dataviz em 2026-07-09 — banda de
// luminosidade, piso de croma e contraste ≥ 3:1 PASSAram; a separação CVD do
// par yield↔governança ficou na banda-piso (ΔE 10,3), o que exige encoding
// secundário: aqui são as bordas sólidas por série, os rótulos diretos, a
// legenda e a tabela.

import type { BlockReward } from '../../lib/api/zephyrScanner'

export type RewardSeriesKey = 'miner' | 'reserve' | 'yield' | 'governance'

export interface RewardSeriesDef {
  key: RewardSeriesKey
  label: string
  color: string
}

// Ordem = ordem de empilhamento (base → topo). A validação CVD é de pares
// adjacentes NESTA ordem — não reordenar sem revalidar.
export const REWARD_SERIES: readonly RewardSeriesDef[] = [
  { key: 'miner', label: 'Minerador', color: '#3987e5' },
  { key: 'reserve', label: 'Reserva', color: '#199e70' },
  { key: 'yield', label: 'Yield', color: '#c98500' },
  { key: 'governance', label: 'Governança', color: '#008300' },
]

export interface RewardSlices {
  height: number
  values: Record<RewardSeriesKey, number>
  /** Soma das 4 fatias em ZEPH (bate com base_reward + ajuste de taxas). */
  total: number
}

// Bloco com qualquer fatia ausente fica FORA da série (convenção do projeto:
// nunca inventar 0 pra campo que a API não mandou) — a página conta e avisa.
export function toRewardSlices(block: BlockReward): RewardSlices | undefined {
  const { miner_reward, governance_reward, reserve_reward, yield_reward } = block
  if (
    miner_reward === undefined ||
    governance_reward === undefined ||
    reserve_reward === undefined ||
    yield_reward === undefined
  ) {
    return undefined
  }
  const total = miner_reward + governance_reward + reserve_reward + yield_reward
  if (!(total > 0)) return undefined
  return {
    height: block.height,
    values: {
      miner: miner_reward,
      reserve: reserve_reward,
      yield: yield_reward,
      governance: governance_reward,
    },
    total,
  }
}

/** Fatia como % do total do bloco (ex.: 65.0). */
export function sharePercent(slices: RewardSlices, key: RewardSeriesKey): number {
  return (slices.values[key] / slices.total) * 100
}
