// Screenshots da exploração de logo (scripts/logo-preview.html) — mesmo padrão
// CDP-sem-dependências do design-shots.mjs, com duas diferenças:
// - a página é autocontida e abre via file:// (não precisa de `npm run dev`);
// - além do msedge.exe do Windows, aceita LOGO_SHOTS_BROWSER apontando pra um
//   chrome/chromium/headless-shell (foi assim que rodou no Linux da exploração).
//
// Uso: node scripts/logo-shots.mjs
// Saída: .e2e-out/logo/preview-<cor>[@2x].png + strip-<variação>.png (crops
//        das faixas 32/24/16px + lupa, pra julgar legibilidade pequena)

import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const PORT = 9227
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT_DIR = path.join(ROOT, '.e2e-out', 'logo')
mkdirSync(OUT_DIR, { recursive: true })

// LOGO_SHOTS_PAGE: caminho alternativo pro html (útil quando a cópia local
// difere do repo — ex.: sandbox desta exploração)
const PAGE = pathToFileURL(
  process.env.LOGO_SHOTS_PAGE
    ? path.resolve(process.env.LOGO_SHOTS_PAGE)
    : path.join(ROOT, 'scripts', 'logo-preview.html'),
).href

const BROWSER = [
  process.env.LOGO_SHOTS_BROWSER,
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  '/usr/bin/google-chrome',
].filter(Boolean).find((p) => existsSync(p))
if (!BROWSER) throw new Error('nenhum browser encontrado — defina LOGO_SHOTS_BROWSER')

const browser = spawn(BROWSER, [
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${path.join(os.tmpdir(), `logo-shots-${Date.now()}`)}`,
  // --no-sandbox/--disable-gpu: exigidos em container Linux; inócuos no Edge headless
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
    await new Promise((r) => setTimeout(r, 300))
  }
  throw new Error(`timeout esperando: ${label}`)
}

await send('Page.enable')

// Página inteira nas duas cores de ponto; mist também em 2× (tela retina)
const MODES = [
  { dots: 'mist', scale: 1, file: 'preview-mist.png' },
  { dots: 'mist', scale: 2, file: 'preview-mist@2x.png' },
  { dots: 'zeph', scale: 1, file: 'preview-zeph.png' },
]
for (const mode of MODES) {
  await send('Emulation.setDeviceMetricsOverride', {
    width: 1240, height: 1000, deviceScaleFactor: mode.scale, mobile: false,
  })
  await send('Page.navigate', { url: `${PAGE}?dots=${mode.dots}` })
  try {
    await waitFor('window.__logoPreviewReady === true', 20_000, `preview pronto (${mode.dots})`)
  } catch (err) {
    console.log(`WARN  ${mode.file}: ${err.message} — screenshot do estado atual`)
  }
  await new Promise((r) => setTimeout(r, 400))
  const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true })
  writeFileSync(path.join(OUT_DIR, mode.file), Buffer.from(shot.data, 'base64'))
  console.log(`shot  .e2e-out/logo/${mode.file}`)

  // Crops das faixas pequenas (32/24/16 + lupa) — só no mist @1x, que é o
  // cenário honesto pra julgar legibilidade em tamanho de aba/navegação
  if (mode.dots === 'mist' && mode.scale === 1) {
    const strips = await evaluate(`JSON.stringify(
      Array.from(document.querySelectorAll('[data-strip]')).map((el) => {
        const r = el.getBoundingClientRect()
        return { id: el.dataset.strip, x: r.x + window.scrollX, y: r.y + window.scrollY, w: r.width, h: r.height }
      })
    )`)
    for (const s of JSON.parse(strips)) {
      const crop = await send('Page.captureScreenshot', {
        format: 'png', captureBeyondViewport: true,
        clip: { x: s.x, y: s.y, width: s.w, height: s.h, scale: 1 },
      })
      writeFileSync(path.join(OUT_DIR, `strip-${s.id}.png`), Buffer.from(crop.data, 'base64'))
      console.log(`shot  .e2e-out/logo/strip-${s.id}.png`)
    }
  }
}
console.log('OK')
process.exit(0)
