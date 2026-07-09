// Simulador mínimo da API HTTP local do XMRig (GET /1/summary), usado pra
// validar mixed content/CORS a partir do navegador sem um XMRig real rodando.
// Duas variantes na mesma porta:
//   /1/summary       — SEM header CORS (pior caso)
//   /cors/1/summary  — COM Access-Control-Allow-Origin: * (melhor caso)
import http from 'node:http'

const PORT = 18088

const summary = JSON.stringify({
  id: 'sim-xmrig',
  version: '6.22.0-sim',
  hashrate: { total: [1234.5, 1230.1, 1228.9] },
  results: { shares_good: 42, shares_total: 43 },
  uptime: 3600,
})

http
  .createServer((req, res) => {
    const headers = { 'Content-Type': 'application/json' }
    if (req.url?.startsWith('/cors')) headers['Access-Control-Allow-Origin'] = '*'
    res.writeHead(200, headers)
    res.end(summary)
  })
  .listen(PORT, '127.0.0.1', () => {
    console.log(`XMRig simulado em http://127.0.0.1:${PORT}`)
  })
