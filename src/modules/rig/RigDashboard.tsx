import { useCallback, useEffect, useMemo, useState } from 'react'
import { usePolling } from '../../hooks/usePolling'
import { useDataPulse } from '../../hooks/useDataPulse'
import { useElementWidth } from '../../hooks/useElementWidth'
import { getMinerPool, MinerNotFoundError, type MinerSnapshot } from '../../lib/api/minerStats'
import { fetchXmrigSummary, type XmrigSummary } from '../../lib/api/xmrig'
import {
  getLatestBlockReward,
  getLiveStats,
  SCANNER_CACHE_SECONDS,
} from '../../lib/api/zephyrScanner'
import { getNetworkInfo } from '../../lib/api/zephyrExplorer'
import { ErrorNotice } from '../../components/ui/ErrorNotice'
import { Skeleton } from '../../components/ui/Skeleton'
import { StatCard } from '../../components/ui/StatCard'
import { TrendSparkline } from '../../components/ui/TrendSparkline'
import {
  formatAgo,
  formatDuration,
  formatHashrate,
  formatInteger,
  formatTime,
  formatUsd,
  formatZeph,
  orDash,
} from '../../lib/format'
import type { RigConfig } from './rigConfig'
import { estimateDailyEarnings } from './earnings'
import {
  appendDailyHashrateReading,
  appendHashrateReading,
  computeRigStatus,
  historyKey,
  loadDailyHashrateHistory,
  loadHashrateHistory,
  referenceAverage,
  type HashrateReading,
  type RigStatusKind,
} from './rigStatus'

// Dashboard do rig configurado. O componente é REMONTADO (via key no pai)
// quando a config muda — garante polling zerado pra nova carteira/pool.
//
// Composição (direção "Sinal Técnico"): o hashrate do SINAL (a métrica que
// alimenta o estado minerando/abaixo/offline) é a região dominante; as
// demais métricas da pool encolhem pra um rail hairline ao lado — acabou o
// card farm de 4 caixas iguais.

// APIs de pool têm cache de ~30 s; 60 s é o mesmo passo da Bússola de Pools
const POOL_POLL_MS = 60_000
// XMRig é local (sem rede) — 5 s dá sensação de tempo real sem custo
const XMRIG_POLL_MS = 5_000
// Ganho estimado: mesmas 3 fontes e mesmo passo do Pulso da Rede (cache de
// 30 s do Scanner — a constante importada, nunca 30000 solto)
const EARNINGS_POLL_MS = SCANNER_CACHE_SECONDS * 1_000

interface RigDashboardProps {
  config: RigConfig
}

// Estado binário da direção v2: positivo=verde (good), negativo=laranja
// (bad) — o vermelho saiu do sistema. "Abaixo" e "offline" são AMBOS
// negativos: quem os distingue é o TEXTO e o peso, nunca só a cor
// (daltonismo).
//
// Redesenho 2026-07-11 (uso real): na região DOMINANTE, colado no hero, o
// estado NORMAL rendia como "chip fechado" (borda + tint + padding) — um
// card destoando do vocabulário readout/mono que resolve estado no resto do
// sistema (selos do Pulso da Rede, tags [ ... ] dos workers). O saudável — o
// estado de 99% do tempo — agora é a linha mais QUIETA da região: ponto com
// halo + rótulo mono em good, sem caixa nenhuma.
//
// R5 (adendo — desvio DELIBERADO da escada do R4, registrado em NOTES.md):
// o "abaixo do esperado" perdeu a caixa tintada (bad/20 contornada) e usa a
// MESMA anatomia de readout nu do normal — ponto + rótulo mono, mudando SÓ
// a cor (bad no lugar de good, 6,6:1 direto no fundo) e o texto. O canal
// não-cor entre normal e below agora é o TEXTO POR EXTENSO (e o halo, que
// segue exclusivo do normal); a SUPERFÍCIE fica reservada pro pior estado:
// offline segue caixa sólida bad — peso distingue. Nenhum degrau é só-cor.
const STATUS_PRESENTATION: Record<
  RigStatusKind,
  { label: string; className: string; dot: string }
> = {
  normal: {
    label: 'Mining normally',
    className: 'text-good',
    dot: 'bg-good',
  },
  below: {
    label: 'Hashrate below expected',
    className: 'text-bad',
    dot: 'bg-bad',
  },
  offline: {
    label: 'Offline',
    className: 'border border-bad bg-bad px-3 py-1 font-semibold text-ink-950',
    dot: 'bg-ink-950',
  },
}

function StatusBadge({ status, detail }: { status: RigStatusKind; detail: string }) {
  const { label, className, dot } = STATUS_PRESENTATION[status]
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <span
        data-testid="rig-status"
        data-status={status}
        className={`inline-flex items-center gap-2 font-mono text-body ${className}`}
      >
        {/* Halo "ao vivo" SÓ no estado saudável (v3): anel que expande e
            esvai atrás do ponto. Com reduced-motion o fantasma SOME
            (motion-reduce:hidden) — parado ele seria um disco estático. */}
        <span aria-hidden className="relative flex h-2 w-2">
          {status === 'normal' && (
            <span className="absolute inset-0 animate-status-ping rounded-full bg-good motion-reduce:hidden" />
          )}
          <span className={`relative h-2 w-2 rounded-full ${dot}`} />
        </span>
        [ {label} ]
      </span>
      <span className="font-mono text-caption text-mist-400">{detail}</span>
    </div>
  )
}

// Procedência da tendência (R5 2ª leva): saiu do texto visível (rótulo e
// legenda) e virou canal não-visual — title (tooltip) + aria-label no
// container do instrumento. A convenção do projeto segue de pé: a UI
// declara a procedência, só mudou o canal.
const DAILY_TREND_PROVENANCE =
  '24-hour pool hashrate trend for this wallet, collected by this ' +
  'browser while the page is open — one reading about every 5 minutes, up to 288; ' +
  'no integrated pool exposes a public historical series.'

// Tendência de 24 h em componente próprio: o useElementWidth ata o
// ResizeObserver no mount, e este bloco nasce dentro do branch pós-loading —
// medir no pai deixaria o observer preso num ref nulo (mesma razão do
// NetworkTrend do Pulso da Rede e do RewardSplitChart ser filho).
//
// R5 — as barras viraram o ÚNICO instrumento de tendência da tela (a faixa
// do saldo pendente saiu, ver seção do gráfico) e cresceram pro papel:
// largura MEDIDA do container no lugar do 340 fixo. 2ª leva: o instrumento
// DESCEU do hero pra cima da tabela de workers (largura cheia) e a altura
// subiu de novo, 96 → 128 (calibrada por captura, NOTES.md) — segue textura,
// não vira segunda região dominante (rubrica re-conferida).
// Tratamento (skill creative-ui-director, decisão em NOTES.md): barras na
// cor de gráfico zeph-500 com corrente/hover em zeph-300 (no próprio
// TrendSparkline), hover-scrub com hora + valor em caption mono, e pulso de
// dado novo quando o motor diário anexa leitura (useDataPulse na timestamp
// da última — SEMPRE em par com motion-reduce:animate-none).
function DailyTrend({ history, summary }: { history: HashrateReading[]; summary: string }) {
  const [trendRef, trendWidth] = useElementWidth<HTMLDivElement>()
  const fresh = useDataPulse(history.length > 0 ? history[history.length - 1].t : undefined)
  return (
    <div
      ref={trendRef}
      className={`mt-3 ${history.length >= 2 ? 'h-32' : ''}${
        fresh ? ' animate-data-pulse motion-reduce:animate-none' : ''
      }`}
    >
      {trendWidth > 0 && (
        <TrendSparkline
          values={history.map((reading) => reading.h)}
          summary={summary}
          width={trendWidth}
          height={128}
          variant="bars"
          formatReading={(index) =>
            `${formatTime(new Date(history[index].t))} · ${formatHashrate(history[index].h)}`
          }
        />
      )}
    </div>
  )
}

function WorkersTable({ snapshot }: { snapshot: MinerSnapshot }) {
  if (snapshot.workers.length === 0) return null
  return (
    <div className="scrollbar-themed overflow-x-auto border-y border-hairline">
      <table className="w-full min-w-[560px] text-body">
        <caption className="sr-only">Workers for this wallet at the pool</caption>
        <thead>
          <tr className="border-b border-hairline font-mono text-caption text-mist-400">
            <th scope="col" className="px-3 py-2.5 text-left font-medium">Worker</th>
            <th scope="col" className="px-3 py-2.5 text-right font-medium">Hashrate</th>
            <th scope="col" className="px-3 py-2.5 text-right font-medium">Valid shares</th>
            <th scope="col" className="px-3 py-2.5 text-right font-medium">Invalid</th>
            <th scope="col" className="px-3 py-2.5 text-right font-medium">Last signal</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-hairline font-mono text-label">
          {snapshot.workers.map((worker) => (
            <tr key={worker.name} className={worker.offline ? 'text-mist-400' : ''}>
              <td className="px-3 py-2.5 whitespace-nowrap">
                {worker.name}
                {worker.offline && (
                  <span className="ml-2 text-caption text-bad">[ offline ]</span>
                )}
              </td>
              <td className="px-3 py-2.5 text-right whitespace-nowrap">
                {orDash(worker.hashrate, formatHashrate)}
              </td>
              <td className="px-3 py-2.5 text-right whitespace-nowrap">
                {orDash(worker.sharesValid, formatInteger)}
              </td>
              <td className="px-3 py-2.5 text-right whitespace-nowrap">
                {orDash(worker.sharesInvalid, formatInteger)}
              </td>
              <td className="px-3 py-2.5 text-right whitespace-nowrap">
                {orDash(worker.lastSeenAt, formatAgo)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function RigDashboard({ config }: RigDashboardProps) {
  const pool = getMinerPool(config.poolId)
  const { wallet, xmrigAddress } = config

  const poolFetcher = useCallback(
    (signal: AbortSignal) => {
      if (!pool) throw new Error(`Unknown pool: ${config.poolId}`)
      return pool.fetchMinerStats(wallet, signal)
    },
    [pool, wallet, config.poolId],
  )
  const poolPoll = usePolling<MinerSnapshot>(poolFetcher, POOL_POLL_MS)

  // Sem XMRig configurado o fetcher resolve null — seção nem é renderizada
  const xmrigFetcher = useCallback(
    async (signal: AbortSignal): Promise<XmrigSummary | null> =>
      xmrigAddress ? fetchXmrigSummary(xmrigAddress, signal) : null,
    [xmrigAddress],
  )
  const xmrigPoll = usePolling<XmrigSummary | null>(xmrigFetcher, XMRIG_POLL_MS)
  // "Alcançável" = última tentativa deu certo (erro presente = degradar pra pool)
  const xmrig: XmrigSummary | undefined =
    xmrigPoll.data !== null && xmrigPoll.data !== undefined && xmrigPoll.error === undefined
      ? xmrigPoll.data
      : undefined

  // Ganho estimado — as 3 fontes que o Pulso da Rede já consome (funções
  // module-level: identidade estável, dispensam useCallback). Erro isolado
  // por fonte, no mesmo espírito do par pool/xmrig acima: uma falhando não
  // derruba as outras nem o resto da tela.
  const networkInfoPoll = usePolling(getNetworkInfo, EARNINGS_POLL_MS)
  const blockRewardPoll = usePolling(getLatestBlockReward, EARNINGS_POLL_MS)
  const liveStatsPoll = usePolling(getLiveStats, EARNINGS_POLL_MS)

  // Régua do "esperado": histórico por fonte (pool mede TODOS os workers da
  // carteira; XMRig mede um rig só — média de cada um na sua escala)
  const poolKey = historyKey(config.poolId, wallet, 'pool')
  const xmrigKey = historyKey(config.poolId, wallet, 'xmrig')
  const [histories, setHistories] = useState<Record<'pool' | 'xmrig', HashrateReading[]>>(() => ({
    pool: loadHashrateHistory(poolKey),
    xmrig: loadHashrateHistory(xmrigKey),
  }))

  useEffect(() => {
    const hashrate = poolPoll.data?.currentHashrate
    if (hashrate === undefined) return
    setHistories((prev) => ({ ...prev, pool: appendHashrateReading(poolKey, hashrate) }))
  }, [poolPoll.data, poolKey])

  // Tendência de 24 h (v3): store separado do histórico de status (gap ~5 min,
  // cap 288 = 24 h — parâmetros em rigStatus.ts). SÓ hashrate da pool: o XMRig
  // mede um rig e a carteira pode ter vários — misturar escalas falsearia a curva
  const [dailyHistory, setDailyHistory] = useState<HashrateReading[]>(() =>
    loadDailyHashrateHistory(poolKey),
  )
  useEffect(() => {
    const hashrate = poolPoll.data?.currentHashrate
    if (hashrate === undefined) return
    // O saldo pendente entra na MESMA leitura diária quando a pool o expõe
    // (2Miners expõe; HeroMiners pode vir "—" → leitura só com hashrate)
    setDailyHistory(appendDailyHashrateReading(poolKey, hashrate, poolPoll.data?.pendingBalance))
  }, [poolPoll.data, poolKey])

  // Resumo acessível da tendência (mesma receita do Pulso da Rede; o
  // TrendSparkline mostra "coletando…" com menos de 2 leituras e ignora isto)
  const dailySummary = useMemo(() => {
    const values = dailyHistory.map((reading) => reading.h)
    if (values.length < 2) return ''
    return (
      `24-hour pool hashrate trend for this wallet: ${values.length} readings, ` +
      `current ${formatHashrate(values[values.length - 1])}, minimum ${formatHashrate(Math.min(...values))}, ` +
      `maximum ${formatHashrate(Math.max(...values))}`
    )
  }, [dailyHistory])

  useEffect(() => {
    const hashrate = xmrig?.hashrate60s ?? xmrig?.hashrate10s
    if (hashrate === undefined) return
    setHistories((prev) => ({ ...prev, xmrig: appendHashrateReading(xmrigKey, hashrate) }))
  }, [xmrig, xmrigKey])

  // Fonte do estado: XMRig local quando alcançável (tempo real), senão pool
  const statusSource: 'pool' | 'xmrig' = xmrig !== undefined ? 'xmrig' : 'pool'
  const signalHashrate =
    statusSource === 'xmrig'
      ? (xmrig?.hashrate60s ?? xmrig?.hashrate10s)
      : poolPoll.data?.currentHashrate
  const reference = referenceAverage(histories[statusSource])
  const status = computeRigStatus({
    currentHashrate: signalHashrate,
    referenceAverage: reference,
    lastShareAt: poolPoll.data?.lastShareAt,
  })
  const statusReady = !poolPoll.isLoading || xmrig !== undefined
  const statusDetail = [
    `source: ${statusSource === 'xmrig' ? 'Local XMRig (real-time)' : `pool hashrate at ${pool?.name ?? 'pool'}`}`,
    reference !== undefined
      ? `average of last ${histories[statusSource].length} readings: ${formatHashrate(reference)}`
      : 'collecting baseline readings',
  ]
    .filter((part) => part !== undefined)
    .join(' · ')

  // Ganho estimado (1ª composição cross-module do produto): o signalHashrate
  // deste módulo cruzado com rede/recompensa/preço. Campo de input ausente
  // degrada o campo de SAÍDA pra "—" — nunca número parcial nem zero
  // disfarçado de dado (regras em earnings.ts).
  const earnings = estimateDailyEarnings({
    rigHashrate: signalHashrate,
    networkHashrate: networkInfoPoll.data?.hash_rate,
    minerRewardZeph: blockRewardPoll.data?.miner_reward,
    zephPrice: liveStatsPoll.data?.zeph_price,
  })
  const earningsLoading =
    networkInfoPoll.isLoading || blockRewardPoll.isLoading || liveStatsPoll.isLoading
  // Falha visível por fonte (convenção: erro nunca silencioso), no escopo do
  // bloco — o restante da tela tem seus próprios avisos
  const earningsFailingSources = [
    networkInfoPoll.error && 'Explorer (network hashrate)',
    blockRewardPoll.error && 'Scanner (reward)',
    liveStatsPoll.error && 'Scanner (price)',
  ].filter((source): source is string => Boolean(source))

  const notFound = poolPoll.error instanceof MinerNotFoundError

  return (
    <div className="space-y-8">
      {/* Falhas sempre visíveis, em largura cheia, acima da composição */}
      {notFound && poolPoll.data === undefined ? (
        <ErrorNotice
          variant="blocking"
          title="Wallet address not yet seen at this pool."
          detail={`${poolPoll.error?.message} Automatic checks will continue. Data will appear here as soon as the pool records the first share.`}
        />
      ) : poolPoll.error !== undefined && poolPoll.data === undefined ? (
        <ErrorNotice
          variant="blocking"
          title={`No response from ${pool?.name ?? 'the pool'} right now — retrying automatically.`}
          detail={poolPoll.error.message}
        />
      ) : (
        poolPoll.error !== undefined && <ErrorNotice detail={poolPoll.error.message} />
      )}

      {/* ------- região dominante: o sinal do rig + rail com a pool ------- */}
      <section className="lg:grid lg:grid-cols-[minmax(0,1fr)_18rem] lg:gap-10 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0">
          <p className="font-mono text-caption tracking-wide text-mist-400">[ RIG SIGNAL ]</p>
          {statusReady ? (
            <>
              <p
                className={`mt-1 text-headline font-semibold tracking-tighter ${
                  status === 'offline' ? 'text-bad' : 'text-zeph-300'
                }`}
              >
                {orDash(signalHashrate, formatHashrate)}
              </p>
              <div className="mt-4">
                <StatusBadge status={status} detail={statusDetail} />
              </div>

              {/* Ganho estimado — o vão sob o StatusBadge (as proporções
                  pré-R4, NOTES.md) vira a 1ª composição cross-module do
                  produto. Leitura SECUNDÁRIA: data-lg mono (a mesma régua
                  dos dígitos do HalvingCountdown), nunca competindo com o
                  headline do sinal. Anatomia idêntica ao [ TENDÊNCIA ] do
                  Pulso da Rede: caption mono + mt-10, sem moldura nova. */}
              <div className="mt-10">
                <p className="font-mono text-caption tracking-wide text-mist-400">
                  [ ESTIMATED EARNINGS ]
                </p>
                {earningsLoading ? (
                  <div className="mt-2 space-y-2">
                    <Skeleton className="h-9 w-64" />
                    <Skeleton className="h-5 w-40" />
                  </div>
                ) : (
                  <>
                    <p className="mt-1 font-mono text-data-lg font-medium text-mist-100">
                      {orDash(earnings.zephPerDay, (value) => `${formatZeph(value, 4)}/day`)}
                    </p>
                    <p className="mt-1 text-body text-mist-300">
                      {orDash(earnings.usdPerDay, (value) => `≈ ${formatUsd(value)}`)}{' '}
                      <span className="text-mist-400">per day</span>
                    </p>
                    {earningsFailingSources.length > 0 && (
                      <p className="mt-2 font-mono text-caption text-bad">
                        [ failed source: {earningsFailingSources.join(' · ')} — retrying
                        automatically ]
                      </p>
                    )}
                  </>
                )}
              </div>
            </>
          ) : (
            <div className="mt-2 space-y-4">
              <Skeleton className="h-20 w-72" />
              <Skeleton className="h-7 w-56" />
            </div>
          )}
        </div>

        {/* Rail: as demais métricas da carteira na pool */}
        <aside className="mt-8 lg:mt-0 lg:border-l lg:border-hairline lg:pl-8">
          {/* R5 2ª leva: o "a cada 60 s · HH:MM" saiu (decisão do Carlos —
              o polling continua o mesmo por baixo) */}
          <header className="pb-3">
            <h2 className="text-lede font-medium text-mist-100">
              At{' '}
              <a
                href={pool?.website}
                target="_blank"
                rel="noopener noreferrer"
                className="text-zeph-300 underline decoration-hairline underline-offset-4 hover:decoration-zeph-300"
              >
                {pool?.name}
              </a>
            </h2>
          </header>
          <div className="space-y-4">
            <StatCard
              label="Pool hashrate"
              value={orDash(poolPoll.data?.currentHashrate, formatHashrate)}
              sub={
                poolPoll.data?.averageHashrate !== undefined
                  ? `long-term average: ${formatHashrate(poolPoll.data.averageHashrate)} · ${pool?.hashrateNote ?? ''}`
                  : pool?.hashrateNote
              }
              isLoading={poolPoll.isLoading}
            />
            <StatCard
              label="Workers"
              value={
                poolPoll.data?.workersOnline !== undefined
                  ? `${formatInteger(poolPoll.data.workersOnline)} / ${orDash(poolPoll.data.workersTotal, formatInteger)}`
                  : orDash(poolPoll.data?.workersTotal, formatInteger)
              }
              sub={
                poolPoll.data?.workersOnline !== undefined
                  ? 'online / total reported by the pool'
                  : 'workers reported by the pool'
              }
              isLoading={poolPoll.isLoading}
            />
            <StatCard
              label="Round shares"
              value={orDash(poolPoll.data?.sharesValid, formatInteger)}
              sub={[
                poolPoll.data?.sharesInvalid !== undefined
                  ? `invalid: ${formatInteger(poolPoll.data.sharesInvalid)}`
                  : undefined,
                poolPoll.data?.lastShareAt !== undefined
                  ? `last share: ${formatAgo(poolPoll.data.lastShareAt)}`
                  : undefined,
              ]
                .filter((part) => part !== undefined)
                .join(' · ') || undefined}
              isLoading={poolPoll.isLoading}
            />
            <StatCard
              label="Pending balance"
              value={orDash(poolPoll.data?.pendingBalance, (value) => formatZeph(value, 4))}
              sub={
                poolPoll.data?.totalPaid !== undefined
                  ? `total paid: ${formatZeph(poolPoll.data.totalPaid, 2)}`
                  : undefined
              }
              isLoading={poolPoll.isLoading}
            />
          </div>
        </aside>
      </section>

      {/* Tendência coletada localmente (v3) — mesma receita de instrumento
          do Pulso da Rede: nenhuma pool integrada expõe série de pagamentos
          confirmada ao vivo (sondagem em NOTES.md), então o gráfico do dia
          é o hashrate da carteira na pool, coletado por este navegador —
          dado real, nunca inventado. R4: virou BARRAS. R5: a faixa do saldo
          pendente SAIU (o valor ATUAL segue no rail; o motor diário CONTINUA
          amostrando o b? — ver rigStatus.ts). 2ª leva: o instrumento DESCEU
          de baixo do hero pra cá, logo acima da tabela de workers, em
          largura cheia — e a procedência saiu do rótulo/legenda visíveis
          pro title + aria-label do container (role group), canal
          não-visual, convenção mantida. */}
      {statusReady && (
        <section role="group" aria-label={DAILY_TREND_PROVENANCE} title={DAILY_TREND_PROVENANCE}>
          <p className="font-mono text-caption tracking-wide text-mist-400">
            [ 24H TREND ]
          </p>
          <DailyTrend history={dailyHistory} summary={dailySummary} />
        </section>
      )}

      {/* Workers da carteira — mesmo tratamento hairline/mono da tabela do Raio-X */}
      {poolPoll.data && <WorkersTable snapshot={poolPoll.data} />}

      {/* --------------------------- XMRig local --------------------------- */}
      {xmrigAddress !== undefined && (
        <section className="space-y-4">
          <header className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-lede font-medium text-mist-100">Local XMRig</h2>
            <p className="font-mono text-caption text-mist-400">
              http://{xmrigAddress} · every {XMRIG_POLL_MS / 1_000} s
            </p>
          </header>

          {xmrig !== undefined ? (
            <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
              <StatCard
                label="Local hashrate (60 s)"
                value={orDash(xmrig.hashrate60s ?? xmrig.hashrate10s, formatHashrate)}
                sub={[
                  xmrig.hashrate10s !== undefined ? `10 s: ${formatHashrate(xmrig.hashrate10s)}` : undefined,
                  xmrig.hashrate15m !== undefined ? `15 min: ${formatHashrate(xmrig.hashrate15m)}` : undefined,
                ]
                  .filter((part) => part !== undefined)
                  .join(' · ') || undefined}
              />
              <StatCard
                label="Accepted shares"
                value={orDash(xmrig.sharesGood, formatInteger)}
                sub={
                  xmrig.sharesTotal !== undefined && xmrig.sharesGood !== undefined
                    ? `rejected: ${formatInteger(xmrig.sharesTotal - xmrig.sharesGood)} of ${formatInteger(xmrig.sharesTotal)} submitted`
                    : undefined
                }
              />
              <StatCard
                label="XMRig uptime"
                value={orDash(xmrig.uptimeSeconds, formatDuration)}
                sub={[
                  xmrig.version !== undefined ? `v${xmrig.version}` : undefined,
                  xmrig.workerId !== undefined ? xmrig.workerId : undefined,
                ]
                  .filter((part) => part !== undefined)
                  .join(' · ') || undefined}
              />
            </div>
          ) : xmrigPoll.isLoading ? (
            <Skeleton className="h-24 w-full" />
          ) : (
            // Degradação graciosa: XMRig fora do ar NÃO quebra a tela — os
            // dados da pool acima continuam de pé (requisito do módulo)
            <div className="border-l-2 border-hairline py-1 pl-3 text-body text-mist-300">
              <span aria-hidden className="mr-2 font-mono text-caption text-mist-400">
                [ NO LOCAL SIGNAL ]
              </span>
              Local XMRig is unreachable at http://{xmrigAddress} — showing pool data only.
              <span className="mt-1 block text-label text-mist-400">
                Check that XMRig is running on this machine with{' '}
                <code className="font-mono">--http-enabled --http-port {xmrigAddress.split(':')[1] ?? ''}</code>.
                Some browsers (Safari, for example) block HTTPS pages from accessing local HTTP
                services.
              </span>
            </div>
          )}
        </section>
      )}
    </div>
  )
}
