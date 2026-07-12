import { BLOCK_TIME_SECONDS } from '../../lib/emission'

// Estimativa de ganho diário do rig — a PRIMEIRA composição cross-module do
// produto: cruza o hashrate do próprio rig (este módulo) com três fontes que
// o Pulso da Rede já consome (hashrate da rede via Explorer, recompensa do
// minerador e preço via Scanner). Função pura, sem React, pra ser testável.
//
// Fórmula: (hashrate do rig / hashrate da rede) × recompensa do minerador
// por bloco × blocos/dia. O miner_reward já É a fatia de 65% do split — não
// recalcular aqui (a lógica do split vive em emission.ts/zephyrScanner.ts).

// Blocos/dia derivado do tempo-alvo de bloco (86400 / 120 = 720) — derivar,
// nunca 720 solto
export const BLOCKS_PER_DAY = 86_400 / BLOCK_TIME_SECONDS

export interface EarningsInputs {
  /** Hashrate do rig em H/s (o signalHashrate do dashboard). */
  rigHashrate?: number
  /** Hashrate da rede em H/s (Explorer API). */
  networkHashrate?: number
  /** Recompensa do minerador por bloco em ZEPH (já é a fatia de 65%). */
  minerRewardZeph?: number
  /** Preço do ZEPH em USD (livestats). */
  zephPrice?: number
}

export interface DailyEarningsEstimate {
  /** ZEPH/dia — só existe com rig + rede + recompensa todos presentes. */
  zephPerDay?: number
  /** USD/dia — só existe com zephPerDay + preço presentes. */
  usdPerDay?: number
}

// Degradação POR CAMPO (convenção do projeto: campo ausente vira "—", nunca
// número parcial nem zero disfarçado de dado): sem preço ainda há ZEPH/dia;
// sem hashrate da rede ou sem recompensa não há estimativa nenhuma.
export function estimateDailyEarnings(inputs: EarningsInputs): DailyEarningsEstimate {
  const { rigHashrate, networkHashrate, minerRewardZeph, zephPrice } = inputs
  const zephPerDay =
    rigHashrate !== undefined &&
    networkHashrate !== undefined &&
    networkHashrate > 0 &&
    minerRewardZeph !== undefined
      ? (rigHashrate / networkHashrate) * minerRewardZeph * BLOCKS_PER_DAY
      : undefined
  const usdPerDay =
    zephPerDay !== undefined && zephPrice !== undefined ? zephPerDay * zephPrice : undefined
  return { zephPerDay, usdPerDay }
}
