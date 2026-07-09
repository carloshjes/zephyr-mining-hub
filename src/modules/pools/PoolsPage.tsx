import { useEffect, useMemo, useState } from 'react'
import { usePolling } from '../../hooks/usePolling'
import {
  fetchAllPoolSnapshots,
  POOLS,
  type PoolDefinition,
  type PoolSnapshot,
} from '../../lib/api/pools'
import {
  formatHashrate,
  formatInteger,
  formatNumber,
  formatTime,
  formatZeph,
  orDash,
} from '../../lib/format'
import { ErrorNotice } from '../../components/ui/ErrorNotice'
import { Skeleton } from '../../components/ui/Skeleton'
import {
  appendLuckReadings,
  loadLuckHistory,
  LUCK_HISTORY_LIMIT,
  type LuckHistoryMap,
} from './luckHistory'
import { LuckSparkline } from './LuckSparkline'

// Bússola de Pools — comparador das pools ZEPH ativas.
// As APIs de pool têm cache próprio (~30 s); 60 s de polling é folgado e ainda
// dá um histórico de luck útil (20 leituras ≈ 20 min de tendência).
const POLL_INTERVAL_MS = 60_000

type SortKey = 'name' | 'fee' | 'hashrate' | 'miners' | 'minPayout' | 'luck' | 'height'
type SortDir = 'asc' | 'desc'

interface SortState {
  key: SortKey
  dir: SortDir
}

// Direção do primeiro clique por coluna: métricas "menor é melhor" (fee,
// pagamento mínimo, luck) começam ascendentes; volume começa descendente.
const NATURAL_DIR: Record<SortKey, SortDir> = {
  name: 'asc',
  fee: 'asc',
  minPayout: 'asc',
  luck: 'asc',
  hashrate: 'desc',
  miners: 'desc',
  height: 'desc',
}

interface PoolRow {
  def: PoolDefinition
  snapshot?: PoolSnapshot
  errorMessage?: string
}

function sortValue(row: PoolRow, key: SortKey): string | number | undefined {
  if (key === 'name') return row.def.name
  return row.snapshot?.[key]
}

function compareRows(a: PoolRow, b: PoolRow, sort: SortState): number {
  const aValue = sortValue(a, sort.key)
  const bValue = sortValue(b, sort.key)
  // Linha sem valor (API não expõe / pool indisponível) vai sempre pro fim,
  // independente da direção — senão "menor fee" começaria com um monte de "—"
  if (aValue === undefined && bValue === undefined) return 0
  if (aValue === undefined) return 1
  if (bValue === undefined) return -1
  const direction = sort.dir === 'asc' ? 1 : -1
  if (typeof aValue === 'string' && typeof bValue === 'string') {
    return aValue.localeCompare(bValue, 'pt-BR') * direction
  }
  return (Number(aValue) - Number(bValue)) * direction
}

function highlightChip(icon: string, text: string, className: string) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium whitespace-nowrap ${className}`}
    >
      <span aria-hidden>{icon}</span>
      {text}
    </span>
  )
}

interface SortableHeaderProps {
  label: string
  sortKey: SortKey
  sort: SortState
  onSort: (key: SortKey) => void
  align?: 'left' | 'right'
}

function SortableHeader({ label, sortKey, sort, onSort, align = 'right' }: SortableHeaderProps) {
  const isActive = sort.key === sortKey
  return (
    <th
      scope="col"
      aria-sort={isActive ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined}
      className="px-3 py-2.5 font-medium"
    >
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={`inline-flex w-full items-center gap-1 text-slate-400 transition-colors hover:text-slate-200 ${
          align === 'right' ? 'justify-end text-right' : 'justify-start text-left'
        }`}
      >
        {label}
        <span aria-hidden className={`text-[10px] ${isActive ? 'text-sky-400' : 'text-slate-600'}`}>
          {isActive ? (sort.dir === 'asc' ? '▲' : '▼') : '↕'}
        </span>
      </button>
    </th>
  )
}

export function PoolsPage() {
  const poll = usePolling(fetchAllPoolSnapshots, POLL_INTERVAL_MS)
  const [sort, setSort] = useState<SortState>({ key: 'hashrate', dir: 'desc' })
  const [luckHistory, setLuckHistory] = useState<LuckHistoryMap>(() => loadLuckHistory())

  // A cada ciclo bem-sucedido, anexa a leitura de luck de cada pool ao
  // histórico persistido (o próprio appendLuckReadings ignora duplicatas)
  useEffect(() => {
    if (!poll.data) return
    const readings = poll.data.flatMap((result) =>
      result.snapshot?.luck !== undefined
        ? [{ poolId: result.poolId, luck: result.snapshot.luck }]
        : [],
    )
    if (readings.length > 0) setLuckHistory(appendLuckReadings(readings))
  }, [poll.data])

  const handleSort = (key: SortKey) => {
    setSort((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
        : { key, dir: NATURAL_DIR[key] },
    )
  }

  const rows = useMemo<PoolRow[]>(() => {
    const resultById = new Map(poll.data?.map((result) => [result.poolId, result]))
    const merged = POOLS.map((def) => {
      const result = resultById.get(def.id)
      return { def, snapshot: result?.snapshot, errorMessage: result?.errorMessage }
    })
    return merged.sort((a, b) => compareRows(a, b, sort))
  }, [poll.data, sort])

  // Destaques: maior hashrate e menor fee entre as pools que reportam o campo
  const topHashrateId = useMemo(() => {
    const candidates = rows.filter((row) => row.snapshot?.hashrate !== undefined)
    if (candidates.length === 0) return undefined
    return candidates.reduce((best, row) =>
      row.snapshot!.hashrate! > best.snapshot!.hashrate! ? row : best,
    ).def.id
  }, [rows])

  const lowestFeeId = useMemo(() => {
    const candidates = rows.filter((row) => row.snapshot?.fee !== undefined)
    if (candidates.length === 0) return undefined
    return candidates.reduce((best, row) => (row.snapshot!.fee! < best.snapshot!.fee! ? row : best))
      .def.id
  }, [rows])

  const allIntegratedDown =
    poll.data !== undefined && poll.data.every((result) => result.snapshot === undefined)

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Bússola de Pools</h1>
          <p className="mt-1 text-sm text-slate-400">
            Comparador das pools ZEPH ativas — clique num cabeçalho pra ordenar.
          </p>
        </div>
        <p className="text-xs text-slate-500">
          Atualização automática a cada {POLL_INTERVAL_MS / 1_000} s
          {poll.lastUpdatedAt !== undefined &&
            ` · última: ${formatTime(new Date(poll.lastUpdatedAt))}`}
        </p>
      </header>

      {allIntegratedDown && (
        <ErrorNotice
          variant="blocking"
          title="Nenhuma pool respondeu no momento — tentando de novo automaticamente."
          detail="As linhas abaixo mostram o estado individual de cada pool."
        />
      )}

      <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900">
        <table className="w-full min-w-[920px] text-sm">
          <caption className="sr-only">
            Comparação das pools de mineração de Zephyr: fee, hashrate, mineradores, pagamento
            mínimo, luck e altura de bloco reportada
          </caption>
          <thead>
            <tr className="border-b border-slate-800 text-xs">
              <SortableHeader label="Pool" sortKey="name" sort={sort} onSort={handleSort} align="left" />
              <SortableHeader label="Fee" sortKey="fee" sort={sort} onSort={handleSort} />
              <SortableHeader label="Hashrate" sortKey="hashrate" sort={sort} onSort={handleSort} />
              <SortableHeader label="Mineradores" sortKey="miners" sort={sort} onSort={handleSort} />
              <SortableHeader label="Pagto. mínimo" sortKey="minPayout" sort={sort} onSort={handleSort} />
              <SortableHeader label="Luck" sortKey="luck" sort={sort} onSort={handleSort} />
              <th scope="col" className="px-3 py-2.5 text-left text-xs font-medium text-slate-400">
                Tendência do luck
              </th>
              <SortableHeader label="Altura" sortKey="height" sort={sort} onSort={handleSort} />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/70">
            {rows.map(({ def, snapshot, errorMessage }) => {
              const isTopHashrate = def.id === topHashrateId
              const isLowestFee = def.id === lowestFeeId
              const rowTint = isTopHashrate
                ? 'bg-sky-950/20'
                : isLowestFee
                  ? 'bg-emerald-950/15'
                  : ''
              return (
                <tr key={def.id} className={rowTint}>
                  <td className="px-3 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <a
                        href={def.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium text-slate-100 underline decoration-slate-700 underline-offset-4 hover:decoration-sky-400"
                      >
                        {def.name}
                      </a>
                      {isTopHashrate &&
                        highlightChip('⚡', 'maior hashrate', 'border-sky-800 bg-sky-950/60 text-sky-300')}
                      {isLowestFee &&
                        highlightChip('✓', 'menor fee', 'border-emerald-800 bg-emerald-950/60 text-emerald-300')}
                    </div>
                  </td>

                  {def.kind === 'unavailable' ? (
                    // Pool conhecida mas ainda sem integração viável do navegador
                    // (CORS/API) — motivo visível, detalhe nos TODOs de pools.ts
                    <td colSpan={7} className="px-3 py-3 text-xs text-slate-500">
                      sem integração — {def.reason}
                    </td>
                  ) : poll.isLoading ? (
                    <td colSpan={7} className="px-3 py-3">
                      <Skeleton className="h-5 w-full max-w-md" />
                    </td>
                  ) : errorMessage !== undefined ? (
                    // Falha só desta pool: a linha avisa e as demais seguem de pé
                    <td colSpan={7} className="px-3 py-3 text-xs text-amber-300" title={errorMessage}>
                      <span aria-hidden>⚠️ </span>
                      indisponível agora — tentando de novo automaticamente
                    </td>
                  ) : (
                    <>
                      <td className="px-3 py-3 text-right tabular-nums">
                        {orDash(snapshot?.fee, (value) => `${formatNumber(value, 2)}%`)}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums">
                        {orDash(snapshot?.hashrate, formatHashrate)}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums">
                        {orDash(snapshot?.miners, formatInteger)}
                        {snapshot?.workers !== undefined && (
                          <span className="block text-[11px] text-slate-500">
                            {formatInteger(snapshot.workers)} workers
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums">
                        {orDash(snapshot?.minPayout, (value) => formatZeph(value, 2))}
                      </td>
                      <td
                        className="px-3 py-3 text-right tabular-nums"
                        title={def.kind === 'integrated' ? def.luckNote : undefined}
                      >
                        {orDash(snapshot?.luck, (value) => `${formatNumber(value, 1)}%`)}
                      </td>
                      <td className="px-3 py-3">
                        <LuckSparkline readings={luckHistory[def.id] ?? []} poolName={def.name} />
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums">
                        {orDash(snapshot?.height, formatInteger)}
                      </td>
                    </>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="space-y-1 text-xs text-slate-500">
        <p>
          Luck/effort: 100% = neutro; abaixo de 100% = blocos achados com menos trabalho que o
          esperado. A medição varia por pool (passe o mouse sobre o valor pra ver a fonte) —
          compare a tendência, não o número exato entre pools.
        </p>
        <p>
          Tendência: últimas {LUCK_HISTORY_LIMIT} leituras coletadas por este navegador (1 por
          minuto com a página aberta), guardadas localmente. A linha fina marca os 100%.
        </p>
        <p>“—” = campo que a API da pool não expõe. Fees e pagamentos podem mudar; confirme no site da pool.</p>
      </div>
    </div>
  )
}
