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
- Por convenção dessa família de software, deve existir também
  GET https://zeph.2miners.com/api/accounts/<endereco> pra stats por minerador —
  confirmar formato exato E CORS ao implementar o módulo Monitor do Rig, não assumir que
  herda o mesmo header do /api/stats.

Também confirmado funcionando (CORS aberto, testado com fetch real do navegador):
- HeroMiners — GET https://zephyr.herominers.com/api/stats, CORS `*` confirmado.
  Fee/min. payout em `config`, hashrate/miners em `pool`, `coinUnits` vem como string.
  (de.zephyr.herominers.com é host de stratum, não de API.)

Pools ZEPH conhecidas SEM integração ainda — motivo confirmado, TODOs em
`src/lib/api/pools.ts`:
- K1Pool — GET https://k1pool.com/api/stats/zeph responde JSON válido mas SEM header
  CORS. Integrar só com proxy.
- MiningOcean — sem REST JSON público (front usa protobuf sobre SSE).
- RavenMiner — endpoint de stats não confirmado (method not found + DNS instável).

O dropdown de pool do módulo Monitor do Rig (próximo módulo) usa só 2Miners e
HeroMiners — as outras 3 não estão prontas.

Lista completa e atualizada de pools: https://miningpoolstats.stream/zephyr

## API local do XMRig
Quando XMRig roda com `--http-enabled` (porta configurável, ex. 16000):
GET http://127.0.0.1:PORTA/1/summary → hashrate, shares, uptime, backend de CPU.
Sem autenticação por padrão, a menos que `access-token` tenha sido configurado.

CORS confirmado aberto no binário real do XMRig (`Access-Control-Allow-Origin: *`,
conferido no código-fonte). Mixed content localhost→127.0.0.1 testado sem bloqueio via
`scripts/xmrig-sim.mjs` (reaproveitável pra testar sem hardware real). **Pendente:** o
mesmo teste com a página já publicada em HTTPS (produção) contra o XMRig local em HTTP —
cenário diferente do testado, precisa validação própria no módulo Monitor do Rig.

## Riscos conhecidos
Ver NOTES.md pro detalhe completo dos testes de CORS/mixed-content da Fase 0. Resumo:
Scanner API bloqueada (usa proxy), 2Miners e XMRig real liberados, hashrate/dificuldade
não vêm do Scanner API (usar Explorer API acima).