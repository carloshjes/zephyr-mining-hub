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
