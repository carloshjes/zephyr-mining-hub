// Polling resiliente compartilhado por todos os módulos:
// - mantém o último dado bom na tela enquanto uma fonte falha (dado "stale");
// - expõe o erro pra UI deixar a falha visível (nunca tela em branco);
// - retenta com backoff exponencial limitado ao intervalo normal;
// - pausa com a aba oculta e busca na hora quando ela volta a ficar visível.

import { useCallback, useEffect, useRef, useState } from 'react'

export interface PollingResult<T> {
  /** Último dado bom — permanece disponível mesmo durante falhas. */
  data: T | undefined
  /** Erro da última tentativa; undefined quando a última tentativa deu certo. */
  error: Error | undefined
  /** true apenas no primeiro carregamento, antes de haver dado ou erro. */
  isLoading: boolean
  /** Quando o dado atual foi obtido (epoch ms). */
  lastUpdatedAt: number | undefined
  refresh: () => void
}

const INITIAL_RETRY_MS = 5_000

export function usePolling<T>(
  fetcher: (signal: AbortSignal) => Promise<T>,
  intervalMs: number,
): PollingResult<T> {
  const [data, setData] = useState<T>()
  const [error, setError] = useState<Error>()
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number>()

  // Ref pro fetcher: o efeito não precisa reiniciar quando o caller re-renderiza
  const fetcherRef = useRef(fetcher)
  fetcherRef.current = fetcher

  const runRef = useRef<() => void>(() => {})

  useEffect(() => {
    let disposed = false
    let timer: number | undefined
    let controller: AbortController | undefined
    let consecutiveFailures = 0

    const schedule = (delayMs: number) => {
      window.clearTimeout(timer)
      timer = window.setTimeout(run, delayMs)
    }

    const run = async () => {
      controller?.abort()
      controller = new AbortController()
      const { signal } = controller
      try {
        const result = await fetcherRef.current(signal)
        if (disposed || signal.aborted) return
        consecutiveFailures = 0
        setData(result)
        setError(undefined)
        setLastUpdatedAt(Date.now())
        schedule(intervalMs)
      } catch (err) {
        if (disposed || signal.aborted) return
        consecutiveFailures += 1
        setError(err instanceof Error ? err : new Error(String(err)))
        // Backoff exponencial, nunca mais lento que o intervalo normal
        const delayMs = Math.min(
          INITIAL_RETRY_MS * 2 ** (consecutiveFailures - 1),
          intervalMs,
        )
        schedule(delayMs)
      }
    }
    runRef.current = run

    // Aba oculta: para de agendar; ao voltar, busca imediatamente
    const onVisibilityChange = () => {
      if (document.hidden) {
        window.clearTimeout(timer)
      } else {
        run()
      }
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    run()

    return () => {
      disposed = true
      document.removeEventListener('visibilitychange', onVisibilityChange)
      window.clearTimeout(timer)
      controller?.abort()
    }
  }, [intervalMs])

  const refresh = useCallback(() => runRef.current(), [])

  return {
    data,
    error,
    isLoading: data === undefined && error === undefined,
    lastUpdatedAt,
    refresh,
  }
}
