import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { usePolling } from '../../hooks/usePolling'
import { useDataPulse } from '../../hooks/useDataPulse'
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
import { SeriesSwatch } from './SeriesSwatch'
import { RewardSplitChart, type SplitUnit } from './RewardSplitChart'
import {
  ReserveRatioChart,
  TARGET_CEILING,
  TARGET_FLOOR,
  type RatioPoint,
} from './ReserveRatioChart'

// Raio-X da Recompensa — torna visível a mecânica exclusiva do Zephyr: o
// prêmio de bloco NÃO vai inteiro pro minerador, é fatiado entre minerador,
// reserva e yield. Um bloco novo a cada ~120 s, então 60 s de polling é
// folgado (e respeita o cache de 30 s da Scanner API).
//
// Composição (direção "Sinal Técnico"): manchete numérica dominante em
// full-bleed (corta na borda da tela em telas largas, de propósito), gráfico
// de divisão como região principal e um rail secundário mais quieto com o
// reserve ratio + explicação — os dois gráficos conectados por um trilho
// tracejado e o rótulo [ MESMA JANELA DE BLOCOS ] (observação, não fórmula).
//
// v2 (2026-07-10): o painel do ratio virou READOUT com moldura hairline
// sempre visível — nunca mais rende como retângulo vazio (causa raiz do bug
// em NOTES.md: âncoras de janela duplicadas + loading sem moldura); selo de
// saúde binário verde/laranja; pulso sutil quando o polling traz dado novo.
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
  'O reserve ratio, no gráfico desta página, mede quão cheio esse cofre está em relação ao que ele precisa garantir — quanto maior o número, mais folgada a garantia.',
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
      <span className="font-mono text-caption text-mist-400">{label}</span>
      <div className="inline-flex border border-hairline">
        {options.map((option, index) => {
          const isActive = option.value === value
          return (
            <button
              key={String(option.value)}
              type="button"
              aria-pressed={isActive}
              onClick={() => onChange(option.value)}
              className={`px-3 py-1.5 font-mono text-caption transition-colors ${
                index > 0 ? 'border-l border-hairline' : ''
              } ${
                isActive
                  ? 'bg-zeph-800/40 text-zeph-300'
                  : 'text-mist-400 hover:bg-ink-900 hover:text-mist-100'
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

// Selo de saúde do readout do ratio (v2): binário verde/laranja; acima da
// faixa é atípico mas não é alarme — fica neutro. Sem dado, o selo DIZ que
// está esperando: o painel nunca fica mudo (bug do retângulo vazio, NOTES.md)
function RatioHealthTag({ ratio, isLoading }: { ratio: number | undefined; isLoading: boolean }) {
  if (ratio === undefined) {
    return (
      <span className="font-mono text-caption text-mist-400">
        [ {isLoading ? 'AGUARDANDO SÉRIE' : 'SEM DADO'} ]
      </span>
    )
  }
  if (ratio < TARGET_FLOOR) {
    return <span className="font-mono text-caption text-bad">[ ! ABAIXO DO PISO ]</span>
  }
  if (ratio > TARGET_CEILING) {
    return <span className="font-mono text-caption text-mist-300">[ ↑ ACIMA DA FAIXA ]</span>
  }
  return <span className="font-mono text-caption text-good">[ ✓ NA FAIXA ALVO ]</span>
}

// Classe do pulso de "dado novo" — sempre em par com motion-reduce
const pulseClass = (fresh: boolean) =>
  fresh ? ' animate-data-pulse motion-reduce:animate-none' : ''

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

  // Estado do piso: o valor corrente (livestats; na falta dele, o último
  // ponto da série) abaixo de 4,0 aciona o laranja de estado negativo
  const currentRatio = liveStats.data?.reserve_ratio ?? ratiosData?.points.at(-1)?.ratio
  const ratioBelowFloor = currentRatio !== undefined && currentRatio < TARGET_FLOOR

  // Pulso de "dado novo": dispara quando o polling traz bloco/ponto inédito
  // (a primeira chegada fica com o draw-in) — ver useDataPulse
  const rewardsFresh = useDataPulse(latest?.height)
  const ratiosFresh = useDataPulse(ratiosData?.points.at(-1)?.height)
  const ratioNowFresh = useDataPulse(currentRatio)

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-data-md font-semibold tracking-tight">Raio-X da Recompensa</h1>
          <p className="mt-1 text-body text-mist-400">
            Como o prêmio de cada bloco se divide entre minerador, reserva e yield — e por quê.
          </p>
        </div>
        <p className="font-mono text-caption text-mist-400">
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

      {/* Manchete dominante da dobra — full-bleed: em telas largas o rótulo
          gigante corta na borda da tela (recurso de composição, de propósito).
          A frase completa e acessível vem logo abaixo em tamanho de leitura.
          Largura = 100vw − rail da casca (var da AppShell; 0px sem rail, e o
          calc degenera pro antigo w-screen): o main centraliza na COLUNA à
          direita do rail, então w-screen cru desalinharia o wrapper interno e
          enfiaria o começo da faixa embaixo do rail fixo — conta em NOTES.md. */}
      <section className="relative left-1/2 w-[calc(100vw_-_var(--shell-rail-w,0px))] -translate-x-1/2 overflow-x-clip">
        <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
          {rewardsPoll.isLoading ? (
            <Skeleton className="h-32 w-full max-w-2xl" />
          ) : latest ? (
            <>
              <p className="font-mono text-caption tracking-wide text-mist-400">
                [ MEDIDO NO BLOCO {formatInteger(latest.height)} · O MAIS RECENTE COM DADO DE
                RECOMPENSA ]
              </p>
              <p
                aria-hidden
                className={`mt-1 text-display font-semibold tracking-tighter whitespace-nowrap${pulseClass(rewardsFresh)}`}
              >
                <span className="text-zeph-300">
                  {formatNumber(sharePercent(latest, 'miner'), 1, 1)}%
                </span>
                <span className="hidden text-display-sub text-mist-600 md:inline">
                  {' '}
                  pro minerador
                </span>
              </p>
              <p className="mt-4 max-w-3xl text-body leading-relaxed text-mist-300 sm:text-lede">
                Agora, de cada bloco de{' '}
                <strong className="font-semibold text-mist-100">
                  {formatZeph(latest.total, 3)}
                </strong>
                ,{' '}
                <strong className="font-semibold text-mist-100">
                  {formatNumber(sharePercent(latest, 'miner'), 1, 1)}%
                </strong>{' '}
                vai pro minerador,{' '}
                <strong className="font-semibold text-mist-100">
                  {formatNumber(sharePercent(latest, 'reserve'), 1, 1)}%
                </strong>{' '}
                pra reserva e{' '}
                <strong className="font-semibold text-mist-100">
                  {formatNumber(sharePercent(latest, 'yield'), 1, 1)}%
                </strong>{' '}
                pro yield
                {latest.values.governance > 0 && (
                  <>
                    {' '}
                    (e{' '}
                    <strong className="font-semibold text-mist-100">
                      {formatNumber(sharePercent(latest, 'governance'), 1, 1)}%
                    </strong>{' '}
                    pra governança)
                  </>
                )}
                .
              </p>
              {/* Barra de proporção: decorativa e de leitura por ORDEM (fixa,
                  minerador→yield) — a diferenciação por textura fica com a
                  legenda logo abaixo, que carrega os mesmos swatches do chart */}
              <div aria-hidden className="mt-4 flex h-2.5 max-w-3xl gap-0.5 overflow-hidden">
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
              <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-label">
                {REWARD_SERIES.map((def) => {
                  const isZero = latest.values[def.key] === 0
                  return (
                    <span
                      key={def.key}
                      className={`inline-flex items-center gap-1.5 ${
                        isZero ? 'text-mist-400' : 'text-mist-300'
                      }`}
                    >
                      <SeriesSwatch def={def} muted={isZero} />
                      {def.label.toLowerCase()}{' '}
                      <span className="font-mono">{formatZeph(latest.values[def.key], 3)}</span>
                    </span>
                  )
                })}
              </div>
            </>
          ) : (
            <p className="text-body text-mist-400">Sem dado de recompensa no momento.</p>
          )}
        </div>
      </section>

      {/* Região dominante (divisão bloco a bloco) + rail quieto (reserve
          ratio e contexto), conectados pelo trilho tracejado */}
      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_19rem] lg:gap-10 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0 space-y-4">
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
            <span className="font-mono text-caption text-mist-400">
              ≈ {formatNumber(windowHours, 1)} h de rede (um bloco a cada ~120 s)
            </span>
          </div>

          {/* Gráfico principal: área empilhada das 4 fatias */}
          <section className={`transition-opacity ${rewardsOutdated ? 'opacity-60' : ''}`}>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-lede font-medium text-mist-100">
                Divisão da recompensa, bloco a bloco
              </h2>
              {rewardsOutdated ? (
                <span className="font-mono text-caption text-mist-400">[ ATUALIZANDO JANELA… ]</span>
              ) : (
                slices.length > 0 && (
                  <span className="font-mono text-caption text-mist-400">
                    [ BLOCOS {formatInteger(slices[0].height)} – {formatInteger(latest!.height)} ]
                  </span>
                )
              )}
            </div>
            <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-label">
              {REWARD_SERIES.map((def) => {
                const inactive = governanceIsZero && def.key === 'governance'
                return (
                  <span
                    key={def.key}
                    className={`inline-flex items-center gap-1.5 ${
                      inactive ? 'text-mist-400' : 'text-mist-300'
                    }`}
                  >
                    <SeriesSwatch def={def} muted={inactive} />
                    {def.label}
                    {inactive && ' · 0 na janela'}
                  </span>
                )
              })}
            </div>
            <div className={`mt-4${pulseClass(rewardsFresh)}`}>
              {rewardsPoll.isLoading ? (
                <Skeleton className="h-72 w-full" />
              ) : slices.length > 0 ? (
                <RewardSplitChart slices={slices} unit={unit} />
              ) : (
                <p className="py-10 text-center text-body text-mist-400">
                  {rewardsPoll.error
                    ? 'Sem dado de recompensa no momento — tentando de novo automaticamente.'
                    : 'A API não devolveu blocos pra esta janela.'}
                </p>
              )}
            </div>
            {rewardsData !== undefined && rewardsData.incompleteCount > 0 && (
              <p className="mt-2 text-label text-mist-400">
                {formatInteger(rewardsData.incompleteCount)} bloco(s) vieram sem todas as fatias na
                resposta da API e ficaram fora do gráfico.
              </p>
            )}
          </section>
        </div>

        {/* Rail: reserve ratio na mesma janela + a ponte honesta entre os dois */}
        <aside className="relative mt-10 border-t border-dashed border-zeph-800 pt-6 lg:mt-0 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-8">
          <div className="relative">
            <span
              aria-hidden
              className="absolute top-2 -left-8 hidden w-8 border-t border-dashed border-zeph-500 lg:block"
            />
            <p className="font-mono text-caption tracking-wide text-zeph-300">
              [ MESMA JANELA DE BLOCOS ]
            </p>
          </div>

          {/* Readout do ratio: moldura hairline SEMPRE presente, com selo de
              estado — carregando, com dado ou em falha, o painel nunca rende
              como retângulo vazio (causa raiz do bug em NOTES.md) */}
          <section
            className={`mt-3 border border-hairline transition-opacity ${
              ratiosOutdated ? 'opacity-60' : ''
            }`}
          >
            <header className="flex flex-wrap items-center justify-between gap-2 border-b border-hairline px-3 py-2">
              <h2 className="font-mono text-caption tracking-wide text-mist-300">
                [ RESERVE RATIO ]
              </h2>
              <RatioHealthTag
                ratio={currentRatio}
                isLoading={liveStats.isLoading || ratiosPoll.isLoading}
              />
            </header>

            <div
              className={`flex flex-wrap items-baseline gap-x-3 gap-y-1 px-3 pt-3${pulseClass(ratioNowFresh)}`}
            >
              <span className="font-mono text-data-lg font-medium">
                {orDash(currentRatio, (v) => formatNumber(v, 2, 2))}
              </span>
              <span className="font-mono text-caption text-mist-400">agora · alvo: 4,0–8,0</span>
            </div>

            {ratioBelowFloor && (
              <div
                role="alert"
                data-testid="ratio-floor-alert"
                className="mx-3 mt-3 border border-bad/60 bg-bad/10 px-3 py-2"
              >
                <p className="font-mono text-caption tracking-wide text-bad">
                  [ ALERTA · RESERVA ABAIXO DO PISO ]
                </p>
                <p className="mt-1 text-body text-mist-100">
                  Reserve ratio em {formatNumber(currentRatio!, 2, 2)} — abaixo do piso de 4,0 da
                  faixa alvo do protocolo.
                </p>
              </div>
            )}

            <div className={`px-2 pt-2 pb-1${pulseClass(ratiosFresh)}`}>
              {ratiosPoll.isLoading ? (
                <Skeleton className="h-48 w-full" />
              ) : (ratiosData?.points.length ?? 0) > 0 ? (
                <ReserveRatioChart points={ratiosData!.points} />
              ) : (
                <p className="py-10 text-center text-body text-mist-400">
                  {ratiosPoll.error
                    ? 'Sem série de reserve ratio no momento — tentando de novo automaticamente.'
                    : 'A API não devolveu a série de reserve ratio pra esta janela.'}
                </p>
              )}
            </div>
          </section>

          <p className="mt-3 text-label leading-relaxed text-mist-400">
            Pelo desenho do protocolo, o tamanho da fatia do minerador está ligado à saúde dessa
            reserva — mas a fórmula exata da divisão não vem nesses dados: o que os gráficos
            mostram é o resultado bloco a bloco. Compare as duas curvas como uma observação, não
            como garantia de que uma determina a outra.
          </p>

          {/* O "porquê" da mecânica — texto fixo, sem jargão de DeFi */}
          <section className="mt-6 border-t border-hairline pt-4">
            <h2 className="text-body font-medium text-mist-300">Por que o prêmio é fatiado?</h2>
            <div className="mt-2 space-y-2 text-body leading-relaxed text-mist-400">
              {EXPLAINER_SENTENCES.map((sentence) => (
                <p key={sentence.slice(0, 24)}>{sentence}</p>
              ))}
            </div>
          </section>
        </aside>
      </div>

      {/* Tabela: o par acessível dos dois gráficos, mesmos dados sem cor */}
      {slices.length > 0 && (
        <details
          className="border-y border-hairline"
          onToggle={(event) => setTableOpen(event.currentTarget.open)}
        >
          <summary className="flex cursor-pointer items-baseline gap-3 px-1 py-3 font-mono text-label text-mist-300 hover:text-mist-100">
            <span aria-hidden className="text-zeph-300">
              [ {tableOpen ? '−' : '+'} ]
            </span>
            Ver os dados em tabela ({formatInteger(slices.length)} blocos)
          </summary>
          {tableOpen && (
            <div className="max-h-96 overflow-auto border-t border-hairline">
              <table className="w-full min-w-[760px] text-label">
                <caption className="sr-only">
                  Divisão da recompensa e reserve ratio por bloco, do mais recente pro mais antigo
                </caption>
                <thead className="sticky top-0 bg-ink-950">
                  <tr className="border-b border-hairline font-mono text-caption text-mist-400">
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
                <tbody className="divide-y divide-hairline font-mono">
                  {slices
                    .slice()
                    .reverse()
                    .map((block) => (
                      <tr key={block.height}>
                        <td className="px-3 py-1.5">{formatInteger(block.height)}</td>
                        <td className="px-3 py-1.5 text-right">
                          {formatNumber(block.total, 3, 3)}
                        </td>
                        {REWARD_SERIES.map((def) => (
                          <td key={def.key} className="px-3 py-1.5 text-right">
                            {formatNumber(block.values[def.key], 3, 3)}
                          </td>
                        ))}
                        <td className="px-3 py-1.5 text-right">
                          {formatNumber(sharePercent(block, 'miner'), 1, 1)}%
                        </td>
                        <td className="px-3 py-1.5 text-right">
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

      <div className="space-y-1 text-label text-mist-400">
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
