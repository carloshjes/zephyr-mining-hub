import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { projectNextHalving } from '../../lib/emission'
import { formatDateTime, formatInteger, formatZeph } from '../../lib/format'
import { Skeleton } from '../../components/ui/Skeleton'

// Faixa secundária da página: contagem regressiva pro próximo halving.
// A projeção é recalculada a cada atualização da recompensa base (30s) e o
// relógio tica localmente a cada segundo em cima da data estimada.
//
// v3: a faixa virou READOUT — moldura hairline sempre presente + superfície
// elevada ink-900 + cabeçalho separado, a MESMA receita do painel RESERVE
// RATIO do Raio-X (era o único elemento secundário do produto sem tratamento
// de instrumento; carregando, em cauda ou contando, a moldura existe).

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
      {/* Dígitos em mono (metadado técnico, na convenção da direção) —
          a faixa é secundária: o hero da tela é o hashrate da rede */}
      <span className="font-mono text-data-lg font-medium">{value}</span>
      <span className="mt-1 font-mono text-caption tracking-wide text-mist-400 uppercase">
        {unit}
      </span>
    </span>
  )
}

// Moldura do readout — compartilhada pelos três estados (carregando, cauda,
// contagem): o instrumento nunca rende como retângulo vazio nem some
function ReadoutFrame({ children }: { children: ReactNode }) {
  return (
    <section className="border border-hairline bg-ink-900">
      <header className="border-b border-hairline px-4 py-2">
        <h2 className="font-mono text-caption tracking-wide text-mist-300">
          [ PRÓXIMO HALVING ]
        </h2>
      </header>
      <div className="px-4 py-5 sm:px-6">{children}</div>
    </section>
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

  if (isLoading || !projection) {
    return (
      <ReadoutFrame>
        <Skeleton className="h-12 w-64" />
      </ReadoutFrame>
    )
  }

  if (projection.isTailEmission) {
    return (
      <ReadoutFrame>
        <p className="text-data-md font-semibold">Emissão de cauda ativa</p>
        <p className="mt-2 text-body text-mist-400">
          A recompensa base chegou ao piso de {formatZeph(projection.nextThresholdZeph, 1)}{' '}
          por bloco e não cai mais — não há próximos halvings.
        </p>
      </ReadoutFrame>
    )
  }

  const secondsLeft = (projection.estimatedAt.getTime() - nowMs) / 1_000
  const { days, hours, minutes, seconds } = splitCountdown(secondsLeft)

  return (
    <ReadoutFrame>
      <div className="flex flex-wrap items-start justify-between gap-x-10 gap-y-4">
        <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
          <CountdownSegment value={days} unit="dias" />
          <CountdownSegment value={hours} unit="horas" />
          <CountdownSegment value={minutes} unit="min" />
          <CountdownSegment value={seconds} unit="seg" />
        </div>
        <div className="max-w-xl">
          <p className="text-body text-mist-300">
            Faltam <strong className="font-mono text-mist-100">{formatInteger(projection.blocksRemaining)}</strong>{' '}
            blocos até a recompensa base cruzar{' '}
            <strong className="font-mono text-mist-100">{formatZeph(projection.nextThresholdZeph)}</strong>{' '}
            (hoje: {formatZeph(projection.baseRewardZeph)}) — por volta de{' '}
            <strong className="text-mist-100">{formatDateTime(projection.estimatedAt)}</strong>.
          </p>
          <p className="mt-2 text-label text-mist-400">
            A emissão do Zephyr é suave (estilo Monero): a recompensa cai um pouco a cada
            bloco, sem corte abrupto. O “halving” é o marco em que ela atinge metade do
            patamar anterior. Estimativa assume blocos de 120 s (a recompensa cai
            ~0,000095% por bloco).
          </p>
        </div>
      </div>
    </ReadoutFrame>
  )
}
