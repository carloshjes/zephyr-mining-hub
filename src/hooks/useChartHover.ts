import { useState, type KeyboardEvent, type PointerEvent } from 'react'

export interface ChartHoverState {
  index: number
  source: 'pointer' | 'keyboard'
}

interface UseChartHoverOptions {
  count: number
  width: number
  tooltipMargin: number
  xForIndex: (index: number) => number
}

export function useChartHover({
  count,
  width,
  tooltipMargin,
  xForIndex,
}: UseChartHoverOptions) {
  const [hover, setHover] = useState<ChartHoverState | null>(null)

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

  const clearPointerHover = () => {
    setHover((current) => (current?.source === 'pointer' ? null : current))
  }
  const clearKeyboardHover = () => {
    setHover((current) => (current?.source === 'keyboard' ? null : current))
  }

  const tooltipLeft = hover
    ? Math.min(
        Math.max(xForIndex(hover.index), tooltipMargin),
        Math.max(width - tooltipMargin, tooltipMargin),
      )
    : 0

  return {
    hover,
    setHoverFromPointer,
    onKeyDown,
    clearPointerHover,
    clearKeyboardHover,
    tooltipLeft,
  }
}
