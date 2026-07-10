import { NavLink, Outlet } from 'react-router-dom'

// Casca comum de navegação — os 4 módulos do produto moram aqui dentro.
// Indicador de rota ativa na convenção da direção "Sinal Técnico": rótulo
// mono entre colchetes, roxo de marca. Os colchetes existem (transparentes)
// também no estado inativo pra troca de rota não deslocar o layout.
const NAV_ITEMS = [
  { to: '/rede', label: 'Pulso da Rede' },
  { to: '/pools', label: 'Bússola de Pools' },
  { to: '/recompensa', label: 'Raio-X da Recompensa' },
  { to: '/meu-rig', label: 'Monitor do Rig' },
]

export function AppShell() {
  return (
    // overflow-x-clip: a manchete full-bleed do Raio-X usa w-screen — o clip
    // aqui impede que isso vire scroll horizontal da página
    <div className="flex min-h-screen flex-col overflow-x-clip">
      <header className="border-b border-hairline bg-ink-950">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-x-8 gap-y-2 px-4 py-4 sm:px-6">
          <div className="flex items-center gap-2">
            <span aria-hidden className="text-xl">⛏️</span>
            <span className="text-lg font-semibold tracking-tight">
              Zephyr <span className="text-zeph-300">Mining Hub</span>
            </span>
          </div>
          <nav className="flex flex-wrap gap-x-5 gap-y-1 font-mono text-xs tracking-wide">
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  isActive
                    ? 'py-1 text-zeph-300'
                    : 'py-1 text-mist-400 transition-colors hover:text-mist-100'
                }
              >
                {({ isActive }) => (
                  <>
                    <span aria-hidden className={isActive ? '' : 'text-transparent'}>
                      [{' '}
                    </span>
                    {item.label}
                    <span aria-hidden className={isActive ? '' : 'text-transparent'}>
                      {' '}]
                    </span>
                  </>
                )}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">
        <Outlet />
      </main>

      <footer className="border-t border-hairline py-4 text-center text-xs text-mist-400">
        Dados: Zephyr Scanner API (zephyrprotocol.com), explorer.zephyrprotocol.com e APIs
        públicas das pools · projeto comunitário, sem afiliação oficial
      </footer>
    </div>
  )
}
