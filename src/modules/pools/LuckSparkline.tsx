import { formatNumber } from '../../lib/format'
import type { LuckReading } from './luckHistory'

// Mini-gráfico de tendência do luck (série única, inline na tabela).
// Segue o contrato de sparkline do stat tile: linha 2px na cor de de-ênfase,
// só o ponto atual no accent (com anel na cor da superfície pra não se perder
// sobre a linha), hairline recessiva marcando o 100% (luck neutro) quando o
// espaço permite. Sem eixos nem legenda — a célula "Luck" ao lado carrega o
// valor em texto; aqui é só a forma da tendência.

const WIDTH = 96
const HEIGHT = 28
// Folga pro ponto atual (r=4 + anel de 2) não cortar na borda
const PAD = 6

interface LuckSparklineProps {
  readings: LuckReading[]
  /** Nome da pool, pra descrição acessível. */
  poolName: string
}

export function LuckSparkline({ readings, poolName }: LuckSparklineProps) {
  // Com menos de 2 leituras não existe tendência — dizemos isso, sem fingir gráfico
  if (readings.length < 2) {
    return (
      <span className="text-xs text-slate-600">
        coletando… ({readings.length}/2)
      </span>
    )
  }

  const values = readings.map((reading) => reading.luck)
  // Domínio inclui 100% pra linha de referência (luck neutro) caber no desenho
  const min = Math.min(...values, 100)
  const max = Math.max(...values, 100)
  const span = max - min || 1

  const x = (index: number) => PAD + (index / (values.length - 1)) * (WIDTH - 2 * PAD)
  const y = (value: number) => HEIGHT - PAD - ((value - min) / span) * (HEIGHT - 2 * PAD)

  const points = values
    .map((value, index) => `${x(index).toFixed(1)},${y(value).toFixed(1)}`)
    .join(' ')
  const current = values[values.length - 1]
  const summary = `Tendência do luck da ${poolName}: ${readings.length} leituras, atual ${formatNumber(current, 1)}%, mínima ${formatNumber(Math.min(...values), 1)}%, máxima ${formatNumber(Math.max(...values), 1)}%`

  return (
    <svg
      role="img"
      aria-label={summary}
      width={WIDTH}
      height={HEIGHT}
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      className="overflow-visible"
    >
      <title>{summary}</title>
      {/* Referência do 100% — recessiva, um passo acima da superfície */}
      <line
        x1={PAD}
        x2={WIDTH - PAD}
        y1={y(100)}
        y2={y(100)}
        strokeWidth={1}
        className="stroke-slate-800"
      />
      <polyline
        points={points}
        fill="none"
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
        className="stroke-slate-500"
      />
      <circle
        cx={x(values.length - 1)}
        cy={y(current)}
        r={4}
        strokeWidth={2}
        className="fill-sky-400 stroke-slate-900"
      />
    </svg>
  )
}
