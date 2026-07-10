// Aviso de erro compartilhado por todos os módulos (convenção do CLAUDE.md:
// falha de rede/API sempre visível, nunca tela em branco nem silêncio).
//
// Direção "Sinal Técnico": o vermelho é RESERVADO pra alerta — os dois
// variantes usam a mesma família, mudando só o peso do tratamento:
// - variant="stale": ainda há dado (antigo) na tela; barra lateral + tag mono.
// - variant="blocking": não há dado nenhum; moldura de alerta no lugar do conteúdo.

interface ErrorNoticeProps {
  variant?: 'stale' | 'blocking'
  title?: string
  detail?: string
}

export function ErrorNotice({ variant = 'stale', title, detail }: ErrorNoticeProps) {
  if (variant === 'blocking') {
    return (
      <div role="alert" className="border border-alert/60 bg-alert/10 px-4 py-3 text-sm">
        <p className="font-medium text-mist-100">
          <span aria-hidden className="mr-2 font-mono text-xs text-alert">[ FALHA ]</span>
          {title ?? 'Dado indisponível no momento — tentando de novo automaticamente.'}
        </p>
        {detail && <p className="mt-1 text-mist-300">{detail}</p>}
      </div>
    )
  }

  return (
    <div role="alert" className="border-l-2 border-alert py-1 pl-3 text-sm text-mist-300">
      <span aria-hidden className="mr-2 font-mono text-xs text-alert">[ ! ]</span>
      {title ?? 'Dado indisponível — mostrando o último valor conhecido e tentando de novo.'}
      {detail && <span className="text-mist-400"> {detail}</span>}
    </div>
  )
}
