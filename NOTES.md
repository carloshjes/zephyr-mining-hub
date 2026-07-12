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

# NOTES — Prompt N2: recomposição mobile + cintilância da marca (2026-07-10)

Duas lacunas vistas com o produto rodando de verdade: abaixo de xl a casca
ainda era o header intacto do R2 (logo 38px silhueta + nav quebrando em
flex-wrap desalinhado) — o único lugar com menos cuidado de composição que o
resto do sistema — e a cintilância da F3, validada na exploração (Prompt L1),
nunca tinha sido portada (LogoMark 100% estático por decisão da época, com a
ressalva "se um dia for pro app, respeitar prefers-reduced-motion" — o dia
chegou, a pedido do Carlos).

## Bloco de topo mobile — mesma linguagem do rail, custo vertical MEDIDO

Método: `scripts/mobile-shell-shots.mjs` (novo; receita do rail-logo-shots —
crop ×1 + lupa nearest-neighbor ×4 no app real, deviceScaleFactor 1 porque a
régua conservadora é o ×1, retina só melhora) + medição da altura do bloco
por candidato num viewport 390×700 (altura real de celular pequeno).

- Empilhamento 1:1 do rail (logo 128 → wordmark → nav vertical, com os
  respiros do rail, medido do rail REAL): **419px = 60% de um viewport de
  700px** — rejeitado com número. No rail esse empilhamento é de graça (tem
  a altura inteira da viewport); no topo do mobile competiria com o conteúdo.
- Candidatos (logo → altura do bloco → % de 700px): 64 → 165px (24%) ·
  80 → 181px (26%) · **96 → 197px (28%)** · 112 → 213px (30%).
- Veredito do tom por ponto nos crops ×1 (.e2e-out/logo/mobile-{64,80,96,
  112}px.png + -lupa4x.png): a 64 a variação quase não existe; a 80 é sutil;
  a **96 lê a olho nu** (ponto ≈2,9px — mesma leitura do estudo N1) dentro
  do orçamento de altura; 112 iria ao teto por ganho marginal. Escolhido
  96px — 2,5× os 38px antigos, e legível o bastante pra justificar a
  cintilância também aqui (critério do prompt: tom ilegível = não animar).
- Composição final: logo 96 com wordmark empilhado AO LADO (ordem de leitura
  logo → wordmark → nav preservada; wordmark ABAIXO do logo somaria ~64px de
  altura sem ganho de leitura) e nav em **grade 2×2 deliberada** a <md, linha
  única em md+. Grade com `grid-cols-[auto_auto]` (colunas por conteúdo) de
  propósito: colunas fr iguais estourariam — o rótulo mais longo mede ≈173px
  e (358 − gap)/2 < 173 a 390px. Conferido ao vivo: exatamente 2 linhas de
  nav a 390 (grade, não wrap acidental) e 1 linha a 768; bloco a 768 =
  167px (16% de 1024). Contextos: mobile-context-{390,768}.png.

## Cintilância — portada do preview, não redesenhada

- Fonte: card F3 · CINTILÂNCIA de scripts/logo-preview.html,
  `assignTwinkle(dots, seed 23)` — r < 0,30 anima, grupo = 1 + floor(r/0,10).
  O logo-export.mjs agora COLHE as classes twN como 4º valor da tupla
  ([x, y, tom, tw], tw 0 = estático, 1–3 = grupo de fase) em vez de
  descartá-las; sanidade nova: fração cintilante fora de 20–40% aborta o
  export. Resultado real: **95/288 pontos (33,0%) em grupos 30/33/32**.
  O export também emite dots-literal.txt (o array DOTS pronto) — o LogoMark
  foi atualizado por splice programático, nenhum ponto editado à mão
  (conferido: 0 divergências de x/y/tom contra o array anterior).
- Keyframes e tempos centralizados no @theme (`--animate-twinkle-1/2/3`):
  twinkle 2,6s ease-in-out infinite, atrasos 0/0,9s/1,7s por grupo,
  opacidade 1→0,35→1 (nunca zera) — os valores EXATOS do preview, nada
  reinventado. Classe aplicada por ponto via lookup de strings completas
  (Tailwind só gera o que lê literal no fonte), SEMPRE pareada com
  `motion-reduce:animate-none`.
- Prova ao vivo (sonda CDP, 16 checks, TUDO PASSOU 2026-07-10): no rail
  (1360) e no bloco mobile (390) — 288 pontos, grupos 30/33/32,
  animationName=twinkle 2,6s com atrasos 0s/0,9s/1,7s por grupo, ponto sem
  fase segue estático, opacidade oscilando ao vivo (min 0,35 / max ≈1). Com
  **prefers-reduced-motion: reduce EMULADO** (CDP setEmulatedMedia):
  animationName=none e opacidade constante em 1 por 1,2s de amostragem —
  desliga DE VERDADE; removendo a emulação, a animação volta.

## Desvio colateral — espelho de tokens do logo-preview.html estava no R1

A primeira rodada do export regenerou favicon-zeph.svg com hex #a996f5: o
espelho manual de tokens do preview (cujo comentário manda atualizá-lo quando
os tokens do app mudarem) nunca recebeu a recalibração v2 de matiz. Não afeta
os pontos (posição/tom/fase são geometria + índices de token — daí as 0
divergências acima), mas era armadilha pro byproduct do favicon. Espelho
re-sincronizado (ink-950 neutro + família zeph 244°) e export re-rodado:
favicon-zeph.svg agora resolve #9c96f5, igual à decisão de produção.

## Verificação N2

`npm run build` limpo · lint sem warning novo (2 pré-existentes em arquivos
não tocados: logo-shots.mjs e SeriesSwatch.tsx) · regra de acessibilidade do
N1 re-provada pós-mudança de markup (CDP getFullAXTree nos dois arranjos:
"Mining Hub" StaticText exatamente 1×, nenhuma imagem decorativa exposta) ·
e2e SEM alteração de script: rewards normal + rig normal + pools normal —
**TUDO PASSOU 2026-07-10** · design-shots re-rodado, 12/12 capturas
revisadas: bloco novo
consistente nas 4 telas em tablet/mobile, rail intacto em desktop (pontos da
marca aparecem em opacidades variadas nas fotos — é a cintilância congelada
pelo screenshot, esperado, não defeito). Evidências: .e2e-out/logo/
mobile-*.png (estudo de tamanho + contextos) e .e2e-out/shot-*.png.

# NOTES — Prompt R3: Sinal Técnico v3 (2026-07-10/11)

Oito pontos trazidos pelo Carlos usando o produto real, um por área (fundo
global + as 4 telas). Evolução localizada sobre o v2, não redesign: tokens
ink/zeph/mist/good/bad, convenção mono, composição dominante/rail e a regra
anti-gradiente seguem os mesmos. A sessão que executou os itens 0–4b caiu no
limite antes da verificação; o item 4c (gráfico novo do rig), a sondagem de
payments, TODA a verificação final e estas notas foram concluídos na retomada
de 2026-07-11 — nada abaixo é relato herdado sem re-execução: contraste,
build, e2e, capturas e reduced-motion foram medidos de novo nesta retomada.

## Fundo v3 — candidatos medidos, escolhido #141414

Pedido de uso real: o preto #0a0a0a pesava. Regra da decisão: o mais claro
que ainda é "quase preto" neutro (croma zero) E preserva AA no piso de texto.
Três candidatos medidos com scripts/contrast-check.mjs (seção "candidatos"
do output) contra o próprio fundo E a célula clara da textura nova:

- #101010: passa tudo, mas clareia tão pouco sobre #0a0a0a que não responde
  ao pedido (diferença imperceptível em tela real).
- **#141414 (escolhido)**: clareamento visível, identidade terminal intacta,
  mist-400 5,28:1 no fundo / 5,04:1 na célula clara — folga real sobre o
  piso AA de 4,5.
- #181818: também passa (4,83:1 na célula), mas a margem sobre 4,5 fica fina
  demais pra um token que é PISO do sistema, e o fundo já não lê "quase
  preto" ao lado do rail/elevações.

Elevação e divisor NÃO podiam ficar parados: ink-900 v2 (#141119) teria
1,01:1 sobre o fundo novo (elevação invisível) e a hairline 1,14:1. Subiram
JUNTO preservando matiz e a razão do v2 (medido no contrast-check):
ink-900 #141119 → **#1d1824** (h 262,5°→265°, 1,06:1 sobre o fundo — igual
v2) · hairline #221f29 → **#282530** (1,23:1, mesma presença).

## Textura de blocos com deriva — técnica, custo e pior caso

Scanline (listras 1px) → grade de blocos 3px com vão 3px (conic-gradient de
2 cores num tile de 6px — sem degradê visual; segue a MESMA exceção única e
documentada à regra anti-gradiente, não abre precedente). Branco a 2%, como
antes; pior caso de contraste agora é a célula clara **#191919** (antes a
listra #0f0f0f) — todos os números da tabela abaixo já são contra ela.

Movimento: deriva diagonal de 1 período (6px) por ciclo de 8s ≈ 0,75px/s —
loop sem emenda (transform volta ao início exatamente 1 tile depois). POR QUE
pseudo-elemento fixo + transform, e não animar background-position no body:
background-position repinta a viewport inteira a cada frame; transform num
layer `position:fixed` fica no compositor. O layer nasce 6px maior pra
cima/esquerda (inset -6px) pra deriva nunca expor borda sem textura;
z-index -1 deixa atrás de todo conteúdo (bgs opacos — rail, thead — cobrem a
textura, como já cobriam a scanline). Com prefers-reduced-motion a GRADE fica
e a DERIVA para (media query explícita — prova na seção de reduced-motion).

## Contraste v3 re-medido (WCAG 2.2, scripts/contrast-check.mjs, 2026-07-11)

token | ink-950 #141414 | célula clara #191919 | ink-900 #1d1824
------|-----------------|----------------------|----------------
zeph-300 | 7,10:1 | 6,78:1 | 6,70:1
zeph-500 | 3,51:1 | 3,35:1 | 3,31:1
zeph-700 | 1,87:1 | 1,78:1 | 1,76:1 (SÓ gráfico c/ alívio)
mist-100 | 15,61:1 | 14,89:1 | 14,72:1
mist-300 | 8,97:1 | 8,56:1 | 8,46:1
mist-400 | 5,28:1 | 5,04:1 | 4,98:1 (piso de texto corrido — segue AA)
mist-600 | 2,50:1 | 2,39:1 | 2,36:1 (SÓ decoração)
good | 8,08:1 | 7,72:1 | 7,63:1
bad | 6,57:1 | 6,27:1 | 6,20:1

Texto ink-950 sobre chapado: bad 6,57:1 · good 8,08:1 · zeph-300 7,10:1.
Nenhum token precisou de ajuste de claridade: todos os papéis continuam nos
mesmos pisos do v2 (texto ≥4,5, gráfico ≥3, decorativo documentado).

## Tipografia — headline 8rem→6rem, display 13rem→11rem, sub INTACTO

- --text-headline: teto 8rem (128px) estourava o hero de /rede e /meu-rig em
  desktop; 6rem (96px) segue dono da dobra nas DUAS telas (capturas
  shot-{rede,meu-rig}-desktop.png). Piso 3,5rem e inclinação 10vw intactos:
  abaixo de ~960px de viewport nada muda (o clamp nem chegava no teto).
- --text-display: 13rem→11rem, mais conservador de propósito (encolher
  demais mata o signature move). O display-sub MANTÉM o teto de 7rem: é o
  sub ("pro minerador") quem sangra na borda — encolher os dois juntos
  apagaria o corte; encolher só o número o preserva. Conferido full-bleed
  nos 3 breakpoints (shot-recompensa-*.png).

## Halving virou readout (/rede)

Era o único elemento secundário do produto sem tratamento de instrumento
(um `border-t` sobre dígitos soltos). Agora: a MESMA receita do painel
RESERVE RATIO — moldura hairline sempre presente + bg-ink-900 + cabeçalho
`[ PRÓXIMO HALVING ]` separado por hairline — compartilhada pelos 3 estados
(carregando/cauda/contando) via ReadoutFrame local: o instrumento nunca rende
como retângulo vazio (mesma regra pós-bug do painel do Raio-X).

## Tendência de hashrate da rede — coletada NESTE navegador (/rede)

Não existe série histórica de hashrate/dificuldade em NENHUMA API confirmada
do projeto (Explorer é snapshot; Scanner não tem os campos — conferido campo
a campo no Prompt 1). Inventar/mockar viola a convenção → a tendência é
coletada localmente: networkHashrateHistory.ts (mesmo padrão do luckHistory):
- gap 115s: hash_rate deriva da dificuldade, que só muda a cada bloco
  (~120s) — amostrar mais rápido duplicaria valores; 115 (e não 120) evita
  perder a leitura de um bloco por jitter do polling de 30s.
- cap 360 leituras ≈ 12h acumuláveis (~9KB de localStorage).
A UI diz a procedência ("coletada neste navegador... não há série histórica
pública") — nunca fingir histórico. Desenho: LuckSparkline foi GENERALIZADO
em src/components/ui/TrendSparkline.tsx (values + summary + referenceValue
opcional + width/height) — o luck das pools e as duas tendências novas usam
o MESMO desenho; pools-e2e passou sem alteração de seletor.

## Sondagem de payments (2026-07-11) — 2Miners confirma, HeroMiners NÃO

Método de sempre: curl com Origin real, formato conferido no corpo.
- **2Miners CONFIRMADO ao vivo**: GET /api/accounts/<endereço> devolve
  `payments: [{ amount, timestamp, tx }]` (30 por página, `paymentsTotal`)
  E `sumrewards` (janelas 1h/12h/24h/7d/30d) — CORS `*`. Dado suficiente
  pra "pagamentos do dia" NESSA pool.
- **HeroMiners segue INCONFIRMÁVEL no sucesso**: stats_address com endereço
  alheio re-confirmou o formato de erro (HTTP 200, `{"error":"Not found"}`,
  CORS `*`), mas continua sem endereço ZEPH real de teste — e o /api/stats
  pool-wide expõe payments SERIALIZADOS SEM endereço
  (`"hash:amount:fee:mixin"` + timestamp), então não há como descobrir um
  endereço ativo pela própria API. O array `payments` por minerador segue
  conhecido só do código-fonte do upstream.
A regra do prompt exigia confirmar AS DUAS pools (formato E CORS) → gráfico
de pagamentos NÃO foi implementado; o gráfico novo do rig é **hashrate
diário** (abaixo). Registro pro futuro: se um endereço HeroMiners real
aparecer, a sondagem é 1 curl.

## Gráfico novo do rig — hashrate diário, store separado DE PROPÓSITO

Parâmetros (rigStatus.ts): gap **290s** (~5min — sobrevive ao jitter do
polling de 60s da pool) · cap **288 leituras = 24h exatas** em passos de
5min (~7KB por chave). Fonte: SÓ o hashrate da pool (carteira inteira) — o
XMRig mede um rig e misturar escalas falsearia a curva. Store SEPARADO
(`zephyr-hub.rig.hashrate-daily.v1`) do histórico de status: a régua do
"abaixo do esperado" é a média de ~30min (30×55s) e mudar a cadência dela
mudaria a SEMÂNTICA do estado (além do rig-e2e semear aquele storage
direto). A implementação virou motor genérico único (loadAllFrom/appendTo)
parametrizado por storageKey/gap/cap — os dois históricos usam o mesmo
código. Na tela: mesma receita de instrumento do Pulso da Rede (rótulo mono
`[ TENDÊNCIA 24 H · COLETADA NESTE NAVEGADOR ]` + TrendSparkline 340×64 +
legenda de procedência), na coluna dominante abaixo do StatusBadge — o rail
já carrega 4 StatCards e mais um item lá viraria card farm.

## Causa raiz + fix — rótulo do piso cortando no ReserveRatioChart

Reproduzido ANTES do fix (arquivo de HEAD restaurado temporariamente +
cenário forçado via interceptação CDP, mesma técnica do lowratio;
sondagem em scratchpad/ratio-label-probe.mjs desta sessão):
- Cenário do bug: série remapeada pra [3,5–3,935] → yMax = 4,00025 → piso
  4,0 colado no TETO do domínio. Medido pré-fix: linha do piso em y=14,07
  (MARGINS.top=14), baseline do rótulo em 10,07, **ink a 0,07px da borda do
  SVG** — com `overflow: hidden` no svg, qualquer variação de métrica de
  fonte corta (na captura, os ascendentes ENCOSTAM na moldura do painel).
  Segundo sintoma, visível no dado real da semana (ratio pairando no piso):
  a série atravessava a banda do texto.
- CAUSA RAIZ: offset fixo `y(TARGET_FLOOR) − 4` — cego pra borda do plot e
  pra série. MARGINS.top (14px) < vão (4) + ascent da caption (~10px):
  geometricamente NÃO EXISTE espaço acima da linha quando o piso está a
  menos de ~16px do teto do plot.
- FIX (v3): flip de posição com regra dura (nunca sair do plot) +
  desempate por colisão (podendo os dois lados, fica no lado com menos
  pontos da série dentro da banda do texto, só no trecho x do rótulo) +
  halo `paintOrder: stroke` na cor do painel (ink-900) no próprio <text> —
  nenhum elemento novo, contrato do e2e intacto.
- Medido pós-fix nos DOIS extremos: cenário do bug → rótulo flipa pra
  BAIXO, ink 17,07–30,07 (folga total); cenário OPOSTO (série [4,02–4,8],
  piso a 14,5px do CHÃO do plot) → rótulo fica ACIMA, ink 137,46–150,46 —
  o fix não foi "empurrar pra baixo": foi testado dos dois lados.
- O comentário no código da sessão anterior estimava "0,32px"; a
  reprodução mediu 0,07px e o comentário foi corrigido pro valor medido.

## Respiração das faixas do Raio-X — só opacity, e2e intacto

`--animate-wash-breathe`: opacity do ELEMENTO oscila 1→0,82, ciclo 6s,
ease-in-out, FASE ÚNICA nas 3 faixas (dessincronizar leria como tremulação
entre vizinhas). Multiplicativa sobre o washOpacity próprio de cada série
(via opacity do elemento, não fillOpacity) — a cor computada, o fillOpacity
base e a contagem de <path> que o rewards-e2e verifica ficam intactos; borda
e textura da série NÃO respiram (o encoding de identificação não pode
variar). Só a faixa ATIVA respira (governança zerada nem renderiza).
rewards-e2e normal/lowratio/brokenrewards: **TUDO PASSOU sem alteração de
script** (2026-07-11).

## StatusBadge do rig — tints MEDIDOS + halo "ao vivo"

Fundo tintado em normal/below preservando a escada de peso do R2
(good/10 < bad/20 < bad sólido — não igualou os três; a distinção entre os
DOIS negativos segue por peso, nunca matiz). Contraste medido com
composição real do wash sobre o fundo v3 (contrast-check, seção "tints"):
texto good sobre bg-good/10 = fundo #15261b, **6,96:1** · texto bad sobre
bg-bad/20 = fundo #422714, **4,89:1** (bad/15 daria 5,37:1 mas achataria o
degrau vs good/10 — o /20 compra distância de peso mantendo AA).
Halo: `--animate-status-ping` (anel que expande 1→2,4 e esvai, 2,4s — tempo
na família do twinkle, não o 1s frenético do ping padrão) SÓ no estado
normal: animar "vivo" num indicador offline não faz sentido. Reduced-motion
usa `motion-reduce:hidden` em vez de animate-none DE PROPÓSITO: parado, o
fantasma seria um disco estático em cima do ponto — com movimento reduzido
ele SOME (mesma política: nada se move).

## Scrollbar e SegmentedControl nos tokens

- `@utility scrollbar-themed` (uma classe pros 3 containers roláveis:
  tabela do Raio-X, Bússola, workers do rig): scrollbar-color pra
  Firefox/Chromium novo + ::-webkit-* pro Chromium antigo (Chromium com
  scrollbar-color IGNORA ::-webkit-* — comportamento especificado). Track
  ink-900, thumb mist-600 (2,39:1 — decorativo, mesma classe de uso do
  token; o affordance de rolagem não depende só dele: a tabela corta no
  meio de coluna).
- SegmentedControl (Janela/Escala): a faixa inteira senta em bg-ink-900
  (antes o inativo era transparente e parecia "não clicável" até o hover);
  o ativo segue com tint zeph-800/40 POR CIMA da elevação.

## Prova do reduced-motion (emulado via CDP, 2026-07-11)

scratchpad/reduced-motion-probe.mjs — Emulation.setEmulatedMedia com
prefers-reduced-motion: reduce, medindo computed style ANTES/DEPOIS/DE NOVO:
- textura de fundo: animationName `texture-drift` → **none** → volta.
- respiração das faixas: `wash-breathe` nas 3 faixas → **nenhuma** → volta.
- halo do badge normal: display block + `status-ping` → **display none** →
  volta. (O elemento continua no DOM — quem o esconde é a media query, como
  desenhado.)
**TUDO PASSOU.** Draw-in/data-pulse/twinkle já tinham prova no R2/N2 e não
mudaram.

## Auto-check v3 — rubrica de 8 perguntas (7 do R2 + textura)

Oitava pergunta desta rodada: "o fundo mais claro e a textura em movimento
ainda deixam o dado real como a coisa mais viva da tela, ou a textura
compete com o gráfico/número?". As 12 capturas (shot-*-{desktop,tablet,
mobile}.png de 2026-07-11, pós-R3):

- /rede: hashrate dominante no headline recalibrado; halving agora é
  instrumento mas segue secundário (escala data-lg, abaixo da dobra);
  tendência local diz a procedência em texto; textura a 2% com deriva de
  0,75px/s não disputa com nada — o dado segue a única coisa "acesa".
  **8/8.**
- /pools: chips sólidos são o único elemento cheio da tabela e continuam
  RANKING (matiz zeph, não good/bad); linha indisponível segue [ ! ]+frase;
  scrollbar agora no tema. **8/8.**
- /recompensa: manchete 11rem segue dona da dobra com o corte do sub
  preservado; readout elevado em ink-900 destaca por SUPERFÍCIE, não por
  glow; respiração de 0,18 de amplitude em 6s lê como "vivo", não como
  animação — de longe a tela parece estática até você reparar. **8/8.**
- /meu-rig: positivo e negativo coexistem distinguíveis sem cor (texto +
  escada de peso tint/sólido); halo só no normal; tendência 24h na coluna
  dominante não vira segunda dominante (340×64, mono caption). **8/8.**

Nenhuma tela falhou em pergunta alguma.

## Verificação R3 (retomada 2026-07-11 — tudo re-executado)

`npm run build` limpo (228ms, zero warning) · contrast-check re-rodado
(tabela acima) · e2e completa SEM alteração de script: rewards
normal/lowratio/brokenrewards + rig normal/notfound + pools normal —
**TUDO PASSOU 2026-07-11** · design-shots 12/12 revisadas (rubrica acima) ·
reduced-motion provado emulado (seção acima) · sondagem de payments
documentada (seção acima). Evidências regeneráveis em .e2e-out/; as
sondagens pontuais (ratio-label-probe, reduced-motion-probe) viveram no
scratchpad da sessão — os números e o método estão nas seções acima.

# NOTES — Prompt R4: regressões e acabamento de uso real (2026-07-11)

Seis pontos anotados pelo Carlos em screenshots do build R3 em produção —
mistura de bug de layout (chips da Bússola, workers cortando) e acabamento
dentro do sistema fechado (rail/header maiores, rampa da logo, display,
scrollbar, StatusBadge). Tokens de cor, semântica good/bad, composição
dominante/rail e convenção mono intactos.

## Rampa da logo — 2ª rodada sem branco: mist-300 SAIU

Em uso real o mist-300 (#b7b2c9 — o tom MAIS claro e o de MAIOR peso, 30%
dos 288 pontos) ainda lia como "branco". Rampa semBranco reduzida a 4 tons
(zeph-300/mist-400/zeph-500/zeph-700) com os pesos antigos redistribuídos
proporcionalmente (÷0,70): **[.40, .29, .21, .10]**. Teto de brilho agora é
o zeph-300 (7,1:1) — a marca é só roxo/cinza-roxo. Fluxo de sempre:
logo-preview.html (rampa + pesos do card F3) → logo-export.mjs (sanidade:
288 pts, cintilância 95 = 33,0% em grupos 30/33/32 — IDÊNTICA, os seeds não
mudaram) → splice programático no LogoMark.tsx (verificado: 0 divergências
de geometria/fase, 114 tons re-sorteados). Favicon inalterado (#9c96f5).
Captura ampliada (rail-176px-lupa4x.png): nenhum tom lê como branco; os 4
degraus seguem distinguíveis a olho nu.

## Rail 16rem — o TETO com breakpoint xl, medido de novo

Pedido: rail inteiro maior (sobrava espaço). A conta do N1 limita: módulos
abrem 2 colunas em lg assumindo viewport ≥1024 ⇒ rail ≤ 1280 − 1024 =
**256px (16rem) com breakpoint xl**. 18rem forçaria 2xl (1536) e tiraria o
rail da faixa 1280–1535 — a mais comum de desktop; rejeitado. Medido a 1280
EXATOS (scratchpad/rail-invariant-probe): rail 256px · coluna/main = 1024px
· hero "92,73 MH/s" a 96px em **1 linha** · os 4 itens de nav em 1 linha
cada · full-bleed do Raio-X cobre a coluna exata (left 249 = os mesmos 7px
de meia-calha de scrollbar do N1 — paridade). Dentro do rail: logo 128 →
**176px** (ponto 176×0,66/22 ≈ 5,3px; teto físico do conteúdo é 216px =
256 − 2×20 de padding), wordmark data-md → **data-lg**, nav label →
**body** (o rótulo mais longo, 24 chars mono a 14px ≈ 202px, cabe nos 216),
py-6 → py-8. Estudo de tamanho re-fotografado em rail-{128…192}px.png.

## Header mobile — base alinhada + 128px (régua nova, medida)

`items-center` → `items-end` (base do wordmark na base da logo — pedido) e
wordmark pra data-lg também aqui. Régua da rodada: presença primeiro, custo
de altura documentado (inverte a prioridade do N2, a pedido de quem usa).
Candidatos num viewport 390×700 (mobile-shell-shots): 96 → 197px (28%) ·
112 → 213px (30%) · **128 → 229px (33%, escolhido)** · 144 → 245px (35%,
ganho marginal — rejeitado com número). Nav segue grade deliberada: 2
linhas a 390, 1 a 768 (bloco a 768: 199px). Nav mobile FICA em text-label
(12px): a 14px a grade 2×2 estoura os 358px úteis de um viewport 390
(173+144+24 de gap = 341 cabem; 202+168+24 = 394 não).

## Bússola — chips empilhados (bug real) + workers nowrap

O `flex flex-wrap` do R3 quebrava desalinhado quando a MESMA pool ganhava
os dois chips — cenário real: HeroMiners é maior hashrate E única com fee.
Fix: célula vira `flex flex-col items-start` — nome numa linha, chips
empilhados abaixo, à esquerda. Medido ao vivo com o caso real (1360 e
1024): tops distintos, lefts iguais, ambos abaixo do nome. A contagem
"N workers" ganhou `whitespace-nowrap` (quebrava "2.206 / workers"
competindo por largura) — 1 linha medida nas duas larguras. pools-e2e
ganhou 3 checks permanentes do cenário (degradam pra "n/a" sem falhar se
nenhuma pool tiver os dois chips num ciclo futuro).

## Raio-X — display 9rem, legenda única, rótulo do piso REMOVIDO

- **--text-display: teto 11rem → 9rem** (mais uma rodada de uso real; mesmo
  passo do R3). Medido: 144px a 1360 · 115,2px a 768 (15vw — inalterado) ·
  72px a 390 (piso — inalterado). O corte do sub na borda segue vivo
  (shot-recompensa-desktop.png); display-sub intacto de propósito.
- **Legenda da manchete removida** (linhas com SeriesSwatch + valor em ZEPH
  por fatia): duplicava a legenda estrutural do gráfico "Divisão da
  recompensa" logo abaixo — ao vivo lia como repetição. A barra de
  proporção (aria-hidden) fica; os valores em ZEPH por fatia seguem na
  tabela e no tooltip. Medido: 1 grupo de legenda na tela (era 2).
- **Rótulo "piso da faixa alvo (4,0)" saiu DE VEZ** (decisão do Carlos): na
  janela de 1.000 blocos a série oscila tanto ao redor do piso que nenhum
  lado ficava legível — o flip do R3 tratava o sintoma, não o caso. Só a
  linha tracejada demarca; o "4,0" segue no eixo Y e no "alvo: 4,0–8,0".
  Código morto removido (floorLabelY, FLOOR_LABEL_*, função de colisão).
  Sondado nas 4 janelas (100/200/500/1000): rótulo ausente, linha presente.
  **Contrato do rewards-e2e atualizado**: o check "rótulo do piso visível"
  (lowratio) virou DOIS — "rótulo AUSENTE" + "linha tracejada presente".
  Único ajuste de script da rodada, documentado no próprio check.
- **scrollbar-themed: 10px → 8px, thumb mist-600 → hairline** (o mist-600,
  matiz ≈250°, ainda lia com tinta de roxo; o hairline é a mesma classe de
  presença dos divisores). Confirmação computada: scrollbar-color
  rgb(40,37,48) sobre rgb(29,24,36). Uma utility só — refletiu nas 3
  tabelas (Raio-X, Bússola, workers do Rig) sem tocar componente.

## Rig — tendência em BARRAS + saldo pendente como 2ª métrica (entrou)

- TrendSparkline ganhou `variant: 'line' | 'bars'` (default line — Pulso da
  Rede e Bússola intactos, pools-e2e passou sem mudança). Barras partem do
  piso do DOMÍNIO (min − 15% do span), não do zero — textura de tendência,
  não magnitude (hashrate estável ancorado no zero viraria bloco chapado);
  barra corrente no accent zeph-300, demais mist-600; com as 288 leituras
  cheias a barra afina até 1px e o conjunto lê como textura densa —
  deliberado, mesma linguagem da grade de fundo.
- **pendingBalance ENTROU** como segunda métrica: é dado real do MESMO poll
  (2Miners expõe; HeroMiners pode vir "—" → leitura sai só com hashrate). A
  leitura diária virou {t, h, b?} (validação tolerante: b ausente ok, b
  inválido descarta a leitura; storage e chave inalterados — leituras
  antigas seguem válidas). SEM eixo duplo (regra de dataviz do projeto):
  o saldo é uma FAIXA própria empilhada sob as barras, mesma janela — a
  mesma solução fatia×ratio do Raio-X. A legenda avisa que o saldo ZERA
  quando a pool paga (a serra é o pagamento, não bug); com <2 leituras com
  saldo a faixa nem renderiza (nunca fingir série). rig-e2e intacto: o
  normal semeia só o histórico de STATUS, e a faixa nova é opcional.

## StatusBadge do rig — o normal perdeu a caixa (skill creative-ui-director)

Diagnóstico (modo design-system-constrained-upgrade, lean): na região
DOMINANTE, colado no hero de 96px, o estado normal como chip fechado
(borda + tint + padding) era o único elemento "card" numa tela que resolve
estado com readout mono — e é o estado de 99% do tempo, sempre aceso.
Alternativa considerada (estado embutido na linha de caption do hero):
rejeitada — mistura estado com metadado de fonte e perde o ponto/halo.
Escolhida: **normal = linha de readout nua** (ponto + halo + `[ Minerando
normal ]` mono em good, zero superfície; good sobre ink-950 = 8,08:1, já
medido no v3) · **below/offline INTACTOS do v3** (bad/20 contornado 4,89:1
· bad sólido 6,57:1). A escada de peso do R2 fica MAIS íngreme: nada <
caixa tintada < caixa sólida — superfície agora significa "algo errado".
Nenhum degrau é só-cor (texto por extenso + glifo em todos); halo "ao
vivo" segue exclusivo do normal com motion-reduce:hidden. Supersede o tint
good/10 do normal introduzido no R3 (o pedido de lá era vivacidade; a
desta rodada é pertencimento ao vocabulário — o halo cumpre a vivacidade).
Contratos preservados: data-testid/data-status e os textos dos rótulos
(rig-e2e normal + notfound passaram sem alteração).

## Verificação R4 (2026-07-11)

`npm run build` limpo (175ms) · lint só com os 2 warnings PRÉ-existentes do
N2 (SeriesSwatch.tsx, logo-shots.mjs) · e2e completa: rewards
normal/lowratio/brokenrewards + rig normal/notfound + pools normal (com os
3 checks novos de chips) — **TUDO PASSOU 2026-07-11** · design-shots 12/12
re-fotografadas e revisadas na rubrica de 8 perguntas: as 4 telas passaram
(o rail maior não criou segunda dominante — a marca é âncora de navegação,
não compete com o dado; a textura de barras do rig segue mais quieta que o
hero; display menor deixou a manchete MAIS integrada à dobra sem perder o
corte). Checks extras da rodada: (1) ciclo real com HeroMiners = maior
hashrate E menor fee fotografado com os chips empilhados corretos; (2) as
4 janelas do ratio abertas uma a uma — rótulo do piso ausente em todas.
Sondas da rodada no scratchpad da sessão (rail-invariant-probe,
pools-chips-probe, rewards-round-probe, rig-visual-probe) — números e
método registrados acima. Evidências regeneráveis: .e2e-out/logo/rail-*.png
e mobile-*.png (estudos de tamanho), .e2e-out/pools-chips-*.png,
rewards-round-*.png, rig-round-*.png e shot-*.png (12).

# NOTES — Prompt R5: lapidação final (2026-07-11)

Cinco pontos de uso real com screenshot, quatro com direção fechada pelo
Carlos; a única latitude criativa da rodada foi o tratamento visual das
barras do rig (skill creative-ui-director, seção abaixo). Tokens, semântica
good/bad/zeph, composição dominante/rail e convenção mono intactos — a
rodada adiciona UM token decorativo novo (--color-scroll) e nada mais.

## Instrumentos de tendência em largura MEDIDA (/rede e /meu-rig)

O TrendSparkline de largura fixa 340px deixava ~metade da coluna dominante
vazia em desktop (o instrumento parecia menor que a importância que tem).
Decisão fechada: MEDIR o container com o useElementWidth que os gráficos do
Raio-X já usam, não fixar um width maior na mão.

Armadilha que moldou a implementação: o useElementWidth ata o
ResizeObserver UMA vez no mount (useEffect []), e os dois blocos de
tendência nascem dentro de branch condicional (skeleton primeiro) — medir
no componente da página deixaria o observer preso num ref nulo. Por isso
cada instrumento virou componente FILHO (NetworkTrend em
NetworkPulsePage.tsx, DailyTrend em RigDashboard.tsx), montado só quando o
branch com dado renderiza — a mesma razão de RewardSplitChart ser filho.
O wrapper leva a altura fixa (h-16 / h-24) SÓ com ≥2 leituras, senão o
estado "coletando…" ganharia ~70px de vão morto.

Medido (sondas rede-trend-probe/rig-bars-probe do scratchpad da sessão):
- /rede a 1360: svg = 680px = a coluna dominante exata (1104 de coluna
  − 48 px-6 − 336 aside − 40 gap); a 390: 358px, sem overflow. Altura 64
  mantida (proporção de linha fina lê bem em 680px).
- /meu-rig a 1360: svg = 681px; a 390: 358px, sem overflow. Altura subiu
  64 → 96 JUNTO com a largura (em 681px a fita de 64px lia achatada pro
  papel de único instrumento da tela — ver seção do rig).
- LuckSparkline da Bússola INTACTO (default width=96 não mudou; pools-e2e
  "sparklines renderizados (2 pools)" passou sem alteração).

## Bússola — chips em coluna À DIREITA do nome (contrato de e2e atualizado)

Direção nova do Carlos com screenshot (o empilhado do R4 resolvia o
desalinhamento do flex-wrap do R3, mas com os DOIS chips a linha ficava
alta demais): [ maior hashrate ] AO LADO do nome, na mesma linha;
[ menor fee ] abaixo do PRIMEIRO CHIP — coluna de chips à direita do nome,
não abaixo dele. Com um chip só, ele fica ao lado do nome.

Implementação: célula vira `flex items-start gap-2` com o nome + um
span-wrapper `flex flex-col gap-1 pt-0.5` (o pt-0.5 alinha oticamente o
chip de caption com a linha de text-body do nome). Medido ao vivo com o
caso real (HeroMiners = maior hashrate E única com fee) em 1360 e 1024
(r5-pools-chips-{1360,1024}.png): chip 1 com overlap vertical na caixa do
nome e à direita dele; chip 2 abaixo do chip 1; lefts iguais; linha da
tabela caiu pra 68px; NENHUMA célula numérica quebrou e a tabela coube nos
976px úteis de um viewport 1024 — min-w-[920px] segue suficiente, decidido
por medição (não alargou).

**Contrato do pools-e2e atualizado (mudança DELIBERADA)**: os 3 checks
permanentes do R4 verificavam o empilhado antigo (ambos abaixo do nome,
tops distintos/lefts iguais); viraram 3 checks do arranjo novo (chip 1 na
linha do nome à direita dele; chip 2 abaixo do chip 1; coluna alinhada),
documentados no próprio script. O filtro de spans agora exclui o wrapper
da coluna (childElementCount === 0). Degradação pra "n/a" sem falhar
continua quando nenhuma pool tem os dois chips.

## Raio-X mobile — SegmentedControl: a causa era o WRAP, não o padding

Diagnóstico por captura (shot-recompensa-mobile do R4): a 390px os rótulos
"100 blocos"…"1.000 blocos" quebravam em DUAS linhas dentro do botão —
41,7px de altura (2 × 14,85 de caption + 12 de py). O pedido era "menos
padding vertical", mas reduzir padding sem matar o wrap não afinaria nada:
o fix estrutural foi (a) whitespace-nowrap no botão e (b) " blocos" só em
md+ (`hidden md:inline`) — no mobile os botões leem 100/200/500/1.000, a
unidade segue na frase "≈ N h de rede" ao lado e no aria-label ESTÁVEL
("100 blocos") que cada opção agora carrega (display:none sai da árvore de
acessibilidade; sem o aria-label o nome acessível mudaria por breakpoint).

Alvo de toque (decisão pedida com medição a 390): altura visual ficou
26,8px (uma linha, py-1.5 mantido — afinar o padding deixaria o botão
raquítico); o alvo REAL é ≥32px via extensão invisível
`before:-inset-y-1` (4px por lado ⇒ ~35px) — hit-test da sonda
rewards-mobile-probe confirmou que pontos 3px ALÉM da borda visual
resolvem pro botão. As linhas Janela/Escala do controle usam gap-y-2
(8px): as extensões de 4+4px se tocam sem sobrepor. Faixa da janela
inteira: 191px de largura, sem overflow horizontal.

## Scrollbar NEUTRA de verdade — token novo --color-scroll (6px)

O thumb hairline do R4 (#282530) tem matiz ≈262°: croma baixa, mas ainda
roxa — e o Carlos percebia. Constatação que fechou a decisão: a família
INTEIRA (ink/mist/zeph/hairline) carrega matiz roxo — não existia token
neutro pra promover. Entrou `--color-scroll: #3a3a3a` (cinza croma ZERO,
papel documentado no @theme: SÓ scrollbar, nunca texto/borda/superfície de
conteúdo — mesma classe decorativa do mist-600, porém exclusiva).

@utility scrollbar-themed (vale automaticamente pras 3 tabelas): 8px → 6px,
thumb var(--color-scroll) SEM borda (com 6px a borda de 1px comia 2/3 do
miolo), track TRANSPARENTE (track ink-900 era mais uma superfície roxa; o
fundo neutro da própria tabela faz o papel). Confirmação computada na
sonda: scrollbar-color `rgb(58, 58, 58) rgba(0, 0, 0, 0)`. Contraste
medido pro registro (decorativo): 1,62:1 sobre ink-950 · 1,55:1 na célula
clara · 1,53:1 sobre ink-900 — mais presente que o par antigo
hairline-sobre-ink-900 (1,16:1) apesar de mais fino. O affordance de
rolagem segue não dependendo do polegar (a tabela corta no meio de coluna).

## Rig — a faixa do saldo SAIU; barras viram O instrumento (skill)

Decisão do Carlos usando o produto: duas séries empilhadas competem e o
saldo pendente diz pouco no dia a dia — a faixa
[ SALDO PENDENTE · MESMAS LEITURAS ] saiu da UI (o valor ATUAL continua no
rail como StatCard). **A amostragem do b? no motor diário FICA** (decisão
minha, documentada no rigStatus.ts): campo opcional, custo ~zero (~10
bytes/leitura no mesmo poll), e manter a coleta significa que reabilitar o
desenho no futuro já encontra 24 h de série pronta — sem migração de
storage em nenhum dos sentidos. Sonda com b semeado nas 288 leituras
provou que a faixa não renderiza mais.

Tratamento visual das barras (creative-ui-director, modo
design-system-constrained-upgrade lean — a única latitude da rodada).
Diagnóstico: como único instrumento de tendência da tela, as barras em
mist-600 (token SÓ-decorativo, 2,7:1) liam como ornamento, não como
gráfico. Escolhido, dentro do vocabulário existente:
1. **Base mist-600 → zeph-500** — o token cujo papel documentado é
   exatamente "suporte/gráfico" (3,5:1); vivacidade por papel de token,
   não matiz novo. Barra corrente segue zeph-300 (mesmo papel do "ponto
   atual" da linha).
2. **data-pulse na chegada de leitura nova** — useDataPulse na timestamp
   da última leitura diária (dispara a cada ~5 min quando o motor anexa),
   par com motion-reduce:animate-none como todo movimento do sistema.
3. **Hover-scrub**: um handler de pointer no plot inteiro (NÃO um hit-rect
   por barra — seriam 288 alvos de ~2px) destaca a barra sob o cursor em
   zeph-300 e mostra `hh:mm:ss · valor` em caption mono num overlay
   aria-hidden com fundo ink-950, sem deslocar layout. SEM foco por
   teclado nas barras DE PROPÓSITO: 288 tab-stops seriam ruído; o
   aria-label/summary do svg já entrega a série completa pra AT.
   O TrendSparkline ganhou a prop opcional formatReading (só variant
   bars); sem ela as barras não reagem a hover — Pulso da Rede e Bússola
   seguem com o comportamento de sempre.
Considerado e rejeitado: draw-in de entrada nas barras (terceiro movimento
no mesmo instrumento passaria o orçamento de polimento; o pulso já cobre a
vivacidade pedida). Rubrica: com zeph-500 as barras leem vivas mas seguem
textura — mais quietas que o hero de 96px; não viram segunda dominante.
Sonda rig-bars-probe: 287 barras zeph-500 + 1 zeph-300; hover no meio do
plot → overlay "06:33:21 · 46,01 kH/s" + 2 barras accent (corrente +
cursor); overlay some no pointerleave. Screenshot r5-rig-bars-hover.png.

## Verificação R5 (2026-07-11)

`npm run build` limpo (177ms) · lint só com os 2 warnings PRÉ-existentes
do N2 · e2e completa: rewards normal/lowratio/brokenrewards + rig
normal/notfound + pools normal (com os 3 checks NOVOS do arranjo de chips)
— **TUDO PASSOU 2026-07-11** · design-shots 12/12 re-fotografadas e
revisadas na rubrica de 8 perguntas — as 4 telas passaram, com atenção
explícita ao mobile (item 5 do diagnóstico):
- /rede: o sparkline em 680px vira o segundo momento da coluna dominante
  sem disputar com o hero (linha fina mist-600 + ponto accent); a 390
  ocupa os 358px úteis sem overflow. 8/8.
- /pools: chips na linha do nome leem como anotação do RANKING (zeph, não
  estado); linha do caso de dois chips caiu de altura; mobile segue com a
  rolagem horizontal contida e a coluna de chips íntegra. 8/8.
- /recompensa: janela em linha única fina no mobile (26,8px visual, alvo
  ~35px); scrollbar de 6px neutra praticamente desaparece até precisar
  dela — o dado segue a coisa mais viva da tela. 8/8.
- /meu-rig: as barras em zeph-500 são o segundo momento claro da tela,
  vivas sem competir com o hero (texture < headline); positivo/negativo
  seguem distinguíveis sem cor; mobile 358×96 sem overflow. 8/8.
Sondas da rodada no scratchpad da sessão (rede-trend-probe,
pools-chips-probe, rewards-mobile-probe, rig-bars-probe) — números e
método nas seções acima. Evidências regeneráveis:
.e2e-out/r5-rede-trend-{1360,390}.png, r5-pools-chips-{1360,1024}.png,
r5-rewards-390.png, r5-rig-bars-{1360,390,hover}.png e shot-*.png (12).

## Adendo R5 — StatusBadge below sem caixa + favicon removido (2026-07-11)

Dois itens do escopo original que chegaram depois da primeira leva:

**1. StatusBadge: o "abaixo do esperado" perdeu a caixa — desvio DELIBERADO
da escada do R4.** A escada era: nada (normal) < bad/20 contornado (below,
4,89:1) < bad sólido (offline). Agora normal e below usam a MESMA anatomia
de readout nu — ponto + rótulo mono `[ ... ]`, sem border/bg/padding —
mudando só a cor (bad no lugar de good; 6,6:1 direto no fundo, já medido no
v2) e o texto. O canal NÃO-COR entre normal e below passa a ser o texto por
extenso ("Minerando normal" vs "Hashrate abaixo do esperado") e o halo
ao-vivo, que segue EXCLUSIVO do normal; a superfície fica reservada pro
pior estado — offline segue caixa sólida bad, distinto por PESO. Nenhum
degrau é só-cor (daltonismo ok). Os dois estados forçados e capturados:
rig-below.png (readout nu laranja, sem halo) e rig-notfound.png (offline
sólido, inalterado). O rig-e2e não referenciava a caixa do below (checks
são por innerText e data-status) — passou normal + notfound SEM alteração
de script.

**2. Favicon REMOVIDO sem substituto** (decisão do Carlos — um ícone novo
virá depois): o <link rel="icon"> saiu do index.html (comentário no lugar
explica o porquê, pra ninguém "consertar" a ausência) e public/favicon.svg
foi deletado. Confirmado: `grep -ri favicon dist/` pós-build só encontra o
próprio comentário — zero referência a arquivo; src/ e vite.config não
referenciam. O logo-export.mjs continua emitindo favicon-{mist,zeph}.svg em
.e2e-out/logo/ como BYPRODUCT de exploração (não é produção, não tocar). O
navegador vai requisitar /favicon.ico por conta própria e receber 404 do
Vercel — esperado e aceito até o ícone novo existir.

Verificação do adendo: `npm run build` limpo (167ms) · rig-e2e normal +
notfound — **TUDO PASSOU 2026-07-11** · CLAUDE.md atualizado (escada de
estados do rig + regra "não recrie favicon").

## R5 — 2ª leva: limpeza de metadados + instrumentos de tendência

Decisões do Carlos, tela a tela; nada reabre composição/token.

**Removidos (texto descritivo de mecânica, não de mineração):** as linhas
"Atualização automática a cada N s · última: HH:MM:SS" das 4 telas (o
polling continua idêntico por baixo — só o metadado saiu); no /rede, a
anotação mono sob o hero (dificuldade/bloco/cadência + "estimado pelo
daemon…") e a legenda "Últimas 360 leituras…"; no /meu-rig, o "a cada 60 s
· HH:MM" do rail e a legenda "Hashrate da carteira na pool, até 288
leituras…". Os headers das 4 telas perderam o flex justify-between (não
há mais segunda coluna).

**Procedência virou canal NÃO-VISUAL — a convenção do projeto não caiu:**
os rótulos dos instrumentos ficaram [ TENDÊNCIA ] e [ TENDÊNCIA 24 H ], e
o container de cada um ganhou `role="group"` + `title` + `aria-label` com
a procedência completa ("coletada neste navegador com a página aberta…;
não há série histórica pública"). Tooltip pro mouse, aria pra AT — o
`summary` do próprio svg já dizia a procedência e continua. CLAUDE.md
atualizado com "não reintroduza a frase como texto visível". Sondado:
title/aria presentes e com o conteúdo esperado nas duas telas.

**/rede — linha mais alta + efeito dinâmico (latitude com a skill):**
altura 64 → 96 (a remoção dos metadados liberou o espaço; calibrada por
captura em r5b-rede-1360.png — 96 respira sem competir com o hero; svg
segue os 680px da coluna). Efeito escolhido: draw-in de entrada
(useChartEntrance, com a trava de assentamento que o sistema já tem) +
data-pulse na leitura nova (~2 min). Halo no ponto corrente REJEITADO: o
anel pulsante é semântica reservada do StatusBadge normal do rig
(animate-status-ping é "SÓ estado normal" desde o v3) — reusar diluiria.
**Armadilha medida no caminho:** animate-chart-draw e animate-data-pulse
disputam a MESMA propriedade `animation` no wrapper (utilities se
sobrescrevem na cascata) e a leitura viva que chega logo após a montagem
cortava o draw-in no meio (animationName computado na montagem: era
`data-pulse`, não `chart-draw`). Fix: o pulso só se aplica com a entrada
assentada (`fresh && entranceClass === undefined`) — re-sondado:
`chart-draw` na montagem, `none` após a trava. Motion-reduce pareado nos
dois (mesmas utilities de sempre).

**/pools — rodapé em UM bloco:** os 3 parágrafos soltos (Luck/effort ·
Tendência · "—") viraram um único parágrafo text-label max-w-3xl com a
mesma informação encadeada — menos fragmentos flutuando sob a tabela.

**/meu-rig — instrumento desceu e cresceu:** o bloco [ TENDÊNCIA 24 H ]
saiu de baixo do hero e agora vive logo ACIMA da tabela de workers, em
largura CHEIA (svg = 1041px a 1360; 358 a 390) com altura 96 → 128.
Rubrica re-conferida na captura (r5b-rig-1360.png): a faixa lê como
horizonte de textura — o mesmo papel compositivo da faixa do halving no
/rede — e a primeira leitura da tela segue sendo o hero; o vão que fica
sob o StatusBadge na coluna dominante é o retorno às proporções pré-R4
(hero+badge vs rail), que já passavam na rubrica. Renderiza só com
statusReady (mesma condição de antes da mudança).

**Contratos de e2e: ZERO mudança necessária.** Grep prévio + suíte verde
provaram que nenhum check referenciava os textos removidos/movidos (os
waitFor do rig usam "Na pool"/"H/s"/tbody, que ficaram; pools/rewards não
citavam os headers). Única correção foi em SONDA descartável do
scratchpad (waitFor de navegação ancorado na rota — o readyState batia no
about:blank).

## Verificação final R5 (leva 1 + adendos + leva 2, 2026-07-12)

`npm run build` limpo (165ms) · lint só com os 2 warnings PRÉ-existentes
do N2 · e2e completa re-executada por inteiro APÓS a 2ª leva: rewards
normal/lowratio/brokenrewards + rig normal/notfound + pools normal —
**TUDO PASSOU** · design-shots 12/12 re-fotografadas e revisadas na
rubrica de 8 perguntas: as 4 telas passaram (telas mais silenciosas sem os
metadados; o dado segue a coisa mais viva de cada uma; nenhum instrumento
virou segunda dominante; procedência auditável por tooltip/AT). Sondas da
2ª leva no scratchpad (r5b-height-probe, rede-entrance-probe); evidências
regeneráveis: .e2e-out/r5b-rede-{1360,390}.png, r5b-rig-{1360,390}.png e
shot-*.png (12). Nota: o dev server caiu entre sondas e foi re-erguido
com `npm run dev` — se uma sonda der timeout na primeira carga, cheque a
porta 5173 antes de suspeitar do código.

# NOTES — 2º tema (claro), 2026-07-12

A vantagem estrutural pagou: NENHUM componente usa hex solto desde o R1,
então o tema inteiro é (a) um bloco `[data-theme='light']` redefinindo os
MESMOS custom properties, (b) infraestrutura de troca/persistência e (c)
calibração de contraste do conjunto novo. Zero mudança de classe em
componente; o escuro não mudou NENHUM valor.

## Arquitetura da troca (decisões 1–3 do prompt, como ficaram)

- Bloco `[data-theme='light']` FORA do @theme em src/index.css: regra
  não-camadada vence as @layer que o Tailwind emite, e os utilitários já
  referenciam var(--color-*) — a cascata faz o tema. O @theme não aceita
  selector; o bloco é override de runtime, não um segundo conjunto de
  utilitários.
- ESCURO = default SEM marcação: applyTheme('dark') REMOVE o atributo
  (nunca existe data-theme='dark') — os e2e verificam cor computada no
  default e nenhum espelho de token deles precisou mudar (provado: suíte
  completa verde sem tocar em rewards/rig/pools-e2e).
- Persistência `zephyr-hub.theme.v1` + script inline no <head> do
  index.html que aplica o atributo ANTES do primeiro paint. Anti-flash
  PROVADO no theme-e2e: após reload, o atributo já está no <html> no
  primeiro poll (antes do React montar). A chave vive em DOIS lugares
  (inline + src/lib/theme.ts) — sincronize os dois se mudar.
- Botão [ TEMA · ESCURO/CLARO ]: o rótulo visível declara o estado ATUAL
  (decisão documentada: os colchetes mono do sistema sempre dizem o que É —
  rota ativa, [ Minerando normal ]; o destino iria contra a convenção). A
  AÇÃO vai no aria-label ("Mudar pro tema claro"). min-w-[17ch] + text-left
  seguram o layout na alternância. Posições: BASE do rail (mt-auto — zona
  meta, não polui a nav) e linha própria SOB a nav mobile (a grade 2×2 do
  N2 fica intacta; 5º item na grade viraria 2×3 acidental). Custo de altura
  do header mobile: 229 → 261px num viewport 390 (31% de 844 — medido).

## Calibração medida (contrast-check.mjs, seção TEMA CLARO)

Pisos de papel IDÊNTICOS ao escuro, medidos contra fundo #f7f7f7 E célula
escura da textura #f0f0f0 (preto a 3% — a polaridade inverte e o pior caso
vira a célula mais escura). Da paleta de partida do planejamento, TRÊS
valores falharam piso e desceram de claridade com H/S preservados
(darkenToContrast, o espelho do withContrastOver do v3):

- zeph-300 #1d4ed8 (5,88:1) → **#1944be** (7,06:1 na célula) — piso 7:1
- good #15803d (4,40:1) → **#116832** (6,04:1) — alvo 6:1 (é texto de estado)
- bad #c2410c (4,54:1) → **#a2360a** (6,01:1) — alvo 6:1

Tabela final (token | fundo | célula | elevação-branca):
zeph-300 #1944be 7,51/7,06/8,04 · zeph-500 #3b82f6 3,43/3,23/3,68 ·
zeph-700 #93c5fd 1,68/1,58/1,80 (SÓ gráfico com alívio, como no escuro) ·
zeph-800 #bfdbfe 1,33/1,25/1,42 (decoração) · mist-100 #171c26
15,93/14,98/17,07 · mist-300 #3f4859 8,59/8,07/9,20 · mist-400 #5a6373
5,65/5,32/6,06 (piso de texto, espelho do 5,3/5,0 escuro) · mist-600
#a9b1c2 2,01/1,89/2,15 (decoração) · good #116832 6,43/6,04/6,89 · bad
#a2360a 6,39/6,01/6,84 · hairline #d9dde6 1,27:1 · scroll #c8c8c8 1,56:1.
Chapados com texto ink-950 claro: zeph-300 7,51:1 · bad 6,39:1 · good
6,43:1 — todos PASS. Tints compostos recalculados sobre os fundos claros:
zeph-800/40 sobre ink-900 = #e5f1ff com texto ativo zeph-300 a 7,03:1;
bad/10 sobre ink-900 = #f6ebe7 com caption bad 5,85:1 e corpo mist-100
14,59:1 — NENHUM percentual precisou mudar.

Decisões de valor documentadas: elevação INVERTIDA (ink-900 claro = branco,
1,07:1 sobre o fundo — mesma presença do 1,06:1 escuro; "elevado = mais
perto da luz"); hairline com tinta AZUL (espelho da tinta roxa — marca na
elevação/divisor, fundo croma zero); textura tokenizada
(--color-texture-block: branco 2% escuro / preto 3% claro — papel único,
consumido só pelo body::before; keyframes e deriva idênticos nos 2 temas).

## Varredura de fuga (decisão 4 — achados e vereditos)

- src/**/*.{ts,tsx}: ZERO hex/rgb fora de comentário (grep documentado).
  Séries de gráfico via var() no style; LogoMark via var() por ponto;
  stroke do anel do sparkline via classe (stroke-ink-950) — tudo flui.
- index.css: a ÚNICA cor viva fora dos blocos de token era o
  rgb(255 255 255 / 0.02) da textura → tokenizado (--color-texture-block).
- Exceções documentadas (não fluem, de propósito): favicon NÃO EXISTE
  (removido no R5; quando o novo vier, viverá fora da cascata e não muda
  com o tema); scripts/logo-preview.html é espelho MANUAL (ganhou o
  conjunto claro + toggle ?theme=light — o canvas resolve os tokens no
  load, então o atributo é aplicado antes; --color-alert legado espelha o
  bad claro); espelhos de token dos e2e apontam pro DARK default (contrato
  deliberado — por isso o escuro é o default); favicon-*.svg emitidos pelo
  logo-export.mjs são byproduct de exploração fora do app.

## Verificação (2026-07-12)

`npm run build` limpo (169ms) · lint só com os 2 warnings pré-existentes ·
e2e completa no DEFAULT escuro sem alteração de contrato: rewards
normal/lowratio/brokenrewards + rig normal/notfound + pools normal —
**TUDO PASSOU** · **theme-e2e.mjs NOVO** (12 checks): default sem atributo
e fundo rgb(20,20,20) computado; clique aplica light, fundo rgb(247,247,247),
persiste, rótulo alterna; reload mantém com atributo presente ANTES do app
montar (anti-flash provado); segundo clique volta (atributo removido,
'dark' persistido) — **TUDO PASSOU** · design-shots agora 4×3×2 = 24
capturas (escuro com nomes históricos, claro com -light), TODAS revisadas
na rubrica de 8 perguntas — as 4 telas passam nos DOIS temas (hierarquia é
tipografia/escala, sobrevive à troca; estados seguem texto+glifo; textura
preta a 3% não compete; o dado segue a coisa mais viva; procedência via
title/aria não depende de tema) · logo no claro: lupa 4x nos DOIS tamanhos
(.e2e-out/logo/theme-light-{rail-176,header-128}-lupa4x.png) — os 4 degraus
da rampa (zeph-300/mist-400/zeph-500/zeph-700 claros) leem a olho nu, o Z̶
segue nítido. Sondas da rodada no scratchpad (theme-probe,
logo-light-probe); evidências regeneráveis: .e2e-out/theme-light*.png,
shot-*-light.png (12) e a saída do contrast-check.

# NOTES — Ganho estimado no /meu-rig (2026-07-12)

Primeira composição CROSS-MODULE do produto: até aqui as 4 rotas eram
ilhas; o Monitor do Rig agora cruza o hashrate do PRÓPRIO rig
(signalHashrate — XMRig local se alcançável, senão pool) com as três
fontes que o Pulso da Rede já consome. Nenhuma API nova, nenhum dado
inventado — só reuso das funções existentes.

## Fórmula e função pura (src/modules/rig/earnings.ts)

ganho_diario_zeph = (signalHashrate / hash_rate da rede) × miner_reward ×
(86400 / BLOCK_TIME_SECONDS); ganho_usd = ganho_diario_zeph × zeph_price.
- BLOCKS_PER_DAY derivado de BLOCK_TIME_SECONDS (86400/120 = 720) — nunca
  720 solto.
- miner_reward já É a fatia de 65% — o split NÃO é recalculado (seria
  duplicar lógica que vive em emission.ts/zephyrScanner.ts).
- Degradação POR CAMPO na própria função: zephPerDay só existe com
  rig + rede (> 0, guarda de divisão por zero) + recompensa TODOS
  presentes; usdPerDay só com zephPerDay + preço. Input ausente → "—" no
  campo de saída, nunca número parcial nem zero disfarçado de dado
  (rigHashrate = 0 REAL produz 0 legítimo — é dado, não ausência).

## Os 3 polls novos no RigDashboard

usePolling + getNetworkInfo (Explorer) / getLatestBlockReward /
getLiveStats (Scanner via proxy) — funções module-level passadas direto
(identidade estável, dispensam useCallback), EARNINGS_POLL_MS =
SCANNER_CACHE_SECONDS × 1000 (importado; o mesmo passo do Pulso da Rede
pras mesmas fontes). Erro isolado por fonte no espírito do par pool/xmrig:
aviso mono caption em bad no escopo do bloco ("[ fonte com falha: … —
tentando de novo automaticamente ]"), visível mesmo com dado velho na
tela — erro nunca silencioso.

**Dependência que a captura de falha provou:** bloquear o Explorer derruba
TAMBÉM o blockrewards (getLatestBlockReward ancora a altura em
getNetworkInfo — consequência da armadilha do order=desc da Fase 0), então
o aviso lista as DUAS fontes e a estimativa inteira vai pra "—" — mas
hero, rail, tabela de workers e XMRig seguem de pé
(rig-earnings-fail-network.png). Bloqueando SÓ o livestats: ZEPH/dia
presente e "— em USD/dia" (rig-earnings-fail-price.png).

## UI — o vão vira leitura secundária

[ GANHO ESTIMADO ] preenche o vão sob o StatusBadge (as proporções pré-R4
registradas na 2ª leva) com a MESMA anatomia do [ TENDÊNCIA ] do /rede:
caption mono + mt-10, sem moldura nova, zero gradiente/glow/sombra. Valor
em font-mono text-data-lg (a régua dos dígitos do HalvingCountdown) —
calibrado por captura: leitura secundária clara, não compete com o
text-headline do sinal. Sub-linha "≈ US$ … em USD/dia" em body/mist-300.
A ressalva textual da estimativa (fórmula + "assume blocos de 120 s, sorte
média…", no tom do HalvingCountdown) chegou a entrar e SAIU por decisão do
Carlos na revisão — o rótulo [ GANHO ESTIMADO ] já declara a natureza do
número; não reintroduza a frase. Skeleton compartilhado enquanto os 3
polls não resolvem. Rail de StatCards, tabela de workers e
[ TENDÊNCIA 24 H ] intocados.

## Verificação (2026-07-12)

`npm run build` limpo (237ms) · lint só com os 2 warnings pré-existentes
do N2 · rig-e2e normal + notfound — **TUDO PASSOU sem alteração de
contrato** (o bloco novo não toca nos waitFor existentes) · 6 capturas:
rig-earnings-{desktop,mobile}[-light].png (4 preenchidas, 2 temas — o
bloco lê como secundário nos dois; no claro os papéis fluem sozinhos via
var()) + rig-earnings-fail-{price,network}.png (degradação por campo e
tela viva). Sonda regenerável no scratchpad da sessão: earnings-shots.mjs
(Network.setBlockedURLs pros cenários de falha).

# NOTES — Glifo no ThemeToggle (sol/lua), 2026-07-12

Skill creative-ui-director, modo design-system-constrained-upgrade, escopo
enxuto (só o ThemeToggle). Diagnóstico: o rótulo `[ TEMA · ESCURO ]` na zona
meta (base do rail / linha sob a nav mobile) lia com o MESMO peso e a MESMA
convenção de colchete de um item de nav (`[ Pulso da Rede ]`) — um controle
utilitário de baixa frequência com autoridade de navegação; e o min-w-[17ch]
reservava ~10rem pra alternar um bit, com o rótulo mudando de conteúdo/largura
a cada troca (ruído na região mais quieta). Direção escolhida (a pedida):
glifo de traço fino sol/lua num quadrado fixo — demove o controle pro peso de
ícone, devolve a faixa horizontal, e fica DENTRO do sistema (fill none +
stroke currentColor = a linguagem "linha, não sólido"; cor no token mist-400).

## Desenho dos glifos (à mão, sem lib)

Sem dependência de ícones (o projeto só tem react/react-dom/react-router e não
deve ganhar uma por isto): SVG inline como o LogoMark. viewBox 0 0 24 24,
render 18px, stroke-width 2 → traço 1,5px rendido, round caps. Calibração de
18px por captura (theme-icon-rail/mobile-{dark,light} + os contextos): quieto
o bastante pra matar o peso de nav, grande o bastante pra ler como sol/lua.
- Sol: círculo r=4 no centro + 8 raios (linhas r 6→8,5 nas 8 direções).
- Lua: crescente como UMA forma de traço (dois arcos, `M16 4 A8 8 0 0 0 16 20
  A9.5 9.5 0 0 1 16 4 Z`), sem recorte por preenchimento — os dois raios ≥8
  (metade da corda 16) pra os arcos serem válidos; renderizou "C" abrindo pra
  direita, crescente limpo (verificado em zoom 5x, theme-icon-rail-dark.png —
  na 1ª tentativa temi virar lente, a captura confirmou crescente).
Mapeamento: escuro ativo → lua, claro ativo → sol (o glifo diz o que É). Sol e
lua ocupam a MESMA caixa 18px → zero deslocamento na troca.

## Acessibilidade — aria-label basta, sem texto oculto

O SVG é aria-hidden (decorativo); o nome acessível vem do aria-label do botão
("Mudar pro tema claro/escuro"), que já existia e declara a AÇÃO. Com o
aria-label presente, um <span> sr-only com o estado seria IGNORADO pela AT (o
aria-label vence o nome acessível) e invisível pro vidente — só serviria pra
enganar o innerText do teste. Rejeitado: a AT anuncia exatamente o que antes
(a experiência de leitor de tela é IDÊNTICA à do rótulo de texto); só o canal
do vidente mudou (texto → glifo). Alvo de toque ≥24px (WCAG 2.5.8 AA) por
extensão invisível `before:-inset-1.5` (a técnica que o SegmentedControl já
usa), então o glifo alinha na borda da coluna sem caixa de centragem.

## Contraste (contrast-check.mjs, bloco GLIFO DE TEMA)

Elemento interativo NÃO-texto → piso WCAG 1.4.11 = 3:1. Traço em mist-400,
pior caso na célula da textura como o resto do sistema:
- escuro: mist-400 #8b86a0 → 5,28:1 no fundo · 5,04:1 na célula → PASS
- claro: mist-400 #5a6373 → 5,65:1 no fundo · 5,32:1 na célula → PASS
Folga enorme sobre 3:1 (é o mesmo token do rótulo que substituiu — peso visual
preservado).

## Conflito de contrato do e2e — resolvido, mudança DELIBERADA

O critério do prompt pedia "theme-e2e.mjs passa sem alteração de contrato",
mas o theme-e2e lia o innerText do botão e afirmava `=== '[ TEMA · ESCURO ]'`
/ `'[ TEMA · CLARO ]'` (linhas 110/122/131). Tirar o texto torna essas DUAS
afirmações impossíveis — o critério literal e "troca texto por ícone" não
coexistem. Resolvido preservando a INTENÇÃO da verificação, não a letra: os
dois checks passaram a ler o aria-label (a ação oferecida determina o estado
corrente) + a presença do `<svg>` e a ausência de texto. As 4 GARANTIAS de
tema (default sem atributo/fundo escuro; clique→light com tokens fluindo e
persistência; reload anti-flash; volta remove o atributo e persiste dark)
ficaram BYTE A BYTE iguais. É o mesmo tipo de migração de canal que o R5 fez
com a procedência da tendência (texto visível → title/aria) — documentado como
mudança deliberada, não regressão. Só o theme-e2e referenciava o texto (grep):
os outros suites não citam o toggle.

## Verificação (2026-07-12)

`npm run build` limpo (178ms) · lint só com os 2 warnings pré-existentes do
N2 · contrast-check com o bloco GLIFO DE TEMA (5,04:1 escuro / 5,32:1 claro,
piso 3:1) · theme-e2e.mjs **TUDO PASSOU** (13 checks, incl. os 2 migrados pro
aria-label + o novo "é glifo SVG sem texto") · 4 capturas zoomadas
(theme-icon-{rail,mobile}-{dark,light}.png) + 2 de contexto
(theme-icon-ctx-{rail,mobile}.png): sol e lua na mesma caixa, crescente limpo,
mist-400 fluindo tom a tom nos dois temas. Sondas regeneráveis no scratchpad
da sessão: theme-icon-shots.mjs (clips 5x do glifo) e theme-icon-context.mjs
(coluna do rail / header mobile).

# NOTES — N4: rótulo do tema + largura da Bússola + rodapé de doação (2026-07-12)

Três achados de uso real do Carlos, independentes. Itens 1 e 2 mecânicos; o 3
(rodapé) passou pela skill creative-ui-director (design-system-constrained-
upgrade, escopo enxuto).

## 1. ThemeToggle — rótulo [ DARK ]/[ WHITE ] de volta ao lado do glifo

O ícone-só do N3 ficou ambíguo em uso real (sem hover / sem AT não dá pra saber
o que o botão faz). Decisão do Carlos: o ícone FICA e ganha um rótulo mono ao
lado, em INGLÊS e com grafia EXATA — `[ DARK ]` (escuro ativo) / `[ WHITE ]`
(claro ativo; é WHITE, NÃO "LIGHT"). Regra de sempre: o rótulo declara o estado
ATUAL, a ação segue só no aria-label (inalterado). Botão virou
`inline-flex items-center gap-2` com o glifo (o mesmo do N3, intocado) + um
`<span min-w-[9ch] text-left>` — o min-w reserva a largura do mais longo
("[ WHITE ]", 9 chars mono) pra a troca DARK↔WHITE não mexer na largura. Cor
mist-400 no botão inteiro → glifo (currentColor) e texto acendem juntos no
hover. theme-e2e voltou a checar o innerText (`[ DARK ]`/`[ WHITE ]`) + o glifo
+ o aria-label; as 4 garantias de tema intactas. Capturas zoom 5x:
n4-toggle-{rail,mobile}-{dark,light}.png.

## 2. Bússola — parágrafo do luck/effort na largura da tabela

O parágrafo tinha max-w-3xl (768px), mais estreito que a tabela → sobrava faixa
vazia à direita no desktop. Removido o cap (só a largura; o TEXTO não mudou) —
agora o `<p>` acompanha a coluna, a mesma que a `<table w-full>` ocupa.
Medido ao vivo em 1360 (n4-shots): tabela = 1056,0px · parágrafo = 1056,0px ·
delta = 0,0px. Captura n4-pools-desktop.png.

## 3. Rodapé de doação (skill) — endereço copiável + coração pixelado

Diagnóstico: o rodapé era uma linha só de créditos de API — o tratamento mais
fraco possível. O novo rodapé tem DUAS funções (doação + aviso de não-afiliação
de confiança), e um endereço de 101 chars é inútil sem copiar. Direção
escolhida (a única que sobrevive ao check; alternativas endereço+botão separado
e break-all de 106 chars rejeitadas): o endereço truncado + a tag
`[ copiar ]` são UM controle de cópia; corações pixelados o ladeiam; a frase de
não-afiliação desce pra uma linha quieta. Move compositivo: o rodapé ganha uma
AÇÃO clara sem card/gradiente/primitiva nova.

- **Coração pixelado (`PixelHeart` em AppShell.tsx):** MESMA técnica do LogoMark
  — `<rect>` numa grade (7×6, HEART_CELLS), lado 0,82 pra deixar o vão da grade
  (halftone), cor por token via style (zeph-300 — o acento do sistema, num
  rodapé que fora isso é todo mist-400). NÃO emoji, NÃO ícone de lib, NÃO
  Unicode ♥ (restrição). Decorativo (aria-hidden); o rótulo "apoie o projeto"
  carrega o sentido. Fica em AppShell.tsx (não em ui/) porque é só-rodapé — o
  LogoMark vive em ui/ por ser reusado (rail + header).
- **Endereço:** const `DONATION_ADDRESS` HARDCODED e exata; verificada char a
  char contra o prompt (o prompt dizia "106 caracteres" mas o literal dado tem
  101 — usei o literal, não a contagem). Só a apresentação trunca: desenho =
  cabeça 12 + … + cauda 8 (~21 chars) em TODOS os breakpoints (os 101 chars
  dominariam o rodapé quieto até no desktop). Valor COMPLETO via clipboard
  (todos) e title (hover desktop) — opção (a) do prompt.
- **Copiar:** navigator.clipboard.writeText (sem lib), try/catch (contexto
  inseguro cai no title), confirmação visual `[ copiar ]`→`[ copiado! ]` por 2s
  + um `role="status" aria-live` sr-only pra AT. Provado com clique REAL via
  CDP Input.dispatchMouseEvent (o `.click()` programático não é ativação de
  usuário → writeText era bloqueado): clipboard recebeu os 101 chars EXATOS
  (comparação === true) e a tag virou "[ copiado! ]".
- **Não-afiliação:** "projeto comunitário, sem afiliação oficial" FICA (só ela;
  os créditos de API saíram) logo abaixo — é a única linha que separa este
  produto do site oficial da Zephyr (que ele imita em cor/logo). 390px não
  estoura. Capturas n4-footer-{desktop,mobile}-{dark,light}.png + -copied.

## Verificação (2026-07-12)

`npm run build` limpo (169ms) · lint só com os 2 warnings pré-existentes ·
e2e completa SEM alteração de contrato (o rodapé novo renderiza em todas as
telas): theme (com os checks [ DARK ]/[ WHITE ] atualizados) + pools normal +
rig normal + rewards normal — **TUDO PASSOU**. Sondas regeneráveis no
scratchpad: n4-shots.mjs (toggle/pools/rodapé + larguras medidas) e
n4-footer-fix.mjs (rodapé por coords absolutas + cópia com clique real).

# NOTES — R6: alinhamento + glifos pixelados + rodapé simples (2026-07-12)

Correção dirigida pelos três achados do screenshot real do Carlos. A skill
creative-ui-director foi usada SÓ no item 2 (técnica/escala dos glifos), em
modo design-system-constrained-upgrade lean. O alinhamento do item 1 e a
remoção de mecânica do rodapé no item 3 foram tratados como ajustes mecânicos.

## 1. ThemeToggle — causa raiz do desalinhamento, medida

Antes de editar, `scripts/shell-detail-shots.mjs` mediu o botão real nos dois
arranjos e temas. O candidato "SVG inline brigando com flex" foi descartado:
o `<svg>` já computava `display: block` por ser flex item. `items-center`
também funcionava literalmente — centro da caixa 18×18 do SVG e centro da
caixa de linha 14,84375px do `<span>` coincidiam no mesmo Y.

O desvio estava DENTRO da caixa tipográfica: font-size 11px / line-height
14,85px, e a tinta real do caption mono ficava ~0,92px acima do centro da
linha. A captura N4 em lupa 5× confirmou por pixel: centro do ícone em 104,5 e
centro da tinta do texto em 100,5, delta −4px na lupa = **−0,8 CSS px**. Logo,
trocar `display` do SVG ou somente reduzir o line-height não moveria a tinta
relativa ao centro da própria line box.

Fix: `translate-y-px` SÓ no `<span>` do rótulo — compensação óptica de 1px,
não tamanho novo nem offset arbitrário. Pós-fix, a estimativa de métrica da
fonte ficou 0,078px do centro do SVG; a leitura dos pixels nas quatro capturas
finais (rail/mobile × dark/light) deu o MESMO delta de **0,3 CSS px** (1,5px
na lupa 5×, arredondamento do raster). Caixas e alvo de toque continuam
estáveis; `[ DARK ]`/`[ WHITE ]`, data-testid e aria-label não mudaram.

## 2. Sol/lua — traço fino SAIU, grade grossa entrou (skill)

Diagnóstico visual: ao lado do PixelHeart do mesmo R6, o sol/lua de path/line
parecia pertencer a outro sistema. A direção escolhida foi reutilizar a
primitiva já existente em vez de inventar outra: SVG inline com grade 11×11 de
`<rect>`, lado **0,82** (vão halftone), um tom por
`var(--color-mist-400)`, células estáticas próprias pra lua/sol. Mesma viewBox
e mesma caixa nos dois estados; a regra estado-atual e o aria-label de ação
ficaram intactos. A alternativa de grade fina a 18px foi rejeitada pela
evidência de `docs/logo-exploracao.md`, não por preferência.

Calibração no app real em deviceScaleFactor 1, com crop ×1 + lupa 5× da MESMA
grade em 18/22/24px (`r6-final-glyph-*`):

- **18px:** silhuetas ainda reconhecíveis, mas o passo de 1,64px funde os vãos
  por antialias — vira a mesma zona de risco registrada na exploração.
- **22px (escolhido):** pitch exato de 2px na grade 11×11; os quadradinhos e
  vãos sobrevivem nos dois temas, e o glifo segue subordinado ao caption.
- **24px:** textura igualmente segura, mas o ícone passa a dominar o rótulo
  ao lado; ganho de leitura marginal sobre 22px.

Anti-generic quick score do componente: 0/12 antes e depois — o defeito não
era composição genérica, era incoerência entre duas primitivas da mesma
casca. A ação corretiva foi convergir pro vocabulário pixelado já específico
do produto, sem cor, efeito ou dependência novos.

## 3. DonationFooter — só endereço completo + corações

Mudança mecânica fechada pelo Carlos:

- frase "projeto comunitário, sem afiliação oficial" removida, sem substituta;
- `shortAddress`, truncamento, botão, `copyAddress`, estado `copied`, clipboard,
  title e aria-live removidos por completo;
- `DONATION_ADDRESS` comparada contra o HEAD: **idêntica byte a byte**, literal
  existente com 101 caracteres (a contagem histórica do prompt dizia 106; o
  valor hardcoded real sempre prevalece);
- endereço completo agora é `<p>` simples com `break-all`; rótulo e endereço
  subiram de text-caption pra **text-label**; PixelHeart 15→**18px**;
- faixa interna `max-w-4xl`, com os corações ladeando o bloco sem card/sombra.

Medição a 390px, dark E light: área do endereço = **298×54px** (3 linhas),
`scrollWidth === clientWidth === 298`, overflow horizontal da página = 0.
Sonda também confirmou `hasCopyButton=false` e `hasDisclaimer=false`. No rail
desktop, endereço completo fica em uma linha (836×18px). Capturas finais:
`r6-final-footer-{mobile,rail}-{dark,light}.png`.

## Verificação R6

- `npm run build`: limpo (Vite 182ms, zero warning).
- `npm run lint`: só os 2 warnings PRÉ-existentes
  (SeriesSwatch.tsx/logo-shots.mjs), nenhum novo.
- `node scripts/theme-e2e.mjs`: **13/13 PASS**, incluindo texto exato,
  aria-label, glifo SVG, troca, persistência e anti-flash.
- `git diff --check`: limpo (só aviso de conversão CRLF→LF do CLAUDE.md).
- Evidência regenerável: `scripts/shell-detail-shots.mjs`; saídas
  `r6-final-toggle-{rail,mobile}-{dark,light}.png` (lupa 5×),
  `r6-final-toggle-context-*`, régua `r6-final-glyph-{18,22,24}-*` em ×1/×5 e
  os quatro rodapés citados acima.

# Produto em inglês e locale `en-US` — 2026-07-12

## Decisão e alcance

O produto passou a usar inglês hardcoded, sem biblioteca de i18n. Todo texto
voltado ao visitante — conteúdo visível, mensagens de erro e estado vazio,
placeholders, `title`, `aria-label`, `alt`, resumos de gráficos e metadados do
`index.html` — foi traduzido. As rotas `/rede`, `/pools`, `/recompensa` e
`/meu-rig` permanecem inalteradas.

O produto fica em inglês; `CLAUDE.md`, `NOTES.md`, `README.md`, `docs/` e os
comentários do código seguem em português como língua de trabalho do projeto.

| Nome anterior (PT) | Nome do produto (EN) |
| --- | --- |
| Pulso da Rede | Network Pulse |
| Bússola de Pools | Pool Compass |
| Raio-X da Recompensa | Reward X-Ray |
| Monitor do Rig | Rig Monitor |

## Investigação e decisão de locale

A camada central `src/lib/format.ts` continha quatro usos explícitos de
`pt-BR` (`Intl.NumberFormat`, números compactos, data e hora). Não havia locale
implícito nesses formatadores. Fora dela, a única escolha adicional era o
`localeCompare(..., 'pt-BR')` da ordenação de pools.

O locale de apresentação agora é uma única constante exportada,
`DISPLAY_LOCALE = 'en-US'`, consumida pelos formatadores centrais e pela
ordenação. Números, percentuais, datas e horas ficam determinísticos e seguem
a convenção do produto em inglês; por exemplo, `65.0%` e `817,867`. A moeda
usa `$` e o tempo relativo usa formas inglesas como `now` e `… ago`, sem locale
solto em componentes. O documento passou a declarar `<html lang="en">`; título
e meta description também estão em inglês.

## Contratos e verificação

- A varredura sintática de `src/` por caracteres acentuados em strings e JSX,
  excluindo comentários, terminou com **zero ocorrências**.
- `npm run build`: limpo.
- `npm run lint`: somente os dois warnings preexistentes em
  `scripts/logo-shots.mjs` e `src/modules/rewards/SeriesSwatch.tsx`; nenhum novo.
- E2E de pools (`normal` + `broken2miners`), recompensa (`normal` + `lowratio`
  + `brokenrewards`), rig (`normal` + `notfound`) e tema: **todos PASS**. Os
  contratos de texto, acessibilidade e parsing numérico foram atualizados para
  inglês/`en-US`; os contratos de comportamento permaneceram iguais.
- `scripts/design-shots.mjs`: 24/24 capturas regeneradas (4 telas × 3
  breakpoints × 2 temas) e revisadas visualmente. Não há português visível,
  a notação numérica é `en-US` e não apareceu regressão de composição.
- `scripts/rig-https-mixed.mjs`, `scripts/xmrig-sim.mjs` e
  `scripts/shell-detail-shots.mjs` também tiveram seus contratos de texto de
  produto atualizados. O primeiro não foi reexecutado nesta máquina porque
  OpenSSL não está disponível; isso não integra a suíte de aceite desta sessão.

# NOTES — Auditoria de estrutura + code-audit-cleanup + reescrita do Prompt 5 (2026-07-12)

Sessão no chat Cowork (sem Claude Code): rodou `backend-structure-auditor` sobre o
working tree pós-EN1 (ainda sem commit), depois `code-audit-cleanup` sobre o mesmo
estado, e por fim reescreveu o Prompt 5 (`docs/zephyr-mining-hub-prompts.md`) absorvendo
os achados de ambas. Contexto: Carlos ia rodar o Prompt 5 (histórico, escrito antes do
R1–R7) e pediu pra verificar se precisava atualizar antes — precisava.

## backend-structure-auditor

Censo completo dos 38 arquivos de `src/` (não amostragem) — relatório completo em
`docs/AUDITORIA-ESTRUTURA-2026-07-12.md`. Resumo: codebase "estruturalmente muito
disciplinado" (100% das chamadas de rede via `fetchJson`, 100% dos módulos via
`usePolling`, zero `console.*`, zero hex solto) — o padrão encontrado não é convenções
competindo, é duplicação pura em 4 pontos: constantes de domínio redefinidas em vez de
importadas (`ATOMS_PER_ZEPH`, `MIN_READING_GAP_MS`, poll de 60s das pools), um bloco de
agregação de erro (`failingSources`/`noDataAtAll`) copiado entre `NetworkPulsePage.tsx`
e `RewardsPage.tsx`, três motores de histórico local paralelos (`luckHistory.ts`,
`networkHashrateHistory.ts`, e o motor que `rigStatus.ts` já generalizou só pras 2
séries do próprio módulo), e dois gráficos (`ReserveRatioChart.tsx`/
`RewardSplitChart.tsx`) reimplementando a mesma interação de hover/teclado (~40-50% de
cada componente). Pontuação: 4 nas 7 dimensões aplicáveis — faixa "consistente"
baixa/início de acúmulo de deriva, mas 100% duplicação pura, zero convenção divergente.

## code-audit-cleanup

Aplicou SÓ a consolidação de menor risco: `ATOMS_PER_ZEPH` (definida em
`src/lib/emission.ts` e redefinida com o mesmo valor em `src/lib/api/minerStats.ts`) —
`minerStats.ts` agora importa de `emission.ts`; zero mudança de comportamento (mesmo
valor, mesmo tipo, único uso é a mesma divisão de sempre). Os outros 3 achados da
auditoria (constantes cross-module `MIN_READING_GAP_MS`/poll de 60s, o hook
`useFailingSources`, o hook de chart hover) ficaram DE FORA desta rodada por decisão
deliberada, não por serem arriscados demais em si: os dois primeiros exigem escolher um
lar novo em `lib/` pra uma constante compartilhada entre módulos-irmãos (pequena decisão
de arquitetura, não um cleanup mecânico de um arquivo só); o hook de `failingSources`
tem uma assimetria real entre os dois usos (NetworkPulsePage conta `dailyStats.error` no
aviso mas NÃO no "sem dado nenhum"; RewardsPage conta as 3 fontes nos dois) que precisa
ser generalizada com cuidado; e o hook de chart hover mexe em interação de teclado/mouse
que só dá pra verificar com confiança rodando a suíte e2e real (Windows, CDP) — que este
chat não tem. Registrados como itens do Prompt 5 reescrito em vez de aplicados às
cegas.

**Limitação de ambiente confirmada nesta sessão:** `npm run lint` (oxlint) falha aqui com
`Cannot find native binding — @oxlint/binding-linux-x64-gnu` (binário nativo Windows-only
instalado no projeto, mesma classe de limitação já registrada no HANDOFF pro
rolldown/lightningcss). `npx tsc --noEmit` também não é confiável neste sandbox: acusou
`error TS1127: Invalid character` na linha 296 de `AppShell.tsx` (a última linha do
arquivo) — conferido por `Read` direto no mesmo instante, o arquivo está correto e
completo. É o MESMO fenômeno de mount Linux defasado que o HANDOFF já documenta pra
`git status`/`git diff` (visto de novo ao vivo: `wc -l` via bash relatou 1885 linhas
pra este mesmo NOTES.md e 2553 para `docs/zephyr-mining-hub-prompts.md`, mas o `Read`
foi além dos dois números sem erro — a contagem do bash estava defasada). Regra
reforçada: build/lint/typecheck neste sandbox não são fonte de verdade; toda verificação
desta sessão foi por leitura manual de código (todos os 38 arquivos de `src/`, não só os
citados pela auditoria).

## Prompt 5 reescrito

A versão em `docs/zephyr-mining-hub-prompts.md` foi escrita antes do R1–R7 e tinha 3 dos
6 itens já resolvidos por iterações posteriores (loading/erro desde o Prompt 1, nav ativa
desde R1/N1, tema — agora dois, T1). A reescrita: remove os 3 itens feitos, mantém a
varredura `order=desc`, absorve README.md desatualizado + ErrorBoundary ausente (achados
já mapeados em `docs/ANALISE-MELHORIAS-2026-07-11.md`), absorve os 3 achados da auditoria
de estrutura não aplicados pelo cleanup, e pede a correção dos 2 warnings de lint
pré-existentes (`scripts/logo-shots.mjs`, `SeriesSwatch.tsx` — nunca resolvidos desde o
N2). Decisão de Carlos incorporada: mantém o redirect `/` → `/rede` (sem página inicial
nova). Não pede um REVIEW.md novo — a auditoria de estrutura já cumpre esse papel.

## Pendência de git (ATIVA no fim desta sessão)

O working tree segue com a tradução EN1 inteira + a auditoria de estrutura sem commit
(`HEAD` ainda em `39f3f6f`, o R7) — pendência que já existia ANTES desta sessão começar,
mais a mudança do `minerStats.ts` e a reescrita do Prompt 5/HANDOFF feitas agora.
Recomendado a Carlos: commitar tudo junto antes de rodar qualquer prompt novo (mesma
lógica do commit agrupado N3+G1+R6) — mensagem sugerida em `docs/HANDOFF.md`.
