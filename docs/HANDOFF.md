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

## Onde estamos (verificado por `git log`/`git status` reais em 2026-07-12, não por memória)

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
| R4 (Fable) | Correções de layout + acabamento a partir de 6 screenshots reais do Carlos: rampa da logo sem tom de branco (mist-300 saiu, 4 tons [.40,.29,.21,.10], regenerada via logo-export.mjs), rail 16rem (teto matemático do breakpoint xl) + header mobile 128px, chips da Bússola empilham em coluna + "N workers" nowrap, --text-display 11rem→9rem, legenda duplicada do Raio-X removida, rótulo do piso removido com código morto, scrollbar 8px thumb hairline, TrendSparkline variant bars + pendingBalance como faixa própria, StatusBadge normal vira readout nu (escada nada < tintado < sólido) | ✅ feito, verificado, commitado e enviado | `de6398c` |
| R5 (Fable) | Lapidações finais (sparklines responsivos, chips da Bússola, mobile do Raio-X, gráfico de barras do Rig, below sem caixa, favicon removido) | ✅ feito, verificado, commitado e enviado | `4a2f71a` |
| T1 (Fable) | Tema claro "Azul técnico": 2º conjunto de valores pros mesmos tokens, botão de troca persistente, anti-flash | ✅ feito, verificado, commitado e enviado | `eda8661` |
| N3 (Fable) | Ícone (sol/lua traço mono) no botão de troca de tema, substituindo o texto `[ TEMA · ... ]` | 🟡 rodou (confirmado por screenshot), **AINDA SEM COMMIT** | — |
| G1 (Fable) | Ganhos estimados no Monitor do Rig (1ª composição cross-module: hashrate do rig + da rede + recompensa + preço) | 🟡 rodou (`src/modules/rig/earnings.ts` existe, RigDashboard.tsx modificado), **AINDA SEM COMMIT** | — |
| R6 (Fable) | 3 achados de screenshot: rótulo DARK/WHITE no botão de tema, largura do parágrafo da Bússola = largura da tabela, rodapé com coração pixelado + endereço de doação | 🟡 rodou (confirmado por screenshot), **AINDA SEM COMMIT** | — |
| R7 (Fable) | Corrige alinhamento ícone/rótulo do ThemeToggle (translate-y-px, correção óptica medida), troca sol/lua pra técnica pixelada (grade 11×11, mesma família do PixelHeart), simplifica o rodapé (remove disclaimer, endereço completo sem truncar/sem botão, fonte e coração maiores) | ✅ feito, verificado, commitado e enviado | `39f3f6f` |
| 5 (Fable) | Integração final | 📝 **prompt REESCRITO em 2026-07-12** (absorve `docs/AUDITORIA-ESTRUTURA-2026-07-12.md` + achados do code-audit-cleanup) — pronto pra colar, ver `docs/zephyr-mining-hub-prompts.md` | — |
| EN1 | Tradução pro inglês (hardcode, sem i18n) | ✅ **RODOU** (confirmado: CLAUDE.md/NOTES.md já refletem a tabela PT→EN e o locale `en-US`) — **AINDA SEM COMMIT** | — |
| — | Prompt de deploy no Vercel | ⬜ ainda não escrito | — |
| — | Skill `backend-structure-auditor` | ✅ **rodou 2026-07-12** — `docs/AUDITORIA-ESTRUTURA-2026-07-12.md`, 4 achados [Baixo]/[Médio], zero bug | — |
| — | Skill `code-audit-cleanup` | 🟡 **rodou 2026-07-12, parcial** — aplicou só a consolidação de `ATOMS_PER_ZEPH`; os outros 3 achados viraram itens do Prompt 5 reescrito (exigiam decisão de arquitetura pequena ou e2e real pra verificar com confiança) | — |

**Pendência de git ATIVA — a mais recente (2026-07-12, depois do R7 já commitado em
`39f3f6f`):** o EN1 (tradução completa) + a auditoria de estrutura +
`code-audit-cleanup` + a reescrita do Prompt 5/deste HANDOFF rodaram TODOS sem commit
entre eles — `HEAD` segue em `39f3f6f`. `git status` mostra a lista inteira de
arquivos tocados (quase todo `src/`, mais `CLAUDE.md`/`NOTES.md`/`docs/`) — alguns
aparecem como "deleted" E "untracked" ao mesmo tempo (índice inconsistente do mount do
sandbox, mesmo fenômeno das lições abaixo; conferido por `Read` direto em
`RigDashboard.tsx`/`vite.config.ts`: os dois existem intactos, não é perda real).
Recomendação: commitar tudo junto AGORA, antes de rodar o Prompt 5, numa PowerShell
limpa fora de qualquer sessão `claude`:
```
git add -A
git commit -m "prompt EN1: traducao pro ingles + auditoria de estrutura + code-audit-cleanup + prompt 5 reescrito"
git push
```

**Pendência de git — histórica, já resolvida (2026-07-12, N3 + G1 + R6):** rodaram em
sequência sem commit entre sessões — `git status` confirma working tree com CLAUDE.md, NOTES.md,
scripts/contrast-check.mjs, scripts/theme-e2e.mjs, src/components/layout/AppShell.tsx,
src/modules/pools/PoolsPage.tsx, src/modules/rig/RigDashboard.tsx modificados +
src/modules/rig/earnings.ts novo — TUDO isso ainda só no disco, `HEAD` continua em
`eda8661` (T1). Isso quebrou a regra 2 (commit imediato depois de cada prompt) três
vezes seguidas — risco real de perda (mesmo caso do Prompt 2, ver regra 2 abaixo).
Como o N3 ficou embutido dentro do AppShell.tsx que o R6 já editou por cima, não dá
pra separar os dois em commits limpos sem `git add -p` (arriscado numa PowerShell
comum) — recomendação: **commitar TUDO junto agora, antes de rodar o R7**, com uma
mensagem que liste os três prompts. Sugestão de comando (rodar numa PowerShell limpa,
regra 5):
```
git add -A
git commit -m "prompts N3 + G1 + R6: icone de tema, ganhos estimados no rig, rotulo DARK/WHITE + rodape de doacao"
git push
```
Depois disso, retomar o commit-por-prompt normalmente a partir do R7.

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

**Lição nova (2026-07-12): 3 arquivos truncados de verdade no working tree ao abrir
este chat** (`index.html`, `src/modules/rig/RigDashboard.tsx`,
`docs/zephyr-mining-hub-prompts.md` — cada um cortado no meio de uma linha, sem
conteúdo novo real, só deleção do final do arquivo). Diferente da lição acima: aqui
NÃO era ilusão de stat cache — `wc -l`/`tail` confirmaram por CONTEÚDO que os arquivos
estavam mesmo menores e cortados a meio de token (ex.: index.html parava no meio de
`<script>`). Causa provável: a sessão anterior deste chat (que "ficou lotada") travou
ou foi cortada no meio de uma escrita. Tentativa de correção com `git checkout -- ` deu
`error: unable to unlink old '<arquivo>': Operation not permitted` — o mount do sandbox
não permite o padrão unlink+rename que `git checkout` usa. **Fix que funcionou:**
`git show HEAD:<arquivo> > <arquivo>` (sobrescreve por truncate+write, não por unlink) —
restaurou os 3 arquivos byte a byte iguais ao HEAD, confirmado por `git status` limpo
depois. Regra pro futuro: se `git checkout`/`git restore` falhar com "unable to unlink"
neste sandbox, use `git show HEAD:<path> > <path>` em vez de insistir no checkout.

**CORREÇÃO IMPORTANTE (2026-07-12, mesmo dia, achado ao revisar o R7):** o
diagnóstico acima ("3 arquivos truncados de verdade") provavelmente estava ERRADO
na causa, não no sintoma. Reproduzido ao vivo: depois do R7 rodar, `wc -l`/`tail -c`/
`git diff` via `mcp__workspace__bash` mostraram `docs/HANDOFF.md`, `docs/zephyr-mining-hub-prompts.md`
e `src/components/layout/AppShell.tsx` cortados no meio de palavra — mesmíssimo
sintoma de antes. Mas o `Read` (ferramenta de arquivo, caminho Windows) nos MESMOS
arquivos, no mesmo instante, mostrou os três **completos e corretos**. Ou seja: o
mount Linux que o `mcp__workspace__bash` enxerga pode ficar com uma view DEFASADA
(cache de leitura atrás do disco real), e ISSO produz o padrão exato de "arquivo
cortado no meio" — não é o arquivo real que está truncado, é a LEITURA pelo bash
que está atrasada. Isso inclui `git diff`/`git status` rodados via bash: eles também
leem por esse mesmo mount, então também podem "ver" truncamento que não existe.
**Regra corrigida: NUNCA conclua truncamento/corrupção só por `mcp__workspace__bash`
(tail/wc/git diff/git status). Confirme sempre com a ferramenta `Read` (ou `Write`)
antes de tratar algo como corrompido ou de "restaurar" via `git show HEAD:... >`.**
Efeito colateral em aberto: o fix de `git show HEAD:<path> > <path>` rodado na
sessão anterior deste chat (index.html, RigDashboard.tsx, prompts.md) pode ter sido
um no-op inofensivo (sobrescreveu HEAD com o próprio HEAD) — não tem como confirmar
retroativamente, mas não há indício de que algo tenha sido perdido de verdade.

**Confirmação da lição de 2026-07-09 (índice inconsistente), reproduzida em
2026-07-12 logo após o commit do R7 (`39f3f6f`):** `git status` mostrou ~14
arquivos (vite.config.ts, tsconfig*.json, todo o módulo rig/, parte do rewards/)
como "deleted" (staged, coluna D) E "untracked" (??) AO MESMO TEMPO, mais uma
linha `AD ./` sem sentido. Conferido por `Read` direto (vite.config.ts,
RigDashboard.tsx): conteúdo intacto e correto nos dois. Mesmo diagnóstico de
antes — índice temporariamente inconsistente, provavelmente por escrita
concorrente (sessão `claude` ainda aberta) — SEM perda real. Não precisa de ação
além de fechar sessões `claude` abertas antes do próximo commit.

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
8. ~~Prompt R4~~ — rodou, verificado, **commitado e enviado** (`de6398c`).
8b. **Prompt R5 (lapidações finais)** — escrito em 2026-07-11 a partir de 5
   screenshots do build R4, com 2 adendos checados depois: sparkline do /rede em
   largura responsiva, chips da Bússola (maior hashrate ao lado do nome, menor
   fee abaixo do chip), SegmentedControl mais fino no mobile + scrollbar neutra
   (token decorativo novo, croma zero), faixa do saldo pendente SAI do rig +
   barras maiores/responsivas com tratamento visual novo (latitude da skill),
   estado below do rig padronizado na anatomia de readout nu do normal (desvio
   deliberado da escada do R4 — texto/halo viram o canal não-cor), favicon
   removido (novo ícone virá do Carlos depois). **Rodou, verificado e
   commitado** (`4a2f71a`).
8c. **Prompt T1 (tema claro white/blue)** — paleta "A · Azul técnico" (matiz
   ≈217°, fundo neutro #f7f7f7) escolhida pelo Carlos entre 3 candidatas em
   2026-07-11. Override [data-theme='light'] dos mesmos tokens, escuro segue
   default, botão mono `[ TEMA · … ]` no rail e no bloco mobile, contrast-check
   estendido, design-shots ×2 temas. **Rodou, verificado e commitado**
   (`eda8661`).
8d. **Prompt N3 (ícone de tema)** — escrito em 2026-07-12 neste chat, depois de
   rodar a skill `creative-ui-director` (3 direções avaliadas: traço mono
   sol/lua, extensão dot-matrix da logo, glifo compacto em colchetes — Carlos
   escolheu traço mono). Troca o texto `[ TEMA · ESCURO ]` por um ícone SVG à
   mão, sem lib nova. Pronto pra colar, independente da fila principal.
8e. **Prompt G1 (ganhos estimados no Rig)** — escrito em 2026-07-12 neste chat,
   depois de rodar a skill `project-direction-scout` (4 direções avaliadas:
   ganhos estimados, comparação com rede/pool, recorde pessoal, não preencher —
   Carlos escolheu ganhos estimados). Preenche o vão vazio da coluna dominante
   do Monitor do Rig cruzando hashrate do rig + hashrate da rede + recompensa +
   preço — primeira composição cross-module do produto. Pronto pra colar,
   sessão própria (não junto do N3).
8f. **Prompt R6 (achados de screenshot pós-N3)** — escrito em 2026-07-12 neste
   chat a partir de 2 screenshots reais do Carlos (Pulso da Rede e Bússola,
   tema claro). Depende do N3 já commitado (parte do botão só-ícone). Três
   itens independentes: rótulo `[ DARK ]`/`[ WHITE ]` ao lado do glifo do
   ThemeToggle (inglês de propósito, grafia exata pedida pelo Carlos), largura
   do parágrafo de luck/effort da Bússola igualada à da tabela, e rodapé
   trocando a lista de fontes de API por um endereço de carteira pra doação
   ladeado por um coração pixelado (técnica de pontos do LogoMark, sem
   emoji/ícone de lib) — manteve a frase "sem afiliação oficial" por conta
   própria (não pedida explicitamente; ver nota abaixo). Pronto pra colar.
**Nota sobre o R6 (julgamento deste chat, não instrução literal do Carlos):** o
pedido original era só "retire a linha de fontes e coloque o endereço de doação".
O prompt manteve a fração "sem afiliação oficial" da linha antiga — o produto usa
cor/logo de marca da Zephyr, então essa frase é o que deixa claro pro visitante
que não é o site oficial; sem ela, a lacuna de confiança parece maior que o custo
de manter uma frase curta. Se o Carlos preferir a remoção total, é um ajuste de
uma linha no prompt antes de colar.

9. ~~Rodar as skills `backend-structure-auditor` e `code-audit-cleanup`~~ — feito
   2026-07-12 (chat Cowork, via Skill tool). `backend-structure-auditor` completo:
   `docs/AUDITORIA-ESTRUTURA-2026-07-12.md`, 4 achados. `code-audit-cleanup`
   parcial: aplicou só `ATOMS_PER_ZEPH` (consolidado em `emission.ts`); os outros
   3 achados viraram itens do Prompt 5 reescrito (ver item 11) — detalhe em
   NOTES.md, seção "Auditoria de estrutura + code-audit-cleanup + reescrita do
   Prompt 5".
10. ~~Tradução pro inglês~~ — **RODOU** (EN1). CLAUDE.md/NOTES.md já refletem a
    tabela PT→EN dos 4 módulos e a decisão de locale (`DISPLAY_LOCALE = 'en-US'`).
    Rotas continuam em português (`/rede`, `/pools`, etc. — decisão desta rodada,
    tradução de rota fica pra outro prompt se o Carlos quiser).
    **AINDA SEM COMMIT** — ver pendência de git no topo deste arquivo.
11. ~~Prompt 5 (integração final) — REESCREVER antes de colar~~ — **feito
    2026-07-12** (chat Cowork). A versão em `docs/zephyr-mining-hub-prompts.md`
    remove os 3 itens já resolvidos (loading/erro, nav ativa, tema — agora 2
    temas) e absorve: README.md desatualizado, ErrorBoundary por módulo (não
    existe nenhum — erro de render vira tela branca), varredura order=desc, os 2
    lint warnings herdados do N2, e os 3 achados da auditoria de estrutura que o
    code-audit-cleanup não aplicou (constantes cross-module, hook
    `useFailingSources`, hook de chart hover). Mantém o redirect `/` → `/rede`
    (decisão do Carlos — sem página inicial nova). **Pronto pra colar** — só
    falta commitar o que está pendente (ver topo deste arquivo) antes de abrir a
    sessão do Fable.
12. Escrever o prompt de deploy no Vercel — **ainda não existe**. Além do rewrite
    do proxy (`/zephyr-api/(.*)` → `zephyrprotocol.com/api/$1`), precisa de
    fallback de SPA (catch-all → index.html, DEPOIS do rewrite da API, senão
    deep-link em /pools dá 404) e do teste pendente de Local Network Access
    (página pública https → XMRig local). Detalhe na seção 3 da análise.
13. Pós-deploy (backlog mapeado em `docs/ANALISE-MELHORIAS-2026-07-11.md`):
    K1Pool via o mesmo rewrite (destravada pelo deploy), higiene de localStorage,
    CI mínimo (build+lint), Vitest pra lógica pura (emission/format/históricos).
