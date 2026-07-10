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

## Direção visual — "Sinal Técnico" (aplicada em 2026-07-09, ver NOTES.md)
Tokens centralizados no `@theme` de `src/index.css` — NUNCA hex solto em componente
(utilitário Tailwind ou `var(--color-*)`; em SVG data-driven, via `style`, não atributo).
- Fundo unificado ink-950 `#0a0a0e` (sem caixas navy) + divisor hairline `#221f29`;
  superfície elevada ink-900 só pra tooltip/thead sticky.
- Família roxa da marca: zeph-300 `#a996f5` (destaque/manchete/fatia dominante, 7,9:1),
  zeph-500 `#6f5fc4` (suporte/gráfico, 3,9:1), zeph-700 `#463c77` (gráfico com alívio),
  zeph-800 `#352d54` (SÓ decoração).
- Texto cinza-roxo: mist-100/300/400 (piso de texto corrido = mist-400, 5,7:1);
  mist-600 `#57536a` é SÓ decorativo (2,7:1) — nunca texto de conteúdo.
- Vermelho alert `#e8492f` RESERVADO: erro, offline, reserve ratio abaixo do piso 4,0.
  Proibida qualquer 4ª cor de destaque (nada de verde/âmbar/azul).
- Mono (`font-mono`, system stack) só pra metadado técnico: altura de bloco, timestamp,
  eixos, rótulos `[ ENTRE COLCHETES ]` (rota ativa, status, tags). Nunca corpo de texto.
- Composição: cada tela tem UMA região dominante + rail secundário (não caixas empilhadas
  de peso igual). Proibido: gradiente, glassmorphism, blur, glow, sombra decorativa.
- Rampa dos gráficos (rewardSeries.ts): monocromática roxa validada como ordinal contra
  ink-950 (skill dataviz) — não reordenar/trocar cor sem revalidar; degraus escuros exigem
  os canais de alívio (rótulo direto, legenda, tooltip, tabela).
- `scripts/design-shots.mjs` fotografa as 4 telas em 3 breakpoints pra revisão visual.

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