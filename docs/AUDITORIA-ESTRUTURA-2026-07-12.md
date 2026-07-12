# Auditoria de estrutura — backend-structure-auditor (2026-07-12)

Rodada no chat Cowork via Skill tool, sobre o working tree pós-EN1 (tradução,
ainda sem commit no momento da auditoria). Censo completo: os 38 arquivos de
`src/` (não amostragem) — todo `src/lib/**`, `src/hooks/**`, `src/components/**`
e os 4 módulos inteiros (`network/`, `pools/`, `rewards/`, `rig/`) foram lidos
por inteiro.

## Nota de stack/escopo

O projeto não tem backend tradicional (sem rotas de servidor, sem DB, sem
auth) — é uma SPA Vite+React+TS que fala com APIs de terceiros. As dimensões
do skill foram mapeadas pras camadas equivalentes deste projeto:

- **"Data access"** → `src/lib/api/*.ts` (6 arquivos: http.ts, zephyrScanner.ts,
  zephyrExplorer.ts, minerStats.ts, pools.ts, xmrig.ts).
- **"Service layer"** → `src/hooks/*.ts` (usePolling é o mais próximo de um
  serviço compartilhado) + `src/lib/{emission,format,theme}.ts`.
- **"Handlers"** → os 4 page components (`*Page.tsx`/`RigDashboard.tsx`).
- Dimensões 3 (API contract), 7 (auth) e 8 (observability) não têm superfície
  real neste projeto (sem API própria exposta, sem auth por design, sem
  logging por design — erros são sempre visíveis na UI, nunca console) —
  marcadas **N/A**, não 0.

## Resumo

Codebase estruturalmente muito disciplinado — as abstrações GRANDES são
seguidas sem exceção (100% das chamadas de rede passam por `fetchJson`, 100%
dos 4 módulos usam `usePolling`, zero `console.*`, zero hex solto). O padrão
que se repete é o oposto do "drift" clássico: não há convenções concorrentes
disputando espaço, e sim **pedaços pequenos de lógica/constante reimplementados
de forma idêntica em vez de compartilhados** — 3 constantes de domínio
duplicadas (`ATOMS_PER_ZEPH`, o gap de dedup de 55s, o intervalo de poll de
60s das pools) e um bloco de ~15 linhas de agregação de erro (`failingSources`
+ `noDataAtAll`) copiado quase byte a byte entre `NetworkPulsePage.tsx` e
`RewardsPage.tsx`.

## Achados

### 1. Configuração — constantes de domínio duplicadas em vez de importadas
**Mecanismo:** erro (viola um princípio que o próprio projeto declara e segue
em outros lugares: "derivar, nunca número solto" — ver `BLOCKS_PER_DAY` em
`earnings.ts:14`, que deriva de `BLOCK_TIME_SECONDS` importado, com o
comentário explícito "nunca 720 solto"; `SCANNER_CACHE_SECONDS` importado em
3 dos 4 módulos pro próprio poll interval).
**Onde:**
- `ATOMS_PER_ZEPH = 1e12` definida em `src/lib/emission.ts:14` (exportada) E
  de novo em `src/lib/api/minerStats.ts:19` (privada do módulo) — dois valores
  independentes pro mesmo fator de conversão.
- `MIN_READING_GAP_MS = 55_000` definida em `src/modules/pools/luckHistory.ts:20`
  E de novo em `src/modules/rig/rigStatus.ts:73` — mesmo nome, mesmo valor,
  mesma justificativa nos dois comentários ("polling é 60s, gap evita
  duplicata").
- O intervalo de poll das pools (`60_000`) aparece hardcoded em
  `src/modules/pools/PoolsPage.tsx:30` e de novo em
  `src/modules/rig/RigDashboard.tsx:50` — o comentário do RigDashboard.tsx
  ("60s é o **mesmo passo da Bússola de Pools**") admite explicitamente que
  os dois deveriam ser o mesmo valor nomeado, mas não importam de um só
  lugar. (O `SERIES_POLL_MS = 60_000` do RewardsPage.tsx tem justificativa
  DIFERENTE — cadência de bloco, não cache de pool — não é a mesma violação,
  só coincide no número; não contar como 4º caso.)
**Dominante vs. desviante:** a maioria dos poll intervals E o `BLOCKS_PER_DAY`
derivam de uma constante importada nomeada; estes 3 casos hardcodam/redefinem
em vez de importar.
**Severidade:** [Baixo] cada um isoladamente (linha única, sem risco de bug
imediato), mas a repetição em 3 lugares diferentes é o padrão mais consistente
de desvio encontrado nesta auditoria.
**Direção de correção:** mover `ATOMS_PER_ZEPH` pra um único export (emission.ts
já é o dono natural) e importar em minerStats.ts; extrair
`POOL_CACHE_POLL_MS`/equivalente pra um lugar compartilhado entre
PoolsPage e RigDashboard; considerar se o gap de 55s vale uma constante
exportada de `rigStatus.ts` (que já tem o motor genérico) em vez de
redefinida em `luckHistory.ts`.

### 2. Tratamento de erro — bloco de agregação de falhas duplicado
**Mecanismo:** inconsistência por duplicação (não é um estilo competindo com
outro — é o MESMO estilo, copiado em vez de compartilhado).
**Onde:** `src/modules/network/NetworkPulsePage.tsx:184-216` e
`src/modules/rewards/RewardsPage.tsx:217-260` — variáveis `failingSources`
(array de strings condicionais, `.filter(Boolean)`) e `noDataAtAll` (booleano),
seguidas do MESMO JSX ternário (`ErrorNotice variant="blocking"` quando não
há dado nenhum, senão `ErrorNotice` default quando `failingSources.length > 0`)
— nomes de variável idênticos, estrutura idêntica, ~15 linhas cada.
`RigDashboard.tsx:338-342` tem uma 3ª instância adaptada (`earningsFailingSources`,
mesma forma de array+filter) mas renderizada diferente (texto inline em vez
de `ErrorNotice`) — não conta como 4º duplicado exato, mas confirma que o
PADRÃO "agregar falhas de polls paralelos" é recorrente o bastante pra
merecer um hook.
**Dominante vs. desviante:** não há desviante — as 2 cópias são idênticas.
É duplicação pura, não drift de convenção.
**Severidade:** [Médio] — baixo risco imediato, mas é o tipo de duplicação
que cria bug de manutenção real: se uma 5ª fonte de erro for adicionada a um
dos dois polls no futuro, é fácil atualizar uma cópia e esquecer a outra.
**Direção de correção:** extrair um hook `useFailingSources(entries:
{ error: unknown; label: string }[])` que devolve `{ failingSources,
noDataAtAll }`, usado pelos 3 sites (Network, Rewards, e o bloco de earnings
do Rig, adaptando a renderização).

### 3. Organização — três implementações paralelas de "histórico local"
**Mecanismo:** inconsistência (dominante existe mas não foi seguido até o
fim).
**Onde:** três populações fazem a MESMA coisa (ler array do localStorage,
validar entrada a entrada com type guard, aplicar gap mínimo entre leituras,
cortar num cap fixo, try/catch com degradação silenciosa) de formas
independentes:
- `src/modules/pools/luckHistory.ts` — implementação própria, mapa por poolId.
- `src/modules/network/networkHashrateHistory.ts` — implementação própria,
  array plano (sem chave, só uma série).
- `src/modules/rig/rigStatus.ts:164-202` — motor GENÉRICO compartilhado
  (`loadAllFrom`/`appendTo`) usado pelas 2 séries do próprio módulo rig
  (status + diário).
O rig já demonstrou que generalizar funciona (2 séries, 1 motor) — mas o
motor não foi estendido pras outras 2 populações fora do módulo.
**Dominante vs. desviante:** não dá pra dizer que um é "o padrão" — é o
mesmo código reescrito 3 vezes com pequenas variações (mapa vs. array plano).
**Severidade:** [Baixo] — cada implementação é testada e correta
isoladamente (rig-e2e/pools-e2e cobrem cada uma); o risco é só de manutenção
futura (um fix de bug no motor do rig não se propaga pras outras duas).
**Direção de correção:** avaliar se vale generalizar o motor de
`rigStatus.ts` pra `src/lib/` como utilitário genérico
(`createLocalHistory(storageKey, gapMs, cap)`) usado pelos 3 módulos — não é
urgente (baixo blast radius), mas é candidato natural pro
`code-audit-cleanup` ou pro Prompt 5.

### 4. Camadas — dois gráficos reimplementam a mesma interação
**Mecanismo:** inconsistência (duplicação de lógica substancial, não só
constante).
**Onde:** `ReserveRatioChart.tsx` e `RewardSplitChart.tsx` (mesmo módulo,
`rewards/`) implementam, cada um por conta própria: estado de hover
(`{index, source: 'pointer'|'keyboard'}`), o mesmo `onKeyDown` (Arrow
Left/Right/Home/End/Escape), o mesmo cálculo de posição de tooltip
(`Math.min(Math.max(x(...), N), Math.max(width - N, N))`), e chamam as MESMAS
funções de `chartGeometry.ts` (`axisTicks`/`niceStep`) da mesma forma. Cerca
de 40-50% de cada componente (~120 de ~300 linhas) é esse esqueleto de
interação, não lógica específica do gráfico.
**Dominante vs. desviante:** os dois fazem EXATAMENTE a mesma coisa — de
novo, duplicação pura, não convenções competindo.
**Severidade:** [Médio] — maior volume de código duplicado desta auditoria;
risco real é os dois desenhos de interação divergirem com o tempo (ex.: um
ganhar um ajuste de acessibilidade que o outro não recebe — já quase
aconteceu, os dois têm o mesmo `focus-visible:outline-2` copiado à mão).
**Direção de correção:** extrair um hook `useChartHover(count, width)` (ou
`useKeyboardScrub`) que devolve `{ hover, onKeyDown, setHoverFromPointer,
tooltipLeft }` — os dois componentes já compartilham `chartGeometry.ts`,
então o precedente de extrair pro nível do módulo já existe.

## Pontos fortes confirmados (medidos, não impressão)

- **Camada de rede 100% uniforme**: as 6 chamadas de `fetch(` do projeto
  inteiro vivem todas dentro de `src/lib/api/http.ts`; os outros 5 arquivos
  de `lib/api/` e os 38 arquivos de `src/` inteiros usam `fetchJson` — zero
  bypass.
- **`usePolling` sem exceção**: os 4 page components (Network, Pools, Rewards,
  Rig) usam o hook compartilhado; nenhum implementa fetch+setState próprio.
- **Distinção deliberada e correta entre "fonte única" (lança erro) e
  "agregador multi-fonte" (isola erro por item)**: as 5 funções de
  fetch de fonte única (`getLiveStats`, `getStats`, `getNetworkInfo`,
  `fetchXmrigSummary`, os fetchers de `minerStats.ts`) lançam `ApiError`/
  `MinerNotFoundError` e deixam o `usePolling` capturar; a ÚNICA função que
  agrega fontes em paralelo (`fetchAllPoolSnapshots`) usa
  `Promise.allSettled` e devolve erro por item — exatamente porque só ela
  precisa (o requisito "uma pool fora do ar não derruba as outras" é do
  Prompt 2). Isso não é inconsistência, é a mesma regra aplicada
  corretamente aos dois formatos de problema.
- **Validação de localStorage**: as 4 leituras de localStorage
  (`rigConfig.ts`, `luckHistory.ts`, `networkHashrateHistory.ts`,
  `rigStatus.ts`) usam o mesmo padrão de type-guard + try/catch +
  degradação silenciosa — 4/4 idênticos em estrutura (mesmo com o achado 3
  acima sobre não compartilharem o motor).
- **Zero import cruzando camada errada**: nenhum arquivo de `lib/` importa de
  `modules/` ou `components/`; nenhum módulo importa de outro módulo-irmão
  (network/pools/rewards/rig são mutuamente isolados, só compartilham
  lib/hooks/components/ui).
- **Zero `console.*`** no projeto inteiro — decisão deliberada e uniforme
  (erro sempre visível na UI, nunca log silencioso), não uma lacuna.

## Pontuação rápida

| # | Dimensão | Nota | Observação |
|---|---|---|---|
| 1 | Layer separation | 1 | achado 4 (charts) |
| 2 | Error handling | 1 | achado 2 (failingSources) — resto é exemplar |
| 3 | API contract | N/A | sem API própria exposta |
| 4 | Input validation | 0 | único form do produto, consistente; 4/4 leitores de localStorage validam igual |
| 5 | Configuration/env | 1 | achado 1 (3 constantes duplicadas) |
| 6 | Data access | 0 | 100% via fetchJson, zero bypass |
| 7 | Auth | N/A | sem auth por design |
| 8 | Observability | N/A | sem logging por design (erro é sempre UI) |
| 9 | Naming/organization | 1 | achado 3 (3 motores de histórico) |
| 10 | Dependency boundaries | 0 | zero import na direção errada |

Soma nas 7 dimensões aplicáveis: **4** — na faixa "consistente" baixa/início
de "acúmulo de deriva" da rubrica do skill, mas os 4 achados são todos
duplicação pura (o padrão certo já existe e é seguido, só não foi
compartilhado) — não há nenhum caso de convenções DIFERENTES competindo pelo
mesmo problema. Não é o tipo de "cada feature nova é cara ou coroa" que a
faixa mais alta descreve: as últimas ~15 sessões de prompt seguiram os
mesmos padrões (fetchJson/usePolling/ErrorNotice/StatCard) sem exceção.

## Recomendação de sequência

Nenhum achado é urgente (todos [Baixo]/[Médio], zero [Alto], zero bug de
comportamento). Candidatos naturais pro `code-audit-cleanup` (mecânico,
preserva comportamento) ou pro Prompt 5 (integração final): achados 1 e 2
são pequenos e seguros de aplicar em qualquer momento; achado 4 é o de
maior volume e vale mais atenção; achado 3 é o de menor prioridade (zero
risco ativo, só dívida de manutenção).
