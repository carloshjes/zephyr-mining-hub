import { useCallback, useMemo } from 'react'
import { usePolling } from '../../hooks/usePolling'
import {
  getLatestBlockReward,
  getLiveStats,
  getStats,
  SCANNER_CACHE_SECONDS,
  type StatsPoint,
} from '../../lib/api/zephyrScanner'
import { getNetworkInfo } from '../../lib/api/zephyrExplorer'
import {
  DASH,
  formatCompact,
  formatHashrate,
  formatInteger,
  formatNumber,
  formatTime,
  formatUsd,
  formatZeph,
  orDash,
  percentChange,
} from '../../lib/format'
import { StatCard, type StatDelta } from '../../components/ui/StatCard'
import { ErrorNotice } from '../../components/ui/ErrorNotice'
import { HalvingCountdown } from './HalvingCountdown'

// Pulso da Rede — visão pública da saúde da rede Zephyr.
// Polling de 30s casando com o cache de 30s da Scanner API; o explorer segue
// o mesmo ritmo (um bloco novo a cada ~120s, 30s já é folgado).
const POLL_INTERVAL_MS = SCANNER_CACHE_SECONDS * 1_000
// Série diária só serve de referência de fechamento — 15 min é mais que suficiente
const DAILY_STATS_INTERVAL_MS = 15 * 60 * 1_000

const DAILY_FIELDS = ['zeph_price_close', 'reserve_ratio_close'] as const
type DailyField = (typeof DAILY_FIELDS)[number]

// Fechamento do último dia completo (o ponto de hoje ainda está aberto/parcial)
function lastClosedDay(
  points: StatsPoint<DailyField>[] | undefined,
): StatsPoint<DailyField> | undefined {
  if (!points?.length) return undefined
  const todayStartUtc = Math.floor(Date.now() / 1_000 / 86_400) * 86_400
  for (let i = points.length - 1; i >= 0; i--) {
    if (points[i].timestamp < todayStartUtc) return points[i]
  }
  return undefined
}

function deltaVsYesterday(
  current: number | undefined,
  reference: number | undefined,
): StatDelta | undefined {
  if (current === undefined || reference === undefined) return undefined
  const percent = percentChange(current, reference)
  return percent === undefined ? undefined : { percent, label: 'vs. ontem' }
}

// Faixa de saúde do reserve ratio do protocolo (Djed): alvo entre 4,0 e 8,0.
// Sempre texto + ícone, nunca só cor.
function reserveRatioBadge(ratio: number | undefined) {
  if (ratio === undefined) return undefined
  const chip = (text: string, icon: string, className: string) => (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${className}`}
    >
      <span aria-hidden>{icon}</span>
      {text}
    </span>
  )
  if (ratio < 4) return chip('abaixo da faixa', '⚠', 'border-rose-800 bg-rose-950/60 text-rose-300')
  if (ratio > 8) return chip('acima da faixa', '↑', 'border-amber-800 bg-amber-950/60 text-amber-300')
  return chip('saudável', '✓', 'border-emerald-800 bg-emerald-950/60 text-emerald-300')
}

export function NetworkPulsePage() {
  const liveStats = usePolling(getLiveStats, POLL_INTERVAL_MS)
  const networkInfo = usePolling(getNetworkInfo, POLL_INTERVAL_MS)
  const blockReward = usePolling(getLatestBlockReward, POLL_INTERVAL_MS)

  const fetchDailyStats = useCallback(
    (signal: AbortSignal) =>
      getStats(
        {
          scale: 'day',
          fields: DAILY_FIELDS,
          // Últimos 8 dias bastam pra achar o fechamento de ontem
          from: Math.floor(Date.now() / 1_000) - 8 * 86_400,
        },
        signal,
      ),
    [],
  )
  const dailyStats = usePolling(fetchDailyStats, DAILY_STATS_INTERVAL_MS)

  const yesterday = useMemo(() => lastClosedDay(dailyStats.data), [dailyStats.data])

  // Fontes com falha na última tentativa — o aviso fica visível mesmo com
  // dado antigo na tela (nunca falha silenciosa)
  const failingSources = [
    liveStats.error && 'Scanner API (livestats)',
    blockReward.error && 'Scanner API (blockrewards)',
    networkInfo.error && 'Explorer',
    dailyStats.error && 'Scanner API (stats)',
  ].filter((source): source is string => Boolean(source))

  const lastUpdatedAt = Math.max(
    liveStats.lastUpdatedAt ?? 0,
    networkInfo.lastUpdatedAt ?? 0,
    blockReward.lastUpdatedAt ?? 0,
  )
  const noDataAtAll =
    !liveStats.data && !networkInfo.data && !blockReward.data && failingSources.length > 0

  const difficulty =
    networkInfo.data?.difficulty !== undefined
      ? Number(networkInfo.data.difficulty)
      : undefined

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Pulso da Rede</h1>
          <p className="mt-1 text-sm text-slate-400">
            Saúde da rede Zephyr em tempo quase-real, direto das APIs públicas.
          </p>
        </div>
        <p className="text-xs text-slate-500">
          Atualização automática a cada {SCANNER_CACHE_SECONDS} s (cache da API)
          {lastUpdatedAt > 0 && ` · última: ${formatTime(new Date(lastUpdatedAt))}`}
        </p>
      </header>

      {noDataAtAll ? (
        <ErrorNotice
          variant="blocking"
          title="Nenhuma fonte de dados respondeu ainda — tentando de novo automaticamente."
          detail={`Fontes com falha: ${failingSources.join(', ')}.`}
        />
      ) : (
        failingSources.length > 0 && (
          <ErrorNotice detail={`Fontes com falha: ${failingSources.join(', ')}.`} />
        )
      )}

      <HalvingCountdown
        baseRewardAtoms={blockReward.data?.base_reward_atoms}
        isLoading={blockReward.isLoading}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          label="Hashrate da rede"
          value={orDash(networkInfo.data?.hash_rate, formatHashrate)}
          sub="estimado pelo daemon (dificuldade ÷ 120 s)"
          isLoading={networkInfo.isLoading}
        />
        <StatCard
          label="Dificuldade"
          value={orDash(difficulty, formatCompact)}
          sub={difficulty !== undefined ? `exata: ${formatInteger(difficulty)}` : undefined}
          isLoading={networkInfo.isLoading}
        />
        <StatCard
          label="Altura do bloco"
          value={orDash(networkInfo.data?.height, formatInteger)}
          sub="um bloco novo a cada ~120 s"
          isLoading={networkInfo.isLoading}
        />
        <StatCard
          label="Reserve ratio"
          value={orDash(liveStats.data?.reserve_ratio, (v) => formatNumber(v, 2, 2))}
          sub={
            liveStats.data?.reserve_ratio_ma !== undefined
              ? `média móvel: ${formatNumber(liveStats.data.reserve_ratio_ma, 2, 2)} · faixa alvo: 4,0–8,0`
              : 'faixa alvo do protocolo: 4,0–8,0'
          }
          delta={deltaVsYesterday(
            liveStats.data?.reserve_ratio,
            yesterday?.data.reserve_ratio_close,
          )}
          badge={reserveRatioBadge(liveStats.data?.reserve_ratio)}
          isLoading={liveStats.isLoading}
        />
        <StatCard
          label="Preço ZEPH"
          value={orDash(liveStats.data?.zeph_price, formatUsd)}
          delta={deltaVsYesterday(liveStats.data?.zeph_price, yesterday?.data.zeph_price_close)}
          isLoading={liveStats.isLoading}
        />
        <StatCard
          label="Recompensa do minerador"
          value={orDash(blockReward.data?.miner_reward, (v) => formatZeph(v))}
          sub={
            blockReward.data?.base_reward_atoms
              ? `recompensa base: ${formatZeph(Number(blockReward.data.base_reward_atoms) / 1e12)} · split 65/30/5`
              : `split 65% minerador / 30% reserva / 5% yield ${DASH} aguardando dado`
          }
          isLoading={blockReward.isLoading}
        />
      </div>
    </div>
  )
}
