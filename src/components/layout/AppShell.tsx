import { NavLink, Outlet } from 'react-router-dom'

// Casca comum de navegação — os 4 módulos do produto moram aqui dentro.
const NAV_ITEMS = [
  { to: '/rede', label: 'Pulso da Rede' },
  { to: '/pools', label: 'Bússola de Pools' },
  { to: '/recompensa', label: 'Raio-X da Recompensa' },
  { to: '/meu-rig', label: 'Monitor do Rig' },
]

export function AppShell() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-x-8 gap-y-2 px-4 py-4 sm:px-6">
          <div className="flex items-center gap-2">
            <span aria-hidden className="text-xl">⛏️</span>
            <span className="text-lg font-semibold tracking-tight">
              Zephyr <span className="text-sky-400">Mining Hub</span>
            </span>
          </div>
          <nav className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  isActive
                    ? 'border-b-2 border-sky-400 pb-1 font-medium text-sky-400'
                    : 'border-b-2 border-transparent pb-1 text-slate-400 transition-colors hover:text-slate-200'
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">
        <Outlet />
      </main>

      <footer className="border-t border-slate-800 py-4 text-center text-xs text-slate-500">
        Dados: Zephyr Scanner API (zephyrprotocol.com), explorer.zephyrprotocol.com e APIs
        públicas das pools · projeto comunitário, sem afiliação oficial
      </footer>
    </div>
  )
}
