// Mini-gráfico de tendência de série única (sparkline) — generalização do
// desenho que nasceu na tabela da Bússola de Pools (v3): linha 2px na cor de
// de-ênfase, só o ponto atual no accent (com anel na cor do fundo pra não se
// perder sobre a linha), linha de referência hairline opcional quando o
// chamador tem um "neutro" (ex.: luck 100%). Sem eixos nem legenda — o texto
// ao lado do gráfico carrega o valor; aqui é só a forma da tendência.
//
// Com menos de 2 leituras não existe tendência: o componente DIZ que está
// coletando, sem fingir gráfico (convenção do projeto: nunca inventar dado).

interface TrendSparklineProps {
  values: number[]
  /** Resumo acessível completo — o chamador conhece a semântica da série.
      Ignorado enquanto não há tendência (< 2 leituras). */
  summary: string
  /** Valor de referência incluído no domínio e marcado com linha hairline. */
  referenceValue?: number
  width?: number
  height?: number
}

// Folga pro ponto atual (r=4 + anel de 2) não cortar na borda
const PAD = 6

export function TrendSparkline({
  values,
  summary,
  referenceValue,
  width = 96,
  height = 28,
}: TrendSparklineProps) {
  if (values.length < 2) {
    return (
      <span className="font-mono text-caption text-mist-400">
        coletando… ({values.length}/2)
      </span>
    )
  }

  // Domínio inclui a referência (quando existe) pra linha caber no desenho
  const domain = referenceValue === undefined ? values : [...values, referenceValue]
  const min = Math.min(...domain)
  const max = Math.max(...domain)
  const span = max - min || 1

  const x = (index: number) => PAD + (index / (values.length - 1)) * (width - 2 * PAD)
  const y = (value: number) => height - PAD - ((value - min) / span) * (height - 2 * PAD)

  const points = values
    .map((value, index) => `${x(index).toFixed(1)},${y(value).toFixed(1)}`)
    .join(' ')
  const current = values[values.length - 1]

  return (
    <svg
      role="img"
      aria-label={summary}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="overflow-visible"
    >
      <title>{summary}</title>
      {referenceValue !== undefined && (
        <line
          x1={PAD}
          x2={width - PAD}
          y1={y(referenceValue)}
          y2={y(referenceValue)}
          strokeWidth={1}
          className="stroke-hairline"
        />
      )}
      <polyline
        points={points}
        fill="none"
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
        className="stroke-mist-600"
      />
      <circle
        cx={x(values.length - 1)}
        cy={y(current)}
        r={4}
        strokeWidth={2}
        className="fill-zeph-300 stroke-ink-950"
      />
    </svg>
  )
}
