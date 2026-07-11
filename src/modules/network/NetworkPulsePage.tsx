import { useCallback, useEffect, useMemo, useState } from 'react'
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
import { Skeleton } from '../../components/ui/Skeleton'
import { TrendSparkline } from '../../components/ui/TrendSparkline'
import { HalvingCountdown } from './HalvingCountdown'
import {
  appendNetworkHashrateReading,
  loadNetworkHashrateHistory,
  NETWORK_HASHRATE_LIMIT,
  type NetworkHashrateReading,
} from './networkHashrateHistory'

// Pulso da Rede — visão pública da saúde da rede Zephyr.
// Polling de 30s casando com o cache de 30s da Scanner API; o explorer segue
// o mesmo ritmo (um bloco novo a cada ~120s, 30s já é folgado).
//
// Composição (direção "Sinal Técnico"): o hashrate da rede é o pulso que dá
// nome ao módulo — vira a região dominante da dobra, com dificuldade/altura
// como anotação mono. Reserve ratio, preço e recompensa encolhem pra um rail
// quieto; o halving vira uma faixa horizontal secundária abaixo (antes eram
// DOIS heróis competindo: o card do halving e um grid de 6 cards iguais).
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
// Sempre texto + glifo, nunca só cor. Semântica v2: saudável=verde (good),
// abaixo do piso=laranja (bad); acima da faixa é atípico mas não é alarme —
// fica neutro, na convenção mono de colchetes da direção.
function reserveRatioBadge(ratio: number | undefined) {
  if (ratio === undefined) return undefined
  const chip = (text: string, className: string) => (
    <span className={`font-mono text-caption whitespace-nowrap ${className}`}>[ {text} ]</span>
  )
  if (ratio < 4) return chip('⚠ abaixo da faixa', 'text-bad')
  if (ratio > 8) return chip('↑ acima da faixa', 'text-mist-300')
  return chip('✓ saudável', 'text-good')
}

export function NetworkPulsePage() {
  const liveStats = usePolling(getLiveStats, POLL_INTERVAL_MS)
  const networkInfo = usePolling(getNetworkInfo, POLL_INTERVAL_MS)
  const blockReward = usePolling(getLatestBlockReward, POLL_INTERVAL_MS)

  // Tendência local do hashrate (v3): não existe série histórica em nenhuma
  // API confirmada — este navegador coleta 1 leitura por bloco (~2 min) com
  // a página aberta (appendNetworkHashrateReading ignora duplicatas)
  const [hashrateHistory, setHashrateHistory] = useState<NetworkHashrateReading[]>(() =>
    loadNetworkHashrateHistory(),
  )
  useEffect(() => {
    const hashrate = networkInfo.data?.hash_rate
    if (hashrate === undefined) return
    setHashrateHistory(appendNetworkHashrateReading(hashrate))
  }, [networkInfo.data])

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

  // Resumo acessível da tendência local (o TrendSparkline mostra "coletando…"
  // com menos de 2 leituras e ignora o resumo)
  const trendSummary = useMemo(() => {
    const values = hashrateHistory.map((reading) => reading.h)
    if (values.length < 2) return ''
    return (
      `Tendência do hashrate da rede coletada neste navegador: ${values.length} leituras, ` +
      `atual ${formatHashrate(values[values.length - 1])}, mínima ${formatHashrate(Math.min(...values))}, ` +
      `máxima ${formatHashrate(Math.max(...values))}`
    )
  }, [hashrateHistory])

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
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-data-md font-semibold tracking-tight">Pulso da Rede</h1>
          <p className="mt-1 text-body text-mist-400">
            Saúde da rede Zephyr em tempo quase-real, direto das APIs públicas.
          </p>
        </div>
        <p className="font-mono text-caption text-mist-400">
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

      {/* Região dominante: o pulso (hashrate) + rail quieto com o resto */}
      <section className="lg:grid lg:grid-cols-[minmax(0,1fr)_19rem] lg:gap-10 xl:grid-cols-[minmax(0,1fr)_21rem]">
        <div className="min-w-0">
          <p className="font-mono text-caption tracking-wide text-mist-400">
            [ HASHRATE DA REDE ]
          </p>
          {networkInfo.isLoading ? (
            <div className="mt-2 space-y-3">
              <Skeleton className="h-20 w-72" />
              <Skeleton className="h-4 w-96" />
            </div>
          ) : (
            <>
              <p className="mt-1 text-headline font-semibold tracking-tighter text-zeph-300">
                {orDash(networkInfo.data?.hash_rate, formatHashrate)}
              </p>
              <p className="mt-3 font-mono text-caption text-mist-400">
                dificuldade {orDash(difficulty, formatCompact)}
                {difficulty !== undefined && ` (${formatInteger(difficulty)})`} · bloco{' '}
                {orDash(networkInfo.data?.height, formatInteger)} · um novo a cada ~120 s
              </p>
              <p className="mt-1 text-label text-mist-400">
                estimado pelo daemon da rede (dificuldade ÷ 120 s), via explorer
              </p>

              {/* Tendência coletada localmente (v3): dado real acumulado por
                  este navegador — nenhuma API pública expõe a série, e a
                  legenda diz exatamente isso (nunca fingir histórico) */}
              <div className="mt-10">
                <p className="font-mono text-caption tracking-wide text-mist-400">
                  [ TENDÊNCIA · COLETADA NESTE NAVEGADOR ]
                </p>
                <div className="mt-3">
                  <TrendSparkline
                    values={hashrateHistory.map((reading) => reading.h)}
                    summary={trendSummary}
                    width={340}
                    height={64}
                  />
                </div>
                <p className="mt-2 max-w-md text-label text-mist-400">
                  Últimas {NETWORK_HASHRATE_LIMIT} leituras (1 por bloco, ~2 min) guardadas
                  neste navegador com a página aberta — não há série histórica pública de
                  hashrate pra buscar pronta.
                </p>
              </div>
            </>
          )}
        </div>

        <aside className="mt-8 space-y-4 lg:mt-0 lg:border-l lg:border-hairline lg:pl-8">
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
        </aside>
      </section>

      {/* Faixa secundária: contagem regressiva do próximo halving */}
      <HalvingCountdown
        baseRewardAtoms={blockReward.data?.base_reward_atoms}
        isLoading={blockReward.isLoading}
      />
    </div>
  )
}
