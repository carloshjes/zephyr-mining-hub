// As 4 fatias do prêmio de bloco e a matemática de divisão compartilhada por
// gráfico, manchete e tabela — um único lugar pra ordem, rótulos e cores.
//
// Cores (direção "Sinal Técnico", 2026-07-09): rampa monocromática da família
// roxa da marca, do claro (fatia dominante) pro escuro (terciária) — validada
// como rampa ORDINAL com validate_palette.js da skill de dataviz contra a
// superfície ink-950 (#0a0a0e): luminosidade monótona, ΔL adjacente ≥ 0,06 e
// degrau escuro ≥ 2:1 PASSaram. Separação CVD vem da própria luminosidade
// (sobrevive a todo tipo de CVD); o degrau escuro (2,0:1) exige os canais de
// alívio que o módulo já tem: rótulos diretos, legenda, tooltip e tabela.
// Governança (zerada em todos os blocos observados) veste o cinza-roxo de
// apoio com borda TRACEJADA como encoding secundário. Os valores vêm dos
// tokens em src/index.css via var() — nada de hex solto aqui.

import type { BlockReward } from '../../lib/api/zephyrScanner'

export type RewardSeriesKey = 'miner' | 'reserve' | 'yield' | 'governance'

export function seriesPatternId(base: string, key: RewardSeriesKey): string {
  return `${base}-${key}`
}

export interface RewardSeriesDef {
  key: RewardSeriesKey
  label: string
  color: string
  /** Opacidade do preenchimento (o degrau escuro precisa de mais presença). */
  washOpacity: number
  /** Textura do preenchimento (v2): diferenciação de série que NÃO depende
      de matiz — a rampa é monocromática por decisão de marca e as fatias são
      dados neutros (não ganham verde/laranja de estado). Desenhada com
      <line>/<circle> dentro de <pattern> (nunca <rect>/<path> — os seletores
      do rewards-e2e contam paths por cor e acham o overlay por rect). */
  texture?: 'hatch' | 'dot'
  /** Borda tracejada = encoding secundário da série fora da rampa roxa. */
  dashedEdge?: boolean
}

// Ordem = ordem de empilhamento (base → topo) E de dominância da rampa
// (dominante = mais claro). Não reordenar sem revalidar a rampa.
// Texturas: dominante fica lisa (calma), reserva = hachura diagonal,
// yield = pontilhado — legíveis na legenda a distância de leitura normal.
export const REWARD_SERIES: readonly RewardSeriesDef[] = [
  { key: 'miner', label: 'Miner', color: 'var(--color-zeph-300)', washOpacity: 0.28 },
  {
    key: 'reserve',
    label: 'Reserve',
    color: 'var(--color-zeph-500)',
    washOpacity: 0.22,
    texture: 'hatch',
  },
  {
    key: 'yield',
    label: 'Yield',
    color: 'var(--color-zeph-700)',
    washOpacity: 0.45,
    texture: 'dot',
  },
  {
    key: 'governance',
    label: 'Governance',
    color: 'var(--color-mist-400)',
    washOpacity: 0.25,
    dashedEdge: true,
  },
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
