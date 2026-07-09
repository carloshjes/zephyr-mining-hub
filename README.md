# Zephyr Mining Hub

Dashboard web pra comunidade que minera **Zephyr (ZEPH)** — RandomX, via XMRig.
Contexto completo do produto em [CLAUDE.md](CLAUDE.md); resultados reais dos
testes de CORS/mixed content em [NOTES.md](NOTES.md).

## Rodando

```bash
npm install
npm run dev      # http://localhost:5173 (proxy da Scanner API incluso)
npm run build    # typecheck + build de produção
npm run preview  # serve o build (também com o proxy)
```

## Módulos

| Rota | Módulo | Status |
|------|--------|--------|
| `/rede` | Pulso da Rede — hashrate, dificuldade, reserve ratio, countdown do halving | ✅ pronto |
| `/pools` | Bússola de Pools — comparador de pools ZEPH | 🚧 placeholder |
| `/recompensa` | Raio-X da Recompensa — split minerador/reserva/yield | 🚧 placeholder |
| `/meu-rig` | Monitor do Rig — XMRig local + stats na pool | 🚧 placeholder |

## Arquitetura (resumo)

- `src/modules/<módulo>/` — um diretório por módulo, montados em `src/App.tsx`.
- `src/lib/api/` — camada de dados tipada (Scanner API, explorer) sobre um
  cliente HTTP com timeout/retry (`http.ts`).
- `src/hooks/usePolling.ts` — polling resiliente compartilhado: mantém o último
  dado bom, erro sempre visível na UI, backoff, pausa com aba oculta.
- `src/components/ui/` — Loading/erro/stat tile compartilhados entre módulos.
- A Scanner API não envia CORS: em dev/preview o Vite faz proxy
  (`/zephyr-api` → `zephyrprotocol.com/api`); produção precisará de rewrite
  equivalente (ver NOTES.md).

## Ferramentas de validação

- `public/cors-test.html` — página que roda os testes reais de CORS/mixed
  content no navegador.
- `scripts/xmrig-sim.mjs` — simulador da API HTTP local do XMRig (porta 18088).
