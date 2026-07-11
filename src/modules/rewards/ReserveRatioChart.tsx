import { useId, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { useChartEntrance } from '../../hooks/useChartEntrance'
import { useElementWidth } from '../../hooks/useElementWidth'
import { formatInteger, formatNumber } from '../../lib/format'
import { axisTicks, niceStep, type ChartMargins } from './chartGeometry'

// Linha do reserve ratio na mesma janela de blocos do gráfico de divisão —
// série única no roxo médio da marca (validado ≥ 3:1 contra ink-950), então
// sem caixa de legenda: o título da seção nomeia a série. Domínio y ajustado
// aos dados (linha não precisa ancorar no zero).
//
// Estado de alarme (direção v2): o laranja de estado negativo (bad) marca o
// cruzamento do piso de 4,0 — a linha do piso e os TRECHOS da série abaixo
// dele ficam em bad (recorte via clipPath), e o ponto atual/rótulo direto
// acompanham quando o valor corrente está abaixo.

const CHART_HEIGHT = 192
const MARGINS: ChartMargins = { top: 14, right: 50, bottom: 26, left: 40 }
export const TARGET_FLOOR = 4
export const TARGET_CEILING = 8

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
  const clipId = useId()
  const entranceClass = useChartEntrance()

  const count = points.length
  const plotWidth = Math.max(width - MARGINS.left - MARGINS.right, 0)
  const plotHeight = CHART_HEIGHT - MARGINS.top - MARGINS.bottom

  if (count < 2 || width === 0) {
    return (
      <div ref={containerRef} className="h-48">
        {count < 2 && width > 0 && (
          <p className="pt-8 text-center text-body text-mist-400">
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
  const xTickStep = niceStep(lastHeight - firstHeight, width < 480 ? 3 : 4)
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
  const currentBelowFloor = current.ratio < TARGET_FLOOR
  const anyBelowFloor = values.some((value) => value < TARGET_FLOOR)
  const floorInDomain = TARGET_FLOOR > yMin && TARGET_FLOOR < yMax

  // Rótulo do piso com flip de posição (v3). Causa raiz do bug (medições em
  // NOTES.md): o offset fixo de −4px era cego pra borda do plot E pra série —
  // com o piso colado no teto do domínio (yMax → 4,0) o ink do caption
  // chegava a 0,07px da borda do SVG (overflow hidden — qualquer variação de
  // métrica de fonte corta), e com a série pairando no piso (o dado real
  // desta semana) a linha atravessava o texto. Regra: nunca sair do plot
  // (dura); podendo os dois lados, fica no lado com MENOS pontos da série
  // dentro da banda do texto (só no trecho x que o rótulo ocupa).
  const FLOOR_LABEL_CLEARANCE = 16 // 4 de vão + ~10 de ascent da mono + respiro
  const FLOOR_LABEL_W = 160 // extensão x aproximada de "piso da faixa alvo (4,0)"
  const FLOOR_LABEL_INK = 12 // altura de ink do caption
  let floorLabelY = 0
  if (floorInDomain) {
    const floorY = y(TARGET_FLOOR)
    const fitsAbove = floorY - MARGINS.top >= FLOOR_LABEL_CLEARANCE
    const fitsBelow = MARGINS.top + plotHeight - floorY >= FLOOR_LABEL_CLEARANCE
    const aboveBaseline = floorY - 4
    const belowBaseline = floorY + 13
    // pontos da série dentro da banda vertical do rótulo, no trecho x do texto
    const collisions = (baseline: number) => {
      let hits = 0
      for (let i = 0; i < count; i++) {
        if (x(i) > MARGINS.left + 4 + FLOOR_LABEL_W) break
        const pointY = y(values[i])
        if (pointY >= baseline - FLOOR_LABEL_INK - 2 && pointY <= baseline + 3) hits++
      }
      return hits
    }
    if (!fitsAbove) floorLabelY = belowBaseline
    else if (!fitsBelow) floorLabelY = aboveBaseline
    else
      floorLabelY =
        collisions(belowBaseline) < collisions(aboveBaseline) ? belowBaseline : aboveBaseline
  }
  // Região do alerta: tudo abaixo do piso (se o domínio inteiro está abaixo,
  // a região cobre o plot todo)
  const badClipTop = TARGET_FLOOR >= yMax ? MARGINS.top : y(TARGET_FLOOR)

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
    `mais recente ${formatNumber(current.ratio, 2, 2)}` +
    (anyBelowFloor ? ` — a série cruza o piso da faixa alvo (${formatNumber(TARGET_FLOOR, 1, 1)}).` : '.') +
    ' Valores completos na tabela abaixo.'

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
        <defs>
          {/* Recorte da região abaixo do piso — os trechos da linha dentro
              dela são redesenhados no laranja de estado negativo */}
          <clipPath id={clipId}>
            <rect
              x={MARGINS.left}
              y={badClipTop}
              width={plotWidth}
              height={Math.max(MARGINS.top + plotHeight - badClipTop, 0)}
            />
          </clipPath>
        </defs>

        {yTicks.map((tick) => (
          <g key={tick}>
            <line
              x1={MARGINS.left}
              x2={MARGINS.left + plotWidth}
              y1={y(tick)}
              y2={y(tick)}
              strokeWidth={1}
              className="stroke-hairline"
            />
            <text
              x={MARGINS.left - 8}
              y={y(tick) + 3}
              textAnchor="end"
              className="fill-mist-400 font-mono text-caption"
            >
              {formatNumber(tick, 2)}
            </text>
          </g>
        ))}

        {/* Piso da faixa alvo do protocolo, quando visível no domínio —
            vira laranja (bad) quando a série o cruza */}
        {floorInDomain && (
          <g>
            <line
              x1={MARGINS.left}
              x2={MARGINS.left + plotWidth}
              y1={y(TARGET_FLOOR)}
              y2={y(TARGET_FLOOR)}
              strokeWidth={1}
              strokeDasharray="4 3"
              className={anyBelowFloor ? 'stroke-bad' : 'stroke-mist-600'}
            />
            {/* Halo na cor do painel (o readout é ink-900 desde o v3) atrás
                dos glifos: o rótulo fica legível mesmo quando algum trecho
                da série cruza a banda do texto — atributo no próprio <text>,
                nenhum elemento novo (contrato do e2e preservado) */}
            <text
              x={MARGINS.left + 4}
              y={floorLabelY}
              className={`font-mono text-caption ${anyBelowFloor ? 'fill-bad' : 'fill-mist-400'}`}
              style={{
                paintOrder: 'stroke',
                stroke: 'var(--color-ink-900)',
                strokeWidth: 3,
                strokeLinejoin: 'round',
              }}
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
            className="fill-mist-400 font-mono text-caption"
          >
            {formatInteger(tick)}
          </text>
        ))}

        {/* Série + ponto atual entram com draw-in na montagem (v2), com a
            trava de assentamento do useChartEntrance; grid, piso e eixos
            ficam de fora — aparecem na hora */}
        <g className={entranceClass}>
          <polyline
            points={linePoints}
            fill="none"
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
            style={{ stroke: 'var(--color-zeph-500)' }}
          />
          {/* Trechos abaixo do piso, no laranja de estado negativo */}
          {anyBelowFloor && (
            <polyline
              points={linePoints}
              fill="none"
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
              clipPath={`url(#${clipId})`}
              className="stroke-bad"
              data-testid="ratio-alert-segment"
            />
          )}

          {/* Ponto atual com anel na cor do fundo (o painel é ink-900 desde
              o v3) + rótulo direto */}
          <circle
            cx={x(count - 1)}
            cy={y(current.ratio)}
            r={4}
            strokeWidth={2}
            className={`stroke-ink-900 ${currentBelowFloor ? 'fill-bad' : 'fill-zeph-300'}`}
          />
          <text
            x={MARGINS.left + plotWidth + 6}
            y={y(current.ratio) + 3}
            className={`font-mono text-caption ${currentBelowFloor ? 'fill-bad' : 'fill-mist-100'}`}
          >
            {formatNumber(current.ratio, 2, 2)}
          </text>
        </g>

        {hover && (
          <g>
            <line
              x1={x(hover.index)}
              x2={x(hover.index)}
              y1={MARGINS.top}
              y2={MARGINS.top + plotHeight}
              strokeWidth={1}
              className="stroke-mist-400"
            />
            <circle
              cx={x(hover.index)}
              cy={y(points[hover.index].ratio)}
              r={4}
              strokeWidth={2}
              className={`stroke-ink-900 ${
                points[hover.index].ratio < TARGET_FLOOR ? 'fill-bad' : 'fill-zeph-300'
              }`}
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
          className="pointer-events-none absolute top-2 z-10 w-max -translate-x-1/2 border border-hairline bg-ink-900 px-3 py-2 text-label"
          style={{ left: tooltipLeft }}
        >
          <p className="font-mono text-caption text-mist-400">
            [ BLOCO {formatInteger(hovered.height)} ]
          </p>
          <p className="leading-5">
            <span className="font-mono font-semibold text-mist-100">
              {formatNumber(hovered.ratio, 2, 2)}
            </span>{' '}
            <span className="text-mist-400">reserve ratio</span>
          </p>
          {hovered.ratio < TARGET_FLOOR && (
            <p className="font-mono text-caption text-bad">[ ABAIXO DO PISO 4,0 ]</p>
          )}
        </div>
      )}
    </div>
  )
}
