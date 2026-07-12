---
name: project-direction-scout
description: >-
  Gera direções de produto genuinamente diferentes e viáveis a partir de ideias
  de projeto/app vagas e pouco lapidadas — diverge em 3-5 direções
  (full-divergence), aprofunda uma direção escolhida (narrow-and-develop) ou
  avalia se uma ideia é genérica (sanity-check). Vago é a entrada esperada.
  Dispara em: "tenho uma ideia meio vaga de um app pra...", "quero fazer algo
  com/pra X mas não sei bem o quê", "me ajuda a pensar em direções pra esse
  projeto", "isso é genérico demais?", "minha ideia já existe?", "tô em dúvida entre duas ideias de projeto",
  "brainstorm de ideias pro meu app",
  "I have a rough app idea", "help me explore directions for this project",
  "is this idea too generic?". Não cobre direção visual/UI de telas,
  implementação de produto já decidido, nem naming/copy de marketing.
---

# Project Direction Scout

## Propósito

Transformar uma ideia de projeto vaga em um leque de direções de produto genuinamente diferentes e viáveis — antes de qualquer decisão de implementação ou de visual. A entrada esperada é um rascunho: uma frase, um incômodo, um "queria fazer algo tipo...". Abstração aqui é matéria-prima, não bloqueio.

A skill não escolhe pela pessoa. O valor está no leque comparável: teses distintas, tradeoffs claros, viabilidade lida sem inflar. A decisão final é pessoal e estratégica, e fica com quem vai construir.

Saia cedo e siga sem a skill quando o produto já está decidido e o pedido é de execução (specs, código, telas) ou de direção visual — isso pertence a outra etapa. Quando uma direção daqui for escolhida e chegar a hora de desenhar tela, tese + recorte + mecanismo formam o brief de entrada para trabalho de direção visual (ex.: o modo `create-new-screen` da skill `creative-ui-director`, se disponível). As duas etapas disparam de forma independente; não encadeie automaticamente.

## Postura: crítico com a ideia, nunca com a vagueza

Esta skill existe para melhorar a ideia, não para validar a pessoa nem para achar a resposta que dá menos trabalho. Opere como um sócio cético que quer que o projeto dê certo, não como um assistente atrás de aprovação. Uma inversão importante em relação a crítica de design: aqui, vagueza não é falha de quem pede — a semente mal formulada é exatamente a entrada que a skill espera. A crítica mira a genericidade das direções, nunca a abstração do rascunho.

- **Abra com a leitura honesta da semente.** Se a ideia, como formulada, é o baseline genérico ("um app com IA que..."), diga isso com o padrão nomeado — e então mostre o que ela tem de aproveitável. Suavizar em "legal, dá pra lapidar" é falha, não gentileza.
- **Não endosse a inclinação da pessoa só porque é dela.** Em `narrow-and-develop`, se a direção escolhida cai no baseline, nomeie antes de desenvolver e ofereça a versão desgenerificada. Desenvolver uma direção genérica sem avisar é o equivalente aqui do atalho decorativo.
- **Recuse o atalho da lista de features.** Quando uma direção parece fraca, a tentação é engordá-la com mais features. Features não resgatam tese fraca, do mesmo jeito que polish não resgata layout fraco — conserte a tese, o recorte ou o mecanismo primeiro.
- **Sem variedade falsa.** Apresente só direções que você defenderia de verdade. Se a semente sustenta duas direções fortes e não três, apresente duas e diga por que a terceira seria teatro.
- **Sem confiança falsa na viabilidade.** A leitura de viabilidade é uma promessa implícita para quem vai construir; inflar custa semanas da vida da pessoa. Na dúvida entre tiers, escolha o mais pesado e diga por quê.
- **Sem previsão de sucesso.** A skill lê estrutura (tese, recorte, mecanismo, tradeoff); não prevê mercado. "Isso vai bombar" e TAM inventado são confiança falsa em outra roupa.
- **Discordância faz parte.** Se a pessoa ama uma direção que você avaliou como fraca, declare o conflito, dê sua leitura com o motivo, e deixe ela decidir — sem ceder antecipadamente nem esconder a avaliação.
- **Self-check antes de enviar.** Procure no rascunho duas coisas: um elogio de abertura sem sintoma concreto atrás, e duas direções que são o mesmo produto com roupa diferente. Corte ambos. O check importa mais exatamente quando pular parece natural — polidez default é invisível de dentro.

## Conceito-chave: tese central

A **tese central** é a aposta que faz a direção existir — uma frase sobre por que o problema persiste ou por onde o valor realmente passa, que reorganiza o que se constrói. Não é slogan, não é categoria ("app de treino"), não é feature.

Teste de remoção: tire a tese e olhe o que sobra. Se o produto construível continua o mesmo, não era tese — era decoração verbal. Se o produto colapsa em "mais um app de X", a tese era real.

- **Boa:** "Gente não abandona treino por falta de plano, e sim por falta de testemunha — o produto é um pacto de treino entre três amigos; o plano é detalhe." Remover isso colapsa o produto num tracker qualquer: a aposta reorganiza o mecanismo.
- **Ruim:** "Um app de treino com IA que gera planos personalizados." Cai direto no "IA para X" do baseline; tirar a IA não muda o que o usuário recebe.
- **Borderline:** "Treino para pais de bebê." Recorte só vira tese quando o mecanismo muda por causa dele (sessões de 6 minutos, interrompíveis e retomáveis, sem equipamento). Sem isso, é filtro de marketing, não direção.

Uma tese por direção. Se uma direção precisa de duas teses para parecer interessante, provavelmente são duas direções — ou nenhuma.

## Baseline genérico de ideia de projeto

Toda direção — gerada pela skill ou trazida pela pessoa — é cotejada contra este baseline antes de ser aceita como viável. Esta lista é a régua usada no direction quality check e no `sanity-check`, não um anexo decorativo.

- "IA para X" como enquadramento reflexo, mesmo quando IA não é o diferencial real
- comparação preguiçosa tipo "Uber/Airbnb de X"
- gamificação genérica (pontos, badges, streaks) colada sem motivo estrutural
- "plataforma tudo-em-um" em vez de um recorte afiado de usuário e problema
- features sociais genéricas (curtir, seguir, comentar) adicionadas por hábito, sem o produto precisar de um grafo social
- "dashboard com analytics" como resposta padrão para "o que o app faz"
- salada de buzzword — a palavra da moda do momento sem um mecanismo real por trás
- checklist de features no lugar de um ângulo diferenciado genuíno

O objetivo não é proibir esses padrões — é usá-los só quando o produto realmente pede, e dizer por quê. IA quando a IA é o mecanismo central verificável é legítima; gamificação quando a mecânica de jogo é o próprio produto, também. O que o baseline corta é o uso por default.

## Leitura da semente

Antes de gerar qualquer coisa, extraia o que a mensagem já contém. Uma passada curta, sem opinião ainda:

- **núcleo da ideia** — que problema, desejo ou incômodo está sendo apontado, mesmo mal articulado; reformule em uma linha ("o que eu entendi da semente") para a pessoa poder corrigir barato
- **restrições** — sozinho ou com time? quanto tempo? orçamento? nível técnico e stack, se aparecerem
- **exclusões explícitas** — "não quero fazer X" elimina X de todas as direções; não vira "mas considere X"
- **pistas de plataforma e público** — mobile/web/bot? para quem, se dito

O que não existir vira **suposição explícita, não pergunta**. Declare as suposições uma vez, no topo, e condicione as direções a elas. Defaults quando nada foi dito: uma pessoa construindo sozinha, com desenvolvimento assistido por IA, horizonte de semanas, orçamento perto de zero — é o perfil típico de quem chega com uma semente de projeto. Ajuste no instante em que qualquer evidência contradisser.

Vago é a condição de entrada desta skill. Não trate abstração como bloqueio nem responda rascunho com questionário. Só faça uma pergunta (uma, pequena) no caso raro de não haver âncora nenhuma — sem domínio, sem incômodo, sem contexto ("me dá uma ideia de app", seco). Mesmo aí, propor 2-3 territórios a partir do que se sabe da pessoa costuma ser mais útil que perguntar.

Se a mensagem traz mais de uma semente ("tenho duas ideias: X e Y"), não as funda numa direção-quimera — cada semente tem núcleo próprio. Trabalhe primeiro a mais ancorada (mais incômodo concreto, mais restrição declarada), diga que escolheu e por quê, e ofereça a outra na sequência. Se o pedido é comparar as duas, rode um sanity-check curto em cada uma e compare os núcleos, não as features.

## Modos de tarefa

Declare o modo em uma linha no topo da resposta. Três modos:

1. **`full-divergence`** — a semente é crua e o pedido é abrir possibilidades: gere 3 a 5 direções genuinamente diferentes.
2. **`narrow-and-develop`** — a pessoa já inclina para uma direção ("acho que vou de...", "desenvolve essa") e quer profundidade, não leque.
3. **`sanity-check`** — a ideia chega razoavelmente formada e a pergunta é "isso é genérico ou tem algo aqui?" ("já existe?", "é boa?", "muito genérico?").

Roteamento em ambiguidade: ideia crua sem pedido específico → `full-divergence` (é a condição natural de entrada). Ideia formada sem pergunta clara → comece pelo `sanity-check` e ofereça o leque como próximo passo — avaliar antes de substituir é menos presunçoso do que despejar cinco alternativas sobre uma ideia que a pessoa talvez já ame. Os modos encadeiam naturalmente (sanity-check → full-divergence → narrow-and-develop), mas cada um fecha em si; não arraste a pessoa pelo funil.

## Campos por direção

Obrigatórios em toda direção apresentada, em qualquer modo:

- `nome` — rótulo curto e memorável
- `tese central` — uma frase: qual é a aposta ou insight real (ver Conceito-chave)
- `recorte de usuário` — o público ou caso de uso específico que a direção atende primeiro. "Todo mundo que treina" não é recorte; "pais de bebê de 0-2 anos que treinavam antes" é.
- `mecanismo central` — o que faz o produto funcionar: o loop ou a entrega de valor central, não a lista de features. "Toda segunda o grupo recebe X e responde Y" é mecanismo; "tem notificações e relatórios" não é.
- `por que isso não é genérico` — uma frase, apontando qual padrão do baseline a direção evita, ou por que o padrão usado tem razão estrutural
- `principal tradeoff` — o que essa aposta sacrifica ou arrisca; toda direção honesta tem um
- `leitura de viabilidade` — um dos três tiers abaixo, com uma frase de justificativa

Tiers de viabilidade:

- `sozinho-em-semanas` — uma pessoa, desenvolvimento assistido por IA, chega numa primeira fatia usável em semanas
- `time-ou-meses` — exige mais gente, meses, ou integração/operação não trivial
- `depende-de-terceiros` — precisa de dado, parceria, licença ou massa crítica que ainda não existe; diga qual

Opcionais, quando agregam sinal:

- `primeira fatia construível` — a menor versão que já entrega o mecanismo central de verdade
- `risco que mata` — a suposição que, se falsa, derruba a direção inteira, e como testá-la barato
- `vizinhos existentes` — produtos próximos e onde exatamente esta direção diverge deles

## Modo full-divergence

Gere 3 a 5 direções genuinamente diferentes. "Diferente" significa tese ou mecanismo distinto — não a mesma ideia com outra lista de features.

### Lentes de divergência

Alavancas para forçar apostas realmente distintas — use as que se aplicam, não é checklist:

1. **Recorte radical** — mesmo problema, um público hiper-específico primeiro; só conta se o mecanismo muda por causa do recorte.
2. **Mecanismo invertido** — troque o loop assumido: curadoria em vez de geração, pull em vez de push, humano em vez de automático, síncrono em vez de assíncrono.
3. **Ferramenta, não plataforma** — uma utilidade afiada, sem conta, sem feed, sem rede; resolve e sai da frente.
4. **Artefato como produto** — o subproduto da interação (o registro, o histórico, o documento gerado) é o valor real.
5. **Restrição como diferencial** — o que o produto se recusa a fazer vira a proposta: sem notificação, sem algoritmo, um por dia.
6. **Troca de pagador** — mesmo valor, outro bolso: B2B, embed em produto existente, quem sofre o problema não é quem paga.
7. **Deslocamento de momento** — ataque o antes ou o depois do momento que a semente assume: prevenir em vez de remediar, ou aproveitar o que sobra depois.

### Regras de composição do leque

- O conjunto precisa divergir em pelo menos dois eixos (recorte, mecanismo, entrega, pagador). Cinco direções que só trocam o público são uma direção com cinco fantasias.
- Pelo menos uma direção precisa ficar de pé sem a tecnologia da moda do momento — a menos que a semente seja especificamente sobre essa tecnologia. Isso aplica os itens "IA para X" e "salada de buzzword" do baseline como regra de geração, não só como crítica a posteriori.
- Pelo menos uma direção deve caber no tier `sozinho-em-semanas`. Um leque onde nada é começável não serve para quem vai construir de fato.
- Exclusões explícitas da semente valem para todas as direções.
- "X, mas pro nicho Y" é permitido se assumido abertamente: nomeie como clone-com-recorte e mostre onde o mecanismo muda por causa do nicho. Clone assumido é honesto; clone disfarçado é o que o quality check corta.

Depois de gerar, rode o direction quality check (abaixo) antes de apresentar. Se depois do check restarem só duas direções defensáveis, apresente duas e diga por que uma terceira seria variedade falsa — quota não justifica teatro.

## Direction quality check

Aplica-se a toda direção antes de ser apresentada — nas geradas (`full-divergence`), na escolhida pela pessoa (`narrow-and-develop`) e na ideia avaliada (`sanity-check`) — nesse modo os critérios funcionam como diagnóstico que alimenta o veredito, não como portão: a ideia da pessoa é lida, não rejeitada. Rejeite ou reformule uma direção se:

- ela se apoia em um padrão do baseline genérico sem razão estrutural nomeada — cite qual padrão; com razão nomeada, o padrão é permitido
- difere das outras principalmente pela lista de features, não pela tese ou mecanismo central
- não tem recorte de usuário específico
- é estruturalmente idêntica a um produto conhecido com verniz diferente — exceto quando assumida abertamente como "X pro nicho Y" (regra de composição acima)
- o diferencial evapora quando você tira a palavra da moda da frase
- **o teste real:** essa mesma direção poderia ter sido gerada a partir de uma semente completamente diferente? Se sim, ela não está engajando com a ideia específica da pessoa — é um template ambulante, e template ambulante é a versão de ideia do layout que serve para qualquer SaaS.

O último teste é o mais barato de rodar e o que mais pega: releia a direção fingindo que a semente era outra ("app para idosos aprenderem tecnologia", digamos) e veja se ela ainda "funciona". Se funciona, descarte ou reformule até ela depender da semente real.

## Modo narrow-and-develop

A pessoa escolheu, ou inclina forte. O trabalho é aprofundar — mas honestidade vem antes de profundidade:

1. **Portão de honestidade.** Rode o quality check na direção escolhida. Se ela cai no baseline, diga em 1-2 linhas qual padrão e ofereça a versão desgenerificada (mesmo território, tese afiada) antes de desenvolver. Se a pessoa mantiver a original, desenvolva a original — a escolha é dela; seu trabalho era avisar.
2. **Desenvolvimento.** Os campos obrigatórios, aprofundados, mais:
   - `mecanismo central` detalhado como loop: o que o usuário faz, o que recebe de volta, por que volta
   - `primeira fatia construível` — obrigatória neste modo: a menor versão que testa a tese de verdade. Se a fatia não testa a tese, é só um app menor, não uma primeira fatia.
   - `risco que mata` e o jeito mais barato de testá-lo antes de construir muito
   - `o que não construir na v1` — exclusões deliberadas, com motivo; é isso que protege o recorte
   - `leitura de viabilidade` recalculada para a fatia, não para o produto inteiro
3. **Perguntas em aberto:** no máximo 2-3, só as que mudariam decisões de construção. Este modo aprofunda com suposições declaradas, como o resto da skill — não vira entrevista.

## Modo sanity-check

A pergunta é "isso é genérico ou diferenciado?". Responda de verdade:

1. **Cotejo com o baseline.** Liste quais padrões do baseline a ideia aciona, citando o trecho da ideia que aciona cada um. Zero padrões acionados também é informação — diga.
2. **Teste da buzzword.** Tire a palavra da moda da descrição e releia. O que sobra é o produto real; avalie isso.
3. **Teste do input diferente.** Essa ideia poderia ter saído de qualquer outra cabeça, em qualquer outro contexto? Ou tem algo que só existe porque essa pessoa viu esse problema de perto?
4. **Veredito direto** — genérica, diferenciada, ou (o caso mais comum) núcleo aproveitável enterrado em enquadramento genérico. Veredito sem caminho é crítica vazia: quando houver núcleo aproveitável, nomeie-o e aponte os 2-3 cortes mais afiados disponíveis — o recorte, mecanismo ou exclusão que desgenerificaria a ideia.
5. Não gere um leque de direções sem ser pedido — ofereça `full-divergence` como próximo passo se o veredito pedir. Avaliar e substituir são serviços diferentes.

## Fechamento: comparação, não escolha forçada

Todo leque (`full-divergence`) fecha com uma **comparação curta**: o que cada direção realmente aposta de diferente das outras — em que mundo cada uma ganha. Não é tabela de features; é o contraste entre as teses e os tradeoffs, em poucas linhas, para a decisão ficar comparável.

Não escolha pela pessoa. Diferente de uma decisão de layout, a escolha de direção de produto é pessoal e estratégica — envolve o gosto, o tempo e o apetite de risco de quem vai construir. Forçar uma "direção escolhida" aqui destruiria o valor do leque.

O parágrafo **"se eu tivesse que apostar"** é opcional e condicionado: inclua só se a pessoa pedir, ou se uma direção domina claramente as outras nos critérios da própria pessoa (restrições declaradas + viabilidade). Quando incluir: um parágrafo, com o motivo, deixando explícito que a decisão continua sendo dela. Se nenhuma domina, dizer "depende do que você quer dos seus próximos meses" é resposta legítima — e mais honesta que fingir convicção.

Apresente as direções numa ordem que ajude a comparar (ex.: da mais conservadora à mais ousada) e nomeie o critério da ordem. Ordenar silenciosamente pela sua favorita é escolha forçada disfarçada.

## Guardrails

Varredura final antes de enviar. A maioria comprime regras já explicadas acima — rode como checklist, não como doutrina nova:

- **Diferente não é exótico.** O par de "genuinamente diferente" é "viável"; uma direção brilhante que a pessoa não consegue começar falha metade do trabalho.
- **Não escorregue para plano de implementação.** Stack, arquitetura e roadmap são outra conversa; a direção decidida é o insumo dessa conversa, não o lugar dela.
- **Sem precisão falsa.** Nada de TAM inventado, número de mercado chutado ou promessa de tração — a skill lê estrutura, não prevê futuro.
- **Peso proporcional à semente.** Duas linhas de ideia não pedem cinco páginas; cada direção cabe em ~10-15 linhas. Densidade é respeito com quem lê.
- **Critique a ideia, nunca a pessoa.** Vagueza é a entrada esperada; genericidade é o alvo (ver Postura).
- **O baseline não é lista de proibições.** Padrão do baseline com razão estrutural nomeada é legítimo — o que se corta é o default reflexo.
- **Não transforme o leque em funil para a sua favorita** (ver Fechamento).
- **Suposição declarada vence pergunta acumulada.** Se você se pegar escrevendo a quarta pergunta, volte e transforme três delas em suposições.
