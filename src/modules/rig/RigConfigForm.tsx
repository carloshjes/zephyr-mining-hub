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
      nextErrors.wallet = 'Informe o endereço público da sua carteira ZEPH.'
    } else if (!isPlausibleZephAddress(trimmedWallet)) {
      nextErrors.wallet =
        'Isso não parece um endereço ZEPH — ele começa com "ZEPH" e tem ~99–101 caracteres.'
    }

    const normalizedXmrig = trimmedXmrig === '' ? undefined : normalizeXmrigAddress(trimmedXmrig)
    if (trimmedXmrig !== '' && normalizedXmrig === undefined) {
      nextErrors.xmrig = 'Use o formato host:porta (ex.: 127.0.0.1:16000) ou só a porta.'
    }

    setErrors(nextErrors)
    if (nextErrors.wallet || nextErrors.xmrig) return
    onSave({ poolId, wallet: trimmedWallet, xmrigAddress: normalizedXmrig })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 border border-hairline p-6">
      <div className="space-y-1">
        <h2 className="text-lede font-semibold tracking-tight">
          {initial ? 'Editar configuração' : 'Configure seu rig'}
        </h2>
        <p className="text-body text-mist-400">
          Tudo fica salvo <strong className="font-medium text-mist-300">só neste navegador</strong>{' '}
          (localStorage) — sem conta e sem enviar nada pra servidor nosso.
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
            Só as pools com API por minerador acessível do navegador — as demais entram quando a
            integração for confirmada.
          </span>
        </label>

        <label className="block text-body">
          <span className="mb-1 block font-mono text-caption tracking-wide text-mist-400">
            API local do XMRig <span className="text-mist-600">(opcional)</span>
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
            host:porta do XMRig rodando com <code className="font-mono text-mist-300">--http-enabled</code>{' '}
            — mostra hashrate local em tempo real.
          </span>
          {errors.xmrig && <span role="alert" className="mt-1 block text-label text-bad">{errors.xmrig}</span>}
        </label>
      </div>

      <label className="block text-body">
        <span className="mb-1 block font-mono text-caption tracking-wide text-mist-400">
          Endereço da carteira ZEPH
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
          Só o endereço <strong className="font-medium text-mist-300">público</strong> — é tudo
          que a pool precisa. Nunca cole chave privada nem seed em site nenhum.
        </span>
        {errors.wallet && <span role="alert" className="mt-1 block text-label text-bad">{errors.wallet}</span>}
      </label>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          className="bg-zeph-300 px-4 py-2 text-body font-medium text-ink-950 transition-colors hover:bg-mist-100"
        >
          Salvar e acompanhar
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="border border-hairline px-4 py-2 text-body text-mist-300 transition-colors hover:border-mist-400"
          >
            Cancelar
          </button>
        )}
        {onClear && (
          <button
            type="button"
            onClick={onClear}
            className="ml-auto text-label text-mist-400 underline underline-offset-4 transition-colors hover:text-bad"
          >
            Apagar configuração deste navegador
          </button>
        )}
      </div>
    </form>
  )
}
