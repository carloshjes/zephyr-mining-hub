// Capturas focadas da casca: ThemeToggle (rail/mobile, escuro/claro) e
// DonationFooter (desktop/mobile, escuro/claro), com métricas geométricas.
// Edge headless via CDP, sem dependências. Pré-requisito: npm run dev.
//
// Uso:
//   node scripts/shell-detail-shots.mjs
//   SHELL_SHOT_PREFIX=antes node scripts/shell-detail-shots.mjs
//
// Saída em .e2e-out/<prefix>-{toggle,footer}-<layout>-<tema>.png.

import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const BASE = 'http://127.0.0.1:5173'
const PORT = 9231
const PREFIX = process.env.SHELL_SHOT_PREFIX ?? 'r6'
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT_DIR = path.join(ROOT, '.e2e-out')
mkdirSync(OUT_DIR, { recursive: true })

const EDGE = [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
].find((candidate) => existsSync(candidate))
if (!EDGE) throw new Error('msedge.exe não encontrado')

const edge = spawn(EDGE, [
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${path.join(os.tmpdir(), `zephyr-shell-shots-${Date.now()}`)}`,
  '--headless=new',
  '--window-size=1360,940',
  '--no-first-run',
  'about:blank',
], { stdio: 'ignore' })
process.on('exit', () => edge.kill())

async function getWsUrl() {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const targets = await fetch(`http://127.0.0.1:${PORT}/json/list`).then((response) => response.json())
      const page = targets.find((target) => target.type === 'page')
      if (page) return page.webSocketDebuggerUrl
    } catch {
      // Edge ainda subindo.
    }
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  throw new Error('Edge não expôs o endpoint de debug')
}

const ws = new WebSocket(await getWsUrl())
await new Promise((resolve, reject) => {
  ws.onopen = resolve
  ws.onerror = reject
})

let messageId = 0
const pending = new Map()
ws.onmessage = (event) => {
  const message = JSON.parse(event.data)
  if (!message.id || !pending.has(message.id)) return
  const { resolve, reject } = pending.get(message.id)
  pending.delete(message.id)
  if (message.error) reject(new Error(message.error.message))
  else resolve(message.result)
}

function send(method, params = {}) {
  const id = ++messageId
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject })
    ws.send(JSON.stringify({ id, method, params }))
  })
}

async function evaluate(expression) {
  const result = await send('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true,
  })
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text)
  }
  return result.result.value
}

async function waitFor(expression, timeoutMs, label) {
  const startedAt = Date.now()
  while (Date.now() - startedAt < timeoutMs) {
    if (await evaluate(expression)) return
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  throw new Error(`timeout esperando: ${label}`)
}

async function navigate(width, height, mobile, theme) {
  await send('Emulation.setDeviceMetricsOverride', {
    width,
    height,
    deviceScaleFactor: 1,
    mobile,
  })
  await send('Page.navigate', { url: `${BASE}/rede` })
  await waitFor(`document.querySelector('[data-testid="theme-toggle"]') !== null`, 20_000, 'casca montada')
  await evaluate(`localStorage.setItem('zephyr-hub.theme.v1', '${theme}'); true`)
  await send('Page.navigate', { url: `${BASE}/rede` })
  await waitFor(
    `document.querySelector('[data-testid="theme-toggle"]') !== null && ` +
      `document.documentElement.getAttribute('data-theme') ${theme === 'light' ? "=== 'light'" : '=== null'}`,
    20_000,
    `tema ${theme} aplicado`,
  )
  await new Promise((resolve) => setTimeout(resolve, 250))
}

async function captureElement(selector, file, scale, padding = 0) {
  const clip = await evaluate(`(() => {
    const element = document.querySelector(${JSON.stringify(selector)})
    if (!element) return null
    element.scrollIntoView({ block: 'center' })
    const rect = element.getBoundingClientRect()
    const x = Math.max(0, rect.left + window.scrollX - ${padding})
    const y = Math.max(0, rect.top + window.scrollY - ${padding})
    return {
      x,
      y,
      width: Math.min(rect.width + ${padding * 2}, document.documentElement.scrollWidth - x),
      height: rect.height + ${padding * 2},
    }
  })()`)
  if (!clip) throw new Error(`elemento ausente: ${selector}`)
  const shot = await send('Page.captureScreenshot', {
    format: 'png',
    captureBeyondViewport: true,
    clip: { ...clip, scale },
  })
  writeFileSync(path.join(OUT_DIR, file), Buffer.from(shot.data, 'base64'))
  console.log(`shot  .e2e-out/${file}`)
}

async function readToggleMetrics(scopeSelector) {
  return evaluate(`(() => {
    const button = document.querySelector(${JSON.stringify(`${scopeSelector} [data-testid="theme-toggle"]`)})
    const svg = button?.querySelector('svg')
    const label = button?.querySelector('span')
    if (!button || !svg || !label) return null
    const rect = (element) => {
      const value = element.getBoundingClientRect()
      return {
        left: value.left,
        top: value.top,
        right: value.right,
        bottom: value.bottom,
        width: value.width,
        height: value.height,
        centerY: value.top + value.height / 2,
      }
    }
    const marker = document.createElement('i')
    marker.setAttribute('aria-hidden', 'true')
    marker.style.cssText = 'display:inline-block;width:0;height:0;padding:0;margin:0;border:0;vertical-align:baseline'
    label.append(marker)
    const baseline = marker.getBoundingClientRect().top
    marker.remove()
    const labelStyle = getComputedStyle(label)
    const svgStyle = getComputedStyle(svg)
    const canvas = document.createElement('canvas')
    const context = canvas.getContext('2d')
    context.font = labelStyle.font
    const text = label.textContent.trim()
    const measured = context.measureText(text)
    return {
      button: rect(button),
      svg: rect(svg),
      label: rect(label),
      svgDisplay: svgStyle.display,
      font: labelStyle.font,
      fontSize: labelStyle.fontSize,
      lineHeight: labelStyle.lineHeight,
      baseline,
      estimatedInkTop: baseline - measured.actualBoundingBoxAscent,
      estimatedInkBottom: baseline + measured.actualBoundingBoxDescent,
      estimatedInkCenter: baseline + (measured.actualBoundingBoxDescent - measured.actualBoundingBoxAscent) / 2,
      text,
    }
  })()`)
}

async function readFooterMetrics() {
  return evaluate(`(() => {
    const footer = document.querySelector('footer')
    const address = footer?.querySelector('[data-testid="donation-address"]')
    if (!footer) return null
    const rect = footer.getBoundingClientRect()
    const addressRect = address?.getBoundingClientRect()
    return {
      footer: { left: rect.left, right: rect.right, width: rect.width },
      address: addressRect ? {
        left: addressRect.left,
        right: addressRect.right,
        width: addressRect.width,
        height: addressRect.height,
        scrollWidth: address.scrollWidth,
        clientWidth: address.clientWidth,
        text: address.textContent.trim(),
      } : null,
      hasCopyButton: !!footer.querySelector('button'),
      hasDisclaimer: footer.innerText.includes('afiliação'),
      pageOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    }
  })()`)
}

await send('Page.enable')

const layouts = [
  { name: 'rail', scope: 'aside', width: 1360, height: 940, mobile: false },
  { name: 'mobile', scope: 'header', width: 390, height: 844, mobile: true },
]

for (const theme of ['dark', 'light']) {
  for (const layout of layouts) {
    await navigate(layout.width, layout.height, layout.mobile, theme)
    const metrics = await readToggleMetrics(layout.scope)
    console.log(`toggle ${layout.name}/${theme}: ${JSON.stringify(metrics)}`)
    await captureElement(
      `${layout.scope} [data-testid="theme-toggle"]`,
      `${PREFIX}-toggle-${layout.name}-${theme}.png`,
      5,
      4,
    )
    // Régua conservadora ×1 ampliada 5×: compara a MESMA grade a 18/22/24px
    // no contexto real do botão. A exploração de logo aponta 24px como piso
    // do halftone pequeno; 18px entra aqui como controle da técnica antiga.
    if (layout.name === 'rail') {
      for (const size of [18, 22, 24]) {
        await evaluate(`(() => {
          const svg = document.querySelector('aside [data-testid="theme-toggle"] svg')
          svg.setAttribute('width', '${size}')
          svg.setAttribute('height', '${size}')
          return true
        })()`)
        await new Promise((resolve) => setTimeout(resolve, 50))
        await captureElement(
          'aside [data-testid="theme-toggle"]',
          `${PREFIX}-glyph-${size}-${theme}.png`,
          5,
          4,
        )
        await captureElement(
          'aside [data-testid="theme-toggle"]',
          `${PREFIX}-glyph-${size}-${theme}-x1.png`,
          1,
          4,
        )
      }
      await evaluate(`(() => {
        const svg = document.querySelector('aside [data-testid="theme-toggle"] svg')
        svg.setAttribute('width', '${metrics.svg.width}')
        svg.setAttribute('height', '${metrics.svg.height}')
        return true
      })()`)
    }
    await captureElement(
      layout.scope,
      `${PREFIX}-toggle-context-${layout.name}-${theme}.png`,
      1,
    )
    const footerMetrics = await readFooterMetrics()
    console.log(`footer ${layout.name}/${theme}: ${JSON.stringify(footerMetrics)}`)
    await captureElement('footer', `${PREFIX}-footer-${layout.name}-${theme}.png`, 1)
  }
}

ws.close()
edge.kill()
console.log('OK')
