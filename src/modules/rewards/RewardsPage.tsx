import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { usePolling } from '../../hooks/usePolling'
import {
  getLiveStats,
  getRecentBlockRewards,
  getRecentReserveRatios,
  SCANNER_CACHE_SECONDS,
} from '../../lib/api/zephyrScanner'
import { formatInteger, formatNumber, formatTime, formatZeph, orDash } from '../../lib/format'
import { ErrorNotice } from '../../components/ui/ErrorNotice'
import { Skeleton } from '../../components/ui/Skeleton'
import { REWARD_SERIES, sharePercent, toRewardSlices, type RewardSlices } from './rewardSeries'
import { RewardSplitChart, type SplitUnit } from './RewardSplitChart'
import { ReserveRatioChart, type RatioPoint } from './ReserveRatioChart'

// Raio-X da Recompensa — torna visível a mecânica exclusiva do Zephyr: o
// prêmio de bloco NÃO vai inteiro pro minerador, é fatiado entre minerador,
// reserva e yield. Um bloco novo a cada ~120 s, então 60 s de polling é
// folgado (e respeita o cache de 30 s da Scanner API).
const SERIES_POLL_MS = 60_000
const LIVESTATS_POLL_MS = SCANNER_CACHE_SECONDS * 1_000

const WINDOW_PRESETS = [100, 200, 500, 1000] as const
const DEFAULT_WINDOW = 200

interface RewardsWindow {
  requestedCount: number
  slices: RewardSlices[]
  /** Blocos que a API devolveu sem todas as fatias (ficam fora da série). */
  incompleteCount: number
}

interface RatiosWindow {
  requestedCount: number
  points: RatioPoint[]
}

// Frases fixas (não geradas por load) — escritas pra quem só conhece
// mineração de Monero e nunca ouviu falar de reserve ratio.
const EXPLAINER_SENTENCES = [
  'Além do ZEPH que você minera, a rede Zephyr mantém uma segunda moeda, o ZSD, feita pra valer sempre perto de 1 dólar — e o que garante esse valor é um cofre coletivo cheio de ZEPH.',
  'Por isso o prêmio de cada bloco não vai inteiro pro minerador, como acontece em Monero: uma fatia é depositada automaticamente nesse cofre (a “reserva”) e outra, menor, vira rendimento pra quem deixa dinheiro aplicado no protocolo (o “yield”).',
  'O reserve ratio, no gráfico de baixo, mede quão cheio esse cofre está em relação ao que ele precisa garantir — quanto maior o número, mais folgada a garantia.',
]

interface SegmentedOption<T extends string | number> {
  value: T
  label: string
}

// Controle segmentado dos filtros (janela/escala) — botões com aria-pressed,
// seleção sempre por texto+cor, nunca só cor
function SegmentedControl<T extends string | number>({
  label,
  options,
  value,
  onChange,
}: {
  label: string
  options: readonly SegmentedOption<T>[]
  value: T
  onChange: (next: T) => void
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-slate-500">{label}</span>
      <div className="inline-flex overflow-hidden rounded-lg border border-slate-700">
        {options.map((option, index) => {
          const isActive = option.value === value
          return (
            <button
              key={String(option.value)}
              type="button"
              aria-pressed={isActive}
              onClick={() => onChange(option.value)}
              className={`px-3 py-1.5 text-xs transition-colors ${
                index > 0 ? 'border-l border-slate-700' : ''
              } ${
                isActive
                  ? 'bg-sky-950/60 font-medium text-sky-300'
                  : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
              }`}
            >
              {option.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export function RewardsPage() {
  const [blockCount, setBlockCount] = useState<number>(DEFAULT_WINDOW)
  const [unit, setUnit] = useState<SplitUnit>('zeph')

  const fetchRewardsWindow = useCallback(
    async (signal: AbortSignal): Promise<RewardsWindow> => {
      const blocks = await getRecentBlockRewards(blockCount, signal)
      const slices: RewardSlices[] = []
      let incompleteCount = 0
      for (const block of blocks) {
        const converted = toRewardSlices(block)
        if (converted) slices.push(converted)
        else incompleteCount++
      }
      return { requestedCount: blockCount, slices, incompleteCount }
    },
    [blockCount],
  )

  const fetchRatiosWindow = useCallback(
    async (signal: AbortSignal): Promise<RatiosWindow> => {
      const rows = await getRecentReserveRatios(blockCount, signal)
      const points = rows.flatMap((row) =>
        typeof row.data.reserve_ratio === 'number'
          ? [{ height: row.block_height, ratio: row.data.reserve_ratio }]
          : [],
      )
      return { requestedCount: blockCount, points }
    },
    [blockCount],
  )

  const rewardsPoll = usePolling(fetchRewardsWindow, SERIES_POLL_MS)
  const ratiosPoll = usePolling(fetchRatiosWindow, SERIES_POLL_MS)
  const liveStats = usePolling(getLiveStats, LIVESTATS_POLL_MS)

  // Troca de janela: rebusca na hora, mantendo o desenho anterior esmaecido
  // até o dado novo chegar (sem skeleton, sem pulo de layout)
  const isFirstWindow = useRef(true)
  const refreshRewards = rewardsPoll.refresh
  const refreshRatios = ratiosPoll.refresh
  useEffect(() => {
    if (isFirstWindow.current) {
      isFirstWindow.current = false
      return
    }
    refreshRewards()
    refreshRatios()
  }, [blockCount, refreshRewards, refreshRatios])

  const rewardsData = rewardsPoll.data
  const ratiosData = ratiosPoll.data
  const rewardsOutdated =
    rewardsData !== undefined && rewardsData.requestedCount !== blockCount
  const ratiosOutdated = ratiosData !== undefined && ratiosData.requestedCount !== blockCount

  const slices = rewardsData?.slices ?? []
  const latest = slices.at(-1)

  // Junta o reserve ratio por altura pra tabela (as duas séries podem diferir
  // por 1-2 blocos nas pontas — cada uma ancora a própria janela)
  const ratioByHeight = useMemo(
    () => new Map((ratiosData?.points ?? []).map((point) => [point.height, point.ratio])),
    [ratiosData],
  )

  const governanceIsZero =
    slices.length > 0 && slices.every((block) => block.values.governance === 0)

  const [tableOpen, setTableOpen] = useState(false)

  const failingSources = [
    rewardsPoll.error && 'Scanner API (blockrewards)',
    ratiosPoll.error && 'Scanner API (stats)',
    liveStats.error && 'Scanner API (livestats)',
  ].filter((source): source is string => Boolean(source))

  const noDataAtAll =
    !rewardsData && !ratiosData && !liveStats.data && failingSources.length > 0

  const lastUpdatedAt = Math.max(
    rewardsPoll.lastUpdatedAt ?? 0,
    ratiosPoll.lastUpdatedAt ?? 0,
  )

  const windowHours = (blockCount * 120) / 3_600

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Raio-X da Recompensa</h1>
          <p className="mt-1 text-sm text-slate-400">
            Como o prêmio de cada bloco se divide entre minerador, reserva e yield — e por quê.
          </p>
        </div>
        <p className="text-xs text-slate-500">
          Atualização automática a cada {SERIES_POLL_MS / 1_000} s
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

      {/* Manchete: a divisão do bloco mais recente, em uma frase + barra */}
      <section className="rounded-xl border border-slate-800 bg-slate-900 p-5">
        {rewardsPoll.isLoading ? (
          <Skeleton className="h-16 w-full max-w-2xl" />
        ) : latest ? (
          <>
            <p className="text-lg leading-relaxed text-slate-200">
              Agora, de cada bloco de{' '}
              <strong className="font-semibold text-slate-50">{formatZeph(latest.total, 3)}</strong>,{' '}
              <strong className="font-semibold text-slate-50">
                {formatNumber(sharePercent(latest, 'miner'), 1, 1)}%
              </strong>{' '}
              vai pro minerador,{' '}
              <strong className="font-semibold text-slate-50">
                {formatNumber(sharePercent(latest, 'reserve'), 1, 1)}%
              </strong>{' '}
              pra reserva e{' '}
              <strong className="font-semibold text-slate-50">
                {formatNumber(sharePercent(latest, 'yield'), 1, 1)}%
              </strong>{' '}
              pro yield
              {latest.values.governance > 0 && (
                <>
                  {' '}
                  (e{' '}
                  <strong className="font-semibold text-slate-50">
                    {formatNumber(sharePercent(latest, 'governance'), 1, 1)}%
                  </strong>{' '}
                  pra governança)
                </>
              )}
              .
            </p>
            <div aria-hidden className="mt-4 flex h-3 gap-0.5 overflow-hidden rounded-full">
              {REWARD_SERIES.filter((def) => latest.values[def.key] > 0).map((def) => (
                <div
                  key={def.key}
                  style={{
                    width: `${sharePercent(latest, def.key)}%`,
                    backgroundColor: def.color,
                  }}
                />
              ))}
            </div>
            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs">
              {REWARD_SERIES.map((def) => {
                const isZero = latest.values[def.key] === 0
                return (
                  <span
                    key={def.key}
                    className={`inline-flex items-center gap-1.5 ${isZero ? 'text-slate-600' : 'text-slate-300'}`}
                  >
                    <span
                      aria-hidden
                      className="h-2.5 w-2.5 rounded-sm"
                      style={{ backgroundColor: def.color, opacity: isZero ? 0.35 : 1 }}
                    />
                    {def.label.toLowerCase()} {formatZeph(latest.values[def.key], 3)}
                  </span>
                )
              })}
            </div>
            <p className="mt-3 text-xs text-slate-500">
              Medido no bloco {formatInteger(latest.height)}, o mais recente com dado de
              recompensa na Scanner API.
            </p>
          </>
        ) : (
          <p className="text-sm text-slate-500">Sem dado de recompensa no momento.</p>
        )}
      </section>

      {/* O "porquê" da mecânica — texto fixo, sem jargão de DeFi */}
      <section className="rounded-xl border border-slate-800 bg-slate-900 p-5">
        <h2 className="flex items-center gap-2 text-sm font-medium text-slate-300">
          <span aria-hidden>📖</span>
          Por que o prêmio é fatiado?
        </h2>
        <div className="mt-2 space-y-2 text-sm leading-relaxed text-slate-400">
          {EXPLAINER_SENTENCES.map((sentence) => (
            <p key={sentence.slice(0, 24)}>{sentence}</p>
          ))}
        </div>
      </section>

      {/* Filtros — uma linha só, valendo pros dois gráficos e pra tabela */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
        <SegmentedControl
          label="Janela"
          options={WINDOW_PRESETS.map((preset) => ({
            value: preset,
            label: `${formatInteger(preset)} blocos`,
          }))}
          value={blockCount}
          onChange={setBlockCount}
        />
        <SegmentedControl
          label="Escala"
          options={[
            { value: 'zeph', label: 'ZEPH' },
            { value: 'percent', label: '% do bloco' },
          ]}
          value={unit}
          onChange={setUnit}
        />
        <span className="text-xs text-slate-600">
          ≈ {formatNumber(windowHours, 1)} h de rede (um bloco a cada ~120 s)
        </span>
      </div>

      {/* Gráfico principal: área empilhada das 4 fatias */}
      <section
        className={`rounded-xl border border-slate-800 bg-slate-900 p-5 transition-opacity ${
          rewardsOutdated ? 'opacity-60' : ''
        }`}
      >
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-base font-medium text-slate-200">
            Divisão da recompensa, bloco a bloco
          </h2>
          {rewardsOutdated && <span className="text-xs text-amber-300">atualizando janela…</span>}
        </div>
        <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs">
          {REWARD_SERIES.map((def) => {
            const inactive = governanceIsZero && def.key === 'governance'
            return (
              <span
                key={def.key}
                className={`inline-flex items-center gap-1.5 ${inactive ? 'text-slate-600' : 'text-slate-300'}`}
              >
                <span
                  aria-hidden
                  className="h-2.5 w-2.5 rounded-sm"
                  style={{ backgroundColor: def.color, opacity: inactive ? 0.35 : 1 }}
                />
                {def.label}
                {inactive && ' · 0 na janela'}
              </span>
            )
          })}
        </div>
        <div className="mt-4">
          {rewardsPoll.isLoading ? (
            <Skeleton className="h-72 w-full" />
          ) : slices.length > 0 ? (
            <RewardSplitChart slices={slices} unit={unit} />
          ) : (
            <p className="py-10 text-center text-sm text-slate-500">
              {rewardsPoll.error
                ? 'Sem dado de recompensa no momento — tentando de novo automaticamente.'
                : 'A API não devolveu blocos pra esta janela.'}
            </p>
          )}
        </div>
        {rewardsData !== undefined && rewardsData.incompleteCount > 0 && (
          <p className="mt-2 text-xs text-slate-500">
            {formatInteger(rewardsData.incompleteCount)} bloco(s) vieram sem todas as fatias na
            resposta da API e ficaram fora do gráfico.
          </p>
        )}
      </section>

      {/* Reserve ratio na mesma janela + a ponte honesta entre os dois */}
      <section
        className={`rounded-xl border border-slate-800 bg-slate-900 p-5 transition-opacity ${
          ratiosOutdated ? 'opacity-60' : ''
        }`}
      >
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-base font-medium text-slate-200">Reserve ratio na mesma janela</h2>
          <span className="text-xs text-slate-500">
            agora: {orDash(liveStats.data?.reserve_ratio, (v) => formatNumber(v, 2, 2))} (livestats) ·
            faixa alvo do protocolo: 4,0–8,0
          </span>
        </div>
        <div className="mt-4">
          {ratiosPoll.isLoading ? (
            <Skeleton className="h-48 w-full" />
          ) : (ratiosData?.points.length ?? 0) > 0 ? (
            <ReserveRatioChart points={ratiosData!.points} />
          ) : (
            <p className="py-10 text-center text-sm text-slate-500">
              {ratiosPoll.error
                ? 'Sem série de reserve ratio no momento — tentando de novo automaticamente.'
                : 'A API não devolveu a série de reserve ratio pra esta janela.'}
            </p>
          )}
        </div>
        <p className="mt-3 text-xs leading-relaxed text-slate-500">
          Pelo desenho do protocolo, o tamanho da fatia do minerador está ligado à saúde dessa
          reserva — mas a fórmula exata da divisão não vem nesses dados: o que os gráficos mostram
          é o resultado bloco a bloco. Compare as duas curvas como uma observação, não como
          garantia de que uma determina a outra.
        </p>
      </section>

      {/* Tabela: o par acessível dos dois gráficos, mesmos dados sem cor */}
      {slices.length > 0 && (
        <details
          className="rounded-xl border border-slate-800 bg-slate-900"
          onToggle={(event) => setTableOpen(event.currentTarget.open)}
        >
          <summary className="cursor-pointer px-5 py-3 text-sm text-slate-300 hover:text-slate-100">
            Ver os dados em tabela ({formatInteger(slices.length)} blocos)
          </summary>
          {tableOpen && (
            <div className="max-h-96 overflow-auto border-t border-slate-800">
              <table className="w-full min-w-[760px] text-xs">
                <caption className="sr-only">
                  Divisão da recompensa e reserve ratio por bloco, do mais recente pro mais antigo
                </caption>
                <thead className="sticky top-0 bg-slate-900">
                  <tr className="border-b border-slate-800 text-slate-400">
                    <th scope="col" className="px-3 py-2 text-left font-medium">Bloco</th>
                    <th scope="col" className="px-3 py-2 text-right font-medium">Total (ZEPH)</th>
                    {REWARD_SERIES.map((def) => (
                      <th key={def.key} scope="col" className="px-3 py-2 text-right font-medium">
                        {def.label}
                      </th>
                    ))}
                    <th scope="col" className="px-3 py-2 text-right font-medium">% minerador</th>
                    <th scope="col" className="px-3 py-2 text-right font-medium">Reserve ratio</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70">
                  {slices
                    .slice()
                    .reverse()
                    .map((block) => (
                      <tr key={block.height}>
                        <td className="px-3 py-1.5 tabular-nums">{formatInteger(block.height)}</td>
                        <td className="px-3 py-1.5 text-right tabular-nums">
                          {formatNumber(block.total, 3, 3)}
                        </td>
                        {REWARD_SERIES.map((def) => (
                          <td key={def.key} className="px-3 py-1.5 text-right tabular-nums">
                            {formatNumber(block.values[def.key], 3, 3)}
                          </td>
                        ))}
                        <td className="px-3 py-1.5 text-right tabular-nums">
                          {formatNumber(sharePercent(block, 'miner'), 1, 1)}%
                        </td>
                        <td className="px-3 py-1.5 text-right tabular-nums">
                          {orDash(ratioByHeight.get(block.height), (v) => formatNumber(v, 2, 2))}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </details>
      )}

      <div className="space-y-1 text-xs text-slate-500">
        {governanceIsZero && (
          <p>
            A fatia de governança existe no protocolo, mas está zerada nos blocos da janela — por
            isso ela não aparece como faixa no gráfico.
          </p>
        )}
        <p>
          Fontes: Scanner API (/blockrewards e /stats por bloco, via proxy) e /livestats. Janela
          ancorada na altura atual reportada pelo explorer.
        </p>
      </div>
    </div>
  )
}
