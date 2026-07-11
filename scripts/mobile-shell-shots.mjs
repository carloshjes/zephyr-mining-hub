// Estudo do bloco de navegação mobile (< xl) — mesma técnica "lupa"
// nearest-neighbor do rail-logo-shots.mjs, mas no viewport estreito e com
// MEDIÇÃO de custo vertical: além do crop ×1 + lupa ×4 do logo em cada
// tamanho candidato, mede a altura do bloco inteiro contra um viewport de
// 390×700 (altura real de celular pequeno) — o rail empilha à vontade porque
// tem a viewport inteira; aqui o bloco compete com o conteúdo logo abaixo.
// Também mede o custo hipotético do empilhamento 1:1 do rail (logo 128 +
// wordmark + nav na vertical), lido do rail REAL em xl. Pré-requisito:
// `npm run dev`.
//
// Uso: node scripts/mobile-shell-shots.mjs
// Saída: .e2e-out/logo/mobile-<tamanho>px.png (+ -lupa4x.png),
//        mobile-context-390.png, mobile-context-768.png + medições no stdout

import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const PORT = 9229
const APP_URL = 'http://localhost:5173/rede'
const SIZES = [64, 80, 96, 112]

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
  `--user-data-dir=${path.join(os.tmpdir(), `mobile-shell-${Date.now()}`)}`,
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

// ---------- custo hipotético do empilhamento 1:1 (rail real em xl) ----------
await send('Emulation.setDeviceMetricsOverride', {
  width: 1360, height: 940, deviceScaleFactor: 1, mobile: false,
})
await send('Page.navigate', { url: APP_URL })
await waitFor(`Boolean(document.querySelector('aside svg'))`, 20_000, 'rail na tela')
const railStack = await evaluate(`(() => {
  const svg = document.querySelector('aside svg')
  const nav = document.querySelector('aside nav')
  const aside = svg.closest('aside')
  const pad = parseFloat(getComputedStyle(aside).paddingTop)
  // do topo do logo ao fim do nav + os dois respiros do padding do rail —
  // a altura que o bloco 1:1 ocuparia se fosse deitado no topo do mobile
  return Math.round(nav.getBoundingClientRect().bottom - svg.getBoundingClientRect().top + 2 * pad)
})()`)
console.log(`empilhamento 1:1 do rail (logo→wordmark→nav + respiros): ${railStack}px — ${Math.round(railStack / 700 * 100)}% de um viewport de 700px`)

// ---------- bloco mobile a 390×700 ----------
// deviceScaleFactor 1 de propósito: a régua conservadora da exploração de
// logo é o ×1 — retina (×2/×3, universal em celular) só melhora o quadro
await send('Emulation.setDeviceMetricsOverride', {
  width: 390, height: 700, deviceScaleFactor: 1, mobile: true,
})
await send('Page.navigate', { url: APP_URL })
// o aside segue no DOM (display:none) — o seletor mira o header do bloco
const LOGO = `document.querySelector('header svg')`
await waitFor(`Boolean(${LOGO})`, 20_000, 'LogoMark no bloco mobile')

async function cropPng(rect) {
  const shot = await send('Page.captureScreenshot', {
    format: 'png',
    clip: { x: rect.x, y: rect.y, width: rect.w, height: rect.h, scale: 1 },
  })
  return shot.data
}
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

const current = Math.round(await evaluate(`${LOGO}.getBoundingClientRect().width`))
for (const size of [...new Set([current, ...SIZES])]) {
  const m = await evaluate(`(() => {
    const svg = ${LOGO}
    svg.setAttribute('width', ${size})
    svg.setAttribute('height', ${size})
    const r = svg.getBoundingClientRect()
    const header = svg.closest('header')
    return {
      x: Math.max(0, r.x - 8), y: Math.max(0, r.y - 8), w: r.width + 16, h: r.height + 16,
      headerH: Math.round(header.getBoundingClientRect().height),
    }
  })()`)
  const png = await cropPng(m)
  writeFileSync(path.join(OUT_DIR, `mobile-${size}px.png`), Buffer.from(png, 'base64'))
  const big = await magnify4x(png)
  writeFileSync(path.join(OUT_DIR, `mobile-${size}px-lupa4x.png`), Buffer.from(big, 'base64'))
  console.log(`logo ${size}px → bloco ${m.headerH}px (${Math.round(m.headerH / 700 * 100)}% de 700px) — shot .e2e-out/logo/mobile-${size}px.png (+ lupa ×4)`)
}

// Restaura o tamanho do código e confere o agrupamento do nav (grade 2×2 a
// 390: exatamente 2 tops distintos; linha única em md+: 1 top)
await evaluate(`(() => {
  const svg = ${LOGO}
  svg.setAttribute('width', ${current})
  svg.setAttribute('height', ${current})
})()`)
const navRows390 = await evaluate(`new Set(Array.from(document.querySelectorAll('header nav a')).map((a) => Math.round(a.getBoundingClientRect().top))).size`)
console.log(`nav a 390px: ${navRows390} linha(s)`) // esperado: 2 (grade 2×2)
const ctx390 = await send('Page.captureScreenshot', { format: 'png' })
writeFileSync(path.join(OUT_DIR, 'mobile-context-390.png'), Buffer.from(ctx390.data, 'base64'))
console.log('shot  .e2e-out/logo/mobile-context-390.png')

await send('Emulation.setDeviceMetricsOverride', {
  width: 768, height: 1024, deviceScaleFactor: 1, mobile: true,
})
await new Promise((r) => setTimeout(r, 400))
const m768 = await evaluate(`(() => {
  const header = document.querySelector('header')
  const rows = new Set(Array.from(document.querySelectorAll('header nav a')).map((a) => Math.round(a.getBoundingClientRect().top))).size
  return { headerH: Math.round(header.getBoundingClientRect().height), rows }
})()`)
console.log(`768px: bloco ${m768.headerH}px · nav em ${m768.rows} linha(s)`) // esperado: 1
const ctx768 = await send('Page.captureScreenshot', { format: 'png' })
writeFileSync(path.join(OUT_DIR, 'mobile-context-768.png'), Buffer.from(ctx768.data, 'base64'))
console.log('shot  .e2e-out/logo/mobile-context-768.png')
console.log('OK')
process.exit(0)
