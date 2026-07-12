import { useState } from 'react'
import { clearRigConfig, loadRigConfig, saveRigConfig, type RigConfig } from './rigConfig'
import { RigConfigForm } from './RigConfigForm'
import { RigDashboard } from './RigDashboard'

// Monitor do Rig — único módulo POR VISITANTE: cada pessoa configura a própria
// carteira/pool/XMRig, salvo em localStorage do navegador dela (sem backend).

export function MyRigPage() {
  const [config, setConfig] = useState<RigConfig | undefined>(() => loadRigConfig())
  const [isEditing, setIsEditing] = useState(false)

  const handleSave = (next: RigConfig) => {
    saveRigConfig(next)
    setConfig(next)
    setIsEditing(false)
  }

  const handleClear = () => {
    clearRigConfig()
    setConfig(undefined)
    setIsEditing(false)
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-data-md font-semibold tracking-tight">Rig Monitor</h1>
          <p className="mt-1 text-body text-mist-400">
            Track your rig at the pool and, optionally, your local XMRig in real time —
            configuration is stored only in this browser.
          </p>
        </div>
        {config && !isEditing && (
          <button
            type="button"
            onClick={() => setIsEditing(true)}
            className="border border-hairline px-3 py-1.5 font-mono text-label text-mist-300 transition-colors hover:border-mist-400 hover:text-mist-100"
          >
            Edit configuration
          </button>
        )}
      </header>

      {config === undefined || isEditing ? (
        <RigConfigForm
          initial={config}
          onSave={handleSave}
          onCancel={config ? () => setIsEditing(false) : undefined}
          onClear={config ? handleClear : undefined}
        />
      ) : (
        // key: trocar carteira/pool/XMRig remonta o dashboard e zera o polling
        <RigDashboard
          key={`${config.poolId}:${config.wallet}:${config.xmrigAddress ?? ''}`}
          config={config}
        />
      )}
    </div>
  )
}
