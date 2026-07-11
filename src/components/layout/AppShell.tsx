import { NavLink, Outlet } from 'react-router-dom'
import { LogoMark } from '../ui/LogoMark'

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

export function AppShell() {
  return (
    // --shell-rail-w: largura do rail, 0 quando a casca está no arranjo de
    // barra horizontal. O Raio-X consome a var pro full-bleed da manchete
    // (100vw − rail): como o main centraliza na COLUNA e não mais na viewport,
    // o antigo w-screen desalinharia — a conta e a prova estão em NOTES.md.
    // overflow-x-clip: impede que esse full-bleed vire scroll horizontal.
    <div className="flex min-h-screen flex-col overflow-x-clip [--shell-rail-w:0px] xl:pl-(--shell-rail-w) xl:[--shell-rail-w:14rem]">
      {/* Rail fixo (xl+): marca no topo, nav empilhado. bg chapado ink-950 —
          mesmo tratamento da barra do R1/R2 — porque conteúdo rola por baixo;
          divisor hairline agora VERTICAL, na borda direita. O breakpoint é xl
          (não lg) de propósito: os módulos abrem a composição de 2 colunas em
          lg assumindo a viewport inteira — com o rail comendo 14rem, a coluna
          só devolve a largura de design deles a partir de ~1248px (medição do
          aperto em NOTES.md). */}
      <aside className="fixed inset-y-0 left-0 z-10 hidden w-(--shell-rail-w) flex-col overflow-y-auto border-r border-hairline bg-ink-950 px-5 py-6 xl:flex">
        {/* Marca F3 (halftone, estática) — decorativa: o wordmark abaixo é o
            nome acessível. 128px: no rail o ponto rende ~3,8px real e a
            variação tonal lê SEM zoom (evidência: .e2e-out/logo/rail-128px.png
            + lupa, gerados por scripts/rail-logo-shots.mjs). */}
        <LogoMark size={128} className="shrink-0" />
        <p className="mt-5 text-data-md leading-tight font-semibold tracking-tight">
          Zephyr <span className="block text-zeph-300">Mining Hub</span>
        </p>
        <nav className="mt-10 flex flex-col gap-y-2 font-mono text-label tracking-wide">
          <NavLinks />
        </nav>
      </aside>

      {/* Bloco de topo (< xl) — recomposição da MESMA ordem visual do rail
          (logo → wordmark → nav) deitada num bloco de largura cheia. O
          empilhamento 1:1 do rail custaria a altura inteira de um celular
          (medição em NOTES.md), então o wordmark empilhado senta AO LADO do
          logo e o nav vira grade 2×2 deliberada (uma linha a partir de md) —
          agrupamento decidido, não flex-wrap acidental. Logo em 96px: tom
          por ponto lê a olho nu no crop ×1 (evidência em NOTES.md). */}
      <header className="border-b border-hairline bg-ink-950 xl:hidden">
        <div className="mx-auto w-full max-w-6xl px-4 py-4 sm:px-6">
          <div className="flex items-center gap-4">
            <LogoMark size={96} className="shrink-0" />
            <p className="text-data-md leading-tight font-semibold tracking-tight">
              Zephyr <span className="block text-zeph-300">Mining Hub</span>
            </p>
          </div>
          <nav className="mt-3 grid grid-cols-[auto_auto] gap-x-6 gap-y-1 font-mono text-label tracking-wide md:flex md:gap-x-5">
            <NavLinks />
          </nav>
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
