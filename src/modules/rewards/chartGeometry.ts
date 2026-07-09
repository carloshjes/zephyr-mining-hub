// Geometria compartilhada pelos dois gráficos do módulo: ticks "redondos" e
// margens padrão. Nada aqui conhece dados de recompensa — só números e pixels.

export interface ChartMargins {
  top: number
  right: number
  bottom: number
  left: number
}

/** Passo "redondo" (1/2/2,5/5 × 10^k) que gera ~targetCount divisões. */
export function niceStep(span: number, targetCount: number): number {
  if (!(span > 0) || targetCount <= 0) return 1
  const rough = span / targetCount
  const magnitude = 10 ** Math.floor(Math.log10(rough))
  for (const multiple of [1, 2, 2.5, 5, 10]) {
    if (rough <= multiple * magnitude) return multiple * magnitude
  }
  return 10 * magnitude
}

/** Ticks em múltiplos do passo redondo, contidos em [min, max]. */
export function axisTicks(min: number, max: number, targetCount: number): number[] {
  const step = niceStep(max - min, targetCount)
  const ticks: number[] = []
  // Arredonda pra evitar 0.30000000000000004 nos rótulos
  const decimals = Math.max(0, -Math.floor(Math.log10(step)))
  for (let tick = Math.ceil(min / step) * step; tick <= max + step / 1e6; tick += step) {
    ticks.push(Number(tick.toFixed(decimals + 1)))
  }
  return ticks
}

/** Teto do domínio y: menor múltiplo do passo redondo ≥ valor máximo. */
export function niceCeil(value: number, targetCount: number): number {
  if (!(value > 0)) return 1
  const step = niceStep(value, targetCount)
  return Math.ceil(value / step - 1e-9) * step
}
