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

// Botão de troca de tema — glifo de traço fino (sol/lua) no lugar do rótulo
// mono `[ TEMA · … ]`. Motivo: na zona meta (base do rail / linha sob a nav
// mobile) o rótulo por extenso pesava como um item de nav e o min-w-[17ch]
// reservava uma faixa larga pra alternar um bit. O GLIFO declara o estado
// ATUAL (lua = escuro, sol = claro — a MESMA regra do rótulo que substitui:
// diz o que É, nunca o destino); a AÇÃO segue no aria-label ("Mudar pro tema
// …"), inalterada — o canal de acessibilidade é o mesmo de antes, só o canal
// VISÍVEL migrou de texto pra glifo (mesmo espírito da procedência da
// tendência no R5, que virou title/aria). Sem lib de ícones (o projeto não
// tem e não deve ganhar uma por isto): SVG à mão como o LogoMark, fill none +
// stroke currentColor — a linguagem "linha, não sólido" do sistema. Cor no
// token mist-400 (elemento interativo NÃO-texto: 5,0:1 escuro / 5,3:1 claro
// na célula da textura, muito acima do piso 3:1 — medido no contrast-check).
// Glifo 18px em viewBox 24 (stroke 2 → traço 1,5px rendido; calibrado por
// captura). Sol e lua ocupam a MESMA caixa → zero deslocamento na troca; o
// alvo de toque ≥24px (AA) vem de uma extensão invisível before:-inset-1.5
// (mesma técnica do SegmentedControl), então o glifo alinha na borda da
// coluna sem margem de centragem.
const GLYPH_SIZE = 18

const glyphProps = {
  width: GLYPH_SIZE,
  height: GLYPH_SIZE,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
} as const

// Crescente como UMA forma de traço (dois arcos), sem recorte por
// preenchimento — respeita o "sem sólido chapado" do sistema
function MoonGlyph() {
  return (
    <svg {...glyphProps}>
      <path d="M16 4A8 8 0 0 0 16 20A9.5 9.5 0 0 1 16 4Z" />
    </svg>
  )
}

function SunGlyph() {
  return (
    <svg {...glyphProps}>
      <circle cx="12" cy="12" r="4" />
      <line x1="12" y1="6" x2="12" y2="3.5" />
      <line x1="12" y1="18" x2="12" y2="20.5" />
      <line x1="18" y1="12" x2="20.5" y2="12" />
      <line x1="6" y1="12" x2="3.5" y2="12" />
      <line x1="16.24" y1="7.76" x2="18.01" y2="5.99" />
      <line x1="7.76" y1="16.24" x2="5.99" y2="18.01" />
      <line x1="16.24" y1="16.24" x2="18.01" y2="18.01" />
      <line x1="7.76" y1="7.76" x2="5.99" y2="5.99" />
    </svg>
  )
}

// N4 (2026-07-12): o ícone-só ficou ambíguo em uso real (sem hover/sem leitor
// de tela não dá pra saber o que o botão faz) — ganhou de volta um rótulo mono
// AO LADO do glifo, na convenção de colchetes do sistema. Grafia EXATA pedida
// pelo Carlos: inglês, `[ DARK ]` com o escuro ativo e `[ WHITE ]` (não
// "LIGHT") com o claro. O rótulo declara o estado ATUAL, como sempre; a AÇÃO
// segue SÓ no aria-label. O glifo sol/lua é o mesmo do N3 (intocado); o
// min-w-[9ch] reserva a largura do rótulo mais longo ("[ WHITE ]", 9 chars mono)
// pra a troca DARK↔WHITE não mexer na largura do botão.
function ThemeToggle({ theme, onToggle }: { theme: Theme; onToggle: () => void }) {
  return (
    <button
      type="button"
      data-testid="theme-toggle"
      onClick={onToggle}
      aria-label={theme === 'dark' ? 'Mudar pro tema claro' : 'Mudar pro tema escuro'}
      className="relative inline-flex items-center gap-2 font-mono text-caption tracking-wide text-mist-400 transition-colors before:absolute before:-inset-1.5 before:content-[''] hover:text-mist-100 motion-reduce:transition-none"
    >
      {theme === 'dark' ? <MoonGlyph /> : <SunGlyph />}
      <span className="min-w-[9ch] text-left">[ {theme === 'dark' ? 'DARK' : 'WHITE'} ]</span>
    </button>
  )
}

// Endereço de doação — HARDCODED e EXATO (nunca gerar/derivar de outra fonte).
// Só a APRESENTAÇÃO trunca; o valor copiado e o do title são sempre completos.
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

// Rodapé de doação (N4): a linha de créditos de API SAIU; entra o endereço de
// doação copiável ladeado pelos corações pixelados. A frase de não-afiliação
// FICA (compacta, logo abaixo) — com o site usando cor/logo de marca da
// Zephyr, é a ÚNICA linha que evita o visitante confundir isto com o site
// oficial; não é estilo, é o aviso de afiliação do produto.
function DonationFooter() {
  const [copied, setCopied] = useState(false)
  const copyAddress = async () => {
    try {
      await navigator.clipboard.writeText(DONATION_ADDRESS)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2_000)
    } catch {
      // Contexto inseguro / clipboard bloqueado: o title mantém o valor à mão
    }
  }
  // Truncação visual (cabeça 12 + … + cauda 8) em TODOS os breakpoints — os
  // 106 chars dominariam o rodapé quieto até no desktop. O valor COMPLETO vem
  // pelo clipboard (todos) e pelo title (hover no desktop); em 390px não
  // estoura porque o que é desenhado tem ~21 chars.
  const shortAddress = `${DONATION_ADDRESS.slice(0, 12)}…${DONATION_ADDRESS.slice(-8)}`
  return (
    <div className="flex flex-col items-center gap-2 px-4">
      <div className="flex items-center justify-center gap-2.5">
        <PixelHeart />
        <div className="flex min-w-0 flex-col items-center">
          <span className="font-mono text-caption tracking-wide text-mist-400">apoie o projeto</span>
          <button
            type="button"
            onClick={copyAddress}
            title={DONATION_ADDRESS}
            aria-label={`Copiar endereço de doação ZEPH: ${DONATION_ADDRESS}`}
            className="mt-0.5 inline-flex max-w-full items-center gap-1.5 font-mono text-caption text-mist-300 transition-colors hover:text-zeph-300"
          >
            <span className="truncate">{shortAddress}</span>
            <span aria-hidden className="shrink-0 text-mist-400">
              {copied ? '[ copiado! ]' : '[ copiar ]'}
            </span>
          </button>
        </div>
        <PixelHeart />
      </div>
      <p className="text-label text-mist-400">projeto comunitário, sem afiliação oficial</p>
      {/* Confirmação pra leitor de tela (a visual é o "[ copiado! ]" acima) */}
      <span role="status" aria-live="polite" className="sr-only">
        {copied ? 'Endereço de doação copiado' : ''}
      </span>
    </div>
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
      <footer className="border-t border-hairline py-5 text-center">
        <DonationFooter />
      </footer>
    </div>
  )
}
