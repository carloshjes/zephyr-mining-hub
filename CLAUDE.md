# Zephyr Mining Hub — Contexto do Projeto

## O que é
Dashboard web para a comunidade de mineradores da criptomoeda Zephyr (ZEPH, algoritmo
RandomX, minerada via XMRig). Público: quem já minera ZEPH e/ou está decidindo pools e
acompanhando recompensas de bloco. 4 módulos independentes, uma casca de navegação comum.

## Stack
Vite + React + TypeScript + Tailwind CSS. Deploy no Vercel (conectado ao repo GitHub) —
a Zephyr Scanner API bloqueia CORS no navegador (confirmado), então a v1 precisa do
rewrite/proxy do Vercel em produção (mesma ideia do proxy do Vite dev server). Não é
"backend" com estado — é só a ponte de CORS. Ver NOTES.md pro detalhe dos testes.

## Convenções
- Nomes de variável/função/componente em inglês. Comentários em português.
- Erro de rede/API sempre visível na UI — nunca tela em branco ou silenciosa.
- Campo ausente na resposta da API vira "—" na tela. Nunca inventar/mockar valor.
- Loading e erro usam um componente compartilhado (não reinventar por módulo).

## Direção visual — "Sinal Técnico" (R1 2026-07-09 · v2 2026-07-10 · v3, R4 e R5 2026-07-11 · 2º tema 2026-07-12, ver NOTES.md)
Tokens centralizados no `@theme` de `src/index.css` — NUNCA hex solto em componente
(utilitário Tailwind ou `var(--color-*)`; em SVG data-driven, via `style`, não atributo).
Desde 2026-07-12 existem DOIS conjuntos de VALORES pros mesmos tokens: o escuro
(default, definido no @theme) e o claro (bloco `[data-theme='light']` no mesmo
arquivo) — os nomes ink/zeph/mist/good/bad são PAPÉIS, nenhum componente muda de
classe por causa do tema. Contraste MEDIDO com `scripts/contrast-check.mjs`
(WCAG 2.2) contra o fundo, a célula da textura (pior caso: #191919 no escuro,
#f0f0f0 no claro) e o ink-900 — números em NOTES.md.
- Fundo unificado ink-950 `#141414` NEUTRO (v3 — clareou do #0a0a0a do v2 por uso
  real; ainda "quase preto", croma zero) + textura de GRADE DE BLOCOS monocromática
  (blocos 3px/vão 3px, branco a 2%, deriva diagonal de 1 período/8s via transform em
  `body::before` — compositor, não repaint; para com reduced-motion): EXCEÇÃO única e
  documentada à regra anti-gradiente — não abre precedente pra gradiente em nenhum
  outro uso. Divisor hairline `#282530` e superfície elevada ink-900 `#1d1824`
  (tooltip/thead sticky/readouts) subiram JUNTO com o fundo preservando matiz e as
  razões do v2 (ink-900 v2 teria 1,01:1 sobre o fundo novo — elevação sumiria).
- Família roxa no matiz ≈244° (paleta oficial medida no zephyrprotocol.com; a do R1
  em ≈250–252° puxava pra lavanda-quente): zeph-300 `#9c96f5`
  (destaque/manchete/fatia dominante, 7,1:1), zeph-500 `#665fc4` (suporte/gráfico,
  3,5:1 — 3,35:1 na célula clara, segue ≥3:1), zeph-700 `#403c77` (SÓ gráfico com
  alívio, 1,9:1), zeph-800 `#302d54` (SÓ decoração). Lado a lado antigo vs novo:
  `scripts/zeph-hue-compare.html`.
- Texto cinza-roxo: mist-100/300/400 (piso de texto corrido = mist-400, 5,3:1 — 5,0:1
  na célula clara, segue AA); mist-600 `#57536a` é SÓ decorativo — nunca texto de
  conteúdo. Scrollbar de container rolável usa a utility `scrollbar-themed` (R5: 6px,
  track transparente + thumb no token `--color-scroll` `#3a3a3a` — a família
  ink/mist/zeph/hairline INTEIRA tem matiz roxo e o thumb seguia lendo com tinta em
  uso real; o token novo é cinza croma ZERO com papel único documentado: SÓ
  scrollbar, nunca texto/borda/superfície de conteúdo) — nunca a barra padrão branca.
- COR DE ESTADO É BINÁRIA (v2): good `#22c55e` (8,1:1) = positivo/saudável/normal ·
  bad `#f97316` (6,6:1) = negativo/erro/offline/abaixo do piso. O vermelho alert do R1
  SAIU do sistema por completo. Proibida qualquer outra cor de destaque. Nenhum estado
  é só-cor: sempre texto/glifo junto. Estados do rig (R5, desvio deliberado da
  escada do R4 — NOTES.md): normal E below são a MESMA linha de readout nua
  (ponto + rótulo mono, sem caixa; good 8,1:1 / bad 6,6:1 direto no fundo) — o
  canal não-cor entre eles é o TEXTO POR EXTENSO e o halo (exclusivo do normal);
  offline é a ÚNICA superfície (caixa sólida bad) — superfície significa "pior
  estado", e nunca por matiz. Destaque COMPARATIVO
  (chips [ maior hashrate ]/[ menor fee ]) não é estado → v3: fundo sólido zeph-300
  com texto ink-950 (vivacidade por peso, não matiz novo); R5: os chips formam uma
  COLUNA À DIREITA do nome — o 1º na mesma linha do nome, o 2º abaixo do 1º; com um
  chip só, ele fica ao lado do nome (nunca flex-wrap; o empilhado-abaixo-do-nome do
  R4 deixava a linha alta demais com os dois chips — medição em NOTES.md).
- Escala tipográfica em tokens `--text-*` (proibido `text-[Npx]` novo em componente):
  caption 11 (mono/eixos/tags) · label 12 (legenda/tabela) · body 14 (corrido) ·
  lede 16 (destaque/título de seção) · data-md 22 (h1/valor de stat) · data-lg 34
  (readout/countdown) · headline clamp(3.5rem,10vw,6rem) (hero rede/rig — teto
  recalibrado no v3, capturas em NOTES.md) · display clamp(4.5rem,15vw,9rem)
  (manchete Raio-X — teto R4, só age acima de ~960px de viewport) · display-sub
  clamp(2.5rem,8vw,7rem) (teto MANTIDO de propósito: é o sub quem sangra na borda;
  encolher os dois apagaria o corte).
- Mono (`font-mono`, system stack) só pra metadado técnico: altura de bloco, timestamp,
  eixos, rótulos `[ ENTRE COLCHETES ]` (rota ativa, status, tags). Nunca corpo de texto.
- Composição: cada tela tem UMA região dominante + rail secundário. O painel de reserve
  ratio do Raio-X é um READOUT com moldura hairline sempre presente + selo de saúde —
  nunca rende como retângulo vazio (causa raiz do bug e fix em NOTES.md; a âncora de
  janela das duas séries é COMPARTILHADA em zephyrScanner.ts, não duplique). v3:
  readouts ganham bg-ink-900 (elevação por superfície) e o halving do /rede virou o
  mesmo tratamento; o rótulo do piso no gráfico do ratio FLIPA de lado (nunca sai do
  plot — causa raiz medida e fix em NOTES.md, não volte ao offset fixo). Tendências
  sem série pública (hashrate da rede em /rede; hashrate 24h da carteira em /meu-rig)
  são COLETADAS localmente (networkHashrateHistory.ts / histórico diário em
  rigStatus.ts, store separado do histórico de status — não misture as cadências) e
  desenhadas pelo `TrendSparkline` compartilhado (ui/) — a UI sempre declara a
  procedência do dado, e desde a 2ª leva do R5 o canal é NÃO-VISUAL: title +
  aria-label no container do instrumento (role="group"), não texto na tela — os
  rótulos são só [ TENDÊNCIA ] e [ TENDÊNCIA 24 H ], sem legenda visível (não
  reintroduza a frase da coleta como texto). R4: o TrendSparkline tem `variant`
  line (default — rede, pools) e bars (SÓ o rig). R5: os DOIS instrumentos usam
  largura MEDIDA do container (useElementWidth num componente FILHO — o observer
  ata no mount e o bloco nasce depois do skeleton; medir no pai deixaria o ref
  nulo), nunca width fixo; a faixa do saldo pendente SAIU da UI (o motor diário
  CONTINUA amostrando o b? de {t,h,b?} — decisão e porquê em rigStatus.ts/
  NOTES.md). Alturas calibradas por captura (2ª leva): linha do /rede 96 (com
  draw-in de entrada + data-pulse de leitura nova — o pulso SÓ dispara com a
  entrada assentada: as utilities animate-* disputam a mesma propriedade e o
  pulso cortava o draw-in, medido em NOTES.md); barras do rig 128, posicionadas
  ACIMA da tabela de workers em largura cheia (faixa-horizonte, não segunda
  dominante), base zeph-500 + corrente/hover zeph-300, hover-scrub com
  `formatReading` (prop opcional, só bars) — hover sem foco por teclado de
  propósito (o summary cobre AT). Proibido continua: gradiente
  (fora a exceção acima), glassmorphism, blur, glow, sombra decorativa.
- Séries do Raio-X (rewardSeries.ts): rampa monocromática ordinal validada + TEXTURA
  por série (v2): minerador liso, reserva hachura diagonal, yield pontilhado —
  diferenciação que não depende de matiz; legenda/tooltip usam a mesma receita via
  `SeriesSwatch.tsx`. Patterns SÓ com `<line>`/`<circle>` (os seletores do rewards-e2e
  contam `<path>` por cor e acham o overlay por `rect`). Degraus escuros seguem
  exigindo canais de alívio (rótulo direto, legenda, tooltip, tabela).
- Movimento (v2): draw-in dos gráficos na montagem (`animate-chart-draw` via
  `useChartEntrance`, que tem trava de assentamento de 1 s — compositor lento salta
  pro estado final, medido em NOTES.md) + pulso sutil de dado novo
  (`animate-data-pulse` via `useDataPulse`) + v3: deriva da textura de fundo (acima),
  respiração das faixas do Raio-X (`animate-wash-breathe`, 6s, 1→0,82, fase única —
  SÓ opacity do elemento: o rewards-e2e conta <path> por cor computada) e halo do
  StatusBadge (`animate-status-ping`, 2,4s, SÓ estado normal; reduced-motion usa
  `motion-reduce:hidden` — parado seria um disco estático) + cintilância da marca
  (N2 2026-07-10):
  ~30% dos 288 pontos do LogoMark em 3 grupos defasados via `--animate-twinkle-1/2/3`
  (2,6s ease-in-out, atrasos 0/0,9s/1,7s, opacidade 1→0,35 — nunca zera), parâmetros
  EXATOS do preview F3 (assignTwinkle seed 23), fase exportada como 4º valor da tupla
  de LogoMark — não invente valores nem edite fases à mão. TODO uso de animação vem
  em par com `motion-reduce:animate-none`, sem exceção (cintilância provada desligando
  com reduced-motion emulado, NOTES.md).
- `scripts/design-shots.mjs` fotografa as 4 telas em 3 breakpoints × 2 temas (24
  capturas; escuro mantém os nomes históricos, claro ganha -light); rubrica de revisão
  agora tem 8 perguntas (as 7 do R2 + "a textura de fundo em movimento compete com o
  dado real, ou o dado segue a coisa mais viva da tela?") — resultado em NOTES.md.
- Casca de navegação (N1 2026-07-10 · R4 2026-07-11): rail vertical FIXO à esquerda
  em `xl:`+, largura 16rem (R4 — o TETO com breakpoint xl: 1024 + 256 = 1280 exato,
  medição em NOTES.md; alargar mais forçaria 2xl e tiraria o rail da faixa
  1280–1535) — LogoMark 176px no topo (o momento de textura da marca: ponto ~5,3px
  real), wordmark empilhado abaixo em data-lg, os 4 itens de nav na vertical em
  text-body mono com a MESMA convenção `[ Rótulo ]`, divisor hairline vertical à
  direita, bg chapado ink-950 (conteúdo rola por baixo do rail fixo). Breakpoint é
  xl e NÃO lg de propósito: os módulos abrem 2 colunas em lg assumindo a viewport
  inteira — a coluna com rail devolve exatamente esses 1024px a partir de 1280.
  Abaixo de xl a casca RECOMPÕE deliberadamente pra um bloco de topo com a MESMA
  linguagem do rail (N2, recalibrado no R4): logo 128px com wordmark data-lg ao
  lado, BASE do texto alinhada à base da marca (items-end), nav abaixo em grade 2×2
  deliberada (<md, em text-label — a 14px a grade estouraria os 358px úteis de um
  390) ou linha única (md+) — nunca flex-wrap acidental. Bloco mede 229px num
  viewport 390×700 (33% da tela — régua do R4 prioriza presença; medições em
  NOTES.md). A casca publica `--shell-rail-w` (0px sem rail) e o full-bleed da
  manchete do Raio-X consome via `w-[calc(100vw_-_var(--shell-rail-w,0px))]` no lugar
  do antigo w-screen — main agora centra na COLUNA à direita do rail, não na viewport,
  e w-screen cru desalinharia (conta em NOTES.md). Footer vive dentro da coluna
  (full-width real começaria escondido embaixo do rail fixo). main mantém max-w-6xl.
  Rodapé de DOAÇÃO (N4 2026-07-12): a linha de créditos de API SAIU; entra o
  endereço ZEPH de doação (const `DONATION_ADDRESS` hardcoded e EXATO em
  AppShell.tsx — só a apresentação trunca, cabeça 12 + … + cauda 8; valor
  completo via clipboard e title) copiável (navigator.clipboard, confirmação
  `[ copiar ]`→`[ copiado! ]` + status aria-live), ladeado por um coração
  PIXELADO (`PixelHeart`: MESMA técnica de grade de pontos do LogoMark —
  `<rect>` num grid 7×6, cor por token via style; nunca emoji/ícone de
  lib/Unicode ♥) no token zeph-300. A frase "projeto comunitário, sem afiliação
  oficial" FICA logo abaixo — com o site usando cor/logo de marca da Zephyr, é a
  ÚNICA linha que evita confusão de afiliação (não é estilo, é aviso). Em 390px
  não estoura (o desenhado tem ~21 chars).
- Marca integrada (2026-07-10 · rampa R4): o rail usa `LogoMark` em 176px; o bloco
  de topo (<xl) usa 128px (tamanhos R4 — a variação tonal por ponto lê a olho nu nos
  dois, crops em NOTES.md), o que também habilita a cintilância nos DOIS arranjos.
  Rampa "semBranco" está na 2ª rodada (R4): 4 tons — zeph-300/mist-400/zeph-500/
  zeph-700, pesos [.40,.29,.21,.10] — o mist-300 SAIU (lia como branco em uso real);
  teto de brilho é o zeph-300. NÃO editar os pontos à mão, regenerar com
  `scripts/logo-export.mjs` (emite também o literal pronto em
  .e2e-out/logo/dots-literal.txt); a rampa de pontos referencia tokens via var(),
  então a recalibração de matiz fluiu sozinha — o espelho manual de tokens do
  logo-preview.html NÃO flui, foi re-sincronizado no N2. Favicon: REMOVIDO no R5
  (decisão do Carlos — o Z̶ sólido saiu SEM substituto; um ícone novo virá depois, fora
  do sistema atual). index.html não tem <link rel="icon"> e public/favicon.svg não
  existe — não recrie nenhum dos dois. O logo-export.mjs segue emitindo
  favicon-*.svg em .e2e-out/logo/ como byproduct de exploração (não é produção);
  o histórico da decisão antiga (Z̶ em #9c96f5) fica em NOTES.md.

- TEMA CLARO (2026-07-12): paleta azul (matiz ≈224°) nos MESMOS papéis do roxo —
  fundo `#f7f7f7` croma zero, elevação ink-900 = BRANCO (mais clara que o fundo:
  direção INVERTIDA de propósito, não é bug), hairline `#d9dde6` (tinta azul,
  espelho da tinta roxa), zeph-300 `#1944be` (7,06:1 na célula), zeph-500
  `#3b82f6`, good `#116832` / bad `#a2360a` (≥6:1 — semântica binária intacta),
  textura = preto a 3% (o par de cores da grade é o token `--color-texture-block`,
  papel só-textura). Da paleta planejada, zeph-300/good/bad FALHARAM piso e foram
  recalibrados descendo claridade com matiz preservado (contrast-check, seção TEMA
  CLARO — não edite valores sem re-rodar). Troca (glifo desde 2026-07-12): o
  botão virou um ÍCONE de traço fino desenhado à mão (lua = escuro / sol =
  claro) no lugar do antigo rótulo mono `[ TEMA · ESCURO/CLARO ]` — na zona
  meta o rótulo por extenso pesava como item de nav. O GLIFO declara o estado
  ATUAL (mesma regra do rótulo: diz o que É, não o destino); a AÇÃO segue no
  aria-label ("Mudar pro tema …"), então o canal de acessibilidade NÃO mudou.
  N4 (2026-07-12): o ícone-SÓ ficou ambíguo em uso real (sem hover/sem leitor
  de tela não dá pra saber o que faz) e ganhou de VOLTA um rótulo mono AO LADO
  do glifo — `[ DARK ]` (escuro ativo) / `[ WHITE ]` (claro ativo; grafia EXATA
  em inglês pedida pelo Carlos, é WHITE e não LIGHT). O rótulo declara o estado,
  a ação segue SÓ no aria-label, min-w-[9ch] reserva a largura do mais longo
  ("[ WHITE ]") pra a troca não deslocar layout; o glifo sol/lua é o mesmo do
  N3. Sem lib de ícones (SVG inline
  como o LogoMark, fill none + stroke currentColor); cor no token mist-400
  (interativo NÃO-texto ≥3:1: 5,0:1 escuro / 5,3:1 claro na célula, bloco GLIFO
  DE TEMA do contrast-check). Glifo 18px em viewBox 24 (traço 2 → 1,5px
  rendido); sol e lua na MESMA caixa (zero deslocamento na troca) e alvo de
  toque ≥24px por extensão invisível `before:-inset-1.5`. Fica na BASE do rail
  e em linha própria sob a nav mobile; persistência em `zephyr-hub.theme.v1`
  com script inline anti-flash no index.html (aplica o atributo ANTES do
  primeiro paint — se mudar chave/valor, mude nos DOIS lugares: index.html e
  src/lib/theme.ts). O theme-e2e verifica o rótulo `[ DARK ]`/`[ WHITE ]`
  (innerText) + o glifo (`<svg>`) + o aria-label da ação; as 4 garantias de
  tema seguem intactas. ESCURO segue o default sem marcação (atributo
  removido, nunca data-theme='dark') — contrato dos e2e, que verificam cor
  computada no default; theme-e2e.mjs cobre troca/persistência/anti-flash. Os
  efeitos (textura, respiração, draw-in, pulso, halo, cintilância) são os MESMOS
  nos dois temas — só cor flui via var(). A logo acompanha sozinha (pontos via
  var(); legibilidade tom a tom no claro provada em lupa 4x, NOTES.md); o espelho
  MANUAL do logo-preview.html ganhou o conjunto claro (`?theme=light`) e segue
  não fluindo sozinho. e2e continuam com espelhos do DARK — não precisam mudar.

## Módulos (rotas)
- /rede — Pulso da Rede: hashrate/dificuldade de rede, halving, saúde do reserve ratio.
  Público, sem configuração do visitante.
- /pools — Bússola de Pools: comparador das pools ZEPH ativas. Público, sem configuração.
- /recompensa — Raio-X da Recompensa: como o prêmio de bloco se divide entre
  minerador/reserva/yield. Público, sem configuração.
- /meu-rig — Monitor do Rig: cada visitante configura a própria carteira/pool/XMRig local,
  salvo em localStorage do navegador dele. Ganho estimado (2026-07-12 — a PRIMEIRA
  composição cross-module do produto): o vão da coluna dominante sob o StatusBadge
  mostra `(signalHashrate / hash_rate da rede) × miner_reward ×
  (86400 / BLOCK_TIME_SECONDS)` em ZEPH/dia e `× zeph_price` em USD/dia — função pura
  em `src/modules/rig/earnings.ts`; 3 polls novos no RigDashboard (getNetworkInfo,
  getLatestBlockReward, getLiveStats — as MESMAS fontes do /rede) a
  `SCANNER_CACHE_SECONDS × 1000` (constante importada, nunca 30000 solto).
  Degradação POR CAMPO: sem preço só o USD vira "—"; sem hashrate da rede ou
  recompensa a estimativa toda vira "—" (bloquear o Explorer derruba TAMBÉM o
  blockrewards — âncora, capturado em NOTES.md); a tela nunca quebra. miner_reward
  já é a fatia de 65% — NÃO recalcule o split.

## Zephyr Scanner API
Base: https://zephyrprotocol.com/api/v1 — GET, sem autenticação, cache de 30s por endpoint
no servidor deles (não faça polling mais rápido que isso). Doc completa:
https://zephyrprotocol.com/documentation/scanner-api

**CORS bloqueado, confirmado por teste real** (sem `Access-Control-Allow-Origin`). Nunca
faça fetch direto pra este domínio do navegador — use/estenda a camada em `src/lib/api/`,
que já passa pelo proxy (Vite dev / rewrite do Vercel em produção).

- GET /livestats — snapshot atual: zeph_price, reserve_ratio, reserve_ratio_ma, zeph_circ,
  zys_current_variable_apy, etc.
- GET /stats?scale=day|hour&from=&to=&fields= — série histórica por TEMPO (from/to em unix
  segundos). Prefira scale=day pra análise histórica; use fields= pra pedir só as colunas
  necessárias (payload menor).
- GET /stats?scale=block — outra criatura (confirmado 2026-07-09): from/to viram ALTURAS
  de bloco e cada ponto vem com `block_height` no lugar de `timestamp` (com timestamps
  responde `[]`). Use getBlockStats em `src/lib/api/zephyrScanner.ts`, que tem o tipo certo.
- GET /blockrewards?from=&to=&order= — por bloco: miner_reward, governance_reward,
  reserve_reward, yield_reward (e as versões _atoms). from/to são ALTURAS (inclusive);
  alturas além do topo são ignoradas sem erro. **ARMADILHA (2026-07-09): `order=desc` com
  limit e SEM from/to é não-determinístico** — a mesma chamada devolveu ora um snapshot
  ~58 dias atrasado, ora ~15 h. Pra "últimos N blocos", SEMPRE ancorar em from/to usando a
  altura do explorer (`height` do daemon é contagem: topo minerado = height−1). Camada
  pronta: getRecentBlockRewards/getLatestBlockReward em zephyrScanner.ts.
- GET /reservesnapshots?from=&to=&order= — snapshots do reserve ratio em alturas
  específicas, com on_chain.reserve_ratio.
- /pricingrecords, /apyhistory, /historicalreturns, /zyspricehistory, /projectedreturns —
  existem, focados em ZSD/ZYS, não usados nos módulos de mineração a menos que algum
  prompt futuro peça.

## Zephyr Explorer API
Hashrate e dificuldade de rede NÃO existem no Scanner API (confirmado, campo a campo) —
use esta fonte: GET https://explorer.zephyrprotocol.com/api/networkinfo — CORS aberto,
sem proxy necessário. Já usado pelo módulo Pulso da Rede; consulte o código existente
antes de reimplementar.

## APIs de Pool
Padrão cryptonote-nodejs-pool — mas CONFIRME campo a campo por pool, nomes variam.

Confirmado funcionando neste projeto, incluindo CORS liberado pro navegador (testado com
fetch real, não só do servidor):
- 2Miners: GET https://zeph.2miners.com/api/stats → { hashrate, minersTotal, workersTotal,
  luck, nodes: [{ networkhashps, difficulty, height, avgBlockTime, blockReward }], ... }
  — `Access-Control-Allow-Origin: *`, confirmado.
- 2Miners por minerador (confirmado 2026-07-09, CORS `*`):
  GET https://zeph.2miners.com/api/accounts/<endereco> — hashrate curto/longo, workers,
  shares, saldo em átomos (1e12/ZEPH). Endereço desconhecido/malformado → HTTP 404 com
  corpo VAZIO. GET /api/miners lista todos os endereços (útil pra endereço de teste).
  Sondagem R3 (2026-07-11, ao vivo): a MESMA resposta traz `payments`
  [{ amount, timestamp, tx }] (30/página + paymentsTotal) e `sumrewards` (janelas
  1h→30d) — dado de pagamento confirmado SÓ nesta pool; a HeroMiners segue sem
  confirmação do formato de sucesso (sem endereço de teste; o /api/stats pool-wide
  serializa payments SEM endereço), por isso o gráfico do rig é hashrate diário
  coletado localmente, não pagamentos (regra: as duas pools ou nenhuma — NOTES.md).
  R4: o saldo pendente (pendingBalance, campo já normalizado nas duas pools) entrou
  na MESMA coleta local ({t,h,b?}). R5: a faixa que o desenhava saiu da UI, mas a
  amostragem do b? FICA (reabilitar o desenho reencontra 24 h de série pronta —
  justificativa em rigStatus.ts); o valor atual segue no StatCard do rail.

Também confirmado funcionando (CORS aberto, testado com fetch real do navegador):
- HeroMiners — GET https://zephyr.herominers.com/api/stats, CORS `*` confirmado.
  Fee/min. payout em `config`, hashrate/miners em `pool`, `coinUnits` vem como string.
  (de.zephyr.herominers.com é host de stratum, não de API.)
- HeroMiners por minerador: GET /api/stats_address?address=<endereco> — CORS `*` e
  formato de erro (HTTP 200 com {"error":"Not found"} no CORPO) confirmados ao vivo;
  formato de sucesso confirmado só no código-fonte do upstream (v1.3.5) — sem endereço
  real de teste lá, ver NOTES.md Prompt 4. Parsing defensivo (valores como string).

Camada pronta por minerador: MINER_POOLS/getMinerPool em `src/lib/api/minerStats.ts`
(snapshot normalizado, campo ausente vira "—").

Pools ZEPH conhecidas SEM integração ainda — motivo confirmado, TODOs em
`src/lib/api/pools.ts`:
- K1Pool — GET https://k1pool.com/api/stats/zeph responde JSON válido mas SEM header
  CORS. Integrar só com proxy.
- MiningOcean — sem REST JSON público (front usa protobuf sobre SSE).
- RavenMiner — endpoint de stats não confirmado (method not found + DNS instável).

O dropdown de pool do módulo Monitor do Rig usa só 2Miners e HeroMiners — as
outras 3 não estão prontas.

Lista completa e atualizada de pools: https://miningpoolstats.stream/zephyr

## API local do XMRig
Quando XMRig roda com `--http-enabled` (porta configurável, ex. 16000):
GET http://127.0.0.1:PORTA/1/summary → hashrate, shares, uptime, backend de CPU.
Sem autenticação por padrão, a menos que `access-token` tenha sido configurado.

CORS confirmado aberto no binário real do XMRig (`Access-Control-Allow-Origin: *`,
conferido no código-fonte). Mixed content testado DUAS vezes (ver NOTES.md):
localhost→127.0.0.1 (Fase 0) e **https://localhost→http://127.0.0.1 (Prompt 4,
`scripts/rig-https-mixed.mjs`)** — os dois funcionam, zero aviso de mixed content;
a isenção de loopback do Chromium vale com página https. A trava real é CORS do
servidor local, e o XMRig real manda `*`. **Pendência restante (menor):** página
PÚBLICA (Vercel) é outro espaço de endereço — a política de Local Network Access do
Chrome só dá pra validar com o deploy real; a UI já degrada graciosamente se bloquear.
O simulador `scripts/xmrig-sim.mjs` espelha o XMRig real (CORS na rota padrão;
pior caso em /nocors/1/summary). Camada pronta: `src/lib/api/xmrig.ts`.

## Riscos conhecidos
Ver NOTES.md pro detalhe completo dos testes de CORS/mixed-content da Fase 0. Resumo:
Scanner API bloqueada (usa proxy), 2Miners e XMRig real liberados, hashrate/dificuldade
não vêm do Scanner API (usar Explorer API acima).