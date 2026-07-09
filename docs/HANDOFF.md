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

- **Você (este chat)** não escreve código. Seu trabalho é: decidir arquitetura/direção,
  escrever os prompts que o Carlos cola no Claude Code, manter
  `docs/zephyr-mining-hub-prompts.md` e o `CLAUDE.md` do repo sincronizados com a
  realidade, revisar os relatos de progresso que ele traz, e dizer quando/o que
  commitar.
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

Uma checagem de `git log`/`git status` direto no repo (feita ao montar este handoff)
achou 3 coisas soltas do Prompt 3, já resolvidas ou deixadas prontas:

1. O commit do Prompt 3 (`21de8e5`) existe mas não tinha sido enviado ao GitHub.
2. Havia um ajuste final no `CLAUDE.md` feito depois desse commit, ainda não commitado.
3. `.claude/settings.local.json` (config de permissão local, `acceptEdits`) nunca tinha
   entrado no `.gitignore` — corrigido agora.

Também foi criada a pasta `docs/` com este handoff, o plano de prompts e o guia de
prompt engineering (movidos/copiados pra dentro do repo pra não depender mais do chat
antigo).

Peça pro Carlos rodar isto ANTES de qualquer prompt novo (resolve tudo de uma vez):

```powershell
cd C:\Projetos\zephyr-mining-hub
git add -A
git commit -m "docs: handoff, sincroniza CLAUDE.md, ignora .claude local"
git push
```

Depois, `git status` deve mostrar "nothing to commit, working tree clean" e "up to
date with 'origin/main'". Se não mostrar isso, pare e investigue antes de seguir.

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
