// Modelo de emissão do Zephyr — constantes conferidas em 2026-07-08 no
// src/cryptonote_config.h do repositório oficial (ZephyrProtocol/zephyr):
//   MONEY_SUPPLY                     = 2^64 - 1 átomos
//   EMISSION_SPEED_FACTOR_PER_MINUTE = 21  (bloco de 120s ⇒ shift efetivo 20)
//   FINAL_SUBSIDY_PER_MINUTE         = 0,3 ZEPH (⇒ cauda de 0,6 ZEPH/bloco)
//
// Recompensa base por bloco: reward = (MONEY_SUPPLY - já_emitido) >> 20.
// Ou seja: emissão SUAVE estilo Monero, sem corte abrupto tipo Bitcoin.
// "Halving" aqui é o marco em que a recompensa base cruza a próxima metade da
// recompensa inicial (2^44 átomos ≈ 17,59 ZEPH): 8,796 → 4,398 → 2,199 ZEPH…
// A projeção usa a recompensa base atual (base_reward_atoms do /blockrewards),
// então não depende de saber quanto já foi emitido.

export const ATOMS_PER_ZEPH = 1e12
export const BLOCK_TIME_SECONDS = 120

const EMISSION_SHIFT = 20
const INITIAL_REWARD_ATOMS = 2 ** 44
export const TAIL_EMISSION_ATOMS = 0.6 * ATOMS_PER_ZEPH

// Fração da emissão restante que sobrevive a cada bloco
const DECAY_PER_BLOCK = 1 - 2 ** -EMISSION_SHIFT

export interface HalvingProjection {
  baseRewardZeph: number
  /** Recompensa base em que o próximo halving acontece. */
  nextThresholdZeph: number
  blocksRemaining: number
  secondsRemaining: number
  estimatedAt: Date
  /** true quando a recompensa chegou à cauda fixa — não há mais halvings. */
  isTailEmission: boolean
}

export function projectNextHalving(
  baseRewardAtoms: number,
  now: Date = new Date(),
): HalvingProjection {
  const baseRewardZeph = baseRewardAtoms / ATOMS_PER_ZEPH

  // Época atual = quantos halvings a recompensa inicial já sofreu
  const epoch = Math.floor(Math.log2(INITIAL_REWARD_ATOMS / baseRewardAtoms))
  const nextThresholdAtoms = INITIAL_REWARD_ATOMS / 2 ** (epoch + 1)

  // Abaixo de 0,6 ZEPH a cauda assume e a recompensa para de cair
  if (baseRewardAtoms <= TAIL_EMISSION_ATOMS || nextThresholdAtoms < TAIL_EMISSION_ATOMS) {
    return {
      baseRewardZeph,
      nextThresholdZeph: TAIL_EMISSION_ATOMS / ATOMS_PER_ZEPH,
      blocksRemaining: 0,
      secondsRemaining: 0,
      estimatedAt: now,
      isTailEmission: true,
    }
  }

  // A emissão restante decai geometricamente (restante_n = restante_0 · d^n) e
  // reward ∝ restante, então o nº de blocos até o limiar sai do logaritmo.
  const blocksRemaining = Math.ceil(
    Math.log(nextThresholdAtoms / baseRewardAtoms) / Math.log(DECAY_PER_BLOCK),
  )
  const secondsRemaining = blocksRemaining * BLOCK_TIME_SECONDS

  return {
    baseRewardZeph,
    nextThresholdZeph: nextThresholdAtoms / ATOMS_PER_ZEPH,
    blocksRemaining,
    secondsRemaining,
    estimatedAt: new Date(now.getTime() + secondsRemaining * 1_000),
    isTailEmission: false,
  }
}
