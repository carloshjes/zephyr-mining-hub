# Zephyr Mining Hub — Plano de Construção e Prompts

Guia de execução pro vibecoding com Claude Fable 5 (GLM-5.2 pausado por falta de assinatura ativa — troca de volta quando quiser, nada abaixo depende de qual modelo executa), seguindo as técnicas do `guia_conversar_com_llm.md` (papel, tags XML, contexto+porquê, auto-verificação, encadeamento em vez de "tudo de uma vez", conversa nova por tarefa nova).

## Como usar este documento

1. Cole o bloco **CLAUDE.md** (seção abaixo) num arquivo `CLAUDE.md` na raiz do repo, uma vez só. Tanto `claude` (Fable) quanto `claude` apontado pra Z.ai (GLM) leem esse arquivo automaticamente — é o "system prompt" persistente dos dois, evita repetir contexto estável em todo prompt (economia de tokens, Seção 3/7 do guia).
2. Pra cada Prompt (1 a 5), abra um terminal/sessão **nova** (Seção 7, tática 1 do guia: assunto novo → mesa limpa) com o modelo indicado, cole o prompt inteiro.
3. Rode na ordem — cada prompt assume que o anterior já rodou. Não pule pra frente.
4. Se a saída de um prompt não ficar boa de primeira, não reescreva o prompt do zero: use o ciclo da Seção 6.3 do guia — peça pro próprio modelo revisar contra os critérios de aceite listados no prompt, depois reescrever.

Sem GLM ativo por enquanto: os Prompts 2, 3 e 4 (antes GLM) rodam no Fable também — o conteúdo de cada prompt não muda, só quem executa. Mesmo assim, mantenha uma sessão nova por prompt, sem juntar os 3 módulos numa sessão só: é o commit por módulo que dá o checkpoint reversível, e o guia de prompts já avisa que contexto grande demais piora precisão (Seção 3, context rot) — nenhum dos dois motivos depende de qual modelo tá rodando.

---

## Passo 0 — Repositório no GitHub (antes do Prompt 1)

Sim, crie antes. Dois motivos: com 5 prompts em sessões separadas e dois modelos diferentes, commitar depois de cada prompt é sua rede de segurança — se o GLM bagunçar algo no Prompt 3, você volta pro estado do Prompt 2 com um `git reset`; e o deploy (Vercel — ver atualização na seção "Decisões de arquitetura") já fica plugado desde o início, sem migrar depois.

1. **Crie o repositório vazio.** Em github.com → "New repository". Nome sugerido: `zephyr-mining-hub`. Público ou privado, sua escolha, não muda nada tecnicamente. Deixe README, .gitignore e license **desmarcados** — o repo precisa nascer vazio, senão conflita com o scaffold do Vite no Prompt 1.

2. **Clone na sua máquina** (a própria página do repo recém-criado mostra a URL pra copiar):
   ```bash
   git clone https://github.com/SEU_USUARIO/zephyr-mining-hub.git
   cd zephyr-mining-hub
   ```
   Se você já criou a pasta de destino manualmente antes, entre nela e clone com `.` no
   final (`git clone URL .`) — assim o git usa a pasta existente em vez de tentar criar
   uma subpasta nova com o mesmo nome.

3. **Chame o Fable de dentro dessa pasta.** É essa pasta vazia e clonada que vira a raiz do projeto:
   ```bash
   claude
   ```
   Cole o Prompt 1. Quando ele for scaffoldar o Vite, a pasta atual (`.`) já é o repo — oriente-o a criar o projeto ali dentro, não numa subpasta nova (senão fica `zephyr-mining-hub/zephyr-mining-hub/`).

4. **Confira o .gitignore** que o scaffold do Vite gera (cobre `node_modules/`, `dist/`, etc.) antes do primeiro commit, pra não subir `node_modules` sem querer.

5. **Commit depois de CADA prompt, não só no final:**
   ```bash
   git add -A
   git commit -m "prompt 1: fundacao + modulo pulso da rede"
   git push
   ```
   Repita a cada prompt (2, 3, 4, 5) com uma mensagem descrevendo o módulo — é o mesmo princípio de "encadeamento" do guia de prompts, só que em nível de git: um checkpoint reversível por módulo.

6. **Deploy fica pra depois, mas mudou de GitHub Pages pra Vercel** — o Prompt 1 descobriu que a Scanner API bloqueia CORS e precisa de um rewrite/proxy que GitHub Pages (100% estático) não oferece (ver "Decisões de arquitetura"). Fluxo: vercel.com → importar o repo do GitHub → deploy automático a cada push. Monto o prompt do rewrite de produção quando chegar nessa etapa.

Se já tiver o GitHub CLI (`gh`) instalado, os passos 1+2 viram um comando só: `gh repo create zephyr-mining-hub --public --clone` (ou `--private`).

---

## Decisões de arquitetura (atualizado após o Prompt 1 — achados reais, não mais suposição)

- **Stack:** Vite + React + TypeScript + Tailwind CSS — confirmado, scaffold já rodando.
- **Deploy: Vercel (conectado ao repo GitHub), não GitHub Pages.** Motivo real, não cautela: a Zephyr Scanner API bloqueia CORS no navegador, então o módulo Pulso da Rede só funciona com um proxy — o Vite dev server resolve em dev, mas GitHub Pages é 100% estático e não roda proxy/rewrite. Vercel resolve com rewrite e continua puxando do seu GitHub a cada push — não muda o "construí pelo meu GitHub", só troca onde o site fica hospedado.
- **Por que essa stack:** combinação mais comum em exemplos de treino dos modelos de coding hoje, então tanto Fable quanto GLM erram menos nela; cabe inteira em "sozinho-em-semanas".

### Descobertas da Fase 0 (Prompt 1) — valem pra todos os prompts seguintes

1. **Scanner API bloqueia CORS, confirmado com fetch real** (sem header `Access-Control-Allow-Origin`). Qualquer módulo que use `/livestats`, `/stats` ou `/blockrewards` — isso inclui o Prompt 3 — **tem que reusar a camada de dados existente em `src/lib/api/`**, nunca fazer fetch direto pra `zephyrprotocol.com`. É o único lugar que já sabe passar pelo proxy.
2. **Hashrate e dificuldade de rede não existem no Scanner API** (campo a campo, confirmado). Fonte real: `explorer.zephyrprotocol.com/api/networkinfo`, CORS aberto, sem proxy necessário. Já no CLAUDE.md atualizado abaixo.
3. **2Miners confirmado CORS-aberto** direto do navegador. As outras pools (HeroMiners, MiningOcean, K1Pool, RavenMiner) seguem não testadas — trate como incerto até confirmar cada uma no Prompt 2.
4. **XMRig real confirmado CORS-aberto** (conferido no código-fonte dele) e sem bloqueio de mixed content testado localhost→127.0.0.1 (via `scripts/xmrig-sim.mjs`, reaproveitável). **Em aberto:** o mesmo teste com a página já publicada em HTTPS (Vercel) contra XMRig local em HTTP é um cenário diferente e ainda não testado — o Prompt 4 precisa validar isso especificamente.

**Antes de rodar o Prompt 2:** peça pro Fable, na mesma sessão do Prompt 1 (ele já tem o contexto todo), atualizar o CLAUDE.md do repo com esses 4 pontos. Sessões novas (Prompts 2-4) só enxergam o que estiver escrito lá, não esta conversa.

---

## CLAUDE.md (cole isso na raiz do repo)

```markdown
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
- GET /stats?scale=day|hour|block&from=&to=&fields= — série histórica por TEMPO (from/to em unix
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
  CORS → bloqueado no navegador. Integrar só com proxy (TODO em pools.ts).
- MiningOcean — sem REST JSON público (front usa protobuf sobre SSE). TODO.
- RavenMiner — endpoint de stats não confirmado (API respondeu "method not found" e
  o DNS de zeph.ravenminer.com estava instável no teste). TODO.
Lista completa e atualizada de pools: https://miningpoolstats.stream/zephyr

O dropdown de pool do módulo Monitor do Rig usa só 2Miners e HeroMiners — as outras 3
não estão prontas.

## API local do XMRig
Quando XMRig roda com `--http-enabled` (porta configurável, ex. 16000):
GET http://127.0.0.1:PORTA/1/summary → hashrate, shares, uptime, backend de CPU.
Sem autenticação por padrão, a menos que `access-token` tenha sido configurado.

CORS confirmado aberto no binário real do XMRig (`Access-Control-Allow-Origin: *`,
conferido no código-fonte). Mixed content testado DUAS vezes (ver NOTES.md):
localhost→127.0.0.1 (Fase 0) e **https://localhost→http://127.0.0.1 (Prompt 4,
`scripts/rig-https-mixed.mjs`)** — os dois funcionam, zero aviso de mixed content; a
isenção de loopback do Chromium vale com página https. A trava real é CORS do servidor
local, e o XMRig real manda `*`. **Pendência restante (menor):** página PÚBLICA
(Vercel) é outro espaço de endereço — a política de Local Network Access do Chrome só
dá pra validar com o deploy real; a UI já degrada graciosamente se bloquear.

## Riscos conhecidos
Ver NOTES.md pro detalhe completo dos testes de CORS/mixed-content da Fase 0. Resumo:
Scanner API bloqueada (usa proxy), 2Miners e XMRig real liberados, hashrate/dificuldade
não vêm do Scanner API (usar Explorer API acima).
```

---

## Prompt 1 — Fable: Fundação + módulo Pulso da Rede

```
Aja como um engenheiro front-end sênior, especialista em React + TypeScript e em
consumir APIs REST públicas de forma resiliente (cache, retry, tratamento de erro).

<contexto>
Este é o primeiro prompt de um projeto maior — leia CLAUDE.md na raiz do repo antes de
começar, ele tem o contexto completo do produto. Estou construindo o "Zephyr Mining Hub",
um dashboard web para a comunidade que minera Zephyr (ZEPH, XMRig/RandomX). O produto
final terá 4 módulos, mas cada um será construído em um prompt separado, em sessões
diferentes. Este prompt cobre SÓ a fundação: não implemente os outros 3 módulos ainda,
apenas deixe a arquitetura pronta pra recebê-los.
</contexto>

<tarefa>
1. Scaffold do projeto: Vite + React + TypeScript + Tailwind CSS. A pasta atual já é um
   repositório git clonado do GitHub (vazio) — crie o projeto dentro dela mesma (use "."
   como diretório de destino), não crie uma subpasta nova.
2. Estrutura de pastas para os 4 módulos futuros com navegação já funcionando entre as
   rotas /rede, /pools, /recompensa, /meu-rig (as 3 últimas podem ser placeholder vazio
   por enquanto).
3. Camada de dados tipada (ex. src/lib/api/) para os endpoints da Zephyr Scanner API.
   Implemente agora só os usados no módulo "Pulso da Rede": /livestats e /stats.
4. Implemente o módulo "Pulso da Rede" (/rede) completo, como prova de vida: hashrate e
   dificuldade de rede, reserve ratio atual, contagem regressiva pro próximo halving.
   Atualização automática respeitando o cache de 30s do endpoint.
5. Valide de verdade (não suponha) e registre em NOTES.md:
   - CORS: um fetch do navegador para https://zeph.2miners.com/api/stats funciona, ou o
     navegador bloqueia? Teste com fetch real no console/app e registre o resultado.
   - Mixed content: um fetch do navegador para http://127.0.0.1:PORTA (simulando a API
     local do XMRig) a partir da página em localhost funciona sem bloqueio? Teste e
     registre; se não tiver XMRig rodando pra testar de verdade, suba qualquer servidor
     HTTP local na porta pra simular e documente o resultado.
</tarefa>

<dados_e_apis>
Ver CLAUDE.md para a referência completa. Para este prompt, você só precisa de:
- GET https://zephyrprotocol.com/api/v1/livestats (cache 30s)
- GET https://zephyrprotocol.com/api/v1/stats?scale=day&fields=zeph_price_close,reserve_ratio_close
</dados_e_apis>

<restricoes>
- Sem backend próprio nesta fase — tudo client-side.
- Erro de rede/API sempre visível: mostre um estado de "dado indisponível, tentando de
  novo", nunca tela em branco.
- Código (variáveis/funções/componentes) em inglês; comentários em português.
- Não implemente autenticação nem wallet nesta fase — isso é de outro módulo.
</restricoes>

<criterios_de_aceite>
- `npm run dev` sobe sem erro.
- A aba "Pulso da Rede" mostra dado real da API (não mock) e atualiza sozinha.
- As outras 3 abas existem na navegação, mesmo vazias.
- NOTES.md existe com o resultado REAL dos dois testes de CORS/mixed-content — não
  "provavelmente funciona", o resultado observado.
</criterios_de_aceite>

Antes de finalizar, confira cada critério de aceite acima um por um. Se algum teste de
CORS/mixed-content falhar, não tente resolver de forma definitiva agora — só documente
o resultado e a limitação em NOTES.md e siga.
```

---

## Prompt 2 — Fable: módulo Bússola de Pools

```
Aja como um desenvolvedor front-end pleno, focado em consumir múltiplas APIs REST em
paralelo e normalizar dados de fontes heterogêneas numa tabela comparativa.

<contexto>
Você está adicionando o módulo "Bússola de Pools" ao projeto Zephyr Mining Hub — a
fundação já existe (leia CLAUDE.md e o código em src/ antes de começar). A rota /pools
hoje é um placeholder vazio; substitua pelo módulo completo abaixo.
</contexto>

<tarefa>
1. Busque dados das pools de ZEPH conhecidas (lista e URLs no CLAUDE.md) em paralelo.
2. Normalize os campos numa interface comum: nome da pool, fee (%) se disponível,
   hashrate da pool, número de mineradores, min. payout, luck (se disponível), block
   height reportado.
3. Monte uma tabela ordenável por qualquer coluna (clique no cabeçalho ordena), com
   destaque visual pra pool com maior hashrate e outro pra menor fee.
4. Se uma pool falhar ao responder, não quebre a tela inteira — mostre "indisponível" só
   naquela linha e continue mostrando as demais.
5. Guarde um histórico simples do campo "luck" a cada atualização (localStorage) e mostre
   um mini-gráfico de tendência (últimas ~20 leituras) por pool.
</tarefa>

<dados_e_apis>
Lista de pools e formato esperado de resposta: seção "APIs de Pool" do CLAUDE.md. Seguem
aproximadamente o padrão cryptonote-nodejs-pool (confirmei o formato da 2Miners; as
demais devem ser parecidas, mas confirme campo a campo ao integrar — não assuma nomes).
</dados_e_apis>

<restricoes>
- Se alguma pool não liberar CORS (ver NOTES.md da fase anterior), deixe um comentário
  TODO no lugar daquela chamada em vez de travar a build.
- Não invente número: campo ausente na resposta vira "—", nunca um valor fake.
</restricoes>

<criterios_de_aceite>
- Tabela carrega com pelo menos as pools que responderem sem bloqueio de CORS.
- Ordenação por coluna funciona em pelo menos 3 colunas diferentes.
- Uma pool fora do ar (simule desligando a chamada dela) não derruba as outras linhas.
</criterios_de_aceite>

Antes de finalizar, simule uma pool retornando erro (desconecte ou force um 500 nela) e
confirme que o resto da tabela continua de pé. Teste esse caso antes de dar como pronto.
```

---

## Prompt 3 — Fable: módulo Raio-X da Recompensa

```
Aja como um desenvolvedor front-end pleno com experiência em visualização de dados
(séries temporais) e em explicar mecânicas financeiras complexas de forma simples e
visual pra um público não-especialista.

<contexto>
Módulo "Raio-X da Recompensa" do Zephyr Mining Hub — o módulo mais conceitual do
projeto. A tese por trás dele: em Zephyr, o prêmio de bloco não vai 100% pro minerador —
é fatiado entre minerador, reserva do ZSD e yield do ZYS, e essa fatia muda com o reserve
ratio da rede. Nenhum outro dashboard de mineração mostra isso, porque é mecânica
exclusiva do protocolo Zephyr (Djed). Este módulo existe pra tornar essa fatia visível e
explicável pra quem minera mas não necessariamente entende a fundo a mecânica por trás.
</contexto>

<tarefa>
1. Busque os últimos N blocos (configurável, padrão 200) de /blockrewards — traz
   miner_reward, governance_reward, reserve_reward, yield_reward por bloco.
2. Monte um gráfico de área empilhada dessas 4 fatias ao longo dos blocos/tempo.
3. Destaque em texto simples o dado mais recente: "Agora, de cada bloco de X ZEPH, Y% vai
   pro minerador, Z% pra reserva, W% pro yield" (calculado a partir do bloco mais recente).
4. Cruze com /livestats (reserve_ratio) num segundo gráfico de linha simples, abaixo ou ao
   lado, sugerindo a relação entre reserve ratio e o tamanho da fatia do minerador.
5. Escreva 2-3 frases fixas (não geradas dinamicamente a cada load) explicando o "porquê"
   dessa mecânica pra alguém que nunca ouviu falar de Djed — linguagem simples, sem jargão
   de finanças descentralizadas.
</tarefa>

<dados_e_apis>
GET /blockrewards?from=&to=&order=desc — ver CLAUDE.md pro formato completo de resposta.
GET /livestats pro reserve_ratio atual.

IMPORTANTE: a Scanner API bloqueia CORS direto do navegador (confirmado na Fase 0/Prompt
1). NÃO faça fetch direto pra zephyrprotocol.com — use e estenda a camada de dados já
existente em src/lib/api/ (ela já resolve isso via proxy). Leia esse código antes de
escrever qualquer chamada nova.
</dados_e_apis>

<restricoes>
- Não afirme causalidade que os dados não sustentam: ao mostrar reserve_ratio junto da
  fatia do minerador, deixe claro que é observação/correlação, não uma fórmula garantida
  — a fórmula exata de split não está disponível nos dados, só o resultado por bloco.
- Gráfico responsivo, legível em tela de celular.
</restricoes>

<criterios_de_aceite>
- Gráfico de área empilhada renderiza com dado real, não mock.
- O texto "agora" bate matematicamente com o bloco mais recente retornado pela API.
- As 2-3 frases explicativas fazem sentido pra alguém que só conhece mineração de Monero
  e nunca ouviu falar de reserve ratio.
</criterios_de_aceite>

Antes de finalizar, releia as frases explicativas do passo 5 como se você fosse alguém
que só sabe minerar Monero e nunca ouviu falar de "reserve ratio" — ainda fazem sentido
sem clicar em nada a mais? Ajuste se não fizerem.
```

---

## Prompt 4 — Fable: módulo Monitor do Rig

```
Aja como um desenvolvedor front-end pleno, com atenção a estado persistente no navegador
(localStorage) e a UX de configuração feita pelo próprio usuário final, sem tela de admin
e sem backend.

<contexto>
Módulo "Monitor do Rig" do Zephyr Mining Hub. Diferente dos outros 3 módulos (públicos,
sem configuração), este é por visitante: cada pessoa que abrir o site configura o próprio
endereço de carteira e, opcionalmente, sua própria pool e o endereço da API local do
próprio XMRig, pra acompanhar o próprio rig.
</contexto>

<tarefa>
1. Formulário simples (sem conta, sem login): visitante escolhe pool — dropdown com
   SÓ 2Miners e HeroMiners (únicas confirmadas integráveis no Prompt 2; as outras 3
   ficam de fora até os TODOs em src/lib/api/pools.ts serem resolvidos), endereço de
   carteira ZEPH, e opcionalmente host:porta da API local do XMRig.
2. Salve essa configuração em localStorage — ao voltar no site, os campos já vêm
   preenchidos.
3. Com endereço + pool configurados, busque as estatísticas daquele minerador específico
   na API da pool escolhida (endpoint de stats por endereço — ver CLAUDE.md; confirme o
   formato exato pra pool escolhida, pode variar entre pools).
4. Se o XMRig local estiver configurado E acessível (ver NOTES.md sobre mixed content),
   mostre também hashrate local em tempo real, shares aceitas/rejeitadas, uptime.
5. Defina um estado visual único e óbvio, comparando hashrate atual com a média das
   últimas leituras: "minerando normal" / "hashrate abaixo do esperado" / "offline".
</tarefa>

<dados_e_apis>
Ver CLAUDE.md: seção "API por minerador" de cada pool, e seção "API local do XMRig"
(endpoint /1/summary, sem auth por padrão).
</dados_e_apis>

<restricoes>
- Nunca peça chave privada ou seed — só endereço público (é tudo que as APIs de pool
  precisam pra consultar estatísticas).
- Se a API local do XMRig não for alcançável, degrade graciosamente: mostre só o dado da
  pool, sem quebrar a tela.
- O XMRig real já é CORS-aberto (confirmado na Fase 0) e existe um simulador em
  scripts/xmrig-sim.mjs pra testar sem hardware. O que ainda NÃO foi testado é a página já
  publicada em HTTPS acessando XMRig local em HTTP (mixed content) — teste esse cenário
  especificamente (`npm run build && npm run preview`, ou já no Vercel) e registre o
  resultado em NOTES.md antes de dar o módulo como pronto.
</restricoes>

<criterios_de_aceite>
- Configuração sobrevive a um refresh da página (localStorage funcionando de verdade).
- Com um endereço de carteira de teste, os dados da pool aparecem na tela.
- Sem XMRig local rodando, a tela não quebra — só omite aquela parte, sem erro visível.
</criterios_de_aceite>

Antes de finalizar, teste o fluxo completo do zero: navegador sem nada salvo → preenche o
formulário → dado aparece → dá refresh na página → dado continua lá sem precisar
preencher de novo. Confirme os 4 passos nessa ordem antes de dar como pronto.
```

---

## Prompt R1 — Fable: Redesign visual ("Sinal Técnico")

Roda depois do Prompt 4, antes do Prompt 5. Direção decidida em 2026-07-09 fora do Claude
Code, via skill `creative-ui-director` (Claude Sonnet 5, chat de arquitetura), com evidência
real: screenshot das 4 telas atuais + navegação ao vivo em 3 sites de referência
(zephyrprotocol.com, rig.ai, labs.scale.com). Não pule esse prompt nem tente redecidir a
direção — só execute.

```
Aja como um engenheiro front-end sênior com direção de design forte — você decide
hierarquia, composição e tipografia antes de tocar em componente solto, na mesma régua de
um design lead que revisa o próprio trabalho contra um baseline genérico antes de aceitar
como pronto.

<contexto>
Os 4 módulos do Zephyr Mining Hub (Pulso da Rede, Bússola de Pools, Raio-X da Recompensa,
Monitor do Rig) estão prontos e commitados — leia CLAUDE.md e o código em src/ antes de
começar. Cada um foi construído numa sessão separada sem memória compartilhada, e por isso
a tela hoje é visualmente genérica: seções empilhadas em caixas de peso idêntico, nenhuma
hierarquia, nenhum "signature move", paleta de gráfico solta (azul/verde/amarelo/violeta
sem critério). Isso foi diagnosticado e decidido ANTES desta sessão, num processo
estruturado de direção visual (skill creative-ui-director) rodado fora do Claude Code, com
evidência real. Você não precisa nem deve reabrir esse processo ou explorar direções
alternativas — a direção já foi escolhida e validada com o Carlos. Seu trabalho é executar
com qualidade de implementação, não redecidir o rumo.

Esta sessão roda ANTES do Prompt 5 (integração final) — Prompt 5 continua existindo depois
desta, mas vai herdar um produto já visualmente consistente, então o foco dele muda de
"unificar estilos divergentes" pra "revisão fina + página inicial".
</contexto>

<direcao_escolhida>
Nome: "Sinal Técnico" — fusão de dois references:
- rig.ai: fundo unificado quase preto (não caixas navy soltas flutuando), anotação técnica
  em monoespaçada com colchetes (`[ LABEL ]`), tipografia display grande e confiante, uma
  cor de destaque reservada estritamente pra alerta/energia.
- zephyrprotocol.com: família de roxo herdada da própria moeda (parentesco de marca com o
  ecossistema Zephyr) substituindo a paleta hoje solta; manchete numérica em escala grande,
  às vezes cortada na borda da tela como recurso de composição.

Paleta de partida (valores aproximados extraídos visualmente das referências — ajuste fino
de contraste/acessibilidade fica com você):
- Fundo base: quase preto, ~#0A0A0E (não #0f172a slate atual — mais escuro e neutro, não
  azulado).
- Roxo primário (texto de destaque, manchete, fatia dominante): ~#A996F5.
- Roxo médio (fatia secundária, elementos de suporte): ~#6F5FC4.
- Roxo escuro (fatia terciária, decoração discreta): ~#352D54.
- Vermelho/coral RESERVADO só pra alerta (reserve ratio abaixo do piso de 4,0, erro,
  offline): ~#E8492F. Não usar decorativamente em mais nada.
- Texto secundário/muted sobre o fundo escuro: tons de cinza-roxo (~#8B86A0, ~#57536A) —
  não cinza puro.
- Divisores: hairline discreto (~#221F29), não a borda pesada arredondada que as caixas
  usam hoje.

Tipografia: mantém a fonte de corpo atual pra texto de leitura longa (explicações, tabela).
Introduz uma família monoespaçada (system monospace tá ok se não quiser puxar webfont
nova) só pra metadado técnico: altura de bloco, timestamp, rótulos entre colchetes,
legendas de eixo — nunca pro corpo de texto.

Composição: o sintoma mais grave hoje é "tudo empilhado com peso igual". Em toda tela,
define UMA região dominante (o dado/gráfico mais importante daquele módulo) ocupando a
maior parte da dobra, e as demais informações da tela viram uma coluna/rail mais quieta ao
lado ou abaixo — não mais uma sequência de caixas do mesmo tamanho.
</direcao_escolhida>

<tarefa>
1. Tokens primeiro, num lugar central. Projeto usa Tailwind v4 (plugin
   `@tailwindcss/vite`, ver vite.config.ts) — defina a paleta e a fonte monoespaçada no
   bloco `@theme` do CSS de entrada (não crie tailwind.config.js do zero, não é o padrão
   dessa versão). Nenhuma cor hardcoded solta em componente depois disso.

2. Tela âncora: Raio-X da Recompensa. Aplique primeiro, é a mais rica e a prova de
   conceito do sistema:
   - Manchete numérica (hoje "65,0% vai pro minerador") vira o elemento dominante da
     dobra — tipografia grande o bastante pra cortar na borda em telas largas (feito de
     propósito, não bug), com o roxo primário.
   - O gráfico de área empilhada e o gráfico de reserve ratio hoje vivem em duas caixas
     soltas sem relação visual nenhuma, mesmo a legenda dizendo que é correlação — crie
     um conector visual real entre os dois (linha pontilhada, trilho, ou region
     compartilhada) que expresse "observação, não fórmula" tanto visualmente quanto no
     texto que já existe.
   - Explicação em texto e o gráfico de reserve ratio encolhem pra um rail secundário
     mais quieto, não caixas do mesmo tamanho que o gráfico principal.
   - Tabela (`<details>`) continua colapsada por padrão; troca só o tratamento visual
     (hairline, rótulo monoespaçado) pela lógica do labs.scale.com — não pela borda
     pesada atual.
   - NOVO: estado de alerta visível quando reserve_ratio cruza o piso de 4,0 (hoje não
     existe nenhum destaque nesse cruzamento) — usa o vermelho reservado.

3. Propaga o sistema (tokens + composição dominante/rail) pros outros 3 módulos,
   resolvendo o sintoma mais grave de cada:
   - Monitor do Rig: os 4 cards de estatística hoje têm peso idêntico (card farm
     clássico) — vira uma métrica dominante (ex. hashrate atual + status "minerando
     normal/abaixo/offline", que já existe na lógica) ocupando mais espaço, as outras 3
     métricas encolhem pra um rail ou linha secundária. Tabela de workers ganha o mesmo
     tratamento hairline/monoespaçado da tabela do Raio-X.
   - Bússola de Pools: já é tabela-primeiro, o que é uma escolha correta — só herda
     tokens (cor, hairline) e o tratamento tipo labs.scale (algarismo monoespaçado,
     rótulo entre colchetes). Não precisa de composição dominante/rail nova, a tabela já
     é a região dominante.
   - Pulso da Rede: aplique os tokens (cor, tipografia, hairline). Diagnostique você
     mesmo se essa tela também sofre de "caixas empilhadas de peso igual" — se sim,
     resolve com a mesma lógica dominante/rail (provavelmente o hashrate/dificuldade
     atual vira a região dominante, halving e reserve ratio viram rail); se a tela já
     tiver algum foco claro, documente por que não precisa da mudança estrutural, só dos
     tokens.

4. Casca de navegação: atualiza pro sistema novo — indicador de rota ativa pode usar a
   convenção de colchete (`[ Nome do Módulo ]`) que aparece nas referências, cor de marca
   (roxo) em vez do azul/ciano atual.

5. Autonomia de implementação: dentro dessa direção, você tem liberdade pra decidir
   microinterações, estados de hover/focus, timing de transição, espaçamento fino, e
   pequenos ajustes de composição que só ficam óbvios com o código real na tela — não
   precisa validar cada decisão pequena comigo. A direção estrutural (tokens, composição
   dominante/rail, paleta) NÃO é negociável nesta sessão; o acabamento é.
</tarefa>

<restricoes>
- Proibido: gradiente, glassmorphism, blur, glow, sombra decorativa, novo tema
  claro/dark-mode-toggle. Isso é mudança de tema, não desta sessão (regra da própria
  skill de direção visual: não introduzir tema/localização sem pedido explícito —
  tradução pro inglês é uma sessão futura separada, não mexe em texto agora).
- Proibida uma quarta cor de destaque. É a família de roxo + o vermelho reservado só pro
  alerta — mais que isso é ruído, não hierarquia.
- Preserva toda lógica/dado/cálculo/fetch existente — é só camada de composição,
  tipografia e cor. Se achar um bug real de UI no caminho, documenta em NOTES.md antes de
  corrigir, não corrige calado.
- Contraste WCAG 2.2 AA obrigatório mesmo no fundo quase-preto — teste de verdade, não
  suponha.
- Qualquer microinteração nova respeita `prefers-reduced-motion`.
- Card removido, espaçamento apertado, estado afiado: pra cada remoção decorativa,
  justifique em uma linha no NOTES.md (o que saiu e por quê).
- Um módulo de cada vez dentro da mesma sessão: termina e testa o Raio-X antes de tocar
  no Rig; termina e testa o Rig antes de tocar em Pools; etc. Não editar os 4 em paralelo
  torcendo pra dar certo no final.
</restricoes>

<criterios_de_aceite>
- Tokens (cor, fonte monoespaçada) centralizados no `@theme` do Tailwind — zero cor
  hardcoded nova espalhada em componente.
- As 4 telas + a navegação usam a mesma paleta e a mesma lógica de composição
  dominante/rail (ou documentam por que uma tela não precisava).
- Raio-X da Recompensa: manchete dominante, conector visual entre os 2 gráficos, alerta
  de reserve ratio abaixo de 4,0 implementado e visível de verdade (force o cenário pra
  testar).
- Monitor do Rig: card farm resolvido — não são mais 4 cards de peso idêntico.
- `npm run build` limpo, sem warning novo.
- Testado em pelo menos 3 breakpoints reais com screenshot (reaproveita os scripts de
  e2e/screenshot que os módulos já têm — desktop e mobile, do jeito que o Prompt 3 e o
  Prompt 4 já fizeram) — a manchete cortada do Raio-X, por exemplo, precisa de uma
  recomposição real no mobile, não só encolher.
- CLAUDE.md e NOTES.md atualizados com os valores finais de token (cor exata, fonte) e
  qualquer decisão de composição por módulo.
</criterios_de_aceite>

Antes de finalizar, rode esse auto-check por tela (rubrica curta, 6 perguntas):
1. Sobrevive em preto e branco (a hierarquia não depende só da cor)?
2. Tem uma única região dominante clara, não um empate de peso?
3. Poderia ser confundida com o dashboard genérico de qualquer outro produto?
4. Some o roxo/vermelho da tela — a hierarquia ainda funciona?
5. Sobrevive no menor breakpoint sem só encolher (recompôs de verdade)?
6. A cor está herdada de marca/significado (roxo = Zephyr, vermelho = alerta), não
   decorativa solta?
Se alguma tela falhar em 2+ perguntas, ajuste antes de dar como pronto — não deixa pra
próxima sessão.
```

---

## Prompt L1 — Fable: exploração da logo (Z dot-matrix)

Sessão isolada, independente do Prompt R1/Prompt 5 — só gera opções de logo pra escolher,
não mexe na navegação real ainda.

```
Aja como um desenvolvedor front-end com experiência em geração programática de assets
visuais — grafismo em grade de pontos (dot-matrix/halftone), estilo terminal/ASCII antigo.
Isto não é desenho de path vetorial solto, é um sistema paramétrico que produz várias
variações pra escolher.

<contexto>
Zephyr Mining Hub precisa de uma nova logo, substituindo o ícone de picareta atual em
`src/components/layout/AppShell.tsx` (navegação principal). Referência visual: o site
rig.ai tem, na seção de terminal simulado da home, o texto "RIG" renderizado como letras
grossas e bloqudas construídas inteiramente de pontos/quadradinhos pequenos com espaço
visível entre eles — não uma fonte pixelada pronta, é um efeito de HALFTONE: pega uma letra
bold normal e amostra uma grade por cima, criando um ponto só onde a amostra cai em área
escura da letra. O resultado tem uma textura de "tela de terminal antigo/matriz de LED",
tom cinza-esbranquiçado sobre fundo quase preto, levemente irregular (não perfeitamente
uniforme).

A logo é a letra "Z" nesse mesmo estilo de grade de pontos, com um traço/barra horizontal
cruzando o meio dela — é a convenção tipográfica do "Z barrado" usada em símbolos de moeda
e fontes técnicas (OCR-B, códigos de câmbio) pra nunca confundir com o número 2. Faz sentido
duplo aqui: reforça a leitura de "Z" mesmo pequeno, E remete a símbolo de moeda (ZEPH é o
ticker da criptomoeda).

**A forma do Z NÃO é livre — a Zephyr Protocol (a moeda) já tem uma marca oficial com esse
mesmo conceito de Z barrado.** O Carlos anexou 3 referências dela: um ícone roxo chapado
simples, um medalhão 3D de moeda (relevo, gradiente, fundo de cubos — NÃO copiar esse
tratamento 3D/gradiente, viola a regra de "nada de gradiente/glow/sombra" do projeto), e um
selo circular achatado roxo-escuro com o Z claro no centro. O traço comum aos 3: um Z
geométrico bold — hastes retas, sem serifa, peso grosso tipo Eurostile/Futura Bold — com UMA
barra horizontal reta cruzando a largura toda do Z na altura do meio, sobre a diagonal
(pense num "Ж" cirílico ou um "0" cortado, não um floreio decorativo). Use ESSA silhueta
como base pra amostrar no halftone (desenhe esse Z+barra no canvas antes de amostrar, não
uma fonte bold genérica qualquer) — a logo do Mining Hub deve ter parentesco visual real com
a moeda oficial (é a "versão técnica/terminal" dela, pro projeto da comunidade), não ser um Z
qualquer nem uma cópia 1:1 do medalhão 3D oficial.

Já existe um sistema de tokens visuais no projeto (CLAUDE.md, seção "Direção visual — Sinal
Técnico") — ink-950 (#0a0a0e) de fundo, família zeph (roxo) e mist (cinza-roxo) pra texto,
vermelho `alert` RESERVADO só pra estado de erro. Use esses tokens, não invente cor nova.
</contexto>

<tarefa>
1. Implemente a técnica de halftone de verdade: desenhe o Z barrado (a silhueta descrita
   acima — Z geométrico bold + barra horizontal reta cruzando o meio, referência: marca
   oficial da Zephyr Protocol, NÃO o medalhão 3D) num `<canvas>` invisível — pode ser uma
   fonte bold condensada (tipo Arial Black/Eurostile) desenhada com `fillText` mais um
   `fillRect` pra barra, ou um path SVG próprio se ficar mais fiel à referência — depois
   amostre uma grade de pontos sobre esse canvas — cada célula da grade vira um ponto
   (círculo ou quadrado) só onde a amostra cair em pixel escuro o bastante. Isso é código
   real (Canvas API ou SVG + getImageData), não uma fonte de pontos pronta baixada de algum
   lugar.
2. Gere pelo menos 5 variações reais, cada uma mudando pelo menos UM parâmetro estrutural
   (não só cor):
   - resolução da grade (pontos grandes e esparsos vs. pontos pequenos e densos)
   - forma do ponto (círculo vs. quadrado)
   - peso da fonte-base por trás da amostragem (mais ou menos bold)
   - tratamento da barra central (uma linha só vs. dupla; largura total vs. só cruzando a
     diagonal)
   - uma variação com leve ruído/glitch (alguns pontos em opacidade reduzida ou levemente
     deslocados, pra imitar a imperfeição orgânica da referência do rig.ai — não deixar
     100% uniforme feito grade de Excel)
3. Monte uma página ou script de preview isolado (não é rota do app real) mostrando as 5+
   variações lado a lado em DUAS escalas cada: grande (tipo hero, ~150px) e pequena/realista
   (24–32px, tamanho de ícone de navegação e favicon). Dot-matrix costuma virar borrão em
   tamanho pequeno — isso precisa aparecer no preview, não só a versão grande bonita.
4. Tire screenshot desse preview (reaproveite o padrão de `scripts/design-shots.mjs` ou
   crie um script novo no mesmo estilo) e salve os resultados.
5. Escreva um resumo curto (NOTES.md ou um arquivo novo `docs/logo-exploracao.md`) dizendo
   qual(is) variação(ões) continuam legíveis como "Z" no tamanho pequeno e qual(is) viram
   mancha ilegível — não esconda o que não funcionou, é informação útil pra escolha.
</tarefa>

<restricoes>
- Não mexe em `AppShell.tsx` nem em nenhuma rota real do app — isso é exploração isolada,
  a integração da escolhida vem depois, em outro prompt.
- Só os tokens de cor já existentes (ink-950, família zeph, família mist). Nada de cor nova.
- Não baixe fonte de pontos pronta nem asset externo — a técnica é gerar via canvas/amostragem
  no próprio código, como descrito acima.
</restricoes>

<criterios_de_aceite>
- Pelo menos 5 variações reais (parâmetro estrutural diferente, não só cor) renderizadas.
- Cada variação fotografada em tamanho grande E pequeno/realista.
- Relatório dizendo quais sobrevivem no tamanho pequeno.
- Zero mudança em código de produção (AppShell, rotas, favicon atual) nesta sessão.
</criterios_de_aceite>

Antes de finalizar, olhe as versões pequenas (24–32px) de cada variação como se fosse a
aba do navegador — ainda dá pra reconhecer um "Z" sem saber de antemão o que procurar?
Se não, marque essa variação como reprovada no relatório em vez de incluir só as bonitas.
```

---

## Prompt L2 — Fable: integração da logo no produto

Roda depois do Prompt L1 (exploração já concluída, F3 revisada "sem branco" escolhida por
Carlos em 2026-07-10) e ANTES do Prompt 5 — troca o placeholder atual (emoji de picareta +
favicon provisório) pelo resultado real da exploração. Sessão pequena e contida, não é
preciso isolar módulo por módulo como no R1.

```
Aja como um engenheiro front-end sênior fechando a integração de um asset de marca já
decidido em produção — seu trabalho é execução fiel de parâmetros e paleta já validados
(não redesenhar, não reabrir a exploração), com atenção a onde cada técnica de cor (token
CSS vs. hex resolvido) se aplica.

<contexto>
A exploração de logo (Prompt L1, sessão isolada) terminou e Carlos já escolheu a versão
definitiva: a variação F3 (revisão "sem branco", 2026-07-10) do sistema de halftone "Z
barrado", documentada em docs/logo-exploracao.md e gerada por scripts/logo-preview.html —
leia os dois antes de começar, e leia também CLAUDE.md e
src/components/layout/AppShell.tsx. Hoje o cabeçalho do app usa um emoji de picareta (⛏️)
solto ao lado do texto "Zephyr Mining Hub" (AppShell.tsx, por volta da linha 22), e o
favicon (public/favicon.svg) é um Z roxo provisório sem nenhuma relação com a exploração —
nenhum dos dois usa o resultado do L1. Esta sessão fecha essa lacuna: pega os parâmetros já
validados e gerados na própria página de exploração e integra de verdade no produto. Isso é
acabamento de um resultado já decidido, não uma nova rodada de design — se achar algo
genuinamente quebrado no caminho, documente em NOTES.md antes de corrigir, não redecida a
direção.
</contexto>

<tarefa>
1. Exporte o SVG estático da F3 a partir do gerador real, não de olho/à mão: abra (ou
   script headless, no mesmo padrão de scripts/logo-shots.mjs/design-shots.mjs)
   scripts/logo-preview.html SEM ?anim=1 na URL e capture o markup já renderizado do card
   "F3 · CINTILÂNCIA" (função dotsToSvg, geometria
   FINAL_PARAMS = { cols: 22, shape: 'square', t: .18, bar: 'single', bh: .18 }, tom por
   ponto assignTones(dots, 'sparkle', 22, 11, [.30, .28, .20, .15, .07]) sobre a rampa
   RAMPS.semBranco — 5 tons: --color-mist-300, --color-zeph-300, --color-mist-400,
   --color-zeph-500, --color-zeph-700). O SVG resultante já usa style="fill:var(--...)" por
   ponto — é o padrão certo pra um componente React dentro do app (a var resolve porque o
   componente vive dentro do CSS do app). Confira se a marcação exportada não carrega
   classe/atributo de animação herdado da página de preview (assignTwinkle roda sempre,
   mesmo sem ?anim=1) — se carregar, remova; o resultado tem que ser um SVG limpo e 100%
   estático.
2. Exporte o SVG sólido (controle, sem halftone) pro favicon, mesma técnica, função
   solidSvg({ t: .18, bar: 'single' }, px). Atenção: um favicon é um documento carregado
   pelo navegador FORA da cascata de CSS do app — var(--color-...) não resolve nele.
   Resolva o token pra hex antes de gravar (public/favicon.svg já faz isso hoje, com
   #863bff fixo — mesmo padrão, só trocando a forma). Comece com mist-100 (#edebf4,
   contraste 16,7:1) — é o que a própria exploração recomenda pra ícone de 16px
   (docs/logo-exploracao.md, achado sobre zeph-300 "apagar um degrau antes"); se preferir
   consistência total de roxo com a F3, teste zeph-300 (#a996f5) e confirme de olho na aba
   real do navegador antes de decidir — legibilidade em 16px manda mais que preferência de
   tom aqui.
3. Troque o emoji ⛏️ no header do AppShell.tsx pelo SVG da F3 (passo 1) — como componente
   React inline ou um LogoMark pequeno em src/components/, sua escolha. Mantenha o
   tratamento decorativo atual (aria-hidden, já que o texto "Zephyr Mining Hub" ao lado
   carrega o nome acessível) — não deixe o role="img" aria-label="..." que a página de
   exploração usa isoladamente, ele duplicaria o nome acessível. Tamanho: a exploração
   validou legibilidade a partir de 24px — escolha algo nessa faixa (ajuste o gap do header
   se precisar), sem esticar/distorcer o viewBox.
4. Troque public/favicon.svg pelo SVG sólido (passo 2) — mesmo caminho de arquivo,
   index.html não precisa mudar (já referencia /favicon.svg como image/svg+xml).
5. Verificação visual real: rode (ou estenda) scripts/design-shots.mjs pra capturar o
   header com a logo nova nos 3 breakpoints já usados (1360/768/390) em pelo menos uma
   tela, e tire um screenshot dedicado da aba do navegador mostrando o favicon novo de
   verdade (16px real, não o SVG grande) — confira que ainda lê como "Z" no tamanho da aba,
   com a mesma honestidade do docs/logo-exploracao.md (se não ler bem, troque a cor
   conforme o passo 2 antes de dar como pronto, não empurre pra depois).
6. Atualize CLAUDE.md (uma linha na seção de direção visual, registrando que a logo
   F3/sólido está integrada) e NOTES.md (o que foi exportado, de qual card, com quais
   parâmetros exatos — pra fechar o rastro que o L1 deixou aberto).
</tarefa>

<restricoes>
- Zero redesenho: os parâmetros de geometria, rampa de tom e pesos da F3 já estão
  decididos (docs/logo-exploracao.md + scripts/logo-preview.html) — extraia, não
  reinvente.
- Sem animação em produção: nada de ?anim=1/cintilação de opacidade no app — só a marca
  estática. Se um dia isso for pedido, é sessão separada (a própria NOTES.md já registra a
  ressalva de prefers-reduced-motion).
- Cor: no componente React (header), token via CSS var em style, nunca hex solto — regra
  do projeto. No favicon.svg, hex resolvido é o padrão aceito (mesmo esquema do arquivo
  atual) porque o arquivo vive fora da cascata do app — não confunda os dois casos.
- Não mexa em public/icons.svg (sprite de ícones de rodapé/social, sem relação com esta
  logo) nem em nenhuma rota/lógica dos 4 módulos.
- npm run build limpo, sem warning novo.
</restricoes>

<criterios_de_aceite>
- Emoji ⛏️ removido; header mostra a F3 (versão estática, parâmetros extraídos de verdade
  da página de exploração, não reaproximados).
- Favicon novo aparece na aba do navegador e continua legível em 16px real (confirmado por
  screenshot da aba, não só do SVG ampliado).
- Nenhum hex novo solto em componente React; favicon com hex resolvido documentado (qual
  token, qual hex).
- Zero animação nova em produção.
- Screenshots dos 3 breakpoints com o header novo, sem quebra de layout (nav já usa
  flex-wrap — confirme que não sobrepõe em mobile).
- npm run build limpo.
- CLAUDE.md e NOTES.md atualizados fechando o item "logo" do roadmap.
</criterios_de_aceite>

Antes de finalizar, olhe o favicon na aba do navegador (16px de verdade, não o preview
grande) como se fosse a primeira vez vendo o site — ainda reconhece um "Z"? Se não, troque
a cor (passo 2) antes de dar como pronto.
```

---

## Prompt R2 — Fable: Sinal Técnico v2 (cor de status, textura, tipografia, movimento, logo)

Roda depois do L2 (commite o L2 antes de começar esta sessão — R2 mexe em `AppShell.tsx`,
que o L2 já alterou). Direção decidida em 2026-07-10 fora do Claude Code, via skill
`creative-ui-director` (Claude Sonnet 5), com evidência real: screenshots do produto atual
+ inspeção ao vivo do rig.ai via Claude in Chrome (cores medidas por `getComputedStyle`, não
estimadas). Assim como o R1, não é pra reabrir a direção — só executar.

```
Aja como um engenheiro front-end sênior de direção visual, dando continuidade a um sistema
já validado — isto é uma evolução dirigida (v2) do redesign "Sinal Técnico" do Prompt R1,
não uma reformulação. Direção e paleta já foram decididas com evidência real (medição de
tela + inspeção ao vivo de referência); seu trabalho é implementar com rigor, não redecidir.

<contexto>
O Prompt R1 (commit 7f88da7) estabeleceu o sistema "Sinal Técnico": fundo ink-950
unificado, família roxa zeph, composição dominante/rail, convenção mono [ LABEL ], vermelho
alert reservado. Funcionou bem, mas usando o produto real (screenshots de 2026-07-10, não
descrição) apareceram problemas concretos que o Carlos e uma sessão de direção visual
(skill creative-ui-director, com inspeção ao vivo do rig.ai via Claude in Chrome — valores
de cor medidos por getComputedStyle, não estimados) já diagnosticaram e decidiram como
resolver. Leia CLAUDE.md, NOTES.md e o código de src/ antes de começar. Isto NÃO é uma
redescoberta de direção — a paleta, o mapeamento de cor e as prioridades abaixo já foram
decididos; seu trabalho é execução com o mesmo rigor do R1 (evidência real, contraste
medido, um módulo de cada vez).
</contexto>

<diagnostico>
Achados reais no Raio-X da Recompensa (tela mais afetada, screenshot de 2026-07-10):
1. Legenda e gráfico empilhado usam só variações do mesmo roxo — swatches
   (minerador/reserva/yield) quase indistinguíveis, cor não diferencia nada.
2. Escala tipográfica sem degrau intermediário: manchete gigante (65,0%) vs. quase tudo
   mais pequeno/apagado (legenda, eixos, rail) — falta 2-3 degraus no meio.
3. O painel de reserve ratio no rail direito renderiza como um retângulo vazio, sem
   eixo/linha visível — investigue a causa raiz (pode ser bug de timing/contraste, não só
   estética) e documente em NOTES.md antes de corrigir, junto com o fix.
4. Zero movimento em qualquer gráfico (confirmado: só há tooltip interativo, nenhuma
   entrada/atualização animada).
5. LogoMark no header (AppShell.tsx) renderiza em 26px — no piso do que a exploração
   validou como legível; a variação tonal por ponto (a "cintilância" de cor) só é
   perceptível a partir de ~32px pelos próprios achados de docs/logo-exploracao.md.
6. Fundo ink-950 (#0a0a0e) tem uma leve tinta azulada (R10 G10 B14) — medi o fundo real do
   rig.ai via getComputedStyle (oklch(0.1448 0 0), croma ZERO) e convertido pra sRGB dá
   #0a0a0a: a diferença de CLARIDADE é quase nula, a diferença real é só a neutralidade
   (zero tinta) vs. o leve azul do ink-950 atual. Não é pra clarear o fundo — é pra
   neutralizar a tinta.
7. O roxo da família zeph está com matiz errado. Medi de verdade via getComputedStyle no
   zephyrprotocol.com (site oficial da moeda): a paleta deles inteira (#282554, #827fae,
   #322f5e, #464372, #c4c1e7) tem matiz ≈244° (HSL) com o canal R praticamente IGUAL ao G,
   os dois bem abaixo do B — receita de um índigo/violeta-azulado "puro". Nosso zeph-300
   (#a996f5) e zeph-500 (#6f5fc4) estão em ≈250-252°, com o R visivelmente acima do G — é
   esse gap R-vs-G a mais que puxa a percepção pra rosa/lavanda-quente, principalmente no
   zeph-300 (mais claro e mais saturado, onde o olho nota mais). Achou o Carlos comparando
   com o site oficial e bate com a medição.
</diagnostico>

<decisoes_ja_tomadas>
Não redecida os itens abaixo — já foram fechados com o Carlos:

1. Duas cores semânticas novas, substituindo a regra "reservado só a vermelho": verde =
   positivo/saudável/normal; laranja = negativo/crítico/erro. O vermelho alert (#e8492f)
   SAI do sistema por completo — todo lugar que hoje usa vermelho (offline, erro de
   API/rede, reserve ratio abaixo do piso 4,0, banners de "tentando de novo") passa a usar
   laranja. Não é um degrau intermediário — é binário: positivo=verde, negativo=laranja,
   sem meio-termo novo.
2. Fundo: neutralizar o ink-950 (referência medida: algo próximo de #0a0a0a, ajuste fino
   com o mesmo rigor de contraste do R1) + adicionar textura sutil monocromática (ver
   restricoes sobre a exceção de gradiente).
3. Logo: só aumentar o tamanho (de 26px pra ~36–40px), continua ESTÁTICA — sem ?anim=1,
   sem cintilação em produção.
4. Textura de fundo via gradiente monocromático é uma EXCEÇÃO explícita e documentada à
   regra "proibido gradiente" do CLAUDE.md — só pra esse uso pontual (scanline/ruído sem
   cor), não abre precedente pra gradiente decorativo colorido em nenhum outro lugar.
5. Recalibrar o matiz de TODA a família zeph (300/500/700/800) pra ≈244°, a família
   medida no zephyrprotocol.com — não é trocar de cor, é corrigir o mesmo roxo pro tom
   certo. Preserve os degraus de CLARIDADE que já existem (300 continua o mais claro/alto
   contraste, 800 o mais escuro/decorativo) — só o matiz muda. Referência real medida (não
   adote os hex exatos, o site deles é mais escuro/dessaturado no geral porque não precisa
   de texto em cima; use como norte de matiz): #282554, #322f5e, #464372, #827fae, #c4c1e7.
   Encontrei também um ciano (#5bc0de) na paleta deles — NÃO faz parte da família zeph, é
   um accent à parte deles; ignore, não é a cor que estamos calibrando.

O que você decide (com evidência, mesmo padrão do projeto):
- Os hex exatos do verde e do laranja — comece de #22c55e (verde, é literalmente o que o
  rig.ai usa) e algo na família laranja/âmbar (#f97316 ou similar) como ponto de partida,
  mas MEÇA contraste WCAG 2.2 AA de verdade contra o fundo novo E contra qualquer
  superfície onde o texto colorido aparece (mesmo script/rigor usado pros tokens do R1 —
  ver tabela de contraste medido em NOTES.md).
- A técnica exata de textura (scanline via repeating-linear-gradient de baixíssima
  opacidade é o que o rig.ai faz de verdade — pode reproduzir ou propor equivalente,
  contanto que fique monocromático e sutil).
- A escala tipográfica exata (proponha algo como 7 degraus — ex.: caption/label/body/
  data-md/data-lg/headline/display — e aplique via token, não hardcoded).
</decisoes_ja_tomadas>

<tarefa>
1. Tokens primeiro: adicione verde e laranja ao @theme de src/index.css (nomes sugeridos:
   --color-good-* e --color-bad-*, ou similar — sua escolha de nomenclatura, mas
   documentada), a escala tipográfica completa, e o fundo neutralizado. RECALIBRE o matiz
   de zeph-300/500/700/800 pra ≈244° (ver diagnóstico item 7 e a referência medida em
   decisoes_ja_tomadas) — mantendo os mesmos degraus de claridade/contraste já validados,
   só corrigindo o tom. Remova o token alert (vermelho) de todo lugar que ele é usado como
   estado — se ele ficar órfão, remova do @theme também. Depois de mudar zeph-300/500/700,
   REMEÇA o contraste WCAG de tudo que usa esses tokens (a mudança de matiz pode mudar o
   número, mesmo mantendo a claridade aproximada) — mesmo script/rigor do R1. Nenhuma cor
   hardcoded solta, mesma regra de sempre.
2. Tela âncora: Raio-X da Recompensa, na mesma ordem de prioridade do diagnóstico:
   - Legenda e chart: aplique a escala tipográfica nova; resolva a diferenciação de série
     SEM depender só de matiz igual — considere padrão/textura de preenchimento (hachura,
     pontilhado) além da cor, já que "minerador/reserva/yield" continuam sendo dados
     neutros (não são positivo/negativo — não force verde/laranja onde não é semântica de
     status).
   - Banner de alerta (reserve ratio abaixo do piso 4,0): vermelho → laranja.
   - Painel de reserve ratio no rail: investigue e conserte o bug do retângulo vazio
     (documente causa raiz em NOTES.md); depois de consertado, dê a ele um tratamento tipo
     "readout" — moldura hairline sempre visível, mesmo antes do dado chegar, pra nunca
     mais parecer quebrado. Quando o valor estiver dentro da faixa saudável (4,0–8,0),
     badge/indicador em verde; abaixo do piso, laranja.
   - Movimento: entrada animada dos gráficos (draw-in) na primeira carga; pulso/flash sutil
     de "acabou de atualizar" quando o polling trouxer dado novo; respeita
     prefers-reduced-motion sem exceção (estado final estático imediato).
   - Teste, rode os e2e existentes (rewards-e2e.mjs normal/lowratio/brokenrewards) e
     confirme que tudo passa antes de seguir pro próximo módulo.
3. Propague pros outros 3 módulos + nav, um de cada vez, testando antes de seguir:
   - Monitor do Rig: estado "minerando normal" → verde; "abaixo do esperado" E "offline" →
     laranja (ambos negativos agora, sem vermelho — diferencie por texto/ícone se dois
     estados negativos precisarem ser distinguíveis visualmente, não por cor). Mesma
     neutralização de fundo + escala tipográfica.
   - Pulso da Rede: badge [ ✓ saudável ] do reserve ratio → verde quando saudável, laranja
     quando abaixo do piso. Escala tipográfica + fundo.
   - Bússola de Pools: escala tipográfica + fundo; avalie se os chips "maior
     hashrate"/"menor fee" merecem verde sutil (são destaque positivo, não alerta — use com
     moderação, não é a mesma semântica de status de saúde) ou se ficam como estão — sua
     leitura, documente a escolha.
   - Qualquer banner de erro/rede/API fora do ar em qualquer módulo: vermelho → laranja.
   - Header/AppShell.tsx: LogoMark de 26px pra ~36–40px (ajuste o gap se precisar); fundo do
     header segue a neutralização.
4. Logo: só o size do LogoMark muda — geometria e paleta de pontos (a rampa semBranco já
   documentada) continuam as mesmas, sem tocar em scripts/logo-export.mjs/LogoMark.tsx além
   do tamanho renderizado.
5. Verificação visual: rode scripts/design-shots.mjs nos 3 breakpoints de novo, revise
   contra a mesma rubrica de 6 perguntas do R1 (está em NOTES.md, seção "Auto-check").
6. Atualize CLAUDE.md (nova seção ou revisão da "Direção visual — Sinal Técnico": tokens
   novos com contraste medido, a regra revisada de cor — 3 famílias em vez de "roxo +
   vermelho reservado", nota que vermelho saiu do sistema) e NOTES.md (achados do rig.ai
   que motivaram isso, causa raiz do bug do painel vazio, decisões de contraste, qualquer
   ajuste de hex).
</tarefa>

<restricoes>
- Isto é v2 do R1, não um redesign do zero: preserva composição dominante/rail, convenção
  mono [ LABEL ], hairline dividers, honestidade "observação não fórmula" entre os dois
  gráficos do Raio-X, zero card-farm.
- Proibido ainda: glassmorphism, blur, glow, sombra decorativa. A ÚNICA exceção nova e
  explícita é gradiente monocromático (sem cor) só pra textura de fundo — não usar
  gradiente em mais nada.
- Vermelho alert sai do sistema por completo — se sobrar em algum lugar não mapeado no
  diagnóstico acima, você decide se vira laranja (se for negativo) ou verde (se for
  positivo), mas não deixe vermelho residual.
- Contraste WCAG 2.2 AA obrigatório pro verde e o laranja novos, medido de verdade (mesmo
  script/rigor do R1), contra QUALQUER fundo onde aparecerem (o ink neutralizado E qualquer
  superfície elevada tipo tooltip/thead).
- Toda animação nova respeita prefers-reduced-motion sem exceção.
- Um módulo de cada vez dentro da mesma sessão — termina e testa o Raio-X antes de tocar no
  Rig, etc. (mesma disciplina do R1).
- npm run build limpo, sem warning novo.
</restricoes>

<criterios_de_aceite>
- Tokens verde/laranja/fundo neutralizado/escala tipográfica centralizados, zero cor ou
  tamanho de fonte hardcoded novo.
- Vermelho alert removido de todo estado do sistema (positivo=verde, negativo=laranja, sem
  exceção não documentada).
- Painel de reserve ratio do Raio-X nunca mais renderiza vazio — causa raiz documentada em
  NOTES.md.
- Legenda/swatches do gráfico empilhado legíveis à distância de leitura normal (não só em
  zoom).
- Gráficos do Raio-X têm entrada animada + pulso de atualização, ambos desligáveis por
  prefers-reduced-motion.
- Logo no header visivelmente maior (~36–40px) e a variação de tom por ponto perceptível a
  olho nu num monitor comum.
- Contraste WCAG AA medido (não estimado) pro verde, laranja E pro zeph recalibrado,
  registrado em NOTES.md com os números.
- Rampa zeph com matiz ≈244° (família do zephyrprotocol.com), mesmos degraus de claridade
  de antes — comparação lado a lado (screenshot) do roxo antigo vs. novo registrada em
  NOTES.md.
- npm run build limpo; e2e existentes (rewards/rig/pools) passam sem alteração de script.
- Screenshots dos 3 breakpoints revisados contra a rubrica de 6 perguntas do R1, nenhuma
  tela falhando em 2+.
- CLAUDE.md e NOTES.md atualizados com os tokens finais e a regra de cor revisada.
</criterios_de_aceite>

Antes de finalizar, repita a rubrica de 6 perguntas do R1 pra cada uma das 4 telas — e
adicione uma sétima, específica desta rodada: "um estado positivo e um negativo na mesma
tela são diferenciáveis por alguém com daltonismo (não só pela cor)?". Se alguma tela
falhar em 2+ perguntas, ajuste antes de dar como pronto.
```

---

## Prompt N1 — Fable: rail de navegação vertical (cabeçalho)

Roda depois do R2 (usa os tokens e a convenção mono já em produção, não muda nenhum).
Direção pedida pelo Carlos em 2026-07-10 e verificada por este chat (Claude in Chrome,
`localhost:5173/rede` ao vivo, zoom real no cabeçalho + leitura de AppShell.tsx/
LogoMark.tsx) antes de virar prompt — não é pra redecidir, só executar.

```
Aja como um engenheiro front-end sênior com direção de composição forte, fechando uma
decisão de layout já validada com evidência real (screenshot + medição) — seu trabalho é
executar a mudança estrutural do shell de navegação com o mesmo rigor de composição/
contraste/responsividade das sessões R1/R2, não redecidir a direção.

<contexto>
O cabeçalho hoje (src/components/layout/AppShell.tsx) é uma barra horizontal única:
LogoMark (38px) + wordmark "Zephyr Mining Hub" à esquerda, os 4 links de navegação
inline à direita, tudo na mesma linha, dentro de um `flex flex-col` (header em cima,
main, footer embaixo). É o padrão mais comum de dashboard que existe — e hoje é a única
peça do produto sem identidade "Sinal Técnico" própria (cada módulo já tem composição
dominante/rail; a casca continua sendo barra-topo genérica).

A marca (src/components/ui/LogoMark.tsx) é uma grade 22×22 com tom por ponto (5 níveis
da rampa "semBranco" — ver comentário no arquivo). O efeito real do halftone é essa
variação de tom ponto a ponto, não só a silhueta do Z. Em 38px (tamanho atual, decidido
no R2), cada ponto renderiza a ~1,1px real (38÷22×0,66 = lado do ponto em px) — no piso
do que um monitor comum resolve. Confirmado ao vivo por este chat com zoom real no
cabeçalho em localhost:5173/rede: o Z lê bem, mas a variação de tom só fica clara
ampliada — em tamanho normal de leitura ela se perde.

Puxar o cabeçalho pra um rail vertical fixo à esquerda libera ALTURA pro logo crescer
sem competir por espaço com o nav inline (hoje os dois dividem a mesma linha estreita) —
e dá à casca de navegação o mesmo tratamento de composição autoral que cada módulo já
tem, em vez de deixá-la como o único elemento genérico do produto.
</contexto>

<diagnostico>
1. Cabeçalho atual: barra horizontal única, logo+wordmark e nav dividindo a mesma linha
   (`header` > `div` com `flex flex-wrap items-center gap-x-8`).
2. Tom por ponto do LogoMark existe de verdade (288 pontos, 5 tons) mas é imperceptível
   em uso normal no tamanho atual — só a silhueta do Z sobrevive; a "cintilância"
   (o ponto forte da marca) está sendo desperdiçada.
3. Rail vertical resolve os dois problemas ao mesmo tempo: dá altura pro logo crescer, e
   transforma a casca (hoje genérica) num elemento de composição real.
</diagnostico>

<decisoes_ja_tomadas>
1. Cabeçalho vira rail vertical fixo à esquerda (desktop/tablet): logo no topo, bem
   maior que os 38px atuais; os 4 NAV_ITEMS empilhados abaixo, mesma convenção mono
   `[ Rótulo ]` de hoje (colchetes transparentes no inativo, sem layout shift), só que
   na vertical.
2. `<main>` passa a ocupar o espaço à direita do rail, não mais uma coluna centralizada
   na viewport inteira.
3. Só tokens já existentes — ink-950, hairline, zeph-300, mist. Divisor hairline
   VERTICAL à direita do rail, no lugar do `border-b` horizontal de hoje. Nenhum token
   novo.
4. Mobile/telas estreitas NÃO herdam o rail vertical como está — é critério de aceite,
   não opcional: teste de verdade (ex. 390px, mesmo padrão de scripts/design-shots.mjs)
   e implemente uma recomposição deliberada (pode voltar à barra horizontal de hoje
   abaixo de algum breakpoint, virar rail compacto só-ícone, ou outra solução) — nunca
   só espremer o rail até quebrar ou sobrepor conteúdo.

O que você decide (com evidência, mesmo padrão do projeto):
- Tamanho final do logo no rail: comece testando entre ~64–96px e escolha o valor em
  que a variação de tom por ponto lê como textura de propósito (não ruído) — verifique
  com uma captura AMPLIADA (mesma técnica "lupa" de scripts/logo-shots.mjs/
  docs/logo-exploracao.md), não só de olho no tamanho normal.
- Largura do rail: precisa caber "Raio-X da Recompensa" (rótulo mais longo) em mono —
  pode quebrar em 2 linhas se precisar, não force uma linha só estreitando a fonte.
- Se o wordmark "Zephyr Mining Hub" continua ao lado do logo, abaixo dele, ou encolhe —
  mas o nome acessível do produto não pode simplesmente desaparecer (hoje é esse texto
  que carrega o nome acessível, já que LogoMark é aria-hidden; se o texto sumir
  visualmente, substitua por um nome acessível equivalente, nunca remova sem repor).
- Se o rail é `sticky`/fixo durante o scroll ou rola junto com o conteúdo.
- Onde o footer (hoje `border-t` full-width no rodapé) vive na nova estrutura —
  sugestão: manter full-width abaixo de rail+conteúdo (menor risco), mas decida e
  documente se achar melhor incorporar ao rail.
</decisoes_ja_tomadas>

<tarefa>
1. Reestruture o layout raiz de AppShell.tsx: de `flex flex-col` (header/main/footer
   empilhados) pra um container com o rail fixo à esquerda + uma coluna à direita com
   main (e footer, a menos que decida diferente no passo 6).
2. Rail: LogoMark no topo no tamanho final escolhido, os 4 NAV_ITEMS empilhados abaixo
   mantendo a convenção `[ Rótulo ]` — só aplicando na vertical. Divisor hairline à
   direita do rail.
3. Ajuste `<main>`: hoje `mx-auto w-full max-w-6xl` centralizado na viewport inteira —
   decida se o cap de largura permanece dentro do espaço que sobra à direita do rail, ou
   muda; documente a escolha.
4. Recomposição mobile: teste de verdade em pelo menos um breakpoint estreito real e
   implemente a recomposição decidida no passo 4 de `decisoes_ja_tomadas`.
5. Verifique a legibilidade do tom por ponto no tamanho final escolhido com uma captura
   ampliada (mesma técnica de scripts/logo-shots.mjs) — referencie o arquivo gerado em
   NOTES.md.
6. Rode a suíte e2e existente (`rewards-e2e.mjs normal`, `rig-e2e.mjs normal`,
   `pools-e2e.mjs normal`) e `scripts/design-shots.mjs` nos 3 breakpoints — confirme que
   nada quebrou (os seletores desses scripts não miram o header, mas confirme mesmo
   assim).
7. Atualize CLAUDE.md (seção "Direção visual") e NOTES.md com a decisão: rail vertical,
   tamanho final do logo e por quê, recomposição mobile escolhida.
</tarefa>

<restricoes>
- Só os tokens já existentes (`@theme` em src/index.css) — nenhuma cor, tamanho de
  fonte ou espaçamento novo hardcoded.
- Nome acessível do produto não pode desaparecer (ver decisoes_ja_tomadas).
- Convenção mono `[ Rótulo ]` do nav continua — só muda de eixo horizontal pra vertical.
- Nada de gradiente/blur/glow/glassmorphism novo (a única exceção documentada continua
  sendo a textura scanline do body).
- Contraste WCAG 2.2 AA de qualquer texto/estado no rail, medido de verdade (mesmo
  rigor de sempre).
- npm run build limpo, sem warning novo.
- Não mexa na lógica/dado dos 4 módulos — isso é só a casca de navegação.
</restricoes>

<criterios_de_aceite>
- Rail vertical à esquerda no desktop: logo nitidamente maior que os 38px atuais, com a
  variação de tom por ponto perceptível a OLHO NU (sem precisar de zoom) num monitor
  comum — confirmado por captura ampliada real, não só afirmado.
- Nav com os 4 itens na vertical, convenção `[ Rótulo ]` preservada, indicador de rota
  ativa funcionando exatamente como hoje.
- Recomposição mobile testada de verdade num breakpoint estreito real (screenshot), não
  é só o rail encolhido/cortado.
- Nome acessível do produto preservado (confirme na árvore de acessibilidade, não só
  visualmente).
- npm run build limpo; suíte e2e existente (rewards/rig/pools, modo normal) passa sem
  alteração de script.
- CLAUDE.md e NOTES.md atualizados com a decisão e os números finais.
</criterios_de_aceite>

Antes de finalizar, olhe o rail em tamanho normal (sem zoom, distância de leitura normal
de monitor) — a variação de tom por ponto do Z realmente aparece agora, ou ainda precisa
de zoom pra ver? Se ainda precisar de zoom, aumente mais o logo antes de dar como pronto.
```

---

## Prompt N2 — Fable: cintilância da logo + recomposição mobile do rail

Roda depois do N1 (rail vertical) — **commite o N1 antes de começar esta sessão**, os
dois mexem em AppShell.tsx/LogoMark.tsx. Pedido do Carlos em 2026-07-10 depois de ver o
N1 rodando de verdade (screenshot real do rail no desktop e do fallback no mobile) —
verificado por este chat (leitura de AppShell.tsx/LogoMark.tsx/logo-preview.html pós-N1 +
screenshots reais do Carlos) antes de virar prompt.

```
Aja como um engenheiro front-end sênior de direção visual, adicionando uma camada de
movimento já projetada e validada anteriormente e resolvendo uma recomposição mobile que
ficou abaixo do padrão do resto do sistema — seu trabalho é extrair e portar (não
redesenhar) a animação já validada na página de exploração, e aplicar no mobile o mesmo
rigor de composição que o rail (N1) já tem no desktop, não redecidir a direção visual.

<contexto>
O Prompt N1 rodou e funcionou: rail vertical fixo à esquerda em telas xl+, LogoMark a
128px, tom por ponto legível a olho nu (leia AppShell.tsx e a seção "Casca de navegação"
do CLAUDE.md antes de começar). Duas lacunas apareceram depois de ver o produto rodando
de verdade (screenshots reais do Carlos):

1. **Mobile ficou pra trás.** Abaixo de xl, o cabeçalho é literalmente o header antigo
   do R2, sem nenhuma adaptação (o próprio comentário em AppShell.tsx diz "exatamente a
   casca do R2, logo em 38px + nav inline") — na prática: logo pequeno (38px, no piso de
   legibilidade do tom, mesmo problema que o N1 resolveu no desktop) e os 4 itens de nav
   quebrando via `flex-wrap` em duas linhas desalinhadas ("[ Pulso da Rede ] Bússola de
   Pools" / "Raio-X da Recompensa Monitor do Rig"). Funcionava como fallback aceitável
   antes do N1 existir; ao lado do rail novo, parece um resto de layout antigo.
2. **A cintilância nunca foi portada.** scripts/logo-preview.html tem o efeito "F3 ·
   CINTILÂNCIA" funcionando de verdade (`?anim=1`) desde a exploração original (Prompt
   L1) — ~30% dos 288 pontos oscilam de opacidade em 3 grupos defasados. LogoMark.tsx
   hoje é 100% estática por decisão explícita da época (comentário no arquivo: "a marca
   em produção é 100% estática"), com a ressalva já registrada em NOTES.md: "se um dia
   isso for pro app, usar com parcimônia e respeitar prefers-reduced-motion". Esse dia é
   agora, a pedido do Carlos.
</contexto>

<diagnostico>
1. Mobile: cabeçalho <xl não herdou NADA da composição do rail — é uma cópia intacta do
   header pré-N1. É o único lugar do produto hoje em que a casca de navegação tem menos
   cuidado de composição que o resto do sistema.
2. Cintilância: existe, está validada (parâmetros tunados: ~30% dos pontos, 3 fases,
   2,6s, opacidade nunca zera) e nunca chegou em produção — puramente uma lacuna de
   portar, não uma decisão nova de design.
</diagnostico>

<decisoes_ja_tomadas>
1. Ordem dentro da sessão: primeiro conserta a composição mobile, DEPOIS adiciona a
   cintilância (ela se aplica ao tamanho final que a composição mobile decidir) — teste
   e confirme cada parte antes de seguir pra próxima, mesma disciplina do R1/R2.
2. Mobile herda a MESMA linguagem do rail — não é layout novo do zero. Reaproveite a
   composição interna do `<aside>` de hoje (logo → wordmark → nav, nessa ordem) — só
   troca o contêiner de "coluna fixa à esquerda, altura cheia" pra "bloco no topo,
   largura cheia".
3. Cintilância: extraia os parâmetros EXATOS de scripts/logo-preview.html —
   `assignTwinkle(dots, seed=23)` (~30% dos pontos, 3 grupos de fase via
   `Math.floor(r/0.10)`), `@keyframes twinkle { 0%,100% opacity:1; 50% opacity:.35 }`,
   2,6s ease-in-out, atrasos 0s/0,9s/1,7s por grupo. Não reinvente valores novos.
4. `prefers-reduced-motion` sem exceção — mesma regra já aplicada a chart-draw/
   data-pulse, vale igual aqui.

O que você decide (com evidência, mesmo padrão do projeto):
- Tamanho do logo mobile: teste candidatos e confirme com captura ampliada (mesma
  técnica do N1/L1) que o tom por ponto lê a olho nu. MAS meça também o custo: o rail
  desktop empilha logo(128px) + wordmark + nav sem custo porque tem a viewport inteira
  de altura disponível; no mobile isso compete com o conteúdo da página logo abaixo.
  Meça a altura total do bloco de navegação num viewport de ~700px de altura real. Se o
  cabeçalho sozinho passar de ~25–30% da altura da tela, isso é sinal de que empilhar
  logo+wordmark+nav na vertical (cópia 1:1 do rail) não é a resposta certa — considere
  manter logo+wordmark grandes mas os 4 itens de nav numa linha horizontal ou grade 2×2
  (agrupamento deliberado, não flex-wrap acidental) em vez de empilhados. Decida com a
  medição real, não "parece bom", e documente o raciocínio.
- Se o logo mobile escolhido for pequeno demais pro tom por ponto ler (mesmo limite do
  38px original), pode não valer animar ali — decida com a mesma evidência de
  tom-visível usada no N1, documente se a cintilância fica só no rail.
</decisoes_ja_tomadas>

<tarefa>
1. Recomposição mobile (<xl): substitua o `<header>` atual (cópia do R2 antigo) por um
   bloco de topo, largura cheia, reaproveitando a composição do rail na mesma ordem
   visual (logo → wordmark → nav), mas em orientação topo em vez de lateral — ver
   decisoes_ja_tomadas pra o que decidir com evidência. Teste em pelo menos 390 e 768px
   (mesmo padrão de scripts/design-shots.mjs) com screenshot real antes do próximo passo.
2. Cintilância:
   a. Estenda o processo de export (scripts/logo-export.mjs ou equivalente) pra também
      capturar a fase de cada ponto via `assignTwinkle(dots, seed=23)` do
      logo-preview.html — vira um 4º valor na tupla de LogoMark.tsx (hoje `[x, y, tone]`,
      passa a `[x, y, tone, tw]`; tw 0 = sem animação, 1–3 = grupo de fase).
   b. Adicione as keyframes de twinkle ao `@theme` de src/index.css, mesmo padrão de
      `--animate-chart-draw`/`--animate-data-pulse` já existentes, reaproveitando os
      valores exatos do preview (ver decisoes_ja_tomadas item 3).
   c. Em LogoMark.tsx, aplique a classe de animação correspondente por ponto (baseada no
      `tw` exportado), sempre pareada com `motion-reduce:animate-none`.
   d. Teste ao vivo (não suponha) que a animação roda no rail E no bloco mobile novo (se
      aplicável), e que desliga de verdade com `prefers-reduced-motion` emulado.
3. Rode a suíte e2e existente (`rewards-e2e.mjs normal`, `rig-e2e.mjs normal`,
   `pools-e2e.mjs normal`) e `scripts/design-shots.mjs` nos 3 breakpoints — confirme que
   nada quebrou.
4. Atualize CLAUDE.md e NOTES.md: composição mobile nova (tamanho do logo, altura medida
   do bloco, decisão vertical-vs-horizontal do nav e por quê) e a cintilância (parâmetros
   portados, onde se aplica, confirmação de prefers-reduced-motion).
</tarefa>

<restricoes>
- Só tokens já existentes; qualquer keyframe novo entra centralizado no `@theme`, nunca
  solto em componente.
- Nome acessível do produto continua preservado (mesma regra do N1).
- Convenção mono `[ Rótulo ]` do nav continua, em qualquer orientação.
- `prefers-reduced-motion` sem exceção — teste de verdade (emulado via devtools/CDP), não
  suponha que funciona.
- Não toque na lógica/dado dos 4 módulos — isso é só a casca de navegação.
- npm run build limpo, sem warning novo.
</restricoes>

<criterios_de_aceite>
- Mobile (390 e 768px): logo claramente maior que os 38px de antes, tom por ponto
  perceptível a olho nu (captura ampliada real), nav sem quebra desalinhada — agrupamento
  deliberado, não acidente de flex-wrap.
- Bloco de navegação mobile não domina a tela: altura medida documentada em NOTES.md.
- Cintilância rodando ao vivo no rail (e no mobile, se o tamanho permitir tom visível),
  com os parâmetros extraídos do preview, não reinventados.
- `prefers-reduced-motion` confirmado desligando a animação de verdade, não só código
  presente.
- npm run build limpo; e2e existente passa sem alteração de script; design-shots.mjs
  revisitado nos 3 breakpoints.
- CLAUDE.md e NOTES.md atualizados.
</criterios_de_aceite>

Antes de finalizar, dois checks: (1) olhe o bloco mobile como se fosse a primeira vez
abrindo o site num celular — o Z chama atenção e o menu parece intencional, não um resto
de layout antigo? (2) ligue prefers-reduced-motion no navegador e confirme que a
cintilância realmente para. Se qualquer um dos dois falhar, ajuste antes de dar como
pronto.
```

---

## Prompt 5 — Fable: integração e revisão final (REESCRITO 2026-07-12)

Versão original (histórico, não colar) escrita antes do R1–R7/N1–N3/T1/G1/EN1 — na
época pedia REVIEW.md do zero, loading/erro compartilhado, nav com rota ativa, tema
único e página inicial. Desde então: loading/erro compartilhado existe desde o Prompt 1
(`ErrorNotice`/`Skeleton`), nav com rota ativa existe desde R1/N1 (rail + `[ Rótulo ]`),
e "tema único" virou DOIS temas (T1) — os três itens saíram desta versão. Página
inicial: Carlos decidiu manter o redirect `/` → `/rede` como está (não crie página
nova — ver `<restricoes>`).

Esta reescrita absorve duas fontes que não existiam na versão original:
`docs/AUDITORIA-ESTRUTURA-2026-07-12.md` (skill `backend-structure-auditor`, rodada no
chat Cowork sobre o working tree pós-EN1: 4 achados, todos [Baixo]/[Médio], zero bug de
comportamento) e uma rodada de `code-audit-cleanup` (mesmo dia, mesmo chat) que aplicou
só a consolidação mais mecânica (`ATOMS_PER_ZEPH` — `src/lib/api/minerStats.ts` agora
importa de `emission.ts` em vez de redefinir) e deixou o resto pra esta sessão de
propósito: ou exigia escolher um lar novo pra uma constante compartilhada entre módulos
(decisão pequena de arquitetura), ou envolvia hooks de interação (hover/teclado) que só
dá pra verificar com confiança rodando a suíte e2e real — Windows, CDP — que aquele
ambiente não tinha. Leia CLAUDE.md, NOTES.md e a auditoria de estrutura inteira antes de
começar; não crie um REVIEW.md novo — a auditoria já é o REVIEW.md desta rodada.

```
Aja como um engenheiro front-end sênior fazendo a integração final de um produto cujos
4 módulos foram construídos em sessões separadas sem memória compartilhada entre elas —
seu trabalho é consolidar duplicação real já mapeada, fechar uma lacuna de robustez
conhecida, e deixar o repo apresentável pra quem chegar de fora. Não é redescoberta: os
itens abaixo já têm diagnóstico (arquivo, linha, causa) de uma auditoria de estrutura
real — sua tarefa é decidir a correção e aplicar, testando cada item antes de seguir
pro próximo (mesma disciplina do R1/R3/R4).

<contexto>
O Zephyr Mining Hub tem os 4 módulos prontos (Network Pulse, Pool Compass, Reward X-Ray,
Rig Monitor), produto em inglês (hardcoded, EN1), design system "Sinal Técnico" com
tema escuro/claro (T1). `docs/AUDITORIA-ESTRUTURA-2026-07-12.md` fez um censo completo
dos 38 arquivos de `src/` e achou 4 padrões de duplicação — nenhum bug, mas o tipo de
coisa que uma "integração final" existe pra resolver antes que fique mais caro. Leia o
arquivo inteiro antes de começar: os trechos abaixo resumem, mas os números de linha e
o raciocínio completo estão lá.
</contexto>

<tarefa>
1. README.md — reescreva refletindo o estado real (hoje ainda diz "🚧 placeholder" pra
   Pool Compass/Reward X-Ray/Rig Monitor, todos prontos há muito). Cubra: os 4 módulos
   como produto único, o design system (tema escuro/claro), que o produto é em inglês
   e o repo (CLAUDE.md/NOTES.md/docs/comentários) é em português, os scripts de
   verificação (`design-shots.mjs`, os *-e2e.mjs, `contrast-check.mjs`) e a pasta docs/.
   Não precisa ser extenso — é a porta de entrada do repo, não um manual.

2. ErrorBoundary por módulo — hoje não existe NENHUM no projeto (confirmado por grep):
   um throw durante o render de qualquer componente derruba a árvore React inteira e
   vira tela em branco, exatamente o que a convenção "erro sempre visível, nunca tela
   em branco" do CLAUDE.md proíbe pra falha de REDE (a camada de rede é defensiva; erro
   de RENDER não tem rede de proteção nenhuma hoje). Adicione um ErrorBoundary por rota
   (as 4 dentro de `AppShell`/`App.tsx` — decida o ponto de captura mais próximo do
   `<Outlet />` sem duplicar por módulo) com fallback na MESMA linguagem visual de erro
   do resto do produto (`[ FAILED ]`, mesma família do `ErrorNotice` variant="blocking"
   — reaproveite o componente ou o estilo dele, não invente um terceiro).

3. Varredura `order=desc` sem `from`/`to` — o Prompt 3 achou e corrigiu um caso
   não-determinístico exatamente nisso (`getLatestBlockReward`, ver CLAUDE.md). Confirme
   por grep em `src/` que a ÚNICA ocorrência restante é o fallback documentado em
   `getRecentBlockRewards` (zephyrScanner.ts, quando a janela ancorada por altura vem
   vazia) — esse é intencional e já comentado, não corrija. Se achar QUALQUER outra
   ocorrência não ancorada por altura, corrija com a mesma âncora compartilhada
   (`getAnchorHeight`).

4. Constantes de domínio duplicadas restantes (achado 1 da auditoria — a parte do
   `ATOMS_PER_ZEPH` já foi resolvida, não mexa nela de novo):
   a. `MIN_READING_GAP_MS = 55_000` está definida separadamente em
      `src/modules/pools/luckHistory.ts:20` e `src/modules/rig/rigStatus.ts:73`, mesmo
      valor e mesma justificativa ("polling é 60s, gap evita duplicata"). Pools e rig
      são módulos-irmãos (a regra do projeto — CLAUDE.md — é que não se importam entre
      si), então a correção não é um importar do outro: escolha um lar em `src/lib/`
      (ex. um pequeno módulo de constantes de histórico local, ou exportada de onde já
      fizer sentido semântico) e importe dos dois.
   b. O intervalo de poll das pools (`60_000`) está hardcoded em
      `src/modules/pools/PoolsPage.tsx:30` (`POLL_INTERVAL_MS`) e
      `src/modules/rig/RigDashboard.tsx:50` (`POOL_POLL_MS`) — o comentário do
      RigDashboard já admite que é "o mesmo passo da Bússola de Pools" sem importar de
      um lugar comum. Mesma correção: constante compartilhada em `lib/`, não um módulo
      importando do outro. (NÃO mexa no `SERIES_POLL_MS` do RewardsPage.tsx — a
      auditoria confirmou que é o mesmo número por coincidência, não a mesma violação:
      justificativa diferente, cadência de bloco.)

5. Bloco de agregação de erro duplicado (achado 2) — `NetworkPulsePage.tsx:184-192` e
   `RewardsPage.tsx:217-224` têm o mesmo par `failingSources`/`noDataAtAll` e o mesmo
   JSX condicional de `ErrorNotice` logo depois, quase byte a byte. ATENÇÃO: não são
   100% idênticos — NetworkPulsePage inclui `dailyStats.error` no `failingSources` mas
   NÃO conta `dailyStats.data` no `noDataAtAll` (é uma fonte secundária, só do "delta vs.
   ontem"); RewardsPage conta as 3 fontes nos dois. `RigDashboard.tsx:338-342` tem uma
   3ª variante (`earningsFailingSources`) renderizada diferente (texto inline, não
   `ErrorNotice`) — não precisa virar idêntica às outras, mas pode usar o mesmo hook se
   couber sem forçar. Extraia um hook `useFailingSources` (ou nome equivalente) pra
   `src/hooks/` que aceite algo como uma lista de `{ error, label, countsForNoData }` e
   devolva `{ failingSources, noDataAtAll }`, preservando essa assimetria real — não a
   apague por engano ao generalizar.

6. Dois gráficos reimplementando a mesma interação (achado 4, o de maior volume —
   ~40-50% de cada componente): `ReserveRatioChart.tsx` e `RewardSplitChart.tsx`
   compartilham `HoverState`, `setHoverFromPointer` (idêntico), `onKeyDown`
   (Arrow←/→/Home/End/Escape, quase idêntico) e o cálculo de `tooltipLeft`
   (`Math.min(Math.max(x, N), Math.max(width - N, N))` — SÓ a margem `N` difere: 72 no
   Reserve Ratio, 96 no Reward Split). Extraia um hook (`useChartHover` ou equivalente)
   que os dois componentes usem, parametrizado pela margem do tooltip. Depois de
   extrair, rode a suíte e2e completa (ela testa hover/teclado nos dois gráficos) antes
   de considerar este item pronto — é o item com mais risco de regressão sutil desta
   sessão.

7. Achado 3 (motores de histórico paralelos: `luckHistory.ts`,
   `networkHashrateHistory.ts` e o motor genérico que `rigStatus.ts` já usa
   internamente pras 2 séries do próprio módulo) — a auditoria classifica como menor
   prioridade (zero risco ativo, só dívida de manutenção). Fica a seu critério: se
   couber com folga depois dos itens 1-6, generalize o motor de `rigStatus.ts` pra um
   utilitário em `lib/` usado pelos 3; se o tempo/risco não fechar, registre em
   NOTES.md como backlog explícito e siga em frente — não é bloqueante pra esta sessão.

8. Rode `npm run lint` e resolva os 2 warnings PRÉ-existentes (presentes desde o N2,
   nunca corrigidos): `scripts/logo-shots.mjs` (ternário como expressão, vira if/else,
   mesmo fix que já foi aplicado em `rail-logo-shots.mjs`) e
   `src/modules/rewards/SeriesSwatch.tsx` (leia o warning exato do lint pra decidir o
   fix — não estava óbvio numa leitura estática).
</tarefa>

<restricoes>
- NÃO crie página inicial nova — Carlos decidiu manter `/` → `/rede` (redirect atual em
  `App.tsx`) como está. Não reabra essa decisão.
- NÃO crie um REVIEW.md — `docs/AUDITORIA-ESTRUTURA-2026-07-12.md` já cumpre esse papel
  pra esta rodada. Registre o que foi corrigido/decidido em NOTES.md, convenção usual do
  projeto (uma seção "# NOTES — Prompt 5: ..." como as demais).
- Não reescreva lógica de negócio (fetches, cálculos, fórmulas) — os 6 itens acima são
  consolidação de duplicação e robustez de apresentação, não mudança de comportamento.
  Se encontrar um bug real no caminho, documente em NOTES.md antes de decidir corrigir
  ali ou deixar pra outra sessão.
- Preserve os critérios de aceite de cada módulo já existente — nada de "simplificar"
  removendo funcionalidade.
- Produto já em inglês (EN1): qualquer texto novo visível ao visitante (fallback do
  ErrorBoundary, README não conta — README é doc de trabalho, fica em português) segue
  em inglês, mesma convenção mono `[ RÓTULO ]` onde já existir.
- Não toque no `SERIES_POLL_MS` do RewardsPage.tsx (ver item 4b) nem no fallback
  `order=desc` documentado de `getRecentBlockRewards` (ver item 3).
</restricoes>

<criterios_de_aceite>
- `npm run build` limpo.
- `npm run lint` SEM NENHUM warning (os 2 pré-existentes resolvidos, zero novo).
- Grep por acentuação fora de comentário em `src/` continua em zero (não regredir EN1).
- Suíte e2e completa (pools normal/broken2miners, rewards normal/lowratio/
  brokenrewards, rig normal/notfound, theme) — TUDO PASSA, especialmente após o item 6.
- README.md reflete o produto real (4 módulos prontos, não placeholder).
- Existe ErrorBoundary cobrindo as 4 rotas, com fallback na linguagem visual do projeto;
  confirme com um erro de render forçado temporariamente (ex. `throw` num componente)
  que a tela mostra o fallback em vez de branco, depois remova o throw de teste.
- `MIN_READING_GAP_MS` e o poll de 60s das pools/rig vêm de uma constante importada
  única cada um — zero redefinição do mesmo valor em módulos diferentes.
- `useFailingSources` e o hook de chart hover existem e são usados pelos sites
  originais (Network/Rewards para o primeiro; Reserve Ratio/Reward Split para o
  segundo).
- CLAUDE.md/NOTES.md atualizados com o que foi feito, o que foi decidido no item 7, e
  qualquer bug real encontrado no caminho.
</criterios_de_aceite>
```

---

## Prompt R3 — Fable: Sinal Técnico v3 (fundo vivo, densidade de dado, acabamento por tela)

Roda depois do N2 — **commite o N2 antes de começar esta sessão** (regras 5/6 do
HANDOFF: feche a sessão que rodou N2, abra uma PowerShell limpa fora de qualquer
`claude` ativo, `git add -A && git commit && git push`, só então abra a sessão nova
pra este prompt). R3 não mexe em AppShell.tsx/LogoMark.tsx, mas herda os tokens que
o N2 deixou no working tree. Direção decidida em 2026-07-10 fora do Claude Code
(Claude Sonnet 5, skill `creative-ui-director`) a partir de 8 pontos concretos que o
Carlos trouxe usando o produto real, tela por tela — não é redescoberta: os pontos
abaixo já têm diagnóstico e direção escolhida, incluindo onde essa direção diverge
do que o Carlos pediu literalmente (ver `diagnostico`). Invoque a mesma skill nesta
sessão (está disponível no seu ambiente) pra guiar acabamento e autoverificação de
cada mudança, mas dentro do que já foi decidido — não redecida a direção estrutural.

```
Aja como um engenheiro front-end sênior de direção visual, dando continuidade a um
sistema já validado (v3 do redesign "Sinal Técnico") — invoque a skill
creative-ui-director no início desta sessão e use-a pra guiar o acabamento e a
autoverificação (anti-genérico, contraste, responsivo) de cada mudança abaixo. As
direções estruturais já foram decididas fora desta sessão, com o mesmo rigor de
evidência real do R1/R2/N1/N2 (screenshot, contraste medido, e2e) — seu trabalho é
executar e refinar acabamento, não redecidir a direção.

<contexto>
Os módulos do Zephyr Mining Hub estão em produção com o sistema "Sinal Técnico" v2
(tokens em src/index.css, composição dominante/rail por tela) — leia CLAUDE.md,
NOTES.md e o código de src/ antes de começar. O Carlos usou o produto de verdade
(não screenshot velho) e trouxe 8 pontos concretos, um por área, cobrindo o fundo
global e as 4 telas. Isto é uma evolução (v3), não um redesign do zero: preserva
tudo que R1/R2 estabeleceram (tokens ink/zeph/mist/good/bad, convenção mono
[ LABEL ], composição dominante/rail, hairline, zero gradiente exceto a textura de
fundo já documentada) — cada ponto abaixo é um ajuste localizado, não uma
reformulação de tela.
</contexto>

<diagnostico>
0. Fundo: ink-950 #0a0a0a (croma zero, medido contra rig.ai) + textura scanline
   (listras 1px, 2% branco). Decisão consciente e já validada — mas o Carlos, usando
   o produto de verdade, acha o preto atual pesado demais e a textura estática
   pouco viva. Dois pedidos distintos: (a) clarear pro cinza — mudança estrutural
   real, mexe na luminosidade-base de que TODO o contraste do sistema depende; (b)
   textura de blocos quadrados com movimento sutil — evolução direta da scanline já
   existente (que já é a ÚNICA exceção documentada à regra anti-gradiente), não é
   pedido novo de princípio.
1. Pulso da Rede: hashrate em --text-headline (clamp 3.5rem–8rem) — o Carlos acha
   grande demais (MESMO token do hashrate do Monitor do Rig, ponto 4 — resolvem
   junto). Halving é hoje só um `border-t` acima de dígitos soltos — nenhuma
   moldura, único elemento secundário do produto sem tratamento de "readout"
   (RESERVE RATIO já ganhou isso no R2). Espaço vazio abaixo do hashrate na coluna
   dominante: sintoma real, mas ATENÇÃO — não existe série histórica de
   hashrate/dificuldade em nenhuma API confirmada no projeto (Explorer API é só
   snapshot, ver CLAUDE.md). Resolver com dado inventado violaria a convenção do
   projeto ("nunca mockar valor").
2. Bússola de Pools: chips [ maior hashrate ]/[ menor fee ] em zeph-300 — mesmo tom
   de quase tudo mais na tela (links, nav ativo). O Carlos quer mais vivo. TENSÃO
   COM DECISÃO ANTERIOR: o R2 decidiu EXPLICITAMENTE manter esses chips fora do
   verde (documentado em NOTES.md e em comentário no próprio PoolsPage.tsx: "verde é
   voz de ESTADO... chips são ranking comparativo, pintar de verde diluiria a
   semântica binária"). O Carlos não pediu pra reabrir essa semântica — só quer mais
   vivacidade visual. Ver decisoes_ja_tomadas.
3. Raio-X da Recompensa (a tela com mais pontos):
   a. Manchete "X% pro minerador" em --text-display (clamp 4.5rem–13rem) — TENSÃO
      COM DECISÃO ANTERIOR: essa manchete cortada é o signature move documentado da
      tela desde o R1 ("a prova de conceito do sistema"). Reduzir demais apaga o que
      torna essa tela não-genérica.
   b. Faixas do gráfico de divisão (RewardSplitChart) ficam 100% estáticas depois do
      draw-in inicial — só reagem quando chega bloco novo (useDataPulse, ~1x/120s).
      O Carlos quer um efeito ativo/oscilatório contínuo.
   c. Painel [ RESERVE RATIO ] hoje é `border border-hairline` SEM fundo próprio —
      mesmo tom do body atrás. O token de superfície elevada (ink-900) já existe no
      sistema (usado em tooltip/thead) e nunca foi aplicado aqui.
   d. Bug real: o rótulo "piso da faixa alvo (4,0)" no ReserveRatioChart.tsx é
      desenhado 4px ACIMA da linha do piso por coordenada fixa — quando o piso fica
      perto do teto do domínio visível (ratio atual bem acima de 4,0), o texto
      estoura a margem superior do SVG e corta. Precisa de causa raiz + fix, não só
      "empurrar pra baixo" sem testar o caso oposto.
   e. Scrollbar da tabela `<details>` é a scrollbar branca padrão do navegador —
      nunca foi estilizada, quebra o tema escuro.
   f. SegmentedControl (botões "Janela"/"Escala"): estado inativo não tem
      background (só ganha no hover) — mostra o fundo da página por trás, parece
      "não clicável" até passar o mouse.
4. Monitor do Rig: hashrate em --text-headline — mesmo ponto 1, resolve junto.
   StatusBadge: hoje só "offline" tem fundo sólido (bg-bad); "normal" e "below" são
   só borda/texto — o Carlos quer fundo sólido em todos. TENSÃO COM DECISÃO
   ANTERIOR: o R2 decidiu explicitamente que "below" (contorno) vs "offline"
   (sólido) se distinguem por PESO, não matiz — é o mecanismo de acessibilidade pra
   daltonismo (dois negativos na mesma tela). Sólido uniforme nos três empataria
   esse peso e apagaria a distinção. Ver decisoes_ja_tomadas. Espaço pra gráfico
   novo: o Carlos sugere pagamentos do dia OU hashrate diário — só o segundo tem
   dado confirmado no projeto hoje (MinerSnapshot não expõe pagamentos com
   timestamp; o array `payments` do HeroMiners é mencionado no código-fonte do
   upstream mas NUNCA foi confirmado ao vivo, ver minerStats.ts).
</diagnostico>

<decisoes_ja_tomadas>
Não redecida os itens abaixo — já foram fechados com o Carlos:

1. Fundo: clareia, mas continua "quase preto" neutro (não vira cinza médio nem
   ganha tinta de cor) — a identidade "terminal escuro" do rig.ai é a razão de
   existir do sistema. Textura de fundo evolui de linhas (scanline) pra grade de
   blocos pequenos, com movimento sutil — continua sendo a mesma EXCEÇÃO única e
   documentada à regra anti-gradiente do projeto (não abre precedente novo).
2. Bússola de Pools: os chips de destaque NÃO ganham nova família de cor (seria a
   4ª cor de destaque, proibida desde o R1) nem viram verdes (reabriria a semântica
   good/bad que o R2 fechou de propósito). Resolva "mais vivo" com PESO — fundo
   sólido no chip em vez de só texto — não com matiz novo.
3. Raio-X: a manchete continua full-bleed cortada na borda em telas largas (o
   corte é o signature move, não é pra remover) — só o TETO da escala encolhe.
4. Monitor do Rig: os 3 estados do StatusBadge continuam distinguíveis por PESO
   entre si (offline mais "cheio" que below, below mais "cheio" que normal) — não é
   pra igualar os três a fundo 100% sólido idêntico. "Efeito dinâmico" pedido pelo
   Carlos vale só pro estado "normal" (rig vivo/saudável) — não faz sentido animar
   "vivo" num indicador offline.

O que você decide (com evidência, mesmo padrão do projeto):
- Fundo: teste 2-3 candidatos de claridade (ainda croma zero/neutro) e escolha o
  mais claro que preserva AA em mist-400 (o piso de texto corrido) contra o fundo E
  contra a célula mais clara da textura nova — REMEÇA contraste de TODOS os tokens
  com scripts/contrast-check.mjs depois de mudar (a mudança de luminosidade-base
  afeta todo mundo, não só quem está perto do piso). Técnica da textura de blocos e
  do movimento (CSS puro, mesma família de repeating-gradient da scanline atual ou
  equivalente) — sua escolha, contanto que fique monocromática, baixíssima
  opacidade (parta de ~2%, a mesma da scanline atual, e remeça) e o ciclo de
  movimento seja longo/sutil o bastante pra não competir com dado real na tela.
- --text-headline: novo teto (hoje 8rem). Calibre com captura real nas 2 telas que
  usam o token (Pulso da Rede E Monitor do Rig) nos 3 breakpoints — ainda precisa
  ler como hero da dobra, só não estourar.
- --text-display: novo teto (hoje 13rem) — mais conservador que o ajuste do
  headline, já que aqui reduzir demais mata o signature move (ver
  decisoes_ja_tomadas item 3). Calibre com captura real full-bleed nos 3
  breakpoints.
- Histórico de hashrate da rede: parâmetros de amostragem/cap do novo
  networkHashrateHistory.ts (mesmo padrão de luckHistory.ts/rigStatus.ts) — decida
  o intervalo mínimo entre leituras e o tamanho do histórico guardado.
- Efeito "ativo" nas faixas do RewardSplitChart: proponho uma respiração contínua
  e sutil de opacidade do wash (fillOpacity oscilando poucos pontos percentuais,
  ciclo de alguns segundos) — só muda opacidade, nunca a cor computada nem
  introduz elemento novo (restrição dura, ver restricoes). Se tiver uma ideia
  melhor dentro dessas restrições, pode propor, mas documente por quê.
- "Efeito dinâmico" do StatusBadge normal: proponho um halo/ping pulsante atrás do
  dot (padrão comum de indicador "ao vivo") em good — decida o timing e a
  amplitude com o mesmo cuidado de sutileza dos outros movimentos do sistema.
- Gráfico novo do Monitor do Rig: ANTES de implementar, sonde de verdade (curl com
  Origin, mesmo método de sempre) se `payments`/`charts` do HeroMiners
  (stats_address) e algum endpoint equivalente da 2Miners existem, respondem com
  CORS aberto, e têm timestamp por entrada. Se confirmar os dois (formato E CORS),
  pode implementar gráfico de pagamentos do dia. Se NÃO confirmar, implemente
  gráfico de hashrate diário — reaproveitando/estendendo o histórico que já existe
  em rigStatus.ts (hoje 30 leituras a cada ~60s ≈ 30 min; pra caber um dia precisa
  de amostragem mais espaçada e cap maior — calcule e documente os novos números).
  De qualquer forma, documente em NOTES.md o resultado da sondagem, confirmado ou
  não.
</decisoes_ja_tomadas>

<tarefa>
Um item de cada vez, testando antes de seguir pro próximo (mesma disciplina do
R1/R2) — comece pelos tokens compartilhados, porque as telas 1 e 4 dependem deles:

0. Tokens de fundo (src/index.css): recalibre --color-ink-950 pro novo valor
   (mais claro, ainda neutro) e troque a textura scanline por uma grade de blocos
   pequenos com movimento sutil (novo @keyframes no @theme, sempre pareado com
   motion-reduce:animate-none). Remeça contraste de TODOS os tokens de cor contra
   o novo fundo e a nova textura com scripts/contrast-check.mjs; ajuste qualquer
   token que caia abaixo do piso AA já documentado (só a claridade dele, não o
   matiz) e registre os números novos em CLAUDE.md/NOTES.md, mesmo formato da
   tabela do R2.

1. Pulso da Rede (src/modules/network/):
   a. Recalibre --text-headline (afeta esta tela e o Rig — teste as duas).
   b. HalvingCountdown.tsx: envolva a seção num tratamento readout (moldura
      hairline + bg-ink-900, cabeçalho [ PRÓXIMO HALVING ] separado por hairline)
      igual ao painel RESERVE RATIO do Raio-X — reaproveite a estrutura, não
      reinvente.
   c. Crie networkHashrateHistory.ts (mesmo padrão de luckHistory.ts): guarda
      leituras de hash_rate do networkInfo em localStorage. Adicione um mini-
      gráfico de tendência na coluna dominante, abaixo da anotação de
      dificuldade/altura — considere generalizar LuckSparkline.tsx num componente
      reutilizável em src/components/ui/ (ele já faz exatamente esse tipo de
      mini-gráfico) em vez de duplicar a lógica de desenho.
   Teste: `npm run dev`, confira a tela em pelo menos desktop+mobile antes de
   seguir.

2. Bússola de Pools (src/modules/pools/PoolsPage.tsx):
   Mude highlightChip() de texto zeph-300 solto pra fundo sólido zeph-300 com
   texto ink-950 (contraste ~7,6:1, mesma família, sem token novo). Mantenha a
   convenção mono `[ rótulo ]`. Teste: confira que a linha com os 2 chips (mesma
   pool sendo maior hashrate E menor fee ao mesmo tempo, se acontecer) não fica
   poluída — ajuste o gap se precisar.

3. Raio-X da Recompensa (src/modules/rewards/):
   a. Recalibre --text-display (mais conservador — ver decisoes_ja_tomadas).
   b. RewardSplitChart.tsx (e SeriesSwatch.tsx se o pattern precisar de ajuste):
      adicione o efeito de respiração de opacidade no wash das faixas ATIVAS
      (não a governança zerada). RESTRIÇÃO DURA: rewards-e2e.mjs conta <path> por
      COR COMPUTADA e acha o overlay de hover por querySelector('rect') — a
      animação não pode mudar `fill`/cor computada nem adicionar/remover
      elementos; só anime opacity/fillOpacity via CSS. Rode
      `node scripts/rewards-e2e.mjs normal` depois e confirme que passa sem
      alteração de script.
   c. RewardsPage.tsx: adicione bg-ink-900 ao container do readout [ RESERVE
      RATIO ] (o mesmo token que tooltip/thead já usam pra elevação).
   d. ReserveRatioChart.tsx: conserte o rótulo do piso. Reproduza o cenário do
      bug (janela onde o ratio atual fica bem acima de 4,0, empurrando o piso
      pra perto do teto do domínio) e confirme visualmente que hoje corta.
      Documente a causa raiz em NOTES.md antes do fix. Implemente o rótulo
      flipando de posição (acima da linha quando há espaço, abaixo quando não
      há) em vez de uma coordenada fixa.
   e. RewardsPage.tsx: estilize a scrollbar do `<div className="overflow-auto">`
      da tabela com os tokens do sistema (scrollbar-color pra Firefox +
      ::-webkit-scrollbar* pra Chrome/Edge) — track ink-900, thumb mist-600 ou
      equivalente. Considere uma classe utilitária reaproveitável no @layer base
      (outras telas têm overflow-x-auto em tabela e vão precisar do mesmo
      tratamento — Pools e a tabela de workers do Rig).
   f. SegmentedControl (dentro de RewardsPage.tsx): dê background sempre visível
      ao estado inativo dos botões (hoje só ganha no hover) — mantenha o
      contraste do estado ativo (bg-zeph-800/40) claramente diferente.
   Teste depois de CADA subitem (b, d e f mexem em SVG/interação — mais fácil de
   quebrar sem perceber): rode a e2e e confira visualmente antes de seguir pro
   próximo módulo.

4. Monitor do Rig (src/modules/rig/):
   a. --text-headline já resolvido no item 1a — só confirme aqui.
   b. RigDashboard.tsx (STATUS_PRESENTATION/StatusBadge): dê fundo tintado (não
      100% sólido, pra preservar a hierarquia de peso normal < below < offline)
      aos estados "normal" e "below" — ex. bg-good/15 e bg-bad/15 — mantendo
      offline como está (bg-bad 100% sólido). Adicione o halo/ping pulsante
      atrás do dot SÓ no estado normal.
   c. Implemente o gráfico novo conforme a sondagem da decisoes_ja_tomadas
      (pagamentos SE confirmar API, senão hashrate diário reaproveitando/
      estendendo rigStatus.ts). Posicione no espaço que sobra na coluna
      dominante ou no rail — sua escolha, com base em qual fica mais legível.
   Teste: `node scripts/rig-e2e.mjs normal` e `notfound` antes de seguir.

5. Verificação final:
   - `npm run build` limpo, sem warning novo.
   - Rode a suíte e2e completa (rewards normal/lowratio/brokenrewards, rig
     normal/notfound, pools normal) — confirme TUDO passa.
   - Rode scripts/design-shots.mjs nos 3 breakpoints e revise as 12 capturas
     contra a rubrica de autocheck (ver criterios_de_aceite).
   - Ligue prefers-reduced-motion (emulado) e confirme que a nova textura de
     fundo, a respiração das faixas e o halo do StatusBadge param de verdade.
   - Atualize CLAUDE.md (tokens novos com contraste medido — fundo, headline,
     display) e NOTES.md (achados: causa raiz do bug do rótulo, resultado da
     sondagem de payments, parâmetros finais de cada decisão aberta acima).
</tarefa>

<restricoes>
- Preserva tudo que R1/R2 já fecharam: composição dominante/rail por tela,
  convenção mono [ LABEL ], hairline dividers, zero glassmorphism/blur/glow/
  sombra decorativa, zero gradiente novo (só a textura de fundo, que já é
  exceção documentada).
- Proibida uma 4ª família de cor de destaque — o "mais vivo" da Bússola de Pools
  se resolve com peso (fundo sólido), não com token de cor novo.
- Não iguale os 3 estados do StatusBadge do Rig a fundo 100% sólido idêntico — a
  distinção de peso entre below e offline é o mecanismo de acessibilidade a
  daltonismo do R2, não decoração.
- rewards-e2e.mjs não pode precisar de alteração de seletor: qualquer animação
  nova nas faixas do RewardSplitChart muda só opacity/fillOpacity, nunca fill
  computado, nunca adiciona/remove <path>/<rect>.
- Toda animação nova (textura de fundo, respiração das faixas, halo do
  StatusBadge) respeita prefers-reduced-motion sem exceção, testado de verdade
  (emulado), não só código presente.
- Não invente dado: se a sondagem de payments não confirmar CORS+formato ao
  vivo, não implemente com dado parcial/mockado — siga com hashrate diário.
- Contraste WCAG 2.2 AA obrigatório em qualquer texto/token que a mudança do
  fundo afete, medido de verdade com scripts/contrast-check.mjs.
- Um item da tarefa de cada vez, testado antes do próximo — não editar as 4
  telas em paralelo torcendo pra dar certo no final.
- npm run build limpo, sem warning novo.
</restricoes>

<criterios_de_aceite>
- Fundo mais claro (ainda neutro) com contraste de TODOS os tokens remedido e
  registrado; textura nova (blocos + movimento sutil) documentada com os mesmos
  números de pior-caso que a scanline tinha.
- --text-headline e --text-display recalibrados, testados nas telas que os usam,
  captura real nos 3 breakpoints.
- HalvingCountdown com tratamento readout (moldura + bg-ink-900); novo mini-
  gráfico de hashrate de rede com dado real coletado localmente (não mockado).
- Chips da Bússola de Pools com fundo sólido, mesma família zeph, sem token novo.
- Faixas do Raio-X com efeito de opacidade contínuo, rewards-e2e passa sem
  alteração de script.
- Painel RESERVE RATIO com bg-ink-900; rótulo do piso nunca corta a margem do
  SVG em nenhum cenário (inclusive o que causava o bug — teste esse caso
  especificamente); scrollbar da tabela e dos botões Janela/Escala usando
  tokens do sistema, não o padrão branco do navegador.
- StatusBadge do Rig com fundo tintado em normal/below (hierarquia de peso
  preservada), halo pulsante só no estado normal, respeitando
  prefers-reduced-motion.
- Gráfico novo do Rig implementado com dado real (payments confirmado por
  sondagem ao vivo, ou hashrate diário como fallback) — sondagem documentada em
  NOTES.md de qualquer forma.
- npm run build limpo; e2e completa (rewards×3, rig×2, pools×1) passa.
- design-shots.mjs revisado nos 3 breakpoints contra a rubrica abaixo.
- CLAUDE.md e NOTES.md atualizados com todos os valores finais e decisões.
</criterios_de_aceite>

Antes de finalizar, rode a rubrica de 7 perguntas do R2 (está em NOTES.md) pra
cada uma das 4 telas, e adicione um oitavo check específico desta rodada: "o
fundo mais claro e a textura em movimento ainda deixam o dado real como a coisa
mais viva da tela, ou a textura de ambiente compete com atenção que devia ir pro
gráfico/número?" — se a resposta for "compete", reduza a opacidade ou desacelere
o movimento antes de dar como pronto. Se qualquer tela falhar em 2+ perguntas,
ajuste antes de encerrar a sessão.
```

---

## Prompt R4 — Fable: correções de layout + acabamento (rail, Raio-X, Pools, Rig)

Roda depois do R3 (já commitado e enviado, `0c11837`). Direção decidida a partir de 8
pontos que o Carlos trouxe com SCREENSHOTS reais do produto em produção (não descrição
de memória) — três deles são bugs de layout genuínos (regressões introduzidas por
mudanças recentes, não decisão de direção), os demais são acabamento visual. Invoque a
skill `creative-ui-director` de novo nesta sessão: a maioria dos pontos já tem direção
fechada abaixo, mas dois (o rótulo do piso removido e o StatusBadge do Rig) pedem uma
leitura crítica sua antes de implementar — não é só "aplicar a lista".

```
Aja como um engenheiro front-end sênior de direção visual, corrigindo regressões de
layout e refinando acabamento a partir de uso real do produto em produção — invoque a
skill creative-ui-director no início desta sessão. Nem todo item abaixo é "direção
nova": alguns são bugs (trate como bug — causa raiz, fix, teste do cenário exato que
quebrou); outros são acabamento onde você tem autonomia de execução dentro do sistema
"Sinal Técnico" já validado (R1/R2/R3) — não redecida tokens, composição
dominante/rail ou semântica de cor já fechados nas sessões anteriores.

<contexto>
O Carlos usou o produto real (build do R3, já em produção) e trouxe 6 screenshots
anotados cobrindo o rail de navegação, o header mobile, a Bússola de Pools, o Raio-X
da Recompensa e o Monitor do Rig. Leia CLAUDE.md, NOTES.md e o código de src/ antes de
começar — em especial as seções do R3 (mais recente) sobre o painel de reserve ratio,
o StatusBadge e a scrollbar customizada, que são exatamente onde ficam os pontos desta
rodada.
</contexto>

<diagnostico>
0. Rail de navegação (desktop, `xl:`+):
   a. A LogoMark usa a rampa "semBranco" (5 tons: mist-300/zeph-300/mist-400/zeph-500/
      zeph-700, pesos 30/28/20/15/7 — ver LogoMark.tsx) — mas mist-300 (#b7b2c9, o tom
      MAIS claro da rampa, e o de MAIOR peso, 30% dos 288 pontos) ainda lê como
      "branco" pro Carlos usando o produto real, mesmo não sendo literalmente
      mist-100. Pedido: só roxo/cinza, sem esse tom claro demais.
   b. O rail (`--shell-rail-w: 14rem`, logo 128px) deixa espaço vazio sobrando na
      coluna — pedido pra aumentar o rail inteiro (largura, logo, wordmark, nav), não
      só um elemento.
1. Header mobile (`<xl`): o wordmark "Zephyr Mining Hub" hoje centraliza verticalmente
   (`items-center`) ao lado da logo de 96px — o Carlos quer a base do texto alinhada
   com a base da logo, e ambos maiores (mesmo diagnóstico do rail: sobra espaço).
2. Bússola de Pools — dois bugs de layout reais, vistos ao vivo com dado real (a
   HeroMiners sendo maior hashrate E menor fee ao mesmo tempo):
   a. Os dois chips [ maior hashrate ]/[ menor fee ] quebram de forma desalinhada
      quando aparecem juntos na mesma célula — o `flex flex-wrap` do R3 (que deu
      fundo sólido aos chips) não foi testado nesse cenário específico antes de
      fechar a sessão.
   b. A contagem "workers" (linha secundária da coluna Mineradores) corta/quebra —
      provável falta de `whitespace-nowrap` competindo por espaço com as outras
      colunas.
3. Raio-X da Recompensa:
   a. `--text-display` já foi recalibrado de 13rem (R2) pra 11rem (R3), mas ainda lê
      grande demais em uso real — mais uma rodada de calibração, mesma disciplina.
   b. Duplicação real: RewardsPage.tsx tem DUAS legendas quase idênticas em sequência
      vertical — uma dentro da manchete (linhas ~336-352, com valor em ZEPH de cada
      fatia do bloco mais recente) e outra no cabeçalho do gráfico "Divisão da
      recompensa, bloco a bloco" (linhas ~405-421, sem valor, com "· 0 na janela").
      Mesmos swatches/texturas/cores nas duas — ao vivo, lê como repetição, não como
      duas informações diferentes.
   c. O rótulo textual "piso da faixa alvo (4,0)" no ReserveRatioChart.tsx JÁ recebeu
      um fix sofisticado no R3 (flip de posição + halo de contraste atrás do texto,
      com lógica de menor colisão com a série) — mas na janela de 1.000 blocos
      (reserve_ratio oscila muito ao redor do piso nesse range) a linha cruza a
      região do texto com frequência alta o bastante pra continuar ilegível em algum
      trecho, não importa o lado escolhido. O Carlos decidiu: tirar o texto de vez,
      em todas as janelas (100/200/500/1000) — a linha tracejada do piso sozinha já
      demarca isso visualmente, e o número "4,0" já aparece no eixo Y e no texto
      "alvo: 4,0–8,0" acima do gráfico.
   d. O scroll da tabela `<details>` já usa a classe `scrollbar-themed`
      (src/index.css) com mist-600/ink-900 — tecnicamente não é branco nem zeph, mas
      o Carlos ainda percebe alguma tinta e acha a barra grossa (10px hoje).
4. Monitor do Rig:
   a. O `[ TENDÊNCIA 24 H ]` (TrendSparkline, introduzido no R3) é uma linha — o
      Carlos quer barras verticais, e pergunta se dá pra somar outra métrica real (não
      inventada) no mesmo gráfico.
   b. O StatusBadge (`[ Minerando normal ]`, também v3) é uma caixa com borda +
      fundo tintado + padding + o dot com halo dentro — na região DOMINANTE da tela,
      ao lado do hero "16,43 kH/s", esse tratamento de "chip fechado" destoa do resto
      do sistema, que resolve estado com a convenção mono `[ rótulo ]` + cor de
      texto/glifo (readouts, badges de saúde no Pulso da Rede) em vez de caixas tipo
      card. O Carlos não deu direção exata ("está estranho") — é o ponto que mais
      precisa da skill criativa nesta rodada.
</diagnostico>

<decisoes_ja_tomadas>
Não redecida os itens abaixo:

1. Tokens, composição dominante/rail, convenção mono [ LABEL ], semântica good/bad,
   zero gradiente (fora a textura de fundo já documentada) — nada disso muda aqui.
2. A distinção de PESO entre os 3 estados do StatusBadge do Rig (normal < below <
   offline) é o mecanismo de acessibilidade a daltonismo do R2 — qualquer redesenho
   do item 4b preserva essa hierarquia, mesmo mudando a forma como ela é expressa.
3. O rótulo "piso da faixa alvo (4,0)" SAI de vez do SVG do ReserveRatioChart — não é
   pra tentar mais uma variação de posicionamento. Remova o código morto associado
   (floorLabelY, FLOOR_LABEL_CLEARANCE, FLOOR_LABEL_W, FLOOR_LABEL_INK, a função de
   colisão), não só esconda visualmente.
4. Das duas legendas duplicadas do Raio-X, mantenha a que fica junto do gráfico
   "Divisão da recompensa, bloco a bloco" (é a legenda estrutural do gráfico que ela
   descreve) — remova o bloco de legenda de dentro da seção da manchete. A barra de
   proporção decorativa (aria-hidden, acima da legenda removida) continua.

O que você decide (com evidência, mesmo padrão do projeto):
- Rampa da logo sem mist-300: vá em scripts/logo-preview.html (rampa "semBranco" do
  card F3), ajuste a definição de tons/pesos removendo o candidato a "branco" e
  redistribua entre os tons roxo/cinza restantes, depois rode scripts/logo-export.mjs
  de novo pra regenerar LogoMark.tsx — NÃO edite o array DOTS à mão (os índices
  dependem da ordem/tamanho da rampa no gerador). Confirme com captura ampliada
  (mesma técnica de sempre) que nenhum tom lê como branco a olho nu.
- Tamanho novo do rail (largura, logo, wordmark, nav): aumente proporcionalmente e
  MEÇA de novo o invariante do breakpoint (NOTES.md, seção do Prompt N1: a coluna
  com rail precisa ≥ largura de design dos módulos em `lg:`, senão os heros com
  clamp(vw) quebram linha — é por isso que o breakpoint é `xl` hoje). Um rail maior
  pode empurrar esse cálculo pra além de 1280px; decida se o breakpoint sobe pra
  `2xl` ou se algum outro ajuste resolve, com a mesma medição real (simulação DOM +
  captura) que a sessão N1 fez. Reverifique também a legibilidade do tom por ponto
  no logo maior (scripts/rail-logo-shots.mjs).
- Tamanho novo do header mobile (logo, wordmark): a sessão N2 escolheu 96px medindo
  % da altura de um viewport 390×700 e favorecendo o menor tamanho com ganho
  perceptível — o Carlos agora prioriza tamanho sobre economia de altura. Re-teste
  candidatos maiores (112/128px) com scripts/mobile-shell-shots.mjs e escolha
  favorecendo legibilidade/presença, documentando a nova régua de decisão (não é
  reabrir a metodologia, é recalibrar o critério a pedido de quem usa o produto).
- Segunda métrica no gráfico de barras do Rig: avalie se dá pra amostrar
  `pendingBalance` (já consumido em RigDashboard.tsx via `poolPoll.data`) junto com o
  hashrate no motor diário (rigStatus.ts) — dado real, sem sondagem nova de API. Se
  implementar, avise no texto/legenda que o saldo pendente ZERA quando a pool paga
  (comportamento esperado, não bug). Se não der pra fazer com confiança, entregue só
  hashrate em barras — não force uma métrica capenga.
- Redesenho do StatusBadge do Rig: use a skill creative-ui-director pra esse
  componente especificamente. Considere pelo menos uma alternativa que se pareça
  mais com o vocabulário "readout"/mono do resto do sistema (texto+glifo colorido,
  menos "caixa fechada tipo card") antes de decidir — preservando a hierarquia de
  peso normal<below<offline e o halo "ao vivo" (ou uma evolução dele) no estado
  normal.
- Largura/tom final da scrollbar: comece reduzindo de 10px pra algo mais fino
  (6-8px) e reavalie se mist-600 ainda lê com tinta de roxo contra o fundo — se sim,
  considere hairline como thumb. É um `@utility` só (scrollbar-themed em
  src/index.css), então o ajuste vale automaticamente pras 3 tabelas que já usam a
  classe (Pools, Raio-X, Workers do Rig) — não duplique por tela.
- Novo teto de `--text-display`: calibre com captura real nos 3 breakpoints, mesma
  disciplina das rodadas anteriores (preserva o corte full-bleed — só o número
  encolhe, não o mecanismo de composição).
</decisoes_ja_tomadas>

<tarefa>
Um item de cada vez, testando antes de seguir (mesma disciplina de sempre) — comece
pela casca (compartilhada), depois por tela na ordem abaixo:

0. Rail de navegação (src/components/layout/AppShell.tsx, LogoMark.tsx,
   scripts/logo-preview.html, scripts/logo-export.mjs):
   a. Ajuste a rampa "semBranco" no gerador (remova o tom que lê como branco,
      redistribua pesos), rode o export, confirme LogoMark.tsx regenerado (não
      editado à mão) e a captura ampliada sem tom claro demais.
   b. Aumente `--shell-rail-w`, o tamanho do LogoMark no rail e a tipografia do
      wordmark/nav. Reverifique o invariante do breakpoint xl (NOTES.md, Prompt N1)
      com a mesma medição real — ajuste o breakpoint se necessário. Capture o rail
      ampliado de novo pra confirmar legibilidade do tom por ponto no tamanho novo.

1. Header mobile (AppShell.tsx): troque `items-center` por `items-end` no container
   logo+wordmark; teste candidatos maiores de tamanho com scripts/mobile-shell-shots.mjs
   e escolha favorecendo presença (ver decisoes_ja_tomadas). Teste em 390 e 768px.

2. Bússola de Pools (src/modules/pools/PoolsPage.tsx):
   a. Reestruture o container do nome+chips: nome numa linha, os chips (quando mais
      de um) empilhados em coluna logo abaixo, alinhados à esquerda — não mais
      wrap horizontal solto. Force o cenário real (uma pool sendo maior hashrate E
      menor fee ao mesmo tempo — hoje a HeroMiners é esse caso) e confirme
      visualmente antes de seguir.
   b. Dê `whitespace-nowrap` à contagem de workers; se ainda cortar, investigue a
      largura da coluna/tabela e ajuste (min-width da tabela ou da célula).

3. Raio-X da Recompensa (src/modules/rewards/RewardsPage.tsx,
   src/modules/rewards/ReserveRatioChart.tsx, src/index.css):
   a. Recalibre `--text-display` (novo teto, mais conservador que 11rem).
   b. Remova o bloco de legenda de dentro da seção da manchete (mantém a barra de
      proporção decorativa); confirme que a legenda do gráfico "Divisão da
      recompensa, bloco a bloco" continua completa e é a única da tela.
   c. Remova o rótulo "piso da faixa alvo (4,0)" do ReserveRatioChart.tsx e todo o
      código morto associado (ver decisoes_ja_tomadas item 3) — mantenha só a linha
      tracejada do piso. Teste nas 4 janelas (100/200/500/1000 blocos).
   d. Ajuste a `@utility scrollbar-themed` em src/index.css (largura + tom, ver
      decisoes_ja_tomadas) — confirme que reflete nas 3 tabelas que a usam.
   Rode `node scripts/rewards-e2e.mjs normal` (e `lowratio`, já que mexe no
   ReserveRatioChart) antes de seguir pro próximo módulo.

4. Monitor do Rig (src/components/ui/TrendSparkline.tsx,
   src/modules/rig/RigDashboard.tsx, src/modules/rig/rigStatus.ts):
   a. Adicione variante de barras ao TrendSparkline (prop nova, default mantém o
      comportamento de linha atual — não quebre os usos existentes no Pulso da Rede
      e na Bússola de Pools). Use a variante de barras só no Rig. Avalie a segunda
      métrica (pendingBalance) conforme decisoes_ja_tomadas.
   b. Invoque a skill creative-ui-director focada no StatusBadge — diagnostique,
      considere ao menos uma alternativa ao "chip fechado" atual, escolha e
      implemente preservando a hierarquia de peso e o halo do estado normal.
   Rode `node scripts/rig-e2e.mjs normal` e `notfound` antes de seguir.

5. Verificação final:
   - `npm run build` limpo, sem warning novo.
   - e2e completa (rewards normal/lowratio/brokenrewards, rig normal/notfound, pools
     normal) — confirme TUDO passa, inclusive o cenário forçado de dois chips juntos
     na Bússola (se o pools-e2e não cobrir isso, adicione um check).
   - design-shots.mjs nos 3 breakpoints, revisão contra a rubrica de 8 perguntas do
     R3 (NOTES.md).
   - Atualize CLAUDE.md e NOTES.md: novos valores de token (rail, display, rampa da
     logo), o breakpoint do rail se mudou, a decisão final do StatusBadge, e se a
     segunda métrica do Rig entrou ou não (e por quê).
</tarefa>

<restricoes>
- Preserva tudo que R1/R2/R3 já fecharam — tokens, composição dominante/rail,
  convenção mono [ LABEL ], semântica good/bad/zeph, zero gradiente novo.
- Não reabra a metodologia de medição do rail/header mobile — REAPLIQUE ela com um
  critério de tamanho maior (o método continua o mesmo: captura real, medir %, não
  "parece bom").
- rewards-e2e.mjs e rig-e2e.mjs não podem precisar de alteração de seletor por causa
  das mudanças de layout — se algum seletor mirar a legenda removida ou o rótulo do
  piso removido, ajuste o script também e documente.
- O StatusBadge redesenhado não pode perder a distinção de peso normal<below<offline
  nem virar dependente só de cor (mesma regra de daltonismo do R2).
- Não invente segunda métrica do Rig sem dado real — pendingBalance é a única
  candidata identificada; se não render bem, não force outra.
- npm run build limpo, sem warning novo.
- Um item de cada vez, testado antes do próximo.
</restricoes>

<criterios_de_aceite>
- Logo do rail sem nenhum tom lendo como branco (captura ampliada); rail maior com
  breakpoint revalidado por medição real (documentado se mudou de xl pra outro).
- Header mobile com wordmark alinhado à base da logo, tamanho recalibrado e medido.
- Bússola de Pools: os dois chips nunca mais quebram desalinhados quando aparecem
  juntos (testado com o caso real); contagem de workers não corta em nenhuma largura
  de coluna razoável.
- Raio-X: `--text-display` menor (captura real); UMA legenda só na tela (a do
  gráfico); rótulo do piso ausente nas 4 janelas, sem código morto; scrollbar mais
  fina e sem tinta de roxo perceptível, refletida nas 3 tabelas.
- Monitor do Rig: tendência em barras verticais (linha preservada nos outros usos do
  componente); segunda métrica presente E explicada, ou ausente e documentada por
  quê; StatusBadge redesenhado com diagnóstico da skill registrado, hierarquia de
  peso preservada.
- npm run build limpo; e2e completa passa (rewards×3, rig×2, pools×1, com o cenário
  de dois chips coberto).
- design-shots.mjs revisado nos 3 breakpoints contra a rubrica de 8 perguntas.
- CLAUDE.md e NOTES.md atualizados com todos os valores finais.
</criterios_de_aceite>

Antes de finalizar, dois checks extras desta rodada, além da rubrica de 8 perguntas
de sempre: (1) recarregue a Bússola de Pools até pegar um ciclo em que a mesma pool
seja maior hashrate E menor fee — confirme visualmente que os chips não quebram; (2)
abra o Raio-X nas 4 janelas de blocos, uma de cada vez, e confirme que o gráfico do
reserve ratio nunca mostra o texto do piso em nenhuma delas. Se qualquer um dos dois
falhar, ajuste antes de encerrar a sessão.
```

---

## Prompt R5 — Fable: lapidações finais (sparklines largos, chips da Bússola, mobile do Raio-X, gráfico do Rig)

Roda depois do R4 — **commite o R4 antes de começar esta sessão** (regras 5/6 do
HANDOFF: feche a sessão que rodou R4, PowerShell limpa fora de qualquer `claude`
ativo, add/commit/push, só então abra a sessão nova). Direção decidida em 2026-07-11
a partir de 5 screenshots anotados do Carlos usando o build do R4 — é lapidação, não
redesign: nenhum ponto reabre composição, token de cor ou semântica já fechados.

```
Aja como um engenheiro front-end sênior de direção visual fazendo a rodada de
lapidação final de um design system já validado (R1–R4) — invoque a skill
creative-ui-director no início da sessão. Os pontos abaixo vêm de uso real com
screenshot; a maioria tem direção fechada, e o único com latitude criativa real é o
tratamento visual das barras do Rig (item 4).

<contexto>
Leia CLAUDE.md e NOTES.md (em especial as seções do R4 — chips da Bússola,
TrendSparkline variant bars, scrollbar, motor diário do rig) antes de começar. O
build de referência é o do R4 recém-commitado.
</contexto>

<diagnostico>
1. /rede — o instrumento [ TENDÊNCIA · COLETADA NESTE NAVEGADOR ] usa o
   TrendSparkline em largura fixa e sobra um vão grande à direita na coluna
   dominante em desktop: o gráfico parece menor que a importância que tem.
2. /pools — o empilhamento em coluna do R4 resolveu o desalinhamento dos chips,
   mas quando os DOIS aparecem (caso real: HeroMiners com maior hashrate E menor
   fee) a linha fica alta demais. Direção nova do Carlos, com screenshot:
   [ maior hashrate ] fica AO LADO do nome da pool, na mesma linha; [ menor fee ]
   fica ABAIXO do primeiro chip (não abaixo do nome). Há espaço pra alargar a
   tabela pra direita se precisar.
3. /recompensa (mobile) — dois pontos:
   a. Os botões do SegmentedControl da janela (100/200/500/1.000 blocos) estão
      altos demais no mobile — afinar (menos padding vertical).
   b. A scrollbar da tabela ainda lê grossa e com TINTA ROXA — o thumb hairline
      (#282530) tem matiz ≈262°: croma baixa, mas ainda roxa, e o Carlos percebe.
      Direção: fina/sutil e NEUTRA de verdade (cinza/preto, croma zero).
4. /meu-rig — a faixa [ SALDO PENDENTE · MESMAS LEITURAS ] SAI (decisão do Carlos
   usando o produto: duas séries empilhadas competem e o saldo diz pouco no dia a
   dia). O gráfico de barras [ TENDÊNCIA 24 H ] vira o único instrumento de
   tendência da tela e deve CRESCER — ocupar a largura disponível à direita — e
   ficar mais vivo/visível ("adicionar algum efeito ativo", nas palavras dele),
   dentro das regras de movimento do sistema.
   Também checado pelo Carlos com os DOIS estados acontecendo de verdade: o
   [ Minerando normal ] (readout nu do R4) está correto, mas o
   [ Hashrate abaixo do esperado ] ainda rende como caixa contornada/tintada —
   decisão dele: os dois usam a MESMA anatomia de readout nu, mudando só a cor
   (good→bad) e o texto.
5. Favicon: o atual (Z̶ em zeph-300) SAI — o Carlos vai implementar outro
   depois; até lá a aba fica sem ícone customizado.
6. Estabilidade: nada do mobile pode quebrar com essas mudanças — verificação
   explícita nos 3 breakpoints ao final.
</diagnostico>

<decisoes_ja_tomadas>
Não redecida:
1. Chips da Bússola: maior hashrate ao lado do nome (mesma linha), menor fee
   embaixo do CHIP (formando coluna de chips à direita do nome, não abaixo dele).
   Quando só um chip existe, ele fica ao lado do nome. Continua RANKING (zeph),
   nunca good/bad.
2. A faixa do saldo pendente sai da UI. A amostragem do `b?` no motor diário
   (rigStatus.ts) é decisão sua: manter (campo opcional, custo ~zero, reabilita
   fácil) com comentário justificando, ou remover — sem migração de storage nos
   dois casos. Documente a escolha.
3. Scrollbar neutra: a família atual inteira (hairline/mist/ink-900) tem matiz
   roxo — vai precisar de um token DECORATIVO novo e neutro (ex.
   --color-scroll, cinza croma zero na faixa de ~#333–#3f3f3f) registrado no
   @theme com papel documentado (SÓ scrollbar, nunca texto/borda de conteúdo).
   Afinar também (6px). A mudança é na @utility scrollbar-themed — vale
   automaticamente pras 3 tabelas.
4. Largura responsiva dos gráficos: prefira MEDIR o container (o hook
   useElementWidth já existe em src/hooks — use-o) a fixar um width maior na mão.
   Vale pros dois instrumentos: a linha do /rede (item 1) e as barras do rig
   (item 4). Altura pode subir junto no rig se a proporção pedir.
5. StatusBadge: normal e below passam a compartilhar a anatomia de readout NU
   (ponto + rótulo mono), diferenciados por COR (good/bad) e pelo TEXTO do
   rótulo; offline continua caixa sólida (superfície = pior estado). Isso muda
   deliberadamente a escada do R4 (below perde a caixa) — registre o desvio no
   NOTES.md: o canal não-cor entre normal e below agora é o texto por extenso
   (e o halo, que segue SÓ no normal); offline segue distinto por peso.
6. Favicon: remova o <link rel="icon"> do index.html e o public/favicon.svg —
   SEM substituto neste prompt (o novo ícone é do Carlos, vem depois).

O que você decide (com evidência, padrão do projeto):
- Tratamento visual das barras do rig (skill creative-ui-director): candidatos a
  considerar — última barra (leitura mais recente) em zeph-300 com as demais em
  zeph-500; hover/focus com o valor da leitura em caption mono; data-pulse na
  chegada de leitura nova (useDataPulse já existe). TODO movimento novo em par
  com motion-reduce:animate-none, sem exceção. As barras seguem mais quietas que
  o hero — instrumento secundário não vira segunda região dominante (rubrica).
- Quanto o SegmentedControl afina no mobile: mantenha área de toque utilizável
  (não desça de ~32px de alvo real) — meça no viewport 390 e documente o valor.
- Se a tabela da Bússola precisa de min-width maior pro chip ao lado do nome não
  quebrar em lg/xl — decida medindo nos breakpoints reais.
</decisoes_ja_tomadas>

<tarefa>
Um item de cada vez, e2e do módulo antes de seguir:

1. /rede (NetworkPulsePage.tsx): TrendSparkline da tendência de rede em largura
   responsiva via useElementWidth — preenche a coluna dominante em desktop,
   segue coubível no mobile. Confira que o uso do TrendSparkline na Bússola
   (luck) fica INTACTO.
2. /pools (PoolsPage.tsx): rearranjo dos chips conforme decisão 1. Force o caso
   real de dois chips (HeroMiners hoje) e confirme visualmente em 1360 e 1024.
   ATENÇÃO — mudança de contrato de e2e deliberada: os 3 checks permanentes que
   o R4 adicionou ao pools-e2e verificam o arranjo empilhado antigo (tops
   distintos/lefts iguais); atualize-os pro arranjo novo (chip 1 na linha do
   nome; chip 2 abaixo do chip 1) e documente a mudança no próprio script.
3. /recompensa: afinar o SegmentedControl no mobile (item a) e a scrollbar
   neutra + 6px (item b, com o token novo da decisão 3). Rode rewards-e2e
   normal + lowratio (a scrollbar não tem contrato de cor no e2e, mas confirme).
4. /meu-rig (RigDashboard.tsx, TrendSparkline.tsx, rigStatus.ts): remover a
   faixa do saldo pendente (decisão 2); barras em largura responsiva (decisão
   4) e tratamento visual novo (sua latitude, com a skill); padronizar o estado
   below na anatomia do normal (decisão 5) — force os dois estados (o rig-e2e
   já semeia o cenário below) e capture-os. Se algum check do rig-e2e
   referenciar a faixa removida ou a caixa do below, atualize documentando.
   Rode rig-e2e normal + notfound.
5. Favicon: remover link + arquivo (decisão 6); confirme que o build não
   referencia o arquivo removido.
6. Verificação final: npm run build limpo; e2e completa (rewards×3, rig×2,
   pools×1); design-shots nos 3 breakpoints com revisão contra a rubrica de 8
   perguntas — atenção especial ao mobile (item 5 do diagnóstico: nada quebrou);
   CLAUDE.md e NOTES.md atualizados (arranjo novo dos chips, token da scrollbar,
   decisão do b?, tratamento das barras, larguras responsivas).
</tarefa>

<restricoes>
- Preserva tudo que R1–R4 fecharam: tokens (fora o decorativo novo da scrollbar),
  composição dominante/rail, convenção mono [ LABEL ], semântica good/bad/zeph,
  zero gradiente novo, nunca eixo duplo, procedência do dado sempre declarada.
- TrendSparkline: a variante line continua default e os usos existentes não
  mudam de comportamento (só a largura do /rede).
- Nenhum dado novo de API — tudo desta rodada é apresentação sobre dado que já
  chega.
</restricoes>

<criterios_de_aceite>
- Sparkline do /rede preenchendo a coluna dominante em desktop (captura).
- Chips da Bússola no arranjo novo, confirmado com o caso real de dois chips
  (captura em 1360 e 1024), pools-e2e atualizado e passando.
- SegmentedControl mais fino no mobile com alvo de toque documentado; scrollbar
  6px neutra (croma zero) nas 3 tabelas.
- Faixa do saldo pendente ausente; barras do rig maiores/responsivas com o
  tratamento novo, motion-reduce pareado, rig-e2e passando.
- Estados normal e below do rig com a MESMA anatomia de readout nu (só cor e
  texto mudam; captura dos dois), offline seguindo sólido; desvio da escada do
  R4 registrado no NOTES.md.
- Favicon removido (index.html sem <link rel="icon">, public/favicon.svg fora
  do repo).
- npm run build limpo; e2e completa verde; design-shots 12/12 revisadas
  (rubrica de 8), mobile explicitamente conferido; CLAUDE.md/NOTES.md
  atualizados.
</criterios_de_aceite>
```

### Adendo 2 ao R5 (2026-07-11) — limpeza de metadados de UI + tendências

A primeira execução do R5 rodou com uma cópia do prompt anterior aos adendos do
StatusBadge/favicon (adendo 1, itens 5/6 acima); este bloco soma a segunda leva de
pedidos do Carlos. Cola na MESMA sessão do R5 (nada foi commitado), junto com o
adendo 1 se ele ainda não rodou:

```
Segunda leva de itens do escopo R5 — limpeza de metadados de UI e ajustes dos
instrumentos de tendência. Nada aqui reabre composição/token; e2e e docs no final
valem pro R5 inteiro.

1. Remoções de texto descritivo (decididas pelo Carlos, tela a tela):
   - /rede: a linha "Atualização automática a cada 30 s (cache da API) ·
     última: HH:MM:SS"; a anotação mono sob o hero ("dificuldade X bi (…) ·
     bloco N · um novo a cada ~120 s" + "estimado pelo daemon da rede
     (dificuldade ÷ 120 s), via explorer"); a legenda "Últimas 360 leituras
     (1 por bloco, ~2 min) guardadas neste navegador…".
   - /pools: "Atualização automática a cada 60 s · última: HH:MM:SS".
   - /recompensa: "Atualização automática a cada 60 s · última: HH:MM:SS".
   - /meu-rig: "a cada 60 s · HH:MM:SS" (rail) e a legenda "Hashrate da
     carteira na pool, até 288 leituras (1 a cada ~5 min ≈ 24 h)…".

2. Procedência vira canal não-visual (a convenção do projeto NÃO cai): os
   rótulos dos instrumentos de tendência perdem o "· COLETADA NESTE NAVEGADOR"
   (ficam [ TENDÊNCIA ] e [ TENDÊNCIA 24 H ]), e o container de cada
   instrumento ganha title + aria-label com a procedência completa ("coletada
   neste navegador com a página aberta; não há série histórica pública").
   Atualize a frase da convenção no CLAUDE.md: a UI segue declarando a
   procedência, agora por tooltip/AT em vez de texto visível.

3. /rede — o gráfico de tendência fica mais ALTO (a remoção dos textos libera
   espaço vertical; hoje ele lê comprimido) — calibre a altura por captura. E
   ganha um efeito dinâmico sutil na LINHA (sua latitude, com a skill):
   candidatos — draw-in de entrada (useChartEntrance já existe, com a trava de
   assentamento) e/ou pulso/halo discreto no ponto corrente. Motion-reduce
   pareado, sempre; o hero continua a coisa mais viva da tela.

4. /pools — os dois parágrafos do rodapé da tabela ("Luck/effort: …" e
   "Tendência: … / '—' = …") viram UM bloco agrupado (mesma informação, menos
   fragmentos soltos).

5. /meu-rig — o instrumento [ TENDÊNCIA 24 H ] DESCE: sai de baixo do hero e
   fica logo ACIMA da tabela de workers; as barras ficam mais ALTAS,
   preenchendo parte do espaço liberado. Reconfirme na rubrica que ele não
   vira segunda região dominante.

6. Contratos: qualquer check de e2e que referencie texto removido/movido é
   atualizado com a mudança documentada no script.

7. Verificação final (vale pro R5 inteiro, adendos inclusos): npm run build
   limpo; e2e completa (rewards×3, rig×2, pools×1); design-shots 12/12 na
   rubrica de 8; CLAUDE.md/NOTES.md atualizados (procedência via title/aria,
   altura nova das tendências, rodapé agrupado, posição nova do gráfico do
   rig, StatusBadge below nu, favicon removido).
```

---

## Prompt T1 — Fable: tema claro "white/blue" + botão de troca de tema

Roda depois do R5 — **commite o R5 antes** (regras 5/6 do HANDOFF). Direção e paleta
decididas em 2026-07-11 no chat de planejamento (paleta "A · Azul técnico" escolhida
pelo Carlos entre 3 candidatas): o produto ganha um segundo tema, claro, azul sobre
branco, cobrindo TUDO — fundo, textura, logo, gráficos, tabelas, estados, efeitos —
com um botão de troca que segue a linguagem do sistema. O tema escuro atual continua
sendo o padrão e não muda em nada.

```
Aja como um engenheiro front-end sênior implementando o segundo tema de um design
system totalmente tokenizado — invoque a skill creative-ui-director no início. A
vantagem estrutural: NENHUM componente usa hex solto (regra do projeto desde o R1),
então o tema é, na essência, um segundo conjunto de VALORES pros mesmos tokens do
@theme de src/index.css — mais a infraestrutura de troca/persistência e a verificação
de contraste do conjunto novo.

<contexto>
Leia CLAUDE.md e NOTES.md (tokens v3/R4, textura de blocos, rampa da logo, semântica
good/bad, scrollbar) antes de começar. Repare como TUDO já referencia var(--color-*):
componentes via utilitário Tailwind, SVG data-driven via style, LogoMark via var() por
ponto — é isso que torna este prompt viável numa sessão.
</contexto>

<paleta_de_partida>
Valores de PARTIDA (medidos aproximadamente no planejamento; recalibre com
scripts/contrast-check.mjs como fonte de verdade, mantendo os mesmos PISOS de papel
do tema escuro: destaque ≥7:1, suporte ≥3:1 mesmo na célula da textura, piso de
texto corrido ≥4,5:1 com folga, alívio/decoração documentados):

- fundo (ink-950 claro): #f7f7f7 — NEUTRO croma zero, espelho do #141414.
- textura: mesma grade de blocos 3px/vão 3px com deriva, PRETO a ~2-3% (célula
  escura ≈ #eceef2 vira o pior caso de contraste — meça contra ela).
- superfície elevada (ink-900 claro): #ffffff — no claro a elevação é MAIS clara
  que o fundo (direção invertida de propósito; documente).
- hairline claro: ~#d9dde6 (tinta azul sutil, espelho da tinta roxa do escuro).
- família azul (matiz ≈217°, papéis idênticos aos do zeph):
  zeph-300→#1d4ed8 (destaque/manchete/chip), zeph-500→#3b82f6 (suporte/gráfico),
  zeph-700→#93c5fd (SÓ gráfico com alívio), zeph-800→#bfdbfe (SÓ decoração).
- texto (espelho do mist, cinza-azul): mist-100→#171c26, mist-300→#3f4859,
  mist-400 (piso)→#5a6373, mist-600 (decoração)→#a9b1c2.
- estados: good→#15803d, bad→#c2410c (semântica binária intacta; texto claro
  sobre chapado — meça).
- scrollbar (token neutro do R5): valor claro neutro (~#c8c8c8).
</paleta_de_partida>

<decisoes_ja_tomadas>
1. Arquitetura: os tokens MANTÊM os nomes atuais (ink/zeph/mist/good/bad — são
   papéis, não cores literais); o tema claro é um bloco de override
   `[data-theme='light']` redefinindo os MESMOS custom properties. Nenhum
   componente muda de classe por causa do tema.
2. Escuro continua o DEFAULT (identidade do produto e contrato dos e2e, que
   verificam cor computada no default). Persistência em localStorage
   (`zephyr-hub.theme.v1`); aplicar o atributo ANTES do primeiro paint (script
   inline mínimo no index.html) pra não piscar tema errado no load.
3. Botão de troca: convenção mono do sistema — `[ TEMA · ESCURO ]` /
   `[ TEMA · CLARO ]` — no rail (desktop) e no bloco de topo (mobile), como
   <button> acessível (rótulo por extenso é o estado ATUAL; decida e documente
   se o rótulo mostra o atual ou o destino — consistente nos dois arranjos).
4. A logo acompanha SOZINHA (os pontos referenciam var()) — mas a legibilidade
   do tom por ponto no fundo claro precisa de captura ampliada (mesma técnica de
   sempre) nos DOIS tamanhos (rail 176px, mobile 128px). O ESPELHO manual de
   tokens do scripts/logo-preview.html ganha o conjunto claro também (armadilha
   conhecida do N2 — ele não flui sozinho).
5. Favicon: o R5 REMOVEU o ícone atual (um novo, do Carlos, virá depois e fora
   deste prompt) — não crie favicon aqui. Se quando esta sessão rodar já existir
   um novo, ele NÃO muda com o tema (vive fora da cascata) — documente.
6. Textura, respiração, draw-in, pulso, halo, cintilância: os MESMOS efeitos nos
   dois temas (tempos e keyframes idênticos; só as cores fluem via var()).
   Confira em especial a textura (o branco 2% do escuro vira preto ~2-3% no
   claro — é um par de cores no conic-gradient, tokenize-o) e os washes/tints
   compostos (good/10, bad/20, zeph-800/40 do SegmentedControl): recalcule a
   composição real sobre fundo claro com o contrast-check e ajuste os
   percentuais SE algum papel perder o piso (documente cada ajuste).
</decisoes_ja_tomadas>

<tarefa>
1. Tokenização da troca: bloco [data-theme='light'] em src/index.css com o
   conjunto da paleta de partida; par de cores da textura vira token se ainda
   não for; script inline anti-flash no index.html; hook/util de tema
   (localStorage + set do atributo).
2. Botão de troca nos dois arranjos da casca (AppShell), convenção mono,
   acessível, sem layout shift ao alternar o rótulo.
3. Calibração medida: estenda scripts/contrast-check.mjs com a seção do tema
   claro (todos os pares texto/fundo/célula-da-textura/superfície-elevada +
   chapados good/bad/zeph-300 + tints compostos) e recalibre os valores de
   partida até todos os papéis baterem os pisos. Tabela final no NOTES.md.
4. Varredura de fuga: procure QUALQUER cor que não flua com o tema (hex solto
   remanescente, rgba fixo, cor em atributo SVG em vez de style, canvas/imagem).
   Cada achado: corrigir pra token ou documentar exceção (ex.: favicon).
5. Verificação visual: design-shots nas 4 telas × 3 breakpoints × 2 TEMAS (24
   capturas — adicione o parâmetro de tema ao script); revisão contra a rubrica
   de 8 perguntas TAMBÉM no claro (hierarquia em P&B, estados sem cor, textura
   não compete, etc.); capturas ampliadas da logo no claro (item 4 das
   decisões).
6. e2e completa no default escuro (contratos intactos — nenhum espelho de token
   dos scripts deve precisar mudar); adicione ao menos um check de tema: troca
   pelo botão aplica [data-theme='light'], persiste após reload, e volta.
7. `npm run build` limpo; CLAUDE.md e NOTES.md atualizados (tabela do tema
   claro, arquitetura da troca, decisões 1–6, achados da varredura).
</tarefa>

<restricoes>
- O tema ESCURO não muda NADA (nenhum valor de token atual, nenhum componente) —
  qualquer ajuste visual que você sinta falta no escuro fica pra outro prompt.
- Zero gradiente novo (a textura segue a exceção única já documentada, nos dois
  temas), zero sombra/blur/glow — a elevação no claro é superfície branca +
  hairline, não sombra.
- Semântica binária good/bad intacta; estados continuam nunca só-cor.
- Nenhuma mudança de composição, tipografia ou movimento — este prompt é SÓ
  cor/tema + botão de troca.
</restricoes>

<criterios_de_aceite>
- Tema claro completo e aplicável via botão nos dois arranjos, persistente entre
  reloads, sem flash de tema errado no load.
- contrast-check com a seção clara passando os pisos de papel (tabela no
  NOTES.md); nenhuma fuga de token sem documentação.
- 24 capturas revisadas (4 telas × 3 breakpoints × 2 temas) contra a rubrica;
  logo legível tom a tom no claro (captura ampliada).
- e2e completa verde no escuro + check novo de troca/persistência de tema.
- `npm run build` limpo; CLAUDE.md/NOTES.md atualizados.
</criterios_de_aceite>
```

---

## Prompt N3 — Fable: ícone no botão de troca de tema

Independente da fila principal (não bloqueia nem é bloqueado por skills/tradução/Prompt
5/deploy) — pode rodar em qualquer sessão livre, sozinho. Direção escolhida em
2026-07-12 no chat de planejamento (3 avaliadas: traço mono sol/lua, extensão dot-matrix
da logo, glifo compacto em colchetes) — traço mono venceu por ser a mais legível
universalmente e a mais barata de implementar com precisão.

```
Aja como um engenheiro front-end sênior de direção visual trocando um único
controle por um ícone dentro de um design system já tokenizado — invoque a
skill creative-ui-director no início (modo design-system-constrained-upgrade,
escopo enxuto: só este componente).

<contexto>
Leia CLAUDE.md e NOTES.md (seção do 2º tema/T1) antes de começar. O botão de
troca de tema (ThemeToggle, dentro de src/components/layout/AppShell.tsx) hoje
é texto mono `[ TEMA · ESCURO ]` / `[ TEMA · CLARO ]`, com min-w-[17ch] pra não
deslocar layout na troca. Motivo da mudança: o rótulo por extenso pesa demais
na zona mais quieta do sistema (base do rail / linha sob a nav mobile).
</contexto>

<decisoes_ja_tomadas>
1. Direção escolhida (entre 3 avaliadas no chat de planejamento): traço mono
   fino (sol/lua), NÃO um ícone de biblioteca — o projeto não tem dependência
   de ícones (só react/react-dom/react-router-dom) e não deve ganhar uma só
   por isso. SVG desenhado à mão, stroke="currentColor" (ou var(--color-*)),
   mesma lógica de "sem preenchimento chapado" do resto do sistema.
2. O ícone declara o estado ATUAL, nunca o destino — mesma regra do rótulo de
   texto que ele substitui (convenção dos colchetes mono: "sempre dizem o que
   É"). Tema escuro ativo → lua. Tema claro ativo → sol.
3. A AÇÃO (não o estado) vai no aria-label, exatamente como hoje
   ("Mudar pro tema claro" / "Mudar pro tema escuro") — isso não muda.
4. min-w-[17ch] deixa de fazer sentido (não é mais texto longo) — o botão
   pode encolher pro tamanho do alvo de toque acessível (mínimo ~24px de área
   clicável), mas SEM layout shift perceptível entre os dois estados (sol e
   lua devem ocupar a mesma caixa).
</decisoes_ja_tomadas>

<tarefa>
1. Desenhe os dois glifos (sol / lua) como SVG inline dentro do próprio
   componente ThemeToggle — sem lib nova, sem arquivo .svg separado (mesma
   convenção do LogoMark: SVG gerado no código, não asset importado). Traço
   fino (1.5–2px), sem preenchimento chapado, tamanho consistente com a
   escala do sistema (calibre por captura — não é um valor documentado
   ainda, decida e registre).
2. Troque o conteúdo do <button> de texto pra ícone, preservando: o
   data-testid="theme-toggle" existente (o e2e depende dele), o aria-label
   dinâmico, o onClick.
3. Acessibilidade: já que o rótulo visível de texto some, confirme que
   aria-label sozinho basta (não precisa de texto visualmente oculto extra,
   mas pode adicionar se achar mais robusto — documente a escolha).
4. Calibre nos dois lugares onde o botão aparece (base do rail desktop, linha
   sob a nav mobile) e nos dois temas — 4 combinações. Screenshot de cada uma.
5. Confirme com contrast-check.mjs que o traço do ícone bate o piso de
   contraste de elemento interativo não-texto (≥3:1) nos dois temas — decida
   qual token de cor usar (mist-400 parece o mais próximo do peso visual do
   texto atual) e registre em CLAUDE.md.
</tarefa>

<restricoes>
- Não mexe em MAIS NADA do AppShell além do componente ThemeToggle — nav,
  logo, layout do rail/header mobile ficam intocados.
- Não muda a lógica de troca de tema (applyTheme/currentTheme, localStorage,
  script anti-flash do index.html) — só o CONTEÚDO VISUAL do botão.
- Zero gradiente/sombra/blur/glow no ícone. Uma transição sutil (cor no
  hover, crossfade/rotate na troca) é aceitável SE vier em par com
  motion-reduce, como todo movimento do sistema — não é obrigatória.
- Zero dependência nova (sem lucide, sem @heroicons, sem lib de ícone) — SVG
  à mão, como o LogoMark.
</restricoes>

<criterios_de_aceite>
- Ícone substitui o texto nos dois arranjos (rail/mobile) e nos dois temas,
  sem layout shift entre os dois estados.
- data-testid="theme-toggle" e aria-label dinâmico intactos — theme-e2e.mjs
  passa sem alteração de contrato.
- contrast-check com o ícone passando o piso de elemento interativo nos dois
  temas — valor registrado em CLAUDE.md/NOTES.md.
- `npm run build` limpo; CLAUDE.md atualizado (a linha que hoje descreve o
  botão como "convenção mono" precisa refletir a troca pro ícone).
</criterios_de_aceite>
```

---

## Prompt G1 — Fable: ganhos estimados no Monitor do Rig

Independente da fila principal, mas prefira rodar numa sessão própria (não junto do N3
— um prompt por sessão, regra 1 do HANDOFF). Decisão do chat de planejamento em
2026-07-12: entre 4 direções para o vão vazio da coluna dominante do Rig (ganhos
estimados, comparação com a rede/pool, recorde pessoal, não preencher), Carlos escolheu
ganhos estimados — a única que cruza dado de módulos diferentes pela primeira vez no
produto.

```
Aja como um desenvolvedor front-end pleno consumindo múltiplas APIs já
integradas no projeto pra compor uma estimativa nova — sem inventar dado,
sem API nova, só reaproveitando três funções que já existem e já são usadas
em outro módulo.

<contexto>
Leia CLAUDE.md e NOTES.md antes de começar, com atenção especial às seções
"Zephyr Scanner API" e "Zephyr Explorer API". O Monitor do Rig
(src/modules/rig/RigDashboard.tsx) tem hoje um vão vazio na coluna dominante,
logo abaixo do hashrate do rig + StatusBadge — o rail ao lado (4 StatCards) é
mais alto que o conteúdo da esquerda, então sobra espaço (já registrado em
NOTES.md como "retorno às proporções pré-R4", não é bug). Decisão do chat de
planejamento: preencher esse vão com uma estimativa de ganho — a primeira vez
que o produto cruza dado de módulos diferentes (hoje /rede, /pools,
/recompensa e /meu-rig são ilhas que não se falam).
</contexto>

<dados_e_apis>
Três funções já prontas e já em uso no Pulso da Rede
(src/modules/network/NetworkPulsePage.tsx) — reaproveite-as, não reimplemente:
- `getNetworkInfo()` de src/lib/api/zephyrExplorer.ts → `.hash_rate` (H/s da
  rede). CORS aberto, sem proxy.
- `getLatestBlockReward()` de src/lib/api/zephyrScanner.ts → `.miner_reward`
  (recompensa do minerador em ZEPH, já é a fatia de 65%, não precisa
  recalcular o split). Passa pelo proxy /zephyr-api.
- `getLiveStats()` de src/lib/api/zephyrScanner.ts → `.zeph_price` (USD).
  Mesmo proxy.
- `BLOCK_TIME_SECONDS` (120) já exportado de src/lib/emission.ts — use pra
  derivar blocos/dia (86400 / BLOCK_TIME_SECONDS = 720), não hardcode 720
  solto.
- O hashrate do PRÓPRIO rig já existe no componente: a variável
  `signalHashrate` (fonte XMRig local se alcançável, senão pool — é
  literalmente o número que já aparece no hero "[ SINAL DO RIG ]").

Fórmula: ganho_diario_zeph = (signalHashrate / networkInfo.hash_rate) *
blockReward.miner_reward * (86400 / BLOCK_TIME_SECONDS). Ganho em USD =
ganho_diario_zeph * liveStats.zeph_price (só quando os dois estiverem
disponíveis — são independentes, um pode faltar sem derrubar o outro).
</dados_e_apis>

<decisoes_ja_tomadas>
1. Local: dentro da <section> da região dominante do Rig, no mesmo
   <div className="min-w-0"> que hoje só tem o hero + StatusBadge — abaixo
   deles, preenchendo o vão. Não mexe no rail (StatCards) nem em mais nada
   da tela.
2. É uma ESTIMATIVA, não uma promessa — trate com o MESMO cuidado de rótulo
   que o HalvingCountdown já usa pra "estimado pelo daemon" (leia o
   componente antes de escrever o texto novo, pra reusar o mesmo tom, não
   inventar um jeito novo de avisar).
3. Três polls novos (rede, recompensa, preço) — reaproveite usePolling
   (mesmo hook que pool/xmrig já usam neste componente) com o MESMO
   intervalo que o Pulso da Rede usa pra essas fontes
   (SCANNER_CACHE_SECONDS * 1000 — importe a constante, não hardcode 30000).
4. Degradação por campo, não tudo-ou-nada: se faltar SÓ o preço, mostra
   ZEPH/dia com "—" no lugar do USD; se faltar hashrate da rede ou
   recompensa, o bloco inteiro cai pra "—" (a conta não fecha sem os dois).
   Nunca trava a tela — o resto do Monitor do Rig (hero, rail, tabela de
   workers) continua funcionando mesmo se os 3 polls novos falharem.
</decisoes_ja_tomadas>

<tarefa>
1. Três polls novos em RigDashboard.tsx (usePolling + as três funções
   acima), com tratamento de erro isolado por fonte (o padrão que o
   componente já usa pra pool/xmrig — erro de uma fonte não derruba as
   outras).
2. Cálculo da estimativa como função pura e testável (pode viver num arquivo
   novo, tipo src/modules/rig/earnings.ts, se achar mais limpo que inline).
3. UI no vão da coluna dominante: label mono `[ GANHO ESTIMADO ]` (convenção
   de colchetes do sistema), valor em destaque (calibre o tamanho por
   captura — não é hero, é leitura secundária; não deve competir com o
   headline do hashrate), sub-linha com USD/dia + a ressalva de estimativa.
4. Skeleton enquanto os 3 polls novos ainda não resolveram (mesmo componente
   Skeleton que o resto da tela usa).
5. Screenshot em desktop e mobile, tema claro e escuro (4 capturas), com o
   bloco preenchido E com pelo menos uma fonte falhando (confirme que "—"
   aparece em vez de tela quebrada).
</tarefa>

<restricoes>
- Não recalcule o split 65/30/5 manualmente — `miner_reward` já vem pronto
  da API; usar outro campo ou recalcular é duplicar lógica que já existe em
  src/lib/emission.ts/zephyrScanner.ts.
- Não crie um valor "estimado" quando QUALQUER um dos 4 inputs
  (signalHashrate, hash_rate da rede, miner_reward, zeph_price) estiver
  undefined — vira "—", nunca um número parcial ou zero disfarçado de dado.
- Zero gradiente/glow/sombra nova — reusa os tokens/readouts que a tela já
  tem (mesma anatomia do restante da coluna dominante).
- Não mexe no rail de StatCards, na tabela de workers, nem no bloco
  [ TENDÊNCIA 24H ] — escopo é só o vão acima deles.
</restricoes>

<criterios_de_aceite>
- Estimativa visível no vão, com fallback "—" por campo ausente (testado
  forçando erro numa das 3 fontes novas).
- Ressalva de "estimado" no mesmo tom do HalvingCountdown existente.
- `npm run build` limpo; lint sem warning novo; e2e do rig (normal/notfound)
  segue passando sem alteração de contrato (novo bloco não deve quebrar os
  waitFor existentes).
- CLAUDE.md/NOTES.md atualizados: a nova fórmula, os 3 polls novos, e o
  registro de que é a primeira composição cross-module do produto.
</criterios_de_aceite>
```

---

## Prompt R6 — Fable: lapidações a partir de screenshots (botão de tema com rótulo, largura do parágrafo da Bússola, rodapé com doação)

Depende do N3 já commitado (o botão de tema hoje é só ícone — este prompt parte
daí, não refaz o N3). Independente do G1. Três achados de uso real, a partir de
screenshots reais do Carlos em 2026-07-12 — mesmo gênero do R4/R5.

```
Aja como um engenheiro front-end sênior de direção visual fazendo uma rodada de
lapidação a partir de screenshots reais do Carlos (mesmo gênero do R4/R5) — invoque
a skill creative-ui-director no início pro item 3 (rodapé/doação, é o único dos três
com julgamento estético aberto; os itens 1 e 2 são ajustes mecânicos, resolva direto).

<contexto>
Leia CLAUDE.md e NOTES.md antes de começar. Três achados de uso real, independentes
entre si:
1. O botão de tema (ThemeToggle, AppShell.tsx) hoje é SÓ ícone (sol/lua, do N3,
   já commitado) — sem nenhum texto visível, só aria-label. Na prática ficou
   ambíguo demais pra quem não passa o mouse/não usa leitor de tela.
2. O parágrafo de explicação do luck/effort na Bússola de Pools (PoolsPage.tsx)
   tem max-w-3xl, mais estreito que a tabela acima dele — sobra uma faixa vazia
   grande à direita em telas largas.
3. O rodapé (AppShell.tsx) hoje só credita as fontes de dado. O Carlos quer trocar
   isso por um endereço de carteira pra doação, decorado com um motivo pixelado —
   ESTE item pede leitura de direção visual, os outros dois não.
</contexto>

<decisoes_ja_tomadas>
1. Botão de tema: o ícone FICA (não volta a ser só texto) — ganha um rótulo mono
   ao lado, em INGLÊS mesmo (não traduza pra ESCURO/CLARO): "DARK" quando o tema
   escuro está ativo, "WHITE" quando o claro está ativo — grafia exata pedida pelo
   Carlos, mantenha "WHITE" e não "LIGHT". Mesma regra de sempre: o rótulo declara
   o estado ATUAL, a ação continua só no aria-label (isso não muda). Use a
   convenção de colchetes do sistema no texto (`[ DARK ]` / `[ WHITE ]`) do mesmo
   jeito que o botão usava antes do N3. O botão cresce o suficiente pra caber
   ícone + texto sem aperto (reserve a largura do mais longo dos dois rótulos —
   "[ WHITE ]" — pra não deslocar layout na troca); calibre o tamanho exato por
   captura, como sempre.
2. Parágrafo do luck/effort: remova o max-w-3xl (ou troque por algo que acompanhe
   a largura real da tabela acima) — o texto deve ocupar a mesma largura que a
   `<table>` ocupa no mesmo breakpoint, sem sobrar faixa vazia à direita. Não muda
   o CONTEÚDO do parágrafo, só a largura.
3. Rodapé: a linha "Dados: Zephyr Scanner API..." SAI. No lugar, um endereço de
   carteira pra doação, ladeado por um motivo de coração PIXELADO (mesma técnica
   de grade de pontos do LogoMark.tsx — NÃO emoji de coração, NÃO ícone de
   biblioteca, NÃO Unicode ♥ — um SVG pequeno desenhado com a mesma lógica de
   pontos/quadradinhos, monocromático, token de cor decorativo do sistema, ex.
   mist-400 ou zeph-300). O aviso "projeto comunitário, sem afiliação oficial"
   FICA (só ele — pode descartar a lista de fontes de API), compacto, perto do
   bloco de doação: o site usa cor/logo de marca da Zephyr, então essa frase é a
   única coisa que deixa claro pro visitante que isto não é o site oficial — não
   é só estilo, é a única linha do produto que evita confusão de afiliação.
   Endereço exato (hardcode, não invente nem abrevie o valor real — só a
   apresentação visual pode truncar):
   ZEPHYR2eWBjJtirbhwCoxh9HLDLp6H6sbjBn3zpo38QXZHFVuACysqsDeLi9dvJ29FRQLXqhVVKmkDbv2EDoophcFd4Ur3pH7WT3Y
</decisoes_ja_tomadas>

<tarefa>
1. ThemeToggle: adicione o rótulo mono ao lado do glifo (ver decisão 1). Ajuste o
   min-w/gap pro par ícone+texto sem deslocar layout entre os dois estados.
   Screenshot dos dois estados, rail E mobile, os dois temas (4 capturas).
2. PoolsPage: troque o max-w-3xl do parágrafo por algo que acompanhe a largura da
   tabela (ou remova o cap e deixe o container pai controlar). Screenshot em
   desktop confirmando que as duas larguras batem.
3. Rodapé: desenhe o motivo de coração pixelado (componente novo ou função dentro
   do AppShell — decida pelo mesmo critério do LogoMark: gerar a grade de pontos
   em código, não um asset importado) e monte o bloco novo do rodapé: coração ·
   rótulo curto tipo "apoie o projeto" · endereço em font-mono · coração. O
   endereço é longo (106 caracteres) — em mobile (390px, o viewport que o projeto
   sempre testa) ele NÃO PODE estourar layout: escolha entre truncar
   visualmente com o valor completo disponível via title/clique-pra-copiar, ou
   quebra de linha controlada (break-all) dentro do max-w do rodapé — decida e
   documente. Adicione um botão/ação de copiar (navigator.clipboard, sem lib
   nova) com alguma confirmação visual de que copiou. Mantenha a frase de não
   afiliação (decisão 3). Screenshot desktop + mobile, os dois temas (4
   capturas).
</tarefa>

<restricoes>
- Item 1 não mexe na lógica de troca de tema nem no glifo sol/lua em si (só
  adiciona o texto ao lado) — MoonGlyph/SunGlyph continuam os mesmos.
- Item 2 não muda o texto do parágrafo, só a largura.
- Item 3: zero emoji, zero ícone de biblioteca, zero Unicode de coração — o
  motivo pixelado segue a MESMA técnica de pontos do LogoMark. Zero
  gradiente/glow/sombra (regra de sempre do sistema). O endereço da carteira é
  hardcoded, exato, nunca gerado/formatado a partir de outra fonte.
- Os três itens são independentes — não deixe um item quebrar outro (ex.: não
  aproveite pra "melhorar" mais nada no rodapé ou no ThemeToggle além do pedido).
</restricoes>

<criterios_de_aceite>
- Botão de tema com ícone + rótulo `[ DARK ]`/`[ WHITE ]`, sem layout shift entre
  estados, nos dois arranjos (rail/mobile) e temas — theme-e2e.mjs segue
  passando (aria-label e data-testid intactos).
- Parágrafo da Bússola com a mesma largura da tabela em desktop.
- Rodapé com coração pixelado + endereço de doação (texto completo correto,
  copiável) + frase de não afiliação, sem estourar layout em 390px, nos dois
  temas.
- `npm run build` limpo; lint sem warning novo; e2e existente (rewards/rig/pools/
  theme) passa sem alteração de contrato.
- CLAUDE.md/NOTES.md atualizados: o rótulo do botão, a largura do parágrafo, e o
  novo padrão de rodapé (coração pixelado + doação).
</criterios_de_aceite>
```

---

## Prompt R7 — Fable: ajustes no botão de tema e no rodapé (a partir de screenshot pós-R6)

Depende do R6 (não precisa estar commitado pra rodar, mas commite os dois — N3, G1
e R6 estão TODOS no working tree ainda sem commit, ver HANDOFF). Três achados a
partir de screenshot real do Carlos em 2026-07-12.

```
Aja como um engenheiro front-end sênior de direção visual corrigindo um bug de
alinhamento e trocando a técnica de um ícone pra consistência visual com um
padrão que já existe no próprio código — invoque a skill creative-ui-director
só pro item 2 (redesenho do ícone); os itens 1 e 3 são ajuste/remoção mecânica.

<contexto>
Leia CLAUDE.md e NOTES.md antes de começar — o R6 (botão de tema com rótulo,
rodapé de doação) já rodou; este prompt corrige e simplifica o que ele
entregou, a partir de screenshot real do Carlos em 2026-07-12. Três achados:
1. No ThemeToggle (AppShell.tsx), o glifo sol/lua e o rótulo `[ DARK ]`/
   `[ WHITE ]` ao lado não estão alinhados verticalmente — o texto aparece
   visivelmente mais alto que o centro do ícone, apesar do container já ter
   items-center.
2. Comparando lado a lado com o PixelHeart do rodapé (também do R6), o glifo de
   traço fino do sol/lua ficou destoando — o Carlos prefere o ícone na MESMA
   linguagem pixelada/halftone do coração.
3. O rodapé de doação (DonationFooter) ficou mais carregado do que precisa:
   remover a frase de não-afiliação, mostrar o endereço completo (sem truncar,
   sem botão de copiar), e aumentar um pouco fonte + coração — sobra espaço.
</contexto>

<decisoes_ja_tomadas>
1. Alinhamento: diagnostique a causa raiz antes de aplicar um fix chutado
   (candidatos prováveis: line-height do token text-caption criando uma caixa
   assimétrica em volta do texto, ou o <svg> com o display inline padrão do
   navegador brigando com items-center) — confirme por inspeção/captura, não
   só por olho.
2. Ícone do ThemeToggle: troca de técnica, MoonGlyph/SunGlyph (traço fino,
   stroke currentColor) saem, entram versões PIXELADAS — MESMA técnica do
   PixelHeart (grade de <rect>, um tom só, fill via var(--color-*), lado do
   quadradinho <1 unidade pro vão do halftone). Antes de dimensionar, releia
   docs/logo-exploracao.md: a pesquisa de halftone pequeno já mostrou que
   grade fina não sobrevive legível abaixo de ~24px (só a "V2 grade grossa",
   mais grossa, segurava a 24px) — os 18px atuais do ícone estão bem na zona
   de risco que aquela exploração mapeou. Pode crescer o box do ícone se a
   grade pedir, com critério (não deve dominar o botão nem destoar do
   tamanho do rótulo ao lado) — calibre por captura, a 18px E maior, e decida.
   Sol e lua continuam ocupando a MESMA caixa (zero deslocamento na troca).
3. Rodapé (DonationFooter): remove a `<p>` "projeto comunitário, sem afiliação
   oficial" por completo (decisão explícita do Carlos, sobrepõe a ressalva que
   o R6 tinha registrado). Remove shortAddress/truncamento e o botão
   "[ copiar ]" inteiro (com o handler copyAddress e o estado copied) — mostra
   DONATION_ADDRESS completo como texto simples (não mais <button>). Sem
   truncar, o endereço (106 chars) PRECISA quebrar linha em vez de estourar —
   use quebra controlada (break-all ou equivalente) dentro do max-w do
   container, testado em 390px. Fonte do rótulo "apoie o projeto" e do
   endereço sobe um degrau na escala tokenizada existente (ex.: text-caption →
   text-label — NUNCA um valor `text-[Npx]` novo, a régua do projeto proíbe).
   PixelHeart cresce (prop size já existe pra isso) um pouco também — calibre
   os dois tamanhos juntos por captura, o rodapé tem espaço de sobra.
</decisoes_ja_tomadas>

<tarefa>
1. Corrija o alinhamento vertical entre o glifo e o rótulo do ThemeToggle nos
   dois arranjos (rail/mobile). Screenshot de perto (zoom) confirmando o
   centro do ícone e a linha de base do texto alinhados.
2. Redesenhe MoonGlyph/SunGlyph como glifos pixelados (mesma técnica do
   PixelHeart), calibrando o tamanho pela pesquisa de logo-exploracao.md.
   Screenshot nos dois temas, rail e mobile, com lupa (mesma técnica de
   sempre) se o tamanho final for pequeno.
3. Simplifique o DonationFooter: remove a frase de não-afiliação, remove
   truncamento + botão de copiar (endereço completo como texto simples),
   aumenta fonte (token existente, um degrau acima) e o PixelHeart. Confirme
   que o endereço completo quebra linha sem estourar em 390px, nos dois
   temas. Endereço não muda (mesmo valor hardcoded).
</tarefa>

<restricoes>
- Item 1 não muda o conteúdo do botão (glifo + rótulo continuam os dois),
  só o alinhamento.
- Item 2 não muda a REGRA do glifo (estado atual, não destino; mesma caixa
  pros dois estados) — só a técnica de desenho.
- Item 3: o endereço em si (DONATION_ADDRESS) não muda. Nenhum novo texto de
  disclaimer entra no lugar do que saiu — o pedido foi remover, não substituir.
- Zero lib de ícone, zero emoji, zero gradiente/glow/sombra (regras de sempre).
- Nenhum tamanho novo fora da escala tokenizada (--text-*) do sistema.
</restricoes>

<criterios_de_aceite>
- Ícone e rótulo do ThemeToggle visualmente alinhados (captura de perto)
  nos dois arranjos e temas.
- Ícone sol/lua pixelado, na mesma família visual do PixelHeart, legível nos
  tamanhos calibrados — comparação com docs/logo-exploracao.md registrada em
  NOTES.md se o tamanho final mudar dos 18px.
- Rodapé sem a frase de não-afiliação, endereço completo visível (sem truncar,
  sem botão), fonte e coração maiores, sem estourar 390px nos dois temas.
- `npm run build` limpo; theme-e2e.mjs segue passando (aria-label/data-testid
  do ThemeToggle intactos — só o conteúdo visual mudou).
- CLAUDE.md/NOTES.md atualizados: nova técnica do ícone de tema, novo formato
  simplificado do rodapé.
</criterios_de_aceite>
```

---

## Prompt EN1 — Fable: tradução do produto pro inglês (hardcode, sem i18n)

Sessão nova, roda depois do R7 (já commitado). Escrito no chat Cowork em
2026-07-12, pronto pra colar sem alteração. Escopo: SÓ texto voltado ao
visitante (o produto publicado) — CLAUDE.md, NOTES.md, README.md, docs/ e
comentários de código CONTINUAM em português (são a língua de trabalho do
projeto, não o produto). Decisão de arquitetura já tomada (ver
`docs/HANDOFF.md`): inglês hardcoded em cada string, sem biblioteca de i18n —
o produto é uma dashboard técnica pra público cripto global, não precisa
alternar idioma em runtime, e uma lib de i18n adicionaria dependência e
indireção que o projeto (bundle único, sem dependência além de
react/react-dom/react-router-dom) não precisa.

```
Aja como um engenheiro front-end sênior fazendo uma varredura de localização
completa (hardcode, não i18n) — trocar TODO texto voltado ao visitante de
português pra inglês, incluindo formatação numérica, sem deixar nenhum
contrato de e2e quebrado sem atualização correspondente.

<contexto>
Leia CLAUDE.md e NOTES.md antes de começar. O Zephyr Mining Hub está com os 4
módulos prontos (Pulso da Rede, Bússola de Pools, Raio-X da Recompensa,
Monitor do Rig) e o design system "Sinal Técnico" estável — esta sessão NÃO
muda composição, cor, token ou lógica, só o idioma do texto que o VISITANTE do
site vê ou ouve (leitor de tela incluso). O público de um dashboard de
mineração cripto é global e majoritariamente inglês; o produto vira inglês
hardcoded, sem biblioteca de i18n (decisão já tomada, porquê abaixo).

IMPORTANTE — o que NÃO muda: CLAUDE.md, NOTES.md, README.md e os arquivos de
docs/ continuam em português (língua de trabalho do projeto, não o produto).
Comentários no código CONTINUAM em português (convenção existente do
CLAUDE.md, não está sendo revogada). Nomes de variável/função/componente já
estão em inglês desde o Prompt 1 — não é esse o gap; é o literal de texto
renderizado e string de atributo (aria-label, title, alt, placeholder).
</contexto>

<decisoes_ja_tomadas>
1. Sem biblioteca de i18n: strings hardcoded em inglês substituindo as em
   português. Motivo: produto sem alternância de idioma em runtime, público
   majoritariamente anglófono, e uma lib (react-i18next ou similar)
   adicionaria dependência + indireção que este projeto não precisa.
2. Rotas continuam em português (/rede, /pools, /recompensa, /meu-rig) NESTA
   sessão. Traduzir URL é decisão separada (afeta link já compartilhado e
   TODOS os scripts de e2e navegam por essas rotas) — fica pra outro prompt
   se o Carlos quiser. Não troque nenhuma rota aqui.
3. README.md, ErrorBoundary por módulo e a varredura de `order=desc` seguem
   fora do escopo — são do Prompt 5 (integração final, ainda por reescrever),
   não desta sessão.
4. Nomes dos 4 módulos (aparecem em nav, header de página, `<title>`,
   aria-label) — sugestão de tradução abaixo; ajuste se soar melhor em
   inglês natural, mas registre a versão final numa tabela PT→EN em NOTES.md
   pra sessões futuras cruzarem referência:
   - Pulso da Rede → Network Pulse
   - Bússola de Pools → Pool Compass
   - Raio-X da Recompensa → Reward X-Ray
   - Monitor do Rig → Rig Monitor
5. Formatação numérica: o produto hoje exibe número/porcentagem em convenção
   pt-BR (vírgula decimal — ex. "65,0%", "92,73 MH/s"). Investigue a camada
   de formatação (grep por `toLocaleString`/`Intl.NumberFormat`/um `format.ts`
   central) e CONFIRME se o locale é hardcoded ou implícito (segue o locale
   do navegador/SO de quem acessa). De qualquer forma, deixe `en-US` EXPLÍCITO
   nessa sessão — produto em inglês com vírgula decimal (ou pior, formato
   dependente do dispositivo do visitante) lê como quebrado. Mesma decisão
   vale pra qualquer data/hora formatada, se houver.
</decisoes_ja_tomadas>

<tarefa>
1. Levantamento primeiro, edição depois: grep sistemático em src/ por
   caracteres acentuados (áéíóúâêôãõçÁÉÍÓÚÂÊÔÃÕÇ) FORA de comentário (// e
   /* */) pra montar a lista real de todo texto em português ainda visível —
   string JSX, atributo (aria-label, title, alt, placeholder), array de opção
   (dropdown de pool, SegmentedControl), mensagem de erro/estado vazio,
   `<title>`/meta do index.html, `lang="pt-BR"` do `<html>` (vira
   `lang="en"`). Trate esse grep como o checklist da sessão, não confie só em
   revisar tela por tela de olho.
2. Traduza módulo por módulo, na mesma ordem de sempre (rede → pools →
   recompensa → meu-rig), depois a casca (AppShell: nav, ThemeToggle —
   `[ DARK ]`/`[ WHITE ]` JÁ estão em inglês, não mexe — e DonationFooter) e
   por fim os componentes compartilhados (ui/: loading, erro, StatCard,
   TrendSparkline e o texto do `summary`/aria-label que ele gera). Rótulos
   mono entre colchetes mantêm a convenção `[ Rótulo ]` — só o texto de
   dentro troca de idioma. Exemplos pra ancorar o padrão: `[ PRÓXIMO HALVING ]`
   → `[ NEXT HALVING ]` (`[ RESERVE RATIO ]` já é termo em inglês, mantém o
   rótulo — só os 4 estados do selo mudam: `[ ✓ NA FAIXA ALVO ]` →
   `[ ✓ IN TARGET RANGE ]`, `[ ! ABAIXO DO PISO ]` → `[ ! BELOW FLOOR ]`,
   `[ ↑ ACIMA DA FAIXA ]` → `[ ↑ ABOVE RANGE ]`, `[ AGUARDANDO SÉRIE ]` →
   `[ AWAITING SERIES ]`, `[ SEM DADO ]` → `[ NO DATA ]`), `[ ALERTA · RESERVA
   ABAIXO DO PISO ]` → `[ ALERT · RESERVE BELOW FLOOR ]`, `[ Minerando normal
   ]` → `[ Mining normally ]`, `[ Hashrate abaixo do esperado ]` →
   `[ Hashrate below expected ]`, `[ maior hashrate ]`/`[ menor fee ]` →
   `[ highest hashrate ]`/`[ lowest fee ]`, `[ TENDÊNCIA ]`/`[ TENDÊNCIA 24 H
   ]` → `[ TREND ]`/`[ 24H TREND ]`, `[ GANHO ESTIMADO ]` →
   `[ ESTIMATED EARNINGS ]`, `[ FALHA ]` → `[ FAILED ]`. As 2-3 frases fixas
   do Raio-X explicando a mecânica de Djed pra quem só conhece mineração de
   Monero — traduza o SENTIDO com a mesma clareza pro equivalente anglófono
   (alguém que minera Monero mas nunca ouviu falar de "reserve ratio"), não
   palavra por palavra.
3. Formatação numérica/data: aplique a decisão 5 acima (locale explícito
   en-US) no(s) ponto(s) central(is) de formatação — não espalhe locale solto
   por componente.
4. Atualize TODOS os scripts de e2e que passam por texto (waitFor de texto,
   innerText comparado com `===`/regex, aria-label esperado, parsing de
   número — ex. o cálculo do rewards-e2e que recalcula % a partir da API e
   compara com o texto da manchete pode quebrar se o parser esperar vírgula
   decimal): `pools-e2e.mjs`, `rewards-e2e.mjs`, `rig-e2e.mjs`,
   `theme-e2e.mjs`. Rode a suíte inteira só depois de todo o texto trocado,
   não módulo a módulo (evita retrabalho: texto compartilhado por dois
   scripts só precisa mudar uma vez).
5. Regenere `design-shots.mjs` (24 capturas, 4 telas × 3 breakpoints × 2
   temas) e revise visualmente — nenhum texto em português deve sobrar em
   nenhuma captura, nos dois temas.
6. Atualize CLAUDE.md e NOTES.md: registre a decisão de locale (o que a
   investigação do item 5 das decisões achou, e o que ficou), a tabela PT→EN
   dos 4 nomes de módulo, e uma linha confirmando "produto em inglês;
   CLAUDE.md/NOTES.md/README.md/comentários seguem em português".
</tarefa>

<restricoes>
- Zero mudança de composição, token, cor, lógica de negócio, cálculo ou
  chamada de API — troca só texto/atributo/formatação numérica. Bug real
  encontrado no caminho (não relacionado a idioma): documente em NOTES.md
  antes de decidir corrigir ali ou deixar pra outro prompt — não corrija
  calado, mas também não expanda o escopo desta sessão sem necessidade.
- Comentários de código continuam em português — não traduza comentário.
- CLAUDE.md, NOTES.md, README.md e docs/ continuam em português.
- Rotas (/rede, /pools, /recompensa, /meu-rig) NÃO mudam nesta sessão.
- `[ DARK ]`/`[ WHITE ]` do ThemeToggle já estão em inglês — não mexe.
- Nenhum texto novo de disclaimer/aviso — é tradução, não é hora de reabrir
  decisão de copy (ex. o rodapé de doação já teve a frase de não-afiliação
  removida por decisão explícita do Carlos no R7; não reintroduza, nem em
  inglês).
</restricoes>

<criterios_de_aceite>
- Grep por acentuação em src/ (fora de comentário) retorna zero ocorrências.
- `npm run build` limpo; `npm run lint` só com os 2 warnings pré-existentes.
- Suíte e2e completa — pools (normal + broken2miners), rewards (normal +
  lowratio + brokenrewards), rig (normal + notfound), theme — TUDO PASSOU,
  com os scripts atualizados pro texto novo (não "sem alteração de contrato"
  desta vez — o contrato de TEXTO muda de propósito; o de COMPORTAMENTO não).
- 24 capturas do design-shots revisadas: zero português visível, número em
  formato en-US (ex. "65.0%", não "65,0%").
- `<html lang="en">`, `<title>` e meta description (se existir) em inglês.
- CLAUDE.md/NOTES.md atualizados com a decisão de locale e a tabela PT→EN dos
  módulos.
</criterios_de_aceite>

Antes de finalizar, leia a UI resultante como se você fosse um visitante
anglófono que nunca viu a versão em português — o texto lê como inglês
natural (frase escrita por alguém que pensa em inglês) ou como tradução
literal (frase em inglês com estrutura de português por baixo)? Ajuste o
segundo caso antes de dar como pronto — em especial as 2-3 frases da mecânica
de Djed e as mensagens de erro/estado vazio.
```

---

## Depois dos 5 prompts

- Rode a skill **backend-structure-auditor** pra mapear qualquer deriva de padrão que
  sobrou entre as 4 sessões — mesmo sendo o mesmo modelo, sessões sem memória
  compartilhada tendem a divergir em escolhas pequenas (nome de variável, estrutura de
  componente, jeito de tratar erro).
- Rode **code-audit-cleanup** pra tirar sobra (import não usado, código morto, comentário
  redundante) sem mudar comportamento.
- **creative-ui-director** é opcional e independente desta sequência — use quando quiser
  uma passada de direção visual mais autoral (o dashboard acima só pede "responsivo,
  legível", não define identidade visual). Pode rodar em paralelo aos módulos 2-4, se
  quiser já começar com uma linguagem visual definida, ou depois do Prompt 5, como polish.

---

## Prompt D1 — Fable: deploy em produção (Vercel)

Escrito no chat Cowork em 2026-07-12, depois do Prompt 5 (integração final, commit
`804f088`) já rodar, ser verificado e commitado — confirmado por `git log` real, não
por memória (o `docs/HANDOFF.md` chegou a ficar desatualizado nesse ponto, tratando o
Prompt 5 como pendente; já corrigido). É o próximo item não escrito da fila: o repo
está pronto pra produção (4 módulos, EN1, tema escuro/claro, Prompt 5), mas ainda não
existe `vercel.json` nem qualquer deploy.

Duas regras do rewrite abaixo foram confirmadas contra a documentação oficial da
Vercel nesta sessão (não assumidas): (1) arquivos estáticos reais do build são
servidos ANTES de qualquer rewrite ser considerado, então o catch-all de SPA não
quebra os assets JS/CSS do `dist/`; (2) rewrites com destino em URL externa (como o
`https://zephyrprotocol.com/api/:path*` abaixo) proxeiam a requisição no servidor da
Vercel — o navegador nunca faz a chamada cross-origin, então CORS deixa de ser
problema, exatamente como o proxy do Vite já faz em dev. Fontes: [Rewrites on
Vercel](https://vercel.com/docs/routing/rewrites) e [Can I use Vercel as a reverse
proxy?](https://vercel.com/kb/guide/vercel-reverse-proxy-rewrites-external).

````
Aja como um engenheiro front-end sênior com experiência real de deploy de SPAs
Vite/React na Vercel, incluindo rewrite de proxy para contornar CORS de APIs de
terceiros.

<contexto>
O Zephyr Mining Hub está pronto pra produção: 4 módulos (Network Pulse, Pool
Compass, Reward X-Ray, Rig Monitor), produto em inglês (EN1), tema escuro/claro
(T1), integração final consolidada (Prompt 5, commit 804f088). O repo já existe
no GitHub e ainda não tem deploy nenhum — não existe vercel.json no projeto.

Duas descobertas da Fase 0 (Prompt 1, ver CLAUDE.md/NOTES.md) definem esta
sessão: (1) a Zephyr Scanner API bloqueia CORS no navegador — em dev o Vite
resolve com um proxy (`vite.config.ts`, `/zephyr-api` → `https://
zephyrprotocol.com`, rewrite que troca o prefixo por `/api`); em produção
precisa do rewrite equivalente da Vercel, senão o Network Pulse e o Reward
X-Ray (que dependem de `/livestats`/`/blockrewards` via
`src/lib/api/zephyrScanner.ts`, `BASE_URL = '/zephyr-api/v1'`) ficam sem dado.
(2) O produto usa `BrowserRouter` (`src/main.tsx`) com rotas limpas (`/rede`,
`/pools`, `/recompensa`, `/meu-rig`) — sem fallback de SPA, um F5 ou link
direto em qualquer rota que não seja `/` dá 404 na Vercel (o servidor estático
não sabe que `/pools` deve servir o mesmo `index.html`).
</contexto>

<tarefa>
1. Crie `vercel.json` na raiz do repo com DOIS rewrites, NESTA ORDEM (a Vercel
   aplica rewrites na ordem da lista, e o catch-all de SPA precisa vir DEPOIS
   do rewrite da API, senão o catch-all engole a API primeiro):
   ```json
   {
     "rewrites": [
       { "source": "/zephyr-api/:path*", "destination": "https://zephyrprotocol.com/api/:path*" },
       { "source": "/(.*)", "destination": "/index.html" }
     ]
   }
   ```
   Não adicione `buildCommand`/`outputDirectory` manual — a Vercel autodetecta
   Vite (framework preset) a partir do `package.json`; só force esses campos
   se você encontrar uma razão concreta pra isso (documente se acontecer).

2. Confirme por leitura de código (não redigite nada) que o caminho do rewrite
   bate com o que o app realmente chama: `src/lib/api/zephyrScanner.ts` usa
   `BASE_URL = '/zephyr-api/v1'` e o proxy do Vite em `vite.config.ts` troca
   `/zephyr-api` por `/api` — o rewrite da Vercel acima precisa reproduzir
   EXATAMENTE essa troca de prefixo (`/zephyr-api/v1/livestats` →
   `https://zephyrprotocol.com/api/v1/livestats`). Se algum outro arquivo em
   `src/lib/api/` usar uma base diferente, ajuste o rewrite pra cobrir também
   (não deveria haver — a Scanner API é a única bloqueada por CORS no
   projeto — mas confirme por grep antes de assumir).

3. Rode `npm run build` e sirva o `dist/` localmente (`npm run preview`, que já
   tem o proxy configurado em `vite.config.ts` pra `/zephyr-api`) só pra
   confirmar que o build de produção carrega os 4 módulos com dado real — isso
   NÃO testa o `vercel.json` (o preview do Vite usa o proxy dele, não o
   rewrite da Vercel), é só uma checagem de que nada quebrou no build.

4. Se a Vercel CLI (`npx vercel`) estiver disponível e você já tiver uma conta
   logada, `npx vercel dev` roda um servidor local que HONRA o `vercel.json`
   de verdade (mais fiel que o preview do Vite) — use se for rápido, mas não
   trave a sessão nisso: exige login interativo que pode não estar disponível
   neste ambiente. Se não der, documente que ficou pendente pro teste manual
   do Carlos (próximo item).

5. Escreva em `NOTES.md` uma seção nova "# NOTES — Deploy Vercel (D1)" com: a
   decisão do rewrite (as duas regras e a ordem, com o porquê), e um CHECKLIST
   EXPLÍCITO endereçado ao Carlos pra rodar DEPOIS que o deploy estiver no ar
   de verdade (isso não dá pra testar de dentro desta sessão):
   a. Importar o repo em vercel.com (ou `vercel --prod` pela CLI) e confirmar
      Framework Preset = Vite.
   b. Abrir a URL pública e conferir que os 4 módulos carregam dado real (não
      só skeleton/erro) — em especial Network Pulse e Reward X-Ray, que
      dependem do rewrite da Scanner API.
   c. Recarregar (F5) ou abrir link direto em `/pools`, `/recompensa` e
      `/meu-rig` — nenhuma delas pode dar 404 (é o teste do fallback de SPA).
   d. Com XMRig real (ou `scripts/xmrig-sim.mjs`) rodando local com
      `--http-enabled`, abrir a URL PÚBLICA (https) da Vercel e configurar o
      Rig Monitor apontando pro XMRig local — é o teste pendente desde o
      Prompt 4 (mixed content https→http local já foi confirmado que FUNCIONA
      em `https://localhost`, mas nunca foi testado a partir de um domínio
      PÚBLICO de verdade, que é outro espaço de endereço pra política de Local
      Network Access do Chrome). Registrar o resultado (funcionou / bloqueado
      / bloqueado com aviso) — a UI já degrada graciosamente nos dois casos,
      então não é bloqueante pro deploy, só uma lacuna de conhecimento real.
   e. Conferir no painel da Vercel/aba de rede do navegador que o proxy não
      introduziu polling mais rápido que os 30s de cache da Scanner API (a
      cadência é decidida pelo `usePolling` do app, não pelo proxy — mas vale
      confirmar visualmente).

6. Atualize `CLAUDE.md`: mova a seção de deploy de "planejado" pra descrever o
   `vercel.json` real (as duas regras, a ordem, e por que existe).
</tarefa>

<restricoes>
- Zero mudança em `src/` — é uma sessão de infraestrutura de deploy, não de
  produto. Se achar um bug real no caminho, documente em NOTES.md em vez de
  corrigir nesta sessão (mesma regra do Prompt 5).
- Não crie função serverless nem qualquer backend com estado — o projeto é
  deliberadamente "sem backend", só a ponte de CORS via rewrite (ver
  CLAUDE.md, seção Stack). Se `vercel.json` acabar precisando de algo além de
  `rewrites`, pare e documente o motivo em vez de expandir escopo.
- Não crie variável de ambiente/segredo — nenhuma API usada no projeto exige
  chave.
- Não reintroduza favicon (`<link rel="icon">`/`public/favicon.svg`) — foi
  removido de propósito no R5 (decisão do Carlos, comentário explicativo já no
  `index.html`); um ícone novo vem de um prompt futuro.
- A ordem dos dois rewrites é crítica — não inverta, e não colapse os dois numa
  regra só.
- O teste de Local Network Access (item 5d) não pode ser marcado como feito
  por você nesta sessão — só o Carlos, com o deploy real no ar, consegue
  rodá-lo. Deixe o checklist pronto, não invente um resultado.
</restricoes>

<criterios_de_aceite>
- `vercel.json` existe na raiz, é JSON válido, e tem os dois rewrites na ordem
  documentada acima.
- `npm run build` limpo (typecheck + Vite build).
- `npm run lint` sem warning novo (os 0 atuais — o Prompt 5 já zerou os 2
  históricos — continuam 0).
- `npm run preview` carrega os 4 módulos com dado real (confirma que o build
  de produção não quebrou nada; não substitui o teste real pós-deploy).
- `NOTES.md` tem a seção nova com a decisão do rewrite + o checklist de 5
  itens (a-e acima) endereçado ao Carlos, nenhum item marcado como testado
  sem ter sido testado de verdade.
- `CLAUDE.md` reflete o `vercel.json` real, não mais "rewrite planejado".
- Nenhum arquivo em `src/` foi tocado.
</criterios_de_aceite>
````

Antes de finalizar, releia o `vercel.json` como se você fosse a Vercel processando a
primeira requisição depois do deploy: uma chamada pra `/zephyr-api/v1/livestats` bate
no primeiro rewrite e vira `https://zephyrprotocol.com/api/v1/livestats` ANTES de
chegar no catch-all? E um F5 em `/meu-rig` (sem bater em nenhum arquivo estático real)
cai no segundo rewrite e serve `index.html`? Se qualquer uma das duas perguntas não for
um "sim" óbvio lendo o arquivo, ajuste antes de dar como pronto.

### Depois do D1

Rodar o checklist manual da seção 5 do prompt (Carlos, fora de qualquer sessão
`claude` — é navegação de verdade na URL pública, não comando de terminal). Registrar
o resultado do teste de XMRig HTTPS→HTTP local em NOTES.md assim que rodar, mesmo que
o resultado seja "bloqueado" — a lacuna de conhecimento fecha de qualquer jeito.
Backlog pós-deploy mapeado em `docs/ANALISE-MELHORIAS-2026-07-11.md`: K1Pool via o
mesmo rewrite, higiene de localStorage, CI mínimo (build+lint), Vitest pra lógica
pura.
