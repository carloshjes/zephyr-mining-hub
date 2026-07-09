# Como Conversar com uma LLM de Forma Eficaz e Econômica

### Guia técnico baseado na documentação oficial da Anthropic

> Este guia foi montado a partir das fontes oficiais da Anthropic: as páginas de *Prompt engineering* (visão geral e técnicas), as *best practices* específicas dos modelos Claude 4 e o artigo de engenharia *Effective context engineering for AI agents*. A ideia é dar primeiro a **teoria** (por que as coisas funcionam), depois os **exemplos práticos**, sem pular passos.
>
> *Revisão atual (junho de 2026):* inclui um passo inicial sobre critério de sucesso, saída estruturada (structured outputs e tool use — caminhos distintos, detalhados na Seção 8), prompt caching e o modelo de raciocínio atual da API (adaptive thinking + parâmetro `effort`). O prefill é tratado como técnica **legada**, já que foi removido a partir do Claude 4.6 (e segue removido nos modelos posteriores). Os detalhes de API e de versão refletem o estado dos modelos em **junho de 2026** (Opus 4.8 como Opus mais recente; Opus 4.7/4.6, Sonnet 4.6 e Fable 5 também citados) — como isso muda rápido, confirme os detalhes finos na documentação oficial quando for implementar.

---

## Sumário

1. A mentalidade certa (a analogia central)
2. Antes de escrever: defina o alvo e itere
3. Como o modelo "pensa": a janela de contexto e o orçamento de atenção
4. As técnicas centrais (a base do dia a dia)
5. Trabalhando com textos longos
6. Raciocínio e verificação (a qualidade da resposta)
7. Economia de tokens (o foco específico)
8. O que muda quando você for *construir* projetos com a API
9. Erros comuns que geram respostas pífias
10. Checklist rápido antes de enviar um prompt

---

## 1. A mentalidade certa

### Teoria

A documentação da Anthropic resume a postura ideal numa única imagem: trate o modelo como **"um funcionário brilhante, porém recém-contratado, que ainda não conhece as suas normas nem o seu jeito de trabalhar"**.

Pense no que isso significa. Esse funcionário é genuinamente inteligente — domina muita coisa, raciocina bem, escreve bem. Mas ele acabou de chegar. Ele **não sabe**:

- qual é exatamente o seu objetivo;
- qual formato de resposta você espera;
- o que, para você, conta como uma resposta "boa";
- qual é o contexto da sua tarefa (sua matéria, seu professor, seu nível).

A consequência é direta: **o modelo não lê a sua mente.** Quase toda resposta ruim que as pessoas recebem nasce de um prompt que assumiu que o modelo "já sabia" algo que só estava na cabeça de quem perguntou.

### A regra de ouro

A própria documentação propõe um teste simples e poderoso:

> **Mostre o seu prompt para um colega que tem pouquíssimo contexto sobre a tarefa e peça para ele seguir as instruções. Se o colega ficaria confuso, o modelo também ficará.**

Guarde essa frase. Ela vale mais do que qualquer truque, porque te força a sair da sua cabeça e a escrever de forma autossuficiente.

### Exemplo

**Prompt fraco (assume contexto):**

> me ajuda com vetores

O modelo não sabe se você quer teoria, exercício, código, em qual linguagem, em qual nível. Ele vai chutar — e provavelmente errar o alvo.

**Prompt forte (autossuficiente):**

> Sou aluno do 1º semestre de Ciência da Computação e estou aprendendo vetores (listas) em Python. Explique primeiro o conceito com uma analogia, depois mostre um exemplo simples de como percorrer uma lista somando os elementos. Comentários do código em inglês.

Repare que o segundo prompt responde sozinho às perguntas que o "funcionário recém-chegado" faria.

---

## 2. Antes de escrever: defina o alvo e itere

Esta seção vem antes das técnicas de propósito. Sem ela, você fica "caprichando no prompt" sem saber para onde está mirando.

### Teoria: três coisas antes de otimizar

A Anthropic recomenda ter três coisas na mão antes de refinar um prompt. Sem elas, você está otimizando no escuro:

1. Uma **definição clara do que é uma resposta "boa"** para o seu caso — um critério concreto, não um "ficou legal".
2. Um **jeito de testar** contra esse critério — de preferência um punhado de casos (incluindo casos de borda), não um exemplo só.
3. Um **primeiro rascunho** do prompt para melhorar.

A analogia: é como escrever o **gabarito antes de corrigir a prova**. Sem o gabarito, você não tem como saber se a mudança que fez no prompt melhorou ou piorou — só "acha".

> Critério concreto vale mais que critério vago. *"Pelo menos 9 de cada 10 perguntas respondidas corretamente, sem inventar fato"* é testável. *"Quero respostas boas"* não é.

### Prompt é processo, não acerto único

Existe uma armadilha mental comum: achar que existe "o prompt perfeito" que você escreve de primeira. Não existe. O que existe é o ciclo **escrever → testar em vários casos → comparar → ajustar**. Os melhores prompts quase sempre são a terceira ou quarta versão, não a primeira.

A boa notícia: tudo que vem nas próximas seções são formas de **chegar mais rápido** ao seu critério. Mas o critério vem primeiro.

---

## 3. Como o modelo "pensa": a janela de contexto e o orçamento de atenção

Esta é a parte teórica mais importante do guia, porque ela explica **ao mesmo tempo** por que algumas conversas dão certo e como economizar tokens. Vale ler com calma.

### Teoria: a janela de contexto é a "mesa de trabalho" do modelo

Tudo o que o modelo "enxerga" em um dado momento — as suas mensagens, as respostas anteriores dele, os documentos que você colou — vive em um espaço chamado **janela de contexto** (*context window*).

A analogia: imagine que o modelo trabalha em uma **mesa de tamanho fixo**. Cada coisa que você coloca na conversa é uma folha de papel sobre essa mesa. Enquanto a mesa não enche, ótimo. Mas o tamanho é finito: a partir de certo ponto, colocar uma folha nova significa que as outras ficam mais espremidas e mais difíceis de consultar.

Detalhe crucial e que muita gente ignora: **o modelo não tem memória entre conversas diferentes.** Cada conversa começa com a mesa vazia (fora as instruções permanentes que você configurar). Ele só sabe o que está na mesa *agora*.

### Teoria: o "orçamento de atenção" e o *context rot*

A Anthropic descreve um fenômeno medido em pesquisas e que tem um nome: ***context rot*** ("apodrecimento do contexto"). A ideia: **quanto mais tokens entram na janela, pior fica a capacidade do modelo de localizar e usar com precisão uma informação específica dentro dela.**

Por quê? Porque o modelo tem um **orçamento de atenção** finito — exatamente como a memória de trabalho de um ser humano. Cada token novo "gasta" um pouco desse orçamento.

A analogia: procurar uma frase específica é fácil num **bilhete de uma linha**. É difícil num **livro de 500 páginas**. O conteúdo pode estar lá nos dois casos, mas a precisão da busca despenca quando há ruído demais ao redor.

Daí vem o princípio que a Anthropic usa para *tudo*:

> **O bom uso do contexto é encontrar o menor conjunto possível de tokens de alto sinal que torna provável o resultado que você quer.**

Em português claro: **diga o necessário e o relevante — nem mais, nem menos.** Encher o prompt de informação irrelevante não ajuda; atrapalha.

### O que é um "token" (em uma frase)

Um *token* é um pedacinho de texto. Em inglês, na média, gira em torno de **~4 caracteres** (ou ~0,75 palavra) por token. **Tanto o que você escreve quanto o que o modelo responde são contados em tokens.** Por isso "economia de tokens" tem dois lados: o tamanho do que você manda **e** o tamanho do que você pede de volta.

> Detalhe que te afeta diretamente: o tokenizador é otimizado para inglês. O **mesmo** texto em português costuma virar **mais** tokens do que em inglês. Ou seja, a conta de tokens pesa um pouco mais para quem escreve em PT — vale ter isso em mente quando o custo importa.
>
> *Nuance técnica:* aquele "~4 caracteres por token" é só uma **regra de bolso para o inglês**, e ficou ainda mais aproximada nos modelos recentes — o Opus 4.7 estreou um tokenizador novo que pode gerar de 1x a ~1,35x mais tokens que os modelos anteriores (até ~35% a mais, variando com o conteúdo). Use o número redondo para ter **noção de ordem de grandeza**, não para cálculo fino.

---

## 4. As técnicas centrais (a base do dia a dia)

Estas são as técnicas que resolvem a maior parte dos casos. Use-as e a esmagadora maioria das suas respostas já melhora.

**Uma nota honesta sobre a fonte.** A Anthropic organiza as técnicas de prompt "da mais amplamente eficaz para a mais especializada". A lista abaixo é uma **seleção** que mistura essa lista central com as *best practices* específicas dos modelos Claude 4 (as duas últimas, 4.7 e 4.8, vêm de lá). E uma técnica central — o **chain-of-thought** ("deixe o modelo pensar") — está na Seção 6, porque conversa melhor com raciocínio e verificação.

### 4.1 Seja claro e direto

**Teoria.** O modelo responde bem a instruções explícitas. Se você quer um comportamento "acima da média", **peça explicitamente** — não conte com a sorte de ele adivinhar a partir de um prompt vago. Seja específico sobre o **formato** e as **restrições** da saída. Quando a ordem ou a completude dos passos importa, peça em forma de **lista numerada**.

**Exemplo.**

- Em vez de: *"resume esse texto"*
- Prefira: *"Resuma este texto em 3 tópicos curtos, focando apenas nas conclusões. Não inclua introdução."*

### 4.2 Dê contexto e explique o *porquê*

**Teoria.** Explicar **por que** você quer algo ajuda o modelo a entender o objetivo e a generalizar para casos que você nem mencionou. Ele é inteligente o bastante para deduzir a intenção a partir da motivação.

**Exemplo.**

> Formate datas como DD/MM/AAAA, **porque** meu sistema brasileiro só aceita esse formato.

Com o "porque", se aparecer uma data escrita de outro jeito no meio da tarefa, o modelo tende a converter sozinho — ele entendeu a *regra*, não só o comando isolado.

### 4.3 Use exemplos (few-shot / multishot)

**Teoria.** Dar exemplos é **uma das formas mais confiáveis** de controlar formato, tom e estrutura da resposta. A recomendação é incluir de **3 a 5 exemplos**. Eles devem ser:

- **Relevantes:** parecidos com o seu caso real;
- **Diversos:** cobrindo casos de borda, para o modelo não pegar um padrão errado;
- **Estruturados:** envolvidos em tags, uma técnica que vemos no próximo item.

A frase que a Anthropic usa: para um modelo, **exemplos são as "fotos" que valem mais que mil palavras**.

**Exemplo.**

> Classifique o sentimento das frases como Positivo, Negativo ou Neutro.
>
> ```
> <exemplo>
> Frase: "Adorei a aula de hoje!"
> Sentimento: Positivo
> </exemplo>
> <exemplo>
> Frase: "A prova foi ok, nada demais."
> Sentimento: Neutro
> </exemplo>
> ```
>
> Agora classifique: "Não entendi nada e perdi tempo."

### 4.4 Estruture o prompt com tags XML

**Teoria.** Quando o seu prompt mistura **instruções + contexto + exemplos + dados**, o modelo pode se confundir sobre o que é o quê. Envolver cada tipo de conteúdo na sua própria tag (por exemplo `<instrucoes>`, `<contexto>`, `<dados>`) elimina essa ambiguidade. Use nomes de tag **consistentes e descritivos**, e aninhe quando houver hierarquia natural.

> Observação prática: o nome da tag pode estar em português ou inglês — o modelo entende os dois. O que importa é a consistência.

**Exemplo.**

> ```
> <instrucoes>
> Reescreva o texto abaixo em linguagem formal.
> </instrucoes>
>
> <texto>
> e aí, deu pra entender a matéria ou tá osso?
> </texto>
> ```

A separação deixa cristalino o que é ordem e o que é material a ser processado.

### 4.5 Dê um papel ao modelo (*role*)

**Teoria.** Definir um papel foca o comportamento e o tom. **Até uma única frase já faz diferença.** No chat, basta começar com "Aja como...".

> Quando você passa para a API: o papel vai no **system prompt**, mas a recomendação oficial é deixar as **instruções específicas da tarefa no turno do usuário**, em vez de amontoar tudo no system. (Mais sobre isso na Seção 8.)

**Exemplo.**

> Aja como um professor de Cálculo I paciente, que explica cada passo da derivada antes de chegar ao resultado.

### 4.6 Prefill da resposta (técnica legada — atenção ao modelo)

**Teoria.** Historicamente, você podia **começar a resposta do modelo por ele**: ao colocar as primeiras palavras (ou até um único caractere) na vez do *assistant*, o modelo continuava dali. Servia para **forçar o formato** e **manter o tom/personagem**.

> Atenção (mudança importante): o prefill foi **removido a partir do Claude 4.6** e segue removido em todos os modelos posteriores (4.7, 4.8, Fable 5…). Na prática: uma resposta com prefill no último turno do *assistant* retorna **erro 400** nesses modelos. (Nota técnica: o prefill também nunca foi compatível com *extended/adaptive thinking* — o modo de raciocínio dos modelos atuais — mas o motivo de não funcionar é a **remoção** em si, não apenas essa incompatibilidade; ou seja, desligar o thinking não traz o prefill de volta.) Ou seja, nos modelos que você vai usar hoje, o truque do `{` simplesmente não funciona.

> O que usar no lugar: para **garantir formato** (ex.: JSON), use **structured outputs** — o campo `output_config.format` com um JSON schema, que é o substituto direto do antigo prefill com `{` (Seção 8). O *strict tool use* é um caminho alternativo, indicado quando o JSON é, na prática, a entrada de uma ferramenta. No chat comum, o equivalente prático continua sendo pedir o formato de forma explícita. O prefill aparece aqui só para você reconhecer o conceito em material antigo ou em modelos legados.

### 4.7 Diga o que **fazer**, não o que **não fazer**

**Teoria.** Instruções positivas funcionam melhor que proibições. Em vez de listar o que evitar, descreva o resultado desejado.

**Exemplo.**

- Em vez de: *"não use linguagem técnica"*
- Prefira: *"explique como se eu tivesse 15 anos, usando palavras do dia a dia"*

E para formato:

- Em vez de: *"não use bullet points"*
- Prefira: *"escreva em parágrafos corridos e fluidos"*

### 4.8 Combine o estilo do prompt com a saída desejada

**Teoria.** O estilo de formatação que você usa **no seu prompt** influencia o estilo da resposta. Se você escreve o prompt cheio de listas e negritos, tende a receber listas e negritos de volta. Se quer prosa limpa, escreva o pedido em prosa limpa.

---

## 5. Trabalhando com textos longos (PDFs, artigos, capítulos)

Quando você cola documentos grandes (uns 20 mil tokens ou mais), a *ordem* dentro do prompt passa a importar muito.

### Teoria + as duas regras

1. **Coloque o documento longo no TOPO, e a sua pergunta no FINAL.** Segundo os testes da Anthropic, deixar a pergunta no fim, depois dos dados, pode **melhorar a qualidade da resposta em até 30%** em tarefas complexas com vários documentos. A intuição: o modelo lê o material primeiro e chega à sua pergunta já "abastecido" de contexto.

2. **Peça para ele citar antes de responder.** Em tarefas com documentos longos, peça para o modelo **primeiro extrair as partes relevantes** (as citações) e só depois fazer a tarefa. Isso ajuda o modelo a "cortar o ruído" do resto do texto.

### Exemplo (a estrutura)

> ```
> <documento>
> [cole aqui o texto longo]
> </documento>
>
> Antes de responder, primeiro copie as 2 ou 3 frases do documento que são
> mais relevantes para a pergunta. Depois, com base nelas, responda:
> qual é o argumento central do autor?
> ```

---

## 6. Raciocínio e verificação (a qualidade da resposta)

Estas técnicas atacam a parte mais valiosa: fazer o modelo **errar menos** em tarefas que exigem raciocínio (matemática, lógica, código).

### 6.1 Peça para pensar passo a passo

Para problemas que exigem várias etapas de raciocínio, peça explicitamente para o modelo **pensar antes de concluir**. Uma instrução geral como "raciocine com cuidado, passo a passo" costuma produzir um raciocínio melhor do que um roteiro rígido que você mesmo escreveu — o raciocínio do modelo muitas vezes supera o que um humano prescreveria.

> Heurística (não uma regra fixa da doc): em modelos **sem** raciocínio adaptativo, às vezes a palavra "pensar" puxa mais raciocínio, e trocar por sinônimos como **"considere", "avalie"** ou **"raciocine sobre"** ajuda quando "pensar" não surte efeito. Nos modelos atuais, o raciocínio é **adaptativo** — o próprio modelo decide quanto pensar (detalhes na Seção 8) —, então esse truque de palavra importa cada vez menos.

> **Atalho no chat (vale muito conhecer):** além de pedir por escrito que o modelo pense mais, hoje você tem um **controle de esforço** direto na interface do claude.ai (e do Cowork), ao lado do seletor de modelo. O padrão é `high`; você pode subir para **"Extra"** (que equivale ao `xhigh`) ou **"Max"** quando a tarefa for difícil, e descer para gastar menos quando for trivial. Ou seja: o `effort` da Seção 8 **não é só "coisa de API"** — é uma alavanca de qualidade que você já usa no dia a dia, no chat. Sem exagero, porém: "Extra"/"Max" rendem em tarefas longas e difíceis; numa pergunta simples, só te fazem esperar mais (não gaste "Max" para saber a capital da Austrália).

### 6.2 Peça auto-verificação

Uma das dicas mais eficazes e mais ignoradas. Acrescente ao fim do prompt:

> *"Antes de finalizar, verifique a sua resposta contra [um critério de teste]."*

A documentação afirma que isso **captura erros de forma confiável**, especialmente em código e matemática. Exemplo: *"...antes de terminar, teste mentalmente o seu código com a entrada [3, 0, 5] e confirme que o resultado bate."*

### 6.3 Encadeamento de prompts (o ciclo de autocorreção)

O padrão mais útil de encadeamento é o de **autocorreção**, em três passos:

1. Peça um **rascunho**.
2. Peça para o modelo **revisar** esse rascunho contra critérios ("avalie se há erros de lógica, clareza e completude").
3. Peça para ele **reescrever** com base na própria revisão.

Separar essas etapas costuma produzir um resultado bem melhor do que pedir tudo de uma vez.

### 6.4 "Não especule: investigue antes de responder"

Para reduzir "alucinações" (respostas inventadas com confiança), uma instrução direta funciona bem:

> *"Nunca afirme nada sobre algo que você não verificou. Se eu mencionar um arquivo ou trecho específico, leia/considere o conteúdo antes de responder. Dê respostas fundamentadas, sem inventar."*

### 6.5 Uma dose de humildade (importante)

Duas ressalvas para você não confiar demais nas técnicas acima:

- A auto-verificação (6.2) **reduz** erros de forma confiável, sobretudo em código e matemática — mas **não os zera**. Trate como rede de segurança, não como garantia.
- O raciocínio que o modelo **mostra** é uma explicação útil, mas **nem sempre um relato fiel exato** do que aconteceu "por dentro". Use as etapas como ferramenta de qualidade, não como prova de que a resposta está certa. Em coisa crítica, confira você mesmo.

---

## 7. Economia de tokens (o foco específico)

Agora amarramos a teoria da Seção 3 com a prática. Lembre do princípio mestre: **o menor conjunto de tokens de alto sinal.** Toda tática abaixo é uma aplicação dele.

### Por que economizar tokens importa (dois motivos)

1. **Qualidade:** por causa do *context rot*, conversas inchadas pioram a precisão. Economizar token não é só sobre custo — é sobre **resposta melhor**.
2. **Custo/limite:** tokens são a "moeda". Conversas enormes consomem mais e batem em limites mais rápido.

### Táticas práticas (em ordem de impacto)

1. **Comece uma conversa NOVA para um assunto novo.** Esta é a de maior impacto. Arrastar uma conversa de 2 horas para perguntar algo não relacionado enche a mesa de ruído. Assunto novo → mesa limpa.

2. **Seja específico de primeira.** Cada rodada de "não era bem isso, na verdade eu queria..." gasta tokens duas vezes (sua correção + a nova resposta). Um prompt bem montado na primeira tentativa economiza várias rodadas. **Investir 30 segundos escrevendo um bom prompt economiza minutos de idas e vindas.**

3. **Cole só o trecho relevante, não o documento inteiro.** Se a sua dúvida é sobre um parágrafo, cole aquele parágrafo — não o PDF de 40 páginas.

4. **Peça o tamanho e o formato que você quer.** "Responda em no máximo 3 parágrafos" ou "seja conciso" controla o tamanho da *saída* (que também custa tokens). Os modelos mais recentes já são naturalmente concisos; se você quiser mais profundidade, aí sim peça explicitamente.

5. **Faça "compactação manual" em conversas longas.** Quando um chat fica gigante e ainda útil, peça: *"resuma os pontos-chave e as decisões desta conversa em um bloco"*. Copie esse resumo, abra uma conversa nova e cole o resumo como ponto de partida. Você preserva o essencial e descarta o ruído acumulado — é a mesma ideia de *compaction* que a Anthropic usa internamente (e que, na API, já existe como recurso dedicado de *context compaction*, em beta).

6. **Evite pedir que o modelo repita saídas grandes.** Reimprimir um texto longo só para mudar uma vírgula é desperdício. Peça apenas o trecho alterado.

7. **(Projetos/API) Use prompt caching para o que não muda.** Se você reaproveita um contexto grande e estável — um system prompt longo, um documento fixo, um conjunto de instruções —, o *prompt caching* guarda essa parte e você não paga o preço cheio dela a cada chamada, além de reduzir a latência. É a versão "de API" do mesmo princípio: não reenvie o que não mudou. (Detalhe na Seção 8.)

> Nota para quem escreve em PT: como o português gera mais tokens por palavra que o inglês (Seção 3), todas essas táticas rendem um pouco mais para você.

### O princípio que resume tudo

Um princípio que a Anthropic repete como bússola: **"faça a coisa mais simples que funciona".** Não complique o prompt além do necessário.

---

## 8. O que muda quando você for *construir* projetos com a API

Quando você passa de "conversar no chat" para "programar com a API da Anthropic", várias técnicas ganham ferramentas dedicadas:

- **O papel (4.5) vira o *system prompt*** — um campo separado onde você define o comportamento permanente do "assistente" que você está construindo. Regra prática: persona e regras gerais no system; **instruções específicas da tarefa no turno do usuário**.

- **Prefill (4.6): legado, evite nos modelos atuais.** A ideia era escrever o início do turno do *assistant* para o modelo continuar dali. Mas o prefill foi **removido a partir do Claude 4.6** — e segue removido em 4.7, 4.8, Fable 5 e posteriores: uma resposta com prefill no último turno do *assistant* retorna **erro 400**. Não é só "incompatível com o adaptive thinking" — foi removido de fato. Para forçar saída estruturada, use o item abaixo.

- **Saída estruturada (JSON) para parsear em código.** Três caminhos, do mais simples ao mais robusto: (1) pedir JSON explicitamente e descrever o formato esperado no prompt/system; (2) **structured outputs** — o campo `output_config.format` com um JSON schema, que dá **garantia** de formato e é o substituto direto do antigo prefill com `{`; (3) **strict tool use**, quando o JSON é, na prática, a entrada de uma ferramenta. As opções (2) e (3) são as recomendadas nos modelos atuais. Em qualquer caso, faça o parse com tratamento de erro e remova eventuais cercas de código (` ```json `) antes de converter.

- **Controle de raciocínio (*adaptive thinking* + `effort`).** Nos modelos atuais (Opus 4.7/4.8, Fable 5), o raciocínio é **adaptativo**: em vez de você fixar um orçamento de tokens, o modelo decide sozinho *quando* e *quanto* pensar, conforme a complexidade da tarefa. Três pontos que costumam confundir:

    1. **O thinking vem desligado por padrão na API.** Você o liga explicitamente com `thinking: {type: "adaptive"}`. Quando ligado, o modo adaptativo é o **único** disponível — não existe mais orçamento manual de tokens (o antigo `budget_tokens` foi removido nesses modelos). Em superfícies de chat (claude.ai), o padrão varia.
    2. **O `effort` mora num objeto `output_config` separado, *não* dentro de `thinking`** (ex.: `output_config = {"effort": "high"}`). Esse é o detalhe que mais derruba quem está começando.
    3. **São cinco níveis de `effort`:** `low`, `medium`, `high`, `xhigh`, `max`, em profundidade crescente. O padrão é `high` em todas as superfícies (inclusive API e Claude Code). Cuidado com um engano comum: o nível **novo e restrito** é o `xhigh` (disponível só no Opus 4.7, Opus 4.8, Fable 5 e Mythos 5) — o `max`, por outro lado, **já existe desde o Opus 4.6**. Há uma exceção de padrão: no Claude Code, o Opus 4.7 assume `xhigh` como default.

    A relação custo × qualidade fecha assim: `effort` é **orientação "soft"**, enquanto `max_tokens` é o **teto rígido** da saída inteira (raciocínio + texto + chamadas de ferramenta). Mais esforço = mais raciocínio = mais tokens — é a sua alavanca direta de custo × qualidade.

- **Prompt caching.** Cacheia a parte estável do contexto (system prompt, documentos fixos) para cortar custo e latência em chamadas repetidas. Veja a tática 7 da Seção 7.

- **Estruturação de documentos.** Ao passar vários documentos, envolva cada um em `<document>` com subtags como `<source>` e `<document_content>`.

- **Console da Anthropic.** Existem ferramentas de *prompt generator* e *prompt improver* que ajudam a criar e refinar prompts — úteis quando você não tem nem um rascunho inicial.

> Quando chegarmos nessa fase, montamos um guia específico de API. Por ora, todas as técnicas das seções anteriores já se aplicam igualzinho.

---

## 9. Erros comuns que geram respostas pífias

Um diagnóstico rápido. Se as suas respostas andam ruins, quase sempre é um destes:

1. **Prompt vago** — esperar que o modelo leia a sua mente. (Solução: Seções 1 e 4.1.)
2. **Não definir o alvo nem testar** — não saber o que é "bom" e mexer no prompt no escuro. (Solução: Seção 2.)
3. **Despejar contexto irrelevante** — encher a janela e causar *context rot*. (Solução: Seções 3 e 7.)
4. **Perguntar tudo de uma vez** — em vez de avançar de forma incremental. (Solução: encadeamento, 6.3.)
5. **Não especificar o formato** — e depois reclamar do formato que veio. (Solução: 4.1.)
6. **Não dar exemplos** quando o formato importa. (Solução: 4.3.)
7. **Dizer o que NÃO fazer** em vez do que fazer. (Solução: 4.7.)
8. **Arrastar uma conversa velha** para um assunto novo. (Solução: 7, tática 1.)

---

## 10. Checklist rápido (cole na parede)

Antes de apertar Enter, passe os olhos:

- [ ] **Alvo:** eu sei o que é uma resposta "boa" aqui e como testaria isso?
- [ ] **Contexto:** um colega sem informação entenderia o meu pedido?
- [ ] **Objetivo:** eu disse claramente o que quero e *por quê*?
- [ ] **Formato:** especifiquei formato e tamanho da resposta?
- [ ] **Exemplos:** se o formato importa, dei de 3 a 5 exemplos?
- [ ] **Estrutura:** separei instrução de dados (tags) quando há mistura?
- [ ] **Positivo:** falei o que *fazer* em vez do que não fazer?
- [ ] **Documento longo:** coloquei o texto no topo e a pergunta no fim?
- [ ] **Verificação:** pedi para o modelo conferir a resposta (em tarefa de raciocínio)?
- [ ] **Código:** se vou parsear a saída, pedi JSON / usei structured outputs ou tool use?
- [ ] **Economia:** este assunto merece uma conversa nova e limpa?

---

*Fim do guia. Os conceitos aqui são sínteses, em português, das diretrizes oficiais da Anthropic — adaptados com analogias e exemplos para estudo. As recomendações de API refletem o modelo atual de raciocínio (adaptive thinking + `effort`); como produtos mudam, confirme os detalhes finos na documentação oficial quando for implementar.*
