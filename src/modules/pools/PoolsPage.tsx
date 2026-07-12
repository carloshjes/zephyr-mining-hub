import { useEffect, useMemo, useState } from 'react'
import { usePolling } from '../../hooks/usePolling'
import {
  fetchAllPoolSnapshots,
  POOLS,
  type PoolDefinition,
  type PoolSnapshot,
} from '../../lib/api/pools'
import {
  DISPLAY_LOCALE,
  formatHashrate,
  formatInteger,
  formatNumber,
  formatZeph,
  orDash,
} from '../../lib/format'
import { POOL_POLL_INTERVAL_MS } from '../../lib/poolPolling'
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
// A cadência compartilhada ainda dá um histórico de luck útil (20 leituras
// ≈ 20 min de tendência).

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
    return aValue.localeCompare(bValue, DISPLAY_LOCALE) * direction
  }
  return (Number(aValue) - Number(bValue)) * direction
}

// Destaque na convenção da direção: rótulo mono entre colchetes, sem pill.
// Decisão v2 (documentada em NOTES.md): os chips seguem na família zeph, NÃO
// em verde — verde é voz de ESTADO (saudável/normal); "maior hashrate"/
// "menor fee" é ranking comparativo, e pintar ranking de verde diluiria a
// semântica binária good/bad (além de brigar com o laranja de "indisponível"
// na mesma tabela).
// v3: o "mais vivo" pedido em uso real veio por PESO, não por matiz novo —
// fundo sólido zeph-300 com texto ink-950 (7,1:1 medido), cantos retos.
function highlightChip(text: string) {
  return (
    <span className="bg-zeph-300 px-1.5 py-0.5 font-mono text-caption whitespace-nowrap text-ink-950">
      [ {text} ]
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
        className={`inline-flex w-full items-center gap-1 transition-colors ${
          isActive ? 'text-zeph-300' : 'text-mist-400 hover:text-mist-100'
        } ${align === 'right' ? 'justify-end text-right' : 'justify-start text-left'}`}
      >
        {label}
        <span aria-hidden className={`text-caption ${isActive ? 'text-zeph-300' : 'text-mist-600'}`}>
          {isActive ? (sort.dir === 'asc' ? '▲' : '▼') : '↕'}
        </span>
      </button>
    </th>
  )
}

export function PoolsPage() {
  const poll = usePolling(fetchAllPoolSnapshots, POOL_POLL_INTERVAL_MS)
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
      {/* R5 2ª leva: a linha "Atualização automática … · última: HH:MM" saiu
          (decisão do Carlos — o polling continua o mesmo por baixo) */}
      <header>
        <h1 className="text-data-md font-semibold tracking-tight">Pool Compass</h1>
        <p className="mt-1 text-body text-mist-400">
          Compare active ZEPH pools — click a column header to sort.
        </p>
      </header>

      {allIntegratedDown && (
        <ErrorNotice
          variant="blocking"
          title="No pool is responding right now — retrying automatically."
          detail="The rows below show the current status of each pool."
        />
      )}

      <div className="scrollbar-themed overflow-x-auto border-y border-hairline">
        <table className="w-full min-w-[920px] text-body">
          <caption className="sr-only">
            Comparison of Zephyr mining pools: fee, hashrate, miners, minimum payout, luck,
            luck trend, and reported block height
          </caption>
          <thead>
            <tr className="border-b border-hairline font-mono text-caption">
              <SortableHeader label="Pool" sortKey="name" sort={sort} onSort={handleSort} align="left" />
              <SortableHeader label="Fee" sortKey="fee" sort={sort} onSort={handleSort} />
              <SortableHeader label="Hashrate" sortKey="hashrate" sort={sort} onSort={handleSort} />
              <SortableHeader label="Miners" sortKey="miners" sort={sort} onSort={handleSort} />
              <SortableHeader label="Min. payout" sortKey="minPayout" sort={sort} onSort={handleSort} />
              <SortableHeader label="Luck" sortKey="luck" sort={sort} onSort={handleSort} />
              <th scope="col" className="px-3 py-2.5 text-left font-medium text-mist-400">
                Luck trend
              </th>
              <SortableHeader label="Height" sortKey="height" sort={sort} onSort={handleSort} />
            </tr>
          </thead>
          <tbody className="divide-y divide-hairline">
            {rows.map(({ def, snapshot, errorMessage }) => {
              const isTopHashrate = def.id === topHashrateId
              const isLowestFee = def.id === lowestFeeId
              return (
                <tr key={def.id} className={isTopHashrate ? 'bg-zeph-800/20' : ''}>
                  {/* Chips numa COLUNA À DIREITA do nome (R5, screenshot do
                      Carlos): o 1º chip fica na mesma linha do nome, o 2º
                      abaixo do 1º. O empilhado do R4 (tudo abaixo do nome)
                      corrigia o desalinhamento do flex-wrap do R3, mas com
                      os dois chips a linha ficava alta demais em uso real
                      (caso de hoje: HeroMiners com maior hashrate E menor
                      fee). Com um chip só, ele fica ao lado do nome. */}
                  <td className="px-3 py-3">
                    <div className="flex items-start gap-2">
                      <a
                        href={def.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium text-mist-100 underline decoration-hairline underline-offset-4 hover:decoration-zeph-300"
                      >
                        {def.name}
                      </a>
                      {(isTopHashrate || isLowestFee) && (
                        <span className="flex flex-col items-start gap-1 pt-0.5">
                          {isTopHashrate && highlightChip('highest hashrate')}
                          {isLowestFee && highlightChip('lowest fee')}
                        </span>
                      )}
                    </div>
                  </td>

                  {def.kind === 'unavailable' ? (
                    // Pool conhecida mas ainda sem integração viável do navegador
                    // (CORS/API) — motivo visível, detalhe nos TODOs de pools.ts
                    <td colSpan={7} className="px-3 py-3 text-label text-mist-400">
                      not integrated — {def.reason}
                    </td>
                  ) : poll.isLoading ? (
                    <td colSpan={7} className="px-3 py-3">
                      <Skeleton className="h-5 w-full max-w-md" />
                    </td>
                  ) : errorMessage !== undefined ? (
                    // Falha só desta pool: a linha avisa e as demais seguem de pé
                    <td colSpan={7} className="px-3 py-3 text-label text-bad" title={errorMessage}>
                      <span aria-hidden className="mr-1 font-mono text-caption">[ ! ]</span>
                      currently unavailable — retrying automatically
                    </td>
                  ) : (
                    <>
                      <td className="px-3 py-3 text-right font-mono text-label">
                        {orDash(snapshot?.fee, (value) => `${formatNumber(value, 2)}%`)}
                      </td>
                      <td className="px-3 py-3 text-right font-mono text-label">
                        {orDash(snapshot?.hashrate, formatHashrate)}
                      </td>
                      <td className="px-3 py-3 text-right font-mono text-label">
                        {orDash(snapshot?.miners, formatInteger)}
                        {snapshot?.workers !== undefined && (
                          // nowrap: a linha secundária competia por largura
                          // com as outras colunas e quebrava "1.234\nworkers"
                          <span className="block text-caption whitespace-nowrap text-mist-400">
                            {formatInteger(snapshot.workers)} workers
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-right font-mono text-label">
                        {orDash(snapshot?.minPayout, (value) => formatZeph(value, 2))}
                      </td>
                      <td
                        className="px-3 py-3 text-right font-mono text-label"
                        title={def.kind === 'integrated' ? def.luckNote : undefined}
                      >
                        {orDash(snapshot?.luck, (value) => `${formatNumber(value, 1)}%`)}
                      </td>
                      <td className="px-3 py-3">
                        <LuckSparkline readings={luckHistory[def.id] ?? []} poolName={def.name} />
                      </td>
                      <td className="px-3 py-3 text-right font-mono text-label">
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

      {/* R5 2ª leva: os parágrafos soltos do rodapé viraram UM bloco
          agrupado — mesma informação, menos fragmentos (decisão do Carlos).
          N4: o max-w-3xl saiu — o parágrafo era mais estreito que a tabela e
          sobrava faixa vazia à direita no desktop; agora acompanha a largura
          da coluna (a mesma que a <table> w-full ocupa no mesmo breakpoint). */}
      <p className="text-label leading-relaxed text-mist-400">
        Luck/effort: 100% is neutral; below 100% means the pool found blocks with less work than
        statistically expected. Measurement windows vary by pool (hover over a value to see its
        source), so compare the trend — not exact values across pools. Trends include the latest{' '}
        {LUCK_HISTORY_LIMIT} readings collected by this browser, one per minute while the page is
        open; the thin line marks 100%. “—” means the pool API does not expose that field. Fees and
        payout thresholds can change; confirm them on the pool website.
      </p>
    </div>
  )
}
