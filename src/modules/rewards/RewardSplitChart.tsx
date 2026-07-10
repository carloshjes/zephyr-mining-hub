import { useId, useMemo, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { useChartEntrance } from '../../hooks/useChartEntrance'
import { useElementWidth } from '../../hooks/useElementWidth'
import { formatInteger, formatNumber, formatZeph } from '../../lib/format'
import { axisTicks, niceCeil, niceStep, type ChartMargins } from './chartGeometry'
import { REWARD_SERIES, sharePercent, type RewardSlices } from './rewardSeries'
import { SeriesSwatch, SeriesTexturePattern, seriesPatternId } from './SeriesSwatch'

// Área empilhada da divisão da recompensa, bloco a bloco. Especificação de
// marca da skill de dataviz: preenchimento como "wash" (~25% de opacidade) com
// a borda superior de cada faixa em linha sólida de 2px na cor da série — a
// borda é o encoding secundário exigido pela validação CVD (ver
// rewardSeries.ts). v2: as faixas não-dominantes ganham TEXTURA (hachura/
// pontilhado, rewardSeries.ts) por cima do wash — diferenciação que não
// depende de matiz, já que a rampa é monocromática de propósito. Grid em
// hairline recessiva, rótulos em tokens de texto (nunca na cor da série),
// tooltip via crosshair (mouse E teclado) e rótulos diretos só na borda
// direita — o resto fica com eixo, legenda e tabela.
//
// Movimento (v2): o grupo de faixas entra com draw-in (wipe da esquerda pra
// direita via clip-path) SÓ na montagem — polls seguintes não re-animam; o
// motion-reduce:animate-none devolve o estado final estático imediato.

const CHART_HEIGHT = 288
const MARGINS: ChartMargins = { top: 14, right: 56, bottom: 28, left: 48 }
// Rótulo direto só quando a faixa tem espessura pra ele (senão vira colisão)
const MIN_BAND_PX_FOR_LABEL = 11

export type SplitUnit = 'zeph' | 'percent'

interface RewardSplitChartProps {
  slices: RewardSlices[]
  unit: SplitUnit
}

interface HoverState {
  index: number
  source: 'pointer' | 'keyboard'
}

export function RewardSplitChart({ slices, unit }: RewardSplitChartProps) {
  const [containerRef, width] = useElementWidth<HTMLDivElement>()
  const [hover, setHover] = useState<HoverState | null>(null)
  const patternBase = useId()
  const entranceClass = useChartEntrance()

  const count = slices.length
  const plotWidth = Math.max(width - MARGINS.left - MARGINS.right, 0)
  const plotHeight = CHART_HEIGHT - MARGINS.top - MARGINS.bottom

  // Valor plotado por série/bloco conforme a unidade escolhida
  const valueAt = useMemo(() => {
    return (blockIndex: number, seriesIndex: number): number => {
      const block = slices[blockIndex]
      const key = REWARD_SERIES[seriesIndex].key
      return unit === 'zeph' ? block.values[key] : sharePercent(block, key)
    }
  }, [slices, unit])

  // Topo acumulado de cada faixa (base → topo), na ordem de REWARD_SERIES
  const cumulativeTops = useMemo(() => {
    const tops: number[][] = []
    let previous = new Array<number>(count).fill(0)
    for (let s = 0; s < REWARD_SERIES.length; s++) {
      const current = previous.map((base, i) => base + valueAt(i, s))
      tops.push(current)
      previous = current
    }
    return tops
  }, [count, valueAt])

  // Série zerada na janela inteira (governança hoje) não desenha faixa nem
  // borda — mas continua na legenda, no tooltip e na tabela
  const seriesIsActive = useMemo(
    () => REWARD_SERIES.map((def) => slices.some((block) => block.values[def.key] > 0)),
    [slices],
  )

  const yMax =
    unit === 'percent'
      ? 100
      : niceCeil(Math.max(...cumulativeTops[REWARD_SERIES.length - 1] ?? [1]), 4)
  const yTicks = unit === 'percent' ? [0, 25, 50, 75, 100] : axisTicks(0, yMax, 4)

  if (count < 2 || width === 0) {
    return (
      <div ref={containerRef} className="h-72">
        {count < 2 && width > 0 && (
          <p className="pt-8 text-center text-body text-mist-400">
            Sem blocos suficientes pra desenhar a série.
          </p>
        )}
      </div>
    )
  }

  const x = (blockIndex: number) =>
    MARGINS.left + (blockIndex / (count - 1)) * plotWidth
  const y = (value: number) =>
    MARGINS.top + plotHeight - (value / yMax) * plotHeight

  const firstHeight = slices[0].height
  const lastHeight = slices[count - 1].height
  const xTickStep = niceStep(lastHeight - firstHeight, width < 480 ? 3 : 5)
  const xTicks: number[] = []
  for (
    let tick = Math.ceil(firstHeight / xTickStep) * xTickStep;
    tick <= lastHeight;
    tick += xTickStep
  ) {
    xTicks.push(tick)
  }
  const xForHeight = (height: number) =>
    x(0) + ((height - firstHeight) / (lastHeight - firstHeight)) * plotWidth

  const bandPath = (seriesIndex: number): string => {
    const top = cumulativeTops[seriesIndex]
    const bottom = seriesIndex === 0 ? null : cumulativeTops[seriesIndex - 1]
    const forward = top
      .map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(v).toFixed(1)}`)
      .join('')
    const backward = Array.from({ length: count }, (_, i) => {
      const j = count - 1 - i
      const base = bottom ? bottom[j] : 0
      return `L${x(j).toFixed(1)},${y(base).toFixed(1)}`
    }).join('')
    return `${forward}${backward}Z`
  }

  const edgePoints = (seriesIndex: number): string =>
    cumulativeTops[seriesIndex]
      .map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`)
      .join(' ')

  // Rótulos diretos na borda direita: % da fatia no bloco mais recente,
  // centrado verticalmente na faixa — só quando a faixa comporta o texto
  const lastBlock = slices[count - 1]
  const endLabels = REWARD_SERIES.flatMap((def, s) => {
    if (!seriesIsActive[s]) return []
    const topPx = y(cumulativeTops[s][count - 1])
    const bottomPx = y(s === 0 ? 0 : cumulativeTops[s - 1][count - 1])
    if (bottomPx - topPx < MIN_BAND_PX_FOR_LABEL) return []
    return [
      {
        key: def.key,
        y: (topPx + bottomPx) / 2,
        text: `${formatNumber(sharePercent(lastBlock, def.key), 1, 1)}%`,
      },
    ]
  })

  const setHoverFromPointer = (event: PointerEvent<SVGRectElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    if (rect.width === 0) return
    const ratio = (event.clientX - rect.left) / rect.width
    const index = Math.min(count - 1, Math.max(0, Math.round(ratio * (count - 1))))
    setHover({ index, source: 'pointer' })
  }

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const current = hover?.index ?? count - 1
    let next: number | null = null
    if (event.key === 'ArrowLeft') next = Math.max(0, current - 1)
    else if (event.key === 'ArrowRight') next = Math.min(count - 1, current + 1)
    else if (event.key === 'Home') next = 0
    else if (event.key === 'End') next = count - 1
    else if (event.key === 'Escape') {
      setHover(null)
      return
    }
    if (next !== null) {
      event.preventDefault()
      setHover({ index: next, source: 'keyboard' })
    }
  }

  const hovered = hover ? slices[hover.index] : null
  const tooltipLeft = hover
    ? Math.min(Math.max(x(hover.index), 96), Math.max(width - 96, 96))
    : 0

  const summary =
    `Área empilhada da divisão da recompensa nos blocos ${formatInteger(firstHeight)} a ` +
    `${formatInteger(lastHeight)}. No bloco mais recente: ` +
    REWARD_SERIES.map(
      (def) => `${def.label.toLowerCase()} ${formatNumber(sharePercent(lastBlock, def.key), 1, 1)}%`,
    ).join(', ') +
    '. Valores completos na tabela abaixo.'

  return (
    <div
      ref={containerRef}
      className="relative focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zeph-300"
      tabIndex={0}
      aria-label={`${summary} Use as setas do teclado pra inspecionar bloco a bloco.`}
      onKeyDown={onKeyDown}
      onBlur={() => hover?.source === 'keyboard' && setHover(null)}
    >
      <svg width={width} height={CHART_HEIGHT} role="img" aria-hidden>
        {/* Padrões de textura das séries ativas (line/circle apenas — ver
            SeriesSwatch.tsx pras restrições de seletor do e2e) */}
        <defs>
          {REWARD_SERIES.map((def, s) =>
            seriesIsActive[s] && def.texture ? (
              <SeriesTexturePattern
                key={def.key}
                def={def}
                id={seriesPatternId(patternBase, def.key)}
              />
            ) : null,
          )}
        </defs>

        {/* Grid horizontal recessiva + rótulos do eixo y */}
        {yTicks.map((tick) => (
          <g key={tick}>
            <line
              x1={MARGINS.left}
              x2={MARGINS.left + plotWidth}
              y1={y(tick)}
              y2={y(tick)}
              strokeWidth={1}
              className={tick === 0 ? 'stroke-mist-600' : 'stroke-hairline'}
            />
            <text
              x={MARGINS.left - 8}
              y={y(tick) + 3}
              textAnchor="end"
              className="fill-mist-400 font-mono text-caption"
            >
              {unit === 'percent' ? `${tick}%` : formatNumber(tick, 2)}
            </text>
          </g>
        ))}
        <text x={4} y={MARGINS.top - 4} className="fill-mist-400 font-mono text-caption">
          {unit === 'percent' ? '% do bloco' : 'ZEPH'}
        </text>

        {/* Faixas: wash + textura + borda superior sólida na cor da série (a
            cor vem de var(--color-*) — em SVG isso só resolve via style, não
            atributo). O grupo inteiro entra com draw-in na montagem, com a
            trava de assentamento do useChartEntrance. */}
        <g className={entranceClass}>
          {REWARD_SERIES.map((def, s) =>
            seriesIsActive[s] ? (
              <g key={def.key}>
                <path
                  d={bandPath(s)}
                  style={{ fill: def.color, fillOpacity: def.washOpacity }}
                />
                {def.texture && (
                  <path
                    d={bandPath(s)}
                    style={{ fill: `url(#${seriesPatternId(patternBase, def.key)})` }}
                  />
                )}
                <polyline
                  points={edgePoints(s)}
                  fill="none"
                  strokeWidth={2}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  strokeDasharray={def.dashedEdge ? '4 3' : undefined}
                  style={{ stroke: def.color }}
                />
              </g>
            ) : null,
          )}

          {/* Rótulos diretos: % de cada fatia no bloco mais recente — dentro
              do grupo animado, aparecem no fim do wipe */}
          {endLabels.map((label) => (
            <text
              key={label.key}
              x={MARGINS.left + plotWidth + 6}
              y={label.y + 3}
              className="fill-mist-100 font-mono text-caption"
            >
              {label.text}
            </text>
          ))}
        </g>

        {/* Rótulos do eixo x (alturas de bloco) */}
        {xTicks.map((tick) => (
          <text
            key={tick}
            x={xForHeight(tick)}
            y={CHART_HEIGHT - 8}
            textAnchor="middle"
            className="fill-mist-400 font-mono text-caption"
          >
            {formatInteger(tick)}
          </text>
        ))}

        {/* Crosshair do índice inspecionado */}
        {hover && (
          <line
            x1={x(hover.index)}
            x2={x(hover.index)}
            y1={MARGINS.top}
            y2={MARGINS.top + plotHeight}
            strokeWidth={1}
            className="stroke-mist-400"
          />
        )}

        {/* Alvo de hover: o plot inteiro, nunca só os pixels pintados */}
        <rect
          x={MARGINS.left}
          y={MARGINS.top}
          width={plotWidth}
          height={plotHeight}
          fill="transparent"
          className="cursor-crosshair"
          onPointerMove={setHoverFromPointer}
          onPointerLeave={() => hover?.source === 'pointer' && setHover(null)}
        />
      </svg>

      {hovered && (
        <div
          className="pointer-events-none absolute top-2 z-10 w-max -translate-x-1/2 border border-hairline bg-ink-900 px-3 py-2 text-label"
          style={{ left: tooltipLeft }}
        >
          <p className="mb-1 font-mono text-caption text-mist-400">
            [ BLOCO {formatInteger(hovered.height)} ]
          </p>
          {REWARD_SERIES.map((def) => (
            <p key={def.key} className="flex items-center gap-2 leading-5">
              <SeriesSwatch def={def} width={12} height={9} />
              <span className="font-mono font-semibold text-mist-100">
                {formatZeph(hovered.values[def.key], 3)}
              </span>
              <span className="text-mist-400">
                · {formatNumber(sharePercent(hovered, def.key), 1, 1)}% {def.label.toLowerCase()}
              </span>
            </p>
          ))}
          <p className="mt-1 border-t border-hairline pt-1 text-mist-300">
            Total <span className="font-mono font-semibold text-mist-100">{formatZeph(hovered.total, 3)}</span>
          </p>
        </div>
      )}
    </div>
  )
}
