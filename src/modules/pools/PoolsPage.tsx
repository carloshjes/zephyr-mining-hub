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
          <h1 className="text-data-md font-semibold tracking-tight">Bússola de Pools</h1>
          <p className="mt-1 text-body text-mist-400">
            Comparador das pools ZEPH ativas — clique num cabeçalho pra ordenar.
          </p>
        </div>
        <p className="font-mono text-caption text-mist-400">
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

      <div className="scrollbar-themed overflow-x-auto border-y border-hairline">
        <table className="w-full min-w-[920px] text-body">
          <caption className="sr-only">
            Comparação das pools de mineração de Zephyr: fee, hashrate, mineradores, pagamento
            mínimo, luck e altura de bloco reportada
          </caption>
          <thead>
            <tr className="border-b border-hairline font-mono text-caption">
              <SortableHeader label="Pool" sortKey="name" sort={sort} onSort={handleSort} align="left" />
              <SortableHeader label="Fee" sortKey="fee" sort={sort} onSort={handleSort} />
              <SortableHeader label="Hashrate" sortKey="hashrate" sort={sort} onSort={handleSort} />
              <SortableHeader label="Mineradores" sortKey="miners" sort={sort} onSort={handleSort} />
              <SortableHeader label="Pagto. mínimo" sortKey="minPayout" sort={sort} onSort={handleSort} />
              <SortableHeader label="Luck" sortKey="luck" sort={sort} onSort={handleSort} />
              <th scope="col" className="px-3 py-2.5 text-left font-medium text-mist-400">
                Tendência do luck
              </th>
              <SortableHeader label="Altura" sortKey="height" sort={sort} onSort={handleSort} />
            </tr>
          </thead>
          <tbody className="divide-y divide-hairline">
            {rows.map(({ def, snapshot, errorMessage }) => {
              const isTopHashrate = def.id === topHashrateId
              const isLowestFee = def.id === lowestFeeId
              return (
                <tr key={def.id} className={isTopHashrate ? 'bg-zeph-800/20' : ''}>
                  {/* Nome numa linha; chips (quando houver) empilhados em
                      coluna logo abaixo, alinhados à esquerda. O flex-wrap
                      horizontal do R3 quebrava desalinhado quando a MESMA
                      pool ganhava os dois chips (caso real: HeroMiners com
                      maior hashrate E menor fee) — visto em produção. */}
                  <td className="px-3 py-3">
                    <div className="flex flex-col items-start gap-1.5">
                      <a
                        href={def.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium text-mist-100 underline decoration-hairline underline-offset-4 hover:decoration-zeph-300"
                      >
                        {def.name}
                      </a>
                      {isTopHashrate && highlightChip('maior hashrate')}
                      {isLowestFee && highlightChip('menor fee')}
                    </div>
                  </td>

                  {def.kind === 'unavailable' ? (
                    // Pool conhecida mas ainda sem integração viável do navegador
                    // (CORS/API) — motivo visível, detalhe nos TODOs de pools.ts
                    <td colSpan={7} className="px-3 py-3 text-label text-mist-400">
                      sem integração — {def.reason}
                    </td>
                  ) : poll.isLoading ? (
                    <td colSpan={7} className="px-3 py-3">
                      <Skeleton className="h-5 w-full max-w-md" />
                    </td>
                  ) : errorMessage !== undefined ? (
                    // Falha só desta pool: a linha avisa e as demais seguem de pé
                    <td colSpan={7} className="px-3 py-3 text-label text-bad" title={errorMessage}>
                      <span aria-hidden className="mr-1 font-mono text-caption">[ ! ]</span>
                      indisponível agora — tentando de novo automaticamente
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

      <div className="space-y-1 text-label text-mist-400">
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
