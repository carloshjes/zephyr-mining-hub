// Tema do produto — o ESCURO é o default (identidade; os e2e verificam cor
// computada no default) e o claro é um override de valores dos MESMOS tokens
// via [data-theme='light'] no <html> (bloco em src/index.css).
//
// O atributo é aplicado ANTES do primeiro paint por um script inline no
// index.html (anti-flash) que lê a MESMA chave daqui — se mudar chave ou
// valor, mude lá junto. Este módulo é a fonte de verdade em runtime: lê o
// atributo (que o inline já setou), alterna e persiste.

export type Theme = 'dark' | 'light'

export const THEME_STORAGE_KEY = 'zephyr-hub.theme.v1'

/** Tema em vigor agora — lido do atributo (o inline script do index.html já
    resolveu o localStorage antes do paint; o atributo é a verdade). */
export function currentTheme(): Theme {
  return document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark'
}

/** Aplica o tema no <html> e persiste. O escuro REMOVE o atributo (default
    sem marcação — nenhum seletor depende de data-theme='dark'). */
export function applyTheme(theme: Theme): void {
  if (theme === 'light') {
    document.documentElement.setAttribute('data-theme', 'light')
  } else {
    document.documentElement.removeAttribute('data-theme')
  }
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme)
  } catch {
    // Sem localStorage o tema vale só pra sessão — aceitável
  }
}
