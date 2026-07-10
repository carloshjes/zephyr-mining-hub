import type { ReactNode } from 'react'
import { formatNumber } from '../../lib/format'
import { Skeleton } from './Skeleton'

// Stat tile padrão do produto (direção "Sinal Técnico"): sem caixa — régua
// hairline no topo, rótulo em monoespaçada, valor em semibold. O delta é
// NEUTRO nas duas direções (o glifo ▲/▼ + sinal carregam o sentido): o
// vermelho é reservado pra alerta de verdade (piso, erro, offline) — uma
// oscilação diária não é alerta.

export interface StatDelta {
  /** Variação percentual (ex.: -3.2). */
  percent: number
  /** Período de referência, ex.: "vs. ontem". */
  label: string
}

interface StatCardProps {
  label: string
  value: string
  /** Linha de apoio: valor exato, média móvel, contexto. */
  sub?: string
  delta?: StatDelta
  /** Chip extra (ex.: estado de saúde) — deve conter texto, nunca só cor. */
  badge?: ReactNode
  isLoading?: boolean
}

function DeltaChip({ percent, label }: StatDelta) {
  const isUp = percent >= 0
  return (
    <span className="inline-flex items-baseline gap-1 font-mono text-xs text-mist-300">
      <span aria-hidden>{isUp ? '▲' : '▼'}</span>
      {`${isUp ? '+' : '−'}${formatNumber(Math.abs(percent), 1, 1)}%`}
      <span className="text-mist-400">{label}</span>
    </span>
  )
}

export function StatCard({ label, value, sub, delta, badge, isLoading }: StatCardProps) {
  return (
    <div className="border-t border-hairline pt-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-mono text-[11px] tracking-wide text-mist-400">{label}</h3>
        {badge}
      </div>
      <p className="mt-1.5 text-2xl font-semibold tracking-tight">
        {isLoading ? <Skeleton /> : value}
      </p>
      <div className="mt-1.5 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        {delta && !isLoading && <DeltaChip {...delta} />}
        {sub && <p className="text-xs text-mist-400">{sub}</p>}
      </div>
    </div>
  )
}
