import { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { LogoMark } from '../ui/LogoMark'
import { applyTheme, currentTheme, type Theme } from '../../lib/theme'

// Casca comum de navegação — os 4 módulos do produto moram aqui dentro.
// Composição da casca (2026-07-10): rail vertical fixo à esquerda em telas
// largas — a marca em halftone ganha a altura que a barra horizontal negava
// (a 38px o tom por ponto era imperceptível; a 128px o ponto rende ~3,8px e a
// variação lê a olho nu — medição em NOTES.md). Abaixo do breakpoint a casca
// RECOMPÕE pra um bloco de topo com a MESMA linguagem do rail (logo grande →
// wordmark empilhado → nav agrupado) — não rail espremido nem o header antigo
// do R2. Indicador de rota ativa na convenção "Sinal Técnico": rótulo
// mono entre colchetes, roxo de marca. Os colchetes existem (transparentes)
// também no estado inativo pra troca de rota não deslocar o layout.
const NAV_ITEMS = [
  { to: '/rede', label: 'Pulso da Rede' },
  { to: '/pools', label: 'Bússola de Pools' },
  { to: '/recompensa', label: 'Raio-X da Recompensa' },
  { to: '/meu-rig', label: 'Monitor do Rig' },
]

// Mesmos links nos dois arranjos (rail vertical / barra horizontal) — só o
// container muda de eixo. CSS esconde um dos dois, então a árvore de
// acessibilidade nunca vê a navegação (nem o nome do produto) duplicada.
function NavLinks() {
  return NAV_ITEMS.map((item) => (
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
  ))
}

// Botão de troca de tema — convenção mono do sistema. O rótulo visível
// declara o estado ATUAL ([ TEMA · ESCURO ] enquanto escuro): os colchetes
// mono do sistema sempre dizem o que É (rota ativa, [ Minerando normal ]),
// nunca o destino — a AÇÃO vai no aria-label ("Mudar pro tema claro").
// min-w em ch reserva a largura do rótulo mais longo ("[ TEMA · ESCURO ]",
// 17ch) pra alternância não deslocar layout; text-left ancora o colchete.
function ThemeToggle({ theme, onToggle }: { theme: Theme; onToggle: () => void }) {
  return (
    <button
      type="button"
      data-testid="theme-toggle"
      onClick={onToggle}
      aria-label={theme === 'dark' ? 'Mudar pro tema claro' : 'Mudar pro tema escuro'}
      className="min-w-[17ch] text-left font-mono text-caption tracking-wide text-mist-400 transition-colors hover:text-mist-100"
    >
      [ TEMA · {theme === 'dark' ? 'ESCURO' : 'CLARO'} ]
    </button>
  )
}

export function AppShell() {
  // O inline script do index.html já aplicou o atributo antes do paint —
  // o estado inicial só o espelha (nunca decide o tema no mount)
  const [theme, setTheme] = useState<Theme>(() => currentTheme())
  const toggleTheme = () => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark'
    applyTheme(next)
    setTheme(next)
  }

  return (
    // --shell-rail-w: largura do rail, 0 quando a casca está no arranjo de
    // barra horizontal. O Raio-X consome a var pro full-bleed da manchete
    // (100vw − rail): como o main centraliza na COLUNA e não mais na viewport,
    // o antigo w-screen desalinharia — a conta e a prova estão em NOTES.md.
    // overflow-x-clip: impede que esse full-bleed vire scroll horizontal.
    <div className="flex min-h-screen flex-col overflow-x-clip [--shell-rail-w:0px] xl:pl-(--shell-rail-w) xl:[--shell-rail-w:16rem]">
      {/* Rail fixo (xl+): marca no topo, nav empilhado. bg chapado ink-950 —
          mesmo tratamento da barra do R1/R2 — porque conteúdo rola por baixo;
          divisor hairline agora VERTICAL, na borda direita. O breakpoint é xl
          (não lg) de propósito: os módulos abrem a composição de 2 colunas em
          lg assumindo a viewport inteira — a coluna com rail precisa devolver
          esses 1024px de largura de design. 16rem é o TETO do rail com
          breakpoint xl (1024 + 256 = 1280 exato, medido de novo em NOTES.md
          nesta rodada) — alargar mais forçaria 2xl e tiraria o rail da faixa
          1280–1535, a mais comum de desktop. */}
      <aside className="fixed inset-y-0 left-0 z-10 hidden w-(--shell-rail-w) flex-col overflow-y-auto border-r border-hairline bg-ink-950 px-5 py-8 xl:flex">
        {/* Marca F3 (halftone, estática) — decorativa: o wordmark abaixo é o
            nome acessível. 176px (subiu de 128 no pedido de uso real de
            2026-07-11): ponto ~5,3px real, variação tonal folgada a olho nu
            (evidência: .e2e-out/logo/rail-176px.png + lupa, gerados por
            scripts/rail-logo-shots.mjs). */}
        <LogoMark size={176} className="shrink-0" />
        <p className="mt-6 text-data-lg leading-tight font-semibold tracking-tight">
          Zephyr <span className="block text-zeph-300">Mining Hub</span>
        </p>
        <nav className="mt-10 flex flex-col gap-y-2.5 font-mono text-body tracking-wide">
          <NavLinks />
        </nav>
        {/* Controle de sistema (não é navegação): zona meta na BASE do rail
            — mt-auto empurra pro pé, longe da nav, mesma lógica de rodapé */}
        <div className="mt-auto pt-8">
          <ThemeToggle theme={theme} onToggle={toggleTheme} />
        </div>
      </aside>

      {/* Bloco de topo (< xl) — recomposição da MESMA ordem visual do rail
          (logo → wordmark → nav) deitada num bloco de largura cheia. O
          empilhamento 1:1 do rail custaria a altura inteira de um celular
          (medição em NOTES.md), então o wordmark empilhado senta AO LADO do
          logo, com a BASE alinhada à base da marca (items-end — pedido de
          uso real de 2026-07-11; o items-center antigo deixava o texto
          flutuando no meio), e o nav vira grade 2×2 deliberada (uma linha a
          partir de md) — agrupamento decidido, não flex-wrap acidental.
          Logo em 128px: a régua desta rodada prioriza presença sobre
          economia de altura (medições novas em NOTES.md). */}
      <header className="border-b border-hairline bg-ink-950 xl:hidden">
        <div className="mx-auto w-full max-w-6xl px-4 py-4 sm:px-6">
          <div className="flex items-end gap-4">
            <LogoMark size={128} className="shrink-0" />
            <p className="text-data-lg leading-tight font-semibold tracking-tight">
              Zephyr <span className="block text-zeph-300">Mining Hub</span>
            </p>
          </div>
          <nav className="mt-3 grid grid-cols-[auto_auto] gap-x-6 gap-y-1 font-mono text-label tracking-wide md:flex md:gap-x-5">
            <NavLinks />
          </nav>
          {/* Linha própria SOB a nav (não 5º item da grade — a 2×2 é
              agrupamento deliberado do N2 e o tema não é navegação);
              custo de altura medido em NOTES.md */}
          <div className="mt-2">
            <ThemeToggle theme={theme} onToggle={toggleTheme} />
          </div>
        </div>
      </header>

      {/* Cap de largura mantido (max-w-6xl), agora centrado na coluna que
          sobra à direita do rail: a medida de leitura dos módulos foi
          desenhada contra esse cap — o rail muda onde a coluna começa, não a
          largura de texto que ela comporta. */}
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">
        <Outlet />
      </main>

      {/* Footer vive DENTRO da coluna (herda o pl do rail): full-width real
          ficaria com o começo escondido embaixo do rail fixo e opaco. */}
      <footer className="border-t border-hairline py-4 text-center text-label text-mist-400">
        Dados: Zephyr Scanner API (zephyrprotocol.com), explorer.zephyrprotocol.com e APIs
        públicas das pools · projeto comunitário, sem afiliação oficial
      </footer>
    </div>
  )
}
