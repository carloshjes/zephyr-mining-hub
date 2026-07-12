import { useState, type FormEvent } from 'react'
import { MINER_POOLS } from '../../lib/api/minerStats'
import { normalizeXmrigAddress } from '../../lib/api/xmrig'
import { isPlausibleZephAddress, type RigConfig } from './rigConfig'

// Formulário de configuração do visitante — sem conta, sem login. O dropdown
// só lista as pools com API por minerador confirmada do navegador (2Miners e
// HeroMiners); as outras 3 dependem dos TODOs em src/lib/api/pools.ts.

interface RigConfigFormProps {
  /** Config atual pra pré-preencher (undefined = primeira configuração). */
  initial?: RigConfig
  onSave: (config: RigConfig) => void
  /** Presente só quando já existe config (permite desistir da edição). */
  onCancel?: () => void
  /** Presente só quando já existe config (apagar tudo deste navegador). */
  onClear?: () => void
}

interface FieldErrors {
  wallet?: string
  xmrig?: string
}

const INPUT_CLASS =
  'w-full rounded-none border border-hairline bg-ink-950 px-3 py-2 text-body text-mist-100 placeholder:text-mist-600 focus:border-zeph-300 focus:outline-none'

export function RigConfigForm({ initial, onSave, onCancel, onClear }: RigConfigFormProps) {
  const [poolId, setPoolId] = useState(initial?.poolId ?? MINER_POOLS[0].id)
  const [wallet, setWallet] = useState(initial?.wallet ?? '')
  const [xmrig, setXmrig] = useState(initial?.xmrigAddress ?? '')
  const [errors, setErrors] = useState<FieldErrors>({})

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    const trimmedWallet = wallet.trim()
    const trimmedXmrig = xmrig.trim()
    const nextErrors: FieldErrors = {}

    if (trimmedWallet === '') {
      nextErrors.wallet = 'Enter your public ZEPH wallet address.'
    } else if (!isPlausibleZephAddress(trimmedWallet)) {
      nextErrors.wallet =
        'This does not look like a ZEPH address — it should start with "ZEPH" and be about 99–101 characters long.'
    }

    const normalizedXmrig = trimmedXmrig === '' ? undefined : normalizeXmrigAddress(trimmedXmrig)
    if (trimmedXmrig !== '' && normalizedXmrig === undefined) {
      nextErrors.xmrig = 'Use host:port (for example, 127.0.0.1:16000) or enter only the port.'
    }

    setErrors(nextErrors)
    if (nextErrors.wallet || nextErrors.xmrig) return
    onSave({ poolId, wallet: trimmedWallet, xmrigAddress: normalizedXmrig })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 border border-hairline p-6">
      <div className="space-y-1">
        <h2 className="text-lede font-semibold tracking-tight">
          {initial ? 'Edit configuration' : 'Configure your rig'}
        </h2>
        <p className="text-body text-mist-400">
          Everything is stored <strong className="font-medium text-mist-300">only in this browser</strong>{' '}
          (localStorage) — no account is required, and nothing is sent to a server we operate.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-body">
          <span className="mb-1 block font-mono text-caption tracking-wide text-mist-400">Pool</span>
          <select
            value={poolId}
            onChange={(event) => setPoolId(event.target.value)}
            className={INPUT_CLASS}
          >
            {MINER_POOLS.map((pool) => (
              <option key={pool.id} value={pool.id}>
                {pool.name}
              </option>
            ))}
          </select>
          <span className="mt-1 block text-label text-mist-400">
            Only pools with a browser-accessible per-miner API are listed. Others will appear
            after their integration is confirmed.
          </span>
        </label>

        <label className="block text-body">
          <span className="mb-1 block font-mono text-caption tracking-wide text-mist-400">
            Local XMRig API <span className="text-mist-600">(optional)</span>
          </span>
          <input
            type="text"
            value={xmrig}
            onChange={(event) => setXmrig(event.target.value)}
            placeholder="127.0.0.1:16000"
            spellCheck={false}
            className={INPUT_CLASS}
          />
          <span className="mt-1 block text-label text-mist-400">
            XMRig host:port running with <code className="font-mono text-mist-300">--http-enabled</code>{' '}
            — shows local hashrate in real time.
          </span>
          {errors.xmrig && <span role="alert" className="mt-1 block text-label text-bad">{errors.xmrig}</span>}
        </label>
      </div>

      <label className="block text-body">
        <span className="mb-1 block font-mono text-caption tracking-wide text-mist-400">
          ZEPH wallet address
        </span>
        <input
          type="text"
          value={wallet}
          onChange={(event) => setWallet(event.target.value)}
          placeholder="ZEPHYR…"
          spellCheck={false}
          autoComplete="off"
          className={`${INPUT_CLASS} font-mono text-label`}
        />
        <span className="mt-1 block text-label text-mist-400">
          Only the <strong className="font-medium text-mist-300">public</strong> address is needed
          by the pool. Never paste a private key or seed phrase into any website.
        </span>
        {errors.wallet && <span role="alert" className="mt-1 block text-label text-bad">{errors.wallet}</span>}
      </label>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          className="bg-zeph-300 px-4 py-2 text-body font-medium text-ink-950 transition-colors hover:bg-mist-100"
        >
          Save and monitor
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="border border-hairline px-4 py-2 text-body text-mist-300 transition-colors hover:border-mist-400"
          >
            Cancel
          </button>
        )}
        {onClear && (
          <button
            type="button"
            onClick={onClear}
            className="ml-auto text-label text-mist-400 underline underline-offset-4 transition-colors hover:text-bad"
          >
            Remove configuration from this browser
          </button>
        )}
      </div>
    </form>
  )
}
