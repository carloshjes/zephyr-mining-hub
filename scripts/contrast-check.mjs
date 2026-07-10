// Medição REAL de contraste WCAG 2.2 dos tokens do produto — mesmo rigor do
// R1 (nada de estimativa de cabeça). Usado pra fechar a rodada v2 (2026-07-10):
// recalibração do matiz da família zeph pra ≈244° (medido no zephyrprotocol.com
// via getComputedStyle), fundo neutralizado (#0a0a0a, referência rig.ai medida
// com croma zero) e as duas cores semânticas novas (good/verde, bad/laranja).
//
// Uso: node scripts/contrast-check.mjs
// Saída: tabela token × fundo com razões de contraste + verificação do matiz.

// ---------- conversões ----------

function hexToRgb(hex) {
  const value = hex.replace('#', '')
  return [
    parseInt(value.slice(0, 2), 16),
    parseInt(value.slice(2, 4), 16),
    parseInt(value.slice(4, 6), 16),
  ]
}

function rgbToHex([r, g, b]) {
  const channel = (c) => Math.round(c).toString(16).padStart(2, '0')
  return `#${channel(r)}${channel(g)}${channel(b)}`
}

function rgbToHsl([r, g, b]) {
  const rn = r / 255, gn = g / 255, bn = b / 255
  const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn)
  const l = (max + min) / 2
  if (max === min) return [0, 0, l]
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  let h
  if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) * 60
  else if (max === gn) h = ((bn - rn) / d + 2) * 60
  else h = ((rn - gn) / d + 4) * 60
  return [h, s, l]
}

function hslToRgb([h, s, l]) {
  const c = (1 - Math.abs(2 * l - 1)) * s
  const hp = ((h % 360) + 360) % 360 / 60
  const x = c * (1 - Math.abs((hp % 2) - 1))
  let rgb
  if (hp < 1) rgb = [c, x, 0]
  else if (hp < 2) rgb = [x, c, 0]
  else if (hp < 3) rgb = [0, c, x]
  else if (hp < 4) rgb = [0, x, c]
  else if (hp < 5) rgb = [x, 0, c]
  else rgb = [c, 0, x]
  const m = l - c / 2
  return rgb.map((v) => (v + m) * 255)
}

// ---------- WCAG 2.2 ----------

function relativeLuminance(hex) {
  const [r, g, b] = hexToRgb(hex).map((c) => {
    const cs = c / 255
    return cs <= 0.03928 ? cs / 12.92 : ((cs + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function contrast(fgHex, bgHex) {
  const l1 = relativeLuminance(fgHex)
  const l2 = relativeLuminance(bgHex)
  const [hi, lo] = l1 > l2 ? [l1, l2] : [l2, l1]
  return (hi + 0.05) / (lo + 0.05)
}

// Mistura fonte-sobre-fundo com alpha (pra achar o pior caso da textura
// scanline: listra branca de baixa opacidade clareia o fundo → contraste cai)
function blend(bgHex, overlayHex, alpha) {
  const bg = hexToRgb(bgHex)
  const ov = hexToRgb(overlayHex)
  return rgbToHex(bg.map((c, i) => c * (1 - alpha) + ov[i] * alpha))
}

// Recalibra SÓ o matiz, preservando S e L (a exigência da rodada: mesmos
// degraus de claridade, tom corrigido)
function withHue(hex, hue) {
  const [, s, l] = rgbToHsl(hexToRgb(hex))
  return rgbToHex(hslToRgb([hue, s, l]))
}

const hueOf = (hex) => rgbToHsl(hexToRgb(hex))[0]

// ---------- paleta ----------

const TARGET_HUE = 244 // matiz medido na paleta oficial do zephyrprotocol.com

const OLD = {
  'ink-950': '#0a0a0e',
  'zeph-300': '#a996f5',
  'zeph-500': '#6f5fc4',
  'zeph-700': '#463c77',
  'zeph-800': '#352d54',
  alert: '#e8492f',
}

const NEW = {
  'ink-950': '#0a0a0a', // neutralizado (referência rig.ai: oklch com croma 0)
  'ink-900': '#141119', // superfície elevada — tinta roxa de marca, mantida
  hairline: '#221f29',
  'zeph-300': withHue(OLD['zeph-300'], TARGET_HUE),
  'zeph-500': withHue(OLD['zeph-500'], TARGET_HUE),
  'zeph-700': withHue(OLD['zeph-700'], TARGET_HUE),
  'zeph-800': withHue(OLD['zeph-800'], TARGET_HUE),
  'mist-100': '#edebf4',
  'mist-300': '#b7b2c9',
  'mist-400': '#8b86a0',
  'mist-600': '#57536a',
}

// Candidatas semânticas (verde=positivo, laranja=negativo). Pontos de partida
// do brief: #22c55e (o verde real do rig.ai) e a família #f97316.
const GOOD_CANDIDATES = ['#22c55e', '#4ade80', '#16a34a']
const BAD_CANDIDATES = ['#f97316', '#fb923c', '#ea580c']

// Textura scanline: listra branca a 2% sobre o fundo — o PIOR caso de fundo
// pra texto claro é a listra (mais clara que a base)
const SCANLINE_ALPHA = 0.02
const stripe = blend(NEW['ink-950'], '#ffffff', SCANLINE_ALPHA)

// ---------- relatório ----------

const fmt = (n) => n.toFixed(2).replace('.', ',')

console.log('== Recalibração de matiz da família zeph (S e L preservados) ==')
for (const key of ['zeph-300', 'zeph-500', 'zeph-700', 'zeph-800']) {
  const de = OLD[key]
  const para = NEW[key]
  console.log(
    `${key}: ${de} (h=${hueOf(de).toFixed(1)}°) -> ${para} (h=${hueOf(para).toFixed(1)}°)`,
  )
}

console.log(`\nscanline pior caso: listra = ${stripe} (branco a ${SCANLINE_ALPHA * 100}% sobre ${NEW['ink-950']})`)

const BACKGROUNDS = [
  ['ink-950 novo', NEW['ink-950']],
  ['listra scanline', stripe],
  ['ink-900 (tooltip/thead)', NEW['ink-900']],
]

function table(title, entries) {
  console.log(`\n== ${title} ==`)
  const header = ['token', 'hex', ...BACKGROUNDS.map(([name]) => name)]
  console.log(header.join(' | '))
  for (const [name, hex] of entries) {
    const cells = BACKGROUNDS.map(([, bg]) => `${fmt(contrast(hex, bg))}:1`)
    console.log([name, hex, ...cells].join(' | '))
  }
}

table('Tokens v2 (texto/gráfico) × fundos', [
  ['zeph-300', NEW['zeph-300']],
  ['zeph-500', NEW['zeph-500']],
  ['zeph-700', NEW['zeph-700']],
  ['zeph-800', NEW['zeph-800']],
  ['mist-100', NEW['mist-100']],
  ['mist-300', NEW['mist-300']],
  ['mist-400', NEW['mist-400']],
  ['mist-600', NEW['mist-600']],
])

table('Candidatas GOOD (verde) × fundos', GOOD_CANDIDATES.map((hex) => [hex, hex]))
table('Candidatas BAD (laranja) × fundos', BAD_CANDIDATES.map((hex) => [hex, hex]))

console.log('\n== Texto escuro sobre chapado (badges/botões sólidos) ==')
for (const [label, bg] of [
  ['ink-950 sobre bad (badge offline sólido)', BAD_CANDIDATES[0]],
  ['ink-950 sobre good', GOOD_CANDIDATES[0]],
  ['ink-950 sobre zeph-300 (botão primário)', NEW['zeph-300']],
  ['mist-100 sobre zeph-500 (hover antigo do botão)', NEW['zeph-500']],
]) {
  console.log(`${label}: ${fmt(contrast(NEW['ink-950'], bg))}:1`)
}

console.log('\n== Referência: o que muda vs. R1 (fundo antigo #0a0a0e) ==')
for (const key of ['zeph-300', 'zeph-500', 'zeph-700']) {
  const before = contrast(OLD[key], OLD['ink-950'])
  const after = contrast(NEW[key], NEW['ink-950'])
  console.log(`${key}: ${fmt(before)}:1 (R1) -> ${fmt(after)}:1 (v2, pior caso listra ${fmt(contrast(NEW[key], stripe))}:1)`)
}
console.log(`alert (removido): era ${fmt(contrast(OLD.alert, OLD['ink-950']))}:1 no R1`)
