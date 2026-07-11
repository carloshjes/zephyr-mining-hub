# Análise do projeto + mapa de melhorias (2026-07-11)

Elaborada no chat Cowork (planejamento — este chat não edita código, só constrói
prompts pro Fable). Base: leitura de CLAUDE.md, NOTES.md, README.md, docs/ completo
e varredura real do código/git em 2026-07-11. Contexto do momento: **R4 em execução
no Fable agora** — nada aqui conflita com o escopo do R4.

## 1. Estado atual (verificado, não de memória)

- 13 commits, `HEAD` = `origin/main` = `0c11837` (R3). Working tree: só
  `docs/HANDOFF.md` e `docs/zephyr-mining-hub-prompts.md` modificados (a escrita do
  prompt R4 — commitam junto com o R4 ou logo após).
- 4 módulos prontos e verificados (Prompts 1–4), design system "Sinal Técnico" na
  v3 (R1→R2→R3), logo integrada com cintilância (L1/L2/N1/N2). Suíte e2e completa
  verde em 2026-07-11, build limpo.
- ~5.000 linhas de src/, bundle único de ~312 KB (JS) + 30 KB (CSS). Sem
  dependência de runtime além de react/react-dom/react-router-dom — superfície de
  manutenção pequena, deliberada.

### Forças (o que preservar)

- **Disciplina de verificação**: nada é assumido — CORS, formatos de API, contraste,
  reduced-motion e até tamanho de logo foram medidos com script/captura. O NOTES.md
  é rastreável ao ponto de reproduzir cada bug (âncora duplicada, rótulo do piso a
  0,07 px da borda).
- **Camada de dados defensiva**: armadilhas reais documentadas e encapsuladas
  (order=desc não-determinístico, off-by-one da altura, campo ausente vira "—",
  âncora compartilhada). É o maior ativo técnico do projeto.
- **Design system tokenizado de verdade**: zero hex solto, contraste medido por
  script, animação sempre pareada com reduced-motion, e2e checando cor computada.
- **Processo**: um prompt = uma sessão, commit imediato, CLAUDE.md como memória
  compartilhada. As lições de git (locks, CRLF, push silencioso) estão registradas.

## 2. Caminho crítico já planejado (ordem do HANDOFF, mantida)

1. **R4** — em execução. Ao terminar: fechar a sessão, commitar em PowerShell limpa
   (regras 5/6), colher o relato.
2. **Tradução pro inglês** — prompt a escrever. Decisão a tomar antes: hardcode
   em inglês (simples, público cripto é global) vs. i18n leve pt/en (custo de
   manutenção que o projeto talvez não precise). Recomendação: hardcode inglês,
   registrar a decisão no CLAUDE.md.
3. **Prompt 5 (integração final) — precisa de REESCRITA antes de colar.** Foi
   escrito antes do R1–R3 e envelheceu: dos 6 itens, três já foram feitos há muito
   (loading/erro compartilhado existe desde o Prompt 1; navegação com rota ativa
   existe desde R1/N1; tema único existe desde R1). Sobram: REVIEW.md de
   inconsistências entre módulos, página inicial (decidir se ainda faz sentido —
   hoje `/` redireciona pra `/rede`, o que é defensável), e a varredura por
   `order=desc` sem from/to. Proposta: absorver no Prompt 5 revisado os itens 4.1,
   4.2 e 4.3 abaixo.
4. **Deploy no Vercel** — prompt a escrever (item 5 do HANDOFF). Ver seção 3, é
   mais sutil do que parece.
5. **Skills de auditoria** (`backend-structure-auditor` + `code-audit-cleanup`) —
   rodar NESTE chat via Skill tool, depois do R4 commitado (auditar working tree
   em mudança gera ruído).

## 3. Prompt de deploy — pontos que o prompt PRECISA cobrir (mapeados agora)

- **Rewrite do proxy**: `vercel.json` com `/zephyr-api/(.*)` →
  `https://zephyrprotocol.com/api/$1` (equivalente ao proxy do Vite; não existe
  ainda — confirmado, não há vercel.json no repo).
- **Fallback de SPA**: descoberta desta análise — além do proxy, o React Router
  precisa de rewrite catch-all (`/(.*)` → `/index.html`), senão deep-link em
  `/pools` etc. dá 404 no Vercel. **A ordem importa**: o rewrite do zephyr-api tem
  que vir ANTES do catch-all, senão o catch-all engole a API.
- **Teste pós-deploy do XMRig**: a pendência real registrada desde o Prompt 4 —
  página PÚBLICA https → `http://127.0.0.1` depende da política de Local Network
  Access do Chrome e só é testável com o deploy de verdade. O prompt deve exigir
  esse teste e registrar o resultado no NOTES.md (a UI já degrada graciosamente).
- **Verificação de produção**: os 4 módulos com dado real no domínio público,
  favicon, meta description, e conferir que o cache de 30 s da Scanner API
  atravessa o rewrite sem duplicar polling.

## 4. Melhorias novas identificadas (fora do plano atual)

Por prioridade; cada uma é candidata a prompt curto ou a item de prompt existente.

### 4.1 README.md desatualizado (custo mínimo, embaraço real)
Ainda lista Bússola/Raio-X/Monitor como "🚧 placeholder" (parou no Prompt 1) e não
menciona design system, scripts e2e, design-shots nem docs/. É a porta de entrada
do repo público. → Absorver no Prompt 5 revisado.

### 4.2 Sem ErrorBoundary (robustez, contradiz uma convenção do projeto)
Confirmado por grep: nenhum ErrorBoundary no src/. Um throw em render de qualquer
componente derruba a árvore React inteira → tela em branco, exatamente o que a
convenção "erro sempre visível, nunca tela em branco" proíbe. A camada de REDE é
defensiva, mas erro de RENDER não tem rede de proteção. → Um ErrorBoundary por
módulo na casca (4 rotas), com a mesma linguagem visual de erro (`[ FALHA ]`).
Absorver no Prompt 5 revisado.

### 4.3 Varredura order=desc + lint warnings herdados
O Prompt 5 original já pedia a varredura; somar a limpeza dos 2 warnings de lint
pré-existentes registrados no N2 (logo-shots.mjs e SeriesSwatch.tsx). → Prompt 5.

### 4.4 K1Pool destravada pelo deploy (produto, pós-deploy)
O TODO em `pools.ts` diz "integrar só com proxy" — o MESMO rewrite do Vercel que
resolve a Scanner API resolve a K1Pool (`k1pool.com/api/stats/zeph`, JSON válido
sem CORS, confirmado). → Prompt curto pós-deploy: 3ª pool na Bússola (e avaliar no
dropdown do Rig se a API por minerador dela existir — sondar antes, método de
sempre). MiningOcean/RavenMiner continuam inviáveis (protobuf/SSE; DNS instável).

### 4.5 CI mínimo (qualidade, custo baixo)
Os e2e são scripts CDP manuais (Edge/Windows, APIs vivas) — não portam pra CI, e
tudo bem. Mas build+lint portam: GitHub Actions rodando `npm ci && npm run build
&& npm run lint` pega regressão de build/type em cada push. O repo já está no
GitHub; o Vercel vai buildar por conta própria de qualquer forma (o CI só
antecipa o erro). → Prompt curto, qualquer momento pós-deploy.

### 4.6 Testes unitários pra lógica pura (qualidade, médio)
Zero teste unitário. A lógica mais crítica é pura e trivialmente testável:
`emission.ts` (projeção do halving), `format.ts`, `rewardSeries.ts`, o motor
genérico de histórico (gap/cap) e a âncora compartilhada. Vitest entra sem tocar
o build. Os e2e cobrem integração, mas dependem do estado do mundo real (a ordem
de hashrate das pools já é uma fragilidade documentada). → Prompt dedicado,
prioridade abaixo do deploy.

### 4.7 Higiene de localStorage (menor)
Cinco stores versionados `.v1` coexistem. Trocar carteira/pool acumula chaves
órfãs de histórico pra sempre (chave inclui poolId:wallet). Sem migração nem
poda. Impacto baixo (~KB), mas é dívida que cresce silenciosa. → Item pequeno
num prompt futuro (talvez junto do 4.4).

### 4.8 Code-splitting por rota (opcional, avaliar e provavelmente recusar)
Bundle único de 312 KB é aceitável pra dashboard; React.lazy por módulo pouparia
~pouco e adicionaria estado de loading por rota. Registrar como decisão
consciente ("não vale") em vez de deixar como pergunta aberta.

### 4.9 NOTES.md com 1.141 linhas (processo, menor)
Vai continuar crescendo a cada prompt. Quando incomodar: índice no topo ou split
por era (fundação / design system / pós-deploy). Não fazer agora — o arquivo
ainda funciona como está e split quebraria referências ("ver NOTES.md").

## 5. Ordem recomendada consolidada

| # | Ação | Via | Status |
|---|------|-----|--------|
| 1 | R4 | Fable (rodando) | ⏳ |
| 2 | Commit do R4 + relato | Carlos | — |
| 3 | Skills de auditoria (base limpa pós-R4) | Este chat | prompt não precisa |
| 4 | Escrever + rodar prompt de tradução (inglês hardcode) | Este chat → Fable | prompt a escrever |
| 5 | REESCREVER Prompt 5 (absorve 4.1, 4.2, 4.3) + rodar | Este chat → Fable | reescrita pendente |
| 6 | Escrever + rodar prompt de deploy Vercel (seção 3) | Este chat → Fable | prompt a escrever |
| 7 | K1Pool via rewrite + higiene de localStorage (4.4 + 4.7) | Fable | pós-deploy |
| 8 | CI mínimo (4.5) e Vitest (4.6) | Fable | pós-deploy |
| 9 | 4.8/4.9 | — | registrar decisão, não executar |

Nota de sequência: as auditorias (3) subiram pra antes da tradução de propósito —
achados delas alimentam a reescrita do Prompt 5, e auditar ANTES de traduzir evita
retrabalho em texto que muda.

Nota de git: este arquivo é novo em docs/ — commitar junto com a sincronização de
HANDOFF/prompts.md, separado do commit do R4.
