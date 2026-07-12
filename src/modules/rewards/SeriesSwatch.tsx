import { useId } from 'react'
import { seriesPatternId, type RewardSeriesDef } from './rewardSeries'

// Par visual da diferenciação de série do v2: o <pattern> compartilhado
// (hachura/pontilhado) e a miniatura de legenda que repete a receita exata da
// faixa do gráfico — wash + textura + borda superior sólida. Assim a legenda
// diferencia série por FORMA, não só por matiz (a rampa é monocromática).
//
// Restrições herdadas dos seletores do rewards-e2e (não mudar sem atualizar
// o script): dentro de <pattern> só <line>/<circle> (o e2e conta <path> por
// cor computada e localiza o overlay de hover por querySelector('rect') no
// svg do gráfico); na miniatura, o wash é <rect> (rect não colide com nada).

/** <pattern> da textura de uma série — usar dentro de <defs>. */
export function SeriesTexturePattern({ def, id }: { def: RewardSeriesDef; id: string }) {
  if (def.texture === 'hatch') {
    return (
      <pattern
        id={id}
        patternUnits="userSpaceOnUse"
        width={6}
        height={6}
        patternTransform="rotate(45)"
      >
        <line
          x1={0}
          y1={0}
          x2={0}
          y2={6}
          strokeWidth={1.6}
          strokeOpacity={0.6}
          style={{ stroke: def.color }}
        />
      </pattern>
    )
  }
  if (def.texture === 'dot') {
    return (
      <pattern id={id} patternUnits="userSpaceOnUse" width={7} height={7}>
        <circle cx={2} cy={2} r={1.2} fillOpacity={0.85} style={{ fill: def.color }} />
      </pattern>
    )
  }
  return null
}

interface SeriesSwatchProps {
  def: RewardSeriesDef
  /** Série zerada/inativa na janela — mesma atenuação do R1. */
  muted?: boolean
  width?: number
  height?: number
}

/** Miniatura fiel da faixa pra legenda e tooltip. */
export function SeriesSwatch({ def, muted = false, width = 16, height = 12 }: SeriesSwatchProps) {
  const patternBase = useId()
  const patternId = seriesPatternId(patternBase, def.key)
  return (
    <svg
      aria-hidden
      width={width}
      height={height}
      className="shrink-0"
      style={{ opacity: muted ? 0.35 : 1 }}
    >
      {def.texture && (
        <defs>
          <SeriesTexturePattern def={def} id={patternId} />
        </defs>
      )}
      <rect
        x={0}
        y={0}
        width={width}
        height={height}
        fillOpacity={def.washOpacity}
        style={{ fill: def.color }}
      />
      {def.texture && (
        <rect x={0} y={0} width={width} height={height} style={{ fill: `url(#${patternId})` }} />
      )}
      {/* Borda superior sólida de 2px — o mesmo encoding secundário da faixa */}
      <line
        x1={0}
        y1={1}
        x2={width}
        y2={1}
        strokeWidth={2}
        strokeDasharray={def.dashedEdge ? '3 2' : undefined}
        style={{ stroke: def.color }}
      />
    </svg>
  )
}
