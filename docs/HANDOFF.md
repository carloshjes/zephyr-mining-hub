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

## Onde estamos (verificado por `git log`/`git status` reais em 2026-07-09, não por memória)

| # | Módulo | Status | Commit |
|---|--------|--------|--------|
| 1 (Fable) | Fundação + Pulso da Rede | ✅ feito, commitado, enviado | `65be1b2` |
| 2 (Fable) | Bússola de Pools | ✅ feito, commitado, enviado | `57044c9` |
| 3 (Fable) | Raio-X da Recompensa | ✅ feito, commitado | `21de8e5` — **falta enviar, ver "Ação pendente"** |
| 4 (Fable) | Monitor do Rig | ⬜ não iniciado | — |
| 5 (Fable) | Integração final | ⬜ não iniciado | — |
| — | Prompt de deploy no Vercel | ⬜ ainda não escrito | — |
| — | Skills (auditoria/limpeza/visual) | ⬜ não rodadas | — |

## AÇÃO PENDENTE — resolver antes de abrir a sessão do Prompt 4

Histórico: duas rodadas de checagem real (`git log`/`git status`/`git diff` direto no
repo) já encontraram e corrigiram pendências de commit/push do Prompt 3 — mas na
segunda checagem (2026-07-09, montando este handoff) o repo ainda estava com **2
commits locais não enviados** (`21de8e5` e um commit de docs seguinte) e alterações
não commitadas de novo em `CLAUDE.md`/`.gitignore`/`docs/HANDOFF.md`. Provável causa
de pelo menos parte disso: normalização de quebra de linha (CRLF/LF) no Windows —
`CLAUDE.md` apareceu com ~100% das linhas "mudadas" no diff mesmo sem mudança de
conteúdo real; conteúdo confirmado igual por leitura direta do arquivo. Isso não é
motivo de alarme, só motivo de commitar nas duas ocasiões.

**Peça pro Carlos rodar isto em passos separados (não tudo colado de uma vez), e
CONFERIR a saída de cada um antes do próximo — os dois `push` anteriores parecem não
ter rodado de fato, então desta vez precisa de confirmação visual:**

```powershell
cd C:\Projetos\zephyr-mining-hub
git add -A
git status
```
→ deve listar `CLAUDE.md`, `.gitignore`, `docs/HANDOFF.md` (e talvez mais) em "Changes
to be committed". Se a lista parecer estranha, pare e cole a saída pro chat antes de
continuar.

```powershell
git commit -m "docs: sincroniza CLAUDE.md e handoff, fecha pendencias de gitignore"
git push
```
→ o `push` precisa terminar mostrando algo como `main -> main` sem erro. Se pedir
login do GitHub, complete o login.

```powershell
git status
git log --oneline -3
```
→ **critério de sucesso:** `git status` mostra exatamente "nothing to commit, working
tree clean" E "Your branch is up to date with 'origin/main'". Se faltar qualquer uma
dessas duas frases, NÃO prossiga pro Prompt 4 — volte pro chat com a saída completa.

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

## Próximos passos, em ordem

1. Resolver a "Ação pendente" acima.
2. Sessão nova, colar o Prompt 4 (Monitor do Rig) de `docs/zephyr-mining-hub-prompts.md`
   sem alteração.
3. Prompt 5 (integração final) — também já pronto no mesmo arquivo.
4. Escrever o prompt de deploy no Vercel — **ainda não existe**, precisa ser montado
   seguindo o mesmo estilo dos outros 5 (ver `docs/guia_conversar_com_llm.md`). Ponto
   de partida: o `CLAUDE.md` já explica que precisa de um rewrite equivalente ao proxy
   configurado em `vite.config.ts` — leia esse arquivo no repo antes de escrever o
   prompt.
5. Rodar as skills `backend-structure-auditor` (deriva de padrão entre os 4 módulos) e
   `code-audit-cleanup` (limpeza final) — via Skill tool deste chat, não via Claude
   Code. `creative-ui-director` é opcional, pra uma passada de direção visual mais
   autoral; pode rodar antes do Prompt 4/5 ou depois, não é sequencial.
