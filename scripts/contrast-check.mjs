// Medição REAL de contraste WCAG 2.2 dos tokens do produto — mesmo rigor do
// R1/v2 (nada de estimativa de cabeça). Rodada v3 (2026-07-10): o fundo
// clareia (pedido de uso real do Carlos: #0a0a0a pesado demais) mas continua
// quase-preto NEUTRO, e a textura scanline vira grade de blocos quadrados —
// o pior caso de fundo continua sendo a célula clara da textura (branco de
// baixa opacidade sobre o fundo).
//
// O que este script decide/registra:
// 1. Candidatos de claridade do fundo (croma zero) × piso AA de mist-400 e
//    piso 3:1 de zeph-500 — contra o fundo E contra a célula clara.
// 2. Recalibração de ink-900 (elevação) e hairline (divisor): com o fundo
//    mais claro, os DELTAS do v2 apagariam (ink-900 v2 #141119 tem quase a
//    mesma luminância de #141414) — sobe SÓ a claridade, matiz preservado,
//    até recuperar a mesma razão de contraste que tinham sobre o fundo v2.
// 3. Tabela completa token × fundos novos + chapados (texto ink-950 sobre
//    good/bad/zeph-300 — ink-950 mais claro DERRUBA esses pares, tem que
//    re-medir).
//
// Uso: node scripts/contrast-check.mjs

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
  const channel = (c) => Math.round(Math.min(255, Math.max(0, c))).toString(16).padStart(2, '0')
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

// Mistura fonte-sobre-fundo com alpha — acha a célula CLARA da textura de
// blocos (quadrado branco de baixa opacidade sobre o fundo), que é o pior
// caso pra texto claro (fundo mais claro → contraste menor)
function blend(bgHex, overlayHex, alpha) {
  const bg = hexToRgb(bgHex)
  const ov = hexToRgb(overlayHex)
  return rgbToHex(bg.map((c, i) => c * (1 - alpha) + ov[i] * alpha))
}

// Sobe SÓ a claridade (H e S preservados) até o contraste-alvo contra o
// fundo dado — usado pra recalibrar ink-900/hairline sem mudar o matiz
function withContrastOver(hex, bgHex, target) {
  const [h, s] = rgbToHsl(hexToRgb(hex))
  let lo = 0, hi = 1
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2
    const candidate = rgbToHex(hslToRgb([h, s, mid]))
    if (contrast(candidate, bgHex) < target) lo = mid
    else hi = mid
  }
  return rgbToHex(hslToRgb([h, s, hi]))
}

const hueOf = (hex) => rgbToHsl(hexToRgb(hex))[0]
const fmt = (n) => n.toFixed(2).replace('.', ',')

// ---------- paleta v2 (ponto de partida desta rodada) ----------

const V2 = {
  'ink-950': '#0a0a0a',
  'ink-900': '#141119',
  hairline: '#221f29',
  'zeph-300': '#9c96f5',
  'zeph-500': '#665fc4',
  'zeph-700': '#403c77',
  'zeph-800': '#302d54',
  'mist-100': '#edebf4',
  'mist-300': '#b7b2c9',
  'mist-400': '#8b86a0',
  'mist-600': '#57536a',
  good: '#22c55e',
  bad: '#f97316',
}

// Textura de blocos: quadrados brancos de baixa opacidade (mesmo alpha de
// partida da scanline v2). A célula CLARA é o pior caso de fundo.
const TEXTURE_ALPHA = 0.02

// ---------- 1. candidatos de claridade do fundo ----------

const BG_CANDIDATES = ['#101010', '#141414', '#181818']

console.log('== Candidatos de fundo v3 (croma zero) × pisos do sistema ==')
console.log('critério: mist-400 ≥ 4,5:1 (AA texto corrido) e zeph-500 ≥ 3:1')
console.log('(gráfico/texto grande) contra o fundo E contra a célula clara\n')
for (const bg of BG_CANDIDATES) {
  const cell = blend(bg, '#ffffff', TEXTURE_ALPHA)
  const rows = [
    ['mist-400', V2['mist-400'], 4.5],
    ['zeph-500', V2['zeph-500'], 3],
    ['zeph-300', V2['zeph-300'], 4.5],
  ]
  console.log(`fundo ${bg} (célula clara da textura: ${cell})`)
  for (const [name, hex, floor] of rows) {
    const onBg = contrast(hex, bg)
    const onCell = contrast(hex, cell)
    const verdict = Math.min(onBg, onCell) >= floor ? 'PASS' : 'FAIL'
    console.log(
      `  ${name}: ${fmt(onBg)}:1 no fundo · ${fmt(onCell)}:1 na célula clara → ${verdict} (piso ${floor}:1)`,
    )
  }
  console.log('')
}

// ---------- 2. escolha + recalibração de ink-900/hairline ----------

// Escolhido: #141414 — o mais claro que mantém FOLGA sobre os pisos (mist-400
// ≈5,0:1 na célula clara; sobra até pra textura subir de opacidade se o olho
// pedir) sem sair de "quase preto": #181818 já vive a 0,3 do piso na célula e
// puxa pra carvão. #101010 quase não se distingue do v2 (a queixa era o peso).
const CHOSEN_BG = '#141414'
const cell = blend(CHOSEN_BG, '#ffffff', TEXTURE_ALPHA)

// Elevação e divisor: recuperam sobre o fundo novo a MESMA razão de contraste
// que tinham sobre o fundo v2 (matiz e croma do roxo de marca preservados —
// só a claridade sobe). Sem isso a elevação simplesmente some: ink-900 v2 tem
// contraste ~1,0:1 contra #141414.
const ink900Target = contrast(V2['ink-900'], V2['ink-950'])
const hairlineTarget = contrast(V2.hairline, V2['ink-950'])
const NEW_INK900 = withContrastOver(V2['ink-900'], CHOSEN_BG, ink900Target)
const NEW_HAIRLINE = withContrastOver(V2.hairline, CHOSEN_BG, hairlineTarget)

console.log('== Recalibração de elevação/divisor (matiz preservado) ==')
console.log(
  `ink-900: ${V2['ink-900']} (h=${hueOf(V2['ink-900']).toFixed(1)}°, ${fmt(ink900Target)}:1 sobre o fundo v2; sobre o novo cairia pra ${fmt(contrast(V2['ink-900'], CHOSEN_BG))}:1)`,
)
console.log(
  `  -> ${NEW_INK900} (h=${hueOf(NEW_INK900).toFixed(1)}°, ${fmt(contrast(NEW_INK900, CHOSEN_BG))}:1 sobre ${CHOSEN_BG})`,
)
console.log(
  `hairline: ${V2.hairline} (h=${hueOf(V2.hairline).toFixed(1)}°, ${fmt(hairlineTarget)}:1 sobre o fundo v2; sobre o novo cairia pra ${fmt(contrast(V2.hairline, CHOSEN_BG))}:1)`,
)
console.log(
  `  -> ${NEW_HAIRLINE} (h=${hueOf(NEW_HAIRLINE).toFixed(1)}°, ${fmt(contrast(NEW_HAIRLINE, CHOSEN_BG))}:1 sobre ${CHOSEN_BG})`,
)

const V3 = {
  ...V2,
  'ink-950': CHOSEN_BG,
  'ink-900': NEW_INK900,
  hairline: NEW_HAIRLINE,
}

// ---------- 3. tabela completa v3 ----------

const BACKGROUNDS = [
  ['ink-950 v3', V3['ink-950']],
  ['célula clara da textura', cell],
  ['ink-900 v3 (elevação)', V3['ink-900']],
]

console.log(`\n== Tokens v3 × fundos (célula clara = branco a ${TEXTURE_ALPHA * 100}% sobre ${CHOSEN_BG}) ==`)
console.log(['token', 'hex', ...BACKGROUNDS.map(([name]) => name)].join(' | '))
for (const name of [
  'zeph-300',
  'zeph-500',
  'zeph-700',
  'zeph-800',
  'mist-100',
  'mist-300',
  'mist-400',
  'mist-600',
  'good',
  'bad',
]) {
  const hex = V3[name]
  const cells = BACKGROUNDS.map(([, bg]) => `${fmt(contrast(hex, bg))}:1`)
  console.log([name, hex, ...cells].join(' | '))
}

console.log('\n== Texto escuro sobre chapado (ink-950 v3 é mais claro — re-medido) ==')
for (const [label, bg] of [
  ['ink-950 sobre bad (badge offline sólido)', V3.bad],
  ['ink-950 sobre good', V3.good],
  ['ink-950 sobre zeph-300 (botão primário / chip de destaque)', V3['zeph-300']],
]) {
  console.log(`${label}: ${fmt(contrast(V3['ink-950'], bg))}:1`)
}

console.log('\n== Tints de estado do rig (fundo do badge = wash sobre ink-950 v3) ==')
console.log('degrau de peso do StatusBadge: normal good/10 < below bad/20 < offline bad sólido')
for (const [label, tokenHex, alpha] of [
  ['texto good sobre bg-good/10 (normal)', V3.good, 0.1],
  ['texto bad sobre bg-bad/20 (below)', V3.bad, 0.2],
  ['(referência) good sobre bg-good/15', V3.good, 0.15],
  ['(referência) bad sobre bg-bad/15', V3.bad, 0.15],
]) {
  const tinted = blend(V3['ink-950'], tokenHex, alpha)
  const tokenOnTint = contrast(tokenHex, tinted)
  const mist100OnTint = contrast(V3['mist-100'], tinted)
  console.log(
    `${label}: fundo tintado = ${tinted} · própria cor ${fmt(tokenOnTint)}:1 · mist-100 ${fmt(mist100OnTint)}:1`,
  )
}

console.log('\n== Referência: o que muda vs. v2 (fundo antigo #0a0a0a / listra #0f0f0f) ==')
const v2stripe = blend(V2['ink-950'], '#ffffff', 0.02)
for (const name of ['zeph-300', 'zeph-500', 'zeph-700', 'mist-400', 'good', 'bad']) {
  const before = `${fmt(contrast(V2[name], V2['ink-950']))}:1 (listra ${fmt(contrast(V2[name], v2stripe))}:1)`
  const after = `${fmt(contrast(V3[name], V3['ink-950']))}:1 (célula ${fmt(contrast(V3[name], cell))}:1)`
  console.log(`${name}: v2 ${before} -> v3 ${after}`)
}
