// Simulador mínimo da API HTTP local do XMRig (GET /1/summary), usado pra
// validar mixed content/CORS a partir do navegador sem um XMRig real rodando.
// A rota padrão espelha o binário real do XMRig, que envia
// Access-Control-Allow-Origin: * (conferido no código-fonte em 2026-07-08).
// Duas variantes na mesma porta:
//   /1/summary         — COM CORS `*` (comportamento do XMRig real)
//   /nocors/1/summary  — SEM header CORS (pior caso, servidor local qualquer)
import http from 'node:http'

const PORT = 18088
const startedAt = Date.now()

// Payload no formato real do /1/summary (subconjunto que o app consome);
// uptime avança de verdade pra parecer um processo vivo
function summary() {
  return JSON.stringify({
    id: 'sim-xmrig',
    version: '6.22.0-sim',
    worker_id: 'rig-simulado',
    hashrate: { total: [1234.5, 1230.1, 1228.9] },
    results: { shares_good: 42, shares_total: 43 },
    uptime: 3600 + Math.floor((Date.now() - startedAt) / 1000),
  })
}

http
  .createServer((req, res) => {
    const headers = { 'Content-Type': 'application/json' }
    if (!req.url?.startsWith('/nocors')) headers['Access-Control-Allow-Origin'] = '*'
    res.writeHead(200, headers)
    res.end(summary())
  })
  .listen(PORT, '127.0.0.1', () => {
    console.log(`XMRig simulado em http://127.0.0.1:${PORT}`)
  })
