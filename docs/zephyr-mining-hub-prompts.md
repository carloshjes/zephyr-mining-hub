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

## Prompt 5 — Fable: integração e revisão final

```
Aja como um engenheiro front-end sênior fazendo revisão final de um projeto que teve
cada módulo construído em uma sessão separada, sem memória compartilhada entre elas —
seu trabalho aqui é unificar, não reescrever do zero.

<contexto>
Os 4 módulos do Zephyr Mining Hub (Pulso da Rede, Bússola de Pools, Raio-X da Recompensa,
Monitor do Rig) já existem no repo, construídos em prompts/sessões diferentes. É esperado
ter inconsistência de estilo entre eles.
</contexto>

<tarefa>
1. Revise os 4 módulos e liste em REVIEW.md qualquer inconsistência de: nomenclatura de
   variável/função, tratamento de erro/loading (cada módulo pode ter reinventado o
   próprio jeito de mostrar "carregando"/"erro"), estilo visual (cores, espaçamento,
   tipografia).
2. Unifique os padrões mais divergentes: um único componente de loading/erro reutilizado
   pelos 4 módulos, um único tema no Tailwind config.
3. Finalize a navegação entre os 4 módulos com indicação clara de qual está ativo.
4. Adicione uma página inicial simples explicando em 2-3 frases o que é o Zephyr Mining
   Hub, linkando pros 4 módulos.
5. Rode `npm run build` e garanta que sobe sem erro nem warning novo.
6. Procure por qualquer chamada à Scanner API usando `order=desc` sem `from`/`to`
   explícitos (o Prompt 3 achou e corrigiu um caso não-determinístico exatamente nisso,
   em getLatestBlockReward — ver CLAUDE.md). Se achar outra ocorrência, corrija com a
   mesma âncora por altura.
</tarefa>

<restricoes>
- Não reescreva a lógica de negócio de cada módulo (os fetches, os cálculos) — só a
  camada de apresentação/consistência, a menos que encontre um bug real; nesse caso,
  documente o bug em REVIEW.md antes de corrigir.
- Preserve os critérios de aceite originais de cada módulo — não remova funcionalidade
  pra "simplificar".
</restricoes>

<criterios_de_aceite>
- `npm run build` limpo.
- Os 4 módulos usam o mesmo componente de loading/erro.
- REVIEW.md lista o que foi encontrado e o que foi corrigido.
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
