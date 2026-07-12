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

// ============================================================================
// TEMA CLARO (rodada do 2º tema, 2026-07-12) — mesmos PISOS DE PAPEL do
// escuro, medidos contra o fundo claro E contra a célula ESCURA da textura
// (a polaridade inverte: no claro a grade é PRETO de baixa opacidade sobre o
// fundo, e o pior caso pra texto escuro é a célula mais escura... na verdade
// o pior caso pra TEXTO ESCURO é o fundo mais ESCURO? Não — contraste de
// texto escuro CAI quando o fundo escurece; a célula (mais escura que o
// fundo) é o pior caso. Espelho exato do escuro, onde a célula CLARA era o
// pior caso pra texto claro.)
//
// Pisos de papel (idênticos ao escuro):
//   destaque (zeph-300)  ≥ 7:1 na célula
//   suporte (zeph-500)   ≥ 3:1 na célula
//   piso de texto (mist-400) ≥ 4,5:1 com folga (alvo ≥5:1 na célula)
//   estados good/bad (são TEXTO de caption) ≥ 4,5:1 com folga (alvo ≥6:1)
//   texto ink-950 sobre chapado good/bad/zeph-300 ≥ 4,5:1
//   alívio (zeph-700) ~2:1 · decoração documentada (zeph-800, mist-600,
//   hairline, scroll) — sem piso, só registro.
//
// Valores de PARTIDA do planejamento; o que falhar piso é RECALIBRADO aqui
// (desce a claridade com H/S preservados — espelho do withContrastOver, que
// no v3 subiu a claridade dos escuros).

// Desce SÓ a claridade (H e S preservados) até o contraste-alvo — pra texto
// ESCURO sobre fundo claro (direção oposta do withContrastOver)
function darkenToContrast(hex, bgHex, target) {
  const [h, s] = rgbToHsl(hexToRgb(hex))
  let lo = 0, hi = rgbToHsl(hexToRgb(hex))[2]
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2
    const candidate = rgbToHex(hslToRgb([h, s, mid]))
    if (contrast(candidate, bgHex) >= target) lo = mid
    else hi = mid
  }
  return rgbToHex(hslToRgb([h, s, lo]))
}

const LIGHT_START = {
  'ink-950': '#f7f7f7',
  'ink-900': '#ffffff',
  hairline: '#d9dde6',
  'zeph-300': '#1d4ed8',
  'zeph-500': '#3b82f6',
  'zeph-700': '#93c5fd',
  'zeph-800': '#bfdbfe',
  'mist-100': '#171c26',
  'mist-300': '#3f4859',
  'mist-400': '#5a6373',
  'mist-600': '#a9b1c2',
  good: '#15803d',
  bad: '#c2410c',
  scroll: '#c8c8c8',
}
// Textura clara: PRETO a 3% (o branco 2% do escuro espelhado; 3% porque o
// olho percebe menos textura escura sobre claro que o inverso — mesma
// família de alpha, célula medida abaixo)
const LIGHT_TEXTURE_ALPHA = 0.03
const LIGHT_BG = LIGHT_START['ink-950']
const lightCell = blend(LIGHT_BG, '#000000', LIGHT_TEXTURE_ALPHA)

console.log('\n\n============ TEMA CLARO ============')
console.log(`fundo ${LIGHT_BG} · célula escura da textura (preto a ${LIGHT_TEXTURE_ALPHA * 100}%): ${lightCell}`)

// ---------- calibração dos que têm piso de TEXTO ----------
// Partida medida primeiro; se falhar o alvo, desce a claridade e registra.
const CALIBRATION = [
  // [token, alvoNaCélula, motivo]
  ['zeph-300', 7.0, 'destaque/manchete/chip — piso 7:1 (escuro: 7,1:1)'],
  ['good', 6.0, 'texto de estado positivo — piso 4,5:1 com folga (escuro: 8,1:1)'],
  ['bad', 6.0, 'texto de estado negativo — piso 4,5:1 com folga (escuro: 6,6:1)'],
]
const LIGHT = { ...LIGHT_START }
console.log('\n== Calibração (H/S preservados, claridade desce até o alvo na célula) ==')
for (const [name, target, why] of CALIBRATION) {
  const start = LIGHT_START[name]
  const onCell = contrast(start, lightCell)
  if (onCell >= target) {
    console.log(`${name}: partida ${start} já bate (${fmt(onCell)}:1 ≥ ${target}:1) — mantido · ${why}`)
  } else {
    const fixed = darkenToContrast(start, lightCell, target)
    LIGHT[name] = fixed
    console.log(
      `${name}: partida ${start} FALHA (${fmt(onCell)}:1 < ${target}:1) -> ${fixed} ` +
      `(${fmt(contrast(fixed, lightCell))}:1 na célula, h=${hueOf(fixed).toFixed(1)}°) · ${why}`,
    )
  }
}

// ---------- tabela completa do claro ----------
const LIGHT_BACKGROUNDS = [
  ['ink-950 claro', LIGHT['ink-950']],
  ['célula escura da textura', lightCell],
  ['ink-900 claro (elevação = BRANCO, mais claro que o fundo — direção invertida de propósito)', LIGHT['ink-900']],
]
console.log('\n== Tokens claros × fundos ==')
console.log(['token', 'hex', 'fundo', 'célula', 'elevação'].join(' | '))
for (const name of [
  'zeph-300', 'zeph-500', 'zeph-700', 'zeph-800',
  'mist-100', 'mist-300', 'mist-400', 'mist-600',
  'good', 'bad', 'hairline', 'scroll',
]) {
  const hex = LIGHT[name]
  const cells = LIGHT_BACKGROUNDS.map(([, bg]) => `${fmt(contrast(hex, bg))}:1`)
  console.log([name, hex, ...cells].join(' | '))
}

// ---------- pisos de papel: veredito ----------
console.log('\n== Veredito dos pisos (pior caso = célula) ==')
const FLOORS = [
  ['zeph-300', 7, 'destaque'],
  ['zeph-500', 3, 'suporte/gráfico'],
  ['mist-400', 4.5, 'piso de texto corrido (alvo folgado ≥5)'],
  ['mist-300', 4.5, 'texto secundário'],
  ['mist-100', 7, 'texto principal'],
  ['good', 4.5, 'texto de estado'],
  ['bad', 4.5, 'texto de estado'],
]
let allPass = true
for (const [name, floor, role] of FLOORS) {
  const worst = Math.min(contrast(LIGHT[name], LIGHT_BG), contrast(LIGHT[name], lightCell))
  const ok = worst >= floor
  allPass &&= ok
  console.log(`${name} (${role}): pior caso ${fmt(worst)}:1 → ${ok ? 'PASS' : 'FAIL'} (piso ${floor}:1)`)
}

// ---------- texto claro sobre chapado ----------
console.log('\n== Texto ink-950 claro sobre chapado (chip zeph-300 / offline bad) ==')
for (const [label, bg] of [
  ['ink-950 sobre zeph-300 (chip de destaque)', LIGHT['zeph-300']],
  ['ink-950 sobre bad (badge offline sólido)', LIGHT.bad],
  ['ink-950 sobre good (referência)', LIGHT.good],
]) {
  const ratio = contrast(LIGHT['ink-950'], bg)
  console.log(`${label}: ${fmt(ratio)}:1 ${ratio >= 4.5 ? 'PASS' : 'FAIL'}`)
}

// ---------- tints compostos sobre os fundos claros ----------
console.log('\n== Tints compostos (composição REAL sobre os fundos claros) ==')
// SegmentedControl ativo: zeph-800/40 POR CIMA da elevação ink-900
const segTint = blend(LIGHT['ink-900'], LIGHT['zeph-800'], 0.4)
console.log(
  `zeph-800/40 sobre ink-900 (SegmentedControl ativo) = ${segTint} · ` +
  `texto ativo zeph-300: ${fmt(contrast(LIGHT['zeph-300'], segTint))}:1 ${contrast(LIGHT['zeph-300'], segTint) >= 4.5 ? 'PASS' : 'FAIL'}`,
)
// Alerta do piso do ratio: bg-bad/10 sobre ink-900 (o readout é elevado)
const alertTint = blend(LIGHT['ink-900'], LIGHT.bad, 0.1)
console.log(
  `bad/10 sobre ink-900 (alerta do piso) = ${alertTint} · ` +
  `caption text-bad: ${fmt(contrast(LIGHT.bad, alertTint))}:1 ${contrast(LIGHT.bad, alertTint) >= 4.5 ? 'PASS' : 'FAIL'} · ` +
  `corpo mist-100: ${fmt(contrast(LIGHT['mist-100'], alertTint))}:1 ${contrast(LIGHT['mist-100'], alertTint) >= 4.5 ? 'PASS' : 'FAIL'}`,
)
// Linha destacada da Bússola: zeph-800/20 sobre ink-950 (fundo da página)
const rowTint = blend(LIGHT['ink-950'], LIGHT['zeph-800'], 0.2)
console.log(
  `zeph-800/20 sobre ink-950 (linha maior hashrate) = ${rowTint} · ` +
  `célula de texto mist-100: ${fmt(contrast(LIGHT['mist-100'], rowTint))}:1 · ` +
  `chip zeph-300 (texto ink-950): sobre o chip vale o chapado acima`,
)

console.log(`\n>>> RESULTADO CLARO: ${allPass ? 'TODOS OS PISOS PASSAM' : 'HÁ FALHAS — recalibre acima'}`)
console.log('>>> valores finais pro bloco [data-theme=light]:')
for (const [name, hex] of Object.entries(LIGHT)) console.log(`  ${name}: ${hex}`)
console.log(`  textura: preto a ${LIGHT_TEXTURE_ALPHA * 100}% (célula ${lightCell})`)

// ============================================================================
// GLIFO DE TEMA (sol/lua no ThemeToggle, 2026-07-12) — elemento interativo
// NÃO-texto: o piso WCAG 2.2 (1.4.11) é 3:1 contra os fundos adjacentes. O
// traço usa o token mist-400 (mesmo peso visual do rótulo mono que
// substituiu); pior caso = a célula da textura, como no resto do sistema.
console.log('\n\n============ GLIFO DE TEMA (mist-400, piso não-texto 3:1) ============')
const ICON_FLOOR = 3
for (const [themeName, palette, bg, textureCell] of [
  ['escuro', V3, V3['ink-950'], cell],
  ['claro', LIGHT, LIGHT['ink-950'], lightCell],
]) {
  const onBg = contrast(palette['mist-400'], bg)
  const onCell = contrast(palette['mist-400'], textureCell)
  const worst = Math.min(onBg, onCell)
  console.log(
    `${themeName}: mist-400 ${palette['mist-400']} → ${fmt(onBg)}:1 no fundo · ` +
    `${fmt(onCell)}:1 na célula → pior caso ${fmt(worst)}:1 ${worst >= ICON_FLOOR ? 'PASS' : 'FAIL'} (piso ${ICON_FLOOR}:1)`,
  )
}
