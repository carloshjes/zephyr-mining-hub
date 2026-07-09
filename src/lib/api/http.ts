// Cliente HTTP mínimo e resiliente: timeout via AbortController, erro tipado e
// retentativa curta com backoff exponencial pra falhas transitórias. Falhas
// persistentes são responsabilidade da camada de polling (usePolling), que
// mantém o último dado bom na tela e deixa o erro visível na UI.

export class ApiError extends Error {
  readonly url: string
  readonly status: number | undefined

  constructor(message: string, url: string, status?: number) {
    super(message)
    this.name = 'ApiError'
    this.url = url
    this.status = status
  }
}

export interface FetchJsonOptions {
  signal?: AbortSignal
  timeoutMs?: number
  /** Retentativas além da primeira tentativa (só pra falha de rede/5xx). */
  retries?: number
}

const DEFAULT_TIMEOUT_MS = 10_000
const DEFAULT_RETRIES = 2
const RETRY_BASE_DELAY_MS = 1_000

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort)
      resolve()
    }, ms)
    const onAbort = () => {
      clearTimeout(timer)
      reject(new DOMException('Aborted', 'AbortError'))
    }
    signal?.addEventListener('abort', onAbort, { once: true })
  })
}

async function attemptFetch<T>(
  url: string,
  outerSignal: AbortSignal | undefined,
  timeoutMs: number,
): Promise<T> {
  // Controller próprio pra combinar timeout + cancelamento externo
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  const onOuterAbort = () => controller.abort()
  outerSignal?.addEventListener('abort', onOuterAbort, { once: true })

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    })
    if (!response.ok) {
      throw new ApiError(`HTTP ${response.status} em ${url}`, url, response.status)
    }
    return (await response.json()) as T
  } catch (err) {
    if (err instanceof ApiError) throw err
    if (outerSignal?.aborted) throw err // cancelamento pedido por quem chamou
    throw new ApiError(
      `Falha de rede/timeout ao consultar ${url}: ${err instanceof Error ? err.message : String(err)}`,
      url,
    )
  } finally {
    clearTimeout(timer)
    outerSignal?.removeEventListener('abort', onOuterAbort)
  }
}

export async function fetchJson<T>(url: string, options: FetchJsonOptions = {}): Promise<T> {
  const { signal, timeoutMs = DEFAULT_TIMEOUT_MS, retries = DEFAULT_RETRIES } = options
  let lastError: unknown

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await attemptFetch<T>(url, signal, timeoutMs)
    } catch (err) {
      lastError = err
      if (signal?.aborted) throw err
      // 4xx é erro de contrato, não transitório: retentar não ajuda
      if (err instanceof ApiError && err.status !== undefined && err.status < 500) throw err
      if (attempt < retries) await delay(RETRY_BASE_DELAY_MS * 2 ** attempt, signal)
    }
  }
  throw lastError
}
