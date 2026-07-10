# Exploração de logo — "Z barrado" em halftone (2026-07-10)

Substituição futura da picareta do `AppShell`: a letra Z no estilo dot-matrix da
referência (seção de terminal do rig.ai), com a silhueta do Z barrado da marca
oficial da Zephyr Protocol (Z geométrico bold + UMA barra horizontal cruzando a
largura toda no meio — convenção de símbolo de moeda, nunca confunde com 2).
Exploração **isolada**: nada de produção mudou nesta sessão (AppShell, rotas e
favicon intactos). A integração da escolhida fica pra outro prompt.

## Técnica (halftone de verdade, não fonte pronta)

A silhueta é desenhada num canvas offscreen (polígonos próprios, calcados na
marca oficial — não uma fonte bold genérica) e uma grade paramétrica é amostrada
por cima via `getImageData`: 3×3 subamostras por célula, célula vira ponto onde a
cobertura passa do threshold. Parâmetros por variação: resolução da grade, forma
do ponto (círculo/quadrado), peso da haste, tratamento da barra, ruído seedado.

- Página: `scripts/logo-preview.html` — abre direto no navegador (duplo clique),
  `?dots=zeph` troca a cor dos pontos (mist-100 → zeph-300). Só tokens
  existentes, espelhados de `src/index.css`.
- Screenshots: `node scripts/logo-shots.mjs` (padrão CDP do design-shots, via
  file://; `LOGO_SHOTS_BROWSER`/`LOGO_SHOTS_PAGE` pra rodar fora do
  Windows/Edge). Saída em `.e2e-out/logo/` (gitignorado, regenerável): página
  inteira em mist ×1/×2 e zeph + crop da faixa pequena de cada variação.
- Cada cartão mostra hero 150px, tamanhos reais 32/24/16px e uma "lupa"
  nearest-neighbor 4× dos mesmos pixels de 24/16px (ampliação honesta, não é
  re-render maior).

## Veredito por variação

Critério do tamanho pequeno: olhar o 24–32px como aba de navegador — dá pra
reconhecer um Z (e idealmente a barra) sem saber de antemão o que procurar?

| Variação | Parâmetros | Grande (150px) | Pequeno (24–32px) | Veredito |
|---|---|---|---|---|
| V1 · Base | 22×22, círculo, barra cheia | Z̶ limpo, textura boa | Lê como Z, mas vira "Z sólido desbotado" — o AA funde os pontos e a textura some; 16px é mancha | Aprovada com ressalva (nav ≥24px; nunca favicon) |
| V2 · Grade grossa | 11×11, círculo, thr 0,33, ponto 1,17×, barra de 1 célula | Z̶ "LED grosso", chunky e legível | **Única com pontos ainda visíveis em 24px** (célula ≈ 2px); Z̶ lê em 32 e 24; 16px no limite | **Melhor candidata a ícone pequeno** |
| V3 · Grade densa | 34×34, círculo | A mais bonita — textura mais próxima do rig.ai | Vira Z sólido acinzentado; halftone imperceptível | Hero-only (splash/header grande) |
| V4 · Ponto quadrado | 22×22, quadrado | Vibe terminal/LED forte | Igual à V1, um degrau mais denso/brilhante (quadrado cobre mais célula) | Aprovada com ressalva (idem V1) |
| V5 · Peso pesado | 22×22, haste 0,235 | Contraformas quase fecham; pesado | Coágulo escuro, barra funde com as hastes | **Reprovada** |
| V6 · Barra dupla | 22×22, 2 barras finas | Interessante, diferencia da moeda | As duas barras viram riscos/ruído no meio do Z | **Reprovada no pequeno** |
| V7 · Barra curta | 22×22, barra só na diagonal | O Z mais legível de todos | Melhor leitura de "Z"… porque a barra praticamente some — vira Z comum, perde a citação de moeda | Aprovada com ressalva de identidade |
| V8 · Glitch | 22×22, quadrado, ruído seed 7 | Junto com V3, a mais fiel à imperfeição orgânica da referência | O ruído + AA quebram a coerência em 24px; 32px ok | Hero-only |
| Controle · Sólido | mesma silhueta, sem halftone | — | Lê até 16px, barra incluída | Referência: o limite é o halftone, não a silhueta |

## O que não funcionou (sem esconder)

- **Nenhuma grade 22+ mantém textura de ponto em 24px.** Ainda "lêem" como Z,
  mas o efeito halftone — a razão de ser da direção — desaparece por
  anti-aliasing. Quem precisa de ponto visível em ícone é a V2 (grade 11).
- **V5 e V6 reprovadas** no tamanho pequeno (mancha escura / ruído no meio).
- **Barra cheia vs. legibilidade é um cabo de guerra real**: a barra fiel à
  marca (cheia) é o que mais atrapalha o Z pequeno; a barra curta (V7) resolve a
  letra e sacrifica o símbolo. Em 16px, só o controle sólido segura os dois.
- Iteração registrada: na 1ª rodada a barra em 0,68×haste fazia tudo virar
  "três listras" em 24–32px; afinada pra 0,52×haste. A V2 nasceu 13×13 com
  diagonal quebrada; recalibrada pra 11×11 (grade ímpar centra a barra) com
  threshold 0,33.
- Em zeph-300 os pontos pequenos apagam um degrau antes que em mist-100
  (contraste 7,9:1 vs 16,7:1) — pro ícone pequeno, mist-100.
- Em tela retina (`preview-mist@2x.png`) tudo sobe um degrau (24px CSS = 48px
  reais); a régua conservadora continua sendo o ×1.

## Recomendação pra integração (próximo prompt)

Par hero/ícone, todos da mesma família paramétrica:

1. **Nav (~24px): V2** — única halftone que continua halftone nesse tamanho —
   ou, se a prioridade for leitura máxima, o controle sólido.
2. **Favicon 16px: controle sólido** (Z̶ sem pontos). Halftone em 16px não
   sobrevive em nenhuma variação.
3. **Momentos grandes (splash, README, social): V3 ou V8** — são o "rosto"
   rig.ai da marca; V8 se quiser a imperfeição orgânica.
4. Exportar como SVG estático gerado uma vez (a página já produz o markup;
   nada de canvas em runtime no app).

## Refinamento pós-escolha — V4 com barra cheia + tom por ponto (2026-07-10)

Decisão do Carlos: **V4 (ponto quadrado)**, com dois pedidos — barra na MESMA
espessura das hastes e efeito de cor em tons de roxo. Implementado na seção
`[ FINALISTAS ]` no topo do preview (a exploração original ficou abaixo, como
histórico):

- **Barra = haste** (`bh = t`): hastes e barra com as mesmas 3–4 linhas de
  quadradinhos, como no rabisco de referência.
- Corpo e barra agora são amostrados em **máscaras separadas** — cada ponto
  sabe de qual elemento veio, o que habilita tom por elemento (F2).
- **"Gradiente" em conformidade com a direção**: degraus DISCRETOS dos tokens
  (mist-100 → zeph-300 → zeph-500 → zeph-700) atribuídos por ponto. Nada de
  `<linearGradient>`/cor interpolada — a direção proíbe gradiente decorativo e
  o CLAUDE.md proíbe cor fora dos tokens; a rampa zeph já é validada como
  ordinal nos gráficos.
- **Cintilação opcional** (`?anim=1`): ~30% dos pontos em 3 fases defasadas
  (opacidade 1 → 0,35, ciclo 2,6s, nunca zera). Verificada ao vivo via CDP
  (animationName + opacidade variando). Só existe na página de preview; se um
  dia for pro app, usar com parcimônia e respeitar `prefers-reduced-motion`.

| Finalista | Mapeamento | Grande (150px) | Pequeno (24–32px) |
|---|---|---|---|
| F1 · Varredura ↘ | degraus na diagonal; zeph-700 grampeado no canto (k ≥ 0,92) | Gradiente elegante, base mais escura | Lê, mas a zona zeph-500 apaga primeiro. A 1ª calibragem (banda em 0,84) **decapitava a base do Z em 24px** — corrigida por screenshot |
| F2 · Barra destacada | corpo mist-100 com salpicos zeph-300 · barra inteira zeph-500 | O "corte" da marca fica óbvio | **Melhor dos três** — o tom separa barra de haste onde a espessura já não separa |
| F3 · Cintilância | pesos 40/34/18/8, seed 11 | O mais vivo/orgânico — textura rig.ai | Mosqueado: o Z lê, mas com ruído; vocação de hero |

Achado central do refinamento: com a barra de volta à espessura das hastes, o
risco das "três listras" (documentado na rodada 1) volta — e o **tom por ponto
assume o papel de separador**: em 24px a F2 ainda mostra "Z cortado" onde a
versão monocromática equivalente viraria três faixas iguais (comparar com a V4
do histórico na mesma página).

Recomendação atualizada: **F2** pra navegação/tamanhos médios; **F3** (ou F1)
pra momentos grandes; favicon 16px continua com o sólido. Cintilação só em
momento hero, nunca na navegação.

### Revisão da F3 — sem branco (2026-07-10, escolha do Carlos)

A F3 foi a escolhida, com um ajuste: **sem o mist-100 (quase branco)**. Ela
ganhou rampa própria de 5 tons — mist-300, zeph-300, mist-400, zeph-500,
zeph-700 (pesos 30/28/20/15/7, seed 11) — só roxo/púrpura/cinza-roxo. F1 e F2
continuam na rampa padrão com mist-100, pra comparação na página.

Custo medido em screenshot: o teto de brilho caiu de 16,7:1 (mist-100) pra
9,6:1 (mist-300) — em 24px o Z̶ continua legível, ~meio degrau mais apagado que
a versão com branco; 32px lê bem; 16px segue ilegível como todo halftone desta
grade (favicon continua com o sólido). No hero, o mosaico ficou mais coeso com
o fundo ink-950 — menos "estrelado", mais "painel de LED roxo".
