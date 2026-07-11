import { formatNumber } from '../../lib/format'
import { TrendSparkline } from '../../components/ui/TrendSparkline'
import type { LuckReading } from './luckHistory'

// Mini-gráfico de tendência do luck (série única, inline na tabela). O
// desenho vive no TrendSparkline compartilhado (v3 — o Pulso da Rede usa o
// mesmo pra hashrate); aqui fica só a semântica do luck: a linha de
// referência nos 100% (neutro) e o resumo acessível por pool.

interface LuckSparklineProps {
  readings: LuckReading[]
  /** Nome da pool, pra descrição acessível. */
  poolName: string
}

export function LuckSparkline({ readings, poolName }: LuckSparklineProps) {
  const values = readings.map((reading) => reading.luck)
  const summary =
    values.length < 2
      ? ''
      : `Tendência do luck da ${poolName}: ${readings.length} leituras, atual ${formatNumber(values[values.length - 1], 1)}%, mínima ${formatNumber(Math.min(...values), 1)}%, máxima ${formatNumber(Math.max(...values), 1)}%`

  return <TrendSparkline values={values} summary={summary} referenceValue={100} />
}
