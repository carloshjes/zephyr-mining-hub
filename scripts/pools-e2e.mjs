// Teste E2E da Bússola de Pools em Edge headless via CDP — sem dependências
// (usa o WebSocket nativo do Node >= 22). Pré-requisito: `npm run dev` rodando.
//
// Uso:
//   node scripts/pools-e2e.mjs normal
//     → fluxo completo: dados reais das pools, "—" nos campos ausentes,
//       ordenação por 4 colunas (com inversão), destaques, histórico de luck.
//   node scripts/pools-e2e.mjs broken2miners
//     → ANTES, troque a URL da 2Miners em src/lib/api/pools.ts por uma
//       inválida (ex.: /api/stats-quebrada-404). Verifica que só a linha dela
//       mostra "indisponível" e as demais continuam de pé. Reverta depois.
//
// Screenshots ficam em .e2e-out/ (ignorado pelo git).

import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const MODE = process.argv[2] ?? 'normal'
const APP_URL = 'http://localhost:5173/pools'
const PORT = 9223

// Screenshots vão pro repo (.e2e-out, no .gitignore); o PROFILE do Edge vai
// pro tmp do sistema — dentro do repo ele derruba o watcher do Vite (EBUSY
// no cache.db travado do Edge, observado em 2026-07-08).
const OUT_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '.e2e-out')
const PROFILE_DIR = path.join(os.tmpdir(), `zephyr-pools-e2e-${MODE}-${Date.now()}`)
mkdirSync(OUT_DIR, { recursive: true })

const EDGE_CANDIDATES = [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
]
const EDGE = EDGE_CANDIDATES.find((p) => existsSync(p))
if (!EDGE) throw new Error('msedge.exe não encontrado — ajuste EDGE_CANDIDATES')

// Profile descartável e único por execução: garante localStorage limpo
const edge = spawn(EDGE, [
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${PROFILE_DIR}`,
  '--headless=new',
  '--window-size=1360,940',
  '--no-first-run',
  'about:blank',
], { stdio: 'ignore' })
// Se um waitFor estourar, ainda assim derruba o Edge (senão fica órfão
// segurando o profile)
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

// Lê a tabela: pra cada linha, nome da pool + células + chips de destaque
const READ_ROWS = `
  Array.from(document.querySelectorAll('tbody tr')).map((tr) => {
    const cells = Array.from(tr.querySelectorAll('td')).map((td) => td.innerText.trim())
    const chips = Array.from(tr.querySelectorAll('td:first-child span')).map((s) => s.innerText.trim())
    return { name: tr.querySelector('a')?.innerText.trim(), cells, chips }
  })
`

await send('Page.enable')
await send('Emulation.setDeviceMetricsOverride', { width: 1360, height: 940, deviceScaleFactor: 1, mobile: false })
await send('Page.navigate', { url: APP_URL })
// Primeiro só a estrutura (as 5 linhas existem já no estado de loading)...
await waitFor(`document.querySelectorAll('tbody tr').length >= 5`, 25_000, 'tabela com 5 linhas')

if (MODE === 'normal') {
  // Semeia histórico de luck pra dar corpo ao sparkline (dado de teste local,
  // só no profile headless descartável — a página real coleta 1 leitura/min)
  await evaluate(`
    const now = Date.now();
    const seed = (base) => Array.from({length: 15}, (_, i) => ({ t: now - (16 - i) * 60_000, luck: base + Math.sin(i / 2) * 18 + i }));
    localStorage.setItem('zephyr-hub.pools.luck-history.v1', JSON.stringify({ '2miners': seed(120), 'herominers': seed(95) }));
    location.reload(); true
  `)
  // ...e só então os dados de verdade (nunca ler a tabela ainda em skeleton)
  await waitFor(
    `document.querySelectorAll('tbody tr').length >= 5 && !document.body.innerText.includes('indisponível agora') && Array.from(document.querySelectorAll('tbody td')).some((td) => td.innerText.includes('H/s'))`,
    25_000, 'dados reais das pools na tabela',
  )
}
if (MODE === 'broken2miners') {
  await waitFor(
    `document.body.innerText.includes('indisponível agora') && Array.from(document.querySelectorAll('tbody td')).some((td) => td.innerText.includes('H/s'))`,
    30_000, 'linha indisponível + dados das demais',
  )
}

let rows = await evaluate(READ_ROWS)
const names = () => rows.map((r) => r.name)
const row = (name) => rows.find((r) => r.name === name)

check('tabela tem as 5 pools conhecidas', rows.length === 5, names().join(', '))

if (MODE === 'normal') {
  // --- dados normalizados ---
  const twoMiners = row('2Miners'); const hero = row('HeroMiners')
  check('2Miners com hashrate', /H\/s/.test(twoMiners?.cells[2] ?? ''), twoMiners?.cells[2])
  check('2Miners com luck', /%/.test(twoMiners?.cells[5] ?? ''), twoMiners?.cells[5])
  check('2Miners fee vira "—" (API não expõe)', (twoMiners?.cells[1] ?? '') === '—', twoMiners?.cells[1])
  check('2Miners pagto. mínimo vira "—"', (twoMiners?.cells[4] ?? '') === '—', twoMiners?.cells[4])
  check('HeroMiners com fee', /%/.test(hero?.cells[1] ?? ''), hero?.cells[1])
  check('HeroMiners com pagto. mínimo em ZEPH', /ZEPH/.test(hero?.cells[4] ?? ''), hero?.cells[4])
  check('HeroMiners com altura de bloco', /\d/.test(hero?.cells[7] ?? ''), hero?.cells[7])
  for (const name of ['K1Pool', 'MiningOcean', 'RavenMiner']) {
    check(`${name} marcada "sem integração"`, (row(name)?.cells[1] ?? '').includes('sem integração'), row(name)?.cells[1])
  }

  // --- destaques ---
  check('chip "maior hashrate" presente', rows.some((r) => r.chips.some((c) => c.includes('maior hashrate'))),
    rows.filter((r) => r.chips.some((c) => c.includes('maior hashrate'))).map((r) => r.name).join(','))
  check('chip "menor fee" na HeroMiners (única com fee)', (hero?.chips ?? []).some((c) => c.includes('menor fee')))

  // --- dois chips na MESMA pool: arranjo R5 (mudança DELIBERADA de contrato,
  // 2026-07-11) — os 3 checks do R4 verificavam o empilhado antigo (ambos
  // ABAIXO do nome, tops distintos/lefts iguais); a direção nova do Carlos
  // (screenshot de uso real) põe os chips numa COLUNA À DIREITA do nome:
  // chip 1 na MESMA linha do nome, chip 2 abaixo do chip 1. O filtro exclui
  // o span-wrapper da coluna (childElementCount > 0) — só os chips-folha.
  // No dado real de hoje a HeroMiners é o caso (maior hashrate E única com
  // fee); se o mundo mudar e nenhuma pool tiver os dois, degrada pra "n/a"
  // sem falhar.
  const twoChipGeom = await evaluate(`(() => {
    const tr = Array.from(document.querySelectorAll('tbody tr')).find((tr) => {
      const t = Array.from(tr.querySelectorAll('td:first-child span')).map((s) => s.innerText)
      return t.some((c) => c.includes('maior hashrate')) && t.some((c) => c.includes('menor fee'))
    })
    if (!tr) return null
    const name = tr.querySelector('a').getBoundingClientRect()
    const chips = Array.from(tr.querySelectorAll('td:first-child span'))
      .filter((s) => s.childElementCount === 0 && /maior hashrate|menor fee/.test(s.innerText))
      .map((s) => s.getBoundingClientRect())
    if (chips.length !== 2) return { count: chips.length }
    return {
      count: 2,
      chip1OnNameLine: chips[0].top < name.bottom && chips[0].bottom > name.top,
      chip1RightOfName: chips[0].left >= name.right,
      chip2BelowChip1: chips[1].top >= chips[0].bottom - 1,
      leftsEqual: Math.round(chips[0].left) === Math.round(chips[1].left),
    }
  })()`)
  if (twoChipGeom === null) {
    check('dois chips juntos: n/a (nenhuma pool com os dois neste ciclo)', true)
  } else {
    check('dois chips: chip 1 na linha do nome, à direita dele',
      twoChipGeom.count === 2 && twoChipGeom.chip1OnNameLine && twoChipGeom.chip1RightOfName,
      `count=${twoChipGeom.count}`)
    check('dois chips: chip 2 abaixo do chip 1', twoChipGeom.chip2BelowChip1 === true)
    check('dois chips: coluna de chips alinhada (lefts iguais)', twoChipGeom.leftsEqual === true)
  }

  // --- ordenação padrão: hashrate desc (na medição de 2026-07-08, HeroMiners
  // ~22 MH/s > 2Miners ~1,4 MH/s; se as pools trocarem de posição no mundo
  // real, atualize as expectativas abaixo) ---
  check('ordem padrão por hashrate desc', names()[0] === 'HeroMiners' && names()[1] === '2Miners', names().join(', '))

  const clickHeader = async (label) => {
    await evaluate(`Array.from(document.querySelectorAll('thead button')).find((b) => b.innerText.trim().startsWith('${label}')).click(); true`)
    await new Promise((r) => setTimeout(r, 300))
    rows = await evaluate(READ_ROWS)
  }

  // Coluna 1: Fee (asc) — só HeroMiners tem fee; linha sem valor vai pro fim
  await clickHeader('Fee')
  check('ordenar por Fee: HeroMiners primeiro', names()[0] === 'HeroMiners', names().join(', '))
  // Coluna 2: Mineradores (desc)
  await clickHeader('Mineradores')
  check('ordenar por Mineradores desc: HeroMiners primeiro', names()[0] === 'HeroMiners' && names()[1] === '2Miners', names().join(', '))
  // Coluna 3: Pool (asc alfabético, inclui as não integradas)
  await clickHeader('Pool')
  check('ordenar por Pool asc', JSON.stringify(names()) === JSON.stringify(['2Miners', 'HeroMiners', 'K1Pool', 'MiningOcean', 'RavenMiner']), names().join(', '))
  // Segundo clique inverte
  await clickHeader('Pool')
  check('segundo clique inverte (Pool desc)', names()[0] === 'RavenMiner' && names()[4] === '2Miners', names().join(', '))
  // aria-sort presente no cabeçalho ativo
  check('aria-sort no cabeçalho ativo', await evaluate(`document.querySelector('th[aria-sort="descending"]') !== null`))
  // Coluna 4: Hashrate — primeiro clique usa direção natural (desc), segundo inverte
  await clickHeader('Hashrate')
  check('ordenar por Hashrate desc: HeroMiners primeiro', names()[0] === 'HeroMiners' && names()[1] === '2Miners', names().join(', '))
  await clickHeader('Hashrate')
  check('Hashrate asc inverte as linhas com dado', names()[0] === '2Miners' && names()[1] === 'HeroMiners', names().join(', '))

  // --- histórico de luck no localStorage + sparkline ---
  const history = await evaluate(`JSON.parse(localStorage.getItem('zephyr-hub.pools.luck-history.v1') ?? '{}')`)
  check('histórico do 2miners com leitura real anexada', (history['2miners']?.length ?? 0) === 16, `${history['2miners']?.length} leituras`)
  check('histórico limitado a 20', Object.values(history).every((h) => h.length <= 20))
  check('sparklines renderizados (2 pools)', await evaluate(`document.querySelectorAll('tbody svg polyline').length`) === 2)

  // Volta pra ordenação padrão pro screenshot
  await clickHeader('Hashrate')
  const shot = await send('Page.captureScreenshot', { format: 'png' })
  const shotPath = path.join(OUT_DIR, 'pools-normal.png')
  writeFileSync(shotPath, Buffer.from(shot.data, 'base64'))
  console.log(`screenshot: ${shotPath}`)
}

if (MODE === 'broken2miners') {
  const twoMiners = row('2Miners'); const hero = row('HeroMiners')
  check('linha da 2Miners mostra indisponível', (twoMiners?.cells[1] ?? '').includes('indisponível agora'), twoMiners?.cells[1])
  check('HeroMiners continua de pé com dados', /H\/s/.test(hero?.cells[2] ?? ''), hero?.cells[2])
  check('HeroMiners vira "maior hashrate" (única com dado)', (hero?.chips ?? []).some((c) => c.includes('maior hashrate')))
  check('pool caída vai pro fim das linhas com valor (hashrate desc)', names()[0] === 'HeroMiners', names().join(', '))
  for (const name of ['K1Pool', 'MiningOcean', 'RavenMiner']) {
    check(`${name} segue "sem integração"`, (row(name)?.cells[1] ?? '').includes('sem integração'))
  }
  check('tela NÃO quebrou (título presente)', await evaluate(`document.body.innerText.includes('Bússola de Pools')`))
  const shot = await send('Page.captureScreenshot', { format: 'png' })
  const shotPath = path.join(OUT_DIR, 'pools-broken.png')
  writeFileSync(shotPath, Buffer.from(shot.data, 'base64'))
  console.log(`screenshot: ${shotPath}`)
}

ws.close()
edge.kill()
console.log(failures.length === 0 ? '\nTUDO PASSOU' : `\nFALHAS: ${failures.length}`)
process.exit(failures.length === 0 ? 0 : 1)
