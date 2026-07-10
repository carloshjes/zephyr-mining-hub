// Gatilho do pulso de "dado novo" (direção v2): fica true por ~950 ms quando
// a versão observada MUDA — a primeira chegada é ignorada de propósito (a
// entrada draw-in já cobre o nascimento do gráfico). O respeito a
// prefers-reduced-motion é do CSS (todo uso é animate-data-pulse +
// motion-reduce:animate-none); aqui é só o timing.

import { useEffect, useRef, useState } from 'react'

export function useDataPulse(version: number | undefined): boolean {
  const [fresh, setFresh] = useState(false)
  const previous = useRef<number | undefined>(undefined)

  useEffect(() => {
    if (version === undefined) return
    if (previous.current === undefined) {
      previous.current = version
      return
    }
    if (previous.current === version) return
    previous.current = version
    setFresh(true)
    const timer = window.setTimeout(() => setFresh(false), 950)
    return () => window.clearTimeout(timer)
  }, [version])

  return fresh
}
