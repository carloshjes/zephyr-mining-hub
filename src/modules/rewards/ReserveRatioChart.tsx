import { useState, type KeyboardEvent, type PointerEvent } from 'react'
import { useElementWidth } from '../../hooks/useElementWidth'
import { formatInteger, formatNumber } from '../../lib/format'
import { axisTicks, niceStep, type ChartMargins } from './chartGeometry'

// Linha do reserve ratio na mesma janela de blocos do gráfico de divisão —
// série única (violeta #9085e9, validado contra slate-900 junto com a paleta
// das fatias), então sem caixa de legenda: o título do cartão nomeia a série.
// Domínio y ajustado aos dados (linha não precisa ancorar no zero); o piso da
// faixa alvo (4,0) ganha hairline de referência quando cai dentro do domínio.

const CHART_HEIGHT = 192
const MARGINS: ChartMargins = { top: 14, right: 56, bottom: 28, left: 48 }
const LINE_COLOR = '#9085e9'
const TARGET_FLOOR = 4

export interface RatioPoint {
  height: number
  ratio: number
}

interface ReserveRatioChartProps {
  points: RatioPoint[]
}

interface HoverState {
  index: number
  source: 'pointer' | 'keyboard'
}

export function ReserveRatioChart({ points }: ReserveRatioChartProps) {
  const [containerRef, width] = useElementWidth<HTMLDivElement>()
  const [hover, setHover] = useState<HoverState | null>(null)

  const count = points.length
  const plotWidth = Math.max(width - MARGINS.left - MARGINS.right, 0)
  const plotHeight = CHART_HEIGHT - MARGINS.top - MARGINS.bottom

  if (count < 2 || width === 0) {
    return (
      <div ref={containerRef} className="h-48">
        {count < 2 && width > 0 && (
          <p className="pt-8 text-center text-sm text-slate-500">
            Sem pontos suficientes pra desenhar a série.
          </p>
        )}
      </div>
    )
  }

  const values = points.map((point) => point.ratio)
  const dataMin = Math.min(...values)
  const dataMax = Math.max(...values)
  const pad = (dataMax - dataMin) * 0.15 || dataMax * 0.05 || 0.1
  const yMin = dataMin - pad
  const yMax = dataMax + pad
  const yTicks = axisTicks(yMin, yMax, 4)

  const x = (index: number) => MARGINS.left + (index / (count - 1)) * plotWidth
  const y = (value: number) =>
    MARGINS.top + plotHeight - ((value - yMin) / (yMax - yMin)) * plotHeight

  const firstHeight = points[0].height
  const lastHeight = points[count - 1].height
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

  const linePoints = values
    .map((value, index) => `${x(index).toFixed(1)},${y(value).toFixed(1)}`)
    .join(' ')
  const current = points[count - 1]
  const floorInDomain = TARGET_FLOOR > yMin && TARGET_FLOOR < yMax

  const setHoverFromPointer = (event: PointerEvent<SVGRectElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    if (rect.width === 0) return
    const ratio = (event.clientX - rect.left) / rect.width
    const index = Math.min(count - 1, Math.max(0, Math.round(ratio * (count - 1))))
    setHover({ index, source: 'pointer' })
  }

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const currentIndex = hover?.index ?? count - 1
    let next: number | null = null
    if (event.key === 'ArrowLeft') next = Math.max(0, currentIndex - 1)
    else if (event.key === 'ArrowRight') next = Math.min(count - 1, currentIndex + 1)
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

  const hovered = hover ? points[hover.index] : null
  const tooltipLeft = hover
    ? Math.min(Math.max(x(hover.index), 72), Math.max(width - 72, 72))
    : 0

  const summary =
    `Reserve ratio nos blocos ${formatInteger(firstHeight)} a ${formatInteger(lastHeight)}: ` +
    `mínimo ${formatNumber(dataMin, 2, 2)}, máximo ${formatNumber(dataMax, 2, 2)}, ` +
    `mais recente ${formatNumber(current.ratio, 2, 2)}. Valores completos na tabela abaixo.`

  return (
    <div
      ref={containerRef}
      className="relative rounded focus-visible:outline-2 focus-visible:outline-sky-400"
      tabIndex={0}
      aria-label={`${summary} Use as setas do teclado pra inspecionar bloco a bloco.`}
      onKeyDown={onKeyDown}
      onBlur={() => hover?.source === 'keyboard' && setHover(null)}
    >
      <svg width={width} height={CHART_HEIGHT} role="img" aria-hidden>
        {yTicks.map((tick) => (
          <g key={tick}>
            <line
              x1={MARGINS.left}
              x2={MARGINS.left + plotWidth}
              y1={y(tick)}
              y2={y(tick)}
              strokeWidth={1}
              className="stroke-slate-800"
            />
            <text
              x={MARGINS.left - 8}
              y={y(tick) + 3}
              textAnchor="end"
              className="fill-slate-400 text-[10px] tabular-nums"
            >
              {formatNumber(tick, 2)}
            </text>
          </g>
        ))}

        {/* Piso da faixa alvo do protocolo, quando visível no domínio */}
        {floorInDomain && (
          <g>
            <line
              x1={MARGINS.left}
              x2={MARGINS.left + plotWidth}
              y1={y(TARGET_FLOOR)}
              y2={y(TARGET_FLOOR)}
              strokeWidth={1}
              className="stroke-slate-600"
            />
            <text
              x={MARGINS.left + 4}
              y={y(TARGET_FLOOR) - 4}
              className="fill-slate-500 text-[10px]"
            >
              piso da faixa alvo (4,0)
            </text>
          </g>
        )}

        {xTicks.map((tick) => (
          <text
            key={tick}
            x={xForHeight(tick)}
            y={CHART_HEIGHT - 8}
            textAnchor="middle"
            className="fill-slate-400 text-[10px] tabular-nums"
          >
            {formatInteger(tick)}
          </text>
        ))}

        <polyline
          points={linePoints}
          fill="none"
          stroke={LINE_COLOR}
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* Ponto atual com anel na cor da superfície + rótulo direto */}
        <circle
          cx={x(count - 1)}
          cy={y(current.ratio)}
          r={4}
          fill={LINE_COLOR}
          strokeWidth={2}
          className="stroke-slate-900"
        />
        <text
          x={MARGINS.left + plotWidth + 6}
          y={y(current.ratio) + 3}
          className="fill-slate-200 text-[11px] font-medium tabular-nums"
        >
          {formatNumber(current.ratio, 2, 2)}
        </text>

        {hover && (
          <g>
            <line
              x1={x(hover.index)}
              x2={x(hover.index)}
              y1={MARGINS.top}
              y2={MARGINS.top + plotHeight}
              strokeWidth={1}
              className="stroke-slate-400"
            />
            <circle
              cx={x(hover.index)}
              cy={y(points[hover.index].ratio)}
              r={4}
              fill={LINE_COLOR}
              strokeWidth={2}
              className="stroke-slate-900"
            />
          </g>
        )}

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
          className="pointer-events-none absolute top-2 z-10 w-max -translate-x-1/2 rounded-lg border border-slate-700 bg-slate-950/95 px-3 py-2 text-xs shadow-xl"
          style={{ left: tooltipLeft }}
        >
          <p className="text-slate-400">Bloco {formatInteger(hovered.height)}</p>
          <p className="leading-5">
            <span className="font-semibold text-slate-100 tabular-nums">
              {formatNumber(hovered.ratio, 2, 2)}
            </span>{' '}
            <span className="text-slate-400">reserve ratio</span>
          </p>
        </div>
      )}
    </div>
  )
}
