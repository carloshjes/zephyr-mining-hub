// Screenshots das 4 telas em 3 breakpoints (desktop 1360 / tablet 768 /
// mobile 390) pra revisão de direção visual — Edge headless via CDP, sem
// dependências. Pré-requisito: `npm run dev`. O /meu-rig é semeado com a
// carteira de teste real da 2Miners (mesma do rig-e2e) + xmrig-sim local,
// senão a tela mostraria só o formulário.
//
// Uso: node scripts/design-shots.mjs
// Saída: .e2e-out/shot-<rota>-<breakpoint>.png

import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const PORT = 9226
const BASE = 'http://localhost:5173'

// Mesmo endereço de teste do rig-e2e (ativo na 2Miners em 2026-07-09)
const WALLET_2MINERS =
  'ZEPHYR2DdQMSaghsPgZrE3UGqL2mUsADoPcuJiWRAx4aDi7Q7fwcCRCQ3Ntgeo1fuN4KwPyNNVjY57B91jCHuhjPRnAb6gkdBwy1t'

const ROUTES = [
  { path: '/rede', name: 'rede', ready: `document.body.innerText.includes('H/s') && document.body.innerText.includes('blocos até a recompensa base')` },
  { path: '/pools', name: 'pools', ready: `Array.from(document.querySelectorAll('tbody td')).some((td) => td.innerText.includes('H/s'))` },
  { path: '/recompensa', name: 'recompensa', ready: `document.body.innerText.includes('Agora, de cada bloco de')` },
  { path: '/meu-rig', name: 'meu-rig', ready: `document.querySelectorAll('tbody tr').length > 0` },
]
const BREAKPOINTS = [
  { name: 'desktop', width: 1360, height: 940, scale: 1, mobile: false },
  { name: 'tablet', width: 768, height: 1024, scale: 2, mobile: true },
  { name: 'mobile', width: 390, height: 844, scale: 2, mobile: true },
]

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT_DIR = path.join(ROOT, '.e2e-out')
mkdirSync(OUT_DIR, { recursive: true })

const EDGE = [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
].find((p) => existsSync(p))
if (!EDGE) throw new Error('msedge.exe não encontrado')

const xmrigSim = spawn(process.execPath, [path.join(ROOT, 'scripts', 'xmrig-sim.mjs')], {
  stdio: 'ignore',
})
const edge = spawn(EDGE, [
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${path.join(os.tmpdir(), `zephyr-shots-${Date.now()}`)}`,
  '--headless=new', '--window-size=1360,940', '--no-first-run', 'about:blank',
], { stdio: 'ignore' })
process.on('exit', () => { edge.kill(); xmrigSim.kill() })

async function getWsUrl() {
  for (let i = 0; i < 40; i++) {
    try {
      const list = await fetch(`http://127.0.0.1:${PORT}/json/list`).then((r) => r.json())
      const page = list.find((t) => t.type === 'page')
      if (page) return page.webSocketDebuggerUrl
    } catch { /* Edge subindo */ }
    await new Promise((r) => setTimeout(r, 250))
  }
  throw new Error('Edge não expôs o endpoint de debug')
}
const ws = new WebSocket(await getWsUrl())
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
let msgId = 0
const pending = new Map()
ws.onmessage = (event) => {
  const msg = JSON.parse(event.data)
  if (msg.id && pending.has(msg.id)) {
    const { resolve, reject } = pending.get(msg.id)
    pending.delete(msg.id)
    msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result)
  }
}
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const id = ++msgId
  pending.set(id, { resolve, reject })
  ws.send(JSON.stringify({ id, method, params }))
})
async function evaluate(expression) {
  const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text)
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

// Semeia a config do rig ANTES de navegar pras telas (origem precisa existir)
await send('Page.navigate', { url: `${BASE}/rede` })
await waitFor(`document.readyState === 'complete'`, 20_000, 'primeira carga')
await evaluate(`
  localStorage.setItem('zephyr-hub.rig.config.v1', JSON.stringify({
    poolId: '2miners',
    wallet: '${WALLET_2MINERS}',
    xmrigAddress: '127.0.0.1:18088',
  })); true
`)

for (const route of ROUTES) {
  for (const bp of BREAKPOINTS) {
    await send('Emulation.setDeviceMetricsOverride', {
      width: bp.width, height: bp.height, deviceScaleFactor: bp.scale, mobile: bp.mobile,
    })
    await send('Page.navigate', { url: `${BASE}${route.path}` })
    try {
      await waitFor(route.ready, 45_000, `${route.name} pronto`)
    } catch (err) {
      console.log(`WARN  ${route.name}@${bp.name}: ${err.message} — screenshot do estado atual`)
    }
    await new Promise((r) => setTimeout(r, 1_200))
    const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true })
    const file = `shot-${route.name}-${bp.name}.png`
    writeFileSync(path.join(OUT_DIR, file), Buffer.from(shot.data, 'base64'))
    console.log(`shot  .e2e-out/${file}`)
  }
}
console.log('OK')
process.exit(0)
