# NOTES — resultados REAIS de testes (Prompt 1, 2026-07-08)

Registro do que foi **observado de verdade** (fetch real em navegador headless
Edge + `curl` com header `Origin`), não do que "provavelmente funciona".
Reprodução: `npm run dev` + `node scripts/xmrig-sim.mjs` e abrir
`http://localhost:5173/cors-test.html`.

## Resumo dos testes de navegador (Edge headless, página em http://localhost:5173)

| # | Alvo | Resultado observado |
|---|------|---------------------|
| A | `https://zeph.2miners.com/api/stats` | ✅ OK — status 200, 451 bytes |
| B1 | `http://127.0.0.1:18088/1/summary` (sim. XMRig, **sem** header CORS) | ❌ bloqueado — `TypeError: Failed to fetch` |
| B2 | `http://127.0.0.1:18088/cors/1/summary` (sim. XMRig, **com** `Access-Control-Allow-Origin: *`) | ✅ OK — status 200, 146 bytes |
| C | `https://zephyrprotocol.com/api/v1/livestats` (fetch direto) | ❌ bloqueado — `TypeError: Failed to fetch` |
| D | `/zephyr-api/v1/livestats` (mesma API via proxy do Vite) | ✅ OK — status 200, 751 bytes |

## Teste 1 — CORS na API da 2Miners: FUNCIONA

Fetch do navegador funciona sem truque. Confirmação por headers (`curl -H "Origin: http://localhost:5173"`):
a resposta traz `Access-Control-Allow-Origin: *`. Nenhum proxy necessário pro
módulo Bússola de Pools consumir a 2Miners.

## Teste 2 — Mixed content / API local do XMRig: NÃO há bloqueio de mixed content; a trava é CORS

De página em `http://localhost:5173` para `http://127.0.0.1:18088`
(XMRig simulado por `scripts/xmrig-sim.mjs`, sem XMRig real disponível na máquina):

- **Não houve bloqueio de mixed content** — a página de dev é `http://`, e o
  Chromium trata loopback (`127.0.0.1`/`localhost`) como origem confiável.
- O que decide é o **header CORS do servidor local**: sem
  `Access-Control-Allow-Origin` o fetch falha (teste B1); com `*` funciona (B2).
- **Boa notícia pro Monitor do Rig**: o XMRig real envia
  `Access-Control-Allow-Origin: *` (conferido em 2026-07-08 no código-fonte,
  `src/base/net/http/HttpApiResponse.cpp` do repo xmrig/xmrig), então o acesso
  deve funcionar — **confirmar com um XMRig de verdade no Prompt 4**.

**Limitação a retestar no Prompt 4 (produção em https):** página `https://`
buscando `http://127.0.0.1` depende da isenção de mixed content pra loopback
(Chromium e Firefox modernos isentam; Safari historicamente bloqueia) e das
regras de Private Network Access do Chrome, que vêm apertando. Só testei a
partir de página em `http://localhost` — o cenário https NÃO foi testado.

## Descoberta crítica — a Zephyr Scanner API é BLOQUEADA por CORS no navegador

Não estava na lista de testes pedida, mas apareceu ao validar o módulo:

- `curl -H "Origin: ..."` → resposta **sem** `Access-Control-Allow-Origin`;
  preflight `OPTIONS` → sem nenhum header CORS (só `allow: GET, HEAD, OPTIONS`).
- Fetch real no navegador → bloqueado (teste C). No site oficial funciona
  porque lá a chamada é same-origin.

**Solução nesta fase (sem backend próprio):** proxy do dev server do Vite —
o código chama `/zephyr-api/v1/...` e o Vite repassa pra
`https://zephyrprotocol.com/api/...` (config em `vite.config.ts`; vale pra
`npm run dev` e `npm run preview`). Teste D confirma que resolve.

**Consequência pro deploy (decidir no prompt de deploy):** hospedagem estática
pura (GitHub Pages) não faz rewrite, então a Scanner API não funcionará lá.
Opções: Vercel com `rewrites` no `vercel.json` (equivalente ao proxy do Vite,
continua sem backend nosso) ou um proxy CORS. É exatamente o caso previsto no
CLAUDE.md: "proxy de CORS" justificado por teste real.

## Desvios de escopo documentados (e por quê)

1. **Explorer adicionado à camada de dados** (`src/lib/api/zephyrExplorer.ts`).
   A Scanner API não expõe hashrate/dificuldade/altura em `/livestats` nem em
   `/stats` (varri a resposta completa sem `fields=` — só métricas de
   preço/reserva/circulação). O módulo exige esses dados, então usei
   `https://explorer.zephyrprotocol.com/api/networkinfo` (explorer oficial,
   envia `Access-Control-Allow-Origin: *` — funciona direto do navegador,
   observado no teste da página /rede).
2. **`/blockrewards` implementado além de `/livestats` e `/stats`.** É a fonte
   do `base_reward_atoms` usado na contagem do halving (e já estava documentado
   no CLAUDE.md). Sem ele não há como derivar a recompensa base atual.
3. **`/api/emission` do explorer foi avaliado e DESCARTADO**: o coinbase
   acumulado que ele reporta (~12,70 mi ZEPH) é inconsistente com a recompensa
   real dos blocos (~6,46 ZEPH de base ⇒ ~11,67 mi já emitidos pela fórmula) —
   diferença de ~1 mi ZEPH. O `base_reward_atoms` do `/blockrewards` bate com o
   coinbase on-chain (conferi o bloco 815090 no explorer: saída de
   4.200.567.076.830 átomos = 65% de 6.462.410.887.431), então é ele a fonte.

## Como o halving é calculado (módulo Pulso da Rede)

Constantes conferidas no `src/cryptonote_config.h` do repo oficial
(ZephyrProtocol/zephyr): `MONEY_SUPPLY = 2^64 − 1` átomos,
`EMISSION_SPEED_FACTOR_PER_MINUTE = 21` (bloco de 120 s ⇒ shift efetivo 20),
cauda de 0,6 ZEPH/bloco. A emissão é **suave** (estilo Monero):
`recompensa = (MONEY_SUPPLY − já_emitido) >> 20`, sem corte abrupto tipo
Bitcoin. "Halving" = momento em que a recompensa base cruza a próxima metade da
recompensa inicial (2^44 átomos ≈ 17,59 ZEPH): 8,796 → **4,398 (próximo)** →
2,199 ZEPH. A projeção (`src/lib/emission.ts`) parte do `base_reward_atoms`
atual e usa o decaimento geométrico de `1 − 2^-20` por bloco; em 2026-07-08
apontava ~400 mil blocos ≈ jan/2028.

## Cache e polling

- Scanner API: cache de 30 s por endpoint no servidor (headers `x-fetched-at` /
  `etag` confirmam o snapshot). Polling do app: 30 s, nunca mais rápido.
- Série diária (`/stats?scale=day`): só muda uma vez por dia; o app consulta a
  cada 15 min apenas pra referência de fechamento (deltas "vs. ontem").
- Falha de fonte: o app mantém o último dado bom na tela + banner âmbar visível
  ("tentando de novo"), com backoff exponencial de 5 s até o teto de 30 s.

# NOTES — Prompt 2 (Bússola de Pools, 2026-07-08)

Sondagem REAL das APIs de pool (curl com `Origin: http://localhost:5173`,
conferindo corpo E headers CORS — não confiar em "deve ser igual à 2Miners").

| Pool | Endpoint testado | Resultado |
|------|------------------|-----------|
| 2Miners | `https://zeph.2miners.com/api/stats` | ✅ 200 + `Access-Control-Allow-Origin: *`. Campos: `hashrate`, `minersTotal`, `workersTotal`, `luck` (%), `nodes[0].height` (string). SEM fee/pagto. mínimo na resposta → "—". |
| HeroMiners | `https://zephyr.herominers.com/api/stats` | ✅ 200 + ACAO `*`. `config.fee` (0.9), `config.minPaymentThreshold` (átomos) ÷ `config.coinUnits` (**string!**), `pool.hashrate/miners/workers`, `pool.effort_1d` (razão → ×100 = luck %), `network.height`. Obs.: `de.zephyr.herominers.com/api/stats` responde 301 (é host de stratum). |
| K1Pool | `https://k1pool.com/api/stats/zeph` | ⚠️ 200 com JSON válido (`poolHashrate`, `minersTotal`, `poolLuck`, `networkBlock`, `coinPoolFee`) mas **SEM header CORS** → navegador bloqueia. TODO em `src/lib/api/pools.ts`: integrar via proxy (mesmo esquema do rewrite do Vercel da Scanner API). |
| MiningOcean | `zephyr.miningocean.org/api/stats` (e variações) | ❌ 404. O front deles usa **protobuf sobre server-sent events** (visto no bundle `main.a43d9a33.js`) — sem REST JSON público confirmado. TODO em pools.ts. |
| RavenMiner | `zeph.ravenminer.com/api/stats` | ❌ respondeu `{"error":"method not found"}` e depois o host **parou de resolver** (DNS instável no dia do teste). Endpoint de stats não confirmado. TODO em pools.ts. |

Semântica do luck normalizado no app: % com 100 = neutro (2Miners `luck` já é %,
K1Pool `poolLuck` idem, HeroMiners `effort_1d` é razão e é multiplicado por 100).
A janela de medição varia por pool — comparável em tendência, não em valor exato
(nota visível no rodapé da tabela e no `title` de cada valor).

Histórico de luck: localStorage (`zephyr-hub.pools.luck-history.v1`), 20 leituras
por pool, gap mínimo de 55 s entre leituras (polling é 60 s; o gap evita duplicata
em reload/volta de aba e no double-effect do StrictMode).

## Teste E2E do módulo (headless Edge via CDP, sem dependências)

`scripts/pools-e2e.mjs` (pré-requisito: `npm run dev` rodando):
- `node scripts/pools-e2e.mjs normal` — 24 checks: dados reais das duas pools
  integradas, "—" nos campos que a API não expõe, linhas "sem integração" das
  3 pools com TODO, chips de destaque, ordenação em 4 colunas (Fee, Mineradores,
  Pool asc+desc, Hashrate desc+asc), aria-sort, histórico de luck no
  localStorage (cap de 20) e sparklines. **TUDO PASSOU em 2026-07-08.**
- `node scripts/pools-e2e.mjs broken2miners` — com a URL da 2Miners trocada por
  uma inválida (404 forçado): a linha dela mostra "indisponível agora", a
  HeroMiners continua de pé com dados (e herda o chip "maior hashrate"), as
  demais linhas seguem intactas, tela não quebra. **TUDO PASSOU em 2026-07-08**
  (URL revertida em seguida e recuperação re-verificada com o modo normal).
- Sonda de ordem (registro do comportamento): durante o loading as 5 linhas
  ficam na ordem do registro com skeleton; quando o primeiro ciclo chega, a
  tabela já rende ordenada (hashrate desc) num único commit — sem estado
  intermediário fora de ordem.
- Armadilha descoberta: o PROFILE do Edge headless não pode ficar dentro do
  repo — o watcher do Vite tenta observar o `cache.db` travado do Edge e morre
  com EBUSY. O script usa `os.tmpdir()` pro profile; só screenshots vão em
  `.e2e-out/` (no .gitignore).

Na medição de hoje a HeroMiners tinha ~22 MH/s e a 2Miners ~1,4 MH/s (destaque
de "maior hashrate" na HeroMiners, que também é a única expondo fee → "menor
fee"). Se o mundo real mudar, as expectativas de ordem do script precisam
acompanhar.

# NOTES — Prompt 3 (Raio-X da Recompensa, 2026-07-09)

Sondagem REAL da Scanner API por `curl`/Node antes de codar (nada assumido do doc):

## Armadilha crítica — `order=desc` do /blockrewards é não-determinístico

- `GET /blockrewards?order=desc&limit=N` SEM from/to devolveu, em duas chamadas
  no mesmo dia, snapshots com topos DIFERENTES: altura 773.829 (~58 dias
  atrasada!) e 815.094 (~15 h atrasada). O dado em si existe e está atualizado —
  `?from=&to=` por ALTURA respondeu até o topo real da chain na hora.
- Consequência descoberta de tabela: o `getLatestBlockReward` do Prompt 1 (usado
  no Pulso da Rede pra recompensa do minerador E pra âncora do halving) podia
  exibir recompensa de semanas atrás como "atual". Corrigido na camada: janelas
  "últimos N blocos" agora ancoram em from/to usando a altura do explorer.
- Off-by-one da âncora: `height` do daemon (get_info) é CONTAGEM de blocos — o
  topo minerado é height−1. Sintoma antes do ajuste: janelas de N blocos
  voltavam com N−1. Fallback: se a janela ancorada vier vazia (indexador
  atrasado além dela), cai no `order=desc` mesmo assim — dado velho com altura
  visível é melhor que tela vazia.

## Mais fatos confirmados da Scanner API

- `/stats?scale=block`: from/to são ALTURAS e cada ponto vem com `block_height`
  (não `timestamp`); com timestamps unix responde `[]`. É o que permite alinhar
  reserve_ratio com /blockrewards no mesmo eixo x (getBlockStats tem o tipo).
- `/blockrewards` por faixa: 1.001 linhas numa resposta só (~332 KB), sem gaps
  de altura e sem cap observado; alturas além do topo são ignoradas (clamp).
- Nos 1.000 blocos recentes: `governance_reward = 0` em TODOS (a UI mostra a
  série zerada na legenda/tabela, sem faixa fantasma no gráfico); a fatia do
  minerador variou 65,0%–66,4% do total (efeito do ajuste de taxas), com o
  split base 65/30/5; reserve_ratio variou 3,60–5,81 (cruzou o piso de 4,0).

## Decisões de visualização (skill de dataviz)

- Paleta das 4 fatias (azul/verde-água/amarelo/verde, nesta ordem de pilha) e o
  violeta da linha de ratio validados com `validate_palette.js` contra a
  superfície slate-900 (#0f172a): banda de luminosidade, croma e contraste
  PASS; CVD do par yield↔governança na banda-piso (ΔE 10,3) → encoding
  secundário obrigatório: borda sólida de 2 px por faixa sobre wash de 25%,
  rótulos diretos de % na borda direita, legenda sempre presente e tabela
  (`<details>`) como par acessível dos dois gráficos.
- Nada de eixo duplo: fatia e reserve ratio são dois gráficos empilhados com a
  MESMA janela de alturas, e a legenda textual deixa claro que a comparação é
  observação, não fórmula (a fórmula exata do split não vem nos dados).

## Teste E2E do módulo (headless Edge via CDP, sem dependências)

`scripts/rewards-e2e.mjs` (pré-requisito: `npm run dev` rodando):
- `node scripts/rewards-e2e.mjs normal` — 22 checks: manchete conferida
  MATEMATICAMENTE contra a API (busca o mesmo bloco por altura e recalcula
  total e %), 3 faixas com dado real + governança zerada sem faixa fantasma,
  rótulos diretos, tooltip por mouse E teclado, toggle ZEPH/% do bloco, troca
  de janela 200→100 refazendo a busca, tabela com reserve ratio por altura e
  screenshots desktop+mobile. **TUDO PASSOU em 2026-07-09.**
- `node scripts/rewards-e2e.mjs brokenrewards` — derruba só
  `/zephyr-api/v1/blockrewards` por interceptação Fetch do CDP (sem editar
  código-fonte, diferente do esquema do Prompt 2): aviso âmbar cita a fonte, a
  manchete degrada com mensagem, o reserve ratio segue de pé. **TUDO PASSOU em
  2026-07-09.**
- Armadilha de teste: `pointermove` é evento CONTÍNUO no React — a atualização
  de estado do tooltip é adiada, então o teste precisa esperar um tick após o
  dispatch (keydown é discreto e atualiza síncrono).

# NOTES — Prompt 4 (Monitor do Rig, 2026-07-09)

## Sondagem REAL das APIs por minerador (curl com Origin + navegador)

| Pool | Endpoint | Resultado |
|------|----------|-----------|
| 2Miners | `GET /api/accounts/<endereço>` | ✅ 200 + `Access-Control-Allow-Origin: *`, conferido campo a campo com endereço ATIVO real: `currentHashrate`/`hashrate` (H/s, janelas curta/longa), `workers` (mapa nome → `hr`, `hr2`, `offline`, `lastBeat`, `sharesValid/Invalid/Stale`), `workersOnline/Total`, shares da rodada no topo, `stats.{balance,immature,paid,lastShare,blocksFound}` em átomos (1e12/ZEPH). Endereço desconhecido OU malformado → **HTTP 404 com corpo VAZIO** (indistinguíveis). |
| 2Miners | `GET /api/miners` | ✅ lista TODOS os mineradores com endereço completo — foi a fonte do endereço de teste real dos E2E. Formatos vistos: `ZEPHYR…` com 101 chars e subendereço `ZEPHs…` com 99 (base58) — base da validação frouxa do formulário. |
| HeroMiners | `GET /api/stats_address?address=…` | ⚠️ CORS `*` e formato de ERRO confirmados ao vivo: **HTTP 200 com `{"error":"Not found"}`** (erro no corpo, não no status!). O formato de SUCESSO veio do código-fonte do upstream dvandal/cryptonote-nodejs-pool **v1.3.5** (versão que a pool reporta em `config.version`): `{stats, payments, charts, workers}`, com os valores do hash do redis como STRING. **Não foi confirmado ao vivo**: não há endereço completo público minerando lá (o `/api/get_top10miners` TRUNCA os endereços; cruzei com a lista completa da 2Miners e ninguém minera nas duas). Parsing defensivo: campo ausente vira "—". |

## Mixed content HTTPS → XMRig local: TESTADO (o pendente da Fase 0)

`node scripts/rig-https-mixed.mjs` (pré-requisito: `npm run build`): serve o
dist/ em `https://localhost:8443` (cert self-signed gerado na hora; Edge
headless com `--ignore-certificate-errors` — a política de mixed content
independe da validade do cert) + `xmrig-sim` em `http://127.0.0.1:18088`.
**TUDO PASSOU em 2026-07-09:**

- Página **https** → fetch `http://127.0.0.1:18088/1/summary` (com CORS, como o
  XMRig real): ✅ **funciona, sem NENHUM aviso de mixed content no console** —
  a isenção de loopback do Chromium vale também com página https.
- Rota sem CORS (`/nocors/1/summary`): ❌ bloqueada — confirma que a trava é
  CORS, não mixed content (coerente com a Fase 0).
- O módulo inteiro roda na página https: XMRig local E pool remota carregam.

**Limite honesto do teste:** a origem da página era `https://localhost` —
espaço de endereço LOCAL. Página pública de verdade (Vercel) é espaço PÚBLICO,
e é essa a categoria que o Chrome vem restringindo com Local Network Access
(prompt de permissão em rollout). Ou seja: mixed content por ESQUEMA está
resolvido; a política por ESPAÇO DE ENDEREÇO só dá pra validar com o deploy
real → retestar no Vercel. A UI já degrada graciosamente e a nota da seção
XMRig avisa que alguns navegadores bloqueiam.

**Mudança no simulador:** `scripts/xmrig-sim.mjs` agora manda CORS na rota
padrão `/1/summary` (espelha o binário real) e o pior caso virou
`/nocors/1/summary`. As rotas B1/B2 da tabela da Fase 0 referem-se ao layout
antigo (`/1/summary` sem CORS, `/cors/1/summary` com).

## Decisões do módulo

- Config por visitante em localStorage `zephyr-hub.rig.config.v1`
  ({poolId, wallet, xmrigAddress?}), validada campo a campo na leitura; nunca
  pedimos chave/seed (só endereço público — é tudo que as APIs precisam).
- Estado visual único (`rigStatus.ts`): fonte preferida = XMRig local quando
  alcançável (tempo real), senão hashrate da pool. Históricos SEPARADOS por
  fonte (`zephyr-hub.rig.hashrate-history.v1`, chave poolId:wallet:fonte, 30
  leituras, gap 55 s) — pool mede TODOS os workers da carteira, XMRig mede um
  rig só; misturar as escalas falsearia a média. Regras: sem hashrate e sem
  share há <10 min → **offline**; hashrate < 70% da média das últimas leituras
  (mínimo 3) → **abaixo do esperado**; senão **normal**.
- `MinerNotFoundError` (endereço não visto na pool) NÃO para o polling: quando
  o primeiro share chegar, a tela se recupera sozinha.
- XMRig: timeout 4 s e SEM retentativa (é local; o polling de 5 s já retenta) —
  fora do ar vira nota discreta e a pool continua de pé, tela nunca quebra.

## Teste E2E do módulo (headless Edge via CDP, sem dependências)

`scripts/rig-e2e.mjs` (pré-requisito: `npm run dev`; o script sobe e derruba o
próprio xmrig-sim):
- `node scripts/rig-e2e.mjs normal` — o critério de aceite NA ORDEM: navegador
  limpo mostra formulário (localStorage vazio) → submit vazio mostra erro e não
  salva → preenche (2Miners + carteira real ativa + XMRig sim) → config no
  localStorage → dado real da pool (cards + 46 workers na tabela) + XMRig sim
  (1,23 kH/s, 42/43 shares) + estado com fonte "XMRig local" → **refresh** →
  dashboard direto sem formulário, dado volta, edição pré-preenchida. Depois:
  histórico semeado com média alta → estado "abaixo do esperado"; sim
  derrubado no meio → nota "não alcançável", pool de pé, fonte do estado vira
  a pool. **TUDO PASSOU em 2026-07-09.**
- `node scripts/rig-e2e.mjs notfound` — carteira plausível na HeroMiners (o
  endereço da 2Miners, que a HeroMiners não conhece — exercita o
  `{"error":"Not found"}` DE VERDADE): aviso claro "não visto nesta pool",
  estado Offline, tela de pé. **TUDO PASSOU em 2026-07-09.**
- Armadilha de CDP: `Runtime.evaluate` roda tudo no MESMO escopo global —
  `const` repetido entre avaliações colide; os helpers rodam dentro de IIFE.
- Armadilha de timing: o XMRig local responde ANTES da pool — esperar por
  "H/s" no texto da página não garante dado da pool; espere pelas linhas da
  tabela de workers.

# NOTES — Direção visual "Sinal Técnico" (2026-07-09)

Execução da direção decidida fora desta sessão (skill creative-ui-director):
fundo unificado quase-preto, família de roxo da marca Zephyr, anotação técnica
em mono com colchetes, vermelho reservado a alerta, composição dominante/rail.
Só camada de composição/tipografia/cor — zero mudança de lógica/dado/fetch.

## Tokens finais (fonte única: `@theme` em src/index.css)

Contraste MEDIDO (script WCAG 2.2 real, não estimado) contra ink-950 #0a0a0e:

| Token | Hex | Contraste | Uso permitido |
|---|---|---|---|
| ink-950 | #0a0a0e | — | fundo base único |
| ink-900 | #141119 | — | superfície elevada (tooltip, thead sticky) |
| hairline | #221f29 | 1,2:1 | divisor decorativo |
| zeph-300 | #a996f5 | 7,9:1 | destaque/manchete/fatia dominante (texto ok) |
| zeph-500 | #6f5fc4 | 3,9:1 | gráfico e texto GRANDE apenas |
| zeph-700 | #463c77 | 2,0:1 | SÓ gráfico com canal de alívio |
| zeph-800 | #352d54 | 1,6:1 | SÓ decoração (tint de linha, trilho) |
| mist-100 | #edebf4 | 16,7:1 | texto principal |
| mist-300 | #b7b2c9 | 9,6:1 | texto secundário |
| mist-400 | #8b86a0 | 5,7:1 | piso de texto corrido (muted) |
| mist-600 | #57536a | 2,7:1 | SÓ decoração (glifo inativo, sparkline, placeholder) |
| alert | #e8492f | 5,1:1 | RESERVADO: erro, offline, reserva < 4,0 |

Fonte mono: system stack (`--font-mono`), só metadado técnico (altura, hora,
eixo, rótulo `[ ... ]`) — nunca corpo de texto. Ajustes sobre a paleta de
partida do brief: o roxo escuro #352d54 ficou em 1,56:1 e REPROVOU no
validador da skill de dataviz como degrau de rampa — o degrau dos GRÁFICOS
subiu pra #463c77 (2,04:1, rampa ordinal PASS: luminosidade monótona, ΔL ≥
0,06); #352d54 continua como token de decoração pura. O muted profundo
#57536a (2,7:1) reprovaria como texto → rebaixado a decoração; o piso de
texto é #8b86a0. Componentes só usam utilitário Tailwind ou `var(--color-*)`
(SVG data-driven usa `style`, não atributo — var() não resolve em atributo de
apresentação); as e2e passaram a checar cor COMPUTADA (rgb resolvido).

## Rampa dos gráficos (substitui a paleta categórica solta)

miner=zeph-300, reserve=zeph-500, yield=zeph-700 (wash mais denso, 55%),
governança=mist-400 com borda TRACEJADA (encoding secundário; zerada em todos
os blocos observados). Validada como rampa ORDINAL (monocromática por decisão
de marca — o validador categórico reprova rampas de um matiz por desenho, ver
color-formula.md da skill). CVD: separação por luminosidade sobrevive a todo
tipo de daltonismo. Canais de alívio pro degrau 2:1 (obrigatórios): rótulos
diretos, legenda, tooltip e tabela — todos já existiam. Linha do reserve
ratio: zeph-500; trechos abaixo do piso 4,0 + linha do piso + ponto/rótulo
atual viram alert (recorte via clipPath).

## Composição por tela (dominante/rail)

- /recompensa (âncora): manchete `65,0% pro minerador` em full-bleed que corta
  na borda da tela em md+ (aria-hidden; a frase completa acessível segue
  abaixo em tamanho de leitura). Grid dominante (área empilhada) + rail
  (ratio, nota de observação, explicação). Conector: trilho tracejado
  zeph-800 no rail + stub pontilhado + rótulo `[ MESMA JANELA DE BLOCOS ]` —
  expressa correlação por observação, não fórmula. NOVO: alerta de piso —
  banner `[ ALERTA · RESERVA ABAIXO DO PISO ]` quando o ratio corrente < 4,0.
  Mobile recompõe: número sem corte (o rótulo gigante some), rail empilha.
- /meu-rig: card farm resolvido — hero `[ SINAL DO RIG ]` com o hashrate que
  alimenta o estado (fica vermelho quando offline) + badge `[ Minerando
  normal ]`; as 4 métricas da pool viram rail hairline; workers e XMRig em
  tratamento mono. Estados: normal=roxo, abaixo=alerta contorno,
  offline=alerta sólido (âmbar saiu — 4ª cor proibida).
- /pools: tabela já era a região dominante — só tokens + labs.scale
  (cabeçalho mono, algarismo mono, chips `[ maior hashrate ]`/`[ menor fee ]`,
  hairline). Sem mudança estrutural (documentado: escolha correta preservada).
- /rede: diagnóstico — havia DOIS heróis competindo (card do halving + grid de
  6 cards iguais) e o "pulso" (hashrate) enterrado num card. Agora: hashrate
  dominante com dificuldade/altura em anotação mono; reserve ratio (badge de
  saúde; vermelho só abaixo da faixa), preço e recompensa no rail; halving
  vira faixa horizontal secundária com dígitos mono.
- Casca: rota ativa `[ Nome do Módulo ]` mono em zeph-300 (colchetes
  transparentes no inativo — sem layout shift); footer hairline.

## Remoções decorativas (o que saiu e por quê, uma linha cada)

- Caixas `rounded-xl bg-slate-900` (todas as telas): fundo unificado +
  hairline — a caixa de peso igual ERA o sintoma diagnosticado.
- `backdrop-blur` do header: blur é proibido pela direção.
- `shadow-xl` dos tooltips: sombra decorativa proibida; borda hairline +
  fundo sólido ink-900 fazem a elevação.
- Pill chips arredondados (status do rig, destaques de pool, saúde do ratio):
  substituídos pela convenção mono `[ rótulo ]` — assinatura da direção.
- `rounded-full` da barra de divisão da manchete: cantos retos, linguagem
  técnica (o gap de 2px entre fatias fica — é spacer da skill de dataviz).
- Tint da linha "menor fee" na tabela de pools: dois tints coloridos
  disputavam atenção; o chip textual já marca — só o top-hashrate tinta.
- Emojis de estado ⚠️/🔌/📖: viram tags mono `[ ! ]`/`[ FALHA ]`/`[ SEM SINAL
  LOCAL ]` — uma voz técnica só (o ⛏️ do logo fica, é marca).
- Delta verde/vermelho dos stats: neutro nas duas direções (▲/▼ + sinal
  carregam o sentido) — oscilação diária não é alerta, e verde seria 4ª cor.

## Testes e mudanças de e2e

- `rewards-e2e.mjs`: seletores por cor computada (séries usam var());
  manchete gigante checada (cor + tamanho ≥ 64px); NOVO modo `lowratio` que
  FORÇA o cenário reserva < 4,0 reescrevendo /stats?scale=block e /livestats
  na camada de rede do CDP (banner + trechos vermelhos verificados de
  verdade); screenshot de tablet (768) além de desktop/mobile. `normal`,
  `brokenrewards` e `lowratio`: **TUDO PASSOU em 2026-07-09**.
- Flakiness observada (não é regressão): o explorer às vezes pendura uma das
  duas chamadas paralelas de networkinfo; com timeout de 10 s + 2 retries do
  http.ts o dado chega ~30–60 s depois — os checks do ratio viraram waitFor
  de 60 s, e a coluna de ratio da tabela tolera as pontas (séries ancoram
  janelas independentes, podem diferir 1–2 blocos).
- `rig-e2e.mjs` (normal + notfound) e `pools-e2e.mjs` (normal): passaram SEM
  mudança nos scripts — os textos-contrato foram preservados de propósito
  (ex.: status entre colchetes SEM uppercase por CSS, senão innerText muda).
- NOVO `scripts/design-shots.mjs`: as 4 telas × 3 breakpoints (1360/768/390)
  pra revisão visual; semeia a config do rig (carteira de teste da 2Miners +
  xmrig-sim) pra fotografar o dashboard e não o formulário.

## Auto-check (rubrica de 6 perguntas, por tela)

As 4 telas passaram: hierarquia sobrevive em P&B (tamanho/peso/posição, não
cor); uma região dominante por tela; colchetes+mono+manchete cortada afastam
o genérico; sem roxo/vermelho a hierarquia se mantém; menor breakpoint
recompõe (manchete perde o rótulo gigante, rails empilham com trilho, tabelas
rolam dentro do container); cor herdada de marca/significado.

**Re-verificação pós-wip (2026-07-10):** suite completa re-executada em cima
do commit wip — rewards `normal`/`lowratio`/`brokenrewards`, rig
`normal`/`notfound` e pools `normal`: **TUDO PASSOU**; `npm run build` limpo;
`design-shots.mjs` re-fotografado e as 12 capturas (4 telas × 3 breakpoints)
revisadas contra a rubrica de 6 perguntas — nenhuma tela falhou em 2+
perguntas. Único ajuste: warning de lint no design-shots.mjs (ternário como
expressão vira if/else).

## Exploração de logo — Z barrado em halftone (2026-07-10)

Exploração ISOLADA — zero mudança em produção (AppShell, rotas e favicon
intactos; integração fica pra outro prompt).

- `scripts/logo-preview.html`: 8 variações paramétricas + controle sólido do
  "Z barrado" (silhueta da marca oficial Zephyr, sem 3D/gradiente). Halftone
  REAL: canvas offscreen + getImageData, grade com threshold — não é fonte de
  pontos pronta. Abre direto no navegador; `?dots=zeph` troca a cor dos pontos
  (mist-100 → zeph-300). Tokens espelhados de `src/index.css` no topo.
- `scripts/logo-shots.mjs`: fotografa a página no padrão CDP-sem-dependências
  do design-shots (mas via file://, sem `npm run dev`); aceita
  `LOGO_SHOTS_BROWSER` e `LOGO_SHOTS_PAGE` pra rodar fora do Windows/Edge.
  Saída: `.e2e-out/logo/` (página inteira em mist ×1/×2 e zeph, + crops das
  faixas 32/24/16px com lupa nearest-neighbor por variação).
- **Veredito por tamanho em `docs/logo-exploracao.md`** (não só as bonitas).
  Resumo do observado: em 24px as grades 22+ ainda leem como Z mas viram "Z
  sólido desbotado" (o anti-aliasing funde os pontos — a textura de halftone
  desaparece); a ÚNICA variação com pontos visíveis em 24px é a V2 (grade
  11×11, célula ≈ 2px, calibrada por screenshot: threshold 0,33 + ponto 1,17×,
  barra travada em 1 célula com grade ímpar); V5 (peso pesado) e V6 (barra
  dupla) reprovadas no tamanho pequeno; V3 (densa) e V8 (glitch) são as mais
  fiéis à referência rig.ai porém só em tamanho grande; a barra curta (V7) é o
  Z mais legível pequeno, mas a barra some (perde a citação de símbolo de
  moeda). Controle sólido lê até 16px — o limite é o halftone, não a silhueta.
- **Refinamento (mesmo dia):** Carlos escolheu a V4 (quadrado) pedindo barra na
  espessura das hastes + tons de roxo. Seção `[ FINALISTAS ]` no preview: barra
  `bh = t`, corpo/barra amostrados em máscaras separadas, tom POR PONTO em
  degraus dos tokens (mist-100/zeph-300/500/700 — sem gradiente interpolado,
  que a direção proíbe) e cintilação opcional `?anim=1` (verificada via CDP).
  F2 (barra em zeph-500) é a melhor em 24px — o tom separa a barra onde a
  espessura não separa; F1 precisou grampear o zeph-700 no canto (em 24px a
  banda escura decapitava a base do Z); F3 é vocação de hero. Detalhe em
  docs/logo-exploracao.md.
- **F3 escolhida e revisada sem branco (mesmo dia):** mist-100 removido a
  pedido do Carlos; rampa própria de 5 tons (mist-300/zeph-300/mist-400/
  zeph-500/zeph-700, pesos 30/28/20/15/7). Medido em screenshot: em 24px perde
  ~meio degrau de brilho (teto mist-300, 9,6:1) mas segue legível; 16px
  continua caso do sólido. F1/F2 mantêm a rampa padrão.

## Integração da logo F3 no produto (2026-07-10, fecha o Prompt L1)

- **Header (`src/components/ui/LogoMark.tsx`)**: os 288 pontos foram
  EXPORTADOS do gerador real — `scripts/logo-export.mjs` abre
  `logo-preview.html` headless SEM `?anim=1`, lê os `<rect>` já renderizados
  do card "F3 · CINTILÂNCIA" (grade 22×22, quadrado, haste t=.18, barra na
  espessura da haste bh=.18, sparkle seed 11, pesos [.30,.28,.20,.15,.07],
  rampa semBranco: mist-300/zeph-300/mist-400/zeph-500/zeph-700) e valida
  antes de gravar: viewBox 0 0 22 22, todos os tons dentro da rampa, zero
  opacity de glitch. As 95 classes `twN` da cintilação (o `assignTwinkle`
  roda sempre no preview) foram DESCARTADAS no export — produção 100%
  estática. Cor por ponto via `var(--color-*)` no style (regra do projeto).
  **Prova de fidelidade**: sonda CDP comparou o LogoMark renderizado no app
  rect a rect com o export — 288/288 idênticos em x/y/cor computada,
  aria-hidden (o texto "Zephyr Mining Hub" ao lado é o nome acessível),
  nenhuma animação computada. Tamanho no header: 26px (faixa validada ≥24).
- **Favicon (`public/favicon.svg`)**: Z̶ SÓLIDO do card CONTROLE
  (`solidSvg({t:.18, bar:'single'}, 16)` — barra calibrada 0,52·t da rodada
  1), com token resolvido pra hex porque favicon vive fora da cascata do app.
  **Achado novo do teste de aba real** (Edge com janela de verdade +
  screenshot da tab strip, não o SVG ampliado): o tema do navegador desta
  máquina é CLARO — a recomendação mist-100 do L1 (medida contra ink-950)
  praticamente SOME na aba branca (#edebf4 sobre branco ≈ 1,1:1). O
  **zeph-300 `#a996f5` venceu**: lê como Z̶ na aba clara (lupa 6×
  nearest-neighbor confirma as 3 barras + diagonal) e segue ≥6:1 contra
  chrome escuro típico. Evidência: `.e2e-out/tab-favicon-{mist,zeph}.png` +
  `tab-favicon-zeph-lupa.png` (regeneráveis).
- Emoji ⛏️ removido do AppShell (a picareta era placeholder desde o Prompt 1);
  `public/icons.svg` e rotas/lógica intactos. `npm run build` limpo;
  design-shots re-rodado — header ok nos 3 breakpoints, nav sem sobreposição.

# NOTES — Redesign v2 "Sinal Técnico" (2026-07-10, Prompt R2)

Evolução dirigida do R1 a partir de uso real (screenshots de 2026-07-10) e de
inspeção ao vivo de duas referências via Claude in Chrome + getComputedStyle
(valores MEDIDOS, não estimados): o rig.ai (fundo oklch(0.1448 0 0) — croma
ZERO, ou seja #0a0a0a neutro; verde #22c55e; textura scanline por
repeating-linear-gradient de baixíssima opacidade) e o zephyrprotocol.com
(paleta oficial #282554/#322f5e/#464372/#827fae/#c4c1e7 — TODA em matiz ≈244°,
canal R ≈ G; nosso zeph estava em ≈250–252° com R > G, puxando pra
lavanda-quente). Medição desta rodada reproduzível: `node
scripts/contrast-check.mjs`.

## Recalibração de matiz da família zeph (S e L preservados, só o H → 244°)

| token | R1 | v2 | matiz | contraste vs fundo v2 (era no R1) |
|---|---|---|---|---|
| zeph-300 | #a996f5 (252,0°) | **#9c96f5** (243,8°) | destaque/texto | 7,63:1 (7,87) |
| zeph-500 | #6f5fc4 (249,5°) | **#665fc4** (244,2°) | gráfico/texto grande | 3,77:1 (3,87) |
| zeph-700 | #463c77 (250,2°) | **#403c77** (244,1°) | gráfico c/ alívio | 2,01:1 (2,04) |
| zeph-800 | #352d54 (252,3°) | **#302d54** (244,6°) | decoração | 1,54:1 |

Todos os degraus mantêm a mesma classe de uso do R1 (nenhum cruzou limiar de
AA pra baixo). A rampa ordinal dos gráficos segue válida: a separação é por
LUMINOSIDADE (intocada) e o matiz mudou por igual na família inteira. mist/
hairline/ink-900 ficam como estão de propósito: croma baixo demais pro matiz
ler (e a tinta roxa da elevação é marca). O favicon (zeph-300 resolvido em
hex, fora da cascata) acompanhou: #a996f5 → #9c96f5. A LogoMark referencia
tokens via var() — acompanhou sozinha, geometria e rampa de pontos intactas.

## Fundo neutralizado + textura scanline (a exceção documentada)

- ink-950: #0a0a0e → **#0a0a0a**. A diferença do R1 era só a tinta azulada
  (R=G=10 < B=14); claridade praticamente igual — neutralizou, não clareou.
- Textura: `repeating-linear-gradient` de listra branca a **2%**, 1px a cada
  3px, no body (src/index.css) — reprodução do que o rig.ai faz de verdade.
  É a ÚNICA exceção à regra "proibido gradiente": monocromática, só no fundo,
  não abre precedente pra gradiente decorativo colorido.
- Pior caso de contraste = em cima da listra (#0f0f0f): mist-400 5,49:1
  (piso de texto corrido segue AA), zeph-300 7,39:1, good 8,41:1, bad 6,84:1,
  zeph-700 1,94:1 — o degrau escuro já exigia canais de alívio no R1 (rótulo
  direto, legenda, tooltip, tabela) e a exigência continua.

## Cores semânticas good/bad — o vermelho saiu do sistema

Regra v2 (binária, sem meio-termo): **good #22c55e** = positivo/saudável/
normal · **bad #f97316** = negativo/crítico/erro/offline. O alert #e8492f do
R1 foi REMOVIDO do @theme e de todos os usos.

- good: 8,69:1 no fundo / 8,41:1 na listra / 8,20:1 no ink-900 — é
  literalmente o verde medido no rig.ai; #4ade80 (11,4:1) ficou pastel demais
  pra voz de status e #16a34a perde folga em texto mono pequeno (6,0:1).
- bad: 7,06:1 / 6,84:1 / 6,67:1 — MAIS contraste que o vermelho antigo
  (5,11:1) e ainda lê como alarme; texto ink-950 sobre bad chapado (badge
  offline sólido) = 7,06:1. #ea580c (5,56:1) reprovado pro uso pesado em
  caption mono; #fb923c lê "pêssego", não alarme.
- CVD: good vs bad se aproximam em deuteranopia — por isso nenhum estado do
  produto é só-cor: sempre texto/glifo ([ ✓ ], [ ! ], [ FALHA ], rótulo por
  extenso) e, quando dois estados negativos coexistem (rig: abaixo vs
  offline), o peso diferencia (contorno vs sólido), não o matiz.
- Achado colateral da medição: o hover do botão do form do rig (mist-100
  sobre zeph-500) media **3,77:1 — reprovava AA desde o R1**; o hover agora
  clareia pra bg-mist-100 com texto ink-950 (16,8:1).

## Causa raiz — painel do reserve ratio rendia como "retângulo vazio"

Reprodução determinística com probe CDP (Edge headless) atrasando as
respostas do networkinfo do explorer em 12 s; screenshots em
`.e2e-out/ratio-bug-{antes,depois}-t{7,16}.png`:

1. **Âncoras duplicadas**: cada série da página (recompensas E ratio) chamava
   o PRÓPRIO `getAnchorHeight` → networkinfo em paralelo pedindo o mesmo topo.
   Probe no estado antes: **6 chamadas de networkinfo numa única carga** (2
   séries × StrictMode, + o efeito de troca de janela re-disparando no 2º
   mount do StrictMode). Em produção seriam 2 por carga — e o R1 já tinha
   registrado que o explorer às vezes PENDURA uma das chamadas paralelas.
2. **Assimetria**: quando só a âncora do ratio pendurava, a página inteira
   vivia (manchete, gráfico principal, "agora:" do livestats — que não é
   ancorado) e o rail ficava em skeleton. Com timeout de 10 s × 3 tentativas
   do http.ts, o buraco chega a ~34 s por ciclo (no probe, a t+16 s o painel
   AINDA estava vazio).
3. **Apresentação**: o estado de loading/vazio do rail era um `Skeleton
   h-48` SEM moldura (zeph-800/40 sobre o fundo ≈ caixa apagada de 319×192
   px, medido no probe) — qualquer lentidão virava "painel quebrado".

Fix nas três camadas:
- `getAnchorHeight` virou **âncora compartilhada** (promise única por janela
  de 5 s, sem o signal dos callers — o abort de um consumidor não mata a
  âncora do outro; falha não fica cacheada). Probe depois: **1 chamada** na
  carga (a 2ª do log é retry legítimo pós-timeout). Bônus: as duas séries
  agora ancoram na MESMA altura — o rótulo [ MESMA JANELA DE BLOCOS ] virou
  literal e a coluna de ratio da tabela casa 1:1 (o e2e já tolerava pontas).
- O painel virou **readout com moldura hairline sempre presente**: cabeçalho
  `[ RESERVE RATIO ]` + selo de estado (verde `[ ✓ NA FAIXA ALVO ]` em
  4,0–8,0 / laranja `[ ! ABAIXO DO PISO ]` / neutro `[ ↑ ACIMA DA FAIXA ]` /
  `[ AGUARDANDO SÉRIE ]`–`[ SEM DADO ]`) + valor corrente grande (data-lg).
  Carregando, com dado ou em falha, o instrumento existe — probe depois:
  `temMoldura: true` com o skeleton DENTRO do readout.
- O valor "agora" continua vindo do livestats (não ancorado), então o readout
  mostra número mesmo com a série pendurada.

## Escala tipográfica (9 tokens --text-*, fim do salto manchete→poeira)

caption 11px (metadado mono, eixos, tags) · label 12px (legenda, tabela,
rodapé) · body 14px (texto corrido) · lede 16px (parágrafo-destaque, título
de seção) · data-md 22px (h1 de módulo, valor de stat) · data-lg 34px
(readout, countdown) · headline clamp(3.5rem,10vw,8rem) (hero rede/rig) ·
display clamp(4.5rem,15vw,13rem) (manchete do Raio-X) · display-sub
clamp(2.5rem,8vw,7rem) (o "pro minerador"). Zero `text-[Npx]` novo em
componente; os degraus do meio (lede/data-md/data-lg) são a resposta ao
diagnóstico "manchete gigante vs. poeira".

## Diferenciação de série sem depender de matiz (Raio-X)

A rampa continua monocromática (decisão de marca do R1) — a diferenciação
nova é por TEXTURA: minerador liso (dominante fica calmo), reserva com
hachura diagonal, yield pontilhado, governança segue borda tracejada.
`<pattern>` compartilhado (SeriesSwatch.tsx) desenhado só com <line>/<circle>
e swatch de legenda/tooltip que repete a receita exata da faixa (wash +
textura + borda 2px) — restrição deliberada: os seletores do rewards-e2e
contam <path> por cor computada e acham o overlay de hover por
querySelector('rect'), então padrão não pode introduzir rect/path novos.
Fatias são dado NEUTRO: não ganharam verde/laranja (good/bad é só estado).

## Movimento (draw-in + pulso), com prova

- Entrada: wipe esquerda→direita por clip-path animado (keyframes
  chart-draw, 700 ms) no grupo de marcas de dado dos DOIS gráficos — grid,
  eixos e piso aparecem na hora; só na montagem, poll não re-anima. Probe
  capturou o wipe no meio (inset 75%→20%) e, com prefers-reduced-motion:
  reduce emulado, animationName=none e clip=none (estado final imediato).
- Pulso "dado novo": keyframes data-pulse (900 ms, opacity 1→0,45→1) via
  useDataPulse — dispara quando a VERSÃO muda (altura do bloco/valor do
  ratio), ignora a primeira chegada (o draw-in cobre). Capturado ao vivo no
  readout quando o livestats girou. Todo uso em par com
  motion-reduce:animate-none, sem exceção.

## Desvio documentado — rewards-e2e.mjs (espelhos de token)

O script se declara espelho dos tokens ("os valores rgb() abaixo são os
tokens resolvidos") e o R1 fixou os hex de então. A recalibração + saída do
vermelho exigiu atualizar SÓ isso: os 4 espelhos de cor (zeph-300/500/700 e
alert→bad), o nome da constante (STROKE_ALERT→STROKE_BAD) e o rótulo de um
check ("vermelho reservado"→"laranja de estado negativo"). Zero mudança de
lógica, seletor ou texto-contrato — rig-e2e e pools-e2e não têm cor nenhuma e
ficaram intactos. Suíte re-executada: rewards normal (24 checks) + lowratio +
brokenrewards **TUDO PASSOU em 2026-07-10** (v2).

## Armadilha descoberta — compositor lento congela o draw-in (e a trava)

A primeira rodada do design-shots v2 capturou os DOIS gráficos do Raio-X
truncados a ~12% da largura em tablet/mobile — as gridlines (fora do grupo
animado) completas e a série (dentro) cortada: o wipe do clip-path congelado
no meio do frame. Probe ao vivo mostrou a animação COMPLETANDO normalmente
(running → finished aos 700 ms), mas com o relógio dela andando a ~1/4 da
velocidade real nos primeiros ~300 ms (throttling de raster do headless nos
primeiros frames de uma navegação — hardware fraco real teria o mesmo
sintoma). Fix: `useChartEntrance` devolve a classe de animação por 1 s a
partir da montagem e depois a REMOVE — remover a classe salta pro estado
final (sem clip). Navegador normal: animação de 700 ms termina antes, remoção
invisível (na curva ease-out usada, 600/700 ms ≈ 99% do caminho). Ambiente
lento: pula/encurta o draw-in em vez de exibir gráfico truncado. Probe pós-
fix: anima → finished → classe some a ~1 s; design-shots re-rodado, 12/12
capturas com gráficos completos.

## Decisão — chips de destaque das pools NÃO viram verdes

Avaliado (o brief deixava a escolha comigo): [ maior hashrate ]/[ menor fee ]
seguem em zeph-300. Verde no v2 é voz de ESTADO (saudável/normal — rig
minerando, reserva na faixa); os chips são RANKING comparativo entre pools.
Pintá-los de verde diluiria a semântica binária good/bad e brigaria com o
laranja de "indisponível agora" na mesma tabela (a tabela viraria painel de
status, não comparador). Registrado também em comentário no PoolsPage.tsx.

## Auto-check v2 — rubrica de 7 perguntas (6 do R1 + daltonismo)

Sétima pergunta desta rodada: "um estado positivo e um negativo na mesma tela
são diferenciáveis por alguém com daltonismo (não só pela cor)?". As 12
capturas re-revisadas (4 telas × 3 breakpoints, .e2e-out/shot-*.png de
2026-07-10 pós-fix da trava):

- /recompensa: hierarquia sobrevive em P&B (escada display→data-lg→lede→
  body→caption + dominância por escala); uma região dominante (manchete +
  gráfico principal; readout no rail é secundário); anti-genérico (colchetes,
  manchete cortada, readout-instrumento, scanline); sem cor a diferenciação
  de série fica com as TEXTURAS (hachura/pontilhado) e rótulos; mobile
  recompõe (rótulo gigante some, rail empilha, moldura fica); daltonismo:
  selo verde `[ ✓ NA FAIXA ALVO ]` vs banner/trechos laranja — glifo (✓ vs !)
  + texto por extenso carregam o sentido, não o matiz. **7/7.**
- /rede: hashrate dominante; badge ✓/⚠ + texto; countdown em data-lg;
  recomposição mobile ok. **7/7** (positivo e negativo não coexistem — a
  troca de estado mantém glifo+texto).
- /pools: tabela dominante; chips são texto; linha indisponível tem [ ! ] +
  frase; rolagem horizontal contida no container no mobile. **7/7.**
- /meu-rig: a tela onde positivo e negativo COEXISTEM — verde
  `[ Minerando normal ]` (contorno + ponto + frase) contra laranja
  `[ offline ]` nos workers (tag + linha esmaecida) e
  `[ Hashrate abaixo do esperado ]` (contorno + frase; offline é SÓLIDO —
  peso distingue os dois negativos entre si). Em escala de cinza todos os
  estados continuam nomeados por texto. **7/7.**

Nenhuma tela falhou em pergunta alguma (critério era ≤1 falha por tela).

Evidências regeneráveis desta rodada em .e2e-out/: shot-*-{desktop,tablet,
mobile}.png (12), ratio-bug-{antes,depois}-t{7,16}.png (bug do painel),
zeph-hue-comparison.png (matiz antigo vs novo — página-fonte em
scripts/zeph-hue-compare.html), rewards-{desktop,tablet,mobile,lowratio,
brokenrewards}.png e rig-*.png/pools-normal.png dos e2e. Suíte final v2:
rewards normal/lowratio/brokenrewards + rig normal/notfound + pools normal —
**TUDO PASSOU em 2026-07-10**; `npm run build` limpo.

# NOTES — Prompt N1: casca vira rail vertical (2026-07-10)

A casca de navegação era a única peça do produto sem composição "Sinal
Técnico" própria (barra-topo genérica). Virou rail vertical FIXO à esquerda
em `xl:`+: LogoMark no topo, wordmark empilhado ("Zephyr" / "Mining Hub" em
data-md), os 4 itens de nav na vertical (mesma convenção mono `[ Rótulo ]`,
colchetes transparentes no inativo — zero layout shift na troca de rota),
divisor hairline vertical, bg chapado ink-950 (mesmo tratamento da barra do
R1/R2 — o conteúdo rola por baixo do rail, bg transparente vazaria texto).
Largura 14rem (w-56): o rótulo mais longo, `[ Raio-X da Recompensa ]`
(24 chars mono a 12px ≈ 173px), cabe em 1 linha nos 184px internos (px-5).
Footer passou pra DENTRO da coluna: full-width real começaria escondido
embaixo do rail fixo e opaco. `main` mantém `max-w-6xl` centrado na coluna —
a medida de leitura dos módulos foi desenhada contra esse cap; o rail muda
onde a coluna começa, não a largura que ela comporta. Nenhum token novo:
tudo ink/hairline/zeph/mist + escala --text-* existentes.

## Tamanho do logo no rail — 128px, decidido por captura, não de olho

Método: `scripts/rail-logo-shots.mjs` (novo) redimensiona o SVG da marca AO
VIVO no app real e captura crop ×1 + lupa nearest-neighbor ×4 dos MESMOS
pixels (receita do logo-preview/logo-shots; deviceScaleFactor 1 de propósito
— retina dobraria os pixels e mascararia o piso). Lado do ponto por tamanho:
S×0,66/22 → 38px = 1,1px · 64px = 1,9px · 80px = 2,4px · 96px = 2,9px ·
128px = 3,8px. Veredito nos crops ×1 (.e2e-out/logo/rail-{64,80,96,112,128}px
.png + -lupa4x.png): a 64 a variação tonal mal existe; a 96 lê, mas pede
atenção; a 128 os 5 tons da rampa semBranco se distinguem À PRIMEIRA VISTA e
a lupa confirma que é tom por ponto, não artefato de anti-aliasing. Critério
do prompt era "lê a olho nu sem zoom" → 128px. A barra estreita (<xl) segue
com 38px — ali a marca é silhueta mesmo; o momento de textura vive no rail.

## Breakpoint do rail — xl, não lg: o aperto fotografado

Hipótese: módulos abrem 2 colunas em `lg:` (grid `[minmax(0,1fr)_19rem]`)
assumindo a viewport INTEIRA, e os heros usam clamp com vw (viewport-
relativo, não encolhe com a coluna). Com rail de 224px em lg, a 1024px a
coluna dominante de /rede cai pra ~408px com fonte de hero a 10vw ≈ 102px.
Testado DE VERDADE (simulação DOM do rail a 1024, CDP): o hero "52,91 MH/s"
QUEBROU em duas linhas ("52,91" / "MH/s") — exatamente o aperto previsto.
Invariante que fecha a conta: coluna com rail ≥ largura de design dos
módulos em lg exige viewport ≥ 1024 + 224 = 1248 → primeiro degrau Tailwind
é xl (1280). A 1280 real (capturado): hero em 1 linha, 2 colunas folgadas.
Entre 1024–1279 a casca mostra a barra horizontal e os módulos ficam com a
largura plena — como no R2.

## Full-bleed do Raio-X — w-screen → calc(100vw − rail)

O truque `left-1/2 w-screen -translate-x-1/2` assume main centrado na
VIEWPORT. Com o rail, main centra na COLUNA (centro deslocado rail/2 pra
direita): a seção w-screen começaria rail/2 DEBAIXO do rail e o wrapper
interno (que replica `mx-auto max-w-6xl px-*` do main) desalinharia do resto
do conteúdo sempre que o cap não satura. Fix: a casca publica
`--shell-rail-w` (0px sem rail, 14rem em xl+) e a seção usa
`w-[calc(100vw_-_var(--shell-rail-w,0px))]`. A conta: main centrado na
coluna ⇒ centro da seção = centro da coluna ⇒ seção de largura
(100vw − rail) cobre EXATAMENTE a coluna, e o wrapper interno enxerga a
mesma largura disponível que o main ⇒ alinhamento idêntico em qualquer
viewport (medido a 1360: conteúdo interno e main a 7px um do outro — esse
desvio é a meia-calha da scrollbar, 100vw > clientWidth, e JÁ EXISTIA com o
w-screen original em viewports abaixo do cap; paridade, não regressão). Sem
rail o calc degenera pra 100vw = o w-screen de antes. A manchete gigante
continua cortando na borda DIREITA real da tela (overflow-x-clip da própria
seção + do root).

## Recomposição < xl e acessibilidade

Abaixo de xl NÃO existe rail espremido: a casca recompõe pra barra
horizontal exata do R2 (logo 38px + wordmark + nav inline com wrap).
Testada de verdade a 768 e 390 (design-shots + capturas próprias) — nav em
2 linhas no 390, como antes. Os dois arranjos coexistem no DOM (`xl:hidden`
vs `hidden xl:flex`) com os links gerados pela MESMA função (NavLinks);
árvore de acessibilidade conferida via CDP `Accessibility.getFullAXTree`
nos dois arranjos: "Mining Hub" presente exatamente 1× como StaticText
(display:none tira o arranjo inativo da árvore), nenhuma imagem decorativa
exposta (LogoMark segue aria-hidden; o wordmark visível carrega o nome).
Contraste do rail: nenhum par novo — mist-400 5,67:1 / zeph-300 7,63:1 /
mist-100 16,8:1 sobre ink-950, re-medidos com scripts/contrast-check.mjs.

## Verificação N1

`npm run build` limpo · `npm run lint` sem warning novo (o boilerplate CDP
do rail-logo-shots herdava um ternário-expressão do logo-shots — corrigido;
armadilha nova documentada: seletor com `||` interpolado em template de
Runtime.evaluate precisa de parênteses, senão o member access liga só ao 2º
operando e o returnByValue tenta serializar um nó DOM e explode com "Object
reference chain is too long") · e2e SEM alteração de script: pools normal +
rewards normal + rig normal — **TUDO PASSOU 2026-07-10** · design-shots 12
capturas re-geradas e revisadas (artefato conhecido: rail é fixed e o
screenshot é de página inteira — abaixo da 1ª dobra a coluna esquerda sai
vazia NA FOTO; no navegador o rail acompanha o scroll). Evidências:
.e2e-out/logo/rail-*.png (estudo de tamanho + contexto) e
.e2e-out/shot-*.png (12 telas).
