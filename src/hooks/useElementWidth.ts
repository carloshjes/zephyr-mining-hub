// Largura renderizada de um elemento via ResizeObserver — os gráficos SVG do
// app são desenhados em pixels reais (não escalados por viewBox), senão o
// texto de eixo fica ilegível no celular.

import { useEffect, useRef, useState, type RefObject } from 'react'

export function useElementWidth<T extends HTMLElement>(): [RefObject<T | null>, number] {
  const ref = useRef<T>(null)
  const [width, setWidth] = useState(0)

  useEffect(() => {
    const element = ref.current
    if (!element) return
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (entry) setWidth(entry.contentRect.width)
    })
    observer.observe(element)
    setWidth(element.clientWidth)
    return () => observer.disconnect()
  }, [])

  return [ref, width]
}
