import type { ReactNode } from 'react'
import { formatNumber } from '../../lib/format'
import { Skeleton } from './Skeleton'

// Stat tile padrão do produto: rótulo em caixa de frase (sem dois-pontos),
// valor em semibold com algarismos proporcionais, delta assinado comparando
// com um período nomeado ("vs. fechamento de ontem").

export interface StatDelta {
  /** Variação percentual (ex.: -3.2). */
  percent: number
  /** Período de referência, ex.: "vs. ontem". */
  label: string
  /** Se subir é bom (verde) ou ruim (vermelho). Padrão: subir é bom. */
  upIsGood?: boolean
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

function DeltaChip({ percent, label, upIsGood = true }: StatDelta) {
  const isUp = percent >= 0
  const isGood = isUp === upIsGood
  return (
    <span
      className={`inline-flex items-baseline gap-1 text-xs font-medium ${
        isGood ? 'text-emerald-400' : 'text-rose-400'
      }`}
    >
      <span aria-hidden>{isUp ? '▲' : '▼'}</span>
      {`${isUp ? '+' : '−'}${formatNumber(Math.abs(percent), 1, 1)}%`}
      <span className="font-normal text-slate-500">{label}</span>
    </span>
  )
}

export function StatCard({ label, value, sub, delta, badge, isLoading }: StatCardProps) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm text-slate-400">{label}</h3>
        {badge}
      </div>
      <p className="mt-2 text-3xl font-semibold tracking-tight">
        {isLoading ? <Skeleton /> : value}
      </p>
      <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        {delta && !isLoading && <DeltaChip {...delta} />}
        {sub && <p className="text-xs text-slate-500">{sub}</p>}
      </div>
    </div>
  )
}
