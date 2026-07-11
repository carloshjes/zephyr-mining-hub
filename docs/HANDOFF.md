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

## Onde estamos (verificado por `git log`/`git status` reais em 2026-07-10, não por memória)

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
| 5 (Fable) | Integração final | ⬜ não iniciado — entra depois da tradução pro inglês | — |
| — | Tradução pro inglês | ⬜ sessão separada, depois do R2 (não escrita ainda) | — |
| — | Prompt de deploy no Vercel | ⬜ ainda não escrito | — |
| — | Skills (auditoria/limpeza/visual) | ⬜ não rodadas | — |

**Achado e corrigido nesta sessão (2026-07-10):** `CLAUDE.md` teve DOIS incidentes de
truncamento/duplicação no working tree (seção "Riscos conhecidos" sumindo, depois
duplicada) — provável efeito colateral de edits concorrentes entre este chat e o Fable.
Restaurado/limpo pela segunda vez; se aparecer de novo, o conteúdo correto está no
CLAUDE.md commitado + nas seções refletidas aqui e em NOTES.md.

**Pendência de git RESOLVIDA (atualização 2026-07-10, chat novo):** o que a seção acima
descrevia como pendente já foi feito por Carlos entre o fim daquele chat e o início
deste — confirmado agora por `git status`/`git log`/`git fetch` reais (não por memória):
working tree limpo, `HEAD` = `origin/main` = `015d0b1` ("prompt L2 + R2: logo integrada e
Sinal Tecnico v2"), 0 commits de diferença. Um commit só cobriu L2+R2 juntos (29
arquivos). Conteúdo conferido por amostragem: tokens `--color-good: #22c55e` /
`--color-bad: #f97316` e zeph recalibrado (`#9c96f5`/`#665fc4`) presentes em
`src/index.css`; zero uso residual de cor "alert" (só sobrou `role="alert"` semântico e
nomes de teste como `ratio-alert-segment`, sem relação com cor). `npm run build` não pôde
ser reconferido nesta sessão (sandbox Linux; os binários nativos instalados no projeto são
Windows-only — `rolldown`/`lightningcss`/`oxlint` `-win32-x64-msvc`) — não é regressão, é
limite deste ambiente; o Fable já tinha relatado build limpo no Windows.

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
   wip + `7f88da7` final, re-verificado em 2026-07-10), **ainda não enviado ao
   GitHub**. Tokens finais e decisões de composição já espelhados em CLAUDE.md/NOTES.md.
3. ~~Prompt L2 (integração da logo)~~ — rodou (favicon zeph-300, logo no header).
4. ~~Prompt R2 (Sinal Técnico v2)~~ — rodou (verde/laranja substituindo vermelho, zeph
   recalibrado, fundo+textura, escala tipográfica, movimento, causa raiz do painel vazio
   corrigida, logo 38px). **L2+R2 commitados e enviados** (`015d0b1`, reconfirmado por git
   real nesta sessão — ver nota acima). Nenhuma ação de git pendente.
5. **Sessão atual do Carlos (chat novo, 2026-07-10):** mais mudanças de layout/front-end,
   escopo ainda não definido — perguntei o que ele quer antes de propor direção nova (não
   assumir que é continuação direta do R2; pode ser outra parte do produto).
6. Tradução pro inglês — sessão separada, prompt ainda não escrito; melhor depois do
   item 5 (senão traduz uma UI que muda de novo em seguida).
7. Prompt 5 (integração final) — já pronto em `docs/zephyr-mining-hub-prompts.md`, mas só
   depois dos itens 5 e 6 (senão revisa uma UI/texto que muda de novo logo em seguida).
8. Escrever o prompt de deploy no Vercel — **ainda não existe**, mesmo estilo dos
   outros (ver `docs/guia_conversar_com_llm.md`); parte do rewrite já usado em
   `vite.config.ts`.
9. Rodar as skills `backend-structure-auditor` e `code-audit-cleanup` — via Skill tool
   deste chat, não via Claude Code.
