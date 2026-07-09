// Aviso de erro compartilhado por todos os módulos (convenção do CLAUDE.md:
// falha de rede/API sempre visível, nunca tela em branco nem silêncio).
//
// - variant="stale": ainda há dado (antigo) na tela; aviso âmbar de retentativa.
// - variant="blocking": não há dado nenhum; cartão vermelho no lugar do conteúdo.

interface ErrorNoticeProps {
  variant?: 'stale' | 'blocking'
  title?: string
  detail?: string
}

export function ErrorNotice({ variant = 'stale', title, detail }: ErrorNoticeProps) {
  if (variant === 'blocking') {
    return (
      <div
        role="alert"
        className="rounded-xl border border-rose-900/60 bg-rose-950/40 p-4 text-sm text-rose-200"
      >
        <p className="font-medium">
          <span aria-hidden>⚠️ </span>
          {title ?? 'Dado indisponível no momento — tentando de novo automaticamente.'}
        </p>
        {detail && <p className="mt-1 text-rose-300/80">{detail}</p>}
      </div>
    )
  }

  return (
    <div
      role="alert"
      className="rounded-xl border border-amber-900/60 bg-amber-950/40 px-4 py-3 text-sm text-amber-200"
    >
      <span aria-hidden>⚠️ </span>
      {title ?? 'Dado indisponível — mostrando o último valor conhecido e tentando de novo.'}
      {detail && <span className="text-amber-300/80"> {detail}</span>}
    </div>
  )
}
