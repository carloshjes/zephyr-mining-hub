# Zephyr Mining Hub — Handoff pro chat novo (leia isto primeiro)

Este documento existe porque o chat anterior ficou grande demais e o usuário (Carlos)
abriu um novo. Você (Claude, chat novo) está entrando no meio de um projeto em
andamento — este arquivo é o seu contexto operacional. Os outros dois arquivos deste
`docs/` e o `CLAUDE.md`/`NOTES.md` na raiz do repo são o contexto técnico. Leia os
quatro antes de fazer qualquer coisa; não assuma nada que não esteja escrito neles.

## O projeto, em uma frase

Dashboard web (Zephyr Mining Hub) pra comunidade de mineradores da criptomoeda Zephyr
(ZEPH, algoritmo RandomX, minerada via XMRig) — 4 módulos: Pulso da Rede, Bússola de
Pools, Raio-X da Recompensa, Monitor do Rig. Repo:
https://github.com/carloshjes/zephyr-mining-hub. Deploy planejado: Vercel (não GitHub
Pages — motivo: a Zephyr Scanner API bloqueia CORS no navegador e só um host com
rewrite resolve isso sem backend próprio).

## Quem faz o quê

- **Você (este chat, app Claude Desktop/Cowork, modelo Claude Sonnet 5)** não escreve
  código — de propósito, não por limitação. Seu trabalho é: decidir arquitetura/direção,
  escrever os prompts que o Carlos cola no Claude Code, manter
  `docs/zephyr-mining-hub-prompts.md` e o `CLAUDE.md` do repo sincronizados com a
  realidade, revisar os relatos de progresso que ele traz, e dizer quando/o que
  commitar. Fique em Sonnet aqui — não precisa (nem deve) trocar pra Fable neste chat;
  Fable é só pra sessão de CLI que aplica código. Isso também poupa o limite de uso da
  conta Pro do Carlos pro que realmente importa (as sessões de código).
- **Claude Fable 5, via Claude Code CLI, rodando na máquina do Carlos** escreve o
  código de verdade. Uma sessão nova (`claude` num terminal) por prompt/módulo — nunca
  acumular dois módulos numa sessão só (context rot + perde o checkpoint granular do
  commit).
- **Carlos** (1º semestre de Ciência da Computação, UFFS Erechim) cola os prompts,
  roda os comandos de git que você especificar, e reporta de volta o que o Fable fez.
- GLM-5.2 estava planejado como segundo modelo (mais barato pra volume), mas está
  pausado por falta de assinatura ativa da Z.ai — tudo roda no Fable por enquanto.
  Nenhum prompt depende de qual modelo executa; se o GLM voltar, os prompts 2-4
  funcionam do mesmo jeito.

## Onde estamos (verificado por `git log`/`git status` reais em 2026-07-11, não por memória)

| # | Módulo | Status | Commit |
|---|--------|--------|--------|
| 1 (Fable) | Fundação + Pulso da Rede | ✅ feito, commitado, enviado | `65be1b2` |
| 2 (Fable) | Bússola de Pools | ✅ feito, commitado, enviado | `57044c9` |
| 3 (Fable) | Raio-X da Recompensa | ✅ feito, commitado, enviado | `21de8e5` |
| 4 (Fable) | Monitor do Rig | ✅ feito, commitado, enviado | `eb18d89` |
| R1 (Fable) | Redesign visual "Sinal Técnico" | ✅ feito, commitado, enviado | `c2bc9e7` (wip) + `7f88da7` (final) |
| L1 (Fable) | Logo "Z" dot-matrix (exploração) | ✅ feito — F3 "sem branco" escolhida por Carlos (2026-07-10), commitado e enviado | `1168568` |
| L2 (Fable) | Logo — integração no produto (AppShell + favicon) | ✅ feito (favicon em zeph-300, logo — depois bumpado a 38px pelo R2), commitado e enviado | `015d0b1` |
| R2 (Fable) | Sinal Técnico v2: good/laranja (vermelho saiu), zeph recalibrado a ≈244°, fundo neutralizado + textura, escala tipográfica (9 tokens), movimento nos gráficos, causa raiz do painel vazio corrigida, logo 38px | ✅ feito — suíte e2e verde (rewards/rig/pools), `npm run build` limpo (relato do Fable), CLAUDE.md/NOTES.md atualizados, commitado e enviado | `015d0b1` |
| N1 (Fable) | Casca de navegação vira rail vertical (logo 128px) | ✅ feito, commitado e enviado | `3eb7d97` |
| N2 (Fable) | Cintilância da logo (95/288 pontos, 3 fases) + recomposição mobile do rail (logo 96px, nav em grade 2×2) | ✅ feito, commitado e enviado | `e785e82` |
| R3 (Fable) | Sinal Técnico v3: fundo mais claro + textura de blocos com movimento, --text-headline/--text-display recalibrados, halving vira readout, sparkline de hashrate de rede (novo, `networkHashrateHistory.ts` + `TrendSparkline.tsx` generalizado de `LuckSparkline`), chips da Bússola com fundo sólido, faixas do Raio-X com respiração de opacidade, RESERVE RATIO com bg-ink-900, fix do rótulo do piso (medido: 0,07 px da borda antes do fix, flip dinâmico depois), scrollbar/botões estilizados, StatusBadge do Rig com fundo tintado + halo no estado normal, gráfico de hashrate 24h no Rig (payments sondado ao vivo — 2Miners confirmou CORS+formato, HeroMiners não; regra "as duas ou nenhuma" descartou payments) | ✅ feito, verificado e commitado | `0c11837` |
| R4 (Fable) | Correções de layout + acabamento a partir de 6 screenshots reais do Carlos: rampa da logo sem tom de branco (mist-300 saiu, 4 tons [.40,.29,.21,.10], regenerada via logo-export.mjs), rail 16rem (teto matemático do breakpoint xl) + header mobile 128px, chips da Bússola empilham em coluna + "N workers" nowrap, --text-display 11rem→9rem, legenda duplicada do Raio-X removida, rótulo do piso removido com código morto, scrollbar 8px thumb hairline, TrendSparkline variant bars + pendingBalance como faixa própria, StatusBadge normal vira readout nu (escada nada < tintado < sólido) | ✅ feito e verificado 2026-07-11 (e2e completa verde com 3 checks novos no pools-e2e + 1 contrato alterado no lowratio, build limpo, relato revisado por conteúdo neste chat) — **commit pendente**, working tree pronto | (preencher hash após o commit) |
| 5 (Fable) | Integração final | ⬜ não iniciado — entra depois da tradução pro inglês | — |
| — | Tradução pro inglês | ⬜ sessão separada, depois do R2 (não escrita ainda) | — |
| — | Prompt de deploy no Vercel | ⬜ ainda não escrito | — |
| — | Skills (auditoria/limpeza/visual) | ⬜ não rodadas | — |

**Pendência de git do N2 (RESOLVIDA, 2026-07-11):** o N2 ficou um tempo só no working
tree (relatado numa sessão anterior deste chat) — Carlos commitou antes de abrir a
sessão do R3, como o próprio prompt exigia. Confirmado por `git log` real: `e785e82`,
`HEAD` = `origin/main`.

**Pendência de git do R3 (RESOLVIDA, 2026-07-11):** o R3 rodou em duas sessões (rate
limit no meio, retomada com `claude --continue`) e ficou um tempo só no working tree —
Carlos commitou logo em seguida. Confirmado por `git log` real: `0c11837`, `HEAD` =
`origin/main`. Nenhuma ação de git pendente até o R4 rodar.

**Achado de sessão anterior (2026-07-10):** `CLAUDE.md` teve DOIS incidentes de
truncamento/duplicação no working tree (seção "Riscos conhecidos" sumindo, depois
duplicada) — provável efeito colateral de edits concorrentes entre este chat e o Fable.
Restaurado/limpo; se aparecer de novo, o conteúdo correto está no CLAUDE.md commitado +
nas seções refletidas aqui e em NOTES.md.

**Pendência de git de L2+R2 (RESOLVIDA em sessão anterior, 2026-07-10):** working tree
limpo na época, `HEAD` = `origin/main` = `015d0b1` ("prompt L2 + R2: logo integrada e
Sinal Tecnico v2"). Conteúdo conferido por amostragem: tokens `--color-good: #22c55e` /
`--color-bad: #f97316` e zeph recalibrado (`#9c96f5`/`#665fc4`) presentes em
`src/index.css`; zero uso residual de cor "alert". `npm run build` não pôde ser
reconferido nesta sessão nem nas seguintes (sandbox Linux; os binários nativos instalados
no projeto são Windows-only — `rolldown`/`lightningcss`/`oxlint` `-win32-x64-msvc`) — não
é regressão, é limite deste ambiente; o Fable já tinha relatado build limpo no Windows.

**Lição nova (2026-07-11, revisão do R4 neste chat): `git status`/`git diff` rodados
do sandbox do Cowork sobre a pasta montada podem MENTIR.** Observado ao vivo: o diff
mostrava src/ limpo com o R4 INTEIRO no working tree — o índice do git guarda cache
de stat (mtime/tamanho) gravado no Windows, e o mount do sandbox apresentou metadados
defasados que batiam com o cache (ex.: AppShell.tsx com conteúdo R4 mas mtime
pré-R4), então o git pulou a comparação de conteúdo. Confirmação da verdade foi por
CONTEÚDO: `git cat-file -p HEAD:<arquivo>` + `git diff --no-index` (50 linhas de
diferença num arquivo que o status dizia limpo). Regra: verificação de estado de git
feita pelo chat Cowork só vale por conteúdo (show/cat-file/hash-object); status/diff
confiáveis só rodados no Windows, pelo Carlos.

## Lições da sessão de 2026-07-09 (git + sessão do Fable concorrente)

Dois problemas de git apareceram e foram resolvidos nessa sessão — registrados aqui
porque tendem a se repetir:

1. **CRLF/LF fantasma:** sem `.gitattributes`, CLAUDE.md aparecia com quase 100% das
   linhas "mudadas" sem nenhuma mudança de conteúdo real (confirmado com
   `git diff -b`). Fix aplicado: `.gitattributes` com `* text=auto eol=lf` na raiz.
2. **Lock do índice por processo concorrente:** com a sessão do Fable ainda aberta
   depois do relato final, comandos git rodados numa PowerShell separada bateram em
   `Unable to create '.git/index.lock': File exists` repetidas vezes — inclusive com
   o lock reaparecendo em tempo real numa tentativa, confirmando processo ativo (não
   só lock órfão). Sintoma extra observado: `git status` chegou a mostrar arquivos já
   commitados como "deleted" (staged) e "untracked" ao mesmo tempo; conteúdo
   confirmado idêntico ao HEAD byte a byte nos dois casos — nenhum dado perdido, só
   índice temporariamente inconsistente pela escrita concorrente. Ver regra 6 abaixo.

## Arquivos que importam

- **`CLAUDE.md`** (raiz) — contrato de API + convenções do projeto. O Fable lê isso
  automaticamente no início de toda sessão; é a fonte de verdade sobre o que ele já
  sabe. Vem sendo atualizado continuamente com achados reais (CORS por API, bugs de
  endpoint, decisões de arquitetura).
- **`NOTES.md`** (raiz) — histórico narrativo detalhado de cada teste real feito.
  Mais verboso que o CLAUDE.md; útil quando precisar entender o *porquê* de uma
  decisão, não só o *o quê*.
- **`docs/zephyr-mining-hub-prompts.md`** — o plano original: as 4 direções que foram
  unificadas num produto só (não escolhidas separadamente — o Carlos pediu as 4),
  decisões de arquitetura, e os 5 prompts completos (1-3 já executados, 4-5 prontos
  pra colar sem alteração).
- **`docs/guia_conversar_com_llm.md`** — guia de prompt engineering (baseado na doc
  oficial da Anthropic) que orienta o estilo de todo prompt novo que você escrever:
  papel no início, tags XML (`<contexto>`, `<tarefa>`, `<dados_e_apis>`,
  `<restricoes>`, `<criterios_de_aceite>`), contexto + porquê, auto-verificação no
  fim, uma sessão nova por assunto.

## Gotchas técnicos críticos (resumo — detalhe completo no CLAUDE.md/NOTES.md)

- **Zephyr Scanner API bloqueia CORS no navegador**, confirmado por teste real. Nunca
  fetch direto pra `zephyrprotocol.com` — sempre via `src/lib/api/` (proxy do Vite em
  dev, rewrite do Vercel em produção, ainda não escrito).
- **`/blockrewards?order=desc` sem `from`/`to` é não-determinístico** — pode devolver
  um snapshot de semanas atrás como se fosse o mais recente. Sempre ancorar "últimos N
  blocos" por altura (via Explorer API), nunca confiar em order=desc sozinho. Isso já
  causou um bug real no Pulso da Rede, corrigido no Prompt 3.
- **Hashrate/dificuldade de rede não existem no Scanner API** — usar
  `explorer.zephyrprotocol.com/api/networkinfo` (CORS aberto).
- **Pools integradas: só 2Miners e HeroMiners** (CORS confirmado aberto nas duas).
  K1Pool tem API mas sem CORS (precisa proxy), MiningOcean usa protobuf/SSE (sem REST),
  RavenMiner tem endpoint instável/não confirmado. O dropdown do Monitor do Rig
  (Prompt 4) deve oferecer só as duas integradas.
- **XMRig real envia CORS aberto** (confirmado no código-fonte dele) e mixed content
  localhost→127.0.0.1 não trava em dev. **Não testado ainda:** página em HTTPS de
  produção acessando XMRig local em HTTP — o Prompt 4 tem uma restrição pedindo esse
  teste especificamente.

## Como trabalhar daqui pra frente (regras aprendidas na prática, não teoria)

1. Um prompt = uma sessão nova de Claude Code. Nunca combine módulos.
2. Assim que um módulo passar nos critérios de aceite: commit **imediato**, antes de
   qualquer outra coisa, inclusive antes de você revisar o relato a fundo. (Aprendido
   do jeito difícil: um desligamento de computador quase perdeu o trabalho do Prompt 2
   porque ainda não tinha sido commitado.)
3. Quando o Fable descobrir algo que muda o entendimento compartilhado, ele deve
   atualizar o `CLAUDE.md` do repo diretamente (tem feito isso cada vez mais por conta
   própria, sem precisar de instrução explícita). Você deve espelhar a mudança em
   `docs/zephyr-mining-hub-prompts.md` pra manter os dois em sincronia — esse arquivo
   é seu, não do Fable.
4. Ambiente: Windows, PowerShell. Abrir sessão = Explorador de Arquivos na pasta do
   repo → clicar na barra de endereço → digitar `powershell` → Enter → `claude`. O
   modelo já fica salvo em `claude-fable-5` entre sessões. Permissões já configuradas
   em modo `acceptEdits` via `.claude/settings.local.json` (aprova edição de arquivo
   sozinho, ainda pergunta pra comandos como `npm`/`git`).
5. **Comandos git puros (add/commit/push) que você (chat) instrui: rode numa
   PowerShell comum, FORA de qualquer sessão `claude` ativa.** Descoberto na prática:
   pedir pro Fable rodar `git push` dentro da própria sessão dele esbarra num prompt
   de permissão (mesmo em modo `acceptEdits`, que só cobre edição de arquivo, não
   comando) — se o prompt não for respondido, o comando não roda e não dá erro
   visível, só fica pendente silenciosamente. Isso já causou pelo menos duas rodadas
   de "push que não pegou". Instrua sempre: abrir uma PowerShell nova (não a que tem
   `claude` rodando) e rodar os comandos git ali.
6. **Feche a janela/sessão do Fable assim que tiver o relato final, antes de rodar
   qualquer comando git em outra janela.** Reforça a regra 5: uma sessão `claude`
   aberta pode disparar git por conta própria (checagem/revisão interna) mesmo sem
   instrução explícita, e isso colide com comandos rodados em paralelo — já causou
   lock de índice preso e staging inconsistente (regra "Lições da sessão de
   2026-07-09" acima). Ordem seguem: pega o relato → fecha a sessão → só então abre a
   PowerShell limpa pro commit.

## Próximos passos, em ordem

1. ~~Prompt 4 (Monitor do Rig)~~ — feito, commitado, enviado (`eb18d89`).
2. ~~Prompt R1 (Redesign visual "Sinal Técnico")~~ — feito, commitado (`c2bc9e7`
   wip + `7f88da7` final).
3. ~~Prompt L2 (integração da logo)~~ — rodou (favicon zeph-300, logo no header).
4. ~~Prompt R2 (Sinal Técnico v2)~~ — rodou. **L2+R2 commitados e enviados**
   (`015d0b1`).
5. ~~Prompt N1 (rail vertical)~~ — rodou, **commitado e enviado** (`3eb7d97`).
6. ~~Prompt N2 (cintilância + recomposição mobile)~~ — rodou, **commitado e
   enviado** (`e785e82`).
7. ~~Prompt R3 (skill `creative-ui-director`)~~ — rodou em duas sessões (rate
   limit no meio, retomada com `claude --continue`), **verificado e commitado**
   (`0c11837`).
8. ~~Prompt R4~~ — rodou e foi verificado (2026-07-11); **commit pendente** (regras
   5/6: fechar a sessão do Fable, PowerShell limpa, add/commit/push).
9. Rodar as skills `backend-structure-auditor` e `code-audit-cleanup` — via Skill
   tool do chat Cowork, não via Claude Code. Subiu pra ANTES da tradução de
   propósito: os achados alimentam a reescrita do Prompt 5 e auditar antes de
   traduzir evita retrabalho em texto que muda.
10. Tradução pro inglês — sessão separada, prompt ainda não escrito. Decisão
    recomendada: inglês hardcode (sem i18n), registrar no CLAUDE.md.
11. Prompt 5 (integração final) — **REESCREVER antes de colar**: foi escrito antes
    do R1–R3 e metade dos itens já foi feita (loading/erro compartilhado, navegação
    com rota ativa, tema único). A reescrita absorve: README.md desatualizado,
    ErrorBoundary por módulo (não existe nenhum — erro de render vira tela branca),
    varredura order=desc e os 2 lint warnings herdados do N2. Detalhe em
    `docs/ANALISE-MELHORIAS-2026-07-11.md`.
12. Escrever o prompt de deploy no Vercel — **ainda não existe**. Além do rewrite
    do proxy (`/zephyr-api/(.*)` → `zephyrprotocol.com/api/$1`), precisa de
    fallback de SPA (catch-all → index.html, DEPOIS do rewrite da API, senão
    deep-link em /pools dá 404) e do teste pendente de Local Network Access
    (página pública https → XMRig local). Detalhe na seção 3 da análise.
13. Pós-deploy (backlog mapeado em `docs/ANALISE-MELHORIAS-2026-07-11.md`):
    K1Pool via o mesmo rewrite (destravada pelo deploy), higiene de localStorage,
    CI mínimo (build+lint), Vitest pra lógica pura (emission/format/históricos).
