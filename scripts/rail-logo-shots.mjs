// Estudo de tamanho da marca no shell de navegação — mesma técnica "lupa"
// nearest-neighbor do logo-shots.mjs, mas sobre o APP REAL (não a página de
// preview): redimensiona o SVG do LogoMark ao vivo em cada tamanho candidato,
// captura o crop em ×1 (régua honesta — retina esconderia o problema) e amplia
// os MESMOS pixels ×4 com imageSmoothingEnabled=false (não é re-render maior).
// Serve tanto pra decidir o tamanho (pré-rail, logo no header horizontal)
// quanto pra evidência final (pós-rail, logo no aside) — o seletor acha o SVG
// da marca onde ele estiver. Pré-requisito: `npm run dev`.
//
// Uso: node scripts/rail-logo-shots.mjs
// Saída: .e2e-out/logo/rail-<tamanho>px.png (+ -lupa4x.png) e rail-context.png

import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const PORT = 9228
const APP_URL = 'http://localhost:5173/rede'
const SIZES = [64, 80, 96, 112, 128]

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT_DIR = path.join(ROOT, '.e2e-out', 'logo')
mkdirSync(OUT_DIR, { recursive: true })

const EDGE = [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
].find((p) => existsSync(p))
if (!EDGE) throw new Error('msedge.exe não encontrado')

const edge = spawn(EDGE, [
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${path.join(os.tmpdir(), `rail-logo-${Date.now()}`)}`,
  '--headless=new', '--window-size=1360,940', '--no-first-run', 'about:blank',
], { stdio: 'ignore' })
process.on('exit', () => edge.kill())

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
    const { resolve, reject, method } = pending.get(msg.id)
    pending.delete(msg.id)
    if (msg.error) reject(new Error(`${method}: ${msg.error.message}`))
    else resolve(msg.result)
  }
}
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const id = ++msgId
  pending.set(id, { resolve, reject, method })
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
    await new Promise((r) => setTimeout(r, 300))
  }
  throw new Error(`timeout esperando: ${label}`)
}

await send('Page.enable')
// deviceScaleFactor 1 de propósito: a régua conservadora da exploração de logo
// é o ×1 — retina (×2) dobra os pixels reais e mascara o piso de legibilidade
await send('Emulation.setDeviceMetricsOverride', {
  width: 1360, height: 940, deviceScaleFactor: 1, mobile: false,
})
await send('Page.navigate', { url: APP_URL })

// O SVG da marca: no aside (rail) quando existir, senão no header horizontal.
// Os gráficos do módulo também são <svg>, por isso o escopo no landmark.
const LOGO = `(document.querySelector('aside svg') || document.querySelector('header svg'))`
await waitFor(`Boolean(${LOGO})`, 20_000, 'LogoMark na tela')

async function cropPng(rect) {
  const shot = await send('Page.captureScreenshot', {
    format: 'png',
    clip: { x: rect.x, y: rect.y, width: rect.w, height: rect.h, scale: 1 },
  })
  return shot.data
}
// Lupa honesta: amplia o PNG já capturado (os mesmos pixels), no próprio
// navegador, com nearest-neighbor — mesma receita do logo-preview.html.
async function magnify4x(pngBase64) {
  return evaluate(`(async () => {
    const img = new Image()
    img.src = 'data:image/png;base64,${pngBase64}'
    await img.decode()
    const c = document.createElement('canvas')
    c.width = img.width * 4
    c.height = img.height * 4
    const ctx = c.getContext('2d')
    ctx.imageSmoothingEnabled = false
    ctx.drawImage(img, 0, 0, c.width, c.height)
    return c.toDataURL('image/png').split(',')[1]
  })()`)
}

// Tamanho como está no código (referência do "antes") + candidatos
const current = await evaluate(`${LOGO}.getBoundingClientRect().width`)
for (const size of [Math.round(current), ...SIZES.filter((s) => s !== Math.round(current))]) {
  const rect = await evaluate(`(() => {
    const svg = ${LOGO}
    svg.setAttribute('width', ${size})
    svg.setAttribute('height', ${size})
    const r = svg.getBoundingClientRect()
    // 8px de respiro pra lupa mostrar a borda do ponto contra o fundo
    return { x: Math.max(0, r.x - 8), y: Math.max(0, r.y - 8), w: r.width + 16, h: r.height + 16 }
  })()`)
  const png = await cropPng(rect)
  writeFileSync(path.join(OUT_DIR, `rail-${size}px.png`), Buffer.from(png, 'base64'))
  const big = await magnify4x(png)
  writeFileSync(path.join(OUT_DIR, `rail-${size}px-lupa4x.png`), Buffer.from(big, 'base64'))
  console.log(`shot  .e2e-out/logo/rail-${size}px.png (+ lupa ×4)`)
}

// Restaura o tamanho do código e fotografa o shell em contexto (viewport toda)
await evaluate(`(() => {
  const svg = ${LOGO}
  svg.setAttribute('width', ${Math.round(current)})
  svg.setAttribute('height', ${Math.round(current)})
})()`)
const context = await send('Page.captureScreenshot', { format: 'png' })
writeFileSync(path.join(OUT_DIR, 'rail-context.png'), Buffer.from(context.data, 'base64'))
console.log('shot  .e2e-out/logo/rail-context.png')
console.log('OK')
process.exit(0)
