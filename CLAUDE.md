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

## Direção visual — "Sinal Técnico" (R1 2026-07-09 · v2 2026-07-10, ver NOTES.md)
Tokens centralizados no `@theme` de `src/index.css` — NUNCA hex solto em componente
(utilitário Tailwind ou `var(--color-*)`; em SVG data-driven, via `style`, não atributo).
Contraste MEDIDO com `scripts/contrast-check.mjs` (WCAG 2.2) contra o fundo, a listra
da textura (#0f0f0f, pior caso) e o ink-900 — números em NOTES.md.
- Fundo unificado ink-950 `#0a0a0a` NEUTRO (v2 — o #0a0a0e do R1 tinha tinta azul) +
  textura scanline monocromática no body (listra branca a 2%, 1px a cada 3px): EXCEÇÃO
  única e documentada à regra anti-gradiente — não abre precedente pra gradiente em
  nenhum outro uso. Divisor hairline `#221f29`; superfície elevada ink-900 `#141119`
  só pra tooltip/thead sticky (tinta roxa de marca, mantida de propósito).
- Família roxa recalibrada pro matiz ≈244° (paleta oficial medida no zephyrprotocol.com;
  a do R1 em ≈250–252° puxava pra lavanda-quente): zeph-300 `#9c96f5`
  (destaque/manchete/fatia dominante, 7,6:1), zeph-500 `#665fc4` (suporte/gráfico,
  3,8:1), zeph-700 `#403c77` (SÓ gráfico com alívio, 2,0:1), zeph-800 `#302d54`
  (SÓ decoração). Lado a lado antigo vs novo: `scripts/zeph-hue-compare.html`.
- Texto cinza-roxo: mist-100/300/400 (piso de texto corrido = mist-400, 5,7:1 — 5,5:1
  na listra, segue AA); mist-600 `#57536a` é SÓ decorativo — nunca texto de conteúdo.
- COR DE ESTADO É BINÁRIA (v2): good `#22c55e` (8,7:1) = positivo/saudável/normal ·
  bad `#f97316` (7,1:1) = negativo/erro/offline/abaixo do piso. O vermelho alert do R1
  SAIU do sistema por completo. Proibida qualquer outra cor de destaque. Nenhum estado
  é só-cor: sempre texto/glifo junto, e dois negativos na mesma tela (rig: abaixo vs
  offline) se distinguem por peso (contorno vs sólido), nunca por matiz. Destaque
  COMPARATIVO (chips [ maior hashrate ]/[ menor fee ]) não é estado → segue zeph-300.
- Escala tipográfica em tokens `--text-*` (proibido `text-[Npx]` novo em componente):
  caption 11 (mono/eixos/tags) · label 12 (legenda/tabela) · body 14 (corrido) ·
  lede 16 (destaque/título de seção) · data-md 22 (h1/valor de stat) · data-lg 34
  (readout/countdown) · headline clamp(3.5rem,10vw,8rem) (hero rede/rig) · display
  clamp(4.5rem,15vw,13rem) (manchete Raio-X) · display-sub clamp(2.5rem,8vw,7rem).
- Mono (`font-mono`, system stack) só pra metadado técnico: altura de bloco, timestamp,
  eixos, rótulos `[ ENTRE COLCHETES ]` (rota ativa, status, tags). Nunca corpo de texto.
- Composição: cada tela tem UMA região dominante + rail secundário. O painel de reserve
  ratio do Raio-X é um READOUT com moldura hairline sempre presente + selo de saúde —
  nunca rende como retângulo vazio (causa raiz do bug e fix em NOTES.md; a âncora de
  janela das duas séries é COMPARTILHADA em zephyrScanner.ts, não duplique).
  Proibido continua: gradiente (fora a exceção acima), glassmorphism, blur, glow,
  sombra decorativa.
- Séries do Raio-X (rewardSeries.ts): rampa monocromática ordinal validada + TEXTURA
  por série (v2): minerador liso, reserva hachura diagonal, yield pontilhado —
  diferenciação que não depende de matiz; legenda/tooltip usam a mesma receita via
  `SeriesSwatch.tsx`. Patterns SÓ com `<line>`/`<circle>` (os seletores do rewards-e2e
  contam `<path>` por cor e acham o overlay por `rect`). Degraus escuros seguem
  exigindo canais de alívio (rótulo direto, legenda, tooltip, tabela).
- Movimento (v2): draw-in dos gráficos na montagem (`animate-chart-draw` via
  `useChartEntrance`, que tem trava de assentamento de 1 s — compositor lento salta
  pro estado final, medido em NOTES.md) + pulso sutil de dado novo
  (`animate-data-pulse` via `useDataPulse`) + cintilância da marca (N2 2026-07-10):
  ~30% dos 288 pontos do LogoMark em 3 grupos defasados via `--animate-twinkle-1/2/3`
  (2,6s ease-in-out, atrasos 0/0,9s/1,7s, opacidade 1→0,35 — nunca zera), parâmetros
  EXATOS do preview F3 (assignTwinkle seed 23), fase exportada como 4º valor da tupla
  de LogoMark — não invente valores nem edite fases à mão. TODO uso de animação vem
  em par com `motion-reduce:animate-none`, sem exceção (cintilância provada desligando
  com reduced-motion emulado, NOTES.md).
- `scripts/design-shots.mjs` fotografa as 4 telas em 3 breakpoints; rubrica de revisão
  agora tem 7 perguntas (as 6 do R1 + "positivo e negativo na mesma tela distinguíveis
  por daltonismo?") — resultado em NOTES.md.
- Casca de navegação (2026-07-10, Prompt N1): rail vertical FIXO à esquerda em `xl:`+ —
  LogoMark 128px no topo (o momento de textura da marca: ponto ~3,8px real, variação
  tonal lê a olho nu — medição e capturas em NOTES.md), wordmark empilhado abaixo, os
  4 itens de nav na vertical com a MESMA convenção mono `[ Rótulo ]`, divisor hairline
  vertical à direita, bg chapado ink-950 (conteúdo rola por baixo do rail fixo).
  Breakpoint é xl e NÃO lg de propósito: os módulos abrem 2 colunas em lg assumindo a
  viewport inteira — com o rail de 14rem a coluna só devolve a largura de design deles
  a partir de ~1248px (o aperto foi fotografado, NOTES.md). Abaixo de xl a casca
  RECOMPÕE deliberadamente pra um bloco de topo com a MESMA linguagem do rail (N2
  2026-07-10, substituiu o header do R2): logo 96px com wordmark empilhado ao lado,
  nav abaixo em grade 2×2 deliberada (<md) ou linha única (md+) — nunca flex-wrap
  acidental. Bloco mede 197px num viewport 390×700 (28% da tela; empilhar 1:1 como o
  rail custaria 419px = 60%, medições em NOTES.md). A casca publica `--shell-rail-w`
  (0px sem rail) e o full-bleed da
  manchete do Raio-X consome via `w-[calc(100vw_-_var(--shell-rail-w,0px))]` no lugar
  do antigo w-screen — main agora centra na COLUNA à direita do rail, não na viewport,
  e w-screen cru desalinharia (conta em NOTES.md). Footer vive dentro da coluna
  (full-width real começaria escondido embaixo do rail fixo). main mantém max-w-6xl.
- Marca integrada (2026-07-10): o rail usa `LogoMark` em 128px (N1, bullet acima); o
  bloco de topo (<xl) usa 96px (N2 — os 38px do R2 eram silhueta; a variação tonal por
  ponto só lê a partir de ~32px e a 96px lê a olho nu no crop ×1, ver
  docs/logo-exploracao.md e NOTES.md), o que também habilita a cintilância nos DOIS
  arranjos. NÃO editar os pontos à mão, regenerar com `scripts/logo-export.mjs` (emite
  também o literal pronto em .e2e-out/logo/dots-literal.txt); a rampa de pontos
  referencia tokens via var(), então a recalibração de matiz fluiu sozinha — o espelho
  manual de tokens do logo-preview.html NÃO flui, foi re-sincronizado no N2. Favicon é o
  Z̶ sólido em zeph-300 resolvido pra hex `#9c96f5` (favicon vive fora da cascata do app,
  var() não resolve lá; acompanhou a recalibração) — decisão e evidência em NOTES.md.

## Módulos (rotas)
- /rede — Pulso da Rede: hashrate/dificuldade de rede, halving, saúde do reserve ratio.
  Público, sem configuração do visitante.
- /pools — Bússola de Pools: comparador das pools ZEPH ativas. Público, sem configuração.
- /recompensa — Raio-X da Recompensa: como o prêmio de bloco se divide entre
  minerador/reserva/yield. Público, sem configuração.
- /meu-rig — Monitor do Rig: cada visitante configura a própria carteira/pool/XMRig local,
  salvo em localStorage do navegador dele.

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