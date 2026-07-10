// Export da logo escolhida (F3 · cintilância, revisão sem branco) a partir do
// GERADOR REAL (scripts/logo-preview.html) — nada é reaproximado à mão. Mesmo
// padrão CDP-sem-dependências do logo-shots.mjs, via file:// e SEM ?anim=1.
//
// Saída (.e2e-out/logo/, regenerável):
// - f3-dots.json: pontos da F3 do card "F3 · CINTILÂNCIA" (x/y/tom por rect do
//   SVG renderizado + rampa de tokens + hex resolvidos) — insumo do LogoMark.
// - favicon-mist.svg / favicon-zeph.svg: o Z̶ SÓLIDO (card CONTROLE, 16px) com
//   o token resolvido pra hex — favicon vive FORA da cascata do app, var() não
//   resolve lá. Os dois candidatos saem pra decisão de olho na aba real.
//
// Uso: node scripts/logo-export.mjs

import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const PORT = 9228
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT_DIR = path.join(ROOT, '.e2e-out', 'logo')
mkdirSync(OUT_DIR, { recursive: true })

const PAGE = pathToFileURL(path.join(ROOT, 'scripts', 'logo-preview.html')).href

const BROWSER = [
  process.env.LOGO_SHOTS_BROWSER,
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/chromium',
  '/usr/bin/google-chrome',
].filter(Boolean).find((p) => existsSync(p))
if (!BROWSER) throw new Error('nenhum browser encontrado — defina LOGO_SHOTS_BROWSER')

const browser = spawn(BROWSER, [
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${path.join(os.tmpdir(), `logo-export-${Date.now()}`)}`,
  '--headless=new', '--no-sandbox', '--disable-gpu',
  '--window-size=1240,1000', '--no-first-run', 'about:blank',
], { stdio: 'ignore' })
process.on('exit', () => browser.kill())

async function getWsUrl() {
  for (let i = 0; i < 40; i++) {
    try {
      const list = await fetch(`http://127.0.0.1:${PORT}/json/list`).then((r) => r.json())
      const page = list.find((t) => t.type === 'page')
      if (page) return page.webSocketDebuggerUrl
    } catch { /* browser subindo */ }
    await new Promise((r) => setTimeout(r, 250))
  }
  throw new Error('browser não expôs o endpoint de debug')
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
    if (msg.error) reject(new Error(msg.error.message))
    else resolve(msg.result)
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
    await new Promise((r) => setTimeout(r, 300))
  }
  throw new Error(`timeout esperando: ${label}`)
}

await send('Page.enable')
// SEM ?anim=1 — export é 100% estático (a cintilação é só da página de preview)
await send('Page.navigate', { url: PAGE })
await waitFor('window.__logoPreviewReady === true', 20_000, 'preview pronto')

const payload = JSON.parse(await evaluate(`JSON.stringify((() => {
  const styles = getComputedStyle(document.documentElement)
  const hexOf = (v) => styles.getPropertyValue(v).trim()

  // F3: o SVG hero já renderizado do card "F3 · CINTILÂNCIA"
  const f3Card = document.querySelector('[data-strip="f3"]').closest('.card')
  const f3Svg = f3Card.querySelector('.hero svg')
  const rects = Array.from(f3Svg.querySelectorAll('rect')).map((r) => ({
    x: r.getAttribute('x'),
    y: r.getAttribute('y'),
    w: r.getAttribute('width'),
    h: r.getAttribute('height'),
    opacity: r.getAttribute('opacity'),
    fillVar: (r.getAttribute('style') || '').match(/var\\((--[a-z0-9-]+)\\)/)?.[1] ?? null,
    // classes twN vêm do assignTwinkle (roda sempre) — registradas aqui pra
    // PROVAR que o export as descarta (o LogoMark não as reproduz)
    twinkleClass: r.getAttribute('class'),
  }))

  // Sólido: o card CONTROLE tem solidSvg em 32/24/16 — pegamos o de 16px
  const ctrlSvgs = document.querySelector('[data-strip="controle"]').querySelectorAll('svg')
  const solid16 = ctrlSvgs[2].outerHTML

  return {
    viewBox: f3Svg.getAttribute('viewBox'),
    dotCount: rects.length,
    rects,
    solid16,
    hex: {
      'mist-100': hexOf('--color-mist-100'),
      'mist-300': hexOf('--color-mist-300'),
      'mist-400': hexOf('--color-mist-400'),
      'zeph-300': hexOf('--color-zeph-300'),
      'zeph-500': hexOf('--color-zeph-500'),
      'zeph-700': hexOf('--color-zeph-700'),
    },
    statusLine: document.getElementById('status').textContent,
  }
})())`))

// Sanidade do export antes de gravar qualquer coisa
const RAMP = ['--color-mist-300', '--color-zeph-300', '--color-mist-400', '--color-zeph-500', '--color-zeph-700']
const badTone = payload.rects.filter((r) => !RAMP.includes(r.fillVar))
const withOpacity = payload.rects.filter((r) => r.opacity !== null)
const twinkled = payload.rects.filter((r) => r.twinkleClass !== null)
if (payload.viewBox !== '0 0 22 22') throw new Error(`viewBox inesperado: ${payload.viewBox}`)
if (badTone.length > 0) throw new Error(`${badTone.length} rect(s) fora da rampa semBranco`)
if (withOpacity.length > 0) throw new Error(`${withOpacity.length} rect(s) com opacity (glitch?) — F3 não tem`)

const dots = payload.rects.map((r) => [Number(r.x), Number(r.y), RAMP.indexOf(r.fillVar)])
writeFileSync(path.join(OUT_DIR, 'f3-dots.json'), JSON.stringify({
  source: 'scripts/logo-preview.html · card F3 · CINTILÂNCIA (rev sem branco)',
  params: 'FINAL_PARAMS 22×22 quadrado t=.18 barra=haste · sparkle seed 11 · pesos [.30,.28,.20,.15,.07]',
  viewBox: payload.viewBox,
  dotSide: payload.rects[0].w,
  ramp: RAMP,
  hex: payload.hex,
  dotCount: payload.dotCount,
  twinkleClassesDescartadas: twinkled.length,
  dots,
}, null, 1))
console.log(`f3: ${payload.dotCount} pts, lado ${payload.rects[0].w}, ${twinkled.length} classes twN descartadas`)
console.log(`status da página: ${payload.statusLine.slice(0, 120)}…`)

// Favicon: sólido 16px com token resolvido (fora da cascata do app). Remove o
// role/aria-label do preview (ícone de documento não precisa) e o var(--dot).
for (const [name, token] of [['mist', 'mist-100'], ['zeph', 'zeph-300']]) {
  const svg = payload.solid16
    .replace(' role="img" aria-label="Z barrado sólido"', '')
    .replace('<g style="fill:var(--dot)">', `<g fill="${payload.hex[token]}">`)
  writeFileSync(path.join(OUT_DIR, `favicon-${name}.svg`), `${svg}\n`)
  console.log(`favicon-${name}.svg: ${token} → ${payload.hex[token]}`)
}
console.log('OK')
process.exit(0)
