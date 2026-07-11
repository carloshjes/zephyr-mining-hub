// Mini-gráfico de tendência de série única (sparkline) — generalização do
// desenho que nasceu na tabela da Bússola de Pools (v3): linha 2px na cor de
// de-ênfase, só o ponto atual no accent (com anel na cor do fundo pra não se
// perder sobre a linha), linha de referência hairline opcional quando o
// chamador tem um "neutro" (ex.: luck 100%). Sem eixos nem legenda — o texto
// ao lado do gráfico carrega o valor; aqui é só a forma da tendência.
//
// Variante 'bars' (2026-07-11, pedido de uso real no Monitor do Rig): barras
// verticais por leitura, na mesma linguagem de blocos da direção. As barras
// partem do PISO DO DOMÍNIO (min − 15% do span), não do zero — mesma janela
// recortada que a linha já usava: isto é textura de tendência, não magnitude
// absoluta (um hashrate estável perto de 16 kH/s viraria um bloco chapado se
// ancorasse no zero). A barra mais recente fica no accent, as demais na cor
// de de-ênfase — o mesmo papel do "ponto atual" da linha.
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
  /** 'line' (padrão — Pulso da Rede e Bússola) ou 'bars' (Monitor do Rig). */
  variant?: 'line' | 'bars'
}

// Folga pro ponto atual (r=4 + anel de 2) não cortar na borda
const PAD = 6

export function TrendSparkline({
  values,
  summary,
  referenceValue,
  width = 96,
  height = 28,
  variant = 'line',
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
  // Nas barras o piso desce 15% do span: a leitura mínima ainda rende barra
  // visível (no domínio cru ela teria altura zero e "sumiria" da série)
  const barFloor = min - ((max - min) * 0.15 || Math.abs(min) * 0.05 || 1)
  const lo = variant === 'bars' ? barFloor : min
  const span = max - lo || 1

  const x = (index: number) => PAD + (index / (values.length - 1)) * (width - 2 * PAD)
  const y = (value: number) => height - PAD - ((value - lo) / span) * (height - 2 * PAD)

  const current = values[values.length - 1]

  // Geometria das barras: um slot por leitura; com muitas leituras (a série
  // de 24 h chega a 288) a barra afina até 1px e o conjunto lê como textura
  // densa — deliberado, mesma linguagem da grade de blocos do fundo
  const plotW = width - 2 * PAD
  const slot = plotW / values.length
  const barW = Math.max(1, Math.min(slot * 0.7, 8))

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
      {variant === 'bars' ? (
        values.map((value, index) => {
          const left = PAD + index * slot + (slot - barW) / 2
          const top = y(value)
          const isCurrent = index === values.length - 1
          return (
            <rect
              key={index}
              x={left.toFixed(2)}
              y={top.toFixed(1)}
              width={barW.toFixed(2)}
              height={Math.max(height - PAD - top, 1).toFixed(1)}
              className={isCurrent ? 'fill-zeph-300' : 'fill-mist-600'}
            />
          )
        })
      ) : (
        <>
          <polyline
            points={values
              .map((value, index) => `${x(index).toFixed(1)},${y(value).toFixed(1)}`)
              .join(' ')}
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
        </>
      )}
    </svg>
  )
}
