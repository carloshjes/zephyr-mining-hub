// Teste E2E da troca de tema em Edge headless via CDP — sem dependências
// (WebSocket nativo do Node >= 22). Pré-requisito: `npm run dev` rodando.
//
// Contrato (rodada do 2º tema, 2026-07-12 · glifo 2026-07-12):
// 1. Default = ESCURO, sem atributo data-theme (identidade do produto; os
//    demais e2e verificam cor computada assumindo este default).
// 2. O botão de tema aplica [data-theme='light'] no <html> e os tokens fluem
//    (bg computado do body vira o ink-950 claro). O botão virou um GLIFO
//    (sol/estrelas) no lugar do rótulo mono `[ TEMA · … ]`: o estado ATUAL agora
//    se lê pelo desenho, e a verificação migrou do innerText pro aria-label —
//    que declara a AÇÃO oferecida ("Mudar pro tema claro" quando escuro,
//    "…escuro" quando claro), logo determina o estado corrente. Mudança
//    DELIBERADA de canal (texto → glifo+aria), espelhando o que o R5 fez com
//    a procedência da tendência; as 4 garantias de tema abaixo NÃO mudaram.
// 3. Persistência: reload mantém o claro SEM flash (o inline script do
//    index.html aplica o atributo antes do paint — verificado aqui lendo o
//    atributo já no primeiro poll após a navegação).
// 4. Segundo clique volta pro escuro (atributo REMOVIDO, não 'dark') e
//    persiste 'dark' no localStorage.
//
// Uso: node scripts/theme-e2e.mjs
// Screenshot em .e2e-out/ (ignorado pelo git).

import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const APP_URL = 'http://localhost:5173/rede'
const PORT = 9227

const OUT_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '.e2e-out')
const PROFILE_DIR = path.join(os.tmpdir(), `zephyr-theme-e2e-${Date.now()}`)
mkdirSync(OUT_DIR, { recursive: true })

const EDGE_CANDIDATES = [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
]
const EDGE = EDGE_CANDIDATES.find((p) => existsSync(p))
if (!EDGE) throw new Error('msedge.exe não encontrado — ajuste EDGE_CANDIDATES')

const edge = spawn(EDGE, [
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${PROFILE_DIR}`,
  '--headless=new',
  // Edge 150 encerra o CDP headless com 0x80000003 sem esta flag nesta máquina.
  '--no-sandbox',
  '--window-size=1360,940',
  '--no-first-run',
  'about:blank',
], { stdio: 'ignore' })
process.on('exit', () => edge.kill())

const failures = []
function check(name, ok, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`)
  if (!ok) failures.push(name)
}

async function getWsUrl() {
  for (let i = 0; i < 40; i++) {
    try {
      const list = await fetch(`http://127.0.0.1:${PORT}/json/list`).then((r) => r.json())
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
ws.onmessage = (event) => {
  const msg = JSON.parse(event.data)
  if (msg.id && pending.has(msg.id)) {
    const { resolve, reject } = pending.get(msg.id)
    pending.delete(msg.id)
    if (msg.error) reject(new Error(msg.error.message))
    else resolve(msg.result)
  }
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

// O canal do estado é o glifo (visual) + o rótulo mono `[ DARK ]`/`[ WHITE ]`
// (N4, de volta ao lado do ícone) + o aria-label (a AÇÃO oferecida). 'action'
// é o aria-label; 'icon' confirma que o glifo segue lá; 'text' é o rótulo.
const STATE = `(() => {
  const btn = document.querySelector('aside [data-testid="theme-toggle"]')
  return {
    attr: document.documentElement.getAttribute('data-theme'),
    bg: getComputedStyle(document.body).backgroundColor,
    stored: localStorage.getItem('zephyr-hub.theme.v1'),
    action: btn?.getAttribute('aria-label'),
    icon: !!btn?.querySelector('svg'),
    text: btn?.innerText.trim(),
  }
})()`

await send('Page.enable')
await send('Emulation.setDeviceMetricsOverride', { width: 1360, height: 940, deviceScaleFactor: 1, mobile: false })
await send('Page.navigate', { url: APP_URL })
await waitFor(`location.pathname === '/rede' && document.querySelector('[data-testid="theme-toggle"]') !== null`, 25_000, 'casca montada')

// 1. default escuro
let state = await evaluate(STATE)
check('default: sem data-theme', state.attr === null)
check('default: fundo escuro computado (ink-950 #141414)', state.bg === 'rgb(20, 20, 20)', state.bg)
check('default: glifo presente + rótulo [ DARK ] (estado atual)', state.icon && state.text === '[ DARK ]', `icon=${state.icon} text=${JSON.stringify(state.text)}`)
check('default: aria-label oferece a ação do estado atual (escuro→claro)', state.action === 'Switch to light theme', state.action)

// 2. clique → claro
await evaluate(`document.querySelector('aside [data-testid="theme-toggle"]').click(); true`)
await new Promise((r) => setTimeout(r, 300))
state = await evaluate(STATE)
check('clique: aplica data-theme=light', state.attr === 'light')
check('clique: tokens fluem (fundo #f7f7f7)', state.bg === 'rgb(247, 247, 247)', state.bg)
check('clique: persiste light no localStorage', state.stored === 'light')
check('clique: rótulo vira [ WHITE ] (grafia exata, não LIGHT)', state.text === '[ WHITE ]', state.text)
check('clique: aria-label vira a ação inversa (claro→escuro)', state.action === 'Switch to dark theme', state.action)

// 3. reload → persiste; o atributo tem que estar lá JÁ no primeiro poll
//    (anti-flash: o inline script roda antes do React montar)
await send('Page.navigate', { url: APP_URL })
await waitFor(`location.pathname === '/rede' && document.readyState !== 'loading'`, 25_000, 'reload')
const earlyAttr = await evaluate(`document.documentElement.getAttribute('data-theme')`)
check('reload: claro persistiu ANTES do app montar (anti-flash)', earlyAttr === 'light', `attr=${earlyAttr}`)
await waitFor(`document.querySelector('[data-testid="theme-toggle"]') !== null`, 25_000, 'casca de novo')
state = await evaluate(STATE)
check('reload: fundo segue claro', state.bg === 'rgb(247, 247, 247)', state.bg)

const shot = await send('Page.captureScreenshot', { format: 'png' })
writeFileSync(path.join(OUT_DIR, 'theme-light.png'), Buffer.from(shot.data, 'base64'))
console.log('screenshot: .e2e-out/theme-light.png')

// 4. segundo clique → volta pro escuro (atributo REMOVIDO)
await evaluate(`document.querySelector('aside [data-testid="theme-toggle"]').click(); true`)
await new Promise((r) => setTimeout(r, 300))
state = await evaluate(STATE)
check('volta: atributo removido (default sem marcação)', state.attr === null)
check('volta: fundo escuro de novo', state.bg === 'rgb(20, 20, 20)', state.bg)
check('volta: persiste dark no localStorage', state.stored === 'dark')

ws.close()
edge.kill()
console.log(failures.length === 0 ? '\nTUDO PASSOU' : `\nFALHAS: ${failures.length}`)
process.exit(failures.length === 0 ? 0 : 1)
