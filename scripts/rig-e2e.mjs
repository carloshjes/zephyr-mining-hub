// Teste E2E do Monitor do Rig em Edge headless via CDP — sem dependências
// (usa o WebSocket nativo do Node >= 22). Pré-requisito: `npm run dev` rodando.
// O script sobe (e derruba) o próprio simulador do XMRig (porta 18088).
//
// Uso:
//   node scripts/rig-e2e.mjs normal
//     → fluxo COMPLETO do zero (critério de aceite do módulo, nesta ordem):
//       navegador limpo → formulário → dado aparece (pool real + XMRig sim) →
//       refresh → dado continua sem preencher de novo. Depois: estado "abaixo
//       do esperado" com histórico semeado, e degradação graciosa com o
//       XMRig derrubado no meio do voo.
//   node scripts/rig-e2e.mjs notfound
//     → endereço plausível mas desconhecido na HeroMiners: aviso claro de
//       "não visto nesta pool", estado Offline, tela de pé.
//
// Screenshots ficam em .e2e-out/ (ignorado pelo git).

import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const MODE = process.argv[2] ?? 'normal'
const APP_URL = 'http://localhost:5173/meu-rig'
const PORT = 9224

// Endereço REAL e ativo na 2Miners (visto na lista pública /api/miners em
// 2026-07-09, ~40 kH/s). Se sumir de lá, troque por outro da mesma lista.
const WALLET_2MINERS =
  'ZEPHYR2DdQMSaghsPgZrE3UGqL2mUsADoPcuJiWRAx4aDi7Q7fwcCRCQ3Ntgeo1fuN4KwPyNNVjY57B91jCHuhjPRnAb6gkdBwy1t'
const XMRIG_ADDR = '127.0.0.1:18088'

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT_DIR = path.join(ROOT, '.e2e-out')
const PROFILE_DIR = path.join(os.tmpdir(), `zephyr-rig-e2e-${MODE}-${Date.now()}`)
mkdirSync(OUT_DIR, { recursive: true })

const EDGE_CANDIDATES = [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
]
const EDGE = EDGE_CANDIDATES.find((p) => existsSync(p))
if (!EDGE) throw new Error('msedge.exe não encontrado — ajuste EDGE_CANDIDATES')

// Simulador do XMRig — o teste derruba ele no meio pra validar a degradação
let xmrigSim = spawn(process.execPath, [path.join(ROOT, 'scripts', 'xmrig-sim.mjs')], {
  stdio: 'ignore',
})

const edge = spawn(EDGE, [
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${PROFILE_DIR}`,
  '--headless=new',
  // Edge 150 encerra o CDP headless com 0x80000003 sem esta flag nesta máquina.
  '--no-sandbox',
  '--window-size=1360,1100',
  '--no-first-run',
  'about:blank',
], { stdio: 'ignore' })
process.on('exit', () => {
  edge.kill()
  xmrigSim?.kill()
})

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
async function screenshot(name) {
  const shot = await send('Page.captureScreenshot', { format: 'png' })
  const shotPath = path.join(OUT_DIR, name)
  writeFileSync(shotPath, Buffer.from(shot.data, 'base64'))
  console.log(`screenshot: ${shotPath}`)
}

// Preenche input/select do React de verdade (setter nativo + evento bubbling —
// atribuir .value direto não dispara o onChange do React). Roda dentro de um
// IIFE por chamada: `const` repetido no escopo global do Runtime.evaluate colide.
const FILL_HELPERS = `
  const setReactInput = (el, value) => {
    const proto = el instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, value);
    el.dispatchEvent(new Event(el instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true }));
  };
  const walletInput = () => document.querySelector('input[placeholder="ZEPHYR…"]');
  const xmrigInput = () => document.querySelector('input[placeholder="127.0.0.1:16000"]');
  const poolSelect = () => document.querySelector('select');
  const submitButton = () => Array.from(document.querySelectorAll('button')).find((b) => b.innerText.includes('Save and monitor'));
`
function withHelpers(body) {
  return `(() => { ${FILL_HELPERS} ${body} })()`
}

const STATUS = `document.querySelector('[data-testid="rig-status"]')?.dataset.status`

await send('Page.enable')
await send('Emulation.setDeviceMetricsOverride', { width: 1360, height: 1100, deviceScaleFactor: 1, mobile: false })
await send('Page.navigate', { url: APP_URL })

// ---------------------------------------------------------------------------
// Passo 1 — navegador sem nada salvo: formulário na tela, localStorage vazio
await waitFor(`document.querySelector('input[placeholder="ZEPHYR…"]') !== null`, 20_000, 'formulário inicial')
check('passo 1: navegador limpo mostra o formulário', true)
check('passo 1: localStorage sem config',
  await evaluate(`localStorage.getItem('zephyr-hub.rig.config.v1') === null`))

if (MODE === 'normal') {
  // Validação visível: submeter vazio NÃO salva e mostra erro
  await evaluate(withHelpers('submitButton().click(); return true'))
  await new Promise((r) => setTimeout(r, 300))
  check('validação: submit vazio mostra erro e não salva',
    await evaluate(`document.body.innerText.includes('Enter your public ZEPH wallet address') && localStorage.getItem('zephyr-hub.rig.config.v1') === null`))

  // -------------------------------------------------------------------------
  // Passo 2 — preenche o formulário (2Miners + carteira real + XMRig sim)
  await evaluate(withHelpers(`
    setReactInput(poolSelect(), '2miners');
    setReactInput(walletInput(), '${WALLET_2MINERS}');
    setReactInput(xmrigInput(), '${XMRIG_ADDR}');
    submitButton().click(); return true
  `))
  check('passo 2: config salva no localStorage',
    await evaluate(`JSON.parse(localStorage.getItem('zephyr-hub.rig.config.v1') ?? '{}').wallet === '${WALLET_2MINERS}'`))

  // -------------------------------------------------------------------------
  // Passo 3 — dado aparece: pool real + XMRig simulado + estado visual
  // Espera pelas LINHAS da tabela de workers (só existem com dado da pool) —
  // o "H/s" sozinho não serve de sinal: o XMRig local responde antes da pool
  await waitFor(`document.querySelectorAll('tbody tr').length > 0`, 30_000, 'dados da pool na tela')
  check('passo 3: hashrate da pool na tela',
    await evaluate(`Array.from(document.querySelectorAll('p')).some((p) => /H\\/s/.test(p.innerText))`))
  check('passo 3: tabela de workers com linhas',
    await evaluate(`document.querySelectorAll('tbody tr').length`) > 0,
    `${await evaluate(`document.querySelectorAll('tbody tr').length`)} workers`)
  check('passo 3: saldo pendente em ZEPH ou "—"',
    await evaluate(`document.body.innerText.includes('Pending balance')`))

  await waitFor(`document.body.innerText.includes('XMRig uptime')`, 15_000, 'seção do XMRig')
  check('passo 3: hashrate local do XMRig sim (1.23 kH/s)',
    await evaluate(`document.body.innerText.includes('1.23 kH/s')`))
  check('passo 3: shares aceitas 42, 1 rejeitada de 43',
    await evaluate(`document.body.innerText.includes('rejected: 1 of 43 submitted')`))
  check('passo 3: estado visual presente (fonte XMRig)',
    await evaluate(STATUS) !== undefined && await evaluate(`document.body.innerText.includes('Local XMRig (real-time)')`),
    `status=${await evaluate(STATUS)}`)

  // -------------------------------------------------------------------------
  // Passo 4 — refresh: config sobrevive, dado volta sem preencher nada
  await send('Page.navigate', { url: APP_URL })
  await waitFor(`document.body.innerText.includes('At 2Miners')`, 20_000, 'dashboard direto após refresh')
  check('passo 4: refresh NÃO volta pro formulário',
    await evaluate(`document.querySelector('input[placeholder="ZEPHYR…"]') === null`))
  await waitFor(`document.body.innerText.includes('H/s')`, 30_000, 'dados de novo após refresh')
  check('passo 4: dado da pool reaparece sem reconfigurar', true)

  // Campos pré-preenchidos ao abrir a edição (config veio do localStorage)
  await evaluate(`Array.from(document.querySelectorAll('button')).find((b) => b.innerText.includes('Edit configuration')).click(); true`)
  await new Promise((r) => setTimeout(r, 300))
  check('passo 4: formulário de edição pré-preenchido',
    await evaluate(withHelpers(`return walletInput().value === '${WALLET_2MINERS}' && xmrigInput().value === '${XMRIG_ADDR}' && poolSelect().value === '2miners'`)))
  await evaluate(`Array.from(document.querySelectorAll('button')).find((b) => b.innerText.trim() === 'Cancel').click(); true`)

  // Cancelar remonta o dashboard (polling do zero) — espera o dado voltar
  // pro screenshot sair com os cards preenchidos
  await waitFor(`document.querySelectorAll('tbody tr').length > 0`, 30_000, 'dados de volta após cancelar edição')
  await screenshot('rig-normal.png')

  // -------------------------------------------------------------------------
  // Estado "abaixo do esperado": semeia histórico do XMRig com média ~100 kH/s
  // (sim entrega 1,23 kH/s → bem abaixo de 70% da média)
  await evaluate(`
    const now = Date.now();
    const key = '2miners:${WALLET_2MINERS}:xmrig';
    const readings = Array.from({length: 10}, (_, i) => ({ t: now - (12 - i) * 60_000, h: 100_000 + i * 500 }));
    const all = JSON.parse(localStorage.getItem('zephyr-hub.rig.hashrate-history.v1') ?? '{}');
    all[key] = readings;
    localStorage.setItem('zephyr-hub.rig.hashrate-history.v1', JSON.stringify(all));
    location.reload(); true
  `)
  await waitFor(`${STATUS} === 'below'`, 25_000, 'estado "abaixo do esperado"')
  check('estado: hashrate abaixo do esperado com histórico alto',
    await evaluate(`document.body.innerText.includes('Hashrate below expected')`))
  await screenshot('rig-below.png')

  // -------------------------------------------------------------------------
  // XMRig derrubado no meio do voo: degradação graciosa, pool continua de pé
  xmrigSim.kill()
  xmrigSim = undefined
  await waitFor(`document.body.innerText.includes('unreachable')`, 30_000, 'aviso de XMRig fora do ar')
  check('degradação: aviso de XMRig não alcançável', true)
  check('degradação: dados da pool continuam na tela',
    await evaluate(`document.body.innerText.includes('At 2Miners') && document.body.innerText.includes('H/s')`))
  check('degradação: estado passa pra fonte pool',
    await evaluate(`document.body.innerText.includes('pool hashrate at 2Miners')`))
  check('degradação: tela NÃO quebrou (título presente)',
    await evaluate(`document.body.innerText.includes('Rig Monitor')`))
  await screenshot('rig-xmrig-down.png')
}

if (MODE === 'notfound') {
  // Endereço REAL da 2Miners que (confirmado por sondagem em 2026-07-09) a
  // HeroMiners não conhece → exercita o {"error":"Not found"} de verdade
  await evaluate(withHelpers(`
    setReactInput(poolSelect(), 'herominers');
    setReactInput(walletInput(), '${WALLET_2MINERS}');
    submitButton().click(); return true
  `))
  await waitFor(`document.body.innerText.includes('Wallet address not yet seen at this pool')`, 30_000, 'aviso de endereço não encontrado')
  check('notfound: aviso claro de endereço não visto na pool', true)
  check('notfound: menciona que a busca continua automática',
    await evaluate(`document.body.innerText.includes('first share')`))
  await waitFor(`${STATUS} === 'offline'`, 10_000, 'estado offline')
  check('notfound: estado Offline (sem hashrate nem share)',
    await evaluate(`document.body.innerText.includes('Offline')`))
  check('notfound: tela NÃO quebrou', await evaluate(`document.body.innerText.includes('Rig Monitor')`))
  await screenshot('rig-notfound.png')
}

ws.close()
edge.kill()
xmrigSim?.kill()
console.log(failures.length === 0 ? '\nTUDO PASSOU' : `\nFALHAS: ${failures.length}`)
process.exit(failures.length === 0 ? 0 : 1)
