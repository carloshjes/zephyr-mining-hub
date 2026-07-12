import { useCallback, useEffect, useMemo, useState } from 'react'
import { usePolling } from '../../hooks/usePolling'
import { useDataPulse } from '../../hooks/useDataPulse'
import { useElementWidth } from '../../hooks/useElementWidth'
import { getMinerPool, MinerNotFoundError, type MinerSnapshot } from '../../lib/api/minerStats'
import { fetchXmrigSummary, type XmrigSummary } from '../../lib/api/xmrig'
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
  formatZeph,
  orDash,
} from '../../lib/format'
import type { RigConfig } from './rigConfig'
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
    label: 'Minerando normal',
    className: 'text-good',
    dot: 'bg-good',
  },
  below: {
    label: 'Hashrate abaixo do esperado',
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
  'Tendência de 24 h do hashrate da carteira na pool, coletada neste ' +
  'navegador com a página aberta — 1 leitura a cada ~5 min, até 288; ' +
  'nenhuma pool integrada expõe série histórica pública.'

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
        <caption className="sr-only">Workers desta carteira na pool</caption>
        <thead>
          <tr className="border-b border-hairline font-mono text-caption text-mist-400">
            <th scope="col" className="px-3 py-2.5 text-left font-medium">Worker</th>
            <th scope="col" className="px-3 py-2.5 text-right font-medium">Hashrate</th>
            <th scope="col" className="px-3 py-2.5 text-right font-medium">Shares válidas</th>
            <th scope="col" className="px-3 py-2.5 text-right font-medium">Inválidas</th>
            <th scope="col" className="px-3 py-2.5 text-right font-medium">Último sinal</th>
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
      if (!pool) throw new Error(`Pool desconhecida: ${config.poolId}`)
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
      `Tendência de 24 h do hashrate desta carteira na pool: ${values.length} leituras, ` +
      `atual ${formatHashrate(values[values.length - 1])}, mínima ${formatHashrate(Math.min(...values))}, ` +
      `máxima ${formatHashrate(Math.max(...values))}`
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
    `fonte: ${statusSource === 'xmrig' ? 'XMRig local (tempo real)' : `hashrate na ${pool?.name ?? 'pool'}`}`,
    reference !== undefined
      ? `média das últimas ${histories[statusSource].length} leituras: ${formatHashrate(reference)}`
      : 'coletando leituras de referência',
  ]
    .filter((part) => part !== undefined)
    .join(' · ')

  const notFound = poolPoll.error instanceof MinerNotFoundError

  return (
    <div className="space-y-8">
      {/* Falhas sempre visíveis, em largura cheia, acima da composição */}
      {notFound && poolPoll.data === undefined ? (
        <ErrorNotice
          variant="blocking"
          title="Endereço ainda não visto nesta pool."
          detail={`${poolPoll.error?.message} A busca continua automática — assim que a pool registrar o primeiro share, os dados aparecem aqui.`}
        />
      ) : poolPoll.error !== undefined && poolPoll.data === undefined ? (
        <ErrorNotice
          variant="blocking"
          title={`Sem resposta da ${pool?.name ?? 'pool'} no momento — tentando de novo automaticamente.`}
          detail={poolPoll.error.message}
        />
      ) : (
        poolPoll.error !== undefined && <ErrorNotice detail={poolPoll.error.message} />
      )}

      {/* ------- região dominante: o sinal do rig + rail com a pool ------- */}
      <section className="lg:grid lg:grid-cols-[minmax(0,1fr)_18rem] lg:gap-10 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0">
          <p className="font-mono text-caption tracking-wide text-mist-400">[ SINAL DO RIG ]</p>
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
              Na pool{' '}
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
              label="Hashrate na pool"
              value={orDash(poolPoll.data?.currentHashrate, formatHashrate)}
              sub={
                poolPoll.data?.averageHashrate !== undefined
                  ? `média longa: ${formatHashrate(poolPoll.data.averageHashrate)} · ${pool?.hashrateNote ?? ''}`
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
                  ? 'online / total registrados na pool'
                  : 'workers vistos pela pool'
              }
              isLoading={poolPoll.isLoading}
            />
            <StatCard
              label="Shares da rodada"
              value={orDash(poolPoll.data?.sharesValid, formatInteger)}
              sub={[
                poolPoll.data?.sharesInvalid !== undefined
                  ? `inválidas: ${formatInteger(poolPoll.data.sharesInvalid)}`
                  : undefined,
                poolPoll.data?.lastShareAt !== undefined
                  ? `último share: ${formatAgo(poolPoll.data.lastShareAt)}`
                  : undefined,
              ]
                .filter((part) => part !== undefined)
                .join(' · ') || undefined}
              isLoading={poolPoll.isLoading}
            />
            <StatCard
              label="Saldo pendente"
              value={orDash(poolPoll.data?.pendingBalance, (value) => formatZeph(value, 4))}
              sub={
                poolPoll.data?.totalPaid !== undefined
                  ? `pago no total: ${formatZeph(poolPoll.data.totalPaid, 2)}`
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
            [ TENDÊNCIA 24 H ]
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
            <h2 className="text-lede font-medium text-mist-100">XMRig local</h2>
            <p className="font-mono text-caption text-mist-400">
              http://{xmrigAddress} · a cada {XMRIG_POLL_MS / 1_000} s
            </p>
          </header>

          {xmrig !== undefined ? (
            <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
              <StatCard
                label="Hashrate local (60 s)"
                value={orDash(xmrig.hashrate60s ?? xmrig.hashrate10s, formatHashrate)}
                sub={[
                  xmrig.hashrate10s !== undefined ? `10 s: ${formatHashrate(xmrig.hashrate10s)}` : undefined,
                  xmrig.hashrate15m !== undefined ? `15 min: ${formatHashrate(xmrig.hashrate15m)}` : undefined,
                ]
                  .filter((part) => part !== undefined)
                  .join(' · ') || undefined}
              />
              <StatCard
                label="Shares aceitas"
                value={orDash(xmrig.sharesGood, formatInteger)}
                sub={
                  xmrig.sharesTotal !== undefined && xmrig.sharesGood !== undefined
                    ? `rejeitadas: ${formatInteger(xmrig.sharesTotal - xmrig.sharesGood)} de ${formatInteger(xmrig.sharesTotal)} enviadas`
                    : undefined
                }
              />
              <StatCard
                label="Uptime do XMRig"
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
                [ SEM SINAL LOCAL ]
              </span>
              XMRig local não alcançável em http://{xmrigAddress} — mostrando só os dados da pool.
              <span className="mt-1 block text-label text-mist-400">
                Confira se o XMRig está rodando com <code className="font-mono">--http-enabled --http-port {xmrigAddress.split(':')[1] ?? ''}</code>{' '}
                nesta máquina. Alguns navegadores (Safari, por exemplo) bloqueiam página https
                acessando serviço local em http.
              </span>
            </div>
          )}
        </section>
      )}
    </div>
  )
}
