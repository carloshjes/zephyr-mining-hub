// Classe de entrada draw-in dos gráficos (v2) com trava de assentamento:
// devolve a classe de animação por ~1 s a partir da montagem e depois
// undefined — remover a classe SALTA pro estado final (sem clip-path).
//
// Por que a trava existe (medido, NOTES.md): em compositor lento (headless
// com throttling nos primeiros frames; vale pra hardware fraco real) o
// relógio da animação anda a fração da velocidade — o wipe de 700 ms pode
// se esticar por segundos e uma captura/olhada nesse meio-tempo vê o gráfico
// truncado. Em navegador normal a animação termina em 700 ms e a remoção da
// classe é invisível. O par motion-reduce:animate-none continua valendo
// enquanto a classe existe (reduced-motion nunca vê o wipe).

import { useEffect, useState } from 'react'

const SETTLE_MS = 1_000

export function useChartEntrance(): string | undefined {
  const [settled, setSettled] = useState(false)

  useEffect(() => {
    const timer = window.setTimeout(() => setSettled(true), SETTLE_MS)
    return () => window.clearTimeout(timer)
  }, [])

  return settled ? undefined : 'animate-chart-draw motion-reduce:animate-none'
}
