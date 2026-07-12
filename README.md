# Zephyr Mining Hub

Dashboard web para a comunidade que minera **Zephyr (ZEPH)** com RandomX/XMRig. Os quatro módulos formam um único produto, unidos pela mesma navegação e pela direção visual **Sinal Técnico**, com temas escuro e claro.

| Rota | Módulo | O que acompanha |
| --- | --- | --- |
| `/rede` | Network Pulse | Hashrate, dificuldade, reserve ratio e halving |
| `/pools` | Pool Compass | Comparação das pools ZEPH ativas |
| `/recompensa` | Reward X-Ray | Divisão do prêmio entre minerador, reserva, yield e governança |
| `/meu-rig` | Rig Monitor | XMRig local, dados da carteira/pool e ganho diário estimado |

O produto visível ao visitante é integralmente em inglês. A documentação de trabalho — `CLAUDE.md`, `NOTES.md`, `docs/` e comentários do código — permanece em português.

## Rodando localmente

```bash
npm install
npm run dev      # http://localhost:5173; inclui o proxy da Scanner API
npm run lint
npm run build    # typecheck + build de produção
npm run preview
```

A Zephyr Scanner API não libera CORS. Em desenvolvimento e preview o Vite encaminha `/zephyr-api`; o deploy no Vercel precisa do rewrite equivalente. As APIs do Explorer, das pools integradas e do XMRig passam pelas camadas tipadas em `src/lib/api/`.

## Estrutura e verificação

- `src/modules/` mantém os quatro módulos independentes; `src/components/`, `src/hooks/` e `src/lib/` concentram a casca e as abstrações compartilhadas.
- `src/index.css` centraliza os tokens dos temas escuro/claro; componentes não usam cores hexadecimais soltas.
- `scripts/design-shots.mjs` captura as quatro telas em três breakpoints e nos dois temas.
- `scripts/*-e2e.mjs` cobre pools, recompensas, rig e tema, incluindo cenários degradados.
- `scripts/contrast-check.mjs` mede os contrastes do sistema contra os critérios WCAG 2.2 adotados pelo projeto.
- `docs/` reúne auditorias, decisões de produto, handoff e material histórico. O contexto corrente e as evidências de teste ficam em [CLAUDE.md](CLAUDE.md) e [NOTES.md](NOTES.md).
