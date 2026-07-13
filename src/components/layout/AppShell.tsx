import { useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { LogoMark } from '../ui/LogoMark'
import { RouteErrorBoundary } from '../ui/RouteErrorBoundary'
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
  { to: '/rede', label: 'Network Pulse' },
  { to: '/pools', label: 'Pool Compass' },
  { to: '/recompensa', label: 'Reward X-Ray' },
  { to: '/meu-rig', label: 'Rig Monitor' },
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

// Botão de troca de tema — o sol/céu estrelado usa a MESMA linguagem pixelada do
// PixelHeart: grade grossa 11×11 de <rect>, um tom e vão real entre células.
// A exploração docs/logo-exploracao.md já mediu que grades finas perdem a
// textura abaixo de ~24px; a grade grossa é a única família que se mantém
// halftone no pequeno. Captura R6: 18px funde os vãos; 24px pesa demais ao
// lado do caption; 22px dá passo de grade exato de 2px e segura os dois.
// Cor no papel mist-400 (o mesmo contraste medido do glifo anterior). O GLIFO
// declara o estado ATUAL (estrelas = escuro, sol = claro) e a AÇÃO segue só no
// aria-label. Mesma caixa pros dois estados: zero salto.
const GLYPH_SIZE = 22
const THEME_GLYPH_DOT = 0.82

type GlyphCell = readonly [x: number, y: number]

const STARS_CELLS: ReadonlyArray<GlyphCell> = [
  [7, 1], [7, 2], [7, 3], [7, 4], [7, 5],
  [5, 3], [6, 3], [8, 3], [9, 3],
  [2, 6], [1, 7], [2, 7], [3, 7], [2, 8],
  [4, 0], [9, 9], [0, 3],
]

const SUN_CELLS: ReadonlyArray<GlyphCell> = [
  [5, 0], [5, 1],
  [2, 2], [8, 2],
  [4, 3], [5, 3], [6, 3],
  [3, 4], [7, 4],
  [0, 5], [1, 5], [3, 5], [7, 5], [9, 5], [10, 5],
  [3, 6], [7, 6],
  [4, 7], [5, 7], [6, 7],
  [2, 8], [8, 8],
  [5, 9], [5, 10],
]

function PixelThemeGlyph({ cells }: { cells: ReadonlyArray<GlyphCell> }) {
  return (
    <svg width={GLYPH_SIZE} height={GLYPH_SIZE} viewBox="0 0 11 11" aria-hidden className="block shrink-0">
      {cells.map(([x, y]) => (
        <rect
          key={`${x}-${y}`}
          x={x}
          y={y}
          width={THEME_GLYPH_DOT}
          height={THEME_GLYPH_DOT}
          style={{ fill: 'var(--color-mist-400)' }}
        />
      ))}
    </svg>
  )
}

function StarsGlyph() {
  return <PixelThemeGlyph cells={STARS_CELLS} />
}

function SunGlyph() {
  return <PixelThemeGlyph cells={SUN_CELLS} />
}

// N4 (2026-07-12): o ícone-só ficou ambíguo em uso real (sem hover/sem leitor
// de tela não dá pra saber o que o botão faz) — ganhou de volta um rótulo mono
// AO LADO do glifo, na convenção de colchetes do sistema. Grafia EXATA pedida
// pelo Carlos: inglês, `[ DARK ]` com o escuro ativo e `[ WHITE ]` (não
// "LIGHT") com o claro. O rótulo declara o estado ATUAL, como sempre; a AÇÃO
// segue SÓ no aria-label. R6 troca a técnica do glifo; R8 substitui o crescente
// por um céu estrelado que preserva melhor a leitura na grade real de 22px. O
// min-w-[9ch] reserva a largura do rótulo mais longo ("[ WHITE ]", 9 chars
// mono) pra a troca DARK↔WHITE não mexer na largura do botão. Medição do R6:
// flex centralizava as CAIXAS, mas a tinta da fonte mono ficava 0,92px acima
// do centro (o SVG já computava display:block). translate-y-px é a correção
// óptica medida; trocar display/line-height não moveria a tinta dentro da box.
function ThemeToggle({ theme, onToggle }: { theme: Theme; onToggle: () => void }) {
  return (
    <button
      type="button"
      data-testid="theme-toggle"
      onClick={onToggle}
      aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
      className="relative inline-flex items-center gap-2 font-mono text-caption tracking-wide text-mist-400 transition-colors before:absolute before:-inset-1.5 before:content-[''] hover:text-mist-100 motion-reduce:transition-none"
    >
      {theme === 'dark' ? <StarsGlyph /> : <SunGlyph />}
      <span className="min-w-[9ch] translate-y-px text-left">[ {theme === 'dark' ? 'DARK' : 'WHITE'} ]</span>
    </button>
  )
}

// Endereço de doação — HARDCODED e EXATO (nunca gerar/derivar de outra fonte).
const DONATION_ADDRESS =
  'ZEPHYR2eWBjJtirbhwCoxh9HLDLp6H6sbjBn3zpo38QXZHFVuACysqsDeLi9dvJ29FRQLXqhVVKmkDbv2EDoophcFd4Ur3pH7WT3Y'

// Coração pixelado — MESMA técnica do LogoMark (quadrados numa grade, cor por
// token via style no SVG), NÃO emoji/ícone de lib/Unicode ♥. Grade 7×6:
// [x, y] das células acesas (dois lóbulos no topo, afunila até a ponta).
// Decorativo (aria-hidden) — o rótulo "apoie o projeto" ao lado é o sentido.
const HEART_CELLS: ReadonlyArray<readonly [number, number]> = [
  [1, 0], [2, 0], [4, 0], [5, 0],
  [0, 1], [1, 1], [2, 1], [3, 1], [4, 1], [5, 1], [6, 1],
  [0, 2], [1, 2], [2, 2], [3, 2], [4, 2], [5, 2], [6, 2],
  [1, 3], [2, 3], [3, 3], [4, 3], [5, 3],
  [2, 4], [3, 4], [4, 4],
  [3, 5],
]
// Lado do quadradinho < 1 deixa o vão da grade (halftone), como o DOT_SIDE do
// LogoMark — a técnica é a grade de pontos, não um sólido recortado
const HEART_DOT = 0.82

function PixelHeart({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={(size * 6) / 7} viewBox="0 0 7 6" aria-hidden className="shrink-0">
      {HEART_CELLS.map(([x, y]) => (
        <rect
          key={`${x}-${y}`}
          x={x}
          y={y}
          width={HEART_DOT}
          height={HEART_DOT}
          style={{ fill: 'var(--color-zeph-300)' }}
        />
      ))}
    </svg>
  )
}

// Rodapé de doação (R6): endereço completo como texto simples, sem ação de
// cópia e sem disclaimer. break-all é deliberado: preserva os 101 caracteres
// exatos e impede overflow no viewport de 390px. Tipografia sobe um degrau
// (caption→label) e o coração acompanha de 15→18px.
function DonationFooter() {
  return (
    <div className="flex w-full justify-center px-4">
      <div className="flex w-full max-w-4xl items-center justify-center gap-3">
        <PixelHeart size={18} />
        <div className="min-w-0 flex-1 text-center">
          <span className="font-mono text-label tracking-wide text-mist-400">support the project</span>
          <p
            data-testid="donation-address"
            className="mt-1 break-all font-mono text-label text-mist-300"
          >
            {DONATION_ADDRESS}
          </p>
        </div>
        <PixelHeart size={18} />
      </div>
    </div>
  )
}

export function AppShell() {
  const location = useLocation()
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
        {/* A chave reinicia o boundary ao trocar de módulo: um throw fica
            contido na rota ativa sem prender a navegação no fallback. */}
        <RouteErrorBoundary key={location.pathname}>
          <Outlet />
        </RouteErrorBoundary>
      </main>

      {/* Footer vive DENTRO da coluna (herda o pl do rail): full-width real
          ficaria com o começo escondido embaixo do rail fixo e opaco. */}
      <footer className="border-t border-hairline py-5 text-center">
        <DonationFooter />
      </footer>
    </div>
  )
}
