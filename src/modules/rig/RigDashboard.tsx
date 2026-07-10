import { useCallback, useEffect, useState } from 'react'
import { usePolling } from '../../hooks/usePolling'
import { getMinerPool, MinerNotFoundError, type MinerSnapshot } from '../../lib/api/minerStats'
import { fetchXmrigSummary, type XmrigSummary } from '../../lib/api/xmrig'
import { ErrorNotice } from '../../components/ui/ErrorNotice'
import { Skeleton } from '../../components/ui/Skeleton'
import { StatCard } from '../../components/ui/StatCard'
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
  appendHashrateReading,
  computeRigStatus,
  historyKey,
  loadHashrateHistory,
  referenceAverage,
  type HashrateReading,
  type RigStatusKind,
} from './rigStatus'

// Dashboard do rig configurado. O componente é REMONTADO (via key no pai)
// quando a config muda — garante polling zerado pra nova carteira/pool.

// APIs de pool têm cache de ~30 s; 60 s é o mesmo passo da Bússola de Pools
const POOL_POLL_MS = 60_000
// XMRig é local (sem rede) — 5 s dá sensação de tempo real sem custo
const XMRIG_POLL_MS = 5_000

interface RigDashboardProps {
  config: RigConfig
}

const STATUS_PRESENTATION: Record<
  RigStatusKind,
  { label: string; className: string; dot: string }
> = {
  normal: {
    label: 'Minerando normal',
    className: 'border-emerald-800 bg-emerald-950/60 text-emerald-300',
    dot: 'bg-emerald-400',
  },
  below: {
    label: 'Hashrate abaixo do esperado',
    className: 'border-amber-800 bg-amber-950/60 text-amber-300',
    dot: 'bg-amber-400',
  },
  offline: {
    label: 'Offline',
    className: 'border-rose-800 bg-rose-950/60 text-rose-300',
    dot: 'bg-rose-400',
  },
}

function StatusBadge({ status, detail }: { status: RigStatusKind; detail: string }) {
  const { label, className, dot } = STATUS_PRESENTATION[status]
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <span
        data-testid="rig-status"
        data-status={status}
        className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm font-medium ${className}`}
      >
        <span aria-hidden className={`h-2 w-2 rounded-full ${dot}`} />
        {label}
      </span>
      <span className="text-xs text-slate-500">{detail}</span>
    </div>
  )
}

function WorkersTable({ snapshot }: { snapshot: MinerSnapshot }) {
  if (snapshot.workers.length === 0) return null
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900">
      <table className="w-full min-w-[560px] text-sm">
        <caption className="sr-only">Workers desta carteira na pool</caption>
        <thead>
          <tr className="border-b border-slate-800 text-xs text-slate-400">
            <th scope="col" className="px-3 py-2.5 text-left font-medium">Worker</th>
            <th scope="col" className="px-3 py-2.5 text-right font-medium">Hashrate</th>
            <th scope="col" className="px-3 py-2.5 text-right font-medium">Shares válidas</th>
            <th scope="col" className="px-3 py-2.5 text-right font-medium">Inválidas</th>
            <th scope="col" className="px-3 py-2.5 text-right font-medium">Último sinal</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800/70">
          {snapshot.workers.map((worker) => (
            <tr key={worker.name} className={worker.offline ? 'text-slate-500' : ''}>
              <td className="px-3 py-2.5 font-mono text-xs">
                {worker.name}
                {worker.offline && (
                  <span className="ml-2 rounded-full border border-rose-900 bg-rose-950/60 px-2 py-0.5 text-[11px] text-rose-300">
                    offline
                  </span>
                )}
              </td>
              <td className="px-3 py-2.5 text-right tabular-nums">
                {orDash(worker.hashrate, formatHashrate)}
              </td>
              <td className="px-3 py-2.5 text-right tabular-nums">
                {orDash(worker.sharesValid, formatInteger)}
              </td>
              <td className="px-3 py-2.5 text-right tabular-nums">
                {orDash(worker.sharesInvalid, formatInteger)}
              </td>
              <td className="px-3 py-2.5 text-right tabular-nums">
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
    signalHashrate !== undefined ? `atual: ${formatHashrate(signalHashrate)}` : undefined,
    reference !== undefined
      ? `média das últimas ${histories[statusSource].length} leituras: ${formatHashrate(reference)}`
      : 'coletando leituras de referência',
  ]
    .filter((part) => part !== undefined)
    .join(' · ')

  const notFound = poolPoll.error instanceof MinerNotFoundError

  return (
    <div className="space-y-6">
      {statusReady ? (
        <StatusBadge status={status} detail={statusDetail} />
      ) : (
        <Skeleton className="h-7 w-56" />
      )}

      {/* ------------------------------- pool ------------------------------- */}
      <section className="space-y-4">
        <header className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-semibold tracking-tight">
            Na pool{' '}
            <a
              href={pool?.website}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sky-400 underline decoration-slate-700 underline-offset-4 hover:decoration-sky-400"
            >
              {pool?.name}
            </a>
          </h2>
          <p className="text-xs text-slate-500">
            Atualização a cada {POOL_POLL_MS / 1_000} s
            {poolPoll.lastUpdatedAt !== undefined &&
              ` · última: ${formatTime(new Date(poolPoll.lastUpdatedAt))}`}
          </p>
        </header>

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
          <>
            {poolPoll.error !== undefined && (
              <ErrorNotice detail={poolPoll.error.message} />
            )}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
            {poolPoll.data && <WorkersTable snapshot={poolPoll.data} />}
          </>
        )}
      </section>

      {/* --------------------------- XMRig local --------------------------- */}
      {xmrigAddress !== undefined && (
        <section className="space-y-4">
          <header className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-lg font-semibold tracking-tight">XMRig local</h2>
            <p className="text-xs text-slate-500">
              http://{xmrigAddress} · a cada {XMRIG_POLL_MS / 1_000} s
            </p>
          </header>

          {xmrig !== undefined ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
            <div className="rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-slate-400">
              <span aria-hidden>🔌 </span>
              XMRig local não alcançável em http://{xmrigAddress} — mostrando só os dados da pool.
              <span className="mt-1 block text-xs text-slate-500">
                Confira se o XMRig está rodando com <code>--http-enabled --http-port {xmrigAddress.split(':')[1] ?? ''}</code>{' '}
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
