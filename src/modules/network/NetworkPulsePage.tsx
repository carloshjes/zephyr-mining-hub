import { useCallback, useEffect, useMemo, useState } from 'react'
import { usePolling } from '../../hooks/usePolling'
import { useChartEntrance } from '../../hooks/useChartEntrance'
import { useDataPulse } from '../../hooks/useDataPulse'
import { useElementWidth } from '../../hooks/useElementWidth'
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
  formatHashrate,
  formatNumber,
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
  return percent === undefined ? undefined : { percent, label: 'vs. yesterday' }
}

// Faixa de saúde do reserve ratio do protocolo (Djed): alvo entre 4,0 e 8,0.
// Sempre texto + glifo, nunca só cor. Semântica v2: saudável=verde (good),
// abaixo do piso=laranja (bad); acima da faixa é atípico mas não é alarme —
// fica neutro, na convenção mono de colchetes da direção.
// Procedência da tendência (R5 2ª leva): saiu do texto visível (rótulo e
// legenda) e virou canal não-visual — title (tooltip) + aria-label no
// container do instrumento. A convenção do projeto segue de pé: a UI
// declara a procedência, só mudou o canal.
const NETWORK_TREND_PROVENANCE =
  'Trend collected by this browser while the page is open — one reading per ' +
  'block (~2 min), up to 360 readings; no public historical network hashrate ' +
  'series is available.'

// Instrumento da tendência local em componente próprio: o useElementWidth
// ata o ResizeObserver no mount, e este bloco nasce dentro do branch
// pós-loading — medir no pai (que monta antes, ainda em skeleton) deixaria o
// observer preso num ref nulo (mesmo motivo de RewardSplitChart ser filho).
// R5: largura MEDIDA do container no lugar do 340 fixo — o gráfico preenche
// a coluna dominante em desktop e segue coubível no mobile. 2ª leva: altura
// 64 → 96 (a remoção dos metadados liberou espaço vertical; calibrada por
// captura, NOTES.md) + o efeito dinâmico da linha (skill creative-ui-
// director): draw-in de entrada (useChartEntrance, com a trava de
// assentamento) e data-pulse na chegada de leitura nova (~2 min) — os dois
// movimentos que o sistema já tem, sempre em par com motion-reduce; halo no
// ponto corrente foi REJEITADO (o anel pulsante é semântica reservada do
// StatusBadge normal do rig). O hero segue a coisa mais viva da tela.
function NetworkTrend({
  readings,
  summary,
}: {
  readings: NetworkHashrateReading[]
  summary: string
}) {
  const [trendRef, trendWidth] = useElementWidth<HTMLDivElement>()
  const entranceClass = useChartEntrance()
  const fresh = useDataPulse(readings.length > 0 ? readings[readings.length - 1].t : undefined)
  const values = readings.map((reading) => reading.h)
  // draw-in e pulso disputam a MESMA propriedade animation no wrapper (as
  // utilities animate-* se sobrescrevem na cascata, medido: a leitura viva
  // que chega logo após a montagem cortava o draw-in no meio) — durante a
  // janela de entrada o draw-in é o dono do movimento; pulso só assentado
  const pulseClass =
    fresh && entranceClass === undefined ? ' animate-data-pulse motion-reduce:animate-none' : ''
  return (
    <div
      ref={trendRef}
      className={`mt-3 ${values.length >= 2 ? 'h-24' : ''} ${entranceClass ?? ''}${pulseClass}`}
    >
      {trendWidth > 0 && (
        <TrendSparkline values={values} summary={summary} width={trendWidth} height={96} />
      )}
    </div>
  )
}

function reserveRatioBadge(ratio: number | undefined) {
  if (ratio === undefined) return undefined
  const chip = (text: string, className: string) => (
    <span className={`font-mono text-caption whitespace-nowrap ${className}`}>[ {text} ]</span>
  )
  if (ratio < 4) return chip('⚠ below target range', 'text-bad')
  if (ratio > 8) return chip('↑ above target range', 'text-mist-300')
  return chip('✓ healthy', 'text-good')
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
      `Network hashrate trend collected by this browser: ${values.length} readings, ` +
      `current ${formatHashrate(values[values.length - 1])}, minimum ${formatHashrate(Math.min(...values))}, ` +
      `maximum ${formatHashrate(Math.max(...values))}`
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

  const noDataAtAll =
    !liveStats.data && !networkInfo.data && !blockReward.data && failingSources.length > 0

  return (
    <div className="space-y-8">
      {/* R5 2ª leva: a linha "Atualização automática … · última: HH:MM" saiu
          (decisão do Carlos — metadado de mecânica, não de mineração; o
          polling continua o mesmo por baixo) */}
      <header>
        <h1 className="text-data-md font-semibold tracking-tight">Network Pulse</h1>
        <p className="mt-1 text-body text-mist-400">
          Near-real-time health of the Zephyr network, straight from public APIs.
        </p>
      </header>

      {noDataAtAll ? (
        <ErrorNotice
          variant="blocking"
          title="No data source has responded yet — retrying automatically."
          detail={`Failed sources: ${failingSources.join(', ')}.`}
        />
      ) : (
        failingSources.length > 0 && (
          <ErrorNotice detail={`Failed sources: ${failingSources.join(', ')}.`} />
        )
      )}

      {/* Região dominante: o pulso (hashrate) + rail quieto com o resto */}
      <section className="lg:grid lg:grid-cols-[minmax(0,1fr)_19rem] lg:gap-10 xl:grid-cols-[minmax(0,1fr)_21rem]">
        <div className="min-w-0">
          <p className="font-mono text-caption tracking-wide text-mist-400">
            [ NETWORK HASHRATE ]
          </p>
          {networkInfo.isLoading ? (
            <div className="mt-2">
              <Skeleton className="h-20 w-72" />
            </div>
          ) : (
            <>
              <p className="mt-1 text-headline font-semibold tracking-tighter text-zeph-300">
                {orDash(networkInfo.data?.hash_rate, formatHashrate)}
              </p>

              {/* Tendência coletada localmente (v3): dado real acumulado por
                  este navegador — nenhuma API pública expõe a série. R5 2ª
                  leva: a anotação de dificuldade/bloco sob o hero e a
                  legenda visível da coleta SAÍRAM (decisão do Carlos); a
                  procedência migrou pro title + aria-label do container
                  (role group) — canal não-visual, convenção mantida */}
              <div
                className="mt-10"
                role="group"
                aria-label={NETWORK_TREND_PROVENANCE}
                title={NETWORK_TREND_PROVENANCE}
              >
                <p className="font-mono text-caption tracking-wide text-mist-400">
                  [ TREND ]
                </p>
                <NetworkTrend readings={hashrateHistory} summary={trendSummary} />
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
                ? `moving average: ${formatNumber(liveStats.data.reserve_ratio_ma, 2, 2)} · target range: 4.0–8.0`
                : 'protocol target range: 4.0–8.0'
            }
            delta={deltaVsYesterday(
              liveStats.data?.reserve_ratio,
              yesterday?.data.reserve_ratio_close,
            )}
            badge={reserveRatioBadge(liveStats.data?.reserve_ratio)}
            isLoading={liveStats.isLoading}
          />
          <StatCard
            label="ZEPH price"
            value={orDash(liveStats.data?.zeph_price, formatUsd)}
            delta={deltaVsYesterday(liveStats.data?.zeph_price, yesterday?.data.zeph_price_close)}
            isLoading={liveStats.isLoading}
          />
          <StatCard
            label="Miner reward"
            value={orDash(blockReward.data?.miner_reward, (v) => formatZeph(v))}
            sub={
              blockReward.data?.base_reward_atoms
                ? `base reward: ${formatZeph(Number(blockReward.data.base_reward_atoms) / 1e12)} · 65/30/5 split`
                : `65% miner / 30% reserve / 5% yield ${DASH} awaiting data`
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
