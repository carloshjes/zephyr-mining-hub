import { useEffect, useMemo, useState } from 'react'
import { projectNextHalving } from '../../lib/emission'
import { formatDateTime, formatInteger, formatZeph } from '../../lib/format'
import { Skeleton } from '../../components/ui/Skeleton'

// Hero da página: contagem regressiva pro próximo halving.
// A projeção é recalculada a cada atualização da recompensa base (30s) e o
// relógio tica localmente a cada segundo em cima da data estimada.

interface HalvingCountdownProps {
  /** base_reward_atoms do último bloco (string da API) — undefined enquanto carrega. */
  baseRewardAtoms?: string
  isLoading: boolean
}

interface CountdownParts {
  days: number
  hours: number
  minutes: number
  seconds: number
}

function splitCountdown(totalSeconds: number): CountdownParts {
  const clamped = Math.max(0, totalSeconds)
  return {
    days: Math.floor(clamped / 86_400),
    hours: Math.floor((clamped % 86_400) / 3_600),
    minutes: Math.floor((clamped % 3_600) / 60),
    seconds: Math.floor(clamped % 60),
  }
}

function CountdownSegment({ value, unit }: { value: number; unit: string }) {
  return (
    <span className="flex flex-col items-center">
      {/* Hero figure: algarismos proporcionais, mesma sans do resto do app */}
      <span className="text-5xl font-semibold tracking-tight sm:text-6xl">
        {value}
      </span>
      <span className="mt-1 text-xs tracking-wide text-slate-400 uppercase">{unit}</span>
    </span>
  )
}

export function HalvingCountdown({ baseRewardAtoms, isLoading }: HalvingCountdownProps) {
  // Number() é seguro aqui: a recompensa atual (~6,5e12 átomos) fica bem
  // abaixo do limite de precisão de 2^53
  const projection = useMemo(
    () => (baseRewardAtoms ? projectNextHalving(Number(baseRewardAtoms)) : undefined),
    [baseRewardAtoms],
  )

  // Relógio local de 1s pro countdown ticar entre as atualizações da API
  const [nowMs, setNowMs] = useState(() => Date.now())
  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 1_000)
    return () => window.clearInterval(timer)
  }, [])

  const heading = (
    <h2 className="text-sm font-medium tracking-wide text-sky-400 uppercase">
      Próximo halving
    </h2>
  )

  if (isLoading || !projection) {
    return (
      <section className="rounded-2xl border border-sky-900/60 bg-slate-900 p-6 sm:p-8">
        {heading}
        <div className="mt-4 flex gap-6">
          <Skeleton className="h-16 w-64" />
        </div>
      </section>
    )
  }

  if (projection.isTailEmission) {
    return (
      <section className="rounded-2xl border border-sky-900/60 bg-slate-900 p-6 sm:p-8">
        {heading}
        <p className="mt-3 text-3xl font-semibold">Emissão de cauda ativa</p>
        <p className="mt-2 text-sm text-slate-400">
          A recompensa base chegou ao piso de {formatZeph(projection.nextThresholdZeph, 1)}{' '}
          por bloco e não cai mais — não há próximos halvings.
        </p>
      </section>
    )
  }

  const secondsLeft = (projection.estimatedAt.getTime() - nowMs) / 1_000
  const { days, hours, minutes, seconds } = splitCountdown(secondsLeft)

  return (
    <section className="rounded-2xl border border-sky-900/60 bg-slate-900 p-6 sm:p-8">
      {heading}
      <div className="mt-4 flex flex-wrap items-end gap-x-8 gap-y-4">
        <CountdownSegment value={days} unit="dias" />
        <CountdownSegment value={hours} unit="horas" />
        <CountdownSegment value={minutes} unit="min" />
        <CountdownSegment value={seconds} unit="seg" />
      </div>
      <p className="mt-5 text-sm text-slate-400">
        Faltam <strong className="text-slate-200">{formatInteger(projection.blocksRemaining)}</strong>{' '}
        blocos até a recompensa base cruzar{' '}
        <strong className="text-slate-200">{formatZeph(projection.nextThresholdZeph)}</strong>{' '}
        (hoje: {formatZeph(projection.baseRewardZeph)}) — por volta de{' '}
        <strong className="text-slate-200">{formatDateTime(projection.estimatedAt)}</strong>.
      </p>
      <p className="mt-2 text-xs text-slate-500">
        A emissão do Zephyr é suave (estilo Monero): a recompensa cai um pouco a cada
        bloco, sem corte abrupto. O “halving” é o marco em que ela atinge metade do
        patamar anterior. Estimativa assume blocos de 120 s (a recompensa cai
        ~0,000095% por bloco).
      </p>
    </section>
  )
}
