// Teste E2E do Raio-X da Recompensa em Edge headless via CDP — sem
// dependências (WebSocket nativo do Node >= 22). Pré-requisito: `npm run dev`.
//
// Uso:
//   node scripts/rewards-e2e.mjs normal
//     → fluxo completo: manchete conferida MATEMATICAMENTE contra a API
//       (busca o mesmo bloco por altura e recalcula as fatias), área
//       empilhada com dado real, tooltip por mouse E teclado, toggle de
//       escala, troca de janela, tabela e screenshots desktop+mobile.
//   node scripts/rewards-e2e.mjs brokenrewards
//     → bloqueia /zephyr-api/v1/blockrewards* via interceptação do CDP (sem
//       tocar no código): o aviso âmbar cita a fonte, a manchete degrada com
//       mensagem e o gráfico de reserve ratio segue de pé.
//
// Screenshots ficam em .e2e-out/ (ignorado pelo git).

import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const MODE = process.argv[2] ?? 'normal'
const APP_URL = 'http://localhost:5173/recompensa'
const PORT = 9224
const SCANNER = 'https://zephyrprotocol.com/api/v1'

// Profile do Edge SEMPRE fora do repo (dentro dele o watcher do Vite morre
// com EBUSY no cache.db — ver NOTES.md do Prompt 2)
const OUT_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '.e2e-out')
const PROFILE_DIR = path.join(os.tmpdir(), `zephyr-rewards-e2e-${MODE}-${Date.now()}`)
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
    return
  }
  // Interceptação do modo brokenrewards: derruba só o endpoint alvo
  if (msg.method === 'Fetch.requestPaused') {
    const { requestId, request } = msg.params
    const action = request.url.includes('/zephyr-api/v1/blockrewards')
      ? { method: 'Fetch.failRequest', params: { requestId, errorReason: 'Failed' } }
      : { method: 'Fetch.continueRequest', params: { requestId } }
    ws.send(JSON.stringify({ id: ++msgId, method: action.method, params: action.params }))
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
async function screenshot(name) {
  const shot = await send('Page.captureScreenshot', {
    format: 'png', captureBeyondViewport: true,
  })
  writeFileSync(path.join(OUT_DIR, name), Buffer.from(shot.data, 'base64'))
  console.log(`shot  .e2e-out/${name}`)
}

// Números pt-BR da UI ("6,722" / "815.548") → Number
const ptNumber = (text) => Number(text.replaceAll('.', '').replace(',', '.'))

await send('Page.enable')
if (MODE === 'brokenrewards') {
  await send('Fetch.enable', { patterns: [{ urlPattern: '*' }] })
}
await send('Emulation.setDeviceMetricsOverride', { width: 1360, height: 940, deviceScaleFactor: 1, mobile: false })
await send('Page.navigate', { url: APP_URL })

if (MODE === 'brokenrewards') {
  await waitFor(
    `document.body.innerText.includes('blockrewards') && document.body.innerText.includes('Fontes com falha')`,
    30_000, 'aviso de fonte com falha',
  )
  check('aviso âmbar cita a fonte quebrada', true)
  check('manchete degrada com mensagem visível',
    await evaluate(`document.body.innerText.includes('Sem dado de recompensa no momento')`))
  // O gráfico de reserve ratio não depende de /blockrewards — segue de pé
  await waitFor(
    `document.querySelectorAll('polyline[stroke="#9085e9"]').length >= 1`,
    30_000, 'linha do reserve ratio mesmo sem blockrewards',
  )
  check('reserve ratio segue de pé', true)
  check('sem faixa empilhada renderizada',
    await evaluate(`document.querySelectorAll('path[fill="#3987e5"]').length === 0`))
  await screenshot('rewards-brokenrewards.png')
} else {
  // --- manchete com dado real ---
  await waitFor(
    `document.body.innerText.includes('Agora, de cada bloco de')`,
    30_000, 'manchete com o bloco mais recente',
  )
  const headline = await evaluate(`document.body.innerText`)
  const sentence = headline.match(
    /Agora, de cada bloco de ([\d.,]+) ZEPH, ([\d.,]+)% vai pro minerador, ([\d.,]+)% pra reserva e ([\d.,]+)% pro yield/,
  )
  check('manchete no formato pedido', Boolean(sentence), sentence?.[0])
  const heightMatch = headline.match(/Medido no bloco ([\d.]+)/)
  check('manchete diz de qual bloco veio', Boolean(heightMatch), heightMatch?.[1])

  // Confere a MATEMÁTICA contra a API: busca o mesmo bloco por altura e
  // recalcula. Tolerâncias = metade do último dígito exibido.
  if (sentence && heightMatch) {
    const height = ptNumber(heightMatch[1])
    const api = await fetch(`${SCANNER}/blockrewards?from=${height}&to=${height}`).then((r) => r.json())
    const block = api.results?.[0]
    check('bloco da manchete existe na API', block?.height === height)
    if (block) {
      const total = block.miner_reward + block.governance_reward + block.reserve_reward + block.yield_reward
      const near = (uiText, expected, tolerance) => Math.abs(ptNumber(uiText) - expected) <= tolerance
      check('total do bloco bate', near(sentence[1], total, 0.0006), `ui=${sentence[1]} api=${total.toFixed(4)}`)
      check('% minerador bate', near(sentence[2], (block.miner_reward / total) * 100, 0.06),
        `ui=${sentence[2]} api=${((block.miner_reward / total) * 100).toFixed(2)}`)
      check('% reserva bate', near(sentence[3], (block.reserve_reward / total) * 100, 0.06))
      check('% yield bate', near(sentence[4], (block.yield_reward / total) * 100, 0.06))
      const shareSum = [2, 3, 4].reduce((sum, i) => sum + ptNumber(sentence[i]), 0)
      check('percentuais somam ~100', Math.abs(shareSum - 100) <= 0.15, shareSum.toFixed(1))
    }
  }

  // --- área empilhada com dado real (não mock) ---
  await waitFor(`document.querySelectorAll('path[fill="#3987e5"]').length === 1`, 30_000, 'faixa do minerador')
  check('3 faixas ativas (minerador, reserva, yield)',
    await evaluate(`['#3987e5','#199e70','#c98500'].every((c) => document.querySelectorAll('path[fill="' + c + '"]').length === 1)`))
  check('governança zerada NÃO vira faixa fantasma',
    await evaluate(`document.querySelectorAll('path[fill="#008300"]').length === 0`))
  check('legenda avisa governança zerada',
    await evaluate(`document.body.innerText.includes('0 na janela')`))
  check('rótulos diretos de % na borda direita',
    await evaluate(`Array.from(document.querySelectorAll('svg text')).filter((t) => /^\\d+,\\d%$/.test(t.textContent)).length >= 2`))
  check('eixo x com alturas de bloco',
    await evaluate(`Array.from(document.querySelectorAll('svg text')).some((t) => /^\\d{3}\\.\\d{3}$/.test(t.textContent))`))

  // --- reserve ratio na mesma janela ---
  check('linha do reserve ratio', await evaluate(`document.querySelectorAll('polyline[stroke="#9085e9"]').length === 1`))
  check('nota de observação (não causalidade) visível',
    await evaluate(`document.body.innerText.includes('não como') && document.body.innerText.includes('observação')`))

  // --- tooltip: mouse e teclado ---
  // pointermove é evento CONTÍNUO no React: a atualização de estado é adiada,
  // então a consulta ao DOM precisa esperar um tick (keydown é discreto e
  // atualiza síncrono — por isso o teste de teclado não precisa disso)
  const hoverTooltip = await evaluate(`
    (async () => {
      const svg = Array.from(document.querySelectorAll('svg')).find((s) => s.querySelector('path[fill="#3987e5"]'))
      const overlay = svg.querySelector('rect')
      const box = overlay.getBoundingClientRect()
      overlay.dispatchEvent(new PointerEvent('pointermove', {
        clientX: box.left + box.width / 2, clientY: box.top + box.height / 2, bubbles: true,
      }))
      await new Promise((r) => setTimeout(r, 200))
      const tip = document.querySelector('.pointer-events-none.absolute')
      return tip ? tip.innerText : ''
    })()
  `)
  check('tooltip por mouse lista bloco + total', /Bloco [\d.]+/.test(hoverTooltip) && hoverTooltip.includes('Total'), hoverTooltip.split('\n')[0])
  check('tooltip lista as 4 séries',
    ['minerador', 'reserva', 'yield', 'governança'].every((s) => hoverTooltip.includes(s)))
  const keyboardTooltip = await evaluate(`
    (() => {
      const wrapper = Array.from(document.querySelectorAll('div[tabindex="0"]')).find((d) => d.querySelector('path[fill="#3987e5"]'))
      wrapper.focus()
      wrapper.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }))
      const tip = wrapper.querySelector('.pointer-events-none.absolute')
      return tip ? tip.innerText : ''
    })()
  `)
  check('tooltip por teclado (setas)', /Bloco [\d.]+/.test(keyboardTooltip))

  // --- toggle de escala ---
  await evaluate(`Array.from(document.querySelectorAll('button')).find((b) => b.innerText === '% do bloco').click(); true`)
  await waitFor(
    `Array.from(document.querySelectorAll('svg text')).some((t) => t.textContent === '100%')`,
    10_000, 'eixo y em % após toggle',
  )
  check('escala em % do bloco', true)
  await evaluate(`Array.from(document.querySelectorAll('button')).find((b) => b.innerText === 'ZEPH').click(); true`)

  // --- troca de janela refaz a busca ---
  // 95-100: o indexador do Scanner pode estar 1-2 blocos atrás da âncora do
  // explorer no instante da busca — não é falha do app
  await evaluate(`Array.from(document.querySelectorAll('button')).find((b) => b.innerText.includes('100 blocos')).click(); true`)
  await waitFor(
    `/em tabela \\((9[5-9]|100) blocos\\)/.test(document.body.innerText)`,
    30_000, 'janela de 100 blocos aplicada',
  )
  check('janela de 100 blocos aplicada', true)

  // --- tabela (o par acessível dos gráficos) ---
  await evaluate(`document.querySelector('details summary').click(); true`)
  await waitFor(`document.querySelectorAll('tbody tr').length >= 95`, 10_000, 'linhas da tabela')
  const tableProbe = await evaluate(`
    (() => {
      const rows = document.querySelectorAll('tbody tr')
      const first = rows[0].innerText
      return { count: rows.length, first }
    })()
  `)
  check('tabela com ~100 linhas', tableProbe.count >= 95 && tableProbe.count <= 100, String(tableProbe.count))
  check('linha da tabela junta recompensa e reserve ratio',
    (tableProbe.first.match(/\d,\d{3}/g) ?? []).length >= 4 && /\d,\d{2}\s*$/.test(tableProbe.first.trim()),
    tableProbe.first.replaceAll('\t', ' | '))

  await screenshot('rewards-desktop.png')
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true })
  await new Promise((r) => setTimeout(r, 800))
  await screenshot('rewards-mobile.png')
}

console.log(failures.length === 0 ? '\nTUDO PASSOU' : `\n${failures.length} FALHA(S): ${failures.join('; ')}`)
process.exit(failures.length === 0 ? 0 : 1)
