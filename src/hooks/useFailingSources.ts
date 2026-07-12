export interface FailingSourceEntry {
  error: unknown
  label: string
  data: unknown
  /** Fontes secundárias ainda entram no aviso, mas não bloqueiam a tela. */
  countsForNoData?: boolean
}

interface FailingSourcesResult {
  failingSources: string[]
  noDataAtAll: boolean
}

// Agrega polls paralelos sem apagar a diferença entre fonte principal e
// secundária. É um hook por contrato de consumo nas páginas, embora o cálculo
// seja puro e não precise manter estado próprio.
export function useFailingSources(
  entries: readonly FailingSourceEntry[],
): FailingSourcesResult {
  const failingSources = entries
    .filter((entry) => Boolean(entry.error))
    .map((entry) => entry.label)

  const noDataAtAll =
    failingSources.length > 0 &&
    entries
      .filter((entry) => entry.countsForNoData !== false)
      .every((entry) => !entry.data)

  return { failingSources, noDataAtAll }
}
