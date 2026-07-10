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
