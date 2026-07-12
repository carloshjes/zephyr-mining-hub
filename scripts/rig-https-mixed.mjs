// Teste de MIXED CONTENT do Monitor do Rig: página em HTTPS (como no Vercel)
// buscando a API local do XMRig em http://127.0.0.1 — o cenário que a Fase 0
// deixou pendente (lá só foi testado a partir de página em http://localhost).
//
// Pré-requisito: `npm run build` (o script serve o dist/ em HTTPS local com
// certificado self-signed gerado na hora via openssl; o Edge headless roda com
// --ignore-certificate-errors só por causa do certificado — a política de
// mixed content independe da validade do cert).
//
// Uso: node scripts/rig-https-mixed.mjs
// Resultado observado vai pro NOTES.md (seção do Prompt 4).

import { spawn, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import https from 'node:https'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const DIST = path.join(ROOT, 'dist')
const OUT_DIR = path.join(ROOT, '.e2e-out')
const HTTPS_PORT = 8443
const CDP_PORT = 9225
const APP_URL = `https://localhost:${HTTPS_PORT}/meu-rig`

// Carteira real e ativa na 2Miners (mesma do rig-e2e.mjs)
const WALLET =
  'ZEPHYR2DdQMSaghsPgZrE3UGqL2mUsADoPcuJiWRAx4aDi7Q7fwcCRCQ3Ntgeo1fuN4KwPyNNVjY57B91jCHuhjPRnAb6gkdBwy1t'

if (!existsSync(path.join(DIST, 'index.html'))) {
  throw new Error('dist/ não existe — rode `npm run build` antes')
}
mkdirSync(OUT_DIR, { recursive: true })

// --- certificado self-signed descartável -----------------------------------
const certDir = path.join(os.tmpdir(), `zephyr-https-${Date.now()}`)
mkdirSync(certDir, { recursive: true })
const keyPath = path.join(certDir, 'key.pem')
const certPath = path.join(certDir, 'cert.pem')
const openssl = spawnSync('openssl', [
  'req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '2',
  '-keyout', keyPath, '-out', certPath, '-subj', '/CN=localhost',
], { stdio: 'pipe' })
if (openssl.status !== 0) {
  throw new Error(`openssl falhou: ${openssl.stderr?.toString()}`)
}

// --- servidor HTTPS estático com fallback de SPA ---------------------------
const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon',
}
const server = https.createServer(
  { key: readFileSync(keyPath), cert: readFileSync(certPath) },
  (req, res) => {
    const urlPath = decodeURIComponent((req.url ?? '/').split('?')[0])
    let filePath = path.join(DIST, urlPath)
    if (!existsSync(filePath) || !path.extname(filePath)) filePath = path.join(DIST, 'index.html')
    try {
      const body = readFileSync(filePath)
      res.writeHead(200, { 'Content-Type': MIME[path.extname(filePath)] ?? 'application/octet-stream' })
      res.end(body)
    } catch {
      res.writeHead(404)
      res.end()
    }
  },
)
server.listen(HTTPS_PORT, '127.0.0.1')

// --- XMRig simulado (CORS na rota padrão, como o binário real) --------------
const xmrigSim = spawn(process.execPath, [path.join(ROOT, 'scripts', 'xmrig-sim.mjs')], {
  stdio: 'ignore',
})

// --- Edge headless via CDP ---------------------------------------------------
const EDGE_CANDIDATES = [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
]
const EDGE = EDGE_CANDIDATES.find((p) => existsSync(p))
if (!EDGE) throw new Error('msedge.exe não encontrado — ajuste EDGE_CANDIDATES')

const PROFILE_DIR = path.join(os.tmpdir(), `zephyr-mixed-e2e-${Date.now()}`)
const edge = spawn(EDGE, [
  `--remote-debugging-port=${CDP_PORT}`,
  `--user-data-dir=${PROFILE_DIR}`,
  '--headless=new',
  '--window-size=1360,1100',
  '--no-first-run',
  '--ignore-certificate-errors',
  'about:blank',
], { stdio: 'ignore' })
process.on('exit', () => {
  edge.kill()
  xmrigSim.kill()
  server.close()
})

const failures = []
function check(name, ok, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`)
  if (!ok) failures.push(name)
}

async function getWsUrl() {
  for (let i = 0; i < 40; i++) {
    try {
      const list = await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`).then((r) => r.json())
      const page = list.find((t) => t.type === 'page')
      if (page) return page.webSocketDebuggerUrl
    } catch { /* Edge ainda subindo */ }
    await new Promise((r) => setTimeout(r, 250))
  }
  throw new Error('Edge não expôs o endpoint de debug')
}

const ws = new WebSocket(await getWsUrl())
await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject })

let msgId = 0
const pending = new Map()
const consoleMessages = []
ws.onmessage = (event) => {
  const msg = JSON.parse(event.data)
  if (msg.id && pending.has(msg.id)) {
    const { resolve, reject } = pending.get(msg.id)
    pending.delete(msg.id)
    if (msg.error) reject(new Error(msg.error.message))
    else resolve(msg.result)
  }
  // Coleta avisos do navegador — bloqueio de mixed content aparece aqui
  if (msg.method === 'Log.entryAdded') consoleMessages.push(msg.params.entry)
}
function send(method, params = {}) {
  const id = ++msgId
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject })
    ws.send(JSON.stringify({ id, method, params }))
  })
}
async function evaluate(expression) {
  const result = await send('Runtime.evaluate', {
    expression, returnByValue: true, awaitPromise: true,
  })
  if (result.exceptionDetails) {
    throw new Error(`${result.exceptionDetails.text} ${result.exceptionDetails.exception?.description ?? ''}`)
  }
  return result.result.value
}
async function waitFor(expression, timeoutMs, label) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    if (await evaluate(expression)) return
    await new Promise((r) => setTimeout(r, 400))
  }
  throw new Error(`timeout esperando: ${label}`)
}

await send('Page.enable')
await send('Log.enable')
await send('Page.navigate', { url: APP_URL })
await waitFor(`document.readyState === 'complete' && location.protocol === 'https:'`, 20_000, 'página HTTPS carregada')
check('página servida em HTTPS', await evaluate(`location.protocol`) === 'https:')

// --- Sonda 1: fetch direto https→http, rota COM CORS (XMRig real) -----------
const probeCors = await evaluate(`
  fetch('http://127.0.0.1:18088/1/summary')
    .then((r) => r.json())
    .then((j) => 'OK hashrate=' + j.hashrate.total[0])
    .catch((e) => 'ERRO: ' + e.message)
`)
check('fetch https→http://127.0.0.1 COM CORS (XMRig real)', probeCors.startsWith('OK'), probeCors)

// --- Sonda 2: rota SEM CORS (pior caso de servidor local qualquer) ----------
const probeNoCors = await evaluate(`
  fetch('http://127.0.0.1:18088/nocors/1/summary')
    .then((r) => 'OK inesperado')
    .catch((e) => 'ERRO: ' + e.message)
`)
check('fetch sem CORS continua bloqueado (regressão esperada)', probeNoCors.startsWith('ERRO'), probeNoCors)

// --- Fluxo real do módulo: config salva → seção XMRig com dado --------------
await evaluate(`
  localStorage.setItem('zephyr-hub.rig.config.v1', JSON.stringify({
    poolId: '2miners', wallet: '${WALLET}', xmrigAddress: '127.0.0.1:18088',
  }));
  location.reload(); true
`)
await waitFor(`document.body.innerText.includes('XMRig uptime')`, 25_000, 'seção do XMRig com dado')
check('módulo mostra hashrate local na página HTTPS',
  await evaluate(`document.body.innerText.includes('1.23 kH/s')`))
// A pool responde depois do XMRig local — espera as linhas da tabela
await waitFor(`document.querySelectorAll('tbody tr').length > 0`, 30_000, 'dados da pool na página HTTPS')
check('dados da pool também carregam (CORS remoto ok em HTTPS)', true)

const mixedContentLogs = consoleMessages.filter((entry) => /mixed content/i.test(entry.text ?? ''))
console.log(`\navisos de mixed content no console: ${mixedContentLogs.length}`)
for (const entry of mixedContentLogs.slice(0, 5)) console.log(`  [${entry.level}] ${entry.text}`)

const shot = await send('Page.captureScreenshot', { format: 'png' })
writeFileSync(path.join(OUT_DIR, 'rig-https-mixed.png'), Buffer.from(shot.data, 'base64'))
console.log(`screenshot: ${path.join(OUT_DIR, 'rig-https-mixed.png')}`)

ws.close()
edge.kill()
xmrigSim.kill()
server.close()
console.log(failures.length === 0 ? '\nTUDO PASSOU' : `\nFALHAS: ${failures.length}`)
process.exit(failures.length === 0 ? 0 : 1)
